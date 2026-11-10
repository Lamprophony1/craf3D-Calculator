using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using PrintCost.Application.Orders;
using PrintCost.Application.Quotes;

namespace PrintCost.Api.Tests;

public sealed class OrderDateApiTests
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web) { Converters = { new JsonStringEnumConverter() } };

    [Fact]
    public async Task Manual_creation_defaults_to_the_Paraguay_day_and_keeps_explicit_or_unknown_historical_dates()
    {
        await using var app = new OrderApiTests.OrderFactory();
        using var client = await app.LoginAsync();

        var input = new OrderInput(Guid.NewGuid(), "Taller", TotalGs: 60000m, Status: OrderStatus.Confirmed);
        var automatic = await Read<OrderRecord>(await client.PostAsJsonAsync("/api/orders", input, Json));
        AssertCreationDate(automatic);

        var explicitDate = new DateOnly(2023, 6, 14);
        var dated = await Read<OrderRecord>(await client.PostAsJsonAsync("/api/orders", input with
            { Id = Guid.NewGuid(), OrderDate = explicitDate }, Json));
        Assert.Equal(explicitDate, dated.OrderDate);

        var historical = await Read<OrderRecord>(await client.PostAsJsonAsync("/api/orders", input with
            { Id = Guid.NewGuid(), Historical = true, Status = OrderStatus.Delivered }, Json));
        Assert.Null(historical.OrderDate);
    }

    [Fact]
    public async Task Quick_budget_keeps_its_creation_day_when_recalculated_and_confirmed()
    {
        await using var app = new OrderApiTests.OrderFactory();
        using var client = await app.LoginAsync();
        var request = new QuickOrderRequest(Guid.NewGuid(), 1, await QuickCalculation(client), "Taller", "Soporte");

        var saved = await Read<QuickOrderResult>(await client.PostAsJsonAsync("/api/orders/quick", request, Json));
        var original = Assert.IsType<OrderRecord>(saved.Order);
        AssertCreationDate(original);

        var recalculated = await Read<QuickOrderResult>(await client.PostAsJsonAsync("/api/orders/quick",
            request with { Sequence = 2, Calculation = request.Calculation with { TotalGrams = 200m } }, Json));
        var revised = Assert.IsType<OrderRecord>(recalculated.Order);
        Assert.Equal(original.Id, revised.Id);
        Assert.Equal(original.OrderDate, revised.OrderDate);

        var confirmed = await Read<OrderRecord>(await client.PostAsJsonAsync($"/api/orders/{original.Id}/status",
            new { revised.Version, Status = "Confirmed" }));
        Assert.Equal(original.OrderDate, confirmed.OrderDate);
    }

    [Fact]
    public async Task Complete_budget_creates_a_dated_order_and_recalculating_keeps_its_date()
    {
        await using var app = new OrderApiTests.OrderFactory();
        using var client = await app.LoginAsync();
        var calculation = await QuickCalculation(client);
        var preview = await Read<QuickQuotePreviewResult>(await client.PostAsJsonAsync("/api/calculations/quick-quote-preview", calculation, Json));
        var customer = await Read<JsonElement>(await client.PostAsJsonAsync("/api/customers", new { Name = "Taller", IsActive = true }));
        var quote = await Read<QuoteRecord>(await client.PostAsJsonAsync("/api/quotes", new CreateQuoteRequest(
            preview.AdvancedRequest!, customer.GetProperty("id").GetGuid(), null, null, null), Json));
        var orderUrl = $"/api/orders/by-quote/{quote.Id}";
        var order = (await client.GetFromJsonAsync<OrderRecord>(orderUrl, Json))!;

        Assert.Equal(quote.CreatedAt, order.CreatedAt);
        Assert.Equal("Taller", order.CustomerReference);
        AssertCreationDate(order);

        var storedDate = new DateOnly(2023, 6, 14);
        await ChangeOrderDate(client, order, storedDate);
        (await client.PostAsync($"/api/quotes/{quote.Id}/revisions/from-current-costs", null)).EnsureSuccessStatusCode();
        Assert.Equal(storedDate, (await client.GetFromJsonAsync<OrderRecord>(orderUrl, Json))!.OrderDate);
    }

    [Fact]
    public async Task Duplicating_a_budget_uses_the_new_creation_day_instead_of_the_source_date()
    {
        await using var app = new OrderApiTests.OrderFactory();
        using var client = await app.LoginAsync();
        var request = new QuickOrderRequest(Guid.NewGuid(), 1, await QuickCalculation(client), "Taller", "Soporte");
        var saved = await Read<QuickOrderResult>(await client.PostAsJsonAsync("/api/orders/quick", request, Json));
        var original = Assert.IsType<OrderRecord>(saved.Order);
        var storedDate = new DateOnly(2023, 6, 14);
        await ChangeOrderDate(client, original, storedDate);

        var duplicate = await Read<QuoteRecord>(await client.PostAsync($"/api/quotes/{original.QuoteId}/duplicate", null));
        var order = (await client.GetFromJsonAsync<OrderRecord>($"/api/orders/by-quote/{duplicate.Id}", Json))!;

        Assert.Equal(duplicate.CreatedAt, order.CreatedAt);
        AssertCreationDate(order);
        Assert.Equal(storedDate, (await client.GetFromJsonAsync<OrderRecord>($"/api/orders/{original.Id}", Json))!.OrderDate);
    }

    private static void AssertCreationDate(OrderRecord order)
    {
        var local = TimeZoneInfo.ConvertTimeBySystemTimeZoneId(order.CreatedAt, "America/Asuncion");
        Assert.Equal(DateOnly.FromDateTime(local.DateTime), order.OrderDate);
    }

    private static async Task<QuickQuotePreviewRequest> QuickCalculation(HttpClient client)
    {
        var response = await client.PostAsJsonAsync("/api/filaments/simple", new
            { material = "PLA", displayName = "Blanco", landedCostGs = 132000m, netWeightGrams = 1000 });
        var spool = (await Read<JsonElement>(response)).GetProperty("id").GetGuid();
        return new QuickQuotePreviewRequest(spool, 220, 131.04m);
    }

    private static async Task ChangeOrderDate(HttpClient client, OrderRecord order, DateOnly date) =>
        (await client.PutAsJsonAsync($"/api/orders/{order.Id}", new
            { order.Id, order.Version, order.CustomerReference, order.Description, order.Quantity, order.TotalGs, OrderDate = date }, Json))
            .EnsureSuccessStatusCode();

    private static async Task<T> Read<T>(HttpResponseMessage response)
    {
        using (response)
        {
            response.EnsureSuccessStatusCode();
            return (await response.Content.ReadFromJsonAsync<T>(Json))!;
        }
    }
}
