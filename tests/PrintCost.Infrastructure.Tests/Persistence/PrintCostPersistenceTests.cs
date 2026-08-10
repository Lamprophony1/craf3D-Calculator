using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using PrintCost.Application.Catalogs;
using PrintCost.Application.Quotes;
using PrintCost.Domain.Pricing;
using PrintCost.Infrastructure.Persistence;
using PrintCost.Infrastructure.Persistence.Entities;

namespace PrintCost.Infrastructure.Tests.Persistence;

public sealed class PrintCostPersistenceTests
{
    [Fact]
    public async Task Recommended_seed_is_ready_for_the_142_gram_5_hour_24_minute_quick_quote()
    {
        await using var fixture = await DatabaseFixture.CreateAsync();
        var spool = NewSpool("Negro", 1_000m);
        spool.PurchaseAmount = 131_250m;
        spool.LandedCostGs = 131_250m;
        fixture.Db.FilamentSpools.Add(spool);
        await fixture.Db.SaveChangesAsync();

        var preview = await new QuoteCalculationService(new PrintCostRepository(fixture.Db))
            .QuickPreviewAsync(new QuickQuotePreviewRequest(spool.Id, 324, 142m));

        Assert.True(preview.CanUsePrice);
        Assert.Equal(75_000m, preview.Breakdown!.CustomerTotalGs);
        Assert.InRange(preview.Breakdown.FullyLoadedCostGs, 43_000m, 44_500m);
        Assert.Equal(5.4m, preview.ResolvedAssumptions!.OccupiedPrinterHours);
        Assert.Equal(SeedData.EnergyProfileId, preview.ResolvedAssumptions.EnergyProfileId);
        Assert.Equal(SeedData.EnergyProfileId, (await fixture.Db.ApplicationSettings.SingleAsync()).DefaultEnergyProfileId);
        Assert.DoesNotContain(preview.Warnings, x => x.BlocksPrice);
    }

    [Fact]
    public async Task Simple_settings_use_exactly_the_configured_energy_profile_without_silent_replacement()
    {
        await using var fixture = await DatabaseFixture.CreateAsync();
        var newer = new EnergyProfileEntity
        {
            Id = Guid.NewGuid(), PrinterId = SeedData.PrinterId, Name = "PLA nuevo", MaterialFamily = "PLA",
            AveragePrintPowerW = 140m, IdlePowerW = 5m, MaxPowerW = 1_300m, IsActive = true,
            EffectiveFrom = DateOnly.FromDateTime(DateTime.UtcNow)
        };
        fixture.Db.EnergyProfiles.Add(newer);
        await fixture.Db.SaveChangesAsync();
        var repository = new PrintCostRepository(fixture.Db);

        var recommended = await repository.GetSimplePricingSettingsAsync();
        Assert.NotNull(recommended);
        Assert.Equal(95m, recommended.AveragePrintPowerW);

        var settings = await fixture.Db.ApplicationSettings.SingleAsync();
        settings.DefaultEnergyProfileId = newer.Id;
        await fixture.Db.SaveChangesAsync();
        var configured = await repository.GetSimplePricingSettingsAsync();
        Assert.NotNull(configured);
        Assert.Equal(140m, configured.AveragePrintPowerW);
        Assert.True(configured.HasAdvancedOverrides);
        Assert.Contains("Se utiliza un perfil energético distinto al recomendado.", configured.AdvancedOverrideMessages);

        await repository.UpdateSimplePricingSettingsAsync(new UpdateSimplePricingSettingsRequest(
            2_500m, 25m, 20_000m, 2_000m, 10m, 5m, 40m, 30m, 30_000m, 5_000m));
        Assert.Equal(newer.Id, settings.DefaultEnergyProfileId);

        newer.IsActive = false;
        await fixture.Db.SaveChangesAsync();
        Assert.Null(await repository.GetSimplePricingSettingsAsync());
        await Assert.ThrowsAsync<InvalidOperationException>(() => repository.UpdateSimplePricingSettingsAsync(
            new UpdateSimplePricingSettingsRequest(2_500m, 25m, 20_000m, 2_000m, 10m, 5m, 40m, 30m, 30_000m, 5_000m)));
        Assert.Equal(newer.Id, settings.DefaultEnergyProfileId);
    }

    [Fact]
    public async Task Recommended_backfill_only_fills_known_empty_seed_values()
    {
        await using var fixture = await DatabaseFixture.CreateAsync();
        var settings = await fixture.Db.ApplicationSettings.SingleAsync();
        var printer = await fixture.Db.Printers.SingleAsync(x => x.Id == SeedData.PrinterId);
        var policy = await fixture.Db.PricingPolicies.SingleAsync(x => x.Id == SeedData.PricingPolicyId);
        var tariff = await fixture.Db.ElectricityTariffs.SingleAsync(x => x.Id == SeedData.TariffId);
        settings.RecommendedDefaultsVersion = 0;
        settings.DefaultEnergyProfileId = null;
        settings.DefaultQuickSetupMinutes = null;
        settings.DefaultQuickPackagingCostGs = null;
        printer.ManualHourlyRateGs = null;
        policy.DefaultLaborRateGsPerHour = null;
        policy.OverheadPercent = 0m;
        tariff.BaseRateGsPerKWh = 500m;
        await fixture.Db.SaveChangesAsync();

        await SeedData.EnsureSeededAsync(fixture.Db);

        Assert.Equal(2_000m, printer.ManualHourlyRateGs);
        Assert.Equal(SeedData.EnergyProfileId, settings.DefaultEnergyProfileId);
        Assert.Equal(20_000m, policy.DefaultLaborRateGsPerHour);
        Assert.Equal(5m, policy.OverheadPercent);
        Assert.Equal(20m, settings.DefaultQuickSetupMinutes);
        Assert.Equal(2_000m, settings.DefaultQuickPackagingCostGs);
        Assert.Equal(500m, tariff.BaseRateGsPerKWh);
        Assert.Equal(SeedData.RecommendedDefaultsVersion, settings.RecommendedDefaultsVersion);
    }

    [Fact]
    public async Task Sqlite_preserves_decimal_seed_values_and_required_unique_index()
    {
        await using var fixture = await DatabaseFixture.CreateAsync();
        var tariff = await fixture.Db.ElectricityTariffs.SingleAsync();
        Assert.Equal(435.51m, tariff.BaseRateGsPerKWh);

        fixture.Db.AppUsers.Add(new AppUserEntity
        {
            Id = Guid.NewGuid(), Username = "rafa", DisplayName = "Duplicado", Role = "Owner",
            IsActive = true, CreatedAt = DateTimeOffset.UtcNow, UpdatedAt = DateTimeOffset.UtcNow
        });
        await Assert.ThrowsAsync<DbUpdateException>(() => fixture.Db.SaveChangesAsync());
    }

    [Fact]
    public async Task Quote_snapshot_is_immutable_and_completion_posts_one_inventory_movement()
    {
        await using var fixture = await DatabaseFixture.CreateAsync();
        var spool = new FilamentSpoolEntity
        {
            Id = Guid.NewGuid(), Manufacturer = "Test", ProductName = "PLA", Material = "PLA", Color = "Blanco",
            PurchaseCurrency = "PYG", PurchaseAmount = 131_250m, LandedCostGs = 131_250m,
            NetWeightGrams = 1_000m, RemainingWeightGrams = 1_000m, IsInventoryTracked = true, IsActive = true
        };
        fixture.Db.FilamentSpools.Add(spool);
        (await fixture.Db.Printers.SingleAsync(x => x.Id == SeedData.PrinterId)).ManualHourlyRateGs = 2_000m;
        await fixture.Db.SaveChangesAsync();
        var repository = new PrintCostRepository(fixture.Db);
        var workflow = new QuoteWorkflowService(repository, new QuoteCalculationService(repository));
        var preview = new QuotePreviewRequest(
            SeedData.PrinterId, SeedData.EnergyProfileId, SeedData.TariffId, SeedData.PricingPolicyId,
            new QuantityPlan(), 5.4m, 0m, 5.4m, null, 0m, 0m,
            [new MaterialSelection(spool.Id, SlicerTotalGrams: 142m)], [], [],
            AcceptZeroMachineRate: true, ZeroMachineRateReason: "Aún no configurado");
        var quote = await workflow.CreateAsync(new CreateQuoteRequest(preview, null, null, null, null), SeedData.RafaId);
        spool.PurchaseAmount = 200_000m;
        await fixture.Db.SaveChangesAsync();

        var reloaded = await repository.GetQuoteAsync(quote.Id);
        Assert.Equal(18_637.50m, reloaded!.Revisions.Single().Breakdown.MaterialCostGs);
        Assert.NotNull(reloaded.Revisions.Single().Aggregate);
        var persistedRevision = await fixture.Db.QuoteRevisions.SingleAsync(x => x.QuoteId == quote.Id);
        Assert.False(string.IsNullOrWhiteSpace(persistedRevision.AggregateJson));
        persistedRevision.AggregateJson = null;
        await fixture.Db.SaveChangesAsync();
        var legacy = await repository.GetQuoteAsync(quote.Id);
        Assert.True(legacy!.Revisions.Single().IsLegacyRevision);
        Assert.Equal(legacy.Revisions.Single().EffectiveLines.Sum(x => x.Breakdown.CustomerTotalGs),
            legacy.Revisions.Single().TotalCustomerPriceGs);
        await workflow.CreateRevisionAsync(quote.Id, SeedData.RafaId);
        await workflow.TransitionAsync(quote.Id, QuoteStatus.ReadyToSend, SeedData.RafaId);
        await workflow.TransitionAsync(quote.Id, QuoteStatus.Sent, SeedData.RafaId);
        await workflow.TransitionAsync(quote.Id, QuoteStatus.Accepted, SeedData.RafaId);
        var job = await workflow.ConvertToJobAsync(quote.Id, SeedData.RafaId);
        await workflow.StartJobAsync(job.Id, SeedData.RafaId);
        await workflow.CompleteJobAsync(job.Id, new CompleteJobRequest(
            5.5m, 0.55m, 1, 0, [new ActualMaterialUsage(spool.Id, 140m)], [], [], 0m, 85_000m, 0m, null), SeedData.RafaId);

        Assert.Equal(860m, (await fixture.Db.FilamentSpools.SingleAsync(x => x.Id == spool.Id)).RemainingWeightGrams);
        var movement = await fixture.Db.InventoryMovements.SingleAsync();
        Assert.Equal(-140m, movement.Grams);
        Assert.Equal("Consumption", movement.Type);
        Assert.Single(await fixture.Db.PrintJobMaterialUsages.ToArrayAsync());
        Assert.NotNull(await fixture.Db.PrintJobCostSnapshots.SingleAsync());
    }

    [Fact]
    public async Task Multiple_quote_lines_and_multicolor_actuals_are_normalized_and_negative_inventory_is_rejected()
    {
        await using var fixture = await DatabaseFixture.CreateAsync();
        (await fixture.Db.Printers.SingleAsync(x => x.Id == SeedData.PrinterId)).ManualHourlyRateGs = 2_000m;
        var white = NewSpool("Blanco", 200m);
        var black = NewSpool("Negro", 200m);
        fixture.Db.FilamentSpools.AddRange(white, black);
        await fixture.Db.SaveChangesAsync();
        var repository = new PrintCostRepository(fixture.Db);
        var workflow = new QuoteWorkflowService(repository, new QuoteCalculationService(repository));
        var first = Preview(white.Id, 100m);
        var second = Preview(black.Id, 42m) with { PrintDurationHours = 1m, OccupiedPrinterHours = 1m };
        var quote = await workflow.CreateAsync(new CreateQuoteRequest(
            first, null, null, null, null,
            [new QuoteLineRequest("Blanco", first), new QuoteLineRequest("Negro", second)]), SeedData.RafaId);

        Assert.Equal(2, await fixture.Db.QuoteLines.CountAsync());
        Assert.Equal(2, (await repository.GetQuoteAsync(quote.Id))!.Revisions.Single().EffectiveLines.Count);

        quote = await workflow.CreateRevisionAsync(quote.Id, SeedData.RafaId);
        await workflow.TransitionAsync(quote.Id, QuoteStatus.ReadyToSend, SeedData.RafaId);
        await workflow.TransitionAsync(quote.Id, QuoteStatus.Sent, SeedData.RafaId);
        await workflow.TransitionAsync(quote.Id, QuoteStatus.Accepted, SeedData.RafaId);
        var job = await workflow.ConvertToJobAsync(quote.Id, SeedData.RafaId);
        await workflow.StartJobAsync(job.Id, SeedData.RafaId);

        var completed = await workflow.CompleteJobAsync(job.Id, new CompleteJobRequest(
            6.5m, 0.7m, 2, 1,
            [new ActualMaterialUsage(white.Id, 110m), new ActualMaterialUsage(black.Id, 45m)],
            [], [new AdditionalCostInput("Consumible", 1_500m, CostScope.FixedPerOrder)], 500m, 100_000m, 0m, null), SeedData.RafaId);

        Assert.Equal(2, await fixture.Db.PrintJobMaterialUsages.CountAsync());
        Assert.Single(await fixture.Db.PrintJobAdditionalCosts.ToArrayAsync());
        Assert.Equal(2, completed.ActualDetails!.Materials.Count);

        var insufficient = NewSpool("Rojo", 10m);
        fixture.Db.FilamentSpools.Add(insufficient);
        await fixture.Db.SaveChangesAsync();
        var draft = await workflow.CreateAsync(new CreateQuoteRequest(Preview(insufficient.Id, 5m), null, null, null, null), SeedData.RafaId);
        draft = await workflow.CreateRevisionAsync(draft.Id, SeedData.RafaId);
        await workflow.TransitionAsync(draft.Id, QuoteStatus.ReadyToSend, SeedData.RafaId);
        await workflow.TransitionAsync(draft.Id, QuoteStatus.Sent, SeedData.RafaId);
        await workflow.TransitionAsync(draft.Id, QuoteStatus.Accepted, SeedData.RafaId);
        var secondJob = await workflow.ConvertToJobAsync(draft.Id, SeedData.RafaId);
        await workflow.StartJobAsync(secondJob.Id, SeedData.RafaId);

        await Assert.ThrowsAsync<InvalidOperationException>(() => workflow.CompleteJobAsync(secondJob.Id, new CompleteJobRequest(
            1m, 0.1m, 1, 0, [new ActualMaterialUsage(insufficient.Id, 11m)], [], [], 0m, 20_000m, 0m, null), SeedData.RafaId));
        Assert.Equal(10m, (await fixture.Db.FilamentSpools.SingleAsync(x => x.Id == insufficient.Id)).RemainingWeightGrams);
        Assert.DoesNotContain(await fixture.Db.InventoryMovements.ToArrayAsync(), x => x.ReferenceId == secondJob.Id);
    }

    private static FilamentSpoolEntity NewSpool(string color, decimal remaining) => new()
    {
        Id = Guid.NewGuid(), Manufacturer = "Test", ProductName = "PLA", Material = "PLA", Color = color,
        PurchaseCurrency = "PYG", PurchaseAmount = 100_000m, LandedCostGs = 100_000m,
        NetWeightGrams = 1_000m, RemainingWeightGrams = remaining, IsInventoryTracked = true, IsActive = true
    };

    private static QuotePreviewRequest Preview(Guid spoolId, decimal grams) => new(
        SeedData.PrinterId, SeedData.EnergyProfileId, SeedData.TariffId, SeedData.PricingPolicyId,
        new QuantityPlan(), 5.4m, 0m, 5.4m, null, 0m, 0m,
        [new MaterialSelection(spoolId, SlicerTotalGrams: grams)], [], []);

    private sealed class DatabaseFixture(SqliteConnection connection, PrintCostDbContext db) : IAsyncDisposable
    {
        public PrintCostDbContext Db { get; } = db;

        public static async Task<DatabaseFixture> CreateAsync()
        {
            var connection = new SqliteConnection("Data Source=:memory:;Foreign Keys=True");
            await connection.OpenAsync();
            var db = new PrintCostDbContext(new DbContextOptionsBuilder<PrintCostDbContext>().UseSqlite(connection).Options);
            await db.Database.EnsureCreatedAsync();
            await SeedData.EnsureSeededAsync(db);
            return new DatabaseFixture(connection, db);
        }

        public async ValueTask DisposeAsync()
        {
            await Db.DisposeAsync();
            await connection.DisposeAsync();
        }
    }
}
