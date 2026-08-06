using PrintCost.Domain.Pricing;

namespace PrintCost.Infrastructure.Persistence.Entities;

public sealed class AppUserEntity
{
    public Guid Id { get; set; }
    public string Username { get; set; } = string.Empty;
    public string DisplayName { get; set; } = string.Empty;
    public string Role { get; set; } = "Owner";
    public bool IsActive { get; set; } = true;
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
    public AuthCredentialEntity? Credential { get; set; }
}

public sealed class AuthCredentialEntity
{
    public Guid UserId { get; set; }
    public string PinHash { get; set; } = string.Empty;
    public int FailedAttemptCount { get; set; }
    public DateTimeOffset? LockedUntil { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
    public AppUserEntity User { get; set; } = null!;
}

public sealed class PrinterEntity
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Manufacturer { get; set; } = string.Empty;
    public string Model { get; set; } = string.Empty;
    public decimal Voltage { get; set; }
    public MachineCostMode MachineCostMode { get; set; }
    public decimal? PurchaseCostGs { get; set; }
    public decimal ResidualValueGs { get; set; }
    public decimal? UsefulLifeHours { get; set; }
    public decimal ExpectedLifetimeRepairCostGs { get; set; }
    public decimal MaintenanceReserveGsPerHour { get; set; }
    public decimal? RecoveryYears { get; set; }
    public decimal? BusinessDaysPerYear { get; set; }
    public decimal? PlannedBillableHoursPerDay { get; set; }
    public decimal RepairReserveGsPerHour { get; set; }
    public decimal? ManualHourlyRateGs { get; set; }
    public bool IsActive { get; set; } = true;
    public List<EnergyProfileEntity> EnergyProfiles { get; set; } = [];
}

public sealed class EnergyProfileEntity
{
    public Guid Id { get; set; }
    public Guid PrinterId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string MaterialFamily { get; set; } = string.Empty;
    public decimal AveragePrintPowerW { get; set; }
    public decimal IdlePowerW { get; set; }
    public decimal MaxPowerW { get; set; }
    public decimal WarmupKWh { get; set; }
    public decimal AccessoryKWh { get; set; }
    public string? SourceName { get; set; }
    public DateOnly? VerifiedAt { get; set; }
    public DateOnly? EffectiveFrom { get; set; }
    public DateOnly? EffectiveTo { get; set; }
    public bool IsActive { get; set; } = true;
    public PrinterEntity Printer { get; set; } = null!;
}

public sealed class ElectricityTariffEntity
{
    public Guid Id { get; set; }
    public string Provider { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Category { get; set; } = string.Empty;
    public decimal BaseRateGsPerKWh { get; set; }
    public bool ExcludesTax { get; set; }
    public decimal AdditionalChargesPercent { get; set; }
    public decimal? ExplicitEffectiveRateGsPerKWh { get; set; }
    public string? SourceName { get; set; }
    public DateOnly? VerifiedAt { get; set; }
    public DateOnly? EffectiveFrom { get; set; }
    public DateOnly? EffectiveTo { get; set; }
    public bool IsActive { get; set; } = true;
}

public sealed class FilamentSpoolEntity
{
    public Guid Id { get; set; }
    public string Manufacturer { get; set; } = string.Empty;
    public string ProductName { get; set; } = string.Empty;
    public string Material { get; set; } = string.Empty;
    public string Color { get; set; } = string.Empty;
    public string? BatchCode { get; set; }
    public string PurchaseCurrency { get; set; } = "PYG";
    public decimal PurchaseAmount { get; set; }
    public decimal? ExchangeRateGs { get; set; }
    public decimal AllocatedShippingGs { get; set; }
    public decimal AllocatedImportFeesGs { get; set; }
    public decimal AllocatedOtherCostsGs { get; set; }
    public decimal LandedCostGs { get; set; }
    public decimal NetWeightGrams { get; set; }
    public decimal RemainingWeightGrams { get; set; }
    public DateOnly? PurchasedAt { get; set; }
    public string? Supplier { get; set; }
    public bool IsInventoryTracked { get; set; } = true;
    public bool IsActive { get; set; } = true;
    public List<InventoryMovementEntity> Movements { get; set; } = [];
}

public sealed class InventoryMovementEntity
{
    public Guid Id { get; set; }
    public Guid SpoolId { get; set; }
    public string Type { get; set; } = string.Empty;
    public decimal Grams { get; set; }
    public string? ReferenceType { get; set; }
    public Guid? ReferenceId { get; set; }
    public string Reason { get; set; } = string.Empty;
    public Guid CreatedBy { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public FilamentSpoolEntity Spool { get; set; } = null!;
}

public sealed class PricingPolicyEntity
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public decimal TargetMarginPercent { get; set; }
    public decimal MinimumMarginPercent { get; set; }
    public decimal MinimumOrderGs { get; set; }
    public decimal RoundingIncrementGs { get; set; }
    public bool RoundUp { get; set; }
    public FailureReserveMode FailureMode { get; set; }
    public decimal FailureProbability { get; set; }
    public decimal SimpleFailureReservePercent { get; set; }
    public decimal FixedOverheadPerOrderGs { get; set; }
    public decimal OverheadPercent { get; set; }
    public decimal MonthlyOverheadGs { get; set; }
    public decimal ExpectedMonthlyProductiveHours { get; set; }
    public decimal? DefaultLaborRateGsPerHour { get; set; }
    public decimal VariableSellingFeePercent { get; set; }
    public decimal FixedSellingFeeGs { get; set; }
    public bool IsDefault { get; set; }
    public DateOnly? EffectiveFrom { get; set; }
    public DateOnly? EffectiveTo { get; set; }
    public bool IsActive { get; set; } = true;
}

public sealed class CustomerEntity
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Phone { get; set; }
    public string? Email { get; set; }
    public string? Notes { get; set; }
    public bool IsActive { get; set; } = true;
}

public sealed class ProductTemplateEntity
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public Guid? DefaultPrinterId { get; set; }
    public Guid? DefaultEnergyProfileId { get; set; }
    public string? DefaultQuantityData { get; set; }
    public string? DefaultLaborLines { get; set; }
    public string? DefaultCostLines { get; set; }
    public bool IsActive { get; set; } = true;
}

public sealed class ApplicationSettingEntity
{
    public Guid Id { get; set; }
    public string VisibleAppName { get; set; } = "Calculadora 3D";
    public string TimeZone { get; set; } = "America/Asuncion";
    public string? ProductionHostname { get; set; }
    public bool TaxEnabled { get; set; }
    public string? TaxName { get; set; }
    public decimal TaxRatePercent { get; set; }
    public bool PriceIncludesTax { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
}

