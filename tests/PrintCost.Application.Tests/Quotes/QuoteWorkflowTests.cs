using PrintCost.Application.Abstractions;
using PrintCost.Application.Auth;
using PrintCost.Application.Catalogs;
using PrintCost.Application.Quotes;
using PrintCost.Domain.Pricing;

namespace PrintCost.Application.Tests.Quotes;

public sealed class QuoteWorkflowTests
{
    [Fact]
    public async Task Preview_resolves_catalog_values_on_backend()
    {
        var repository = new FakeRepository();
        var service = new QuoteCalculationService(repository);

        var preview = await service.PreviewAsync(Request(repository));

        Assert.Equal(18_637.50m, preview.Breakdown.MaterialCostGs);
        Assert.Equal(223.41663m, preview.Breakdown.Energy.CostGs);
        Assert.Equal(131.25m, preview.Snapshot.Materials[0].PurchaseAmount / preview.Snapshot.Materials[0].NetFilamentWeightGrams);
    }

    [Fact]
    public async Task Quick_quote_resolves_142_grams_and_5_hours_24_minutes_without_duplicating_formulas()
    {
        var repository = new FakeRepository();
        var service = new QuoteCalculationService(repository);

        var preview = await service.QuickPreviewAsync(new QuickQuotePreviewRequest(repository.Spool.Id, 324, 142m));

        Assert.NotNull(preview.Breakdown);
        Assert.NotNull(preview.AdvancedRequest);
        Assert.Equal(18_637.50m, preview.Breakdown.MaterialCostGs);
        Assert.Equal(5.4m, preview.ResolvedAssumptions!.PrintDurationHours);
        Assert.Equal(5.4m, preview.ResolvedAssumptions.OccupiedPrinterHours);
        Assert.Equal("PLA", repository.LastCompatibleMaterial);
        Assert.True(preview.CanUsePrice);
    }

    [Fact]
    public async Task Quick_quote_reports_structured_blocking_warnings_when_defaults_are_missing()
    {
        var repository = new FakeRepository
        {
            Settings = new ApplicationSettingsSnapshot(
                Guid.NewGuid(), "Test", "America/Asuncion", null, false, null, 0m, false,
                null, null, null, null, null)
        };

        var preview = await new QuoteCalculationService(repository)
            .QuickPreviewAsync(new QuickQuotePreviewRequest(repository.Spool.Id, 324, 142m));

        Assert.False(preview.CanUsePrice);
        Assert.Null(preview.Breakdown);
        Assert.Contains(preview.Warnings, x => x.Code == "DEFAULT_PRINTER_REQUIRED" && x.BlocksPrice);
        Assert.Contains(preview.Warnings, x => x.Code == "DEFAULT_QUICK_SETUP_REQUIRED" && x.BlocksPrice);
    }

    [Fact]
    public async Task Quick_quote_selects_profile_by_normalized_material_family()
    {
        var repository = new FakeRepository();
        repository.Spool = repository.Spool with { Material = "PLA Matte" };

        var preview = await new QuoteCalculationService(repository)
            .QuickPreviewAsync(new QuickQuotePreviewRequest(repository.Spool.Id, 324, 142m));

        Assert.NotNull(preview.Breakdown);
        Assert.Equal("PLA Matte", repository.LastCompatibleMaterial);
        Assert.Equal("PLA", preview.ResolvedAssumptions!.MaterialFamily);
    }

    [Fact]
    public async Task Quick_quote_prefers_the_configured_compatible_energy_profile_over_a_newer_candidate()
    {
        var repository = new FakeRepository();
        repository.CompatibleEnergy = repository.Energy with
        {
            Id = Guid.NewGuid(),
            Name = "PLA nuevo",
            AveragePrintPowerW = 140m
        };
        repository.Settings = repository.Settings with { DefaultEnergyProfileId = repository.Energy.Id };

        var preview = await new QuoteCalculationService(repository)
            .QuickPreviewAsync(new QuickQuotePreviewRequest(repository.Spool.Id, 324, 142m));

        Assert.Equal(repository.Energy.Id, preview.ResolvedAssumptions!.EnergyProfileId);
        Assert.Equal(95m, preview.Breakdown!.Energy.TotalKWh / 5.4m * 1_000m);
        Assert.Null(repository.LastCompatibleMaterial);
    }

    [Fact]
    public async Task Quick_quote_uses_standard_energy_as_a_non_blocking_material_fallback()
    {
        var repository = new FakeRepository();
        repository.Spool = repository.Spool with { Material = "NYLON-CF" };

        var preview = await new QuoteCalculationService(repository)
            .QuickPreviewAsync(new QuickQuotePreviewRequest(repository.Spool.Id, 324, 142m));

        Assert.True(preview.CanUsePrice);
        Assert.NotNull(preview.Breakdown);
        Assert.Contains(preview.Warnings, x => x.Code == "ENERGY_PROFILE_FALLBACK_USED" && !x.BlocksPrice);
        Assert.DoesNotContain(preview.Warnings, x => x.Code == "ENERGY_PROFILE_MATERIAL_MISMATCH");
    }

    [Fact]
    public async Task Quick_quote_keeps_insufficient_tracked_inventory_non_blocking()
    {
        var repository = new FakeRepository();
        repository.Spool = repository.Spool with { RemainingWeightGrams = 1m, IsInventoryTracked = true };

        var preview = await new QuoteCalculationService(repository)
            .QuickPreviewAsync(new QuickQuotePreviewRequest(repository.Spool.Id, 324, 142m));

        Assert.True(preview.CanUsePrice);
        Assert.NotNull(preview.Breakdown);
        Assert.Contains(preview.Warnings, x => x.Code == "INSUFFICIENT_FILAMENT_INVENTORY" && !x.BlocksPrice);
    }

    [Fact]
    public async Task Quick_quote_fallback_keeps_the_same_non_blocking_severity_when_saved_recalculated_and_readied()
    {
        var repository = new FakeRepository();
        repository.Spool = repository.Spool with { Material = "NYLON-CF" };
        var calculator = new QuoteCalculationService(repository);
        var workflow = new QuoteWorkflowService(repository, calculator);
        var quick = await calculator.QuickPreviewAsync(new QuickQuotePreviewRequest(repository.Spool.Id, 324, 142m));

        var quote = await workflow.CreateAsync(
            new CreateQuoteRequest(quick.AdvancedRequest!, null, null, null, null),
            repository.User.Id);
        quote = await workflow.CreateRevisionAsync(quote.Id, repository.User.Id);
        quote = await workflow.TransitionAsync(quote.Id, QuoteStatus.ReadyToSend, repository.User.Id);

        var current = quote.Revisions.MaxBy(x => x.RevisionNumber)!;
        Assert.Equal(QuoteStatus.ReadyToSend, quote.Status);
        Assert.True(current.CanUsePrice);
        Assert.Contains(current.EffectiveLines.SelectMany(x => x.Warnings),
            x => x.Code == "ENERGY_PROFILE_FALLBACK_USED" && !x.BlocksPrice);
    }

    [Fact]
    public async Task Insufficient_inventory_keeps_the_same_non_blocking_severity_when_saved_recalculated_and_readied()
    {
        var repository = new FakeRepository();
        repository.Spool = repository.Spool with { RemainingWeightGrams = 1m, IsInventoryTracked = true };
        var calculator = new QuoteCalculationService(repository);
        var workflow = new QuoteWorkflowService(repository, calculator);
        var quick = await calculator.QuickPreviewAsync(new QuickQuotePreviewRequest(repository.Spool.Id, 324, 142m));

        var quote = await workflow.CreateAsync(
            new CreateQuoteRequest(quick.AdvancedRequest!, null, null, null, null),
            repository.User.Id);
        quote = await workflow.CreateRevisionAsync(quote.Id, repository.User.Id);
        quote = await workflow.TransitionAsync(quote.Id, QuoteStatus.ReadyToSend, repository.User.Id);

        var current = quote.Revisions.MaxBy(x => x.RevisionNumber)!;
        Assert.Equal(QuoteStatus.ReadyToSend, quote.Status);
        Assert.True(current.CanUsePrice);
        Assert.Contains(current.EffectiveLines.SelectMany(x => x.Warnings),
            x => x.Code == "INSUFFICIENT_FILAMENT_INVENTORY" && !x.BlocksPrice);
    }

    [Fact]
    public async Task Standard_quote_blocks_an_energy_profile_material_mismatch()
    {
        var repository = new FakeRepository();
        repository.Spool = repository.Spool with { Material = "NYLON-CF" };

        var preview = await new QuoteCalculationService(repository).PreviewAsync(Request(repository));

        Assert.False(preview.CanUsePrice);
        Assert.Contains(preview.Warnings, x => x.Code == "ENERGY_PROFILE_MATERIAL_MISMATCH" && x.BlocksPrice);
        Assert.DoesNotContain(preview.Warnings, x => x.Code == "ENERGY_PROFILE_FALLBACK_USED");
    }

    [Fact]
    public async Task Preview_is_not_usable_without_a_positive_machine_rate_or_required_labor_rate()
    {
        var repository = new FakeRepository();
        repository.Printer = repository.Printer with { ManualHourlyRateGs = null };
        repository.Policy = repository.Policy with { DefaultLaborRateGsPerHour = null };
        var request = Request(repository) with
        {
            Labor = [new LaborSelection("Setup", 15m, null, CostScope.FixedPerOrder)]
        };

        var preview = await new QuoteCalculationService(repository).PreviewAsync(request);

        Assert.False(preview.CanUsePrice);
        Assert.Contains(preview.Warnings, x => x.Code == "MACHINE_RATE_REQUIRED");
        Assert.Contains(preview.Warnings, x => x.Code == "LABOR_RATE_REQUIRED");
    }

    [Fact]
    public async Task Labor_requires_a_positive_resolved_rate_only_when_minutes_are_positive()
    {
        var repository = new FakeRepository();
        repository.Policy = repository.Policy with { DefaultLaborRateGsPerHour = 0m };
        var service = new QuoteCalculationService(repository);

        var required = await service.PreviewAsync(Request(repository) with
        {
            Labor = [new LaborSelection("Setup", 15m, null, CostScope.FixedPerOrder)]
        });
        var notRequired = await service.PreviewAsync(Request(repository) with
        {
            Labor = [new LaborSelection("Setup", 0m, null, CostScope.FixedPerOrder)]
        });

        Assert.Contains(required.Warnings, x => x.Code == "LABOR_RATE_REQUIRED" && x.BlocksPrice);
        Assert.DoesNotContain(notRequired.Warnings, x => x.Code == "LABOR_RATE_REQUIRED");
    }

    [Fact]
    public async Task Existing_revision_keeps_immutable_spool_snapshot_when_catalog_changes()
    {
        var repository = new FakeRepository();
        var workflow = new QuoteWorkflowService(repository, new QuoteCalculationService(repository));
        var quote = await workflow.CreateAsync(new CreateQuoteRequest(Request(repository), null, null, null, null), repository.User.Id);
        repository.Spool = repository.Spool with { PurchaseAmount = 200_000m };

        var original = quote.Revisions.Single();
        var revised = await workflow.CreateRevisionAsync(quote.Id, repository.User.Id);

        Assert.Equal(18_637.50m, original.Breakdown.MaterialCostGs);
        Assert.Equal(28_400m, revised.Revisions.Last().Breakdown.MaterialCostGs);
        Assert.Equal(2, revised.Revisions.Count);
    }

    [Fact]
    public async Task Accepted_quote_converts_to_job_and_completion_records_actuals_and_inventory()
    {
        var repository = new FakeRepository();
        var workflow = new QuoteWorkflowService(repository, new QuoteCalculationService(repository));
        var quote = await workflow.CreateAsync(new CreateQuoteRequest(Request(repository), null, null, null, null), repository.User.Id);
        quote = await workflow.CreateRevisionAsync(quote.Id, repository.User.Id);
        await workflow.TransitionAsync(quote.Id, QuoteStatus.ReadyToSend, repository.User.Id);
        await workflow.TransitionAsync(quote.Id, QuoteStatus.Sent, repository.User.Id);
        await workflow.TransitionAsync(quote.Id, QuoteStatus.Accepted, repository.User.Id);
        var job = await workflow.ConvertToJobAsync(quote.Id, repository.User.Id);
        await workflow.StartJobAsync(job.Id, repository.User.Id);

        var completed = await workflow.CompleteJobAsync(job.Id, new CompleteJobRequest(
            5.5m, 0.6m, 1, 0, [new ActualMaterialUsage(repository.Spool.Id, 145m)], [], [], 0m, 90_000m, 0m, null), repository.User.Id);

        Assert.Equal(PrintJobStatus.Completed, completed.Status);
        Assert.Equal(145m * 131.25m, completed.ActualResult!.MaterialCostGs);
        Assert.Single(repository.Inventory);
        Assert.Equal(145m, repository.Inventory[0].Grams);
    }

    [Fact]
    public async Task Draft_supports_editing_and_multiple_independent_quote_lines()
    {
        var repository = new FakeRepository();
        var workflow = new QuoteWorkflowService(repository, new QuoteCalculationService(repository));
        var first = Request(repository);
        var second = first with
        {
            PrintDurationHours = 1m,
            OccupiedPrinterHours = 1m,
            Materials = [new MaterialSelection(repository.Spool.Id, SlicerTotalGrams: 10m)]
        };
        var quote = await workflow.CreateAsync(new CreateQuoteRequest(
            first, null, null, "Inicial", null,
            [new QuoteLineRequest("Pieza principal", first), new QuoteLineRequest("Accesorio", second)]), repository.User.Id);

        Assert.Equal(QuoteStatus.Draft, quote.Status);
        Assert.Equal(2, quote.Revisions.Single().EffectiveLines.Count);
        Assert.NotNull(quote.Revisions.Single().Aggregate);
        Assert.Equal(
            quote.Revisions.Single().EffectiveLines.Sum(x => x.Breakdown.CustomerTotalGs),
            quote.Revisions.Single().TotalCustomerPriceGs);

        var editedSecond = second with { Materials = [new MaterialSelection(repository.Spool.Id, SlicerTotalGrams: 20m)] };
        var edited = await workflow.UpdateDraftAsync(quote.Id, new CreateQuoteRequest(
            first, null, null, "Editada", null,
            [new QuoteLineRequest("Pieza principal", first), new QuoteLineRequest("Accesorio corregido", editedSecond)]), repository.User.Id);

        Assert.Equal(QuoteStatus.Draft, edited.Status);
        Assert.Equal(2, edited.Revisions.Count);
        Assert.Equal("Accesorio corregido", edited.Revisions.Last().EffectiveLines[1].Description);
        Assert.Equal(20m, edited.Revisions.Last().EffectiveLines[1].Breakdown.Materials.Single().TotalChargeableGrams);
    }

    [Fact]
    public async Task Multiline_rejects_fixed_per_order_costs_after_the_first_line()
    {
        var repository = new FakeRepository();
        var workflow = new QuoteWorkflowService(repository, new QuoteCalculationService(repository));
        var first = Request(repository);
        var invalidSecond = first with
        {
            Labor = [new LaborSelection("Setup repetido", 10m, 12_000m, CostScope.FixedPerOrder)]
        };

        var error = await Assert.ThrowsAsync<InvalidOperationException>(() => workflow.CreateAsync(
            new CreateQuoteRequest(first, null, null, null, null,
                [new QuoteLineRequest("Primera", first), new QuoteLineRequest("Segunda", invalidSecond)]),
            repository.User.Id));

        Assert.Contains("FixedPerOrder", error.Message);
    }

    [Fact]
    public async Task Multiline_rejects_a_different_pricing_policy()
    {
        var repository = new FakeRepository();
        var workflow = new QuoteWorkflowService(repository, new QuoteCalculationService(repository));
        var first = Request(repository);
        var second = first with { PricingPolicyId = repository.SecondPolicy.Id };

        var error = await Assert.ThrowsAsync<InvalidOperationException>(() => workflow.CreateAsync(
            new CreateQuoteRequest(first, null, null, null, null,
                [new QuoteLineRequest("Primera", first), new QuoteLineRequest("Segunda", second)]),
            repository.User.Id));

        Assert.Contains("misma política", error.Message);
    }

    [Fact]
    public async Task Job_actuals_support_multicolor_details_and_strict_pause_resume_transitions()
    {
        var repository = new FakeRepository();
        var workflow = new QuoteWorkflowService(repository, new QuoteCalculationService(repository));
        var request = Request(repository) with
        {
            Materials =
            [
                new MaterialSelection(repository.Spool.Id, SlicerTotalGrams: 100m),
                new MaterialSelection(repository.SecondSpool.Id, SlicerTotalGrams: 42m)
            ]
        };
        var quote = await workflow.CreateAsync(new CreateQuoteRequest(request, null, null, null, null), repository.User.Id);
        quote = await workflow.CreateRevisionAsync(quote.Id, repository.User.Id);
        await workflow.TransitionAsync(quote.Id, QuoteStatus.ReadyToSend, repository.User.Id);
        await workflow.TransitionAsync(quote.Id, QuoteStatus.Sent, repository.User.Id);
        await workflow.TransitionAsync(quote.Id, QuoteStatus.Accepted, repository.User.Id);
        var job = await workflow.ConvertToJobAsync(quote.Id, repository.User.Id);

        await Assert.ThrowsAsync<InvalidOperationException>(() => workflow.TransitionJobAsync(job.Id, PrintJobStatus.Paused, repository.User.Id));
        job = await workflow.StartJobAsync(job.Id, repository.User.Id);
        job = await workflow.TransitionJobAsync(job.Id, PrintJobStatus.Paused, repository.User.Id);
        Assert.Equal(PrintJobStatus.Paused, job.Status);
        job = await workflow.TransitionJobAsync(job.Id, PrintJobStatus.Printing, repository.User.Id);

        var completed = await workflow.CompleteJobAsync(job.Id, new CompleteJobRequest(
            5.5m, 0.6m, 2, 1,
            [new ActualMaterialUsage(repository.Spool.Id, 105m), new ActualMaterialUsage(repository.SecondSpool.Id, 45m)],
            [], [new AdditionalCostInput("Boquilla", 2_000m, CostScope.FixedPerOrder)], 1_000m, 120_000m, 0m, "Multicolor"),
            repository.User.Id);

        Assert.Equal(PrintJobStatus.Completed, completed.Status);
        Assert.Equal(2, completed.ActualDetails!.Materials.Count);
        Assert.Equal(2, repository.Inventory.Count);
        Assert.Equal(2_000m, completed.ActualDetails.AdditionalCosts.Single().AmountGs);
        await Assert.ThrowsAsync<InvalidOperationException>(() => workflow.TransitionJobAsync(job.Id, PrintJobStatus.Cancelled, repository.User.Id));
    }

    [Fact]
    public async Task Actual_sale_separates_customer_total_tax_net_sale_profit_and_margin()
    {
        var repository = new FakeRepository();
        var workflow = new QuoteWorkflowService(repository, new QuoteCalculationService(repository));
        var request = Request(repository) with { Tax = new TaxInput(true, "IVA", 10m, false) };
        var quote = await workflow.CreateAsync(new CreateQuoteRequest(request, null, null, null, null), repository.User.Id);
        quote = await workflow.CreateRevisionAsync(quote.Id, repository.User.Id);
        await workflow.TransitionAsync(quote.Id, QuoteStatus.ReadyToSend, repository.User.Id);
        await workflow.TransitionAsync(quote.Id, QuoteStatus.Sent, repository.User.Id);
        await workflow.TransitionAsync(quote.Id, QuoteStatus.Accepted, repository.User.Id);
        var job = await workflow.ConvertToJobAsync(quote.Id, repository.User.Id);
        await workflow.StartJobAsync(job.Id, repository.User.Id);

        await Assert.ThrowsAsync<InvalidOperationException>(() => workflow.CompleteJobAsync(job.Id, new CompleteJobRequest(
            0m, 0m, 1, 0, [new ActualMaterialUsage(repository.Spool.Id, 100m)], [], [], 36_875m, 100_000m, 110_000m, null), repository.User.Id));

        var completed = await workflow.CompleteJobAsync(job.Id, new CompleteJobRequest(
            0m, 0m, 1, 0, [new ActualMaterialUsage(repository.Spool.Id, 100m)], [], [], 36_875m, 110_000m, 10_000m, null), repository.User.Id);

        Assert.Equal(50_000m, completed.ActualResult!.FullyLoadedCostGs);
        Assert.Equal(110_000m, completed.ActualResult.ActualCustomerTotalGs);
        Assert.Equal(10_000m, completed.ActualResult.ActualTaxGs);
        Assert.Equal(100_000m, completed.ActualResult.ActualNetSalePriceGs);
        Assert.Equal(50_000m, completed.ActualResult.RealizedProfitGs);
        Assert.Equal(50m, completed.ActualResult.RealizedMarginPercent);
    }

    [Fact]
    public async Task Actual_tax_is_rejected_when_estimate_has_tax_disabled()
    {
        var repository = new FakeRepository();
        var workflow = new QuoteWorkflowService(repository, new QuoteCalculationService(repository));
        var quote = await workflow.CreateAsync(new CreateQuoteRequest(Request(repository), null, null, null, null), repository.User.Id);
        quote = await workflow.CreateRevisionAsync(quote.Id, repository.User.Id);
        await workflow.TransitionAsync(quote.Id, QuoteStatus.ReadyToSend, repository.User.Id);
        await workflow.TransitionAsync(quote.Id, QuoteStatus.Sent, repository.User.Id);
        await workflow.TransitionAsync(quote.Id, QuoteStatus.Accepted, repository.User.Id);
        var job = await workflow.ConvertToJobAsync(quote.Id, repository.User.Id);
        await workflow.StartJobAsync(job.Id, repository.User.Id);

        await Assert.ThrowsAsync<InvalidOperationException>(() => workflow.CompleteJobAsync(job.Id, new CompleteJobRequest(
            0m, 0m, 1, 0, [new ActualMaterialUsage(repository.Spool.Id, 1m)], [], [], 0m, 10_000m, 1_000m, null), repository.User.Id));
    }

    [Fact]
    public async Task Pin_bootstrap_never_overwrites_an_existing_credential()
    {
        var repository = new FakeRepository();
        var service = new PinAuthService(repository, new PinHasher());
        await service.BootstrapAsync(repository.User.Id, "1234");
        var first = repository.Credential!.PinHash;
        await service.BootstrapAsync(repository.User.Id, "9999");
        Assert.Equal(first, repository.Credential.PinHash);
        Assert.Equal(repository.User.Id, (await service.LoginAsync(new LoginRequest("rafa", "1234"))).Id);
    }

    private static QuotePreviewRequest Request(FakeRepository repository) => new(
        repository.Printer.Id, repository.Energy.Id, repository.Tariff.Id, repository.Policy.Id,
        new QuantityPlan(), 5.4m, 0m, 5.4m, null, 0m, 0m,
        [new MaterialSelection(repository.Spool.Id, SlicerTotalGrams: 142m)], [], [],
        Tax: new TaxInput());

    private sealed class FakeRepository : IPrintCostRepository
    {
        public AppUserDto User { get; } = new(Guid.NewGuid(), "rafa", "Rafa", "Owner", true);
        public PrinterSnapshot Printer { get; set; } = new(Guid.NewGuid(), "A1", "Bambu Lab", "A1", 220m, MachineCostMode.ManualHourlyRate, null, 0m, null, 0m, 0m, null, null, null, 0m, 2_000m, true);
        public EnergyProfileSnapshot Energy { get; }
        public EnergyProfileSnapshot CompatibleEnergy { get; set; }
        public ElectricityTariffSnapshot Tariff { get; } = new(Guid.NewGuid(), "ANDE", "Residencial", "142", 435.51m, true, 0m, null, "ANDE", new DateOnly(2026, 8, 6), true);
        public FilamentSnapshot Spool { get; set; } = new(Guid.NewGuid(), "Test", "PLA", "PLA", "Blanco", "L1", "PYG", 131_250m, null, 0m, 0m, 0m, 1_000m, 1_000m, true, true);
        public FilamentSnapshot SecondSpool { get; set; } = new(Guid.NewGuid(), "Test", "PLA", "PLA", "Negro", "L2", "PYG", 150_000m, null, 0m, 0m, 0m, 1_000m, 1_000m, true, true);
        public PricingPolicySnapshot Policy { get; set; } = new(Guid.NewGuid(), "Default", 40m, 30m, 30_000m, 5_000m, true, FailureReserveMode.ExpectedAttempts, 0.1m, 0m, 0m, 0m, 0m, 0m, 12_000m, 0m, 0m, true, true);
        public PricingPolicySnapshot SecondPolicy { get; } = new(Guid.NewGuid(), "Alternativa", 35m, 25m, 0m, 1_000m, true, FailureReserveMode.ExpectedAttempts, 0.05m, 0m, 0m, 0m, 0m, 0m, 12_000m, 0m, 0m, false, true);
        public ApplicationSettingsSnapshot Settings { get; set; }
        public string? LastCompatibleMaterial { get; private set; }
        public List<InventoryConsumption> Inventory { get; } = [];
        public AuthCredentialDto? Credential { get; private set; }
        private readonly Dictionary<Guid, QuoteRecord> quotes = [];
        private readonly Dictionary<Guid, PrintJobRecord> jobs = [];

        public FakeRepository()
        {
            Energy = new EnergyProfileSnapshot(Guid.NewGuid(), Printer.Id, "PLA", "PLA", 95m, 5m, 1_300m, 0m, 0m, "Bambu", new DateOnly(2026, 8, 6), true);
            CompatibleEnergy = Energy;
            Settings = new ApplicationSettingsSnapshot(
                Guid.NewGuid(), "Test", "America/Asuncion", null, false, null, 0m, false,
                Printer.Id, Tariff.Id, Policy.Id, 15m, 2_000m);
        }
        public Task<PrinterSnapshot?> GetPrinterSnapshotAsync(Guid id, CancellationToken cancellationToken = default) => Task.FromResult<PrinterSnapshot?>(id == Printer.Id ? Printer : null);
        public Task<EnergyProfileSnapshot?> GetEnergyProfileSnapshotAsync(Guid id, CancellationToken cancellationToken = default) => Task.FromResult<EnergyProfileSnapshot?>(id == Energy.Id ? Energy : id == CompatibleEnergy.Id ? CompatibleEnergy : null);
        public Task<EnergyProfileSnapshot?> GetCompatibleEnergyProfileSnapshotAsync(Guid printerId, string material, CancellationToken cancellationToken = default)
        {
            LastCompatibleMaterial = material;
            return Task.FromResult<EnergyProfileSnapshot?>(printerId == Printer.Id && MaterialFamilyNormalizer.Matches(material, CompatibleEnergy.MaterialFamily) ? CompatibleEnergy : null);
        }
        public Task<EnergyProfileSnapshot?> GetStandardEnergyProfileSnapshotAsync(Guid printerId, CancellationToken cancellationToken = default) =>
            Task.FromResult<EnergyProfileSnapshot?>(printerId == Printer.Id ? Energy : null);
        public Task<ElectricityTariffSnapshot?> GetElectricityTariffSnapshotAsync(Guid id, CancellationToken cancellationToken = default) => Task.FromResult<ElectricityTariffSnapshot?>(id == Tariff.Id ? Tariff : null);
        public Task<FilamentSnapshot?> GetFilamentSnapshotAsync(Guid id, CancellationToken cancellationToken = default) => Task.FromResult<FilamentSnapshot?>(id == Spool.Id ? Spool : id == SecondSpool.Id ? SecondSpool : null);
        public Task<PricingPolicySnapshot?> GetPricingPolicySnapshotAsync(Guid? id, CancellationToken cancellationToken = default) =>
            Task.FromResult<PricingPolicySnapshot?>(id == SecondPolicy.Id ? SecondPolicy : id is null || id == Policy.Id ? Policy : null);
        public Task<ApplicationSettingsSnapshot?> GetApplicationSettingsAsync(CancellationToken cancellationToken = default) => Task.FromResult<ApplicationSettingsSnapshot?>(Settings);
        public Task<string> NextQuoteCodeAsync(int year, CancellationToken cancellationToken = default) => Task.FromResult($"COT-{year}-0001");
        public Task AddQuoteAsync(QuoteRecord quote, CancellationToken cancellationToken = default) { quotes[quote.Id] = quote; return Task.CompletedTask; }
        public Task<QuoteRecord?> GetQuoteAsync(Guid id, CancellationToken cancellationToken = default) => Task.FromResult(quotes.GetValueOrDefault(id));
        public Task<IReadOnlyList<QuoteSummary>> ListQuotesAsync(string? status, DateOnly? from, DateOnly? to, int skip, int take, CancellationToken cancellationToken = default) => Task.FromResult<IReadOnlyList<QuoteSummary>>([]);
        public Task UpdateQuoteAsync(QuoteRecord quote, CancellationToken cancellationToken = default) { quotes[quote.Id] = quote; return Task.CompletedTask; }
        public Task AddJobAsync(PrintJobRecord job, CancellationToken cancellationToken = default) { jobs[job.Id] = job; return Task.CompletedTask; }
        public Task<PrintJobRecord?> GetJobAsync(Guid id, CancellationToken cancellationToken = default) => Task.FromResult(jobs.GetValueOrDefault(id));
        public Task<IReadOnlyList<PrintJobSummary>> ListJobsAsync(string? status, DateOnly? from, DateOnly? to, int skip, int take, CancellationToken cancellationToken = default) => Task.FromResult<IReadOnlyList<PrintJobSummary>>([]);
        public Task UpdateJobAsync(PrintJobRecord job, IReadOnlyList<InventoryConsumption>? consumption, Guid actorId, CancellationToken cancellationToken = default) { jobs[job.Id] = job; if (consumption is not null) Inventory.AddRange(consumption); return Task.CompletedTask; }
        public Task<IReadOnlyList<AppUserDto>> ListActiveUsersAsync(CancellationToken cancellationToken = default) => Task.FromResult<IReadOnlyList<AppUserDto>>([User]);
        public Task<AppUserDto?> GetUserAsync(Guid id, CancellationToken cancellationToken = default) => Task.FromResult<AppUserDto?>(id == User.Id ? User : null);
        public Task<AuthCredentialDto?> GetCredentialAsync(Guid userId, CancellationToken cancellationToken = default) => Task.FromResult(Credential);
        public Task UpsertCredentialAsync(AuthCredentialDto credential, CancellationToken cancellationToken = default) { Credential = credential; return Task.CompletedTask; }
        public Task AddAuditAsync(Guid? actorId, string action, string entityType, Guid? entityId, string? detail, CancellationToken cancellationToken = default) => Task.CompletedTask;
    }
}
