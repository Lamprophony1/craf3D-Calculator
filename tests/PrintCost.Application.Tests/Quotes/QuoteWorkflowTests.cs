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
        await workflow.TransitionAsync(quote.Id, QuoteStatus.ReadyToSend, repository.User.Id);
        await workflow.TransitionAsync(quote.Id, QuoteStatus.Sent, repository.User.Id);
        await workflow.TransitionAsync(quote.Id, QuoteStatus.Accepted, repository.User.Id);
        var job = await workflow.ConvertToJobAsync(quote.Id, repository.User.Id);
        await workflow.StartJobAsync(job.Id, repository.User.Id);

        var completed = await workflow.CompleteJobAsync(job.Id, new CompleteJobRequest(
            5.5m, 0.6m, 1, 0, [new ActualMaterialUsage(repository.Spool.Id, 145m)], [], [], 0m, 90_000m, null), repository.User.Id);

        Assert.Equal(PrintJobStatus.Completed, completed.Status);
        Assert.Equal(145m * 131.25m, completed.ActualResult!.MaterialCostGs);
        Assert.Single(repository.Inventory);
        Assert.Equal(145m, repository.Inventory[0].Grams);
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
        public PrinterSnapshot Printer { get; } = new(Guid.NewGuid(), "A1", "Bambu Lab", "A1", 220m, MachineCostMode.ManualHourlyRate, null, 0m, null, 0m, 0m, null, null, null, 0m, 2_000m, true);
        public EnergyProfileSnapshot Energy { get; }
        public ElectricityTariffSnapshot Tariff { get; } = new(Guid.NewGuid(), "ANDE", "Residencial", "142", 435.51m, true, 0m, null, "ANDE", new DateOnly(2026, 8, 6), true);
        public FilamentSnapshot Spool { get; set; } = new(Guid.NewGuid(), "Test", "PLA", "PLA", "Blanco", "L1", "PYG", 131_250m, null, 0m, 0m, 0m, 1_000m, 1_000m, true, true);
        public PricingPolicySnapshot Policy { get; } = new(Guid.NewGuid(), "Default", 40m, 30m, 30_000m, 5_000m, true, FailureReserveMode.ExpectedAttempts, 0.1m, 0m, 0m, 0m, 0m, 0m, null, 0m, 0m, true, true);
        public List<InventoryConsumption> Inventory { get; } = [];
        public AuthCredentialDto? Credential { get; private set; }
        private readonly Dictionary<Guid, QuoteRecord> quotes = [];
        private readonly Dictionary<Guid, PrintJobRecord> jobs = [];

        public FakeRepository() => Energy = new EnergyProfileSnapshot(Guid.NewGuid(), Printer.Id, "PLA", "PLA", 95m, 5m, 1_300m, 0m, 0m, "Bambu", new DateOnly(2026, 8, 6), true);
        public Task<PrinterSnapshot?> GetPrinterSnapshotAsync(Guid id, CancellationToken cancellationToken = default) => Task.FromResult<PrinterSnapshot?>(id == Printer.Id ? Printer : null);
        public Task<EnergyProfileSnapshot?> GetEnergyProfileSnapshotAsync(Guid id, CancellationToken cancellationToken = default) => Task.FromResult<EnergyProfileSnapshot?>(id == Energy.Id ? Energy : null);
        public Task<ElectricityTariffSnapshot?> GetElectricityTariffSnapshotAsync(Guid id, CancellationToken cancellationToken = default) => Task.FromResult<ElectricityTariffSnapshot?>(id == Tariff.Id ? Tariff : null);
        public Task<FilamentSnapshot?> GetFilamentSnapshotAsync(Guid id, CancellationToken cancellationToken = default) => Task.FromResult<FilamentSnapshot?>(id == Spool.Id ? Spool : null);
        public Task<PricingPolicySnapshot?> GetPricingPolicySnapshotAsync(Guid? id, CancellationToken cancellationToken = default) => Task.FromResult<PricingPolicySnapshot?>(Policy);
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
