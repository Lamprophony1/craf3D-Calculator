using Microsoft.EntityFrameworkCore;
using PrintCost.Api.Auth;
using PrintCost.Application.Abstractions;
using PrintCost.Application.Quotes;
using PrintCost.Domain.Pricing;
using PrintCost.Infrastructure.Persistence;

namespace PrintCost.Api.Endpoints;

public static class ReportEndpoints
{
    public static IEndpointRouteBuilder MapReportEndpoints(this IEndpointRouteBuilder app, AuthSettings settings)
    {
        var api = app.MapGroup("/api").RequireAuthIfPin(settings);
        api.MapGet("/reports/summary", async (PrintCostDbContext db, IPrintCostRepository repository, CancellationToken ct) =>
        {
            var quotes = await db.Quotes.AsNoTracking().Select(x => x.Status).ToArrayAsync(ct);
            var jobs = await db.PrintJobs.AsNoTracking().Select(x => new { x.Status, x.EstimatedCostGs, x.ActualCostGs }).ToArrayAsync(ct);
            var completedJobIds = await db.PrintJobs.AsNoTracking()
                .Where(x => x.Status == PrintJobStatus.Completed && x.ActualResultJson != null)
                .Select(x => x.Id)
                .ToArrayAsync(ct);
            var realizedProfitGs = 0m;
            foreach (var jobId in completedJobIds)
                realizedProfitGs += (await repository.GetJobAsync(jobId, ct))?.ActualResult?.RealizedProfitGs ?? 0m;
            return Results.Ok(new
            {
                quotes = quotes.Length,
                acceptedQuotes = quotes.Count(x => x == QuoteStatus.Accepted || x == QuoteStatus.ConvertedToJob),
                jobs = jobs.Length,
                completedJobs = jobs.Count(x => x.Status == PrintJobStatus.Completed),
                estimatedProductionCostGs = jobs.Sum(x => x.EstimatedCostGs),
                actualProductionCostGs = jobs.Sum(x => x.ActualCostGs ?? 0m),
                realizedProfitGs
            });
        });
        api.MapGet("/reports/profitability", async (IPrintCostRepository repository, CancellationToken ct) => Results.Ok(await ActualRows(repository, ct)));
        api.MapGet("/reports/estimate-vs-actual", async (IPrintCostRepository repository, CancellationToken ct) =>
        {
            var rows = await ActualRows(repository, ct);
            return Results.Ok(rows.Select(x => new
            {
                x.JobId, x.Code, x.EstimatedCostGs, x.ActualCostGs,
                costVarianceGs = x.ActualCostGs - x.EstimatedCostGs,
                x.EstimatedProfitGs, x.RealizedProfitGs,
                profitVarianceGs = x.RealizedProfitGs - x.EstimatedProfitGs,
                x.EstimatedMarginPercent, x.RealizedMarginPercent
            }));
        });
        api.MapGet("/reports/material-consumption", async (PrintCostDbContext db, CancellationToken ct) =>
        {
            var rows = await db.InventoryMovements.AsNoTracking().Where(x => x.Type == "Consumption")
                .Select(x => new { x.SpoolId, x.Grams, x.CreatedAt }).ToArrayAsync(ct);
            return Results.Ok(rows.GroupBy(x => x.SpoolId).Select(g => new { spoolId = g.Key, consumedGrams = -g.Sum(x => x.Grams), movements = g.Count() }));
        });
        api.MapGet("/reports/printer-utilization", async (PrintCostDbContext db, IPrintCostRepository repository, CancellationToken ct) =>
        {
            var ids = await db.PrintJobs.AsNoTracking().Where(x => x.ActualInputJson != null).Select(x => x.Id).ToArrayAsync(ct);
            var jobs = new List<PrintJobRecord>();
            foreach (var id in ids) { var job = await repository.GetJobAsync(id, ct); if (job is not null) jobs.Add(job); }
            return Results.Ok(jobs.GroupBy(x => x.PrinterId).Select(g => new { printerId = g.Key, jobs = g.Count(), occupiedHours = g.Sum(x => x.ActualInput?.ActualOccupiedHours ?? 0m) }));
        });
        api.MapGet("/reports/energy-calibration", async (PrintCostDbContext db, IPrintCostRepository repository, CancellationToken ct) =>
        {
            var ids = await db.PrintJobs.AsNoTracking().Where(x => x.ActualInputJson != null).Select(x => x.Id).ToArrayAsync(ct);
            var points = new List<(Guid PrinterId, decimal Power)>();
            foreach (var id in ids)
            {
                var job = await repository.GetJobAsync(id, ct);
                if (job?.ActualInput is { ActualOccupiedHours: > 0m } actual)
                    points.Add((job.PrinterId, PricingCalculator.CalculateEmpiricalAveragePower(actual.ActualKWh, actual.ActualOccupiedHours)));
            }
            return Results.Ok(points.GroupBy(x => x.PrinterId).Select(g =>
            {
                var ordered = g.Select(x => x.Power).Order().ToArray();
                var median = ordered.Length == 0 ? 0m : ordered.Length % 2 == 1 ? ordered[ordered.Length / 2] : (ordered[ordered.Length / 2 - 1] + ordered[ordered.Length / 2]) / 2m;
                return new { printerId = g.Key, averagePowerW = ordered.Length == 0 ? 0m : ordered.Average(), medianPowerW = median, measurements = ordered.Length };
            }));
        });
        api.MapGet("/audit", async (int? skip, int? take, PrintCostDbContext db, CancellationToken ct) =>
        {
            var rows = await db.AuditLogs.AsNoTracking().ToArrayAsync(ct);
            return Results.Ok(rows.OrderByDescending(x => x.CreatedAt).Skip(Math.Max(skip ?? 0, 0)).Take(Math.Clamp(take ?? 100, 1, 500)));
        })
            .RequireOwnerIfPin(settings);
        return app;
    }

    private static async Task<IReadOnlyList<ProfitabilityRow>> ActualRows(IPrintCostRepository repository, CancellationToken ct)
    {
        var summaries = await repository.ListJobsAsync("Completed", null, null, 0, 100, ct);
        var rows = new List<ProfitabilityRow>();
        foreach (var summary in summaries)
        {
            var job = await repository.GetJobAsync(summary.Id, ct);
            if (job?.ActualResult is null) continue;
            var aggregate = job.Estimate.Aggregate?.Breakdown;
            var estimatedCostGs = aggregate?.FullyLoadedCostGs ?? job.Estimate.TotalFullyLoadedCostGs;
            var estimatedProfitGs = aggregate?.EstimatedProfitGs
                ?? job.Estimate.EffectiveLines.Sum(line => line.Breakdown.EstimatedProfitGs);
            var estimatedMarginPercent = aggregate?.AchievedMarginPercent
                ?? job.Estimate.Breakdown.AchievedMarginPercent;
            rows.Add(new ProfitabilityRow(job.Id, job.Code, estimatedCostGs, job.ActualResult.FullyLoadedCostGs,
                estimatedProfitGs, job.ActualResult.RealizedProfitGs,
                estimatedMarginPercent, job.ActualResult.RealizedMarginPercent));
        }
        return rows;
    }
}

public sealed record ProfitabilityRow(Guid JobId, string Code, decimal EstimatedCostGs, decimal ActualCostGs, decimal EstimatedProfitGs, decimal RealizedProfitGs, decimal EstimatedMarginPercent, decimal RealizedMarginPercent);
