using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Configuration;
using PrintCost.Application.Auth;
using PrintCost.Application.Quotes;
using PrintCost.Domain.Pricing;
using PrintCost.Infrastructure.Persistence;

namespace PrintCost.Api.Tests;

public sealed class PrintCostApiTests
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web) { Converters = { new JsonStringEnumConverter() } };

    [Fact]
    public async Task Health_and_pin_cookie_authentication_work()
    {
        await using var factory = new TestFactory(pinMode: true);
        using var client = factory.CreateClient();
        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("/health")).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.GetAsync("/api/printers")).StatusCode);

        var login = await client.PostAsJsonAsync("/api/auth/login", new LoginRequest("rafa", "1234"));
        Assert.Equal(HttpStatusCode.OK, login.StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("/api/printers")).StatusCode);
    }

    [Fact]
    public async Task Catalog_preview_quote_job_and_inventory_flow_works_through_http()
    {
        await using var factory = new TestFactory(pinMode: true);
        using var client = factory.CreateClient();
        (await client.PostAsJsonAsync("/api/auth/login", new LoginRequest("rafa", "1234"))).EnsureSuccessStatusCode();

        var spoolResponse = await client.PostAsJsonAsync("/api/filaments", new
        {
            manufacturer = "Test", productName = "PLA 1kg", material = "PLA", color = "Blanco", batchCode = "HTTP-1",
            purchaseCurrency = "PYG", purchaseAmount = 131250m, exchangeRateGs = (decimal?)null,
            allocatedShippingGs = 0m, allocatedImportFeesGs = 0m, allocatedOtherCostsGs = 0m,
            netWeightGrams = 1000m, remainingWeightGrams = 1000m, purchasedAt = "2026-08-06",
            supplier = "Test", isInventoryTracked = true, isActive = true
        });
        spoolResponse.EnsureSuccessStatusCode();
        var spoolId = (await spoolResponse.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetGuid();
        var previewRequest = new QuotePreviewRequest(
            SeedData.PrinterId, SeedData.EnergyProfileId, SeedData.TariffId, SeedData.PricingPolicyId,
            new QuantityPlan(), 5.4m, 0m, 5.4m, null, 0m, 0m,
            [new MaterialSelection(spoolId, SlicerTotalGrams: 142m)], [], [],
            AcceptZeroMachineRate: true, ZeroMachineRateReason: "Aceptado para prueba");
        var previewResponse = await client.PostAsJsonAsync("/api/calculations/quote-preview", previewRequest);
        previewResponse.EnsureSuccessStatusCode();
        var preview = await previewResponse.Content.ReadFromJsonAsync<QuotePreviewResult>(JsonOptions);
        Assert.Equal(18_637.50m, preview!.Breakdown.MaterialCostGs);

        var create = await client.PostAsJsonAsync("/api/quotes", new CreateQuoteRequest(previewRequest, null, null, "Prueba", null));
        create.EnsureSuccessStatusCode();
        var quote = await create.Content.ReadFromJsonAsync<QuoteRecord>(JsonOptions);
        Assert.NotNull(quote);
        (await client.PostAsync($"/api/quotes/{quote.Id}/ready", null)).EnsureSuccessStatusCode();
        (await client.PostAsync($"/api/quotes/{quote.Id}/send", null)).EnsureSuccessStatusCode();
        (await client.PostAsync($"/api/quotes/{quote.Id}/accept", null)).EnsureSuccessStatusCode();
        var convert = await client.PostAsync($"/api/quotes/{quote.Id}/convert-to-job", null);
        convert.EnsureSuccessStatusCode();
        var job = await convert.Content.ReadFromJsonAsync<PrintJobRecord>(JsonOptions);
        Assert.NotNull(job);
        var complete = await client.PostAsJsonAsync($"/api/jobs/{job.Id}/complete", new CompleteJobRequest(
            5.5m, 0.6m, 1, 0, [new ActualMaterialUsage(spoolId, 140m)], [], [], 0m, 90_000m, "OK"));
        complete.EnsureSuccessStatusCode();

        var movements = await client.GetFromJsonAsync<JsonElement[]>($"/api/filaments/{spoolId}/movements");
        var movementRows = Assert.IsType<JsonElement[]>(movements);
        Assert.Single(movementRows);
        Assert.Equal(-140m, movementRows[0].GetProperty("grams").GetDecimal());
    }

    private sealed class TestFactory : WebApplicationFactory<Program>
    {
        private readonly string databasePath = Path.Combine(Path.GetTempPath(), $"printcost-api-{Guid.NewGuid():N}.db");
        private readonly string keysPath = Path.Combine(Path.GetTempPath(), $"printcost-keys-{Guid.NewGuid():N}");
        private readonly bool pinMode;

        public TestFactory(bool pinMode) => this.pinMode = pinMode;

        protected override void ConfigureWebHost(IWebHostBuilder builder)
        {
            builder.UseEnvironment("Test");
            builder.UseSetting("ConnectionStrings:PrintCost", $"Data Source={databasePath}");
            builder.UseSetting("Auth:Mode", pinMode ? "PinLogin" : "DevSelector");
            builder.UseSetting("Auth:CookieSecure", "false");
            builder.UseSetting("Auth:DataProtectionKeysPath", keysPath);
            builder.UseSetting("Auth:BootstrapRafaPin", "1234");
            builder.UseSetting("Auth:BootstrapClariPin", "5678");
        }
    }
}
