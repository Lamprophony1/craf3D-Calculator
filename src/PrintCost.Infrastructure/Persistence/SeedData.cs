using Microsoft.EntityFrameworkCore;
using PrintCost.Domain.Pricing;
using PrintCost.Infrastructure.Persistence.Entities;

namespace PrintCost.Infrastructure.Persistence;

public static class SeedData
{
    public static readonly Guid RafaId = Guid.Parse("10000000-0000-0000-0000-000000000101");
    public static readonly Guid ClariId = Guid.Parse("10000000-0000-0000-0000-000000000102");
    public static readonly Guid PrinterId = Guid.Parse("20000000-0000-0000-0000-000000000001");
    public static readonly Guid EnergyProfileId = Guid.Parse("20000000-0000-0000-0000-000000000002");
    public static readonly Guid TariffId = Guid.Parse("30000000-0000-0000-0000-000000000001");
    public static readonly Guid PricingPolicyId = Guid.Parse("40000000-0000-0000-0000-000000000001");
    public static readonly Guid SettingsId = Guid.Parse("50000000-0000-0000-0000-000000000001");

    public static async Task EnsureSeededAsync(PrintCostDbContext db, CancellationToken cancellationToken = default)
    {
        if (!await db.AppUsers.AnyAsync(cancellationToken))
        {
            var now = DateTimeOffset.UtcNow;
            db.AppUsers.AddRange(
                new AppUserEntity { Id = RafaId, Username = "rafa", DisplayName = "Rafa", Role = "Owner", IsActive = true, CreatedAt = now, UpdatedAt = now },
                new AppUserEntity { Id = ClariId, Username = "clari", DisplayName = "Clari", Role = "Owner", IsActive = true, CreatedAt = now, UpdatedAt = now });
        }

        if (!await db.Printers.AnyAsync(cancellationToken))
        {
            db.Printers.Add(new PrinterEntity
            {
                Id = PrinterId, Name = "Bambu Lab A1", Manufacturer = "Bambu Lab", Model = "A1", Voltage = 220m,
                MachineCostMode = MachineCostMode.ManualHourlyRate, IsActive = true
            });
            db.EnergyProfiles.Add(new EnergyProfileEntity
            {
                Id = EnergyProfileId, PrinterId = PrinterId, Name = "PLA - referencia Bambu Lab", MaterialFamily = "PLA",
                AveragePrintPowerW = 95m, IdlePowerW = 5m, MaxPowerW = 1300m, WarmupKWh = 0m, AccessoryKWh = 0m,
                SourceName = "Bambu Lab A1 Technical Specifications y A1 Series FAQ", VerifiedAt = new DateOnly(2026, 8, 6),
                EffectiveFrom = new DateOnly(2026, 8, 6), IsActive = true
            });
        }

        if (!await db.ElectricityTariffs.AnyAsync(cancellationToken))
        {
            db.ElectricityTariffs.Add(new ElectricityTariffEntity
            {
                Id = TariffId, Provider = "ANDE", Name = "Residencial Normal 142 - última franja", Category = "Residencial Normal 142",
                BaseRateGsPerKWh = 435.51m, ExcludesTax = true, AdditionalChargesPercent = 0m,
                SourceName = "ANDE - página y calculadora oficial de consumo", VerifiedAt = new DateOnly(2026, 8, 6),
                EffectiveFrom = new DateOnly(2026, 8, 6), IsActive = true
            });
        }

        if (!await db.PricingPolicies.AnyAsync(cancellationToken))
        {
            db.PricingPolicies.Add(new PricingPolicyEntity
            {
                Id = PricingPolicyId, Name = "Política inicial editable", TargetMarginPercent = 40m, MinimumMarginPercent = 30m,
                FailureMode = FailureReserveMode.ExpectedAttempts, FailureProbability = 0.10m, MinimumOrderGs = 30_000m,
                RoundingIncrementGs = 5_000m, RoundUp = true, IsDefault = true, IsActive = true,
                EffectiveFrom = new DateOnly(2026, 8, 6)
            });
        }

        if (!await db.ApplicationSettings.AnyAsync(cancellationToken))
        {
            db.ApplicationSettings.Add(new ApplicationSettingEntity { Id = SettingsId, UpdatedAt = DateTimeOffset.UtcNow });
        }

        await db.SaveChangesAsync(cancellationToken);
    }
}
