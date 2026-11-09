using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using PrintCost.Application.Orders;
using PrintCost.Application.Quotes;
using PrintCost.Domain.Pricing;

namespace PrintCost.Api.Tests;

public sealed class QuickPrintPlatesApiTests
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web)
    {
        Converters = { new JsonStringEnumConverter() }
    };

    [Fact]
    public async Task The_quick_quote_uses_one_total_and_saves_all_plates_in_the_same_order()
    {
        await using var app = new OrderApiTests.OrderFactory();
        using var client = await app.LoginAsync();
        (await client.PutAsJsonAsync("/api/pricing/simple-settings", new { machineHourlyRateGs = 2000, preparationMinutes = 30,
            laborHourlyRateGs = 10000, packagingCostGs = 1500, failureProbabilityPercent = 10, overheadPercent = 5,
            targetMarginPercent = 40, minimumMarginPercent = 30, minimumOrderGs = 100000, roundingIncrementGs = 5000 })).EnsureSuccessStatusCode();
        var firstSpool = await AddSpool(client, "Blanco", 130000m);
        var secondSpool = await AddSpool(client, "Negro", 160000m);
        var plates = new[] { new { spoolId = secondSpool, printDurationMinutes = 12, totalGrams = 4m } };
        var calculation = new { spoolId = firstSpool, printDurationMinutes = 5, totalGrams = 2m, additionalPlates = plates };
        var single = await Post(client, "/api/calculations/quick-quote-preview", new { spoolId = firstSpool, printDurationMinutes = 5, totalGrams = 2m });
        var preview = await Post(client, "/api/calculations/quick-quote-preview", calculation);
        Assert.True(preview.GetProperty("canUsePrice").GetBoolean());
        var aggregate = preview.GetProperty("aggregateBreakdown");
        var advancedLines = preview.GetProperty("advancedLines");
        Assert.Equal(new[] { "Plato 1", "Plato 2" }, advancedLines.EnumerateArray().Select(line => line.GetProperty("description").GetString()));
        Assert.All(advancedLines.EnumerateArray(), line => Assert.True(line.GetProperty("isPrintPlate").GetBoolean()));
        Assert.Equal(100000m, aggregate.GetProperty("customerTotalGs").GetDecimal());
        Assert.Equal(single.GetProperty("breakdown").GetProperty("laborCostGs").GetDecimal(), aggregate.GetProperty("laborCostGs").GetDecimal());
        Assert.Equal(single.GetProperty("breakdown").GetProperty("additionalCostGs").GetDecimal(), aggregate.GetProperty("additionalCostGs").GetDecimal());
        var advanced = await Post(client, "/api/calculations/quote-aggregate-preview", new { lines = advancedLines });
        Assert.Equal(aggregate.GetProperty("customerTotalGs").GetDecimal(),
            advanced.GetProperty("aggregate").GetProperty("breakdown").GetProperty("customerTotalGs").GetDecimal());

        var sessionId = Guid.NewGuid();
        object Draft(int sequence, string customerReference, object inputs) =>
            new { sessionId, sequence, customerReference, description = "Trabajo de dos platos", calculation = inputs };
        var saved = await Post(client, "/api/orders/quick", Draft(1, "Taller", calculation));
        var order = saved.GetProperty("order");
        var orderId = order.GetProperty("id").GetGuid();
        var quoteId = order.GetProperty("quoteId").GetGuid();
        Assert.Equal(1, order.GetProperty("quantity").GetInt32());
        Assert.Equal(100000m, order.GetProperty("totalGs").GetDecimal());
        var quote = (await client.GetFromJsonAsync<QuoteRecord>($"/api/quotes/{quoteId}", Json))!;
        var revision = Assert.Single(quote.Revisions);
        Assert.Equal(100000m, revision.TotalCustomerPriceGs);
        Assert.Equal(new[] { firstSpool, secondSpool }, revision.EffectiveLines.Select(line => Assert.Single(line.Request.Materials).SpoolId));
        Assert.Empty(revision.EffectiveLines[1].Request.Labor);
        Assert.Empty(revision.EffectiveLines[1].Request.AdditionalCosts);

        (await client.PutAsJsonAsync($"/api/filaments/{secondSpool}/simple", new
        { material = "PLA", displayName = "Negro", landedCostGs = 99990000m, netWeightGrams = 1000 })).EnsureSuccessStatusCode();
        var retried = await Post(client, "/api/orders/quick", Draft(1, "Taller", calculation));
        Assert.Equal(orderId, retried.GetProperty("order").GetProperty("id").GetGuid());
        Assert.Equal(100000m, retried.GetProperty("preview").GetProperty("aggregateBreakdown").GetProperty("customerTotalGs").GetDecimal());
        var metadata = await Post(client, "/api/orders/quick", Draft(2, "Taller móvil", calculation));
        Assert.Equal(quoteId, metadata.GetProperty("order").GetProperty("quoteId").GetGuid());
        Assert.Equal(100000m, metadata.GetProperty("order").GetProperty("totalGs").GetDecimal());
        quote = (await client.GetFromJsonAsync<QuoteRecord>($"/api/quotes/{quoteId}", Json))!;
        Assert.Equal(2, quote.Revisions.Count);
        Assert.All(quote.Revisions, snapshot => Assert.Equal(2, snapshot.EffectiveLines.Count));

        var invalid = new { spoolId = firstSpool, printDurationMinutes = 5, totalGrams = 2m,
            additionalPlates = new[] { new { spoolId = secondSpool, printDurationMinutes = 0, totalGrams = 4m } } };
        var rejected = await client.PostAsJsonAsync("/api/orders/quick", Draft(3, "Taller móvil", invalid));
        Assert.Equal(HttpStatusCode.BadRequest, rejected.StatusCode);
        Assert.Contains("Plato 2", (await rejected.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("message").GetString());
        var singleAgain = await Post(client, "/api/orders/quick", Draft(3, "Taller móvil",
            new { spoolId = firstSpool, printDurationMinutes = 5, totalGrams = 2m }));
        Assert.Equal(orderId, singleAgain.GetProperty("order").GetProperty("id").GetGuid());
        Assert.Equal(100000m, singleAgain.GetProperty("preview").GetProperty("breakdown").GetProperty("customerTotalGs").GetDecimal());
        Assert.Equal(1, (await client.GetFromJsonAsync<OrderPage>("/api/orders?view=drafts", Json))!.Total);
        quote = (await client.GetFromJsonAsync<QuoteRecord>($"/api/quotes/{quoteId}", Json))!;
        Assert.Single(quote.Revisions.MaxBy(item => item.RevisionNumber)!.EffectiveLines);
    }

    [Fact]
    public async Task A_group_of_plates_keeps_its_commercial_quantity_when_edited_and_duplicated()
    {
        await using var app = new OrderApiTests.OrderFactory();
        using var client = await app.LoginAsync();
        var spoolId = await AddSpool(client, "Blanco", 130000m);
        var quick = await Post(client, "/api/calculations/quick-quote-preview", new { spoolId, printDurationMinutes = 90, totalGrams = 40m });
        var calculation = quick.GetProperty("advancedRequest");
        var lines = new[] { new { description = "Plato 1", calculation, isPrintPlate = true },
            new { description = "Plato 2", calculation, isPrintPlate = true } };
        // Additional lines share setup and packaging supplied by the first line only.
        var lineTwo = JsonSerializer.Deserialize<Dictionary<string, JsonElement>>(calculation)!;
        lineTwo["labor"] = JsonSerializer.SerializeToElement(Array.Empty<object>());
        lineTwo["additionalCosts"] = JsonSerializer.SerializeToElement(Array.Empty<object>());
        lines[1] = lines[1] with { calculation = JsonSerializer.SerializeToElement(lineTwo) };

        var saved = await Post(client, "/api/quotes", new { calculation, lines, customerReference = "Taller" });
        var quoteId = saved.GetProperty("id").GetGuid();
        var order = (await client.GetFromJsonAsync<OrderRecord>($"/api/orders/by-quote/{quoteId}", Json))!;
        Assert.Equal(1, order.Quantity);
        var recalculated = await Post<object?>(client, $"/api/quotes/{quoteId}/revisions/from-current-costs", null);
        var revision = recalculated.GetProperty("revisions").EnumerateArray().Last();
        Assert.All(revision.GetProperty("effectiveLines").EnumerateArray(),
            line => Assert.True(line.GetProperty("isPrintPlate").GetBoolean()));

        var adjustment = await client.PutAsJsonAsync($"/api/orders/{order.Id}/quote-revision",
            new { order.Version, revisionNumber = revision.GetProperty("revisionNumber").GetInt32(), lines }, Json);
        adjustment.EnsureSuccessStatusCode();
        var adjusted = (await adjustment.Content.ReadFromJsonAsync<OrderRecord>(Json))!;
        Assert.Equal(1, adjusted.Quantity);
        Assert.Equal(order.Id, adjusted.Id);
        var duplicate = await Post<object?>(client, $"/api/quotes/{quoteId}/duplicate", null);
        var duplicateOrder = (await client.GetFromJsonAsync<OrderRecord>($"/api/orders/by-quote/{duplicate.GetProperty("id").GetGuid()}", Json))!;
        Assert.NotEqual(order.Id, duplicateOrder.Id);
        Assert.Equal(1, duplicateOrder.Quantity);
    }

    [Fact]
    public async Task Repeated_plates_match_the_cost_of_entering_each_physical_print()
    {
        await using var app = new OrderApiTests.OrderFactory();
        using var client = await app.LoginAsync();
        var spoolId = await AddSpool(client, "Blanco", 130000m);
        var full = new { spoolId, printDurationMinutes = 90, totalGrams = 120m };
        var partial = new { spoolId, printDurationMinutes = 45, totalGrams = 60m };
        var repeated = new { full.spoolId, full.printDurationMinutes, full.totalGrams, repetitions = 3, additionalPlates = new[] { partial } };
        var expanded = new { full.spoolId, full.printDurationMinutes, full.totalGrams, additionalPlates = new[] { full, full, partial } };
        var repeatedPreview = await Post(client, "/api/calculations/quick-quote-preview", repeated);
        var expandedPreview = await Post(client, "/api/calculations/quick-quote-preview", expanded);
        var repeatedTotal = repeatedPreview.GetProperty("aggregateBreakdown").Deserialize<QuoteAggregateBreakdown>(Json)!;
        var expandedTotal = expandedPreview.GetProperty("aggregateBreakdown").Deserialize<QuoteAggregateBreakdown>(Json)!;
        Assert.Equal(expandedTotal.CustomerTotalGs, repeatedTotal.CustomerTotalGs);
        Assert.Equal(expandedTotal.MaterialCostGs, repeatedTotal.MaterialCostGs);
        Assert.Equal(expandedTotal.EnergyCostGs, repeatedTotal.EnergyCostGs);
        Assert.Equal(expandedTotal.MachineCostGs, repeatedTotal.MachineCostGs);
        Assert.Equal(expandedTotal.LaborCostGs, repeatedTotal.LaborCostGs);
        Assert.Equal(expandedTotal.AdditionalCostGs, repeatedTotal.AdditionalCostGs);
        Assert.Equal(5.25m, repeatedTotal.TotalOccupiedPrinterHours);

        var saved = await Post(client, "/api/orders/quick", new { sessionId = Guid.NewGuid(), sequence = 1,
            customerReference = "Taller", calculation = repeated });
        var order = saved.GetProperty("order").Deserialize<OrderRecord>(Json)!;
        var quote = (await client.GetFromJsonAsync<QuoteRecord>($"/api/quotes/{order.QuoteId}", Json))!;
        var revision = Assert.Single(quote.Revisions);
        Assert.Equal(1, order.Quantity);
        Assert.Equal(repeatedTotal.CustomerTotalGs, order.TotalGs);
        Assert.Equal(new[] { 3, 1 }, revision.EffectiveLines.Select(line => line.Breakdown.NumberOfPlates));
        Assert.All(revision.EffectiveLines, line => Assert.True(line.IsPrintPlate));
        var first = revision.EffectiveLines[0];
        Assert.Equal(new QuantityPlan(3, 1, QuantityInputBasis.PerPlate), first.Request.Quantity);
        Assert.Equal(360m, Assert.Single(first.Breakdown.Materials).TotalChargeableGrams);
        Assert.Equal(4.5m, first.Breakdown.Machine.TotalOccupiedHours);
        Assert.Empty(revision.EffectiveLines[1].Request.Labor);
        Assert.Empty(revision.EffectiveLines[1].Request.AdditionalCosts);

        var last = revision.EffectiveLines[1];
        var adjustedLines = new[] { first.ToRequest(), last.ToRequest() with
            { Calculation = last.Request with { Quantity = new QuantityPlan(2, 1, QuantityInputBasis.PerPlate) } } };
        using var response = await client.PutAsJsonAsync($"/api/orders/{order.Id}/quote-revision",
            new { order.Version, revision.RevisionNumber, lines = adjustedLines }, Json);
        response.EnsureSuccessStatusCode();
        var adjusted = (await response.Content.ReadFromJsonAsync<OrderRecord>(Json))!;
        Assert.Equal(order.QuoteId, adjusted.QuoteId);
        Assert.Equal(1, adjusted.Quantity);
        quote = (await client.GetFromJsonAsync<QuoteRecord>($"/api/quotes/{order.QuoteId}", Json))!;
        Assert.Equal(new[] { 3, 2 }, quote.Revisions[^1].EffectiveLines.Select(line => line.Breakdown.NumberOfPlates));
        var confirmed = await Post(client, $"/api/orders/{order.Id}/status", new { status = "Confirmed", adjusted.Version });
        Assert.Equal("Confirmed", confirmed.GetProperty("status").GetString());
        Assert.Equal(1, confirmed.GetProperty("quantity").GetInt32());
    }

    [Fact]
    public async Task A_single_repeated_plate_retains_the_same_draft_when_restored_to_one_print()
    {
        await using var app = new OrderApiTests.OrderFactory();
        using var client = await app.LoginAsync();
        var spoolId = await AddSpool(client, "Blanco", 130000m);
        var sessionId = Guid.NewGuid();
        var repeated = await Post(client, "/api/orders/quick", new { sessionId, sequence = 1,
            calculation = new { spoolId, printDurationMinutes = 90, totalGrams = 120m, repetitions = 3 } });
        var order = repeated.GetProperty("order").Deserialize<OrderRecord>(Json)!;
        Assert.Equal(1, order.Quantity);
        var preview = repeated.GetProperty("preview");
        Assert.Equal(JsonValueKind.Object, preview.GetProperty("aggregateBreakdown").ValueKind);
        Assert.True(Assert.Single(preview.GetProperty("advancedLines").EnumerateArray()).GetProperty("isPrintPlate").GetBoolean());
        var quote = (await client.GetFromJsonAsync<QuoteRecord>($"/api/quotes/{order.QuoteId}", Json))!;
        Assert.Equal(3, Assert.Single(Assert.Single(quote.Revisions).EffectiveLines).Breakdown.NumberOfPlates);

        var single = await Post(client, "/api/orders/quick", new { sessionId, sequence = 2,
            calculation = new { spoolId, printDurationMinutes = 90, totalGrams = 120m, repetitions = 1 } });
        Assert.Equal(order.Id, single.GetProperty("order").GetProperty("id").GetGuid());
        Assert.False(single.GetProperty("preview").TryGetProperty("aggregateBreakdown", out _));
    }

    [Theory]
    [InlineData(0, 1)]
    [InlineData(-1, 1)]
    [InlineData(0, 2)]
    [InlineData(-1, 2)]
    public async Task Non_positive_repetitions_are_rejected_in_the_corresponding_plate(int repetitions, int plate)
    {
        await using var app = new OrderApiTests.OrderFactory();
        using var client = await app.LoginAsync();
        var spoolId = await AddSpool(client, "Blanco", 130000m);
        var calculation = new { spoolId, printDurationMinutes = 90, totalGrams = 120m, repetitions = plate == 1 ? repetitions : 1,
            additionalPlates = plate == 2 ? new[] { new { spoolId, printDurationMinutes = 45, totalGrams = 60m, repetitions } } : null };
        using var response = await client.PostAsJsonAsync("/api/calculations/quick-quote-preview", calculation, Json);
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Contains($"Plato {plate}", Assert.Single(body.GetProperty("errors").GetProperty("calculation").EnumerateArray()).GetString());
    }

    [Fact]
    public async Task Explicit_empty_plates_and_one_repetition_are_the_same_as_the_legacy_request()
    {
        await using var app = new OrderApiTests.OrderFactory();
        using var client = await app.LoginAsync();
        var spoolId = await AddSpool(client, "Blanco", 130000m);
        var sessionId = Guid.NewGuid();
        var legacy = await Post(client, "/api/orders/quick", new { sessionId, sequence = 1,
            calculation = new { spoolId, printDurationMinutes = 220, totalGrams = 131.04m } });
        var retry = await Post(client, "/api/orders/quick", new { sessionId, sequence = 1,
            calculation = new { spoolId, printDurationMinutes = 220, totalGrams = 131.04m, repetitions = 1, additionalPlates = Array.Empty<object>() } });
        Assert.Equal(legacy.GetProperty("order").GetProperty("id").GetGuid(), retry.GetProperty("order").GetProperty("id").GetGuid());
        Assert.Equal(legacy.GetProperty("order").GetProperty("version").GetInt64(), retry.GetProperty("order").GetProperty("version").GetInt64());
        Assert.Equal(JsonValueKind.Object, retry.GetProperty("preview").GetProperty("breakdown").ValueKind);
        Assert.False(retry.GetProperty("preview").TryGetProperty("aggregateBreakdown", out _));

        var groupedSessionId = Guid.NewGuid();
        var grouped = await Post(client, "/api/orders/quick", new { sessionId = groupedSessionId, sequence = 1,
            calculation = new { spoolId, printDurationMinutes = 90, totalGrams = 120m,
                additionalPlates = new[] { new { spoolId, printDurationMinutes = 45, totalGrams = 60m } } } });
        var groupedRetry = await Post(client, "/api/orders/quick", new { sessionId = groupedSessionId, sequence = 1,
            calculation = new { spoolId, printDurationMinutes = 90, totalGrams = 120m, repetitions = 1,
                additionalPlates = new[] { new { spoolId, printDurationMinutes = 45, totalGrams = 60m, repetitions = 1 } } } });
        Assert.Equal(grouped.GetProperty("order").GetProperty("id").GetGuid(), groupedRetry.GetProperty("order").GetProperty("id").GetGuid());
        Assert.Equal(grouped.GetProperty("order").GetProperty("version").GetInt64(), groupedRetry.GetProperty("order").GetProperty("version").GetInt64());
    }

    private static async Task<Guid> AddSpool(HttpClient client, string name, decimal cost) =>
        (await Post(client, "/api/filaments/simple", new { material = "PLA", displayName = name, landedCostGs = cost, netWeightGrams = 1000 }))
            .GetProperty("id").GetGuid();

    private static async Task<JsonElement> Post<T>(HttpClient client, string url, T payload)
    {
        var response = payload is null ? await client.PostAsync(url, null) : await client.PostAsJsonAsync(url, payload, Json);
        response.EnsureSuccessStatusCode();
        return await response.Content.ReadFromJsonAsync<JsonElement>();
    }
}
