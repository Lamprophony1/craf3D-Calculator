using PrintCost.Application.Quotes;

namespace PrintCost.Infrastructure.Persistence.Entities;

public sealed class QuoteEntity
{
    public Guid Id { get; set; }
    public string Code { get; set; } = string.Empty;
    public Guid? CustomerId { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
    public DateOnly? ValidUntil { get; set; }
    public Guid CreatedBy { get; set; }
    public string Currency { get; set; } = "PYG";
    public string? Notes { get; set; }
    public string? Terms { get; set; }
    public QuoteStatus Status { get; set; }
    public CustomerEntity? Customer { get; set; }
    public AppUserEntity Creator { get; set; } = null!;
    public List<QuoteRevisionEntity> Revisions { get; set; } = [];
}

public sealed class QuoteRevisionEntity
{
    public Guid Id { get; set; }
    public Guid QuoteId { get; set; }
    public int RevisionNumber { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public Guid CreatedBy { get; set; }
    public string RequestJson { get; set; } = string.Empty;
    public string SnapshotJson { get; set; } = string.Empty;
    public string BreakdownJson { get; set; } = string.Empty;
    public string? LinesJson { get; set; }
    public string? AggregateJson { get; set; }
    public decimal FullyLoadedCostGs { get; set; }
    public decimal FinalNetSalePriceGs { get; set; }
    public QuoteEntity Quote { get; set; } = null!;
    public QuoteCostSnapshotEntity? CostSnapshot { get; set; }
    public List<QuoteLineEntity> Lines { get; set; } = [];
}

public sealed class QuoteLineEntity
{
    public Guid Id { get; set; }
    public Guid QuoteRevisionId { get; set; }
    public string Description { get; set; } = "Impresión 3D";
    public int Quantity { get; set; }
    public int UnitsPerPlate { get; set; }
    public int NumberOfPlates { get; set; }
    public QuoteRevisionEntity Revision { get; set; } = null!;
    public List<QuoteMaterialLineEntity> Materials { get; set; } = [];
    public List<QuoteLaborLineEntity> Labor { get; set; } = [];
    public List<QuoteAdditionalCostLineEntity> AdditionalCosts { get; set; } = [];
}

public sealed class QuoteMaterialLineEntity
{
    public Guid Id { get; set; }
    public Guid QuoteLineId { get; set; }
    public Guid? SpoolId { get; set; }
    public decimal CostPerGramSnapshotGs { get; set; }
    public decimal ChargeableGrams { get; set; }
    public decimal CostGs { get; set; }
    public QuoteLineEntity QuoteLine { get; set; } = null!;
}

public sealed class QuoteLaborLineEntity
{
    public Guid Id { get; set; }
    public Guid QuoteLineId { get; set; }
    public string Category { get; set; } = string.Empty;
    public decimal Minutes { get; set; }
    public decimal HourlyRateSnapshotGs { get; set; }
    public decimal CostGs { get; set; }
    public bool RepeatOnFailure { get; set; }
    public PrintCost.Domain.Pricing.CostScope Scope { get; set; }
    public QuoteLineEntity QuoteLine { get; set; } = null!;
}

public sealed class QuoteAdditionalCostLineEntity
{
    public Guid Id { get; set; }
    public Guid QuoteLineId { get; set; }
    public string Description { get; set; } = string.Empty;
    public decimal AmountGs { get; set; }
    public bool RepeatOnFailure { get; set; }
    public PrintCost.Domain.Pricing.CostScope Scope { get; set; }
    public bool IsInternalCost { get; set; }
    public bool ParticipatesInMargin { get; set; }
    public QuoteLineEntity QuoteLine { get; set; } = null!;
}

public sealed class QuoteCostSnapshotEntity
{
    public Guid Id { get; set; }
    public Guid QuoteRevisionId { get; set; }
    public string ImmutableJson { get; set; } = string.Empty;
    public DateTimeOffset CreatedAt { get; set; }
    public QuoteRevisionEntity Revision { get; set; } = null!;
}

public sealed class PrintJobEntity
{
    public Guid Id { get; set; }
    public Guid? QuoteId { get; set; }
    public Guid PrinterId { get; set; }
    public string Code { get; set; } = string.Empty;
    public PrintJobStatus Status { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset? StartedAt { get; set; }
    public DateTimeOffset? CompletedAt { get; set; }
    public string EstimateJson { get; set; } = string.Empty;
    public string? ActualInputJson { get; set; }
    public string? ActualResultJson { get; set; }
    public decimal EstimatedCostGs { get; set; }
    public decimal? ActualCostGs { get; set; }
    public QuoteEntity? Quote { get; set; }
    public PrinterEntity Printer { get; set; } = null!;
    public List<PrintJobMaterialUsageEntity> MaterialUsages { get; set; } = [];
    public List<PrintJobLaborEntryEntity> LaborEntries { get; set; } = [];
    public List<PrintJobAdditionalCostEntity> AdditionalCosts { get; set; } = [];
    public PrintJobCostSnapshotEntity? CostSnapshot { get; set; }
}

public sealed class PrintJobMaterialUsageEntity
{
    public Guid Id { get; set; }
    public Guid PrintJobId { get; set; }
    public Guid SpoolId { get; set; }
    public decimal Grams { get; set; }
    public decimal CostPerGramSnapshotGs { get; set; }
    public decimal CostGs { get; set; }
    public PrintJobEntity PrintJob { get; set; } = null!;
}

public sealed class PrintJobLaborEntryEntity
{
    public Guid Id { get; set; }
    public Guid PrintJobId { get; set; }
    public string Category { get; set; } = string.Empty;
    public decimal Minutes { get; set; }
    public decimal HourlyRateSnapshotGs { get; set; }
    public decimal CostGs { get; set; }
    public PrintJobEntity PrintJob { get; set; } = null!;
}

public sealed class PrintJobAdditionalCostEntity
{
    public Guid Id { get; set; }
    public Guid PrintJobId { get; set; }
    public string Description { get; set; } = string.Empty;
    public decimal AmountGs { get; set; }
    public bool IsInternalCost { get; set; }
    public bool ParticipatesInMargin { get; set; }
    public PrintJobEntity PrintJob { get; set; } = null!;
}

public sealed class PrintJobCostSnapshotEntity
{
    public Guid Id { get; set; }
    public Guid PrintJobId { get; set; }
    public string ImmutableJson { get; set; } = string.Empty;
    public DateTimeOffset CreatedAt { get; set; }
    public PrintJobEntity PrintJob { get; set; } = null!;
}

public sealed class AuditLogEntity
{
    public Guid Id { get; set; }
    public Guid? ActorId { get; set; }
    public string Action { get; set; } = string.Empty;
    public string EntityType { get; set; } = string.Empty;
    public Guid? EntityId { get; set; }
    public string? Detail { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
}
