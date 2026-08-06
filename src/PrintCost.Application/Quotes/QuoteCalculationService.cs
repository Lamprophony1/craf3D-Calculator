using PrintCost.Application.Abstractions;
using PrintCost.Domain.Pricing;

namespace PrintCost.Application.Quotes;

public sealed class QuoteCalculationService(IPrintCostRepository repository)
{
    public async Task<QuotePreviewResult> PreviewAsync(QuotePreviewRequest request, CancellationToken cancellationToken = default)
    {
        var printer = await repository.GetPrinterSnapshotAsync(request.PrinterId, cancellationToken)
            ?? throw new InvalidOperationException("Impresora no encontrada.");
        var energy = await repository.GetEnergyProfileSnapshotAsync(request.EnergyProfileId, cancellationToken)
            ?? throw new InvalidOperationException("Perfil energético no encontrado.");
        if (energy.PrinterId != printer.Id) throw new InvalidOperationException("El perfil energético no pertenece a la impresora.");
        var tariff = await repository.GetElectricityTariffSnapshotAsync(request.ElectricityTariffId, cancellationToken)
            ?? throw new InvalidOperationException("Tarifa eléctrica no encontrada.");
        var policy = await repository.GetPricingPolicySnapshotAsync(request.PricingPolicyId, cancellationToken)
            ?? throw new InvalidOperationException("Política de precios no encontrada.");

        var materials = new List<MaterialCostInput>();
        foreach (var selection in request.Materials)
        {
            var spool = await repository.GetFilamentSnapshotAsync(selection.SpoolId, cancellationToken)
                ?? throw new InvalidOperationException($"Rollo {selection.SpoolId} no encontrado.");
            materials.Add(new MaterialCostInput(
                spool.Id, spool.PurchaseCurrency, spool.PurchaseAmount, spool.ExchangeRateGs,
                spool.AllocatedShippingGs, spool.AllocatedImportFeesGs, spool.AllocatedOtherCostsGs,
                spool.NetWeightGrams, selection.ModelGrams, selection.SupportGrams, selection.PurgeGrams,
                selection.PrimeTowerGrams, selection.AdhesionGrams, selection.OtherWasteGrams,
                selection.SlicerTotalGrams, selection.BaseGrams, selection.WastePercent, selection.WastePercentIsAdditional));
        }

        var missingLaborRate = request.Labor.Any(x => x.HourlyRateGs is null && policy.DefaultLaborRateGsPerHour is null);
        var labor = request.Labor.Select(x => new LaborCostInput(
            x.Category, x.Minutes, x.HourlyRateGs ?? policy.DefaultLaborRateGsPerHour ?? 0m, x.Scope, x.RepeatOnFailure)).ToArray();
        var calculation = new QuoteCalculationInput(
            request.Quantity,
            materials,
            new EnergyCostInput(
                request.PrintDurationHours, energy.AveragePrintPowerW, request.IdleDurationHours, energy.IdlePowerW,
                energy.MaxPowerW, energy.WarmupKWh + request.AdditionalWarmupKWh,
                energy.AccessoryKWh + request.AdditionalAccessoryKWh, request.MeasuredKWh,
                tariff.BaseRateGsPerKWh, tariff.AdditionalChargesPercent, tariff.ExplicitEffectiveRateGsPerKWh),
            new MachineCostInput(
                printer.MachineCostMode, request.OccupiedPrinterHours, printer.PurchaseCostGs, printer.ResidualValueGs,
                printer.UsefulLifeHours, printer.ExpectedLifetimeRepairCostGs, printer.MaintenanceReserveGsPerHour,
                printer.RecoveryYears, printer.BusinessDaysPerYear, printer.PlannedBillableHoursPerDay,
                printer.RepairReserveGsPerHour, printer.ManualHourlyRateGs,
                request.AcceptZeroMachineRate, request.ZeroMachineRateReason),
            labor,
            request.AdditionalCosts,
            new FailureReserveInput(policy.FailureMode, policy.FailureProbability, policy.SimpleFailureReservePercent),
            new OverheadInput(policy.FixedOverheadPerOrderGs, policy.OverheadPercent, policy.MonthlyOverheadGs, policy.ExpectedMonthlyProductiveHours),
            new PricingInput(
                policy.TargetMarginPercent, policy.MinimumMarginPercent, policy.MinimumOrderGs, policy.RoundingIncrementGs,
                policy.RoundUp, policy.VariableSellingFeePercent, policy.FixedSellingFeeGs,
                request.FixedSurchargesGs, request.PercentageSurchargePercent, request.DiscountGs,
                request.ManualNetPriceGs, request.ManualPriceReason),
            request.Tax ?? new TaxInput());

        var breakdown = PricingCalculator.Calculate(calculation);
        if (missingLaborRate)
        {
            breakdown = breakdown with { Warnings = breakdown.Warnings.Append("Hay líneas de trabajo sin tarifa configurada.").ToArray() };
        }

        return new QuotePreviewResult(calculation, breakdown);
    }
}

