using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using PrintCost.Application.Orders;
using PrintCost.Application.Quotes;

namespace PrintCost.Api.Tests;

public sealed class OrderQuoteRevisionApiTests
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web) { Converters = { new JsonStringEnumConverter() } };

    [Theory]
    [InlineData(false, false)]
    [InlineData(true, false)]
    [InlineData(false, true)]
    public async Task Adjusting_keeps_the_same_budget_and_preserves_a_manual_or_diverging_amount(bool manualPrice, bool divergedPrice)
    {
        await using var app = new OrderApiTests.OrderFactory();
        using var client = await app.LoginAsync();
        var (order, quickRequest) = await SaveQuickBudget(client);
        var quoteId = order.QuoteId!.Value;
        var orderUrl = $"/api/orders/{order.Id}";
        var quoteUrl = $"/api/quotes/{quoteId}";

        if (manualPrice)
        {
            var edit = await client.PutAsJsonAsync(orderUrl, new OrderInput(order.Id, order.CustomerReference,
                order.Description, TotalGs: 123456m, DueDate: new DateOnly(2026, 11, 20), Notes: "Entregar de tarde",
                Version: order.Version), Json);
            edit.EnsureSuccessStatusCode();
            order = (await edit.Content.ReadFromJsonAsync<OrderRecord>(Json))!;
        }

        if (divergedPrice)
            (await client.PutAsJsonAsync($"/api/filaments/{quickRequest.Calculation.SpoolId}/simple",
                new { material = "PLA", displayName = "Blanco", landedCostGs = 500_000m, netWeightGrams = 1000 })).EnsureSuccessStatusCode();
        foreach (var step in new[] { "calculate", "ready", "send" })
            (await client.PostAsync($"{quoteUrl}/{step}", null)).EnsureSuccessStatusCode();
        var sent = (await client.GetFromJsonAsync<QuoteRecord>(quoteUrl, Json))!;
        var previous = sent.Revisions.MaxBy(revision => revision.RevisionNumber)!;
        Assert.Equal(QuoteStatus.Sent, sent.Status);
        if (divergedPrice) Assert.NotEqual(order.TotalGs, previous.TotalCustomerPriceGs);
        var calculation = previous.Request with { Quantity = previous.Request.Quantity with { Quantity = 3 } };
        var lines = new[] { new QuoteLineRequest("Tres soportes", calculation) };

        var save = await client.PutAsJsonAsync($"{orderUrl}/quote-revision", new { order.Version, previous.RevisionNumber, lines }, Json);
        save.EnsureSuccessStatusCode();
        var adjusted = (await save.Content.ReadFromJsonAsync<OrderRecord>(Json))!;
        var updatedQuote = (await client.GetFromJsonAsync<QuoteRecord>(quoteUrl, Json))!;
        var latest = updatedQuote.Revisions.MaxBy(revision => revision.RevisionNumber)!;

        Assert.Equal(order.Id, adjusted.Id);
        Assert.Equal(order.Code, adjusted.Code);
        Assert.Equal(quoteId, adjusted.QuoteId);
        Assert.Equal(QuoteStatus.Draft, updatedQuote.Status);
        Assert.Equal(sent.Code, updatedQuote.Code);
        Assert.Equal(OrderStatus.Draft, adjusted.Status);
        Assert.Equal(order.Version + 1, adjusted.Version);
        Assert.Equal(order.CustomerReference, adjusted.CustomerReference);
        Assert.Equal(order.Description, adjusted.Description);
        Assert.Equal(order.DueDate, adjusted.DueDate);
        Assert.Equal(order.Notes, adjusted.Notes);
        Assert.Equal(sent.CustomerReference, updatedQuote.CustomerReference);
        Assert.Equal(sent.ItemDescription, updatedQuote.ItemDescription);
        Assert.Equal(3, adjusted.Quantity);
        Assert.Equal(previous.RevisionNumber + 1, latest.RevisionNumber);
        Assert.Equal(sent.Revisions.Count + 1, updatedQuote.Revisions.Count);
        Assert.Equal(previous.TotalCustomerPriceGs, updatedQuote.Revisions.Single(revision => revision.Id == previous.Id).TotalCustomerPriceGs);
        Assert.Equal(manualPrice || divergedPrice ? order.TotalGs : latest.TotalCustomerPriceGs, adjusted.TotalGs);
        Assert.NotEqual(previous.TotalCustomerPriceGs, latest.TotalCustomerPriceGs);
        Assert.Equal(HttpStatusCode.Conflict, (await client.PostAsJsonAsync("/api/orders/quick", quickRequest with { Sequence = 2 }, Json)).StatusCode);
        Assert.Equal(1, (await client.GetFromJsonAsync<OrderPage>("/api/orders?view=drafts", Json))!.Total);
    }

    [Fact]
    public async Task Adopting_a_revision_checks_both_versions_and_copies_its_stored_price()
    {
        await using var app = new OrderApiTests.OrderFactory();
        using var client = await app.LoginAsync();
        var (order, quickRequest) = await SaveQuickBudget(client);
        var orderUrl = $"/api/orders/{order.Id}";
        var quoteUrl = $"/api/quotes/{order.QuoteId}";
        var spool = quickRequest.Calculation.SpoolId;
        var quote = await RepriceAtHigherCost(client, order, spool);
        var revision = quote.Revisions.MaxBy(row => row.RevisionNumber)!;
        Assert.NotEqual(order.TotalGs, revision.TotalCustomerPriceGs);
        Assert.Equal(order.TotalGs, (await client.GetFromJsonAsync<OrderRecord>(orderUrl, Json))!.TotalGs);

        Assert.Equal(HttpStatusCode.Conflict, (await client.PostAsJsonAsync($"{orderUrl}/quote-price",
            new { order.Version, revisionNumber = revision.RevisionNumber - 1 })).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, (await client.PostAsJsonAsync($"{orderUrl}/quote-price",
            new { version = order.Version - 1, revision.RevisionNumber })).StatusCode);
        Assert.Equal(order, await client.GetFromJsonAsync<OrderRecord>(orderUrl, Json));

        // Adoption reads the saved revision and does not price from the catalog again.
        (await client.PutAsJsonAsync($"/api/filaments/{spool}/simple", new { material = "PLA", displayName = "Blanco",
            landedCostGs = 900_000m, netWeightGrams = 1_000 })).EnsureSuccessStatusCode();
        var usePrice = await client.PostAsJsonAsync($"{orderUrl}/quote-price", new { order.Version, revision.RevisionNumber });
        usePrice.EnsureSuccessStatusCode();
        var adopted = (await usePrice.Content.ReadFromJsonAsync<OrderRecord>(Json))!;
        Assert.Equal(order with { TotalGs = revision.TotalCustomerPriceGs, Version = order.Version + 1,
            UpdatedAt = adopted.UpdatedAt, QuickLocked = true }, adopted);
        var unchangedQuote = (await client.GetFromJsonAsync<QuoteRecord>(quoteUrl, Json))!;
        Assert.Equal(quote.Status, unchangedQuote.Status);
        Assert.Equal(quote.Revisions.Select(row => row.Id), unchangedQuote.Revisions.Select(row => row.Id));
    }

    [Fact]
    public async Task Adjusting_does_not_save_an_unusable_revision_or_modify_a_confirmed_order()
    {
        await using var app = new OrderApiTests.OrderFactory();
        using var client = await app.LoginAsync();
        var (order, _) = await SaveQuickBudget(client);
        var orderUrl = $"/api/orders/{order.Id}";
        var quoteUrl = $"/api/quotes/{order.QuoteId}";
        var quote = (await client.GetFromJsonAsync<QuoteRecord>(quoteUrl, Json))!;
        var previous = Assert.Single(quote.Revisions);
        var unusable = new[] { new QuoteLineRequest("Sin tiempo de impresión", previous.Request with { PrintDurationHours = 0m }) };
        Assert.Equal(HttpStatusCode.BadRequest, (await client.PutAsJsonAsync($"{orderUrl}/quote-revision",
            new { order.Version, previous.RevisionNumber, lines = unusable }, Json)).StatusCode);
        Assert.Equal(order, await client.GetFromJsonAsync<OrderRecord>(orderUrl, Json));
        Assert.Single((await client.GetFromJsonAsync<QuoteRecord>(quoteUrl, Json))!.Revisions);

        var confirmation = await client.PostAsJsonAsync($"{orderUrl}/status", new { order.Version, status = "Confirmed" });
        confirmation.EnsureSuccessStatusCode();
        var confirmed = (await confirmation.Content.ReadFromJsonAsync<OrderRecord>(Json))!;
        var lines = new[] { new QuoteLineRequest("Soporte", previous.Request) };
        Assert.Equal(HttpStatusCode.Conflict, (await client.PutAsJsonAsync($"{orderUrl}/quote-revision",
            new { confirmed.Version, previous.RevisionNumber, lines }, Json)).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, (await client.PostAsJsonAsync($"{orderUrl}/quote-price",
            new { confirmed.Version, previous.RevisionNumber })).StatusCode);
        Assert.Equal(confirmed, await client.GetFromJsonAsync<OrderRecord>(orderUrl, Json));
    }

    [Fact]
    public async Task Preparing_a_saved_quote_for_sending_requires_a_usable_price_and_no_recalculation()
    {
        await using var app = new OrderApiTests.OrderFactory();
        using var client = await app.LoginAsync();
        var (order, _) = await SaveQuickBudget(client);
        var quoteUrl = $"/api/quotes/{order.QuoteId}";
        var before = (await client.GetFromJsonAsync<QuoteRecord>(quoteUrl, Json))!;
        var savedRevision = Assert.Single(before.Revisions);

        var prepare = await client.PostAsync($"{quoteUrl}/ready", null);
        prepare.EnsureSuccessStatusCode();
        var ready = (await prepare.Content.ReadFromJsonAsync<QuoteRecord>(Json))!;
        Assert.Equal(QuoteStatus.ReadyToSend, ready.Status);
        Assert.Equal(savedRevision.Id, Assert.Single(ready.Revisions).Id);
        Assert.Equal(savedRevision.TotalCustomerPriceGs, Assert.Single(ready.Revisions).TotalCustomerPriceGs);
        (await client.PostAsync($"{quoteUrl}/send", null)).EnsureSuccessStatusCode();
        Assert.Equal(order, await client.GetFromJsonAsync<OrderRecord>($"/api/orders/{order.Id}", Json));

        var create = await client.PostAsJsonAsync("/api/quotes", new CreateQuoteRequest(
            savedRevision.Request with { PrintDurationHours = 0m }, null, null, null, null), Json);
        create.EnsureSuccessStatusCode();
        var unusable = (await create.Content.ReadFromJsonAsync<QuoteRecord>(Json))!;
        Assert.False(Assert.Single(unusable.Revisions).CanUsePrice);
        Assert.Equal(HttpStatusCode.Conflict, (await client.PostAsync($"/api/quotes/{unusable.Id}/ready", null)).StatusCode);
        Assert.Equal(QuoteStatus.Draft, (await client.GetFromJsonAsync<QuoteRecord>($"/api/quotes/{unusable.Id}", Json))!.Status);
    }

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task Linking_production_keeps_the_confirmed_amount_or_fills_a_missing_amount(bool missingAmount)
    {
        await using var app = new OrderApiTests.OrderFactory();
        using var client = await app.LoginAsync();
        var (order, quickRequest) = await SaveQuickBudget(client);
        var orderUrl = $"/api/orders/{order.Id}";
        var quoteUrl = $"/api/quotes/{order.QuoteId}";
        var quote = await RepriceAtHigherCost(client, order, quickRequest.Calculation.SpoolId);
        var documentAmount = quote.Revisions.MaxBy(revision => revision.RevisionNumber)!.TotalCustomerPriceGs;
        Assert.NotEqual(order.TotalGs, documentAmount);

        var confirmation = await client.PostAsJsonAsync($"{orderUrl}/status", new { order.Version, status = "Confirmed" });
        confirmation.EnsureSuccessStatusCode();
        var confirmed = (await confirmation.Content.ReadFromJsonAsync<OrderRecord>(Json))!;
        if (missingAmount)
        {
            var clear = await client.PutAsJsonAsync(orderUrl, new OrderInput(confirmed.Id,
                confirmed.CustomerReference, confirmed.Description, Version: confirmed.Version), Json);
            clear.EnsureSuccessStatusCode();
            Assert.Null((await clear.Content.ReadFromJsonAsync<OrderRecord>(Json))!.TotalGs);
        }
        foreach (var step in new[] { "ready", "send", "accept", "convert-to-job" })
            (await client.PostAsync($"{quoteUrl}/{step}", null)).EnsureSuccessStatusCode();

        var linked = (await client.GetFromJsonAsync<OrderRecord>(orderUrl, Json))!;
        Assert.Equal(OrderStatus.Confirmed, linked.Status);
        Assert.NotNull(linked.JobId);
        Assert.Equal(missingAmount ? documentAmount : order.TotalGs, linked.TotalGs);
    }

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task Editing_draft_lines_preserves_a_diverging_amount_and_checks_the_source_revision(bool staleRevision)
    {
        await using var app = new OrderApiTests.OrderFactory();
        using var client = await app.LoginAsync();
        var (order, quickRequest) = await SaveQuickBudget(client);
        var orderUrl = $"/api/orders/{order.Id}";
        var quoteUrl = $"/api/quotes/{order.QuoteId}";
        var quote = await RepriceAtHigherCost(client, order, quickRequest.Calculation.SpoolId);
        var recalculated = quote.Revisions.MaxBy(revision => revision.RevisionNumber)!;
        Assert.NotEqual(order.TotalGs, recalculated.TotalCustomerPriceGs);

        var adjusted = await client.PutAsJsonAsync($"{orderUrl}/quote-revision", new { order.Version, recalculated.RevisionNumber,
            lines = new[] { new QuoteLineRequest("Primera revisión", recalculated.Request) } }, Json);
        adjusted.EnsureSuccessStatusCode();
        Assert.Equal(order.TotalGs, (await adjusted.Content.ReadFromJsonAsync<OrderRecord>(Json))!.TotalGs);

        var calculation = recalculated.Request with { Quantity = recalculated.Request.Quantity with { Quantity = 2 } };
        var edited = await client.PutAsJsonAsync(quoteUrl, new { revisionNumber = recalculated.RevisionNumber + (staleRevision ? 0 : 1),
            lines = new[] { new QuoteLineRequest("Dos soportes", calculation) } }, Json);
        if (staleRevision)
        {
            Assert.Equal(HttpStatusCode.Conflict, edited.StatusCode);
            var unchanged = (await client.GetFromJsonAsync<QuoteRecord>(quoteUrl, Json))!;
            Assert.Equal(recalculated.RevisionNumber + 1, unchanged.Revisions.Max(revision => revision.RevisionNumber));
            Assert.Equal(order.TotalGs, (await client.GetFromJsonAsync<OrderRecord>(orderUrl, Json))!.TotalGs);
            return;
        }

        edited.EnsureSuccessStatusCode();
        var editedQuote = (await edited.Content.ReadFromJsonAsync<QuoteRecord>(Json))!;
        Assert.Equal(recalculated.RevisionNumber + 2, editedQuote.Revisions.Max(revision => revision.RevisionNumber));
        Assert.Equal(order.TotalGs, (await client.GetFromJsonAsync<OrderRecord>(orderUrl, Json))!.TotalGs);
    }

    private static async Task<QuoteRecord> RepriceAtHigherCost(HttpClient client, OrderRecord order, Guid spoolId)
    {
        (await client.PutAsJsonAsync($"/api/filaments/{spoolId}/simple", new { material = "PLA", displayName = "Blanco",
            landedCostGs = 500_000m, netWeightGrams = 1_000 })).EnsureSuccessStatusCode();
        var recalculate = await client.PostAsync($"/api/quotes/{order.QuoteId}/revisions/from-current-costs", null);
        recalculate.EnsureSuccessStatusCode();
        return (await recalculate.Content.ReadFromJsonAsync<QuoteRecord>(Json))!;
    }

    private static async Task<(OrderRecord Order, QuickOrderRequest QuickRequest)> SaveQuickBudget(HttpClient client)
    {
        var filament = await client.PostAsJsonAsync("/api/filaments/simple", new { material = "PLA", displayName = "Blanco",
            landedCostGs = 132000m, netWeightGrams = 1000 });
        filament.EnsureSuccessStatusCode();
        var spool = (await filament.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetGuid();
        var request = new QuickOrderRequest(Guid.NewGuid(), 1, new QuickQuotePreviewRequest(spool, 220, 131.04m), "Taller", "Soporte");
        var response = await client.PostAsJsonAsync("/api/orders/quick", request, Json);
        response.EnsureSuccessStatusCode();
        return ((await response.Content.ReadFromJsonAsync<QuickOrderResult>(Json))!.Order!, request);
    }
}
