using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Configuration;
using PrintCost.Application.Auth;
using PrintCost.Application.Catalogs;
using PrintCost.Application.Quotes;
using PrintCost.Domain.Pricing;
using PrintCost.Infrastructure.Persistence;

namespace PrintCost.Api.Tests;

public sealed class PrintCostApiTests
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web) { Converters = { new JsonStringEnumConverter() } };

    [Fact]
    public async Task Simple_pricing_facade_reads_updates_validates_and_restores_existing_entities()
    {
        await using var factory = new TestFactory(pinMode: true);
        using var client = factory.CreateClient();
        (await client.PostAsJsonAsync("/api/auth/login", new LoginRequest("rafa", "1234"))).EnsureSuccessStatusCode();

        var initial = await client.GetFromJsonAsync<SimplePricingSettings>("/api/pricing/simple-settings");
        Assert.NotNull(initial);
        Assert.True(initial.IsUsingRecommendedDefaults);
        Assert.Equal(2_000m, initial.MachineHourlyRateGs);
        Assert.Equal(6_666.67m, initial.PreparationCostGs);

        var changed = initial with { MachineHourlyRateGs = 2_500m, PreparationMinutes = 25m };
        var update = await client.PutAsJsonAsync("/api/pricing/simple-settings", changed);
        update.EnsureSuccessStatusCode();
        Assert.False((await update.Content.ReadFromJsonAsync<SimplePricingSettings>())!.IsUsingRecommendedDefaults);

        var invalid = await client.PutAsJsonAsync("/api/pricing/simple-settings", changed with { TargetMarginPercent = 100m });
        Assert.Equal(HttpStatusCode.BadRequest, invalid.StatusCode);

        var restore = await client.PostAsync("/api/pricing/simple-settings/restore-recommended", null);
        restore.EnsureSuccessStatusCode();
        Assert.True((await restore.Content.ReadFromJsonAsync<SimplePricingSettings>())!.IsUsingRecommendedDefaults);
    }

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
        (await client.PutAsJsonAsync($"/api/printers/{SeedData.PrinterId}", PrinterPayload(2_000m))).EnsureSuccessStatusCode();

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
        Assert.Equal(QuoteStatus.Draft, quote.Status);
        (await client.PostAsync($"/api/quotes/{quote.Id}/calculate", null)).EnsureSuccessStatusCode();
        (await client.PostAsync($"/api/quotes/{quote.Id}/ready", null)).EnsureSuccessStatusCode();
        (await client.PostAsync($"/api/quotes/{quote.Id}/send", null)).EnsureSuccessStatusCode();
        (await client.PostAsync($"/api/quotes/{quote.Id}/accept", null)).EnsureSuccessStatusCode();
        var convert = await client.PostAsync($"/api/quotes/{quote.Id}/convert-to-job", null);
        convert.EnsureSuccessStatusCode();
        var job = await convert.Content.ReadFromJsonAsync<PrintJobRecord>(JsonOptions);
        Assert.NotNull(job);
        (await client.PostAsync($"/api/jobs/{job.Id}/start", null)).EnsureSuccessStatusCode();
        var complete = await client.PostAsJsonAsync($"/api/jobs/{job.Id}/complete", new CompleteJobRequest(
            5.5m, 0.6m, 1, 0, [new ActualMaterialUsage(spoolId, 140m)], [], [], 0m, 90_000m, 0m, "OK"));
        complete.EnsureSuccessStatusCode();

        var movements = await client.GetFromJsonAsync<JsonElement[]>($"/api/filaments/{spoolId}/movements");
        var movementRows = Assert.IsType<JsonElement[]>(movements);
        Assert.Single(movementRows);
        Assert.Equal(-140m, movementRows[0].GetProperty("grams").GetDecimal());
    }

    [Fact]
    public async Task Catalog_edit_quick_quote_profile_selection_and_negative_inventory_are_validated_through_http()
    {
        await using var factory = new TestFactory(pinMode: true);
        using var client = factory.CreateClient();
        (await client.PostAsJsonAsync("/api/auth/login", new LoginRequest("rafa", "1234"))).EnsureSuccessStatusCode();

        var printerUpdate = await client.PutAsJsonAsync($"/api/printers/{SeedData.PrinterId}", PrinterPayload(2_500m));
        printerUpdate.EnsureSuccessStatusCode();
        Assert.Equal(2_500m, (await printerUpdate.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("manualHourlyRateGs").GetDecimal());
        (await client.PutAsJsonAsync($"/api/pricing-policies/{SeedData.PricingPolicyId}", PolicyPayload())).EnsureSuccessStatusCode();
        (await client.PutAsJsonAsync("/api/settings", new
        {
            visibleAppName = "Costos 3D", productionHostname = (string?)null,
            taxEnabled = true, taxName = "IVA", taxRatePercent = 10m, priceIncludesTax = true,
            defaultPrinterId = SeedData.PrinterId, defaultElectricityTariffId = SeedData.TariffId,
            defaultPricingPolicyId = SeedData.PricingPolicyId, defaultQuickSetupMinutes = 15m,
            defaultQuickPackagingCostGs = 2_000m
        })).EnsureSuccessStatusCode();

        var spoolResponse = await client.PostAsJsonAsync("/api/filaments", new
        {
            manufacturer = "Test", productName = "PLA", material = "PLA", color = "Negro", batchCode = "QUICK",
            purchaseCurrency = "PYG", purchaseAmount = 131250m, exchangeRateGs = (decimal?)null,
            allocatedShippingGs = 0m, allocatedImportFeesGs = 0m, allocatedOtherCostsGs = 0m,
            netWeightGrams = 1000m, remainingWeightGrams = 1000m, purchasedAt = (string?)null,
            supplier = "Test", isInventoryTracked = true, isActive = true
        });
        spoolResponse.EnsureSuccessStatusCode();
        var spoolId = (await spoolResponse.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetGuid();

        var quickResponse = await client.PostAsJsonAsync("/api/calculations/quick-quote-preview", new QuickQuotePreviewRequest(spoolId, 324, 142m));
        quickResponse.EnsureSuccessStatusCode();
        var quick = await quickResponse.Content.ReadFromJsonAsync<QuickQuotePreviewResult>(JsonOptions);
        Assert.NotNull(quick);
        Assert.True(quick.CanUsePrice);
        Assert.Equal(5.4m, quick.ResolvedAssumptions!.OccupiedPrinterHours);
        Assert.Equal("PLA", quick.ResolvedAssumptions.MaterialFamily);
        Assert.Equal(18_637.50m, quick.Breakdown!.MaterialCostGs);
        Assert.True(quick.Breakdown.TaxGs > 0m);

        var settingsResponse = await client.GetFromJsonAsync<JsonElement>("/api/settings");
        var readiness = settingsResponse.GetProperty("readiness");
        Assert.True(readiness.GetProperty("defaultPrinterConfigured").GetBoolean());
        Assert.True(readiness.GetProperty("defaultTariffConfigured").GetBoolean());
        Assert.True(readiness.GetProperty("defaultPolicyConfigured").GetBoolean());
        Assert.True(readiness.GetProperty("activePricedFilamentAvailable").GetBoolean());
        Assert.True(readiness.GetProperty("quickQuoteReady").GetBoolean());

        var customerResponse = await client.PostAsJsonAsync("/api/customers", new
        {
            name = "Cliente inactivo", phone = "0981000000", email = "cliente@example.com",
            notes = "No exponer", isActive = false
        });
        customerResponse.EnsureSuccessStatusCode();
        var customerId = (await customerResponse.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetGuid();
        var customer = await client.GetFromJsonAsync<JsonElement>($"/api/customers/{customerId}");
        Assert.Equal("Cliente inactivo", customer.GetProperty("name").GetString());
        Assert.False(customer.GetProperty("isActive").GetBoolean());
        Assert.False(customer.TryGetProperty("notes", out _));
        Assert.Equal(HttpStatusCode.NotFound, (await client.GetAsync($"/api/customers/{Guid.NewGuid()}")).StatusCode);

        var negative = await client.PostAsJsonAsync($"/api/filaments/{spoolId}/adjustments", new { grams = -1001m, reason = "No debe permitirse" });
        Assert.Equal(HttpStatusCode.BadRequest, negative.StatusCode);
        var unchanged = await client.GetFromJsonAsync<JsonElement>($"/api/filaments/{spoolId}");
        Assert.Equal(1000m, unchanged.GetProperty("remainingWeightGrams").GetDecimal());

        var deactivate = await client.PutAsJsonAsync($"/api/printers/{SeedData.PrinterId}", PrinterPayload(2_500m, false));
        deactivate.EnsureSuccessStatusCode();
        Assert.False((await deactivate.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("isActive").GetBoolean());
    }

    [Fact]
    public async Task Policy_labor_rate_accepts_null_or_positive_and_rejects_zero()
    {
        await using var factory = new TestFactory(pinMode: true);
        using var client = factory.CreateClient();
        (await client.PostAsJsonAsync("/api/auth/login", new LoginRequest("rafa", "1234"))).EnsureSuccessStatusCode();

        Assert.Equal(HttpStatusCode.OK, (await client.PutAsJsonAsync($"/api/pricing-policies/{SeedData.PricingPolicyId}", PolicyPayload(null))).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await client.PutAsJsonAsync($"/api/pricing-policies/{SeedData.PricingPolicyId}", PolicyPayload(0m))).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await client.PutAsJsonAsync($"/api/pricing-policies/{SeedData.PricingPolicyId}", PolicyPayload(12_000m))).StatusCode);
    }

    private static object PrinterPayload(decimal? rate, bool isActive = true) => new
    {
        name = "Bambu Lab A1", manufacturer = "Bambu Lab", model = "A1", voltage = 220m,
        machineCostMode = "ManualHourlyRate", purchaseCostGs = (decimal?)null, residualValueGs = 0m,
        usefulLifeHours = (decimal?)null, expectedLifetimeRepairCostGs = 0m, maintenanceReserveGsPerHour = 0m,
        recoveryYears = (decimal?)null, businessDaysPerYear = (decimal?)null, plannedBillableHoursPerDay = (decimal?)null,
        repairReserveGsPerHour = 0m, manualHourlyRateGs = rate, isActive
    };

    private static object PolicyPayload(decimal? laborRate = 12_000m) => new
    {
        name = "Política inicial editable", targetMarginPercent = 40m, minimumMarginPercent = 30m,
        minimumOrderGs = 30_000m, roundingIncrementGs = 5_000m, roundUp = true,
        failureMode = "ExpectedAttempts", failureProbability = 0.10m, simpleFailureReservePercent = 0m,
        fixedOverheadPerOrderGs = 0m, overheadPercent = 0m, monthlyOverheadGs = 0m,
        expectedMonthlyProductiveHours = 0m, defaultLaborRateGsPerHour = laborRate,
        variableSellingFeePercent = 0m, fixedSellingFeeGs = 0m, isDefault = true,
        effectiveFrom = "2026-08-06", effectiveTo = (string?)null, isActive = true
    };

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
