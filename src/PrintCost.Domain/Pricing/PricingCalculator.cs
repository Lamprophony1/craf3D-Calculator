namespace PrintCost.Domain.Pricing;

public static class PricingCalculator
{
    public static QuoteCalculationResult Calculate(QuoteCalculationInput input)
    {
        ArgumentNullException.ThrowIfNull(input);
        var production = CalculateProduction(input);
        var aggregate = CalculateAggregate(new QuoteAggregateCalculationInput(
            [production],
            input.Failure,
            input.Overhead,
            input.Pricing,
            input.Tax));
        return CreateLineResult(production, aggregate, 0, input.Pricing, input.Tax);
    }

    public static ProductionCalculationResult CalculateProduction(QuoteCalculationInput input)
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

        foreach (var line in input.Labor)
        {
            EnsureNonNegative(line.Minutes, $"Labor[{line.Category}].Minutes");
            EnsureNonNegative(line.HourlyRateGs, $"Labor[{line.Category}].HourlyRateGs");
        }

        foreach (var line in input.AdditionalCosts)
        {
            EnsureNonNegative(line.AmountGs, $"AdditionalCosts[{line.Description}].AmountGs");
        }

        var scopedLabor = input.Labor.Select(line => new ScopedLaborCost(
            line,
            CalculateScopedCost(line.Minutes / 60m * line.HourlyRateGs, line.Scope, input.Quantity))).ToArray();
        var lineLaborCost = scopedLabor.Where(x => x.Input.Scope != CostScope.FixedPerOrder).Sum(x => x.AmountGs);
        var orderLaborCost = scopedLabor.Where(x => x.Input.Scope == CostScope.FixedPerOrder).Sum(x => x.AmountGs);
        var lineRepeatableLabor = scopedLabor
            .Where(x => x.Input.Scope != CostScope.FixedPerOrder && x.Input.RepeatOnFailure)
            .Sum(x => x.AmountGs);
        var orderRepeatableLabor = scopedLabor
            .Where(x => x.Input.Scope == CostScope.FixedPerOrder && x.Input.RepeatOnFailure)
            .Sum(x => x.AmountGs);

        var scopedAdditional = input.AdditionalCosts
            .Select(line => new ScopedAdditionalCost(
                line,
                CalculateScopedCost(line.AmountGs, line.Scope, input.Quantity)))
            .ToArray();
        var lineMarginBearingAdditional = scopedAdditional
            .Where(x => x.Input.Scope != CostScope.FixedPerOrder && x.Input.IsInternalCost && x.Input.ParticipatesInMargin)
            .Sum(x => x.AmountGs);
        var orderMarginBearingAdditional = scopedAdditional
            .Where(x => x.Input.Scope == CostScope.FixedPerOrder && x.Input.IsInternalCost && x.Input.ParticipatesInMargin)
            .Sum(x => x.AmountGs);
        var lineNonMarginInternalCost = scopedAdditional
            .Where(x => x.Input.Scope != CostScope.FixedPerOrder && x.Input.IsInternalCost && !x.Input.ParticipatesInMargin)
            .Sum(x => x.AmountGs);
        var orderNonMarginInternalCost = scopedAdditional
            .Where(x => x.Input.Scope == CostScope.FixedPerOrder && x.Input.IsInternalCost && !x.Input.ParticipatesInMargin)
            .Sum(x => x.AmountGs);
        var lineCustomerAdditionalCharge = scopedAdditional
            .Where(x => x.Input.Scope != CostScope.FixedPerOrder && !x.Input.IsInternalCost && x.Input.ParticipatesInMargin)
            .Sum(x => x.AmountGs);
        var orderCustomerAdditionalCharge = scopedAdditional
            .Where(x => x.Input.Scope == CostScope.FixedPerOrder && !x.Input.IsInternalCost && x.Input.ParticipatesInMargin)
            .Sum(x => x.AmountGs);
        var lineCustomerPassThrough = scopedAdditional
            .Where(x => x.Input.Scope != CostScope.FixedPerOrder && !x.Input.IsInternalCost && !x.Input.ParticipatesInMargin)
            .Sum(x => x.AmountGs);
        var orderCustomerPassThrough = scopedAdditional
            .Where(x => x.Input.Scope == CostScope.FixedPerOrder && !x.Input.IsInternalCost && !x.Input.ParticipatesInMargin)
            .Sum(x => x.AmountGs);
        var lineRepeatableAdditional = scopedAdditional
            .Where(x => x.Input.Scope != CostScope.FixedPerOrder && x.Input.IsInternalCost && x.Input.RepeatOnFailure)
            .Sum(x => x.AmountGs);
        var orderRepeatableAdditional = scopedAdditional
            .Where(x => x.Input.Scope == CostScope.FixedPerOrder && x.Input.IsInternalCost && x.Input.RepeatOnFailure)
            .Sum(x => x.AmountGs);

        var lineAdditionalCost = lineMarginBearingAdditional + lineNonMarginInternalCost;
        var orderAdditionalCost = orderMarginBearingAdditional + orderNonMarginInternalCost;
        var lineDirectCost = materialCost + energy.CostGs + machine.CostGs + lineLaborCost + lineAdditionalCost;
        var orderDirectCost = orderLaborCost + orderAdditionalCost;
        var lineFailureEligibleCost = materialCost + energy.CostGs + machine.CostGs
            + lineRepeatableLabor + lineRepeatableAdditional;
        var orderFailureEligibleCost = orderRepeatableLabor + orderRepeatableAdditional;

        return new ProductionCalculationResult(
            input.Quantity.Quantity,
            input.Quantity.NumberOfPlates,
            materialCost,
            materialResults,
            energy,
            machine,
            lineLaborCost,
            orderLaborCost,
            lineAdditionalCost,
            orderAdditionalCost,
            lineMarginBearingAdditional,
            orderMarginBearingAdditional,
            lineNonMarginInternalCost,
            orderNonMarginInternalCost,
            lineCustomerAdditionalCharge,
            orderCustomerAdditionalCharge,
            lineCustomerPassThrough,
            orderCustomerPassThrough,
            lineDirectCost,
            orderDirectCost,
            lineFailureEligibleCost,
            orderFailureEligibleCost,
            machine.TotalOccupiedHours,
            warnings);
    }

    public static QuoteAggregateBreakdown CalculateAggregate(QuoteAggregateCalculationInput input)
    {
        ArgumentNullException.ThrowIfNull(input);
        if (input.Lines.Count == 0) throw new DomainValidationException("La cotización requiere al menos una línea.");

        var warnings = input.Lines.SelectMany(x => x.Warnings).Distinct().ToList();
        var materialCost = input.Lines.Sum(x => x.MaterialCostGs);
        var energyCost = input.Lines.Sum(x => x.Energy.CostGs);
        var machineCost = input.Lines.Sum(x => x.Machine.CostGs);
        var laborCost = input.Lines.Sum(x => x.LineLaborCostGs + x.OrderLaborCostGs);
        var additionalCost = input.Lines.Sum(x => x.LineAdditionalCostGs + x.OrderAdditionalCostGs);
        var marginBearingAdditional = input.Lines.Sum(x => x.LineMarginBearingAdditionalCostGs + x.OrderMarginBearingAdditionalCostGs);
        var nonMarginInternalCost = input.Lines.Sum(x => x.LineNonMarginInternalCostGs + x.OrderNonMarginInternalCostGs);
        var customerAdditionalCharge = input.Lines.Sum(x => x.LineCustomerAdditionalChargeGs + x.OrderCustomerAdditionalChargeGs);
        var customerPassThrough = input.Lines.Sum(x => x.LineCustomerPassThroughGs + x.OrderCustomerPassThroughGs);
        var directCost = input.Lines.Sum(x => x.LineDirectCostGs + x.OrderDirectCostGs);
        var failureEligibleCost = input.Lines.Sum(x => x.LineFailureEligibleCostGs + x.OrderFailureEligibleCostGs);
        var (expectedAttempts, failureReserve) = CalculateFailure(input.Failure, failureEligibleCost);
        var productionBeforeOverhead = directCost + failureReserve;

        EnsureNonNegative(input.Overhead.FixedPerOrderGs, nameof(input.Overhead.FixedPerOrderGs));
        EnsureNonNegative(input.Overhead.MonthlyOverheadGs, nameof(input.Overhead.MonthlyOverheadGs));
        EnsureNonNegative(input.Overhead.ExpectedMonthlyProductiveHours, nameof(input.Overhead.ExpectedMonthlyProductiveHours));
        EnsurePercent(input.Overhead.Percentage, nameof(input.Overhead.Percentage));
        var percentageOverhead = productionBeforeOverhead * input.Overhead.Percentage / 100m;
        var hourlyRate = input.Overhead.MonthlyOverheadGs == 0m
            ? 0m
            : Divide(input.Overhead.MonthlyOverheadGs, input.Overhead.ExpectedMonthlyProductiveHours,
                "Las horas productivas mensuales deben ser mayores que cero.");
        var occupiedHours = input.Lines.Sum(x => x.TotalOccupiedPrinterHours);
        var hourlyOverhead = hourlyRate * occupiedHours;
        var totalOverhead = input.Overhead.FixedPerOrderGs + percentageOverhead + hourlyOverhead;
        var fullyLoaded = productionBeforeOverhead + totalOverhead;

        var pricing = CalculatePricing(
            fullyLoaded - nonMarginInternalCost,
            nonMarginInternalCost,
            customerAdditionalCharge,
            input.Pricing,
            input.Tax,
            warnings);
        var tax = CalculateTax(pricing.FinalPrice, input.Tax);

        // Included tax is extracted from the price. External tax is paid on top and
        // therefore never reduces the revenue available to the business.
        var revenueAvailable = pricing.FinalPrice - (input.Tax.Enabled && input.Tax.PriceIncludesTax ? tax.Tax : 0m);
        var variableFee = revenueAvailable * input.Pricing.VariableSellingFeePercent / 100m;
        var netRevenue = revenueAvailable - variableFee - input.Pricing.FixedSellingFeeGs;
        var profit = netRevenue - fullyLoaded;
        var marginRevenue = revenueAvailable - pricing.NonMarginRecoveryCharge;
        var customerTotal = tax.Total + customerPassThrough;

        var directWeights = input.Lines.Select((line, index) =>
            line.LineDirectCostGs + (index == 0 ? input.Lines.Sum(x => x.OrderDirectCostGs) : 0m)).ToArray();
        var failureWeights = input.Lines.Select((line, index) =>
            line.LineFailureEligibleCostGs + (index == 0 ? input.Lines.Sum(x => x.OrderFailureEligibleCostGs) : 0m)).ToArray();
        if (failureWeights.Sum() == 0m) failureWeights = directWeights;
        var failureAllocations = AllocateExact(failureReserve, failureWeights);
        var overheadWeights = directWeights.Select((x, index) => x + failureAllocations[index]).ToArray();
        var overheadAllocations = AllocateExact(totalOverhead, overheadWeights);
        var fullCosts = directWeights.Select((x, index) => x + failureAllocations[index] + overheadAllocations[index]).ToArray();
        var economicWeights = input.Lines.Select((line, index) => fullCosts[index]
            + line.LineCustomerAdditionalChargeGs
            + line.LineCustomerPassThroughGs
            + (index == 0
                ? input.Lines.Sum(x => x.OrderCustomerAdditionalChargeGs + x.OrderCustomerPassThroughGs)
                : 0m)).ToArray();
        if (economicWeights.Sum() == 0m) economicWeights = Enumerable.Repeat(1m, input.Lines.Count).ToArray();

        var requiredAllocations = AllocateExact(pricing.RequiredPrice, economicWeights);
        var minimumAllocations = AllocateExact(pricing.MinimumMarginPrice, economicWeights);
        var suggestedAllocations = AllocateExact(pricing.SuggestedPrice, economicWeights);
        var finalAllocations = AllocateExact(pricing.FinalPrice, economicWeights);
        var taxAllocations = AllocateExact(tax.Tax, economicWeights);
        var passThroughAllocations = input.Lines.Select((line, index) => line.LineCustomerPassThroughGs
            + (index == 0 ? input.Lines.Sum(x => x.OrderCustomerPassThroughGs) : 0m)).ToArray();
        var lineAllocations = input.Lines.Select((line, index) =>
        {
            var lineCustomerTotal = finalAllocations[index]
                + (input.Tax.Enabled && !input.Tax.PriceIncludesTax ? taxAllocations[index] : 0m)
                + passThroughAllocations[index];
            return new QuoteLineAllocation(
                directWeights[index],
                failureAllocations[index],
                overheadAllocations[index],
                fullCosts[index],
                requiredAllocations[index],
                minimumAllocations[index],
                suggestedAllocations[index],
                finalAllocations[index],
                taxAllocations[index],
                passThroughAllocations[index],
                lineCustomerTotal,
                line.Quantity == 0 ? 0m : lineCustomerTotal / line.Quantity);
        }).ToArray();

        return new QuoteAggregateBreakdown(
            materialCost, energyCost, machineCost, laborCost, additionalCost,
            marginBearingAdditional, nonMarginInternalCost, pricing.NonMarginRecoveryCharge,
            customerAdditionalCharge, customerPassThrough, directCost, failureEligibleCost,
            expectedAttempts, failureReserve, percentageOverhead, hourlyRate, hourlyOverhead,
            totalOverhead, fullyLoaded, pricing.RequiredPrice, pricing.MinimumMarginPrice,
            pricing.SuggestedPrice, pricing.FinalPrice, variableFee, netRevenue, revenueAvailable,
            profit, marginRevenue == 0m ? 0m : profit / marginRevenue * 100m,
            fullyLoaded == 0m ? 0m : profit / fullyLoaded * 100m, tax.Tax, customerTotal,
            occupiedHours, input.Lines.All(x => x.Machine.IsConfigured), warnings, lineAllocations);
    }

    public static QuoteCalculationResult CreateLineResult(
        ProductionCalculationResult production,
        QuoteAggregateBreakdown aggregate,
        int lineIndex,
        PricingInput pricingInput,
        TaxInput taxInput)
    {
        var allocation = aggregate.LineAllocations[lineIndex];
        var includeOrder = lineIndex == 0;
        var labor = production.LineLaborCostGs + (includeOrder ? production.OrderLaborCostGs : 0m);
        var additional = production.LineAdditionalCostGs + (includeOrder ? production.OrderAdditionalCostGs : 0m);
        var marginBearingAdditional = production.LineMarginBearingAdditionalCostGs
            + (includeOrder ? production.OrderMarginBearingAdditionalCostGs : 0m);
        var nonMarginInternal = production.LineNonMarginInternalCostGs
            + (includeOrder ? production.OrderNonMarginInternalCostGs : 0m);
        var customerAdditional = production.LineCustomerAdditionalChargeGs
            + (includeOrder ? production.OrderCustomerAdditionalChargeGs : 0m);
        var revenueAvailable = allocation.FinalNetSalePriceGs
            - (taxInput.Enabled && taxInput.PriceIncludesTax ? allocation.TaxGs : 0m);
        var variableFee = revenueAvailable * pricingInput.VariableSellingFeePercent / 100m;
        var fixedFee = includeOrder ? pricingInput.FixedSellingFeeGs : 0m;
        var netRevenue = revenueAvailable - variableFee - fixedFee;
        var profit = netRevenue - allocation.FullyLoadedCostGs;
        var nonMarginRecovery = aggregate.FinalNetSalePriceGs == 0m
            ? 0m
            : aggregate.NonMarginRecoveryChargeGs * allocation.FinalNetSalePriceGs / aggregate.FinalNetSalePriceGs;
        var marginRevenue = revenueAvailable - nonMarginRecovery;

        return new QuoteCalculationResult(
            production.Quantity, production.NumberOfPlates, production.MaterialCostGs,
            production.Materials, production.Energy, production.Machine, labor, additional,
            marginBearingAdditional, nonMarginInternal, nonMarginRecovery, customerAdditional,
            allocation.CustomerPassThroughGs, allocation.DirectCostGs,
            production.LineFailureEligibleCostGs + (includeOrder ? production.OrderFailureEligibleCostGs : 0m),
            aggregate.ExpectedAttempts, allocation.FailureReserveGs,
            aggregate.TotalOverheadGs == 0m ? 0m : aggregate.PercentageOverheadGs * allocation.OverheadGs / aggregate.TotalOverheadGs,
            aggregate.HourlyOverheadRateGs,
            aggregate.TotalOverheadGs == 0m ? 0m : aggregate.HourlyOverheadGs * allocation.OverheadGs / aggregate.TotalOverheadGs,
            allocation.OverheadGs, allocation.FullyLoadedCostGs, allocation.RequiredNetPriceGs,
            allocation.MinimumMarginPriceGs, allocation.SuggestedNetPriceGs,
            allocation.FinalNetSalePriceGs, variableFee, netRevenue, revenueAvailable, profit,
            marginRevenue == 0m ? 0m : profit / marginRevenue * 100m,
            allocation.FullyLoadedCostGs == 0m ? 0m : profit / allocation.FullyLoadedCostGs * 100m,
            allocation.TaxGs, allocation.CustomerTotalGs,
            allocation.FullyLoadedCostGs / production.Quantity, allocation.UnitPriceGs,
            aggregate.Warnings);
    }

    public static MaterialCostResult CalculateMaterial(MaterialCostInput input, int multiplier = 1)
    {
        if (multiplier <= 0) throw new DomainValidationException("El multiplicador debe ser mayor que cero.");
        EnsureNonNegative(input.PurchaseAmount, nameof(input.PurchaseAmount));
        EnsureNonNegative(input.AllocatedShippingGs, nameof(input.AllocatedShippingGs));
        EnsureNonNegative(input.AllocatedImportFeesGs, nameof(input.AllocatedImportFeesGs));
        EnsureNonNegative(input.AllocatedOtherCostsGs, nameof(input.AllocatedOtherCostsGs));
        if (input.NetFilamentWeightGrams <= 0m)
            throw new DomainValidationException("El peso neto debe ser mayor que cero.");

        EnsureNonNegative(input.ModelGrams, nameof(input.ModelGrams));
        EnsureNonNegative(input.SupportGrams, nameof(input.SupportGrams));
        EnsureNonNegative(input.PurgeGrams, nameof(input.PurgeGrams));
        EnsureNonNegative(input.PrimeTowerGrams, nameof(input.PrimeTowerGrams));
        EnsureNonNegative(input.AdhesionGrams, nameof(input.AdhesionGrams));
        EnsureNonNegative(input.OtherWasteGrams, nameof(input.OtherWasteGrams));
        EnsureNullableNonNegative(input.SlicerTotalGrams, nameof(input.SlicerTotalGrams));
        EnsureNullableNonNegative(input.BaseGrams, nameof(input.BaseGrams));
        EnsurePercent(input.WastePercent, nameof(input.WastePercent));

        var purchaseCost = string.Equals(input.Currency, "PYG", StringComparison.OrdinalIgnoreCase)
            ? input.PurchaseAmount
            : input.PurchaseAmount * (input.ExchangeRateGs is > 0m
                ? input.ExchangeRateGs.Value
                : throw new DomainValidationException("El tipo de cambio debe ser mayor que cero para monedas distintas de PYG."));
        var landedCost = purchaseCost + input.AllocatedShippingGs + input.AllocatedImportFeesGs + input.AllocatedOtherCostsGs;
        var costPerGram = landedCost / input.NetFilamentWeightGrams;
        var detailed = input.ModelGrams + input.SupportGrams + input.PurgeGrams + input.PrimeTowerGrams
            + input.AdhesionGrams + input.OtherWasteGrams;
        var chargeable = input.SlicerTotalGrams ?? (input.BaseGrams is not null
            ? input.BaseGrams.Value * (1m + input.WastePercent / 100m)
            : detailed);
        if (input.WastePercentIsAdditional && input.BaseGrams is null)
        {
            chargeable *= 1m + input.WastePercent / 100m;
        }

        var totalGrams = chargeable * multiplier;
        return new MaterialCostResult(
            input.SpoolId,
            purchaseCost,
            landedCost,
            costPerGram,
            chargeable,
            totalGrams,
            costPerGram * totalGrams);
    }

    public static EnergyCostResult CalculateEnergy(EnergyCostInput input, int multiplier = 1)
    {
        if (multiplier <= 0) throw new DomainValidationException("El multiplicador debe ser mayor que cero.");
        EnsureNonNegative(input.PrintDurationHours, nameof(input.PrintDurationHours));
        EnsureNonNegative(input.AveragePrintPowerW, nameof(input.AveragePrintPowerW));
        EnsureNonNegative(input.IdleDurationHours, nameof(input.IdleDurationHours));
        EnsureNonNegative(input.IdlePowerW, nameof(input.IdlePowerW));
        EnsureNonNegative(input.MaxPowerW, nameof(input.MaxPowerW));
        EnsureNonNegative(input.ConfiguredWarmupKWh, nameof(input.ConfiguredWarmupKWh));
        EnsureNonNegative(input.AccessoryKWh, nameof(input.AccessoryKWh));
        EnsureNullableNonNegative(input.MeasuredKWh, nameof(input.MeasuredKWh));
        EnsureNonNegative(input.BaseRateGsPerKWh, nameof(input.BaseRateGsPerKWh));
        EnsurePercent(input.AdditionalChargesPercent, nameof(input.AdditionalChargesPercent));
        EnsureNullableNonNegative(input.ExplicitEffectiveRateGsPerKWh, nameof(input.ExplicitEffectiveRateGsPerKWh));

        var estimated = input.PrintDurationHours * input.AveragePrintPowerW / 1000m
            + input.IdleDurationHours * input.IdlePowerW / 1000m
            + input.ConfiguredWarmupKWh
            + input.AccessoryKWh;
        var usedMeasured = input.MeasuredKWh is not null;
        var kWh = (input.MeasuredKWh ?? estimated) * multiplier;
        var effectiveRate = input.ExplicitEffectiveRateGsPerKWh
            ?? input.BaseRateGsPerKWh * (1m + input.AdditionalChargesPercent / 100m);
        return new EnergyCostResult(estimated, kWh, usedMeasured, effectiveRate, kWh * effectiveRate, input.MaxPowerW);
    }

    public static MachineCostResult CalculateMachine(MachineCostInput input, int multiplier = 1)
    {
        if (multiplier <= 0) throw new DomainValidationException("El multiplicador debe ser mayor que cero.");
        EnsureNonNegative(input.OccupiedPrinterHours, nameof(input.OccupiedPrinterHours));
        EnsureNullableNonNegative(input.PurchaseCostGs, nameof(input.PurchaseCostGs));
        EnsureNonNegative(input.ResidualValueGs, nameof(input.ResidualValueGs));
        EnsureNullablePositiveWhenProvided(input.UsefulLifeHours, nameof(input.UsefulLifeHours));
        EnsureNonNegative(input.ExpectedLifetimeRepairCostGs, nameof(input.ExpectedLifetimeRepairCostGs));
        EnsureNonNegative(input.MaintenanceReserveGsPerHour, nameof(input.MaintenanceReserveGsPerHour));
        EnsureNullablePositiveWhenProvided(input.RecoveryYears, nameof(input.RecoveryYears));
        EnsureNullablePositiveWhenProvided(input.BusinessDaysPerYear, nameof(input.BusinessDaysPerYear));
        EnsureNullablePositiveWhenProvided(input.PlannedBillableHoursPerDay, nameof(input.PlannedBillableHoursPerDay));
        EnsureNonNegative(input.RepairReserveGsPerHour, nameof(input.RepairReserveGsPerHour));
        EnsureNullableNonNegative(input.ManualHourlyRateGs, nameof(input.ManualHourlyRateGs));

        decimal? rate = input.Mode switch
        {
            MachineCostMode.UsefulLifeDepreciation when input.PurchaseCostGs is not null && input.UsefulLifeHours is not null =>
                Math.Max(input.PurchaseCostGs.Value - input.ResidualValueGs, 0m) / input.UsefulLifeHours.Value
                + input.ExpectedLifetimeRepairCostGs / input.UsefulLifeHours.Value
                + input.MaintenanceReserveGsPerHour,
            MachineCostMode.TargetRecoveryPeriod when input.PurchaseCostGs is not null
                && input.RecoveryYears is not null
                && input.BusinessDaysPerYear is not null
                && input.PlannedBillableHoursPerDay is not null =>
                Math.Max(input.PurchaseCostGs.Value - input.ResidualValueGs, 0m)
                / (input.RecoveryYears.Value * input.BusinessDaysPerYear.Value * input.PlannedBillableHoursPerDay.Value)
                + input.RepairReserveGsPerHour
                + input.MaintenanceReserveGsPerHour,
            MachineCostMode.ManualHourlyRate when input.ManualHourlyRateGs is not null => input.ManualHourlyRateGs.Value,
            _ => null
        };

        var zeroAccepted = rate == 0m
            && input.ExplicitlyAcceptedZeroRate
            && !string.IsNullOrWhiteSpace(input.ZeroRateReason);
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
        EnsureNullableNonNegative(input.SimpleBaseCostGs, nameof(input.SimpleBaseCostGs));
        return input.Mode switch
        {
            FailureReserveMode.ExpectedAttempts when input.FailureProbability is >= 0m and <= 0.95m =>
                (1m / (1m - input.FailureProbability), eligibleCost * (1m / (1m - input.FailureProbability) - 1m)),
            FailureReserveMode.ExpectedAttempts =>
                throw new DomainValidationException("FailureProbability debe estar entre 0 y 0.95."),
            FailureReserveMode.SimplePercentage when input.SimpleReservePercent is >= 0m and <= 100m =>
                (1m, (input.SimpleBaseCostGs ?? eligibleCost) * input.SimpleReservePercent / 100m),
            _ => throw new DomainValidationException("La reserva simple debe estar entre 0 y 100%.")
        };
    }

    private static PricingResult CalculatePricing(
        decimal marginBearingCost,
        decimal nonMarginInternalCost,
        decimal customerAdditionalCharge,
        PricingInput input,
        TaxInput tax,
        List<string> warnings)
    {
        EnsureNonNegative(marginBearingCost, nameof(marginBearingCost));
        EnsureNonNegative(nonMarginInternalCost, nameof(nonMarginInternalCost));
        EnsureNonNegative(customerAdditionalCharge, nameof(customerAdditionalCharge));
        EnsurePercent(input.TargetMarginPercent, nameof(input.TargetMarginPercent));
        EnsurePercent(input.MinimumMarginPercent, nameof(input.MinimumMarginPercent));
        EnsurePercent(input.VariableSellingFeePercent, nameof(input.VariableSellingFeePercent));
        EnsurePercent(input.PercentageSurchargePercent, nameof(input.PercentageSurchargePercent));
        EnsureNonNegative(input.MinimumOrderGs, nameof(input.MinimumOrderGs));
        EnsureNonNegative(input.RoundingIncrementGs, nameof(input.RoundingIncrementGs));
        EnsureNonNegative(input.FixedSellingFeeGs, nameof(input.FixedSellingFeeGs));
        EnsureNonNegative(input.FixedSurchargesGs, nameof(input.FixedSurchargesGs));
        EnsureNonNegative(input.DiscountGs, nameof(input.DiscountGs));
        EnsureNullableNonNegative(input.ManualNetPriceGs, nameof(input.ManualNetPriceGs));
        if (tax.Enabled) EnsurePercent(tax.RatePercent, nameof(tax.RatePercent));

        var targetRate = input.TargetMarginPercent / 100m;
        var minimumRate = input.MinimumMarginPercent / 100m;
        var feeRate = input.VariableSellingFeePercent / 100m;
        if (targetRate + feeRate >= 1m)
            throw new DomainValidationException("Margen objetivo más comisión variable debe ser menor que 100%.");
        if (minimumRate + feeRate >= 1m)
            throw new DomainValidationException("Margen mínimo más comisión variable debe ser menor que 100%.");

        var taxFactor = tax.Enabled && tax.PriceIncludesTax
            ? 1m + tax.RatePercent / 100m
            : 1m;
        var nonMarginRecovery = nonMarginInternalCost / (1m - feeRate);
        var requiredBeforeTax = (marginBearingCost + input.FixedSellingFeeGs) / (1m - targetRate - feeRate)
            + nonMarginRecovery
            + customerAdditionalCharge;
        var minimumBeforeTax = (marginBearingCost + input.FixedSellingFeeGs) / (1m - minimumRate - feeRate)
            + nonMarginRecovery
            + customerAdditionalCharge;
        var required = requiredBeforeTax * taxFactor;
        var minimum = minimumBeforeTax * taxFactor;
        var afterSurchargesBeforeTax = requiredBeforeTax
            + input.FixedSurchargesGs
            + requiredBeforeTax * input.PercentageSurchargePercent / 100m;
        var beforeRounding = Math.Max(afterSurchargesBeforeTax - input.DiscountGs, input.MinimumOrderGs) * taxFactor;
        var suggested = ApplyRounding(beforeRounding, input.RoundingIncrementGs, input.RoundUp);
        var final = input.ManualNetPriceGs ?? suggested;

        if (input.ManualNetPriceGs is not null && string.IsNullOrWhiteSpace(input.ManualPriceReason))
            throw new DomainValidationException("Un precio manual requiere motivo.");

        var finalBeforeTax = final / taxFactor;
        var fullyLoaded = marginBearingCost + nonMarginInternalCost;
        if (finalBeforeTax < fullyLoaded)
            warnings.Add("El precio final está por debajo del costo completo.");
        if (final < minimum)
            warnings.Add("El precio final está por debajo del margen mínimo configurado.");

        return new PricingResult(required, minimum, suggested, final, nonMarginRecovery);
    }

    private static (decimal Tax, decimal Total) CalculateTax(decimal finalPrice, TaxInput input)
    {
        if (!input.Enabled) return (0m, finalPrice);
        EnsurePercent(input.RatePercent, nameof(input.RatePercent));
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

    private static decimal[] AllocateExact(decimal total, IReadOnlyList<decimal> weights)
    {
        if (weights.Count == 0) return [];
        if (weights.Count == 1) return [total];

        var safeWeights = weights.Select(x => Math.Max(x, 0m)).ToArray();
        var weightTotal = safeWeights.Sum();
        if (weightTotal == 0m)
        {
            safeWeights = Enumerable.Repeat(1m, weights.Count).ToArray();
            weightTotal = safeWeights.Sum();
        }

        var result = new decimal[weights.Count];
        decimal allocated = 0m;
        for (var index = 0; index < weights.Count - 1; index++)
        {
            result[index] = Math.Round(total * safeWeights[index] / weightTotal, 0, MidpointRounding.AwayFromZero);
            allocated += result[index];
        }
        result[^1] = total - allocated;
        return result;
    }

    private static decimal Divide(decimal numerator, decimal denominator, string message) => denominator > 0m
        ? numerator / denominator
        : throw new DomainValidationException(message);

    private static void EnsureNonNegative(decimal value, string name)
    {
        if (value < 0m) throw new DomainValidationException($"{name} no puede ser negativo.");
    }

    private static void EnsureNullableNonNegative(decimal? value, string name)
    {
        if (value is < 0m) throw new DomainValidationException($"{name} no puede ser negativo.");
    }

    private static void EnsureNullablePositiveWhenProvided(decimal? value, string name)
    {
        if (value is <= 0m) throw new DomainValidationException($"{name} debe ser mayor que cero cuando se configura.");
    }

    private static void EnsurePercent(decimal value, string name)
    {
        if (value is < 0m or > 100m)
            throw new DomainValidationException($"{name} contiene un porcentaje inválido.");
    }

    private sealed record ScopedAdditionalCost(AdditionalCostInput Input, decimal AmountGs);
    private sealed record ScopedLaborCost(LaborCostInput Input, decimal AmountGs);
    private sealed record PricingResult(
        decimal RequiredPrice,
        decimal MinimumMarginPrice,
        decimal SuggestedPrice,
        decimal FinalPrice,
        decimal NonMarginRecoveryCharge);
}
