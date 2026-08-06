using PrintCost.Application.Abstractions;
using PrintCost.Domain.Pricing;

namespace PrintCost.Application.Quotes;

public sealed class QuoteWorkflowService(IPrintCostRepository repository, QuoteCalculationService calculator)
{
    public async Task<QuoteRecord> CreateAsync(CreateQuoteRequest request, Guid actorId, DateTimeOffset? now = null, CancellationToken cancellationToken = default)
    {
        var current = now ?? DateTimeOffset.UtcNow;
        var preview = await calculator.PreviewAsync(request.Calculation, cancellationToken);
        var quoteId = Guid.NewGuid();
        var revision = NewRevision(1, actorId, current, request.Calculation, preview);
        var quote = new QuoteRecord(
            quoteId, await repository.NextQuoteCodeAsync(current.Year, cancellationToken), request.CustomerId,
            current, current, request.ValidUntil, actorId, "PYG", request.Notes, request.Terms,
            QuoteStatus.Calculated, [revision]);
        await repository.AddQuoteAsync(quote, cancellationToken);
        await repository.AddAuditAsync(actorId, "Quote.Created", "Quote", quoteId, quote.Code, cancellationToken);
        return quote;
    }

    public async Task<QuoteRecord> CreateRevisionAsync(Guid quoteId, Guid actorId, CancellationToken cancellationToken = default)
    {
        var quote = await RequireQuote(quoteId, cancellationToken);
        if (quote.Status is QuoteStatus.Accepted or QuoteStatus.ConvertedToJob or QuoteStatus.Cancelled)
            throw new InvalidOperationException("El estado de la cotización no permite una nueva revisión.");
        var previous = quote.Revisions.MaxBy(x => x.RevisionNumber)!;
        var preview = await calculator.PreviewAsync(previous.Request, cancellationToken);
        var revision = NewRevision(previous.RevisionNumber + 1, actorId, DateTimeOffset.UtcNow, previous.Request, preview);
        quote = quote with
        {
            UpdatedAt = DateTimeOffset.UtcNow,
            Status = QuoteStatus.Calculated,
            Revisions = quote.Revisions.Append(revision).ToArray()
        };
        await repository.UpdateQuoteAsync(quote, cancellationToken);
        await repository.AddAuditAsync(actorId, "Quote.RevisedWithCurrentCosts", "Quote", quote.Id, $"Revision {revision.RevisionNumber}", cancellationToken);
        return quote;
    }

    public async Task<QuoteRecord> TransitionAsync(Guid quoteId, QuoteStatus target, Guid actorId, CancellationToken cancellationToken = default)
    {
        var quote = await RequireQuote(quoteId, cancellationToken);
        var allowed = (quote.Status, target) switch
        {
            (QuoteStatus.Calculated, QuoteStatus.ReadyToSend) => true,
            (QuoteStatus.ReadyToSend, QuoteStatus.Sent) => true,
            (QuoteStatus.Sent, QuoteStatus.Accepted or QuoteStatus.Rejected or QuoteStatus.Expired) => true,
            (_, QuoteStatus.Cancelled) when quote.Status is not QuoteStatus.ConvertedToJob => true,
            _ => false
        };
        if (!allowed) throw new InvalidOperationException($"Transición inválida: {quote.Status} -> {target}.");
        if (target == QuoteStatus.ReadyToSend)
        {
            var current = quote.Revisions.MaxBy(x => x.RevisionNumber)!;
            if (!current.Breakdown.Machine.IsConfigured || current.Breakdown.Warnings.Any(x => x.Contains("sin tarifa", StringComparison.OrdinalIgnoreCase)))
                throw new InvalidOperationException("La cotización tiene costos obligatorios pendientes.");
        }

        quote = quote with { Status = target, UpdatedAt = DateTimeOffset.UtcNow };
        await repository.UpdateQuoteAsync(quote, cancellationToken);
        await repository.AddAuditAsync(actorId, $"Quote.{target}", "Quote", quote.Id, null, cancellationToken);
        return quote;
    }

    public async Task<PrintJobRecord> ConvertToJobAsync(Guid quoteId, Guid actorId, CancellationToken cancellationToken = default)
    {
        var quote = await RequireQuote(quoteId, cancellationToken);
        if (quote.Status != QuoteStatus.Accepted) throw new InvalidOperationException("Solo una cotización aceptada puede convertirse en trabajo.");
        var estimate = quote.Revisions.MaxBy(x => x.RevisionNumber)!;
        var job = new PrintJobRecord(
            Guid.NewGuid(), quote.Id, estimate.Request.PrinterId, quote.Code.Replace("COT-", "JOB-", StringComparison.Ordinal),
            PrintJobStatus.Planned, DateTimeOffset.UtcNow, null, null, estimate, null, null);
        await repository.AddJobAsync(job, cancellationToken);
        quote = quote with { Status = QuoteStatus.ConvertedToJob, UpdatedAt = DateTimeOffset.UtcNow };
        await repository.UpdateQuoteAsync(quote, cancellationToken);
        await repository.AddAuditAsync(actorId, "Quote.ConvertedToJob", "PrintJob", job.Id, quote.Code, cancellationToken);
        return job;
    }

    public async Task<PrintJobRecord> StartJobAsync(Guid jobId, Guid actorId, CancellationToken cancellationToken = default)
    {
        var job = await RequireJob(jobId, cancellationToken);
        if (job.Status is not PrintJobStatus.Planned and not PrintJobStatus.Paused) throw new InvalidOperationException("El trabajo no puede iniciarse en su estado actual.");
        job = job with { Status = PrintJobStatus.Printing, StartedAt = job.StartedAt ?? DateTimeOffset.UtcNow };
        await repository.UpdateJobAsync(job, null, actorId, cancellationToken);
        return job;
    }

    public async Task<PrintJobRecord> CompleteJobAsync(Guid jobId, CompleteJobRequest actual, Guid actorId, CancellationToken cancellationToken = default)
    {
        var job = await RequireJob(jobId, cancellationToken);
        if (job.Status is not PrintJobStatus.Printing and not PrintJobStatus.Paused and not PrintJobStatus.Planned)
            throw new InvalidOperationException("El trabajo no puede completarse en su estado actual.");
        if (actual.ActualKWh < 0m || actual.ActualOccupiedHours < 0m || actual.Materials.Any(x => x.Grams < 0m))
            throw new InvalidOperationException("Los consumos reales no pueden ser negativos.");

        var estimate = job.Estimate;
        var materialCost = 0m;
        foreach (var usage in actual.Materials)
        {
            var estimatedSnapshot = estimate.Breakdown.Materials.FirstOrDefault(x => x.SpoolId == usage.SpoolId);
            if (estimatedSnapshot is not null)
            {
                materialCost += estimatedSnapshot.CostPerGramGs * usage.Grams;
                continue;
            }

            var actualSpool = await repository.GetFilamentSnapshotAsync(usage.SpoolId, cancellationToken)
                ?? throw new InvalidOperationException("El rollo utilizado no existe.");
            var actualSnapshot = PricingCalculator.CalculateMaterial(new MaterialCostInput(
                actualSpool.Id, actualSpool.PurchaseCurrency, actualSpool.PurchaseAmount, actualSpool.ExchangeRateGs,
                actualSpool.AllocatedShippingGs, actualSpool.AllocatedImportFeesGs, actualSpool.AllocatedOtherCostsGs,
                actualSpool.NetWeightGrams, SlicerTotalGrams: usage.Grams));
            materialCost += actualSnapshot.CostGs;
        }
        var electricity = actual.ActualKWh * estimate.Breakdown.Energy.EffectiveRateGsPerKWh;
        var machine = actual.ActualOccupiedHours * estimate.Breakdown.Machine.HourlyRateGs;
        var labor = actual.Labor.Sum(entry =>
        {
            var source = estimate.Snapshot.Labor.FirstOrDefault(x => string.Equals(x.Category, entry.Category, StringComparison.OrdinalIgnoreCase));
            return entry.Minutes / 60m * (source?.HourlyRateGs ?? 0m);
        });
        var additional = actual.AdditionalCosts.Sum(x => x.AmountGs);
        var fullCost = materialCost + electricity + machine + labor + additional + actual.ActualOverheadGs;
        var fees = actual.FinalChargedNetGs * estimate.Snapshot.Pricing.VariableSellingFeePercent / 100m + estimate.Snapshot.Pricing.FixedSellingFeeGs;
        var netRevenue = actual.FinalChargedNetGs - fees;
        var profit = netRevenue - fullCost;
        var margin = actual.FinalChargedNetGs == 0m ? 0m : profit / actual.FinalChargedNetGs * 100m;
        var estimated = estimate.Breakdown;
        var actualResult = new ActualCostResult(
            materialCost, electricity, machine, labor, additional, actual.ActualOverheadGs, fullCost, netRevenue, profit, margin,
            materialCost - estimated.MaterialCostGs,
            electricity - estimated.Energy.CostGs,
            machine - estimated.Machine.CostGs,
            fullCost - estimated.FullyLoadedCostGs,
            profit - estimated.EstimatedProfitGs,
            margin - estimated.AchievedMarginPercent);
        job = job with
        {
            Status = PrintJobStatus.Completed,
            CompletedAt = DateTimeOffset.UtcNow,
            ActualInput = actual,
            ActualResult = actualResult
        };
        var consumption = actual.Materials.Select(x => new InventoryConsumption(x.SpoolId, x.Grams, job.Id, "Consumo real al completar trabajo")).ToArray();
        await repository.UpdateJobAsync(job, consumption, actorId, cancellationToken);
        await repository.AddAuditAsync(actorId, "PrintJob.Completed", "PrintJob", job.Id, null, cancellationToken);
        return job;
    }

    private async Task<QuoteRecord> RequireQuote(Guid id, CancellationToken cancellationToken) =>
        await repository.GetQuoteAsync(id, cancellationToken) ?? throw new InvalidOperationException("Cotización no encontrada.");

    private async Task<PrintJobRecord> RequireJob(Guid id, CancellationToken cancellationToken) =>
        await repository.GetJobAsync(id, cancellationToken) ?? throw new InvalidOperationException("Trabajo no encontrado.");

    private static QuoteRevisionRecord NewRevision(int number, Guid actorId, DateTimeOffset at, QuotePreviewRequest request, QuotePreviewResult preview) =>
        new(Guid.NewGuid(), number, at, actorId, request, preview.Snapshot, preview.Breakdown);
}
