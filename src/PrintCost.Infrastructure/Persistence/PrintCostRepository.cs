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

public sealed class PrintCostRepository(PrintCostDbContext db) : IPrintCostRepository
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

    public async Task<EnergyProfileSnapshot?> GetEnergyProfileSnapshotAsync(Guid id, CancellationToken cancellationToken = default) =>
        await db.EnergyProfiles.AsNoTracking().Where(x => x.Id == id && x.IsActive).Select(x => new EnergyProfileSnapshot(
            x.Id, x.PrinterId, x.Name, x.MaterialFamily, x.AveragePrintPowerW, x.IdlePowerW, x.MaxPowerW,
            x.WarmupKWh, x.AccessoryKWh, x.SourceName, x.VerifiedAt, x.IsActive)).SingleOrDefaultAsync(cancellationToken);

    public async Task<ElectricityTariffSnapshot?> GetElectricityTariffSnapshotAsync(Guid id, CancellationToken cancellationToken = default) =>
        await db.ElectricityTariffs.AsNoTracking().Where(x => x.Id == id && x.IsActive).Select(x => new ElectricityTariffSnapshot(
            x.Id, x.Provider, x.Name, x.Category, x.BaseRateGsPerKWh, x.ExcludesTax, x.AdditionalChargesPercent,
            x.ExplicitEffectiveRateGsPerKWh, x.SourceName, x.VerifiedAt, x.IsActive)).SingleOrDefaultAsync(cancellationToken);

    public async Task<FilamentSnapshot?> GetFilamentSnapshotAsync(Guid id, CancellationToken cancellationToken = default) =>
        await db.FilamentSpools.AsNoTracking().Where(x => x.Id == id && x.IsActive).Select(x => new FilamentSnapshot(
            x.Id, x.Manufacturer, x.ProductName, x.Material, x.Color, x.BatchCode, x.PurchaseCurrency,
            x.PurchaseAmount, x.ExchangeRateGs, x.AllocatedShippingGs, x.AllocatedImportFeesGs, x.AllocatedOtherCostsGs,
            x.NetWeightGrams, x.RemainingWeightGrams, x.IsInventoryTracked, x.IsActive)).SingleOrDefaultAsync(cancellationToken);

    public async Task<PricingPolicySnapshot?> GetPricingPolicySnapshotAsync(Guid? id, CancellationToken cancellationToken = default)
    {
        var query = db.PricingPolicies.AsNoTracking().Where(x => x.IsActive);
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
        var rows = await query
            .Select(x => new QuoteSummary(x.Id, x.Code, x.Status, x.CreatedAt,
                x.Revisions.OrderByDescending(r => r.RevisionNumber).Select(r => r.FinalNetSalePriceGs).First(),
                x.Revisions.Max(r => r.RevisionNumber)))
            .ToArrayAsync(cancellationToken);
        return rows.OrderByDescending(x => x.CreatedAt).Skip(Math.Max(skip, 0)).Take(Math.Clamp(take, 1, 100)).ToArray();
    }

    public async Task UpdateQuoteAsync(QuoteRecord quote, CancellationToken cancellationToken = default)
    {
        var entity = await db.Quotes.Include(x => x.Revisions).SingleAsync(x => x.Id == quote.Id, cancellationToken);
        entity.Status = quote.Status;
        entity.UpdatedAt = quote.UpdatedAt;
        entity.CustomerId = quote.CustomerId;
        entity.ValidUntil = quote.ValidUntil;
        entity.Notes = quote.Notes;
        entity.Terms = quote.Terms;
        foreach (var revision in quote.Revisions.Where(r => entity.Revisions.All(existing => existing.Id != r.Id)))
            entity.Revisions.Add(ToEntity(revision, quote.Id));
        await db.SaveChangesAsync(cancellationToken);
    }

    public async Task AddJobAsync(PrintJobRecord job, CancellationToken cancellationToken = default)
    {
        db.PrintJobs.Add(ToEntity(job));
        await db.SaveChangesAsync(cancellationToken);
    }

    public async Task<PrintJobRecord?> GetJobAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var entity = await db.PrintJobs.AsNoTracking().SingleOrDefaultAsync(x => x.Id == id, cancellationToken);
        return entity is null ? null : ToRecord(entity);
    }

    public async Task<IReadOnlyList<PrintJobSummary>> ListJobsAsync(string? status, DateOnly? from, DateOnly? to, int skip, int take, CancellationToken cancellationToken = default)
    {
        var query = db.PrintJobs.AsNoTracking().AsQueryable();
        if (Enum.TryParse<PrintJobStatus>(status, true, out var parsed)) query = query.Where(x => x.Status == parsed);
        if (from is not null) query = query.Where(x => x.CreatedAt >= new DateTimeOffset(from.Value.ToDateTime(TimeOnly.MinValue), TimeSpan.Zero));
        if (to is not null) query = query.Where(x => x.CreatedAt < new DateTimeOffset(to.Value.AddDays(1).ToDateTime(TimeOnly.MinValue), TimeSpan.Zero));
        var rows = await query.Select(x => new PrintJobSummary(x.Id, x.Code, x.Status, x.CreatedAt, x.EstimatedCostGs, x.ActualCostGs)).ToArrayAsync(cancellationToken);
        return rows.OrderByDescending(x => x.CreatedAt).Skip(Math.Max(skip, 0)).Take(Math.Clamp(take, 1, 100)).ToArray();
    }

    public async Task UpdateJobAsync(PrintJobRecord job, IReadOnlyList<InventoryConsumption>? consumption, Guid actorId, CancellationToken cancellationToken = default)
    {
        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);
        var entity = await db.PrintJobs.SingleAsync(x => x.Id == job.Id, cancellationToken);
        entity.Status = job.Status;
        entity.StartedAt = job.StartedAt;
        entity.CompletedAt = job.CompletedAt;
        entity.ActualInputJson = SerializeNullable(job.ActualInput);
        entity.ActualResultJson = SerializeNullable(job.ActualResult);
        entity.ActualCostGs = job.ActualResult?.FullyLoadedCostGs;
        if (consumption is not null && !await db.InventoryMovements.AnyAsync(x => x.ReferenceType == "PrintJob" && x.ReferenceId == job.Id && x.Type == "Consumption", cancellationToken))
        {
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
        Id = quote.Id, Code = quote.Code, CustomerId = quote.CustomerId, CreatedAt = quote.CreatedAt, UpdatedAt = quote.UpdatedAt,
        ValidUntil = quote.ValidUntil, CreatedBy = quote.CreatedBy, Currency = quote.Currency, Notes = quote.Notes,
        Terms = quote.Terms, Status = quote.Status, Revisions = quote.Revisions.Select(x => ToEntity(x, quote.Id)).ToList()
    };

    private static QuoteRevisionEntity ToEntity(QuoteRevisionRecord revision, Guid quoteId)
    {
        var lineId = Guid.NewGuid();
        return new QuoteRevisionEntity
        {
            Id = revision.Id, QuoteId = quoteId, RevisionNumber = revision.RevisionNumber, CreatedAt = revision.CreatedAt,
            CreatedBy = revision.CreatedBy, RequestJson = Serialize(revision.Request), SnapshotJson = Serialize(revision.Snapshot),
            BreakdownJson = Serialize(revision.Breakdown), FullyLoadedCostGs = revision.Breakdown.FullyLoadedCostGs,
            FinalNetSalePriceGs = revision.Breakdown.FinalNetSalePriceGs,
            CostSnapshot = new QuoteCostSnapshotEntity { Id = Guid.NewGuid(), QuoteRevisionId = revision.Id, ImmutableJson = Serialize(new { revision.Snapshot, revision.Breakdown }), CreatedAt = revision.CreatedAt },
            Lines =
            [
                new QuoteLineEntity
                {
                    Id = lineId, QuoteRevisionId = revision.Id, Quantity = revision.Breakdown.Quantity,
                    UnitsPerPlate = revision.Request.Quantity.UnitsPerPlate, NumberOfPlates = revision.Breakdown.NumberOfPlates,
                    Materials = revision.Breakdown.Materials.Select(x => new QuoteMaterialLineEntity
                    {
                        Id = Guid.NewGuid(), QuoteLineId = lineId, SpoolId = x.SpoolId,
                        CostPerGramSnapshotGs = x.CostPerGramGs, ChargeableGrams = x.TotalChargeableGrams, CostGs = x.CostGs
                    }).ToList(),
                    Labor = revision.Snapshot.Labor.Select(x => new QuoteLaborLineEntity
                    {
                        Id = Guid.NewGuid(), QuoteLineId = lineId, Category = x.Category, Minutes = x.Minutes,
                        HourlyRateSnapshotGs = x.HourlyRateGs, CostGs = x.Minutes / 60m * x.HourlyRateGs, RepeatOnFailure = x.RepeatOnFailure
                    }).ToList(),
                    AdditionalCosts = revision.Snapshot.AdditionalCosts.Select(x => new QuoteAdditionalCostLineEntity
                    {
                        Id = Guid.NewGuid(), QuoteLineId = lineId, Description = x.Description, AmountGs = x.AmountGs, RepeatOnFailure = x.RepeatOnFailure
                    }).ToList()
                }
            ]
        };
    }

    private static QuoteRecord ToRecord(QuoteEntity entity) => new(
        entity.Id, entity.Code, entity.CustomerId, entity.CreatedAt, entity.UpdatedAt, entity.ValidUntil, entity.CreatedBy,
        entity.Currency, entity.Notes, entity.Terms, entity.Status,
        entity.Revisions.OrderBy(x => x.RevisionNumber).Select(x => new QuoteRevisionRecord(
            x.Id, x.RevisionNumber, x.CreatedAt, x.CreatedBy,
            Deserialize<QuotePreviewRequest>(x.RequestJson), Deserialize<QuoteCalculationInput>(x.SnapshotJson),
            Deserialize<QuoteCalculationResult>(x.BreakdownJson))).ToArray());

    private static PrintJobEntity ToEntity(PrintJobRecord job) => new()
    {
        Id = job.Id, QuoteId = job.QuoteId, PrinterId = job.PrinterId, Code = job.Code, Status = job.Status,
        CreatedAt = job.CreatedAt, StartedAt = job.StartedAt, CompletedAt = job.CompletedAt,
        EstimateJson = Serialize(job.Estimate), ActualInputJson = SerializeNullable(job.ActualInput),
        ActualResultJson = SerializeNullable(job.ActualResult), EstimatedCostGs = job.Estimate.Breakdown.FullyLoadedCostGs,
        ActualCostGs = job.ActualResult?.FullyLoadedCostGs,
        CostSnapshot = new PrintJobCostSnapshotEntity { Id = Guid.NewGuid(), PrintJobId = job.Id, ImmutableJson = Serialize(job.Estimate), CreatedAt = job.CreatedAt }
    };

    private static PrintJobRecord ToRecord(PrintJobEntity entity) => new(
        entity.Id, entity.QuoteId, entity.PrinterId, entity.Code, entity.Status, entity.CreatedAt, entity.StartedAt,
        entity.CompletedAt, Deserialize<QuoteRevisionRecord>(entity.EstimateJson),
        DeserializeNullable<CompleteJobRequest>(entity.ActualInputJson), DeserializeNullable<ActualCostResult>(entity.ActualResultJson));

    private static string Serialize<T>(T value) => JsonSerializer.Serialize(value, JsonOptions);
    private static string? SerializeNullable<T>(T? value) where T : class => value is null ? null : Serialize(value);
    private static T Deserialize<T>(string value) => JsonSerializer.Deserialize<T>(value, JsonOptions) ?? throw new InvalidOperationException("Snapshot JSON inválido.");
    private static T? DeserializeNullable<T>(string? value) where T : class => value is null ? null : Deserialize<T>(value);
}
