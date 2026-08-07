using PrintCost.Domain.Pricing;

namespace PrintCost.Application.Catalogs;

public sealed record PrinterSnapshot(
    Guid Id,
    string Name,
    string Manufacturer,
    string Model,
    decimal Voltage,
    MachineCostMode MachineCostMode,
    decimal? PurchaseCostGs,
    decimal ResidualValueGs,
    decimal? UsefulLifeHours,
    decimal ExpectedLifetimeRepairCostGs,
    decimal MaintenanceReserveGsPerHour,
    decimal? RecoveryYears,
    decimal? BusinessDaysPerYear,
    decimal? PlannedBillableHoursPerDay,
    decimal RepairReserveGsPerHour,
    decimal? ManualHourlyRateGs,
    bool IsActive);

public sealed record EnergyProfileSnapshot(
    Guid Id,
    Guid PrinterId,
    string Name,
    string MaterialFamily,
    decimal AveragePrintPowerW,
    decimal IdlePowerW,
    decimal MaxPowerW,
    decimal WarmupKWh,
    decimal AccessoryKWh,
    string? SourceName,
    DateOnly? VerifiedAt,
    bool IsActive);

public sealed record ElectricityTariffSnapshot(
    Guid Id,
    string Provider,
    string Name,
    string Category,
    decimal BaseRateGsPerKWh,
    bool ExcludesTax,
    decimal AdditionalChargesPercent,
    decimal? ExplicitEffectiveRateGsPerKWh,
    string? SourceName,
    DateOnly? VerifiedAt,
    bool IsActive);

public sealed record FilamentSnapshot(
    Guid Id,
    string Manufacturer,
    string ProductName,
    string Material,
    string Color,
    string? BatchCode,
    string PurchaseCurrency,
    decimal PurchaseAmount,
    decimal? ExchangeRateGs,
    decimal AllocatedShippingGs,
    decimal AllocatedImportFeesGs,
    decimal AllocatedOtherCostsGs,
    decimal NetWeightGrams,
    decimal RemainingWeightGrams,
    bool IsInventoryTracked,
    bool IsActive);

public sealed record PricingPolicySnapshot(
    Guid Id,
    string Name,
    decimal TargetMarginPercent,
    decimal MinimumMarginPercent,
    decimal MinimumOrderGs,
    decimal RoundingIncrementGs,
    bool RoundUp,
    FailureReserveMode FailureMode,
    decimal FailureProbability,
    decimal SimpleFailureReservePercent,
    decimal FixedOverheadPerOrderGs,
    decimal OverheadPercent,
    decimal MonthlyOverheadGs,
    decimal ExpectedMonthlyProductiveHours,
    decimal? DefaultLaborRateGsPerHour,
    decimal VariableSellingFeePercent,
    decimal FixedSellingFeeGs,
    bool IsDefault,
    bool IsActive);

public sealed record ApplicationSettingsSnapshot(
    Guid Id,
    string VisibleAppName,
    string TimeZone,
    string? ProductionHostname,
    bool TaxEnabled,
    string? TaxName,
    decimal TaxRatePercent,
    bool PriceIncludesTax,
    Guid? DefaultPrinterId,
    Guid? DefaultElectricityTariffId,
    Guid? DefaultPricingPolicyId,
    decimal? DefaultQuickSetupMinutes,
    decimal? DefaultQuickPackagingCostGs,
    int RecommendedDefaultsVersion = 0,
    Guid? DefaultEnergyProfileId = null);
