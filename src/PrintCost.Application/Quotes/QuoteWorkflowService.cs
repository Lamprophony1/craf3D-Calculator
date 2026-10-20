using PrintCost.Application.Abstractions;
using PrintCost.Domain.Pricing;

namespace PrintCost.Application.Quotes;

public sealed class QuoteWorkflowService(IPrintCostRepository repository, QuoteCalculationService calculator)
{
    public async Task<QuoteRecord> CreateAsync(
        CreateQuoteRequest request,
        Guid actorId,
        DateTimeOffset? now = null,
        CancellationToken cancellationToken = default)
    {
        var current = now ?? DateTimeOffset.UtcNow;
        var revision = await CalculateRevisionAsync(
            1,
            actorId,
            current,
            ResolveLineRequests(request),
            cancellationToken);
        var quoteId = Guid.NewGuid();
        var quote = new QuoteRecord(
            quoteId,
            await repository.NextQuoteCodeAsync(current.Year, cancellationToken),
            request.CustomerId,
            current,
            current,
            request.ValidUntil,
            actorId,
            "PYG",
            request.Notes,
            request.Terms,
            QuoteStatus.Draft,
            [revision with { CustomerReference = request.CustomerReference, ItemDescription = request.ItemDescription }],
            request.CustomerReference, request.ItemDescription);
        await repository.AddQuoteAsync(quote, cancellationToken);
        await repository.AddAuditAsync(actorId, "Quote.DraftCreated", "Quote", quoteId, quote.Code, cancellationToken);
        return quote;
    }

    public async Task<QuoteRecord> UpdateDraftAsync(
        Guid quoteId,
        CreateQuoteRequest request,
        Guid actorId,
        CancellationToken cancellationToken = default)
    {
        var quote = await RequireQuote(quoteId, cancellationToken);
        if (quote.Status != QuoteStatus.Draft)
            throw new InvalidOperationException("Solo una cotización Draft permite editar sus entradas.");

        var nextNumber = quote.Revisions.Max(x => x.RevisionNumber) + 1;
        var revision = await CalculateRevisionAsync(
            nextNumber,
            actorId,
            DateTimeOffset.UtcNow,
            ResolveLineRequests(request),
            cancellationToken);
        quote = quote with
        {
            CustomerId = request.CustomerId,
            CustomerReference = request.CustomerReference ?? quote.CustomerReference,
            ItemDescription = request.ItemDescription ?? quote.ItemDescription,
            ValidUntil = request.ValidUntil,
            Notes = request.Notes,
            Terms = request.Terms,
            UpdatedAt = DateTimeOffset.UtcNow,
            Revisions = quote.Revisions.Append(revision with { CustomerReference = request.CustomerReference ?? quote.CustomerReference,
                ItemDescription = request.ItemDescription ?? quote.ItemDescription }).ToArray()
        };
        await repository.UpdateQuoteAsync(quote, cancellationToken);
        await repository.AddAuditAsync(actorId, "Quote.DraftUpdated", "Quote", quote.Id, $"Revision {revision.RevisionNumber}", cancellationToken);
        return quote;
    }

    public async Task<QuoteRecord> CreateRevisionAsync(
        Guid quoteId,
        Guid actorId,
        CancellationToken cancellationToken = default)
    {
        var quote = await RequireQuote(quoteId, cancellationToken);
        if (quote.Status is QuoteStatus.Accepted or QuoteStatus.ConvertedToJob or QuoteStatus.Cancelled or QuoteStatus.Rejected)
            throw new InvalidOperationException("El estado de la cotización no permite una nueva revisión.");
        var previous = quote.Revisions.MaxBy(x => x.RevisionNumber)!;
        var requests = previous.EffectiveLines.Select(x => new QuoteLineRequest(x.Description, x.Request)).ToArray();
        var revision = await CalculateRevisionAsync(
            previous.RevisionNumber + 1,
            actorId,
            DateTimeOffset.UtcNow,
            requests,
            cancellationToken);
        quote = quote with
        {
            UpdatedAt = DateTimeOffset.UtcNow,
            Status = QuoteStatus.Calculated,
            Revisions = quote.Revisions.Append(revision with { CustomerReference = quote.CustomerReference, ItemDescription = quote.ItemDescription }).ToArray()
        };
        await repository.UpdateQuoteAsync(quote, cancellationToken);
        await repository.AddAuditAsync(actorId, "Quote.Calculated", "Quote", quote.Id, $"Revision {revision.RevisionNumber}", cancellationToken);
        return quote;
    }

    public async Task<QuoteRecord> TransitionAsync(
        Guid quoteId,
        QuoteStatus target,
        Guid actorId,
        CancellationToken cancellationToken = default)
    {
        var quote = await RequireQuote(quoteId, cancellationToken);
        var allowed = (quote.Status, target) switch
        {
            (QuoteStatus.Calculated, QuoteStatus.ReadyToSend) => true,
            (QuoteStatus.ReadyToSend, QuoteStatus.Sent) => true,
            (QuoteStatus.Sent, QuoteStatus.Accepted or QuoteStatus.Rejected or QuoteStatus.Expired) => true,
            (QuoteStatus.Draft or QuoteStatus.Calculated or QuoteStatus.ReadyToSend or QuoteStatus.Sent, QuoteStatus.Cancelled) => true,
            _ => false
        };
        if (!allowed) throw new InvalidOperationException($"Transición inválida: {quote.Status} -> {target}.");
        if (target == QuoteStatus.ReadyToSend)
        {
            var current = quote.Revisions.MaxBy(x => x.RevisionNumber)!;
            if (!current.CanUsePrice)
            {
                var blockers = current.EffectiveLines.SelectMany(x => x.Warnings).Where(x => x.BlocksPrice).Select(x => x.Message);
                throw new InvalidOperationException($"La cotización tiene costos obligatorios pendientes: {string.Join(" ", blockers)}");
            }
        }

        quote = quote with { Status = target, UpdatedAt = DateTimeOffset.UtcNow };
        await repository.UpdateQuoteAsync(quote, cancellationToken);
        await repository.AddAuditAsync(actorId, $"Quote.{target}", "Quote", quote.Id, null, cancellationToken);
        return quote;
    }

    public async Task<PrintJobRecord> ConvertToJobAsync(
        Guid quoteId,
        Guid actorId,
        CancellationToken cancellationToken = default)
    {
        var quote = await RequireQuote(quoteId, cancellationToken);
        if (quote.Status != QuoteStatus.Accepted)
            throw new InvalidOperationException("Solo una cotización aceptada puede convertirse en trabajo.");
        var estimate = quote.Revisions.MaxBy(x => x.RevisionNumber)!;
        if (estimate.Aggregate is null && estimate.EffectiveLines.Count > 1)
            throw new InvalidOperationException("Una revisión histórica multilínea sin agregado es de solo lectura.");
        var printerIds = estimate.EffectiveLines.Select(x => x.Request.PrinterId).Distinct().ToArray();
        if (printerIds.Length != 1)
            throw new InvalidOperationException("Una cotización convertida a un único trabajo debe usar la misma impresora en todas sus líneas.");
        var job = new PrintJobRecord(
            Guid.NewGuid(),
            quote.Id,
            printerIds[0],
            quote.Code.Replace("COT-", "JOB-", StringComparison.Ordinal),
            PrintJobStatus.Planned,
            DateTimeOffset.UtcNow,
            null,
            null,
            estimate,
            null,
            null);
        await repository.AddJobAsync(job, cancellationToken);
        quote = quote with { Status = QuoteStatus.ConvertedToJob, UpdatedAt = DateTimeOffset.UtcNow };
        await repository.UpdateQuoteAsync(quote, cancellationToken);
        await repository.AddAuditAsync(actorId, "Quote.ConvertedToJob", "PrintJob", job.Id, quote.Code, cancellationToken);
        return job;
    }

    public Task<PrintJobRecord> StartJobAsync(Guid jobId, Guid actorId, CancellationToken cancellationToken = default) =>
        TransitionJobAsync(jobId, PrintJobStatus.Printing, actorId, cancellationToken);

    public async Task<PrintJobRecord> TransitionJobAsync(
        Guid jobId,
        PrintJobStatus target,
        Guid actorId,
        CancellationToken cancellationToken = default)
    {
        var job = await RequireJob(jobId, cancellationToken);
        var allowed = (job.Status, target) switch
        {
            (PrintJobStatus.Planned, PrintJobStatus.Printing) => true,
            (PrintJobStatus.Printing, PrintJobStatus.Paused) => true,
            (PrintJobStatus.Paused, PrintJobStatus.Printing) => true,
            (PrintJobStatus.Printing or PrintJobStatus.Paused, PrintJobStatus.Failed) => true,
            (PrintJobStatus.Planned or PrintJobStatus.Printing or PrintJobStatus.Paused, PrintJobStatus.Cancelled) => true,
            _ => false
        };
        if (!allowed) throw new InvalidOperationException($"Transición de trabajo inválida: {job.Status} -> {target}.");

        var now = DateTimeOffset.UtcNow;
        job = job with
        {
            Status = target,
            StartedAt = target == PrintJobStatus.Printing ? job.StartedAt ?? now : job.StartedAt,
            CompletedAt = target is PrintJobStatus.Failed or PrintJobStatus.Cancelled ? now : null
        };
        await repository.UpdateJobAsync(job, null, actorId, cancellationToken);
        await repository.AddAuditAsync(actorId, $"PrintJob.{target}", "PrintJob", job.Id, null, cancellationToken);
        return job;
    }

    public async Task<PrintJobRecord> CompleteJobAsync(
        Guid jobId,
        CompleteJobRequest actual,
        Guid actorId,
        CancellationToken cancellationToken = default)
    {
        var job = await RequireJob(jobId, cancellationToken);
        if (job.Status is not PrintJobStatus.Printing and not PrintJobStatus.Paused)
            throw new InvalidOperationException("El trabajo debe estar Printing o Paused para completarse.");
        var estimate = job.Estimate;
        var estimatedLines = estimate.EffectiveLines;
        ValidateActuals(actual, estimatedLines);
        var materialDetails = new List<ActualMaterialCostLine>();
        foreach (var usage in actual.Materials)
        {
            var estimatedSnapshot = estimatedLines
                .SelectMany(x => x.Breakdown.Materials)
                .FirstOrDefault(x => x.SpoolId == usage.SpoolId);
            decimal costPerGram;
            if (estimatedSnapshot is not null)
            {
                costPerGram = estimatedSnapshot.CostPerGramGs;
            }
            else
            {
                var actualSpool = await repository.GetFilamentSnapshotAsync(usage.SpoolId, cancellationToken)
                    ?? throw new InvalidOperationException("El rollo utilizado no existe o está inactivo.");
                costPerGram = PricingCalculator.CalculateMaterial(new MaterialCostInput(
                    actualSpool.Id,
                    actualSpool.PurchaseCurrency,
                    actualSpool.PurchaseAmount,
                    actualSpool.ExchangeRateGs,
                    actualSpool.AllocatedShippingGs,
                    actualSpool.AllocatedImportFeesGs,
                    actualSpool.AllocatedOtherCostsGs,
                    actualSpool.NetWeightGrams,
                    SlicerTotalGrams: 1m)).CostGs;
            }
            materialDetails.Add(new ActualMaterialCostLine(usage.SpoolId, usage.Grams, costPerGram, costPerGram * usage.Grams));
        }

        var laborDetails = actual.Labor.Select(entry =>
        {
            var source = estimatedLines.SelectMany(x => x.Snapshot.Labor)
                .FirstOrDefault(x => string.Equals(x.Category, entry.Category, StringComparison.OrdinalIgnoreCase));
            if (source is null || source.HourlyRateGs < 0m)
                throw new InvalidOperationException($"No existe una tarifa snapshot para el trabajo real '{entry.Category}'.");
            return new ActualLaborCostLine(entry.Category, entry.Minutes, source.HourlyRateGs, entry.Minutes / 60m * source.HourlyRateGs);
        }).ToArray();
        var additionalDetails = actual.AdditionalCosts.Select(x => new ActualAdditionalCostLine(
            x.Description, x.AmountGs, x.IsInternalCost, x.ParticipatesInMargin)).ToArray();
        var details = new PrintJobActualDetails(materialDetails, laborDetails, additionalDetails);

        var materialCost = materialDetails.Sum(x => x.CostGs);
        var electricityRate = WeightedRate(
            estimatedLines.Select(x => (x.Breakdown.Energy.TotalKWh, x.Breakdown.Energy.EffectiveRateGsPerKWh)),
            estimatedLines[0].Breakdown.Energy.EffectiveRateGsPerKWh);
        var machineRate = WeightedRate(
            estimatedLines.Select(x => (x.Breakdown.Machine.TotalOccupiedHours, x.Breakdown.Machine.HourlyRateGs)),
            estimatedLines[0].Breakdown.Machine.HourlyRateGs);
        var electricity = actual.ActualKWh * electricityRate;
        var machine = actual.ActualOccupiedHours * machineRate;
        var labor = laborDetails.Sum(x => x.CostGs);
        var additional = additionalDetails.Where(x => x.IsInternalCost).Sum(x => x.AmountGs);
        var fullCost = materialCost + electricity + machine + labor + additional + actual.ActualOverheadGs;
        if (estimate.Aggregate is null && estimatedLines.Count > 1)
            throw new InvalidOperationException("Una revisión histórica multilínea sin agregado solo admite lectura.");
        var pricing = estimate.Aggregate?.Snapshot.Pricing ?? estimatedLines[0].Snapshot.Pricing;
        var actualNetSale = actual.ActualCustomerTotalGs - actual.ActualTaxGs;
        var variableFee = actualNetSale * pricing.VariableSellingFeePercent / 100m;
        var fees = variableFee + pricing.FixedSellingFeeGs;
        var netRevenue = actualNetSale - fees;
        var profit = netRevenue - fullCost;
        var margin = actualNetSale == 0m ? 0m : profit / actualNetSale * 100m;
        var aggregateEstimate = estimate.Aggregate?.Breakdown;
        var estimatedMaterial = aggregateEstimate?.MaterialCostGs ?? estimatedLines.Sum(x => x.Breakdown.MaterialCostGs);
        var estimatedEnergy = aggregateEstimate?.EnergyCostGs ?? estimatedLines.Sum(x => x.Breakdown.Energy.CostGs);
        var estimatedMachine = aggregateEstimate?.MachineCostGs ?? estimatedLines.Sum(x => x.Breakdown.Machine.CostGs);
        var estimatedFullCost = aggregateEstimate?.FullyLoadedCostGs ?? estimatedLines.Sum(x => x.Breakdown.FullyLoadedCostGs);
        var estimatedProfit = aggregateEstimate?.EstimatedProfitGs ?? estimatedLines.Sum(x => x.Breakdown.EstimatedProfitGs);
        var estimatedMargin = aggregateEstimate?.AchievedMarginPercent ?? 0m;
        var actualResult = new ActualCostResult(
            materialCost,
            electricity,
            machine,
            labor,
            additional,
            actual.ActualOverheadGs,
            fullCost,
            actual.ActualCustomerTotalGs,
            actual.ActualTaxGs,
            actualNetSale,
            variableFee,
            netRevenue,
            profit,
            margin,
            materialCost - estimatedMaterial,
            electricity - estimatedEnergy,
            machine - estimatedMachine,
            fullCost - estimatedFullCost,
            profit - estimatedProfit,
            margin - estimatedMargin);
        job = job with
        {
            Status = PrintJobStatus.Completed,
            CompletedAt = DateTimeOffset.UtcNow,
            ActualInput = actual,
            ActualResult = actualResult,
            ActualDetails = details
        };
        var consumption = actual.Materials.Select(x =>
            new InventoryConsumption(x.SpoolId, x.Grams, job.Id, "Consumo real al completar trabajo")).ToArray();
        await repository.UpdateJobAsync(job, consumption, actorId, cancellationToken);
        await repository.AddAuditAsync(actorId, "PrintJob.Completed", "PrintJob", job.Id, null, cancellationToken);
        return job;
    }

    private async Task<QuoteRevisionRecord> CalculateRevisionAsync(
        int number,
        Guid actorId,
        DateTimeOffset at,
        IReadOnlyList<QuoteLineRequest> requests,
        CancellationToken cancellationToken)
    {
        if (requests.Count == 0) throw new InvalidOperationException("La cotización requiere al menos una línea.");
        return await CalculateAggregateRevisionAsync(number, actorId, at, requests, cancellationToken);
    }

    private async Task<QuoteRevisionRecord> CalculateAggregateRevisionAsync(
        int number,
        Guid actorId,
        DateTimeOffset at,
        IReadOnlyList<QuoteLineRequest> requests,
        CancellationToken cancellationToken)
    {
        for (var index = 1; index < requests.Count; index++)
        {
            if (requests[index].Calculation.Labor.Any(x => x.Scope == CostScope.FixedPerOrder)
                || requests[index].Calculation.AdditionalCosts.Any(x => x.Scope == CostScope.FixedPerOrder))
                throw new InvalidOperationException("FixedPerOrder solo puede declararse en la primera línea.");
        }

        var resolved = new List<ResolvedQuoteCalculation>();
        foreach (var line in requests)
        {
            if (string.IsNullOrWhiteSpace(line.Description))
                throw new InvalidOperationException("Cada línea requiere una descripción.");
            resolved.Add(await calculator.ResolveAsync(line.Calculation, cancellationToken));
        }

        var firstResolved = resolved[0];
        foreach (var item in resolved.Skip(1))
        {
            if (item.ResolvedAssumptions.PricingPolicyId != firstResolved.ResolvedAssumptions.PricingPolicyId)
                throw new InvalidOperationException("Todas las líneas deben usar la misma política de precios.");
            if (item.ResolvedAssumptions.ElectricityTariffId != firstResolved.ResolvedAssumptions.ElectricityTariffId)
                throw new InvalidOperationException("Todas las líneas deben usar la misma tarifa eléctrica.");
            if (item.Snapshot.Failure != firstResolved.Snapshot.Failure
                || item.Snapshot.Overhead != firstResolved.Snapshot.Overhead
                || item.Snapshot.Pricing != firstResolved.Snapshot.Pricing
                || item.Snapshot.Tax != firstResolved.Snapshot.Tax)
                throw new InvalidOperationException("Todas las líneas deben compartir impuestos y condiciones globales.");
        }

        var productions = resolved.Select(x => PricingCalculator.CalculateProduction(x.Snapshot)).ToArray();
        var aggregateBreakdown = PricingCalculator.CalculateAggregate(new QuoteAggregateCalculationInput(
            productions,
            firstResolved.Snapshot.Failure,
            firstResolved.Snapshot.Overhead,
            firstResolved.Snapshot.Pricing,
            firstResolved.Snapshot.Tax));
        var aggregateWarnings = QuoteCalculationService.AddCalculationWarnings(
                resolved.SelectMany(x => x.Warnings),
                aggregateBreakdown.Warnings)
            .GroupBy(x => x.Code, StringComparer.OrdinalIgnoreCase)
            .Select(x => x.First())
            .ToArray();
        var canUsePrice = aggregateWarnings.All(x => !x.BlocksPrice) && aggregateBreakdown.CanUsePrice;
        aggregateBreakdown = aggregateBreakdown with { CanUsePrice = canUsePrice };

        var lines = new List<QuoteLineRecord>();
        for (var index = 0; index < requests.Count; index++)
        {
            var lineBreakdown = PricingCalculator.CreateLineResult(
                productions[index], aggregateBreakdown, index,
                firstResolved.Snapshot.Pricing, firstResolved.Snapshot.Tax);
            lines.Add(new QuoteLineRecord(
                Guid.NewGuid(),
                requests[index].Description.Trim(),
                requests[index].Calculation,
                resolved[index].Snapshot,
                lineBreakdown,
                canUsePrice,
                aggregateWarnings,
                productions[index],
                aggregateBreakdown.LineAllocations[index]));
        }

        var first = lines[0];
        return new QuoteRevisionRecord(
            Guid.NewGuid(),
            number,
            at,
            actorId,
            first.Request,
            first.Snapshot,
            first.Breakdown,
            lines,
            new QuoteAggregateRecord(
                new QuoteAggregateSnapshot(
                    firstResolved.ResolvedAssumptions.PricingPolicyId,
                    firstResolved.ResolvedAssumptions.PricingPolicyName,
                    firstResolved.ResolvedAssumptions.ElectricityTariffId,
                    firstResolved.Snapshot.Failure,
                    firstResolved.Snapshot.Overhead,
                    firstResolved.Snapshot.Pricing,
                    firstResolved.Snapshot.Tax),
                aggregateBreakdown));
    }

    private static IReadOnlyList<QuoteLineRequest> ResolveLineRequests(CreateQuoteRequest request) =>
        request.Lines is { Count: > 0 }
            ? request.Lines
            : [new QuoteLineRequest("Impresión 3D", request.Calculation)];

    private static void ValidateActuals(CompleteJobRequest actual, IReadOnlyList<QuoteLineRecord> estimatedLines)
    {
        if (actual.ActualKWh < 0m || actual.ActualOccupiedHours < 0m || actual.ActualOverheadGs < 0m
            || actual.ActualCustomerTotalGs < 0m || actual.ActualTaxGs < 0m)
            throw new InvalidOperationException("Los consumos, costos y cobros reales no pueden ser negativos.");
        if (actual.ActualTaxGs > actual.ActualCustomerTotalGs)
            throw new InvalidOperationException("El impuesto real no puede superar el total cobrado al cliente.");
        if (actual.ActualTaxGs > 0m && estimatedLines.All(x => !x.Snapshot.Tax.Enabled))
            throw new InvalidOperationException("No se puede registrar impuesto real cuando la estimación no tiene impuestos habilitados.");
        if (actual.Attempts <= 0 || actual.FailedAttempts < 0 || actual.FailedAttempts > actual.Attempts)
            throw new InvalidOperationException("Los intentos y fallas reales son inválidos.");
        if (actual.Materials.Count == 0 || actual.Materials.Any(x => x.Grams <= 0m))
            throw new InvalidOperationException("Debe registrar materiales reales con gramos positivos.");
        if (actual.Labor.Any(x => x.Minutes < 0m) || actual.AdditionalCosts.Any(x => x.AmountGs < 0m))
            throw new InvalidOperationException("El trabajo y los consumibles reales no pueden ser negativos.");
    }

    private static decimal WeightedRate(IEnumerable<(decimal Weight, decimal Rate)> rows, decimal fallback)
    {
        var values = rows.ToArray();
        var totalWeight = values.Sum(x => x.Weight);
        return totalWeight == 0m ? fallback : values.Sum(x => x.Weight * x.Rate) / totalWeight;
    }

    private async Task<QuoteRecord> RequireQuote(Guid id, CancellationToken cancellationToken) =>
        await repository.GetQuoteAsync(id, cancellationToken)
        ?? throw new InvalidOperationException("Cotización no encontrada.");

    private async Task<PrintJobRecord> RequireJob(Guid id, CancellationToken cancellationToken) =>
        await repository.GetJobAsync(id, cancellationToken)
        ?? throw new InvalidOperationException("Trabajo no encontrado.");
}
