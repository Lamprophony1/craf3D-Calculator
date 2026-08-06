namespace PrintCost.Domain.Pricing;

public sealed record QuantityPlan(
    int Quantity = 1,
    int UnitsPerPlate = 1,
    QuantityInputBasis InputBasis = QuantityInputBasis.PerUnit)
{
    public int NumberOfPlates => UnitsPerPlate <= 0
        ? throw new DomainValidationException("UnitsPerPlate debe ser mayor que cero.")
        : (int)Math.Ceiling(Quantity / (decimal)UnitsPerPlate);

    public int VariableMultiplier => InputBasis == QuantityInputBasis.PerUnit ? Quantity : NumberOfPlates;

    public void Validate()
    {
        if (Quantity <= 0) throw new DomainValidationException("Quantity debe ser mayor que cero.");
        if (UnitsPerPlate <= 0) throw new DomainValidationException("UnitsPerPlate debe ser mayor que cero.");
    }
}

public sealed record MaterialCostInput(
    Guid? SpoolId,
    string Currency,
    decimal PurchaseAmount,
    decimal? ExchangeRateGs,
    decimal AllocatedShippingGs,
    decimal AllocatedImportFeesGs,
    decimal AllocatedOtherCostsGs,
    decimal NetFilamentWeightGrams,
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

public sealed record EnergyCostInput(
    decimal PrintDurationHours,
    decimal AveragePrintPowerW,
    decimal IdleDurationHours,
    decimal IdlePowerW,
    decimal MaxPowerW,
    decimal ConfiguredWarmupKWh,
    decimal AccessoryKWh,
    decimal? MeasuredKWh,
    decimal BaseRateGsPerKWh,
    decimal AdditionalChargesPercent,
    decimal? ExplicitEffectiveRateGsPerKWh);

public sealed record MachineCostInput(
    MachineCostMode Mode,
    decimal OccupiedPrinterHours,
    decimal? PurchaseCostGs = null,
    decimal ResidualValueGs = 0,
    decimal? UsefulLifeHours = null,
    decimal ExpectedLifetimeRepairCostGs = 0,
    decimal MaintenanceReserveGsPerHour = 0,
    decimal? RecoveryYears = null,
    decimal? BusinessDaysPerYear = null,
    decimal? PlannedBillableHoursPerDay = null,
    decimal RepairReserveGsPerHour = 0,
    decimal? ManualHourlyRateGs = null,
    bool ExplicitlyAcceptedZeroRate = false,
    string? ZeroRateReason = null);

public sealed record LaborCostInput(
    string Category,
    decimal Minutes,
    decimal HourlyRateGs,
    CostScope Scope,
    bool RepeatOnFailure = false);

public sealed record AdditionalCostInput(
    string Description,
    decimal AmountGs,
    CostScope Scope,
    bool RepeatOnFailure = false,
    bool IsInternalCost = true,
    bool ParticipatesInMargin = true);

public sealed record FailureReserveInput(
    FailureReserveMode Mode,
    decimal FailureProbability = 0,
    decimal SimpleReservePercent = 0,
    decimal? SimpleBaseCostGs = null);

public sealed record OverheadInput(
    decimal FixedPerOrderGs = 0,
    decimal Percentage = 0,
    decimal MonthlyOverheadGs = 0,
    decimal ExpectedMonthlyProductiveHours = 0);

public sealed record PricingInput(
    decimal TargetMarginPercent,
    decimal MinimumMarginPercent,
    decimal MinimumOrderGs,
    decimal RoundingIncrementGs,
    bool RoundUp,
    decimal VariableSellingFeePercent = 0,
    decimal FixedSellingFeeGs = 0,
    decimal FixedSurchargesGs = 0,
    decimal PercentageSurchargePercent = 0,
    decimal DiscountGs = 0,
    decimal? ManualNetPriceGs = null,
    string? ManualPriceReason = null);

public sealed record TaxInput(
    bool Enabled = false,
    string? Name = null,
    decimal RatePercent = 0,
    bool PriceIncludesTax = false);

public sealed record QuoteCalculationInput(
    QuantityPlan Quantity,
    IReadOnlyList<MaterialCostInput> Materials,
    EnergyCostInput Energy,
    MachineCostInput Machine,
    IReadOnlyList<LaborCostInput> Labor,
    IReadOnlyList<AdditionalCostInput> AdditionalCosts,
    FailureReserveInput Failure,
    OverheadInput Overhead,
    PricingInput Pricing,
    TaxInput Tax);

public sealed record MaterialCostResult(
    Guid? SpoolId,
    decimal PurchaseCostGs,
    decimal LandedCostGs,
    decimal CostPerGramGs,
    decimal ChargeableGramsPerBasis,
    decimal TotalChargeableGrams,
    decimal CostGs);

public sealed record EnergyCostResult(
    decimal EstimatedKWhPerBasis,
    decimal TotalKWh,
    bool UsedMeasuredKWh,
    decimal EffectiveRateGsPerKWh,
    decimal CostGs,
    decimal MaxPowerReferenceW);

public sealed record MachineCostResult(
    decimal HourlyRateGs,
    decimal TotalOccupiedHours,
    decimal CostGs,
    bool IsConfigured);

public sealed record QuoteCalculationResult(
    int Quantity,
    int NumberOfPlates,
    decimal MaterialCostGs,
    IReadOnlyList<MaterialCostResult> Materials,
    EnergyCostResult Energy,
    MachineCostResult Machine,
    decimal LaborCostGs,
    decimal AdditionalCostGs,
    decimal DirectCostGs,
    decimal FailureEligibleCostGs,
    decimal ExpectedAttempts,
    decimal FailureReserveGs,
    decimal PercentageOverheadGs,
    decimal HourlyOverheadRateGs,
    decimal HourlyOverheadGs,
    decimal TotalOverheadGs,
    decimal FullyLoadedCostGs,
    decimal RequiredNetPriceGs,
    decimal MinimumMarginPriceGs,
    decimal SuggestedNetPriceGs,
    decimal FinalNetSalePriceGs,
    decimal VariableSellingFeeGs,
    decimal NetRevenueAfterSellingFeesGs,
    decimal EstimatedProfitGs,
    decimal AchievedMarginPercent,
    decimal MarkupPercent,
    decimal TaxGs,
    decimal CustomerTotalGs,
    decimal UnitCostGs,
    decimal UnitPriceGs,
    IReadOnlyList<string> Warnings);

public sealed class DomainValidationException(string message) : Exception(message);

