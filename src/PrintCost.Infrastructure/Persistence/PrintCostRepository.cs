using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.EntityFrameworkCore;
using PrintCost.Application.Abstractions;
using PrintCost.Application.Auth;
using PrintCost.Application.Catalogs;
using PrintCost.Application.Quotes;
using PrintCost.Domain.Pricing;
using PrintCost.Infrastructure.Persistence.Entities;

namespace PrintCost.Infrastructure.Persistence;

public sealed class PrintCostRepository(PrintCostDbContext db) : IPrintCostRepository, ISimplePricingSettingsRepository
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web)
    {
        Converters = { new JsonStringEnumConverter() }
    };

    public async Task<PrinterSnapshot?> GetPrinterSnapshotAsync(Guid id, CancellationToken cancellationToken = default) =>
        await db.Printers.AsNoTracking().Where(x => x.Id == id && x.IsActive).Select(x => new PrinterSnapshot(
            x.Id, x.Name, x.Manufacturer, x.Model, x.Voltage, x.MachineCostMode, x.PurchaseCostGs, x.ResidualValueGs,
            x.UsefulLifeHours, x.ExpectedLifetimeRepairCostGs, x.MaintenanceReserveGsPerHour, x.RecoveryYears,
            x.BusinessDaysPerYear, x.PlannedBillableHoursPerDay, x.RepairReserveGsPerHour, x.ManualHourlyRateGs, x.IsActive))
            .SingleOrDefaultAsync(cancellationToken);

    public async Task<EnergyProfileSnapshot?> GetEnergyProfileSnapshotAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        return await db.EnergyProfiles.AsNoTracking()
            .Where(x => x.Id == id && x.IsActive
                && (x.EffectiveFrom == null || x.EffectiveFrom <= today)
                && (x.EffectiveTo == null || x.EffectiveTo >= today))
            .Select(x => new EnergyProfileSnapshot(
                x.Id, x.PrinterId, x.Name, x.MaterialFamily, x.AveragePrintPowerW, x.IdlePowerW, x.MaxPowerW,
                x.WarmupKWh, x.AccessoryKWh, x.SourceName, x.VerifiedAt, x.IsActive))
            .SingleOrDefaultAsync(cancellationToken);
    }

    public async Task<EnergyProfileSnapshot?> GetCompatibleEnergyProfileSnapshotAsync(
        Guid printerId,
        string material,
        CancellationToken cancellationToken = default)
    {
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var candidates = await db.EnergyProfiles.AsNoTracking()
            .Where(x => x.PrinterId == printerId
                && x.IsActive
                && x.AveragePrintPowerW > 0m
                && (x.EffectiveFrom == null || x.EffectiveFrom <= today)
                && (x.EffectiveTo == null || x.EffectiveTo >= today))
            .OrderByDescending(x => x.EffectiveFrom)
            .ThenBy(x => x.Name)
            .Select(x => new EnergyProfileSnapshot(
                x.Id, x.PrinterId, x.Name, x.MaterialFamily, x.AveragePrintPowerW, x.IdlePowerW, x.MaxPowerW,
                x.WarmupKWh, x.AccessoryKWh, x.SourceName, x.VerifiedAt, x.IsActive))
            .ToArrayAsync(cancellationToken);
        return candidates.FirstOrDefault(x => MaterialFamilyNormalizer.Matches(x.MaterialFamily, material));
    }

    public async Task<EnergyProfileSnapshot?> GetStandardEnergyProfileSnapshotAsync(
        Guid printerId,
        CancellationToken cancellationToken = default)
    {
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        return await db.EnergyProfiles.AsNoTracking()
            .Where(x => x.PrinterId == printerId && x.IsActive && x.AveragePrintPowerW > 0m
                && (x.EffectiveFrom == null || x.EffectiveFrom <= today)
                && (x.EffectiveTo == null || x.EffectiveTo >= today))
            .OrderByDescending(x => x.MaterialFamily == "PLA")
            .ThenByDescending(x => x.EffectiveFrom)
            .ThenBy(x => x.Name)
            .Select(x => new EnergyProfileSnapshot(
                x.Id, x.PrinterId, x.Name, x.MaterialFamily, x.AveragePrintPowerW, x.IdlePowerW, x.MaxPowerW,
                x.WarmupKWh, x.AccessoryKWh, x.SourceName, x.VerifiedAt, x.IsActive))
            .FirstOrDefaultAsync(cancellationToken);
    }

    public async Task<ElectricityTariffSnapshot?> GetElectricityTariffSnapshotAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        return await db.ElectricityTariffs.AsNoTracking()
            .Where(x => x.Id == id && x.IsActive
                && (x.EffectiveFrom == null || x.EffectiveFrom <= today)
                && (x.EffectiveTo == null || x.EffectiveTo >= today))
            .Select(x => new ElectricityTariffSnapshot(
                x.Id, x.Provider, x.Name, x.Category, x.BaseRateGsPerKWh, x.ExcludesTax, x.AdditionalChargesPercent,
                x.ExplicitEffectiveRateGsPerKWh, x.SourceName, x.VerifiedAt, x.IsActive))
            .SingleOrDefaultAsync(cancellationToken);
    }

    public async Task<FilamentSnapshot?> GetFilamentSnapshotAsync(Guid id, CancellationToken cancellationToken = default) =>
        await db.FilamentSpools.AsNoTracking().Where(x => x.Id == id && x.IsActive).Select(x => new FilamentSnapshot(
            x.Id, x.Manufacturer, x.ProductName, x.Material, x.Color, x.BatchCode, x.PurchaseCurrency,
            x.PurchaseAmount, x.ExchangeRateGs, x.AllocatedShippingGs, x.AllocatedImportFeesGs, x.AllocatedOtherCostsGs,
            x.NetWeightGrams, x.RemainingWeightGrams, x.IsInventoryTracked, x.IsActive)).SingleOrDefaultAsync(cancellationToken);

    public async Task<PricingPolicySnapshot?> GetPricingPolicySnapshotAsync(Guid? id, CancellationToken cancellationToken = default)
    {
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var query = db.PricingPolicies.AsNoTracking().Where(x => x.IsActive
            && (x.EffectiveFrom == null || x.EffectiveFrom <= today)
            && (x.EffectiveTo == null || x.EffectiveTo >= today));
        var policy = id is null
            ? await query.OrderByDescending(x => x.IsDefault).ThenByDescending(x => x.EffectiveFrom).FirstOrDefaultAsync(cancellationToken)
            : await query.SingleOrDefaultAsync(x => x.Id == id, cancellationToken);
        return policy is null ? null : new PricingPolicySnapshot(
            policy.Id, policy.Name, policy.TargetMarginPercent, policy.MinimumMarginPercent, policy.MinimumOrderGs,
            policy.RoundingIncrementGs, policy.RoundUp, policy.FailureMode, policy.FailureProbability,
            policy.SimpleFailureReservePercent, policy.FixedOverheadPerOrderGs, policy.OverheadPercent,
            policy.MonthlyOverheadGs, policy.ExpectedMonthlyProductiveHours, policy.DefaultLaborRateGsPerHour,
            policy.VariableSellingFeePercent, policy.FixedSellingFeeGs, policy.IsDefault, policy.IsActive);
    }

    public async Task<ApplicationSettingsSnapshot?> GetApplicationSettingsAsync(CancellationToken cancellationToken = default) =>
        await db.ApplicationSettings.AsNoTracking()
            .Select(x => new ApplicationSettingsSnapshot(
                x.Id,
                x.VisibleAppName,
                x.TimeZone,
                x.ProductionHostname,
                x.TaxEnabled,
                x.TaxName,
                x.TaxRatePercent,
                x.PriceIncludesTax,
                x.DefaultPrinterId,
                x.DefaultElectricityTariffId,
                x.DefaultPricingPolicyId,
                x.DefaultQuickSetupMinutes,
                x.DefaultQuickPackagingCostGs,
                x.RecommendedDefaultsVersion,
                x.DefaultEnergyProfileId))
            .SingleOrDefaultAsync(cancellationToken);

    public async Task<SimplePricingSettings?> GetSimplePricingSettingsAsync(CancellationToken cancellationToken = default)
    {
        var settings = await db.ApplicationSettings.AsNoTracking().SingleOrDefaultAsync(cancellationToken);
        if (settings?.DefaultPrinterId is null || settings.DefaultEnergyProfileId is null || settings.DefaultElectricityTariffId is null
            || settings.DefaultPricingPolicyId is null) return null;

        var printer = await db.Printers.AsNoTracking().SingleOrDefaultAsync(x => x.Id == settings.DefaultPrinterId, cancellationToken);
        var tariff = await db.ElectricityTariffs.AsNoTracking().SingleOrDefaultAsync(x => x.Id == settings.DefaultElectricityTariffId, cancellationToken);
        var policy = await db.PricingPolicies.AsNoTracking().SingleOrDefaultAsync(x => x.Id == settings.DefaultPricingPolicyId, cancellationToken);
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var energy = settings.DefaultEnergyProfileId is null ? null
            : await db.EnergyProfiles.AsNoTracking().SingleOrDefaultAsync(x => x.Id == settings.DefaultEnergyProfileId
                && x.PrinterId == settings.DefaultPrinterId && x.IsActive && x.AveragePrintPowerW > 0m
                && (x.EffectiveFrom == null || x.EffectiveFrom <= today)
                && (x.EffectiveTo == null || x.EffectiveTo >= today), cancellationToken);
        return printer is null || tariff is null || policy is null || energy is null
            ? null
            : ToSimpleSettings(settings, printer, policy, energy, tariff);
    }

    public async Task<SimplePricingSettings> UpdateSimplePricingSettingsAsync(
        UpdateSimplePricingSettingsRequest request,
        CancellationToken cancellationToken = default)
    {
        var settings = await db.ApplicationSettings.SingleAsync(cancellationToken);
        var printer = settings.DefaultPrinterId is null ? null
            : await db.Printers.SingleOrDefaultAsync(x => x.Id == settings.DefaultPrinterId, cancellationToken);
        var tariff = settings.DefaultElectricityTariffId is null ? null
            : await db.ElectricityTariffs.SingleOrDefaultAsync(x => x.Id == settings.DefaultElectricityTariffId, cancellationToken);
        var policy = settings.DefaultPricingPolicyId is null ? null
            : await db.PricingPolicies.SingleOrDefaultAsync(x => x.Id == settings.DefaultPricingPolicyId, cancellationToken);
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var energy = printer is null || settings.DefaultEnergyProfileId is null ? null
            : await db.EnergyProfiles.SingleOrDefaultAsync(x => x.Id == settings.DefaultEnergyProfileId
                && x.PrinterId == printer.Id && x.IsActive && x.AveragePrintPowerW > 0m
                && (x.EffectiveFrom == null || x.EffectiveFrom <= today)
                && (x.EffectiveTo == null || x.EffectiveTo >= today), cancellationToken);
        if (printer is null || tariff is null || policy is null || energy is null)
            throw new InvalidOperationException("Falta una referencia técnica necesaria para guardar estos ajustes.");
        if (request.TargetMarginPercent + policy.VariableSellingFeePercent >= 100m
            || request.MinimumMarginPercent + policy.VariableSellingFeePercent >= 100m)
            throw new DomainValidationException("Los márgenes y la comisión variable configurada no dejan un denominador de precio válido.");
        if (policy.VariableSellingFeePercent is < 0m or >= 100m
            || policy.FixedSellingFeeGs < 0m
            || policy.FixedOverheadPerOrderGs < 0m
            || policy.MonthlyOverheadGs < 0m
            || policy.ExpectedMonthlyProductiveHours < 0m
            || (policy.MonthlyOverheadGs > 0m && policy.ExpectedMonthlyProductiveHours <= 0m))
            throw new DomainValidationException("La configuración avanzada de comisiones u overhead no es válida.");
        if (settings.TaxEnabled && (string.IsNullOrWhiteSpace(settings.TaxName) || settings.TaxRatePercent <= 0m))
            throw new DomainValidationException("El impuesto activo requiere nombre y una tasa positiva.");
        if (energy.AveragePrintPowerW <= 0m
            || (tariff.ExplicitEffectiveRateGsPerKWh
                ?? tariff.BaseRateGsPerKWh * (1m + tariff.AdditionalChargesPercent / 100m)) <= 0m)
            throw new DomainValidationException("La configuración técnica de energía o tarifa no permite calcular un precio.");

        printer.MachineCostMode = MachineCostMode.ManualHourlyRate;
        printer.ManualHourlyRateGs = request.MachineHourlyRateGs;
        settings.DefaultQuickSetupMinutes = request.PreparationMinutes;
        settings.DefaultQuickPackagingCostGs = request.PackagingCostGs;
        policy.DefaultLaborRateGsPerHour = request.LaborHourlyRateGs;
        policy.FailureMode = FailureReserveMode.ExpectedAttempts;
        policy.FailureProbability = request.FailureProbabilityPercent / 100m;
        policy.OverheadPercent = request.OverheadPercent;
        policy.TargetMarginPercent = request.TargetMarginPercent;
        policy.MinimumMarginPercent = request.MinimumMarginPercent;
        policy.MinimumOrderGs = request.MinimumOrderGs;
        policy.RoundingIncrementGs = request.RoundingIncrementGs;
        settings.UpdatedAt = DateTimeOffset.UtcNow;
        await db.SaveChangesAsync(cancellationToken);
        return ToSimpleSettings(settings, printer, policy, energy, tariff);
    }

    public async Task<SimplePricingSettings> RestoreRecommendedSimplePricingSettingsAsync(CancellationToken cancellationToken = default)
    {
        var settings = await db.ApplicationSettings.SingleAsync(x => x.Id == SeedData.SettingsId, cancellationToken);
        var printer = await db.Printers.SingleOrDefaultAsync(x => x.Id == SeedData.PrinterId, cancellationToken);
        var policy = await db.PricingPolicies.SingleOrDefaultAsync(x => x.Id == SeedData.PricingPolicyId, cancellationToken);
        var energy = await db.EnergyProfiles.SingleOrDefaultAsync(x => x.Id == SeedData.EnergyProfileId, cancellationToken);
        var tariff = await db.ElectricityTariffs.SingleOrDefaultAsync(x => x.Id == SeedData.TariffId, cancellationToken);
        if (printer is null || policy is null || energy is null || tariff is null)
            throw new InvalidOperationException("No están disponibles los registros recomendados originales.");

        printer.MachineCostMode = MachineCostMode.ManualHourlyRate;
        printer.ManualHourlyRateGs = 2_000m;
        printer.IsActive = true;
        policy.TargetMarginPercent = 40m;
        policy.MinimumMarginPercent = 30m;
        policy.MinimumOrderGs = 30_000m;
        policy.RoundingIncrementGs = 5_000m;
        policy.RoundUp = true;
        policy.FailureMode = FailureReserveMode.ExpectedAttempts;
        policy.FailureProbability = 0.10m;
        policy.SimpleFailureReservePercent = 0m;
        policy.FixedOverheadPerOrderGs = 0m;
        policy.OverheadPercent = 5m;
        policy.MonthlyOverheadGs = 0m;
        policy.ExpectedMonthlyProductiveHours = 0m;
        policy.DefaultLaborRateGsPerHour = 20_000m;
        policy.VariableSellingFeePercent = 0m;
        policy.FixedSellingFeeGs = 0m;
        policy.IsDefault = true;
        policy.IsActive = true;
        policy.EffectiveFrom = null;
        policy.EffectiveTo = null;
        var otherDefaultPolicies = await db.PricingPolicies
            .Where(x => x.Id != policy.Id && x.IsDefault)
            .ToArrayAsync(cancellationToken);
        foreach (var other in otherDefaultPolicies) other.IsDefault = false;
        energy.PrinterId = printer.Id;
        energy.MaterialFamily = "PLA";
        energy.AveragePrintPowerW = 95m;
        energy.IdlePowerW = 5m;
        energy.MaxPowerW = 1_300m;
        energy.WarmupKWh = 0m;
        energy.AccessoryKWh = 0m;
        energy.IsActive = true;
        energy.EffectiveFrom = null;
        energy.EffectiveTo = null;
        tariff.BaseRateGsPerKWh = 435.51m;
        tariff.AdditionalChargesPercent = 0m;
        tariff.ExplicitEffectiveRateGsPerKWh = null;
        tariff.IsActive = true;
        tariff.EffectiveFrom = null;
        tariff.EffectiveTo = null;
        settings.DefaultPrinterId = printer.Id;
        settings.DefaultEnergyProfileId = energy.Id;
        settings.DefaultElectricityTariffId = tariff.Id;
        settings.DefaultPricingPolicyId = policy.Id;
        settings.DefaultQuickSetupMinutes = 20m;
        settings.DefaultQuickPackagingCostGs = 2_000m;
        settings.TaxEnabled = false;
        settings.TaxName = null;
        settings.TaxRatePercent = 0m;
        settings.PriceIncludesTax = false;
        settings.RecommendedDefaultsVersion = SeedData.RecommendedDefaultsVersion;
        settings.UpdatedAt = DateTimeOffset.UtcNow;
        await db.SaveChangesAsync(cancellationToken);
        return ToSimpleSettings(settings, printer, policy, energy, tariff);
    }

    private static SimplePricingSettings ToSimpleSettings(
        ApplicationSettingEntity settings,
        PrinterEntity printer,
        PricingPolicyEntity policy,
        EnergyProfileEntity energy,
        ElectricityTariffEntity tariff)
    {
        var machineRate = printer.ManualHourlyRateGs ?? 0m;
        var laborRate = policy.DefaultLaborRateGsPerHour ?? 0m;
        var preparationMinutes = settings.DefaultQuickSetupMinutes ?? 0m;
        var electricityRate = tariff.ExplicitEffectiveRateGsPerKWh
            ?? tariff.BaseRateGsPerKWh * (1m + tariff.AdditionalChargesPercent / 100m);
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var advancedOverrides = new List<string>();
        if (settings.TaxEnabled || settings.TaxRatePercent != 0m || settings.PriceIncludesTax)
            advancedOverrides.Add("Hay un impuesto activo o configurado.");
        if (settings.DefaultPrinterId != SeedData.PrinterId)
            advancedOverrides.Add("Se utiliza una impresora distinta a la recomendada.");
        if (settings.DefaultEnergyProfileId != SeedData.EnergyProfileId)
            advancedOverrides.Add("Se utiliza un perfil energético distinto al recomendado.");
        if (settings.DefaultElectricityTariffId != SeedData.TariffId)
            advancedOverrides.Add("Se utiliza una tarifa eléctrica distinta a la recomendada.");
        if (settings.DefaultPricingPolicyId != SeedData.PricingPolicyId)
            advancedOverrides.Add("Se utiliza una política de precios distinta a la recomendada.");
        if (!printer.IsActive || printer.MachineCostMode != MachineCostMode.ManualHourlyRate)
            advancedOverrides.Add("La impresora recomendada tiene una configuración técnica personalizada.");
        if (!policy.IsActive || !policy.IsDefault || !IsEffective(policy.EffectiveFrom, policy.EffectiveTo, today))
            advancedOverrides.Add("La política recomendada no está activa o vigente.");
        if (policy.VariableSellingFeePercent != 0m)
            advancedOverrides.Add($"Hay una comisión variable del {policy.VariableSellingFeePercent:0.##}%.");
        if (policy.FixedSellingFeeGs != 0m)
            advancedOverrides.Add("Hay una comisión fija configurada.");
        if (policy.FixedOverheadPerOrderGs != 0m)
            advancedOverrides.Add("Hay un overhead fijo configurado.");
        if (policy.MonthlyOverheadGs != 0m || policy.ExpectedMonthlyProductiveHours != 0m)
            advancedOverrides.Add("Hay un overhead mensual configurado.");
        if (policy.SimpleFailureReservePercent != 0m
            || policy.FailureMode != FailureReserveMode.ExpectedAttempts
            || !policy.RoundUp)
            advancedOverrides.Add("La política tiene reglas avanzadas de reserva o redondeo.");
        if (energy.Id != SeedData.EnergyProfileId
            || !energy.IsActive
            || !IsEffective(energy.EffectiveFrom, energy.EffectiveTo, today))
            advancedOverrides.Add("Se utiliza un perfil energético distinto o no vigente.");
        if (energy.AveragePrintPowerW != 95m
            || energy.IdlePowerW != 5m
            || energy.MaxPowerW != 1_300m
            || energy.WarmupKWh != 0m
            || energy.AccessoryKWh != 0m)
            advancedOverrides.Add("El perfil energético tiene consumos extra o valores técnicos personalizados.");
        if (!tariff.IsActive || !IsEffective(tariff.EffectiveFrom, tariff.EffectiveTo, today))
            advancedOverrides.Add("La tarifa recomendada no está activa o vigente.");
        if (tariff.AdditionalChargesPercent != 0m || tariff.ExplicitEffectiveRateGsPerKWh is not null)
            advancedOverrides.Add("La tarifa eléctrica tiene cargos avanzados.");
        if (tariff.BaseRateGsPerKWh != 435.51m)
            advancedOverrides.Add("La tarifa eléctrica base fue personalizada.");

        var recommended = settings.DefaultPrinterId == SeedData.PrinterId
            && settings.DefaultEnergyProfileId == SeedData.EnergyProfileId
            && settings.DefaultElectricityTariffId == SeedData.TariffId
            && settings.DefaultPricingPolicyId == SeedData.PricingPolicyId
            && settings.RecommendedDefaultsVersion == SeedData.RecommendedDefaultsVersion
            && !settings.TaxEnabled
            && settings.TaxRatePercent == 0m
            && !settings.PriceIncludesTax
            && printer.IsActive
            && printer.MachineCostMode == MachineCostMode.ManualHourlyRate
            && machineRate == 2_000m
            && preparationMinutes == 20m
            && laborRate == 20_000m
            && (settings.DefaultQuickPackagingCostGs ?? 0m) == 2_000m
            && policy.IsActive
            && policy.IsDefault
            && IsEffective(policy.EffectiveFrom, policy.EffectiveTo, today)
            && policy.FailureMode == FailureReserveMode.ExpectedAttempts
            && policy.FailureProbability == 0.10m
            && policy.SimpleFailureReservePercent == 0m
            && policy.FixedOverheadPerOrderGs == 0m
            && policy.OverheadPercent == 5m
            && policy.MonthlyOverheadGs == 0m
            && policy.ExpectedMonthlyProductiveHours == 0m
            && policy.TargetMarginPercent == 40m
            && policy.MinimumMarginPercent == 30m
            && policy.MinimumOrderGs == 30_000m
            && policy.RoundingIncrementGs == 5_000m
            && policy.RoundUp
            && policy.VariableSellingFeePercent == 0m
            && policy.FixedSellingFeeGs == 0m
            && energy.Id == SeedData.EnergyProfileId
            && energy.IsActive
            && IsEffective(energy.EffectiveFrom, energy.EffectiveTo, today)
            && energy.AveragePrintPowerW == 95m
            && energy.IdlePowerW == 5m
            && energy.MaxPowerW == 1_300m
            && energy.WarmupKWh == 0m
            && energy.AccessoryKWh == 0m
            && tariff.IsActive
            && IsEffective(tariff.EffectiveFrom, tariff.EffectiveTo, today)
            && tariff.BaseRateGsPerKWh == 435.51m
            && tariff.AdditionalChargesPercent == 0m
            && tariff.ExplicitEffectiveRateGsPerKWh is null;
        return new SimplePricingSettings(
            machineRate,
            preparationMinutes,
            laborRate,
            decimal.Round(preparationMinutes / 60m * laborRate, 2),
            settings.DefaultQuickPackagingCostGs ?? 0m,
            policy.FailureProbability * 100m,
            policy.OverheadPercent,
            policy.TargetMarginPercent,
            policy.MinimumMarginPercent,
            policy.MinimumOrderGs,
            policy.RoundingIncrementGs,
            energy.AveragePrintPowerW,
            electricityRate,
            printer.Name,
            tariff.Name,
            recommended,
            advancedOverrides.Count > 0,
            advancedOverrides.Distinct(StringComparer.Ordinal).ToArray());
    }

    private static bool IsEffective(DateOnly? from, DateOnly? to, DateOnly today) =>
        (from is null || from <= today) && (to is null || to >= today);

    public async Task<string> NextQuoteCodeAsync(int year, CancellationToken cancellationToken = default)
    {
        var prefix = $"COT-{year}-";
        var last = await db.Quotes.AsNoTracking().Where(x => x.Code.StartsWith(prefix)).OrderByDescending(x => x.Code).Select(x => x.Code).FirstOrDefaultAsync(cancellationToken);
        var number = last is null || !int.TryParse(last[prefix.Length..], out var parsed) ? 1 : parsed + 1;
        return $"{prefix}{number:0000}";
    }

    public async Task AddQuoteAsync(QuoteRecord quote, CancellationToken cancellationToken = default)
    {
        db.Quotes.Add(ToEntity(quote));
        await db.SaveChangesAsync(cancellationToken);
    }

    public async Task<QuoteRecord?> GetQuoteAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var entity = await db.Quotes.AsNoTracking().Include(x => x.Revisions).SingleOrDefaultAsync(x => x.Id == id, cancellationToken);
        return entity is null ? null : ToRecord(entity);
    }

    public async Task<IReadOnlyList<QuoteSummary>> ListQuotesAsync(string? status, DateOnly? from, DateOnly? to, int skip, int take, CancellationToken cancellationToken = default)
    {
        var query = db.Quotes.AsNoTracking().AsQueryable();
        if (Enum.TryParse<QuoteStatus>(status, true, out var parsed)) query = query.Where(x => x.Status == parsed);
        if (from is not null) query = query.Where(x => x.CreatedAt >= new DateTimeOffset(from.Value.ToDateTime(TimeOnly.MinValue), TimeSpan.Zero));
        if (to is not null) query = query.Where(x => x.CreatedAt < new DateTimeOffset(to.Value.AddDays(1).ToDateTime(TimeOnly.MinValue), TimeSpan.Zero));
        var entities = await query
            .Include(x => x.Customer)
            .Include(x => x.Revisions)
            .ToArrayAsync(cancellationToken);
        var rows = entities.Select(x =>
        {
            var latest = x.Revisions.MaxBy(revision => revision.RevisionNumber)
                ?? throw new InvalidOperationException("La cotización no tiene revisiones.");
            var description = DeserializeNullable<List<QuoteLineRecord>>(latest.LinesJson)?
                .FirstOrDefault()?.Description ?? "Impresión 3D";
            return new QuoteSummary(
                x.Id,
                x.Code,
                x.Status,
                x.CreatedAt,
                latest.FinalNetSalePriceGs,
                latest.RevisionNumber,
                description,
                x.CustomerReference ?? x.Customer?.Name);
        });
        return rows.OrderByDescending(x => x.CreatedAt).Skip(Math.Max(skip, 0)).Take(Math.Clamp(take, 1, 100)).ToArray();
    }

    public async Task UpdateQuoteAsync(QuoteRecord quote, CancellationToken cancellationToken = default)
    {
        var entity = await db.Quotes.Include(x => x.Revisions).SingleAsync(x => x.Id == quote.Id, cancellationToken);
        entity.Status = quote.Status;
        entity.UpdatedAt = quote.UpdatedAt;
        entity.CustomerId = quote.CustomerId;
        entity.CustomerReference = quote.CustomerReference;
        entity.ItemDescription = quote.ItemDescription;
        entity.ValidUntil = quote.ValidUntil;
        entity.Notes = quote.Notes;
        entity.Terms = quote.Terms;
        foreach (var revision in quote.Revisions.Where(r => entity.Revisions.All(existing => existing.Id != r.Id)))
            db.QuoteRevisions.Add(ToEntity(revision, quote.Id));
        await db.SaveChangesAsync(cancellationToken);
    }

    public async Task AddJobAsync(PrintJobRecord job, CancellationToken cancellationToken = default)
    {
        db.PrintJobs.Add(ToEntity(job));
        await db.SaveChangesAsync(cancellationToken);
    }

    public async Task<PrintJobRecord?> GetJobAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var entity = await db.PrintJobs.AsNoTracking()
            .Include(x => x.MaterialUsages)
            .Include(x => x.LaborEntries)
            .Include(x => x.AdditionalCosts)
            .Include(x => x.CostSnapshot)
            .SingleOrDefaultAsync(x => x.Id == id, cancellationToken);
        return entity is null ? null : ToRecord(entity);
    }

    public async Task<IReadOnlyList<PrintJobSummary>> ListJobsAsync(string? status, DateOnly? from, DateOnly? to, int skip, int take, CancellationToken cancellationToken = default)
    {
        var query = db.PrintJobs.AsNoTracking().AsQueryable();
        if (Enum.TryParse<PrintJobStatus>(status, true, out var parsed)) query = query.Where(x => x.Status == parsed);
        if (from is not null) query = query.Where(x => x.CreatedAt >= new DateTimeOffset(from.Value.ToDateTime(TimeOnly.MinValue), TimeSpan.Zero));
        if (to is not null) query = query.Where(x => x.CreatedAt < new DateTimeOffset(to.Value.AddDays(1).ToDateTime(TimeOnly.MinValue), TimeSpan.Zero));
        var entities = await query.ToArrayAsync(cancellationToken);
        var rows = entities.Select(x =>
        {
            var estimate = Deserialize<QuoteRevisionRecord>(x.EstimateJson);
            var actual = DeserializeNullable<ActualCostResult>(x.ActualResultJson);
            return new PrintJobSummary(
                x.Id,
                x.Code,
                x.Status,
                x.CreatedAt,
                estimate.TotalCustomerPriceGs,
                actual?.ActualCustomerTotalGs,
                x.EstimatedCostGs,
                x.ActualCostGs,
                estimate.EffectiveLines.FirstOrDefault()?.Description ?? "Impresión 3D");
        }).ToArray();
        return rows.OrderByDescending(x => x.CreatedAt).Skip(Math.Max(skip, 0)).Take(Math.Clamp(take, 1, 100)).ToArray();
    }

    public async Task UpdateJobAsync(PrintJobRecord job, IReadOnlyList<InventoryConsumption>? consumption, Guid actorId, CancellationToken cancellationToken = default)
    {
        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);
        var entity = await db.PrintJobs
            .Include(x => x.MaterialUsages)
            .Include(x => x.LaborEntries)
            .Include(x => x.AdditionalCosts)
            .Include(x => x.CostSnapshot)
            .SingleAsync(x => x.Id == job.Id, cancellationToken);
        entity.Status = job.Status;
        entity.StartedAt = job.StartedAt;
        entity.CompletedAt = job.CompletedAt;
        entity.ActualInputJson = SerializeNullable(job.ActualInput);
        entity.ActualResultJson = SerializeNullable(job.ActualResult);
        entity.ActualCostGs = job.ActualResult?.FullyLoadedCostGs;
        if (consumption is not null && !await db.InventoryMovements.AnyAsync(x => x.ReferenceType == "PrintJob" && x.ReferenceId == job.Id && x.Type == "Consumption", cancellationToken))
        {
            foreach (var group in consumption.GroupBy(x => x.SpoolId))
            {
                var spool = await db.FilamentSpools.SingleAsync(x => x.Id == group.Key, cancellationToken);
                var required = group.Sum(x => x.Grams);
                if (spool.IsInventoryTracked && spool.RemainingWeightGrams < required)
                    throw new InvalidOperationException($"Inventario insuficiente para el filamento {spool.Material} {spool.Color}.");
            }
            foreach (var item in consumption)
            {
                var spool = await db.FilamentSpools.SingleAsync(x => x.Id == item.SpoolId, cancellationToken);
                if (spool.IsInventoryTracked) spool.RemainingWeightGrams -= item.Grams;
                db.InventoryMovements.Add(new InventoryMovementEntity
                {
                    Id = Guid.NewGuid(), SpoolId = item.SpoolId, Type = "Consumption", Grams = -item.Grams,
                    ReferenceType = "PrintJob", ReferenceId = item.JobId, Reason = item.Reason,
                    CreatedBy = actorId, CreatedAt = DateTimeOffset.UtcNow
                });
            }
        }

        if (job.ActualDetails is not null && entity.MaterialUsages.Count == 0 && entity.LaborEntries.Count == 0 && entity.AdditionalCosts.Count == 0)
        {
            db.PrintJobMaterialUsages.AddRange(job.ActualDetails.Materials.Select(x => new PrintJobMaterialUsageEntity
            {
                Id = Guid.NewGuid(), PrintJobId = job.Id, SpoolId = x.SpoolId, Grams = x.Grams,
                CostPerGramSnapshotGs = x.CostPerGramGs, CostGs = x.CostGs
            }));
            db.PrintJobLaborEntries.AddRange(job.ActualDetails.Labor.Select(x => new PrintJobLaborEntryEntity
            {
                Id = Guid.NewGuid(), PrintJobId = job.Id, Category = x.Category, Minutes = x.Minutes,
                HourlyRateSnapshotGs = x.HourlyRateGs, CostGs = x.CostGs
            }));
            db.PrintJobAdditionalCosts.AddRange(job.ActualDetails.AdditionalCosts.Select(x => new PrintJobAdditionalCostEntity
            {
                Id = Guid.NewGuid(), PrintJobId = job.Id, Description = x.Description, AmountGs = x.AmountGs,
                IsInternalCost = x.IsInternalCost, ParticipatesInMargin = x.ParticipatesInMargin
            }));
        }
        if (job.ActualResult is not null && entity.CostSnapshot is not null)
        {
            entity.CostSnapshot.ImmutableJson = Serialize(new { job.Estimate, job.ActualInput, job.ActualResult, job.ActualDetails });
        }

        await db.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<AppUserDto>> ListActiveUsersAsync(CancellationToken cancellationToken = default) =>
        await db.AppUsers.AsNoTracking().Where(x => x.IsActive).OrderBy(x => x.DisplayName)
            .Select(x => new AppUserDto(x.Id, x.Username, x.DisplayName, x.Role, x.IsActive)).ToArrayAsync(cancellationToken);

    public async Task<AppUserDto?> GetUserAsync(Guid id, CancellationToken cancellationToken = default) =>
        await db.AppUsers.AsNoTracking().Where(x => x.Id == id && x.IsActive)
            .Select(x => new AppUserDto(x.Id, x.Username, x.DisplayName, x.Role, x.IsActive)).SingleOrDefaultAsync(cancellationToken);

    public async Task<AuthCredentialDto?> GetCredentialAsync(Guid userId, CancellationToken cancellationToken = default) =>
        await db.AuthCredentials.AsNoTracking().Where(x => x.UserId == userId)
            .Select(x => new AuthCredentialDto(x.UserId, x.PinHash, x.FailedAttemptCount, x.LockedUntil, x.UpdatedAt)).SingleOrDefaultAsync(cancellationToken);

    public async Task UpsertCredentialAsync(AuthCredentialDto credential, CancellationToken cancellationToken = default)
    {
        var entity = await db.AuthCredentials.SingleOrDefaultAsync(x => x.UserId == credential.UserId, cancellationToken);
        if (entity is null)
        {
            db.AuthCredentials.Add(new AuthCredentialEntity
            {
                UserId = credential.UserId, PinHash = credential.PinHash, FailedAttemptCount = credential.FailedAttemptCount,
                LockedUntil = credential.LockedUntil, UpdatedAt = credential.UpdatedAt
            });
        }
        else
        {
            entity.PinHash = credential.PinHash;
            entity.FailedAttemptCount = credential.FailedAttemptCount;
            entity.LockedUntil = credential.LockedUntil;
            entity.UpdatedAt = credential.UpdatedAt;
        }
        await db.SaveChangesAsync(cancellationToken);
    }

    public async Task AddAuditAsync(Guid? actorId, string action, string entityType, Guid? entityId, string? detail, CancellationToken cancellationToken = default)
    {
        db.AuditLogs.Add(new AuditLogEntity
        {
            Id = Guid.NewGuid(), ActorId = actorId, Action = action, EntityType = entityType,
            EntityId = entityId, Detail = detail, CreatedAt = DateTimeOffset.UtcNow
        });
        await db.SaveChangesAsync(cancellationToken);
    }

    private static QuoteEntity ToEntity(QuoteRecord quote) => new()
    {
        CustomerReference = quote.CustomerReference, ItemDescription = quote.ItemDescription,
        Id = quote.Id, Code = quote.Code, CustomerId = quote.CustomerId, CreatedAt = quote.CreatedAt, UpdatedAt = quote.UpdatedAt,
        ValidUntil = quote.ValidUntil, CreatedBy = quote.CreatedBy, Currency = quote.Currency, Notes = quote.Notes,
        Terms = quote.Terms, Status = quote.Status, Revisions = quote.Revisions.Select(x => ToEntity(x, quote.Id)).ToList()
    };

    private static QuoteRevisionEntity ToEntity(QuoteRevisionRecord revision, Guid quoteId)
    {
        var lines = revision.EffectiveLines;
        return new QuoteRevisionEntity
        {
            CustomerReference = revision.CustomerReference, ItemDescription = revision.ItemDescription,
            Id = revision.Id, QuoteId = quoteId, RevisionNumber = revision.RevisionNumber, CreatedAt = revision.CreatedAt,
            CreatedBy = revision.CreatedBy, RequestJson = Serialize(revision.Request), SnapshotJson = Serialize(revision.Snapshot),
            BreakdownJson = Serialize(revision.Breakdown), LinesJson = Serialize(lines),
            AggregateJson = SerializeNullable(revision.Aggregate),
            FullyLoadedCostGs = revision.TotalFullyLoadedCostGs,
            FinalNetSalePriceGs = revision.TotalCustomerPriceGs,
            CostSnapshot = new QuoteCostSnapshotEntity
            {
                Id = Guid.NewGuid(), QuoteRevisionId = revision.Id,
                ImmutableJson = Serialize(new { Lines = lines, revision.Aggregate }), CreatedAt = revision.CreatedAt
            },
            Lines = lines.Select(line =>
                new QuoteLineEntity
                {
                    Id = line.Id, QuoteRevisionId = revision.Id, Description = line.Description,
                    Quantity = line.Breakdown.Quantity, UnitsPerPlate = line.Request.Quantity.UnitsPerPlate,
                    NumberOfPlates = line.Breakdown.NumberOfPlates,
                    Materials = line.Breakdown.Materials.Select(x => new QuoteMaterialLineEntity
                    {
                        Id = Guid.NewGuid(), QuoteLineId = line.Id, SpoolId = x.SpoolId,
                        CostPerGramSnapshotGs = x.CostPerGramGs, ChargeableGrams = x.TotalChargeableGrams, CostGs = x.CostGs
                    }).ToList(),
                    Labor = line.Snapshot.Labor.Select(x => new QuoteLaborLineEntity
                    {
                        Id = Guid.NewGuid(), QuoteLineId = line.Id, Category = x.Category, Minutes = x.Minutes,
                        HourlyRateSnapshotGs = x.HourlyRateGs,
                        CostGs = ScopedCost(x.Minutes / 60m * x.HourlyRateGs, x.Scope, line.Request.Quantity),
                        RepeatOnFailure = x.RepeatOnFailure, Scope = x.Scope
                    }).ToList(),
                    AdditionalCosts = line.Snapshot.AdditionalCosts.Select(x => new QuoteAdditionalCostLineEntity
                    {
                        Id = Guid.NewGuid(), QuoteLineId = line.Id, Description = x.Description,
                        AmountGs = ScopedCost(x.AmountGs, x.Scope, line.Request.Quantity),
                        RepeatOnFailure = x.RepeatOnFailure, Scope = x.Scope,
                        IsInternalCost = x.IsInternalCost, ParticipatesInMargin = x.ParticipatesInMargin
                    }).ToList()
                }).ToList()
        };
    }

    private static QuoteRecord ToRecord(QuoteEntity entity) => new(
        entity.Id, entity.Code, entity.CustomerId, entity.CreatedAt, entity.UpdatedAt, entity.ValidUntil, entity.CreatedBy,
        entity.Currency, entity.Notes, entity.Terms, entity.Status,
        entity.Revisions.OrderBy(x => x.RevisionNumber).Select(x => new QuoteRevisionRecord(
            x.Id, x.RevisionNumber, x.CreatedAt, x.CreatedBy,
            Deserialize<QuotePreviewRequest>(x.RequestJson), Deserialize<QuoteCalculationInput>(x.SnapshotJson),
            Deserialize<QuoteCalculationResult>(x.BreakdownJson),
            DeserializeNullable<List<QuoteLineRecord>>(x.LinesJson),
            DeserializeNullable<QuoteAggregateRecord>(x.AggregateJson), x.CustomerReference, x.ItemDescription)).ToArray(),
        entity.CustomerReference, entity.ItemDescription);

    private static PrintJobEntity ToEntity(PrintJobRecord job) => new()
    {
        Id = job.Id, QuoteId = job.QuoteId, PrinterId = job.PrinterId, Code = job.Code, Status = job.Status,
        CreatedAt = job.CreatedAt, StartedAt = job.StartedAt, CompletedAt = job.CompletedAt,
        EstimateJson = Serialize(job.Estimate), ActualInputJson = SerializeNullable(job.ActualInput),
        ActualResultJson = SerializeNullable(job.ActualResult), EstimatedCostGs = job.Estimate.TotalFullyLoadedCostGs,
        ActualCostGs = job.ActualResult?.FullyLoadedCostGs,
        CostSnapshot = new PrintJobCostSnapshotEntity { Id = Guid.NewGuid(), PrintJobId = job.Id, ImmutableJson = Serialize(job.Estimate), CreatedAt = job.CreatedAt }
    };

    private static PrintJobRecord ToRecord(PrintJobEntity entity)
    {
        var details = entity.MaterialUsages.Count == 0 && entity.LaborEntries.Count == 0 && entity.AdditionalCosts.Count == 0
            ? null
            : new PrintJobActualDetails(
                entity.MaterialUsages.Select(x => new ActualMaterialCostLine(x.SpoolId, x.Grams, x.CostPerGramSnapshotGs, x.CostGs)).ToArray(),
                entity.LaborEntries.Select(x => new ActualLaborCostLine(x.Category, x.Minutes, x.HourlyRateSnapshotGs, x.CostGs)).ToArray(),
                entity.AdditionalCosts.Select(x => new ActualAdditionalCostLine(x.Description, x.AmountGs, x.IsInternalCost, x.ParticipatesInMargin)).ToArray());
        return new PrintJobRecord(
            entity.Id, entity.QuoteId, entity.PrinterId, entity.Code, entity.Status, entity.CreatedAt, entity.StartedAt,
            entity.CompletedAt, Deserialize<QuoteRevisionRecord>(entity.EstimateJson),
            DeserializeActualInput(entity.ActualInputJson),
            DeserializeNullable<ActualCostResult>(entity.ActualResultJson), details);
    }

    private static decimal ScopedCost(decimal amount, CostScope scope, QuantityPlan quantity) => scope switch
    {
        CostScope.FixedPerOrder or CostScope.FixedPerQuoteLine => amount,
        CostScope.PerPlate => amount * quantity.NumberOfPlates,
        CostScope.PerUnit => amount * quantity.Quantity,
        _ => throw new InvalidOperationException("Scope de costo inválido.")
    };

    private static string Serialize<T>(T value) => JsonSerializer.Serialize(value, JsonOptions);
    private static string? SerializeNullable<T>(T? value) where T : class => value is null ? null : Serialize(value);
    private static T Deserialize<T>(string value) => JsonSerializer.Deserialize<T>(value, JsonOptions) ?? throw new InvalidOperationException("Snapshot JSON inválido.");
    private static T? DeserializeNullable<T>(string? value) where T : class => value is null ? null : Deserialize<T>(value);

    private static CompleteJobRequest? DeserializeActualInput(string? value)
    {
        if (value is null) return null;
        using var document = JsonDocument.Parse(value);
        if (!document.RootElement.TryGetProperty("finalChargedNetGs", out var legacyNet))
            return Deserialize<CompleteJobRequest>(value);

        var legacy = Deserialize<LegacyCompleteJobRequest>(value);
        return new CompleteJobRequest(
            legacy.ActualOccupiedHours,
            legacy.ActualKWh,
            legacy.Attempts,
            legacy.FailedAttempts,
            legacy.Materials,
            legacy.Labor,
            legacy.AdditionalCosts,
            legacy.ActualOverheadGs,
            legacyNet.GetDecimal(),
            0m,
            legacy.Notes);
    }

    private sealed record LegacyCompleteJobRequest(
        decimal ActualOccupiedHours,
        decimal ActualKWh,
        int Attempts,
        int FailedAttempts,
        IReadOnlyList<ActualMaterialUsage> Materials,
        IReadOnlyList<ActualLaborEntry> Labor,
        IReadOnlyList<AdditionalCostInput> AdditionalCosts,
        decimal ActualOverheadGs,
        decimal FinalChargedNetGs,
        string? Notes);
}
