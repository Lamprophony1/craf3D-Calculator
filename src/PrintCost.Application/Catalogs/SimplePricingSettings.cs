using PrintCost.Domain.Pricing;

namespace PrintCost.Application.Catalogs;

public sealed record SimplePricingSettings(
    decimal MachineHourlyRateGs,
    decimal PreparationMinutes,
    decimal LaborHourlyRateGs,
    decimal PreparationCostGs,
    decimal PackagingCostGs,
    decimal FailureProbabilityPercent,
    decimal OverheadPercent,
    decimal TargetMarginPercent,
    decimal MinimumMarginPercent,
    decimal MinimumOrderGs,
    decimal RoundingIncrementGs,
    decimal AveragePrintPowerW,
    decimal ElectricityRateGsPerKWh,
    string PrinterName,
    string ElectricityTariffName,
    bool IsUsingRecommendedDefaults,
    bool HasAdvancedOverrides,
    IReadOnlyList<string> AdvancedOverrideMessages);

public sealed record UpdateSimplePricingSettingsRequest(
    decimal MachineHourlyRateGs,
    decimal PreparationMinutes,
    decimal LaborHourlyRateGs,
    decimal PackagingCostGs,
    decimal FailureProbabilityPercent,
    decimal OverheadPercent,
    decimal TargetMarginPercent,
    decimal MinimumMarginPercent,
    decimal MinimumOrderGs,
    decimal RoundingIncrementGs);

public sealed record SimpleFilamentRequest(
    string Material,
    string DisplayName,
    decimal LandedCostGs,
    decimal NetWeightGrams);

public interface ISimplePricingSettingsRepository
{
    Task<SimplePricingSettings?> GetSimplePricingSettingsAsync(CancellationToken cancellationToken = default);
    Task<SimplePricingSettings> UpdateSimplePricingSettingsAsync(UpdateSimplePricingSettingsRequest request, CancellationToken cancellationToken = default);
    Task<SimplePricingSettings> RestoreRecommendedSimplePricingSettingsAsync(CancellationToken cancellationToken = default);
}

public sealed class SimplePricingSettingsService(ISimplePricingSettingsRepository repository)
{
    public async Task<SimplePricingSettings> GetAsync(CancellationToken cancellationToken = default) =>
        await repository.GetSimplePricingSettingsAsync(cancellationToken)
        ?? throw new InvalidOperationException("No se pudo resolver la configuración de precios.");

    public async Task<SimplePricingSettings> UpdateAsync(
        UpdateSimplePricingSettingsRequest request,
        CancellationToken cancellationToken = default)
    {
        Validate(request);
        return await repository.UpdateSimplePricingSettingsAsync(request, cancellationToken);
    }

    public Task<SimplePricingSettings> RestoreRecommendedAsync(CancellationToken cancellationToken = default) =>
        repository.RestoreRecommendedSimplePricingSettingsAsync(cancellationToken);

    private static void Validate(UpdateSimplePricingSettingsRequest request)
    {
        if (request.MachineHourlyRateGs <= 0m)
            throw new DomainValidationException("El costo de uso de la impresora debe ser mayor que cero.");
        if (request.LaborHourlyRateGs <= 0m)
            throw new DomainValidationException("El valor de tu tiempo debe ser mayor que cero.");
        if (request.PreparationMinutes < 0m || request.PackagingCostGs < 0m || request.MinimumOrderGs < 0m
            || request.RoundingIncrementGs < 0m)
            throw new DomainValidationException("Los tiempos y costos no pueden ser negativos.");
        if (request.FailureProbabilityPercent is < 0m or > 95m
            || request.OverheadPercent is < 0m or > 100m
            || request.TargetMarginPercent is < 0m or >= 100m
            || request.MinimumMarginPercent is < 0m or >= 100m)
            throw new DomainValidationException("Los porcentajes configurados no son válidos.");
        if (request.TargetMarginPercent < request.MinimumMarginPercent)
            throw new DomainValidationException("El margen objetivo no puede ser menor que el margen mínimo.");
    }
}
