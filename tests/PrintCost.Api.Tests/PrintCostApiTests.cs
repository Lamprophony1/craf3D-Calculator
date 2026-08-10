using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.EntityFrameworkCore;
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
        var energyBefore = Assert.Single((await client.GetFromJsonAsync<JsonElement[]>($"/api/printers/{SeedData.PrinterId}/energy-profiles"))!);
        var tariffBefore = Assert.Single((await client.GetFromJsonAsync<JsonElement[]>("/api/electricity-tariffs"))!);

        var changed = initial with { MachineHourlyRateGs = 2_500m, PreparationMinutes = 25m };
        var update = await client.PutAsJsonAsync("/api/pricing/simple-settings", changed);
        update.EnsureSuccessStatusCode();
        Assert.False((await update.Content.ReadFromJsonAsync<SimplePricingSettings>())!.IsUsingRecommendedDefaults);
        var energyAfter = Assert.Single((await client.GetFromJsonAsync<JsonElement[]>($"/api/printers/{SeedData.PrinterId}/energy-profiles"))!);
        var tariffAfter = Assert.Single((await client.GetFromJsonAsync<JsonElement[]>("/api/electricity-tariffs"))!);
        Assert.Equal(energyBefore.GetProperty("averagePrintPowerW").GetDecimal(), energyAfter.GetProperty("averagePrintPowerW").GetDecimal());
        Assert.Equal(tariffBefore.GetProperty("baseRateGsPerKWh").GetDecimal(), tariffAfter.GetProperty("baseRateGsPerKWh").GetDecimal());

        var invalid = await client.PutAsJsonAsync("/api/pricing/simple-settings", changed with { TargetMarginPercent = 100m });
        Assert.Equal(HttpStatusCode.BadRequest, invalid.StatusCode);

        var restore = await client.PostAsync("/api/pricing/simple-settings/restore-recommended", null);
        restore.EnsureSuccessStatusCode();
        Assert.True((await restore.Content.ReadFromJsonAsync<SimplePricingSettings>())!.IsUsingRecommendedDefaults);
    }

    [Fact]
    public async Task Simple_settings_detect_advanced_overrides_validate_combined_margin_and_restore_the_full_recommended_baseline()
    {
        await using var factory = new TestFactory(pinMode: true);
        using var client = factory.CreateClient();
        (await client.PostAsJsonAsync("/api/auth/login", new LoginRequest("rafa", "1234"))).EnsureSuccessStatusCode();

        var advancedPolicy = new
        {
            name = "Política avanzada", targetMarginPercent = 40m, minimumMarginPercent = 30m,
            minimumOrderGs = 30_000m, roundingIncrementGs = 5_000m, roundUp = true,
            failureMode = "ExpectedAttempts", failureProbability = 0.10m, simpleFailureReservePercent = 0m,
            fixedOverheadPerOrderGs = 750m, overheadPercent = 7m, monthlyOverheadGs = 25_000m,
            expectedMonthlyProductiveHours = 20m, defaultLaborRateGsPerHour = 20_000m,
            variableSellingFeePercent = 10m, fixedSellingFeeGs = 500m, isDefault = true,
            effectiveFrom = "2026-08-06", effectiveTo = (string?)null, isActive = true
        };
        (await client.PutAsJsonAsync($"/api/pricing-policies/{SeedData.PricingPolicyId}", advancedPolicy)).EnsureSuccessStatusCode();
        (await client.PutAsJsonAsync("/api/settings", new
        {
            visibleAppName = "Craf3D", productionHostname = (string?)null,
            taxEnabled = true, taxName = "IVA", taxRatePercent = 10m, priceIncludesTax = true,
            defaultPrinterId = SeedData.PrinterId, defaultEnergyProfileId = SeedData.EnergyProfileId,
            defaultElectricityTariffId = SeedData.TariffId,
            defaultPricingPolicyId = SeedData.PricingPolicyId, defaultQuickSetupMinutes = 20m,
            defaultQuickPackagingCostGs = 2_000m
        })).EnsureSuccessStatusCode();

        var advanced = await client.GetFromJsonAsync<SimplePricingSettings>("/api/pricing/simple-settings");
        Assert.NotNull(advanced);
        Assert.False(advanced.IsUsingRecommendedDefaults);
        Assert.True(advanced.HasAdvancedOverrides);
        Assert.Contains(advanced.AdvancedOverrideMessages, x => x.Contains("impuesto", StringComparison.OrdinalIgnoreCase));
        Assert.Contains(advanced.AdvancedOverrideMessages, x => x.Contains("comisión", StringComparison.OrdinalIgnoreCase));
        Assert.Contains(advanced.AdvancedOverrideMessages, x => x.Contains("overhead mensual", StringComparison.OrdinalIgnoreCase));

        var invalidCombinedMargin = await client.PutAsJsonAsync("/api/pricing/simple-settings", new
        {
            machineHourlyRateGs = 2_000m, preparationMinutes = 20m, laborHourlyRateGs = 20_000m,
            packagingCostGs = 2_000m, failureProbabilityPercent = 10m, overheadPercent = 5m,
            targetMarginPercent = 95m, minimumMarginPercent = 30m, minimumOrderGs = 30_000m,
            roundingIncrementGs = 5_000m
        });
        Assert.Equal(HttpStatusCode.BadRequest, invalidCombinedMargin.StatusCode);

        var restore = await client.PostAsync("/api/pricing/simple-settings/restore-recommended", null);
        restore.EnsureSuccessStatusCode();
        var restored = await restore.Content.ReadFromJsonAsync<SimplePricingSettings>();
        Assert.NotNull(restored);
        Assert.True(restored.IsUsingRecommendedDefaults);
        Assert.Equal(95m, restored.AveragePrintPowerW);
        Assert.False(restored.HasAdvancedOverrides);
        Assert.Empty(restored.AdvancedOverrideMessages);
        Assert.Equal(5m, restored.OverheadPercent);

        var settings = await client.GetFromJsonAsync<JsonElement>("/api/settings");
        Assert.False(settings.GetProperty("settings").GetProperty("taxEnabled").GetBoolean());
        Assert.Equal(SeedData.EnergyProfileId, settings.GetProperty("settings").GetProperty("defaultEnergyProfileId").GetGuid());
        var policies = await client.GetFromJsonAsync<JsonElement[]>("/api/pricing-policies");
        var policy = Assert.Single(policies!);
        Assert.True(policy.GetProperty("isActive").GetBoolean());
        Assert.True(policy.GetProperty("isDefault").GetBoolean());
        Assert.Equal(JsonValueKind.Null, policy.GetProperty("effectiveTo").ValueKind);
        Assert.Equal(0m, policy.GetProperty("variableSellingFeePercent").GetDecimal());
        Assert.Equal(0m, policy.GetProperty("fixedSellingFeeGs").GetDecimal());
        Assert.Equal(5m, policy.GetProperty("overheadPercent").GetDecimal());
        var printer = await client.GetFromJsonAsync<JsonElement>($"/api/printers/{SeedData.PrinterId}");
        Assert.True(printer.GetProperty("isActive").GetBoolean());
        var energy = Assert.Single((await client.GetFromJsonAsync<JsonElement[]>($"/api/printers/{SeedData.PrinterId}/energy-profiles"))!);
        Assert.True(energy.GetProperty("isActive").GetBoolean());
        Assert.Equal(JsonValueKind.Null, energy.GetProperty("effectiveTo").ValueKind);
        var tariff = Assert.Single((await client.GetFromJsonAsync<JsonElement[]>("/api/electricity-tariffs"))!);
        Assert.True(tariff.GetProperty("isActive").GetBoolean());
        Assert.Equal(JsonValueKind.Null, tariff.GetProperty("effectiveTo").ValueKind);
    }

    [Fact]
    public async Task Simple_filament_facade_normalizes_PYG_and_preserves_inventory_on_edit()
    {
        await using var factory = new TestFactory(pinMode: true);
        using var client = factory.CreateClient();
        (await client.PostAsJsonAsync("/api/auth/login", new LoginRequest("rafa", "1234"))).EnsureSuccessStatusCode();

        var createdResponse = await client.PostAsJsonAsync("/api/filaments/simple", new
        {
            material = "PLA", displayName = "Negro mate", landedCostGs = 131_250m, netWeightGrams = 1_000m
        });
        createdResponse.EnsureSuccessStatusCode();
        var created = await createdResponse.Content.ReadFromJsonAsync<JsonElement>();
        var simpleId = created.GetProperty("id").GetGuid();
        Assert.Equal("PYG", created.GetProperty("purchaseCurrency").GetString());
        Assert.Equal(131_250m, created.GetProperty("purchaseAmount").GetDecimal());
        Assert.Equal(131_250m, created.GetProperty("landedCostGs").GetDecimal());
        Assert.Equal(JsonValueKind.Null, created.GetProperty("exchangeRateGs").ValueKind);
        Assert.False(created.GetProperty("isInventoryTracked").GetBoolean());

        var simpleEdit = await client.PutAsJsonAsync($"/api/filaments/{simpleId}/simple", new
        {
            material = "PLA", displayName = "Negro mate", landedCostGs = 150_000m, netWeightGrams = 900m
        });
        simpleEdit.EnsureSuccessStatusCode();
        var editedSimple = await simpleEdit.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(150_000m, editedSimple.GetProperty("purchaseAmount").GetDecimal());
        Assert.Equal(900m, editedSimple.GetProperty("remainingWeightGrams").GetDecimal());

        var trackedResponse = await client.PostAsJsonAsync("/api/filaments", new
        {
            manufacturer = "Test", productName = "PLA inventario", material = "PLA", color = "Rojo", batchCode = "INV",
            purchaseCurrency = "USD", purchaseAmount = 20m, exchangeRateGs = (decimal?)5_000m,
            allocatedShippingGs = 0m, allocatedImportFeesGs = 0m, allocatedOtherCostsGs = 0m,
            netWeightGrams = 1_000m, remainingWeightGrams = 800m, purchasedAt = (string?)null,
            supplier = "Test", isInventoryTracked = true, isActive = true
        });
        trackedResponse.EnsureSuccessStatusCode();
        var trackedId = (await trackedResponse.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetGuid();

        var trackedEdit = await client.PutAsJsonAsync($"/api/filaments/{trackedId}/simple", new
        {
            material = "PLA", displayName = "PLA inventario", landedCostGs = 120_000m, netWeightGrams = 1_000m
        });
        trackedEdit.EnsureSuccessStatusCode();
        var editedTracked = await trackedEdit.Content.ReadFromJsonAsync<JsonElement>();
        Assert.True(editedTracked.GetProperty("isInventoryTracked").GetBoolean());
        Assert.Equal(800m, editedTracked.GetProperty("remainingWeightGrams").GetDecimal());
        Assert.Equal("PYG", editedTracked.GetProperty("purchaseCurrency").GetString());
        Assert.Equal(120_000m, editedTracked.GetProperty("purchaseAmount").GetDecimal());
        Assert.Equal(120_000m, editedTracked.GetProperty("landedCostGs").GetDecimal());
        Assert.Equal(JsonValueKind.Null, editedTracked.GetProperty("exchangeRateGs").ValueKind);

        var belowRemaining = await client.PutAsJsonAsync($"/api/filaments/{trackedId}/simple", new
        {
            material = "PLA", displayName = "PLA inventario", landedCostGs = 120_000m, netWeightGrams = 799m
        });
        Assert.Equal(HttpStatusCode.BadRequest, belowRemaining.StatusCode);
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

        var customerResponse = await client.PostAsJsonAsync("/api/customers", new
        {
            name = "Ana Cliente", phone = "0981000000", email = "ana@example.com", notes = "", isActive = true
        });
        customerResponse.EnsureSuccessStatusCode();
        var customerId = (await customerResponse.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetGuid();
        var secondPreviewRequest = previewRequest with
        {
            PrintDurationHours = 1m,
            OccupiedPrinterHours = 1m,
            Materials = [new MaterialSelection(spoolId, SlicerTotalGrams: 20m)]
        };
        var create = await client.PostAsJsonAsync("/api/quotes", new CreateQuoteRequest(
            previewRequest, customerId, null, "Entregar el viernes", null,
            [new QuoteLineRequest("Soporte de pared", previewRequest), new QuoteLineRequest("Accesorio", secondPreviewRequest)]));
        create.EnsureSuccessStatusCode();
        var quote = await create.Content.ReadFromJsonAsync<QuoteRecord>(JsonOptions);
        Assert.NotNull(quote);
        Assert.Equal(QuoteStatus.Draft, quote.Status);
        Assert.Equal(2, quote.Revisions.Single().EffectiveLines.Count);
        Assert.Equal("Soporte de pared", quote.Revisions.Single().EffectiveLines[0].Description);
        Assert.Equal("Entregar el viernes", quote.Notes);
        var quoteSummaries = await client.GetFromJsonAsync<JsonElement[]>("/api/quotes");
        var quoteSummary = Assert.Single(quoteSummaries!);
        Assert.Equal("Soporte de pared", quoteSummary.GetProperty("description").GetString());
        Assert.Equal("Ana Cliente", quoteSummary.GetProperty("customerName").GetString());
        (await client.PostAsync($"/api/quotes/{quote.Id}/calculate", null)).EnsureSuccessStatusCode();
        (await client.PostAsync($"/api/quotes/{quote.Id}/ready", null)).EnsureSuccessStatusCode();
        (await client.PostAsync($"/api/quotes/{quote.Id}/send", null)).EnsureSuccessStatusCode();
        (await client.PostAsync($"/api/quotes/{quote.Id}/accept", null)).EnsureSuccessStatusCode();
        var convert = await client.PostAsync($"/api/quotes/{quote.Id}/convert-to-job", null);
        convert.EnsureSuccessStatusCode();
        var job = await convert.Content.ReadFromJsonAsync<PrintJobRecord>(JsonOptions);
        Assert.NotNull(job);
        var estimatedJobs = await client.GetFromJsonAsync<JsonElement[]>("/api/jobs");
        var estimatedJob = Assert.Single(estimatedJobs!);
        Assert.Equal("Soporte de pared", estimatedJob.GetProperty("description").GetString());
        Assert.Equal(quote.Revisions.Single().Aggregate!.Breakdown.CustomerTotalGs, estimatedJob.GetProperty("estimatedCustomerTotalGs").GetDecimal());
        (await client.PostAsync($"/api/jobs/{job.Id}/start", null)).EnsureSuccessStatusCode();
        var complete = await client.PostAsJsonAsync($"/api/jobs/{job.Id}/complete", new CompleteJobRequest(
            5.5m, 0.6m, 1, 0, [new ActualMaterialUsage(spoolId, 140m)], [], [], 0m, 90_000m, 0m, "OK"));
        complete.EnsureSuccessStatusCode();

        var completedJobs = await client.GetFromJsonAsync<JsonElement[]>("/api/jobs");
        Assert.Equal(90_000m, Assert.Single(completedJobs!).GetProperty("actualCustomerTotalGs").GetDecimal());
        var summary = await client.GetFromJsonAsync<JsonElement>("/api/reports/summary");
        Assert.True(summary.GetProperty("realizedProfitGs").GetDecimal() > 0m);
        var profitability = Assert.Single((await client.GetFromJsonAsync<JsonElement[]>("/api/reports/profitability"))!);
        Assert.Equal(quote.Revisions.Single().Aggregate!.Breakdown.FullyLoadedCostGs, profitability.GetProperty("estimatedCostGs").GetDecimal());
        Assert.Equal(quote.Revisions.Single().Aggregate!.Breakdown.EstimatedProfitGs, profitability.GetProperty("estimatedProfitGs").GetDecimal());
        Assert.Equal(quote.Revisions.Single().Aggregate!.Breakdown.AchievedMarginPercent, profitability.GetProperty("estimatedMarginPercent").GetDecimal());

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
            defaultPrinterId = SeedData.PrinterId, defaultEnergyProfileId = SeedData.EnergyProfileId,
            defaultElectricityTariffId = SeedData.TariffId,
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
        Assert.True(readiness.GetProperty("defaultEnergyProfileConfigured").GetBoolean());
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
    public async Task Settings_require_a_valid_default_energy_profile_and_readiness_uses_it()
    {
        await using var factory = new TestFactory(pinMode: true);
        using var client = factory.CreateClient();
        (await client.PostAsJsonAsync("/api/auth/login", new LoginRequest("rafa", "1234"))).EnsureSuccessStatusCode();
        (await client.PostAsJsonAsync("/api/filaments", FilamentPayload("READY"))).EnsureSuccessStatusCode();

        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<PrintCostDbContext>();
            var stored = await db.ApplicationSettings.SingleAsync();
            Assert.Equal(SeedData.EnergyProfileId, stored.DefaultEnergyProfileId);
            stored.DefaultEnergyProfileId = null;
            await db.SaveChangesAsync();
        }

        var missingReadiness = (await client.GetFromJsonAsync<JsonElement>("/api/settings")).GetProperty("readiness");
        Assert.False(missingReadiness.GetProperty("defaultEnergyProfileConfigured").GetBoolean());
        Assert.False(missingReadiness.GetProperty("quickQuoteReady").GetBoolean());

        var missing = await client.PutAsJsonAsync("/api/settings", SettingsPayload(null));
        Assert.Equal(HttpStatusCode.BadRequest, missing.StatusCode);
        Assert.Contains("Seleccioná el perfil energético predeterminado", await missing.Content.ReadAsStringAsync());

        var otherPrinterResponse = await client.PostAsJsonAsync("/api/printers", PrinterPayload(2_000m));
        otherPrinterResponse.EnsureSuccessStatusCode();
        var otherPrinterId = (await otherPrinterResponse.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetGuid();
        var otherProfileResponse = await client.PostAsJsonAsync($"/api/printers/{otherPrinterId}/energy-profiles", EnergyProfilePayload("Otro", 95m));
        otherProfileResponse.EnsureSuccessStatusCode();
        var otherProfileId = (await otherProfileResponse.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetGuid();

        var inactiveResponse = await client.PostAsJsonAsync($"/api/printers/{SeedData.PrinterId}/energy-profiles", EnergyProfilePayload("Inactivo", 95m, isActive: false));
        inactiveResponse.EnsureSuccessStatusCode();
        var inactiveId = (await inactiveResponse.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetGuid();
        var expiredResponse = await client.PostAsJsonAsync($"/api/printers/{SeedData.PrinterId}/energy-profiles", EnergyProfilePayload("Vencido", 95m, "2020-01-01", "2021-01-01"));
        expiredResponse.EnsureSuccessStatusCode();
        var expiredId = (await expiredResponse.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetGuid();
        var zeroResponse = await client.PostAsJsonAsync($"/api/printers/{SeedData.PrinterId}/energy-profiles", EnergyProfilePayload("Sin potencia", 0m));
        zeroResponse.EnsureSuccessStatusCode();
        var zeroId = (await zeroResponse.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetGuid();

        foreach (var invalidProfileId in new[] { otherProfileId, inactiveId, expiredId, zeroId })
        {
            var response = await client.PutAsJsonAsync("/api/settings", SettingsPayload(invalidProfileId));
            Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
            Assert.Contains("perfil energético predeterminado", await response.Content.ReadAsStringAsync());
        }

        (await client.PutAsJsonAsync("/api/settings", SettingsPayload(SeedData.EnergyProfileId))).EnsureSuccessStatusCode();
        var ready = (await client.GetFromJsonAsync<JsonElement>("/api/settings")).GetProperty("readiness");
        Assert.True(ready.GetProperty("defaultEnergyProfileConfigured").GetBoolean());
        Assert.True(ready.GetProperty("quickQuoteReady").GetBoolean());
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

    [Fact]
    public async Task Client_quote_branding_is_persisted_and_rejects_unsafe_or_invalid_values()
    {
        await using var factory = new TestFactory(pinMode: true);
        using var client = factory.CreateClient();
        (await client.PostAsJsonAsync("/api/auth/login", new LoginRequest("rafa", "1234"))).EnsureSuccessStatusCode();

        const string logo = "data:image/png;base64,iVBORw0KGgo=";
        var savedResponse = await client.PutAsJsonAsync("/api/settings", BrandSettingsPayload(logo, 10));
        savedResponse.EnsureSuccessStatusCode();
        var saved = await savedResponse.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(logo, saved.GetProperty("brandLogo").GetString());
        Assert.Equal("Taller Craf3D", saved.GetProperty("brandDisplayName").GetString());
        Assert.Equal("WhatsApp 0981 000 000", saved.GetProperty("brandContactLine").GetString());
        Assert.Equal("Válido según disponibilidad.", saved.GetProperty("clientQuoteNote").GetString());
        Assert.Equal(10, saved.GetProperty("clientQuoteValidityDays").GetInt32());

        var loaded = (await client.GetFromJsonAsync<JsonElement>("/api/settings")).GetProperty("settings");
        Assert.Equal(logo, loaded.GetProperty("brandLogo").GetString());
        Assert.Equal(10, loaded.GetProperty("clientQuoteValidityDays").GetInt32());

        (await client.PutAsJsonAsync("/api/settings", SettingsPayload(SeedData.EnergyProfileId))).EnsureSuccessStatusCode();
        var afterLegacyUpdate = (await client.GetFromJsonAsync<JsonElement>("/api/settings")).GetProperty("settings");
        Assert.Equal(logo, afterLegacyUpdate.GetProperty("brandLogo").GetString());
        Assert.Equal("Taller Craf3D", afterLegacyUpdate.GetProperty("brandDisplayName").GetString());
        Assert.Equal(10, afterLegacyUpdate.GetProperty("clientQuoteValidityDays").GetInt32());

        var unsafeLogo = await client.PutAsJsonAsync("/api/settings",
            BrandSettingsPayload("data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=", 7));
        Assert.Equal(HttpStatusCode.BadRequest, unsafeLogo.StatusCode);
        Assert.Contains("PNG, JPEG o WebP", await unsafeLogo.Content.ReadAsStringAsync());

        var invalidValidity = await client.PutAsJsonAsync("/api/settings", BrandSettingsPayload(null, 0));
        Assert.Equal(HttpStatusCode.BadRequest, invalidValidity.StatusCode);
        Assert.Contains("entre 1 y 90 días", await invalidValidity.Content.ReadAsStringAsync());
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

    private static object SettingsPayload(Guid? energyProfileId) => new
    {
        visibleAppName = "Craf3D", productionHostname = (string?)null,
        taxEnabled = false, taxName = (string?)null, taxRatePercent = 0m, priceIncludesTax = false,
        defaultPrinterId = SeedData.PrinterId, defaultEnergyProfileId = energyProfileId,
        defaultElectricityTariffId = SeedData.TariffId, defaultPricingPolicyId = SeedData.PricingPolicyId,
        defaultQuickSetupMinutes = 20m, defaultQuickPackagingCostGs = 2_000m
    };

    private static object BrandSettingsPayload(string? logo, int validityDays) => new
    {
        visibleAppName = "Craf3D", productionHostname = (string?)null,
        taxEnabled = false, taxName = (string?)null, taxRatePercent = 0m, priceIncludesTax = false,
        defaultPrinterId = SeedData.PrinterId, defaultEnergyProfileId = SeedData.EnergyProfileId,
        defaultElectricityTariffId = SeedData.TariffId, defaultPricingPolicyId = SeedData.PricingPolicyId,
        defaultQuickSetupMinutes = 20m, defaultQuickPackagingCostGs = 2_000m,
        brandLogo = logo, brandDisplayName = "Taller Craf3D", brandContactLine = "WhatsApp 0981 000 000",
        clientQuoteNote = "Válido según disponibilidad.", clientQuoteValidityDays = validityDays
    };

    private static object EnergyProfilePayload(string name, decimal watts, string? effectiveFrom = null, string? effectiveTo = null, bool isActive = true) => new
    {
        name, materialFamily = "PLA", averagePrintPowerW = watts, idlePowerW = 5m, maxPowerW = 1_300m,
        warmupKWh = 0m, accessoryKWh = 0m, sourceName = "Test", verifiedAt = (string?)null,
        effectiveFrom, effectiveTo, isActive
    };

    private static object FilamentPayload(string batchCode) => new
    {
        manufacturer = "Test", productName = "PLA", material = "PLA", color = "Negro", batchCode,
        purchaseCurrency = "PYG", purchaseAmount = 131_250m, exchangeRateGs = (decimal?)null,
        allocatedShippingGs = 0m, allocatedImportFeesGs = 0m, allocatedOtherCostsGs = 0m,
        netWeightGrams = 1_000m, remainingWeightGrams = 1_000m, purchasedAt = (string?)null,
        supplier = "Test", isInventoryTracked = true, isActive = true
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
