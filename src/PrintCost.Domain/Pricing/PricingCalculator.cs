namespace PrintCost.Domain.Pricing;

public static class PricingCalculator
{
    public static QuoteCalculationResult Calculate(QuoteCalculationInput input)
    {
        ArgumentNullException.ThrowIfNull(input);
        input.Quantity.Validate();
        var multiplier = input.Quantity.VariableMultiplier;
        var warnings = new List<string>();

        var materialResults = input.Materials.Select(material => CalculateMaterial(material, multiplier)).ToArray();
        var materialCost = materialResults.Sum(x => x.CostGs);
        var energy = CalculateEnergy(input.Energy, multiplier);
        var machine = CalculateMachine(input.Machine, multiplier);
        if (!machine.IsConfigured)
        {
            warnings.Add("El costo horario de la impresora no está configurado.");
        }

        var laborCost = input.Labor.Sum(line => CalculateScopedCost(line.Minutes / 60m * line.HourlyRateGs, line.Scope, input.Quantity));
        var repeatableLabor = input.Labor.Where(x => x.RepeatOnFailure)
            .Sum(line => CalculateScopedCost(line.Minutes / 60m * line.HourlyRateGs, line.Scope, input.Quantity));
        var additionalCost = input.AdditionalCosts.Sum(line => CalculateScopedCost(line.AmountGs, line.Scope, input.Quantity));
        var repeatableAdditional = input.AdditionalCosts.Where(x => x.RepeatOnFailure)
            .Sum(line => CalculateScopedCost(line.AmountGs, line.Scope, input.Quantity));

        EnsureNonNegative(laborCost, nameof(laborCost));
        EnsureNonNegative(additionalCost, nameof(additionalCost));

        var directCost = materialCost + energy.CostGs + machine.CostGs + laborCost + additionalCost;
        var failureEligibleCost = materialCost + energy.CostGs + machine.CostGs + repeatableLabor + repeatableAdditional;
        var (expectedAttempts, failureReserve) = CalculateFailure(input.Failure, failureEligibleCost);
        var productionBeforeOverhead = directCost + failureReserve;
        EnsurePercent(input.Overhead.Percentage, nameof(input.Overhead.Percentage));
        var percentageOverhead = productionBeforeOverhead * input.Overhead.Percentage / 100m;
        var hourlyRate = input.Overhead.MonthlyOverheadGs == 0m
            ? 0m
            : Divide(input.Overhead.MonthlyOverheadGs, input.Overhead.ExpectedMonthlyProductiveHours, "Las horas productivas mensuales deben ser mayores que cero.");
        var hourlyOverhead = hourlyRate * machine.TotalOccupiedHours;
        var totalOverhead = input.Overhead.FixedPerOrderGs + percentageOverhead + hourlyOverhead;
        var fullyLoaded = productionBeforeOverhead + totalOverhead;

        var pricing = CalculatePricing(fullyLoaded, input.Pricing, warnings);
        var tax = CalculateTax(pricing.FinalPrice, input.Tax);
        var unitCost = fullyLoaded / input.Quantity.Quantity;
        var unitPrice = pricing.FinalPrice / input.Quantity.Quantity;

        return new QuoteCalculationResult(
            input.Quantity.Quantity,
            input.Quantity.NumberOfPlates,
            materialCost,
            materialResults,
            energy,
            machine,
            laborCost,
            additionalCost,
            directCost,
            failureEligibleCost,
            expectedAttempts,
            failureReserve,
            percentageOverhead,
            hourlyRate,
            hourlyOverhead,
            totalOverhead,
            fullyLoaded,
            pricing.RequiredPrice,
            pricing.MinimumMarginPrice,
            pricing.SuggestedPrice,
            pricing.FinalPrice,
            pricing.VariableFee,
            pricing.NetRevenue,
            pricing.Profit,
            pricing.FinalPrice == 0m ? 0m : pricing.Profit / pricing.FinalPrice * 100m,
            fullyLoaded == 0m ? 0m : pricing.Profit / fullyLoaded * 100m,
            tax.Tax,
            tax.Total,
            unitCost,
            unitPrice,
            warnings);
    }

    public static MaterialCostResult CalculateMaterial(MaterialCostInput input, int multiplier = 1)
    {
        if (multiplier <= 0) throw new DomainValidationException("El multiplicador debe ser mayor que cero.");
        EnsureNonNegative(input.PurchaseAmount, nameof(input.PurchaseAmount));
        EnsureNonNegative(input.AllocatedShippingGs, nameof(input.AllocatedShippingGs));
        EnsureNonNegative(input.AllocatedImportFeesGs, nameof(input.AllocatedImportFeesGs));
        EnsureNonNegative(input.AllocatedOtherCostsGs, nameof(input.AllocatedOtherCostsGs));
        if (input.NetFilamentWeightGrams <= 0m) throw new DomainValidationException("El peso neto debe ser mayor que cero.");

        var purchaseCost = string.Equals(input.Currency, "PYG", StringComparison.OrdinalIgnoreCase)
            ? input.PurchaseAmount
            : input.PurchaseAmount * (input.ExchangeRateGs is > 0m
                ? input.ExchangeRateGs.Value
                : throw new DomainValidationException("El tipo de cambio debe ser mayor que cero para monedas distintas de PYG."));
        var landedCost = purchaseCost + input.AllocatedShippingGs + input.AllocatedImportFeesGs + input.AllocatedOtherCostsGs;
        var costPerGram = landedCost / input.NetFilamentWeightGrams;
        var detailed = input.ModelGrams + input.SupportGrams + input.PurgeGrams + input.PrimeTowerGrams + input.AdhesionGrams + input.OtherWasteGrams;
        var chargeable = input.SlicerTotalGrams ?? (input.BaseGrams is not null
            ? input.BaseGrams.Value * (1m + input.WastePercent / 100m)
            : detailed);
        if (input.WastePercentIsAdditional && input.BaseGrams is null)
        {
            chargeable *= 1m + input.WastePercent / 100m;
        }

        EnsurePercent(input.WastePercent, nameof(input.WastePercent), allowOverHundred: true);
        EnsureNonNegative(chargeable, "chargeableGrams");
        var totalGrams = chargeable * multiplier;
        return new MaterialCostResult(input.SpoolId, purchaseCost, landedCost, costPerGram, chargeable, totalGrams, costPerGram * totalGrams);
    }

    public static EnergyCostResult CalculateEnergy(EnergyCostInput input, int multiplier = 1)
    {
        EnsureNonNegative(input.PrintDurationHours, nameof(input.PrintDurationHours));
        EnsureNonNegative(input.AveragePrintPowerW, nameof(input.AveragePrintPowerW));
        EnsureNonNegative(input.IdleDurationHours, nameof(input.IdleDurationHours));
        EnsureNonNegative(input.IdlePowerW, nameof(input.IdlePowerW));
        EnsureNonNegative(input.ConfiguredWarmupKWh, nameof(input.ConfiguredWarmupKWh));
        EnsureNonNegative(input.AccessoryKWh, nameof(input.AccessoryKWh));
        EnsureNonNegative(input.BaseRateGsPerKWh, nameof(input.BaseRateGsPerKWh));
        EnsurePercent(input.AdditionalChargesPercent, nameof(input.AdditionalChargesPercent), allowOverHundred: true);
        if (input.MeasuredKWh is < 0m) throw new DomainValidationException("MeasuredKWh no puede ser negativo.");

        var estimated = input.PrintDurationHours * input.AveragePrintPowerW / 1000m
            + input.IdleDurationHours * input.IdlePowerW / 1000m
            + input.ConfiguredWarmupKWh
            + input.AccessoryKWh;
        var usedMeasured = input.MeasuredKWh is not null;
        var kWh = (input.MeasuredKWh ?? estimated) * multiplier;
        var effectiveRate = input.ExplicitEffectiveRateGsPerKWh
            ?? input.BaseRateGsPerKWh * (1m + input.AdditionalChargesPercent / 100m);
        EnsureNonNegative(effectiveRate, "effectiveRateGsPerKWh");
        return new EnergyCostResult(estimated, kWh, usedMeasured, effectiveRate, kWh * effectiveRate, input.MaxPowerW);
    }

    public static MachineCostResult CalculateMachine(MachineCostInput input, int multiplier = 1)
    {
        EnsureNonNegative(input.OccupiedPrinterHours, nameof(input.OccupiedPrinterHours));
        decimal? rate = input.Mode switch
        {
            MachineCostMode.UsefulLifeDepreciation when input.PurchaseCostGs is not null && input.UsefulLifeHours is > 0m =>
                Math.Max(input.PurchaseCostGs.Value - input.ResidualValueGs, 0m) / input.UsefulLifeHours.Value
                + input.ExpectedLifetimeRepairCostGs / input.UsefulLifeHours.Value
                + input.MaintenanceReserveGsPerHour,
            MachineCostMode.TargetRecoveryPeriod when input.PurchaseCostGs is not null && input.RecoveryYears is > 0m && input.BusinessDaysPerYear is > 0m && input.PlannedBillableHoursPerDay is > 0m =>
                Math.Max(input.PurchaseCostGs.Value - input.ResidualValueGs, 0m)
                / (input.RecoveryYears.Value * input.BusinessDaysPerYear.Value * input.PlannedBillableHoursPerDay.Value)
                + input.RepairReserveGsPerHour
                + input.MaintenanceReserveGsPerHour,
            MachineCostMode.ManualHourlyRate when input.ManualHourlyRateGs is >= 0m => input.ManualHourlyRateGs.Value,
            _ => null
        };

        if (rate is < 0m) throw new DomainValidationException("El costo horario no puede ser negativo.");
        var zeroAccepted = input.ExplicitlyAcceptedZeroRate && !string.IsNullOrWhiteSpace(input.ZeroRateReason);
        var configured = rate is > 0m || zeroAccepted;
        var hours = input.OccupiedPrinterHours * multiplier;
        return new MachineCostResult(rate ?? 0m, hours, hours * (rate ?? 0m), configured);
    }

    public static decimal CalculateEmpiricalAveragePower(decimal measuredKWh, decimal occupiedHours)
    {
        EnsureNonNegative(measuredKWh, nameof(measuredKWh));
        return Divide(measuredKWh, occupiedHours, "OccupiedHours debe ser mayor que cero.") * 1000m;
    }

    private static decimal CalculateScopedCost(decimal baseCost, CostScope scope, QuantityPlan quantity) => scope switch
    {
        CostScope.FixedPerOrder or CostScope.FixedPerQuoteLine => baseCost,
        CostScope.PerPlate => baseCost * quantity.NumberOfPlates,
        CostScope.PerUnit => baseCost * quantity.Quantity,
        _ => throw new DomainValidationException("Alcance de costo inválido.")
    };

    private static (decimal ExpectedAttempts, decimal Reserve) CalculateFailure(FailureReserveInput input, decimal eligibleCost)
    {
        return input.Mode switch
        {
            FailureReserveMode.ExpectedAttempts when input.FailureProbability is >= 0m and <= 0.95m =>
                (1m / (1m - input.FailureProbability), eligibleCost * (1m / (1m - input.FailureProbability) - 1m)),
            FailureReserveMode.ExpectedAttempts => throw new DomainValidationException("FailureProbability debe estar entre 0 y 0.95."),
            FailureReserveMode.SimplePercentage when input.SimpleReservePercent >= 0m =>
                (1m, (input.SimpleBaseCostGs ?? eligibleCost) * input.SimpleReservePercent / 100m),
            _ => throw new DomainValidationException("La reserva simple no puede ser negativa.")
        };
    }

    private static (decimal RequiredPrice, decimal MinimumMarginPrice, decimal SuggestedPrice, decimal FinalPrice, decimal VariableFee, decimal NetRevenue, decimal Profit)
        CalculatePricing(decimal fullyLoaded, PricingInput input, List<string> warnings)
    {
        EnsurePercent(input.TargetMarginPercent, nameof(input.TargetMarginPercent));
        EnsurePercent(input.MinimumMarginPercent, nameof(input.MinimumMarginPercent));
        EnsurePercent(input.VariableSellingFeePercent, nameof(input.VariableSellingFeePercent));
        var targetRate = input.TargetMarginPercent / 100m;
        var minimumRate = input.MinimumMarginPercent / 100m;
        var feeRate = input.VariableSellingFeePercent / 100m;
        if (targetRate + feeRate >= 1m) throw new DomainValidationException("Margen objetivo más comisión variable debe ser menor que 100%. ");
        if (minimumRate + feeRate >= 1m) throw new DomainValidationException("Margen mínimo más comisión variable debe ser menor que 100%. ");
        if (input.RoundingIncrementGs < 0m) throw new DomainValidationException("El incremento de redondeo no puede ser negativo.");

        var required = (fullyLoaded + input.FixedSellingFeeGs) / (1m - targetRate - feeRate);
        var minimum = (fullyLoaded + input.FixedSellingFeeGs) / (1m - minimumRate - feeRate);
        var afterSurcharges = required + input.FixedSurchargesGs + required * input.PercentageSurchargePercent / 100m;
        var beforeRounding = Math.Max(afterSurcharges - input.DiscountGs, input.MinimumOrderGs);
        var suggested = ApplyRounding(beforeRounding, input.RoundingIncrementGs, input.RoundUp);
        var final = input.ManualNetPriceGs ?? suggested;
        if (input.ManualNetPriceGs is not null && string.IsNullOrWhiteSpace(input.ManualPriceReason))
            throw new DomainValidationException("Un precio manual requiere motivo.");
        if (final < fullyLoaded) warnings.Add("El precio final está por debajo del costo completo.");
        if (final < minimum) warnings.Add("El precio final está por debajo del margen mínimo configurado.");
        var variableFee = final * feeRate;
        var netRevenue = final - variableFee - input.FixedSellingFeeGs;
        return (required, minimum, suggested, final, variableFee, netRevenue, netRevenue - fullyLoaded);
    }

    private static (decimal Tax, decimal Total) CalculateTax(decimal finalPrice, TaxInput input)
    {
        if (!input.Enabled) return (0m, finalPrice);
        EnsurePercent(input.RatePercent, nameof(input.RatePercent), allowOverHundred: true);
        if (input.PriceIncludesTax)
        {
            var divisor = 1m + input.RatePercent / 100m;
            var tax = finalPrice - finalPrice / divisor;
            return (tax, finalPrice);
        }

        var addedTax = finalPrice * input.RatePercent / 100m;
        return (addedTax, finalPrice + addedTax);
    }

    private static decimal ApplyRounding(decimal value, decimal increment, bool roundUp)
    {
        if (increment == 0m) return value;
        var units = value / increment;
        return (roundUp ? Math.Ceiling(units) : Math.Round(units, 0, MidpointRounding.AwayFromZero)) * increment;
    }

    private static decimal Divide(decimal numerator, decimal denominator, string message) => denominator > 0m
        ? numerator / denominator
        : throw new DomainValidationException(message);

    private static void EnsureNonNegative(decimal value, string name)
    {
        if (value < 0m) throw new DomainValidationException($"{name} no puede ser negativo.");
    }

    private static void EnsurePercent(decimal value, string name, bool allowOverHundred = false)
    {
        if (value < 0m || (!allowOverHundred && value > 100m))
            throw new DomainValidationException($"{name} contiene un porcentaje inválido.");
    }
}
