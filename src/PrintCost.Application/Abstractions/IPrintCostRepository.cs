using PrintCost.Application.Auth;
using PrintCost.Application.Catalogs;
using PrintCost.Application.Quotes;

namespace PrintCost.Application.Abstractions;

public interface IPrintCostRepository
{
    Task<PrinterSnapshot?> GetPrinterSnapshotAsync(Guid id, CancellationToken cancellationToken = default);
    Task<EnergyProfileSnapshot?> GetEnergyProfileSnapshotAsync(Guid id, CancellationToken cancellationToken = default);
    Task<ElectricityTariffSnapshot?> GetElectricityTariffSnapshotAsync(Guid id, CancellationToken cancellationToken = default);
    Task<FilamentSnapshot?> GetFilamentSnapshotAsync(Guid id, CancellationToken cancellationToken = default);
    Task<PricingPolicySnapshot?> GetPricingPolicySnapshotAsync(Guid? id, CancellationToken cancellationToken = default);

    Task<string> NextQuoteCodeAsync(int year, CancellationToken cancellationToken = default);
    Task AddQuoteAsync(QuoteRecord quote, CancellationToken cancellationToken = default);
    Task<QuoteRecord?> GetQuoteAsync(Guid id, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<QuoteSummary>> ListQuotesAsync(string? status, DateOnly? from, DateOnly? to, int skip, int take, CancellationToken cancellationToken = default);
    Task UpdateQuoteAsync(QuoteRecord quote, CancellationToken cancellationToken = default);
    Task AddJobAsync(PrintJobRecord job, CancellationToken cancellationToken = default);
    Task<PrintJobRecord?> GetJobAsync(Guid id, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<PrintJobSummary>> ListJobsAsync(string? status, DateOnly? from, DateOnly? to, int skip, int take, CancellationToken cancellationToken = default);
    Task UpdateJobAsync(PrintJobRecord job, IReadOnlyList<InventoryConsumption>? consumption, Guid actorId, CancellationToken cancellationToken = default);

    Task<IReadOnlyList<AppUserDto>> ListActiveUsersAsync(CancellationToken cancellationToken = default);
    Task<AppUserDto?> GetUserAsync(Guid id, CancellationToken cancellationToken = default);
    Task<AuthCredentialDto?> GetCredentialAsync(Guid userId, CancellationToken cancellationToken = default);
    Task UpsertCredentialAsync(AuthCredentialDto credential, CancellationToken cancellationToken = default);
    Task AddAuditAsync(Guid? actorId, string action, string entityType, Guid? entityId, string? detail, CancellationToken cancellationToken = default);
}

