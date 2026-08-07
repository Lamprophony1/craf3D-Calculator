using Microsoft.EntityFrameworkCore;
using PrintCost.Domain.Pricing;
using PrintCost.Infrastructure.Persistence.Entities;

namespace PrintCost.Infrastructure.Persistence;

public static class SeedData
{
    public const int RecommendedDefaultsVersion = 2;
    public static readonly Guid RafaId = Guid.Parse("10000000-0000-0000-0000-000000000101");
    public static readonly Guid ClariId = Guid.Parse("10000000-0000-0000-0000-000000000102");
    public static readonly Guid PrinterId = Guid.Parse("20000000-0000-0000-0000-000000000001");
    public static readonly Guid EnergyProfileId = Guid.Parse("20000000-0000-0000-0000-000000000002");
    public static readonly Guid TariffId = Guid.Parse("30000000-0000-0000-0000-000000000001");
    public static readonly Guid PricingPolicyId = Guid.Parse("40000000-0000-0000-0000-000000000001");
    public static readonly Guid SettingsId = Guid.Parse("50000000-0000-0000-0000-000000000001");

    public static async Task EnsureSeededAsync(PrintCostDbContext db, CancellationToken cancellationToken = default)
    {
        await EnsureSettingsSchemaAsync(db, cancellationToken);

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
                MachineCostMode = MachineCostMode.ManualHourlyRate, ManualHourlyRateGs = 2_000m, IsActive = true
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
                RoundingIncrementGs = 5_000m, RoundUp = true, OverheadPercent = 5m,
                DefaultLaborRateGsPerHour = 20_000m, IsDefault = true, IsActive = true,
                EffectiveFrom = new DateOnly(2026, 8, 6)
            });
        }

        if (!await db.ApplicationSettings.AnyAsync(cancellationToken))
        {
            db.ApplicationSettings.Add(new ApplicationSettingEntity
            {
                Id = SettingsId,
                DefaultPrinterId = PrinterId,
                DefaultEnergyProfileId = EnergyProfileId,
                DefaultElectricityTariffId = TariffId,
                DefaultPricingPolicyId = PricingPolicyId,
                DefaultQuickSetupMinutes = 20m,
                DefaultQuickPackagingCostGs = 2_000m,
                RecommendedDefaultsVersion = RecommendedDefaultsVersion,
                UpdatedAt = DateTimeOffset.UtcNow
            });
        }

        await db.SaveChangesAsync(cancellationToken);
        await BackfillRecommendedDefaultsAsync(db, cancellationToken);
        await db.SaveChangesAsync(cancellationToken);
    }

    private static async Task EnsureSettingsSchemaAsync(PrintCostDbContext db, CancellationToken cancellationToken)
    {
        var connection = db.Database.GetDbConnection();
        if (connection.State != System.Data.ConnectionState.Open)
            await connection.OpenAsync(cancellationToken);

        var columns = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        await using (var command = connection.CreateCommand())
        {
            command.CommandText = "PRAGMA table_info('ApplicationSettings');";
            await using var reader = await command.ExecuteReaderAsync(cancellationToken);
            while (await reader.ReadAsync(cancellationToken))
                columns.Add(reader.GetString(1));
        }

        var required = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
        {
            ["DefaultPrinterId"] = "TEXT NULL",
            ["DefaultEnergyProfileId"] = "TEXT NULL",
            ["DefaultElectricityTariffId"] = "TEXT NULL",
            ["DefaultPricingPolicyId"] = "TEXT NULL",
            ["DefaultQuickSetupMinutes"] = "TEXT NULL",
            ["DefaultQuickPackagingCostGs"] = "TEXT NULL",
            ["RecommendedDefaultsVersion"] = "INTEGER NOT NULL DEFAULT 0"
        };

        foreach (var (column, type) in required.Where(x => !columns.Contains(x.Key)))
        {
            await using var command = connection.CreateCommand();
            command.CommandText = $"ALTER TABLE \"ApplicationSettings\" ADD COLUMN \"{column}\" {type};";
            await command.ExecuteNonQueryAsync(cancellationToken);
        }

        await EnsureColumnsAsync(connection, "QuoteRevisions", new Dictionary<string, string>
        {
            ["LinesJson"] = "TEXT NULL",
            ["AggregateJson"] = "TEXT NULL"
        }, cancellationToken);
        await EnsureColumnsAsync(connection, "QuoteLaborLines", new Dictionary<string, string>
        {
            ["Scope"] = "INTEGER NOT NULL DEFAULT 0"
        }, cancellationToken);
        await EnsureColumnsAsync(connection, "QuoteAdditionalCostLines", new Dictionary<string, string>
        {
            ["Scope"] = "INTEGER NOT NULL DEFAULT 0",
            ["IsInternalCost"] = "INTEGER NOT NULL DEFAULT 1",
            ["ParticipatesInMargin"] = "INTEGER NOT NULL DEFAULT 1"
        }, cancellationToken);
        await EnsureColumnsAsync(connection, "PrintJobAdditionalCosts", new Dictionary<string, string>
        {
            ["IsInternalCost"] = "INTEGER NOT NULL DEFAULT 1",
            ["ParticipatesInMargin"] = "INTEGER NOT NULL DEFAULT 1"
        }, cancellationToken);
    }

    private static async Task BackfillRecommendedDefaultsAsync(PrintCostDbContext db, CancellationToken cancellationToken)
    {
        var settings = await db.ApplicationSettings.SingleOrDefaultAsync(x => x.Id == SettingsId, cancellationToken);
        if (settings is null || settings.RecommendedDefaultsVersion >= RecommendedDefaultsVersion) return;

        var printer = await db.Printers.SingleOrDefaultAsync(x => x.Id == PrinterId, cancellationToken);
        if (printer is { MachineCostMode: MachineCostMode.ManualHourlyRate, ManualHourlyRateGs: null })
            printer.ManualHourlyRateGs = 2_000m;

        var policy = await db.PricingPolicies.SingleOrDefaultAsync(x => x.Id == PricingPolicyId, cancellationToken);
        if (policy is not null)
        {
            if (policy.DefaultLaborRateGsPerHour is null) policy.DefaultLaborRateGsPerHour = 20_000m;

            // Overhead 0 was the original seeded placeholder. Only change it when every
            // other pricing field still matches that known baseline.
            var isOriginalSeedBaseline = policy.TargetMarginPercent == 40m
                && policy.MinimumMarginPercent == 30m
                && policy.MinimumOrderGs == 30_000m
                && policy.RoundingIncrementGs == 5_000m
                && policy.RoundUp
                && policy.FailureMode == FailureReserveMode.ExpectedAttempts
                && policy.FailureProbability == 0.10m
                && policy.SimpleFailureReservePercent == 0m
                && policy.FixedOverheadPerOrderGs == 0m
                && policy.OverheadPercent == 0m
                && policy.MonthlyOverheadGs == 0m
                && policy.ExpectedMonthlyProductiveHours == 0m
                && policy.VariableSellingFeePercent == 0m
                && policy.FixedSellingFeeGs == 0m;
            if (isOriginalSeedBaseline) policy.OverheadPercent = 5m;
        }

        if (settings.DefaultPrinterId is null && printer is not null) settings.DefaultPrinterId = printer.Id;
        if (settings.DefaultEnergyProfileId is null
            && await db.EnergyProfiles.AnyAsync(x => x.Id == EnergyProfileId, cancellationToken))
            settings.DefaultEnergyProfileId = EnergyProfileId;
        if (settings.DefaultElectricityTariffId is null
            && await db.ElectricityTariffs.AnyAsync(x => x.Id == TariffId, cancellationToken))
            settings.DefaultElectricityTariffId = TariffId;
        if (settings.DefaultPricingPolicyId is null && policy is not null) settings.DefaultPricingPolicyId = policy.Id;
        settings.DefaultQuickSetupMinutes ??= 20m;
        settings.DefaultQuickPackagingCostGs ??= 2_000m;
        settings.RecommendedDefaultsVersion = RecommendedDefaultsVersion;
        settings.UpdatedAt = DateTimeOffset.UtcNow;
    }

    private static async Task EnsureColumnsAsync(
        System.Data.Common.DbConnection connection,
        string table,
        IReadOnlyDictionary<string, string> required,
        CancellationToken cancellationToken)
    {
        var columns = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        await using (var command = connection.CreateCommand())
        {
            command.CommandText = $"PRAGMA table_info('{table}');";
            await using var reader = await command.ExecuteReaderAsync(cancellationToken);
            while (await reader.ReadAsync(cancellationToken)) columns.Add(reader.GetString(1));
        }
        foreach (var (column, type) in required.Where(x => !columns.Contains(x.Key)))
        {
            await using var command = connection.CreateCommand();
            command.CommandText = $"ALTER TABLE \"{table}\" ADD COLUMN \"{column}\" {type};";
            await command.ExecuteNonQueryAsync(cancellationToken);
        }
    }
}
