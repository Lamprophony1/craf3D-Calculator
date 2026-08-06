namespace PrintCost.Domain.Pricing;

public enum MachineCostMode
{
    UsefulLifeDepreciation,
    TargetRecoveryPeriod,
    ManualHourlyRate
}

public enum FailureReserveMode
{
    ExpectedAttempts,
    SimplePercentage
}

public enum CostScope
{
    FixedPerOrder,
    FixedPerQuoteLine,
    PerPlate,
    PerUnit
}

public enum QuantityInputBasis
{
    PerUnit,
    PerPlate
}

