using PrintCost.Domain.Pricing;

namespace PrintCost.Application.Quotes;

public enum QuoteStatus { Draft, Calculated, ReadyToSend, Sent, Accepted, Rejected, Expired, ConvertedToJob, Cancelled }
public enum PrintJobStatus { Planned, Printing, Paused, Completed, Failed, Cancelled }

public sealed record MaterialSelection(
    Guid SpoolId,
    decimal ModelGrams = 0,
    decimal SupportGrams = 0,
    decimal PurgeGrams = 0,
    decimal PrimeTowerGrams = 0,
    decimal AdhesionGrams = 0,
    decimal OtherWasteGrams = 0,
    decimal? SlicerTotalGrams = null,
    decimal? BaseGrams = null,
    decimal WastePercent = 0,
    bool WastePercentIsAdditional = false);

public sealed record LaborSelection(string Category, decimal Minutes, decimal? HourlyRateGs, CostScope Scope, bool RepeatOnFailure = false);

public sealed record QuotePreviewRequest(
    Guid PrinterId,
    Guid EnergyProfileId,
    Guid ElectricityTariffId,
    Guid? PricingPolicyId,
    QuantityPlan Quantity,
    decimal PrintDurationHours,
    decimal IdleDurationHours,
    decimal OccupiedPrinterHours,
    decimal? MeasuredKWh,
    decimal AdditionalWarmupKWh,
    decimal AdditionalAccessoryKWh,
    IReadOnlyList<MaterialSelection> Materials,
    IReadOnlyList<LaborSelection> Labor,
    IReadOnlyList<AdditionalCostInput> AdditionalCosts,
    decimal FixedSurchargesGs = 0,
    decimal PercentageSurchargePercent = 0,
    decimal DiscountGs = 0,
    decimal? ManualNetPriceGs = null,
    string? ManualPriceReason = null,
    bool AcceptZeroMachineRate = false,
    string? ZeroMachineRateReason = null,
    TaxInput? Tax = null);

public sealed record PriceWarning(
    string Code,
    string Message,
    string? Field = null,
    bool BlocksPrice = true);

public sealed record ResolvedQuoteAssumptions(
    Guid PrinterId,
    string PrinterName,
    Guid EnergyProfileId,
    string EnergyProfileName,
    string MaterialFamily,
    Guid ElectricityTariffId,
    string ElectricityTariffName,
    Guid PricingPolicyId,
    string PricingPolicyName,
    decimal PrintDurationHours,
    decimal OccupiedPrinterHours,
    decimal SetupLaborMinutes,
    decimal PackagingCostGs,
    TaxInput Tax);

public sealed record QuotePreviewResult(
    QuoteCalculationInput Snapshot,
    QuoteCalculationResult Breakdown,
    ResolvedQuoteAssumptions ResolvedAssumptions,
    bool CanUsePrice,
    IReadOnlyList<PriceWarning> Warnings);

public sealed record ResolvedQuoteCalculation(
    QuoteCalculationInput Snapshot,
    ResolvedQuoteAssumptions ResolvedAssumptions,
    IReadOnlyList<PriceWarning> Warnings);

public sealed record QuickQuotePreviewRequest(
    Guid SpoolId,
    int PrintDurationMinutes,
    decimal TotalGrams);

public sealed record QuickQuotePreviewResult(
    QuoteCalculationResult? Breakdown,
    ResolvedQuoteAssumptions? ResolvedAssumptions,
    bool CanUsePrice,
    IReadOnlyList<PriceWarning> Warnings,
    QuotePreviewRequest? AdvancedRequest);

public sealed record QuoteLineRequest(
    string Description,
    QuotePreviewRequest Calculation);

public sealed record QuoteLineRecord(
    Guid Id,
    string Description,
    QuotePreviewRequest Request,
    QuoteCalculationInput Snapshot,
    QuoteCalculationResult Breakdown,
    bool CanUsePrice,
    IReadOnlyList<PriceWarning> Warnings,
    ProductionCalculationResult? Production = null,
    QuoteLineAllocation? Allocation = null);

public sealed record QuoteAggregateSnapshot(
    Guid PricingPolicyId,
    string PricingPolicyName,
    Guid ElectricityTariffId,
    FailureReserveInput Failure,
    OverheadInput Overhead,
    PricingInput Pricing,
    TaxInput Tax);

public sealed record QuoteAggregateRecord(
    QuoteAggregateSnapshot Snapshot,
    QuoteAggregateBreakdown Breakdown);

public sealed record CreateQuoteRequest(
    QuotePreviewRequest Calculation,
    Guid? CustomerId,
    DateOnly? ValidUntil,
    string? Notes,
    string? Terms,
    IReadOnlyList<QuoteLineRequest>? Lines = null);

public sealed record QuoteRevisionRecord(
    Guid Id,
    int RevisionNumber,
    DateTimeOffset CreatedAt,
    Guid CreatedBy,
    QuotePreviewRequest Request,
    QuoteCalculationInput Snapshot,
    QuoteCalculationResult Breakdown,
    IReadOnlyList<QuoteLineRecord>? Lines = null,
    QuoteAggregateRecord? Aggregate = null)
{
    public IReadOnlyList<QuoteLineRecord> EffectiveLines => Lines is { Count: > 0 }
        ? Lines
        : [new QuoteLineRecord(Id, "Impresión 3D", Request, Snapshot, Breakdown, Breakdown.Machine.HourlyRateGs > 0m, [])];

    public bool IsLegacyRevision => Aggregate is null;
    public bool CanUsePrice => Aggregate?.Breakdown.CanUsePrice ?? EffectiveLines.All(x => x.CanUsePrice);
    public decimal TotalCustomerPriceGs => Aggregate?.Breakdown.CustomerTotalGs
        ?? EffectiveLines.Sum(x => x.Breakdown.CustomerTotalGs);
    public decimal TotalFullyLoadedCostGs => Aggregate?.Breakdown.FullyLoadedCostGs
        ?? EffectiveLines.Sum(x => x.Breakdown.FullyLoadedCostGs);
}

public sealed record QuoteRecord(
    Guid Id,
    string Code,
    Guid? CustomerId,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt,
    DateOnly? ValidUntil,
    Guid CreatedBy,
    string Currency,
    string? Notes,
    string? Terms,
    QuoteStatus Status,
    IReadOnlyList<QuoteRevisionRecord> Revisions);

public sealed record QuoteSummary(Guid Id, string Code, QuoteStatus Status, DateTimeOffset CreatedAt, decimal TotalGs, int RevisionNumber);

public sealed record InventoryConsumption(Guid SpoolId, decimal Grams, Guid JobId, string Reason);
public sealed record ActualMaterialUsage(Guid SpoolId, decimal Grams);
public sealed record ActualLaborEntry(string Category, decimal Minutes);

public sealed record CompleteJobRequest(
    decimal ActualOccupiedHours,
    decimal ActualKWh,
    int Attempts,
    int FailedAttempts,
    IReadOnlyList<ActualMaterialUsage> Materials,
    IReadOnlyList<ActualLaborEntry> Labor,
    IReadOnlyList<AdditionalCostInput> AdditionalCosts,
    decimal ActualOverheadGs,
    decimal ActualCustomerTotalGs,
    decimal ActualTaxGs,
    string? Notes);

public sealed record ActualCostResult(
    decimal MaterialCostGs,
    decimal ElectricityCostGs,
    decimal MachineCostGs,
    decimal LaborCostGs,
    decimal AdditionalCostGs,
    decimal OverheadGs,
    decimal FullyLoadedCostGs,
    decimal ActualCustomerTotalGs,
    decimal ActualTaxGs,
    decimal ActualNetSalePriceGs,
    decimal VariableSellingFeeGs,
    decimal NetRevenueAfterSellingFeesGs,
    decimal RealizedProfitGs,
    decimal RealizedMarginPercent,
    decimal MaterialVarianceGs,
    decimal EnergyVarianceGs,
    decimal MachineVarianceGs,
    decimal TotalCostVarianceGs,
    decimal ProfitVarianceGs,
    decimal MarginVariancePercentagePoints);

public sealed record PrintJobRecord(
    Guid Id,
    Guid? QuoteId,
    Guid PrinterId,
    string Code,
    PrintJobStatus Status,
    DateTimeOffset CreatedAt,
    DateTimeOffset? StartedAt,
    DateTimeOffset? CompletedAt,
    QuoteRevisionRecord Estimate,
    CompleteJobRequest? ActualInput,
    ActualCostResult? ActualResult,
    PrintJobActualDetails? ActualDetails = null);

public sealed record ActualMaterialCostLine(
    Guid SpoolId,
    decimal Grams,
    decimal CostPerGramGs,
    decimal CostGs);

public sealed record ActualLaborCostLine(
    string Category,
    decimal Minutes,
    decimal HourlyRateGs,
    decimal CostGs);

public sealed record ActualAdditionalCostLine(
    string Description,
    decimal AmountGs,
    bool IsInternalCost,
    bool ParticipatesInMargin);

public sealed record PrintJobActualDetails(
    IReadOnlyList<ActualMaterialCostLine> Materials,
    IReadOnlyList<ActualLaborCostLine> Labor,
    IReadOnlyList<ActualAdditionalCostLine> AdditionalCosts);

public sealed record PrintJobSummary(Guid Id, string Code, PrintJobStatus Status, DateTimeOffset CreatedAt, decimal EstimatedTotalGs, decimal? ActualCostGs);
