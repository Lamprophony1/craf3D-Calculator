using PrintCost.Application.Abstractions;
using PrintCost.Application.Catalogs;
using PrintCost.Domain.Pricing;

namespace PrintCost.Application.Quotes;

public sealed class QuoteCalculationService(IPrintCostRepository repository)
{
    public async Task<QuotePreviewResult> PreviewAsync(
        QuotePreviewRequest request,
        CancellationToken cancellationToken = default)
    {
        var resolved = await ResolveAsync(request, cancellationToken);
        var breakdown = PricingCalculator.Calculate(resolved.Snapshot);
        var warnings = AddCalculationWarnings(resolved.Warnings, breakdown.Warnings);
        return new QuotePreviewResult(
            resolved.Snapshot,
            breakdown,
            resolved.ResolvedAssumptions,
            warnings.All(x => !x.BlocksPrice),
            warnings);
    }

    public async Task<ResolvedQuoteCalculation> ResolveAsync(
        QuotePreviewRequest request,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(request);
        var warnings = new List<PriceWarning>();
        var settings = await repository.GetApplicationSettingsAsync(cancellationToken);
        var printer = await repository.GetPrinterSnapshotAsync(request.PrinterId, cancellationToken)
            ?? throw new InvalidOperationException("Impresora no encontrada o inactiva.");
        var energy = await repository.GetEnergyProfileSnapshotAsync(request.EnergyProfileId, cancellationToken)
            ?? throw new InvalidOperationException("Perfil energético no encontrado o inactivo.");
        if (energy.PrinterId != printer.Id)
            throw new InvalidOperationException("El perfil energético no pertenece a la impresora.");
        var tariff = await repository.GetElectricityTariffSnapshotAsync(request.ElectricityTariffId, cancellationToken)
            ?? throw new InvalidOperationException("Tarifa eléctrica no encontrada o inactiva.");
        var policy = await repository.GetPricingPolicySnapshotAsync(request.PricingPolicyId, cancellationToken)
            ?? throw new InvalidOperationException("Política de precios no encontrada o inactiva.");

        var materials = new List<MaterialCostInput>();
        var resolvedSpools = new List<FilamentSnapshot>();
        foreach (var selection in request.Materials)
        {
            var spool = await repository.GetFilamentSnapshotAsync(selection.SpoolId, cancellationToken)
                ?? throw new InvalidOperationException($"Rollo {selection.SpoolId} no encontrado o inactivo.");
            resolvedSpools.Add(spool);
            materials.Add(new MaterialCostInput(
                spool.Id,
                spool.PurchaseCurrency,
                spool.PurchaseAmount,
                spool.ExchangeRateGs,
                spool.AllocatedShippingGs,
                spool.AllocatedImportFeesGs,
                spool.AllocatedOtherCostsGs,
                spool.NetWeightGrams,
                selection.ModelGrams,
                selection.SupportGrams,
                selection.PurgeGrams,
                selection.PrimeTowerGrams,
                selection.AdhesionGrams,
                selection.OtherWasteGrams,
                selection.SlicerTotalGrams,
                selection.BaseGrams,
                selection.WastePercent,
                selection.WastePercentIsAdditional));
        }

        if (materials.Count == 0)
        {
            warnings.Add(new PriceWarning(
                "MATERIAL_REQUIRED",
                "Debe incluirse al menos un filamento para calcular un precio utilizable.",
                "materials"));
        }
        if (request.PrintDurationHours <= 0m)
        {
            warnings.Add(new PriceWarning(
                "PRINT_DURATION_REQUIRED",
                "La duración de impresión debe ser mayor que cero para usar el precio.",
                "printDurationHours"));
        }
        if (resolvedSpools.Any(x => !MaterialFamilyNormalizer.Matches(x.Material, energy.MaterialFamily)))
        {
            warnings.Add(new PriceWarning(
                "ENERGY_PROFILE_MATERIAL_MISMATCH",
                "El perfil energético seleccionado no es compatible con todos los materiales.",
                "energyProfileId"));
        }

        var missingLaborRate = request.Labor.Any(x =>
            x.Minutes > 0m && (x.HourlyRateGs ?? policy.DefaultLaborRateGsPerHour ?? 0m) <= 0m);
        var labor = request.Labor.Select(x => new LaborCostInput(
            x.Category,
            x.Minutes,
            x.HourlyRateGs ?? policy.DefaultLaborRateGsPerHour ?? 0m,
            x.Scope,
            x.RepeatOnFailure)).ToArray();
        if (missingLaborRate)
        {
            warnings.Add(new PriceWarning(
                "LABOR_RATE_REQUIRED",
                "Hay trabajo requerido sin una tarifa laboral configurada.",
                "labor"));
        }

        var resolvedTax = request.Tax ?? (settings is null
            ? new TaxInput()
            : new TaxInput(
                settings.TaxEnabled,
                settings.TaxName,
                settings.TaxRatePercent,
                settings.PriceIncludesTax));
        if (request.Tax is null && settings is null)
        {
            warnings.Add(new PriceWarning(
                "GENERAL_SETTINGS_REQUIRED",
                "Falta la configuración general que define los impuestos.",
                "tax"));
        }
        if (resolvedTax.Enabled && (string.IsNullOrWhiteSpace(resolvedTax.Name) || resolvedTax.RatePercent <= 0m))
        {
            warnings.Add(new PriceWarning(
                "TAX_CONFIGURATION_REQUIRED",
                "El impuesto habilitado requiere nombre y una tasa positiva.",
                "tax"));
        }

        var calculation = new QuoteCalculationInput(
            request.Quantity,
            materials,
            new EnergyCostInput(
                request.PrintDurationHours,
                energy.AveragePrintPowerW,
                request.IdleDurationHours,
                energy.IdlePowerW,
                energy.MaxPowerW,
                energy.WarmupKWh + request.AdditionalWarmupKWh,
                energy.AccessoryKWh + request.AdditionalAccessoryKWh,
                request.MeasuredKWh,
                tariff.BaseRateGsPerKWh,
                tariff.AdditionalChargesPercent,
                tariff.ExplicitEffectiveRateGsPerKWh),
            new MachineCostInput(
                printer.MachineCostMode,
                request.OccupiedPrinterHours,
                printer.PurchaseCostGs,
                printer.ResidualValueGs,
                printer.UsefulLifeHours,
                printer.ExpectedLifetimeRepairCostGs,
                printer.MaintenanceReserveGsPerHour,
                printer.RecoveryYears,
                printer.BusinessDaysPerYear,
                printer.PlannedBillableHoursPerDay,
                printer.RepairReserveGsPerHour,
                printer.ManualHourlyRateGs,
                request.AcceptZeroMachineRate,
                request.ZeroMachineRateReason),
            labor,
            request.AdditionalCosts,
            new FailureReserveInput(
                policy.FailureMode,
                policy.FailureProbability,
                policy.SimpleFailureReservePercent),
            new OverheadInput(
                policy.FixedOverheadPerOrderGs,
                policy.OverheadPercent,
                policy.MonthlyOverheadGs,
                policy.ExpectedMonthlyProductiveHours),
            new PricingInput(
                policy.TargetMarginPercent,
                policy.MinimumMarginPercent,
                policy.MinimumOrderGs,
                policy.RoundingIncrementGs,
                policy.RoundUp,
                policy.VariableSellingFeePercent,
                policy.FixedSellingFeeGs,
                request.FixedSurchargesGs,
                request.PercentageSurchargePercent,
                request.DiscountGs,
                request.ManualNetPriceGs,
                request.ManualPriceReason),
            resolvedTax);

        var production = PricingCalculator.CalculateProduction(calculation);
        if (production.Materials.Any(x => x.TotalChargeableGrams <= 0m))
        {
            warnings.Add(new PriceWarning(
                "MATERIAL_GRAMS_REQUIRED",
                "Todos los materiales requieren gramos positivos.",
                "materials"));
        }
        if (production.Materials.Any(x => x.CostPerGramGs <= 0m))
        {
            warnings.Add(new PriceWarning(
                "FILAMENT_COST_REQUIRED",
                "Todos los filamentos requieren un costo por gramo positivo.",
                "materials"));
        }
        if (energy.AveragePrintPowerW <= 0m)
        {
            warnings.Add(new PriceWarning(
                "ENERGY_PROFILE_COST_REQUIRED",
                "El perfil energético requiere una potencia promedio positiva.",
                "energyProfileId"));
        }
        if (production.Energy.EffectiveRateGsPerKWh <= 0m)
        {
            warnings.Add(new PriceWarning(
                "ELECTRICITY_RATE_REQUIRED",
                "La tarifa eléctrica efectiva debe ser positiva.",
                "electricityTariffId"));
        }
        for (var index = 0; index < resolvedSpools.Count && index < production.Materials.Count; index++)
        {
            var spool = resolvedSpools[index];
            if (spool.IsInventoryTracked && production.Materials[index].TotalChargeableGrams > spool.RemainingWeightGrams)
            {
                warnings.Add(new PriceWarning(
                    "INSUFFICIENT_FILAMENT_INVENTORY",
                    $"El rollo {spool.Material} {spool.Color} no tiene inventario suficiente para los gramos calculados.",
                    $"materials[{index}].spoolId"));
            }
        }
        if (production.Machine.HourlyRateGs <= 0m)
        {
            warnings.Add(new PriceWarning(
                "MACHINE_RATE_REQUIRED",
                "La impresora no tiene un costo horario positivo configurado.",
                "printerId"));
        }
        foreach (var warning in production.Warnings)
        {
            if (warning.Contains("costo horario", StringComparison.OrdinalIgnoreCase)) continue;
            var code = warning.Contains("margen mínimo", StringComparison.OrdinalIgnoreCase)
                ? "PRICE_BELOW_MINIMUM_MARGIN"
                : warning.Contains("debajo del costo", StringComparison.OrdinalIgnoreCase)
                    ? "PRICE_BELOW_FULL_COST"
                    : "CALCULATION_WARNING";
            warnings.Add(new PriceWarning(code, warning, "price"));
        }

        warnings = warnings
            .GroupBy(x => x.Code, StringComparer.OrdinalIgnoreCase)
            .Select(x => x.First())
            .ToList();
        var assumptions = new ResolvedQuoteAssumptions(
            printer.Id,
            printer.Name,
            energy.Id,
            energy.Name,
            energy.MaterialFamily,
            tariff.Id,
            tariff.Name,
            policy.Id,
            policy.Name,
            request.PrintDurationHours,
            request.OccupiedPrinterHours,
            request.Labor.Where(x => string.Equals(x.Category, "Setup", StringComparison.OrdinalIgnoreCase)).Sum(x => x.Minutes),
            request.AdditionalCosts.Where(x => x.Description.Contains("embalaje", StringComparison.OrdinalIgnoreCase)).Sum(x => x.AmountGs),
            resolvedTax);

        return new ResolvedQuoteCalculation(
            calculation,
            assumptions,
            warnings);
    }

    public async Task<QuickQuotePreviewResult> QuickPreviewAsync(
        QuickQuotePreviewRequest request,
        CancellationToken cancellationToken = default)
    {
        if (request.PrintDurationMinutes <= 0)
            throw new DomainValidationException("PrintDurationMinutes debe ser mayor que cero.");
        if (request.TotalGrams <= 0m)
            throw new DomainValidationException("TotalGrams debe ser mayor que cero.");

        var warnings = new List<PriceWarning>();
        var settings = await repository.GetApplicationSettingsAsync(cancellationToken);
        if (settings is null)
        {
            warnings.Add(new PriceWarning(
                "GENERAL_SETTINGS_REQUIRED",
                "No existe configuración general para la cotización rápida.",
                "settings"));
            return new QuickQuotePreviewResult(null, null, false, warnings, null);
        }

        var spool = await repository.GetFilamentSnapshotAsync(request.SpoolId, cancellationToken)
            ?? throw new InvalidOperationException("Filamento no encontrado o inactivo.");
        AddMissingDefaultWarning(settings.DefaultPrinterId, "DEFAULT_PRINTER_REQUIRED", "Falta seleccionar la impresora predeterminada.", "defaultPrinterId", warnings);
        AddMissingDefaultWarning(settings.DefaultElectricityTariffId, "DEFAULT_TARIFF_REQUIRED", "Falta seleccionar la tarifa eléctrica predeterminada.", "defaultElectricityTariffId", warnings);
        AddMissingDefaultWarning(settings.DefaultPricingPolicyId, "DEFAULT_POLICY_REQUIRED", "Falta seleccionar la política de precios predeterminada.", "defaultPricingPolicyId", warnings);
        if (settings.DefaultQuickSetupMinutes is null)
            warnings.Add(new PriceWarning("DEFAULT_QUICK_SETUP_REQUIRED", "Faltan los minutos de setup predeterminados.", "defaultQuickSetupMinutes"));
        if (settings.DefaultQuickPackagingCostGs is null)
            warnings.Add(new PriceWarning("DEFAULT_QUICK_PACKAGING_REQUIRED", "Falta el costo de embalaje predeterminado.", "defaultQuickPackagingCostGs"));

        if (warnings.Count > 0)
            return new QuickQuotePreviewResult(null, null, false, warnings, null);

        var printer = await repository.GetPrinterSnapshotAsync(settings.DefaultPrinterId!.Value, cancellationToken);
        var tariff = await repository.GetElectricityTariffSnapshotAsync(settings.DefaultElectricityTariffId!.Value, cancellationToken);
        var policy = await repository.GetPricingPolicySnapshotAsync(settings.DefaultPricingPolicyId!.Value, cancellationToken);
        var energy = printer is null
            ? null
            : await repository.GetCompatibleEnergyProfileSnapshotAsync(printer.Id, spool.Material, cancellationToken);
        var usedStandardEnergyFallback = false;
        if (energy is null && printer is not null)
        {
            energy = await repository.GetStandardEnergyProfileSnapshotAsync(printer.Id, cancellationToken);
            usedStandardEnergyFallback = energy is not null;
        }

        if (printer is null)
            warnings.Add(new PriceWarning("DEFAULT_PRINTER_UNAVAILABLE", "La impresora predeterminada no existe o está inactiva.", "defaultPrinterId"));
        if (tariff is null)
            warnings.Add(new PriceWarning("DEFAULT_TARIFF_UNAVAILABLE", "La tarifa predeterminada no existe o está inactiva.", "defaultElectricityTariffId"));
        if (policy is null)
            warnings.Add(new PriceWarning("DEFAULT_POLICY_UNAVAILABLE", "La política predeterminada no existe o está inactiva.", "defaultPricingPolicyId"));
        if (energy is null)
            warnings.Add(new PriceWarning("COMPATIBLE_ENERGY_PROFILE_REQUIRED", $"No hay un perfil energético activo para {spool.Material} en la impresora predeterminada.", "energyProfile"));

        if (warnings.Count > 0)
            return new QuickQuotePreviewResult(null, null, false, warnings, null);

        var durationHours = request.PrintDurationMinutes / 60m;
        var advancedRequest = new QuotePreviewRequest(
            printer!.Id,
            energy!.Id,
            tariff!.Id,
            policy!.Id,
            new QuantityPlan(),
            durationHours,
            0m,
            durationHours,
            null,
            0m,
            0m,
            [new MaterialSelection(spool.Id, SlicerTotalGrams: request.TotalGrams)],
            [new LaborSelection("Setup", settings.DefaultQuickSetupMinutes!.Value, null, CostScope.FixedPerOrder)],
            [new AdditionalCostInput(
                "Embalaje",
                settings.DefaultQuickPackagingCostGs!.Value,
                CostScope.FixedPerOrder,
                IsInternalCost: true,
                ParticipatesInMargin: true)],
            Tax: new TaxInput(
                settings.TaxEnabled,
                settings.TaxName,
                settings.TaxRatePercent,
                settings.PriceIncludesTax));
        var preview = await PreviewAsync(advancedRequest, cancellationToken);

        var quickWarnings = preview.Warnings
            .Where(x => !(usedStandardEnergyFallback && x.Code == "ENERGY_PROFILE_MATERIAL_MISMATCH"))
            .Select(x => x.Code == "INSUFFICIENT_FILAMENT_INVENTORY"
                ? x with { BlocksPrice = false, Message = "Podés cotizar igual, pero el stock registrado de este filamento no alcanza." }
                : x)
            .ToList();
        if (usedStandardEnergyFallback)
        {
            quickWarnings.Add(new PriceWarning(
                "ENERGY_PROFILE_FALLBACK_USED",
                "Se utilizó el consumo estándar de la A1 para estimar la energía.",
                "energyProfile",
                BlocksPrice: false));
        }

        return new QuickQuotePreviewResult(
            preview.Breakdown,
            preview.ResolvedAssumptions,
            quickWarnings.All(x => !x.BlocksPrice),
            quickWarnings,
            advancedRequest);
    }

    private static void AddMissingDefaultWarning(
        Guid? value,
        string code,
        string message,
        string field,
        ICollection<PriceWarning> warnings)
    {
        if (value is null) warnings.Add(new PriceWarning(code, message, field));
    }

    internal static IReadOnlyList<PriceWarning> AddCalculationWarnings(
        IEnumerable<PriceWarning> existing,
        IEnumerable<string> calculationWarnings)
    {
        var warnings = existing.ToList();
        foreach (var warning in calculationWarnings)
        {
            if (warning.Contains("costo horario", StringComparison.OrdinalIgnoreCase)) continue;
            var code = warning.Contains("margen m", StringComparison.OrdinalIgnoreCase)
                ? "PRICE_BELOW_MINIMUM_MARGIN"
                : warning.Contains("debajo del costo", StringComparison.OrdinalIgnoreCase)
                    ? "PRICE_BELOW_FULL_COST"
                    : "CALCULATION_WARNING";
            warnings.Add(new PriceWarning(code, warning, "price"));
        }

        return warnings
            .GroupBy(x => x.Code, StringComparer.OrdinalIgnoreCase)
            .Select(x => x.First())
            .ToArray();
    }
}
