using System.Text.Json;
using PrintCost.Application.Abstractions;
using PrintCost.Application.Quotes;
namespace PrintCost.Application.Orders;

public sealed class OrderService(IOrderStore store, IPrintCostRepository repository, QuoteCalculationService calculator, QuoteWorkflowService workflow)
{
    public static bool IsActive(OrderStatus status) => status is OrderStatus.Confirmed or OrderStatus.InProgress or OrderStatus.Ready;
    private static string? Clean(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();
    private static OrderRecord Public(OrderRecord order) => order with { QuickPreview = null, QuickKey = null };
    public async Task<OrderRecord?> GetAsync(Guid id, CancellationToken ct) => await store.GetAsync(id, ct) is { } order ? Public(order) : null;
    public async Task<OrderRecord?> GetByQuoteAsync(Guid quoteId, CancellationToken ct) =>
        (await store.ListAsync(ct)).SingleOrDefault(x => x.QuoteId == quoteId) is { } order ? Public(order) : null;
    public async Task<OrderPage> ListAsync(string? view, string? search, int skip, int take, CancellationToken ct)
    {
        var all = await store.ListAsync(ct);
        var ranks = all.Where(x => IsActive(x.Status)).OrderBy(x => x.Position).ThenBy(x => x.Code)
            .Select((x, i) => (x.Id, Rank: i + 1)).ToDictionary(x => x.Id, x => x.Rank);
        IEnumerable<OrderRecord> rows = view switch {
            "drafts" => all.Where(x => x.Status == OrderStatus.Draft), "history" => all.Where(x => x.Status is OrderStatus.Delivered or OrderStatus.Cancelled),
            "discarded" => all.Where(x => x.Status == OrderStatus.Discarded),
            "quoted" => all.Where(x => x.QuoteId is not null && x.Status is not OrderStatus.Draft and not OrderStatus.Discarded),
            _ => all.Where(x => IsActive(x.Status)) };
        if (!string.IsNullOrWhiteSpace(search)) rows = rows.Where(x => $"{x.Code} {x.CustomerReference} {x.Description}".Contains(search.Trim(), StringComparison.OrdinalIgnoreCase));
        rows = view is null or "active" ? rows.OrderBy(x => x.Position).ThenBy(x => x.Code) : rows.OrderByDescending(x => x.UpdatedAt).ThenBy(x => x.Code);
        var filtered = rows.ToArray();
        return new(filtered.Skip(Math.Max(0, skip)).Take(Math.Clamp(take, 1, 100)).Select(x => Public(x with { Position = ranks.GetValueOrDefault(x.Id, x.Position) })).ToArray(), filtered.Length,
            all.Count(x => x.Status == OrderStatus.Draft), all.Count(x => IsActive(x.Status)));
    }
    private static void Validate(OrderRecord order, bool confirm)
    {
        if (!Enum.IsDefined(order.Status) || order.Quantity < 1 || order.TotalGs < 0) throw new InvalidOperationException("Revisá el estado, la cantidad y el importe total.");
        if (order.CustomerReference?.Length > 200 || order.Description?.Length > 1000 || order.Notes?.Length > 4000) throw new InvalidOperationException("La referencia, descripción o notas son demasiado largas.");
        if (confirm && !order.Historical && (string.IsNullOrWhiteSpace(order.CustomerReference) || order.TotalGs is null)) throw new InvalidOperationException("Para confirmar, completá cliente/referencia e importe total acordado.");
    }
    private static void CheckVersion(OrderRecord order, long version)
    {
        if (order.Version != version) throw new OrderConflictException("Este pedido cambió en otra pantalla. Actualizá antes de guardar.");
    }
    private async Task<OrderRecord> Require(Guid id, CancellationToken ct) => await store.GetAsync(id, ct) ?? throw new KeyNotFoundException("Pedido no encontrado.");
    private async Task Save(OrderRecord order, Guid actor, string action, CancellationToken ct)
    {
        await store.SaveAsync(order, ct); await repository.AddAuditAsync(actor, action, "Order", order.Id, null, ct);
    }
    public Task<OrderRecord> CreateAsync(OrderInput input, Guid actor, CancellationToken ct) => store.TransactionAsync(async () =>
    {
        if (input.Id == Guid.Empty) throw new InvalidOperationException("Falta la referencia de guardado.");
        if (await store.GetAsync(input.Id, ct) is { } existing) return Public(existing);
        if (!input.Historical && input.Status is not OrderStatus.Draft and not OrderStatus.Confirmed) throw new InvalidOperationException("Un pedido nuevo empieza en borrador o confirmado.");
        var now = DateTimeOffset.UtcNow; var all = await store.ListAsync(ct);
        var order = new OrderRecord(input.Id, $"PED-{now:yyMMdd}-{input.Id.ToString("N")[..8].ToUpperInvariant()}", Clean(input.CustomerReference), Clean(input.Description),
            input.Quantity, input.TotalGs, input.Status, now, now, input.OrderDate, input.DueDate, input.DeliveredDate, Clean(input.Notes), input.Historical,
            all.Select(x => x.Position).DefaultIfEmpty(0).Max() + 1, 1);
        Validate(order, IsActive(order.Status)); await Save(order, actor, "Order.Created", ct); return Public(order);
    }, ct);
    public Task<OrderRecord> UpdateAsync(Guid id, OrderInput input, Guid actor, CancellationToken ct) => store.TransactionAsync(async () =>
    {
        var previous = await Require(id, ct); CheckVersion(previous, input.Version);
        var order = previous with { CustomerReference = Clean(input.CustomerReference), Description = Clean(input.Description), Quantity = input.Quantity,
            TotalGs = input.TotalGs, OrderDate = input.OrderDate, DueDate = input.DueDate, DeliveredDate = input.DeliveredDate,
            Notes = Clean(input.Notes), UpdatedAt = DateTimeOffset.UtcNow, Version = previous.Version + 1,
            QuickLocked = previous.QuickSessionId is not null || previous.QuickLocked,
            PriceIsManual = previous.PriceIsManual || previous.TotalGs != input.TotalGs };
        Validate(order, false); await UpdateMetadata(order, actor, ct);
        await Save(order, actor, "Order.Updated", ct); return Public(order);
    }, ct);
    public Task<OrderRecord> TransitionAsync(Guid id, OrderStatus status, long version, Guid actor, CancellationToken ct) => store.TransactionAsync(async () =>
    {
        var previous = await Require(id, ct); if (previous.Status == status) return Public(previous); CheckVersion(previous, version);
        var allowed = (previous.Status, status) switch {
            (OrderStatus.Draft, OrderStatus.Confirmed or OrderStatus.Discarded) => true, (OrderStatus.Discarded, OrderStatus.Draft) => true,
            (OrderStatus.Confirmed, OrderStatus.InProgress or OrderStatus.Cancelled) => true, (OrderStatus.InProgress, OrderStatus.Ready or OrderStatus.Cancelled) => true,
            (OrderStatus.Ready, OrderStatus.Delivered or OrderStatus.Cancelled) => true, _ => false };
        if (!allowed) throw new InvalidOperationException("Ese cambio de estado no está disponible.");
        var all = await store.ListAsync(ct);
        var order = previous with { Status = status, Version = previous.Version + 1, UpdatedAt = DateTimeOffset.UtcNow,
            Position = status == OrderStatus.Confirmed ? all.Select(x => x.Position).DefaultIfEmpty(0).Max() + 1 : previous.Position,
            DeliveredDate = status == OrderStatus.Delivered ? DateOnly.FromDateTime(TimeZoneInfo.ConvertTimeBySystemTimeZoneId(DateTimeOffset.UtcNow, "America/Asuncion").DateTime) : previous.DeliveredDate };
        Validate(order, status == OrderStatus.Confirmed);
        if (status == OrderStatus.Draft && order.QuoteId is { } quoteId && await repository.GetQuoteAsync(quoteId, ct) is { } quote
            && quote.Status is QuoteStatus.Cancelled or QuoteStatus.Rejected or QuoteStatus.Expired)
        {
            await repository.UpdateQuoteAsync(quote with { Status = QuoteStatus.Draft, UpdatedAt = DateTimeOffset.UtcNow }, ct);
            await repository.AddAuditAsync(actor, "Quote.Recovered", "Quote", quoteId, null, ct);
        }
        await Save(order, actor, $"Order.{status}", ct); return Public(order);
    }, ct);
    public Task<OrderRecord> MoveAsync(Guid id, string direction, long version, Guid actor, CancellationToken ct) => store.TransactionAsync(async () =>
    {
        var order = await Require(id, ct); CheckVersion(order, version);
        if (!IsActive(order.Status)) throw new InvalidOperationException("Solo se ordenan pedidos confirmados activos.");
        var queue = (await store.ListAsync(ct)).Where(x => IsActive(x.Status)).OrderBy(x => x.Position).ThenBy(x => x.Code).ToList();
        var index = queue.FindIndex(x => x.Id == id);
        var target = direction switch { "up" => Math.Max(0, index - 1), "down" => Math.Min(queue.Count - 1, index + 1), "first" => 0,
            _ => throw new InvalidOperationException("Movimiento de prioridad inválido.") };
        queue.RemoveAt(index); queue.Insert(target, order);
        for (var i = 0; i < queue.Count; i++)
        {
            var row = queue[i];
            if (row.Position != i + 1 || row.Id == id) { row = row with { Position = i + 1, Version = row.Version + 1 }; await store.SaveAsync(row, ct); queue[i] = row; }
        }
        await repository.AddAuditAsync(actor, "Order.PriorityChanged", "Order", id, null, ct); return Public(queue.Single(x => x.Id == id));
    }, ct);
    private async Task UpdateMetadata(OrderRecord order, Guid actor, CancellationToken ct)
    {
        if (order.QuoteId is not { } id) return;
        var quote = await repository.GetQuoteAsync(id, ct);
        if (quote is null || quote.CustomerReference == order.CustomerReference && quote.ItemDescription == order.Description) return;
        var revision = QuickQuoteRevision.WithMetadata(quote.Revisions.MaxBy(x => x.RevisionNumber)!, actor, order.CustomerReference, order.Description);
        await repository.UpdateQuoteAsync(quote with { CustomerReference = order.CustomerReference, ItemDescription = order.Description,
            UpdatedAt = DateTimeOffset.UtcNow, Revisions = [.. quote.Revisions, revision] }, ct);
    }
    public Task<QuickOrderResult> QuickAsync(QuickOrderRequest request, Guid actor, CancellationToken ct) => store.TransactionAsync(async () =>
    {
        if (request.SessionId == Guid.Empty || request.Sequence < 1) throw new InvalidOperationException("Falta identificar la cotización.");
        var all = await store.ListAsync(ct); var previous = all.SingleOrDefault(x => x.QuickSessionId == request.SessionId);
        if (previous is not null && previous.Status != OrderStatus.Draft) throw new OrderConflictException("Este borrador ya se confirmó o descartó. Iniciá un nuevo cálculo.");
        if (previous?.QuickLocked == true) throw new OrderConflictException("Este borrador se editó desde Pedidos. Abrilo para continuar o iniciá otro cálculo.");
        if (previous is not null && request.Sequence < previous.QuickSequence) throw new OrderConflictException("La cotización recibida es anterior a la versión guardada.");
        var key = JsonSerializer.Serialize(request.Calculation); var customer = Clean(request.CustomerReference); var description = Clean(request.Description);
        if (previous is not null && request.Sequence == previous.QuickSequence)
        {
            if (previous.QuickKey != key || previous.CustomerReference != customer || previous.Description != description) throw new OrderConflictException("La versión ya se guardó con otros datos.");
            return new QuickOrderResult(previous.QuickPreview!, Public(previous));
        }
        var preview = previous?.QuickKey == key && previous.QuickPreview is not null ? previous.QuickPreview : await calculator.QuickPreviewAsync(request.Calculation, ct);
        if (!preview.CanUsePrice || preview.Breakdown is null || preview.AdvancedRequest is null) return new QuickOrderResult(preview, null);
        var now = DateTimeOffset.UtcNow;
        var order = previous ?? new OrderRecord(Guid.NewGuid(), "", null, null, 1, null, OrderStatus.Draft, now, now, null, null, null, null, false, 0, 0, QuickSessionId: request.SessionId);
        order = order with { Code = previous?.Code ?? $"PED-{now:yyMMdd}-{order.Id.ToString("N")[..8].ToUpperInvariant()}", CustomerReference = customer, Description = description,
            TotalGs = preview.Breakdown.CustomerTotalGs, QuickSequence = request.Sequence, QuickKey = key, QuickPreview = preview, Version = order.Version + 1, UpdatedAt = now };
        Validate(order, false);
        var quote = order.QuoteId is { } id ? await repository.GetQuoteAsync(id, ct) : null;
        if (previous?.QuickKey != key || quote is null)
        {
            var revision = QuickQuoteRevision.Create(preview, (quote?.Revisions.Max(x => x.RevisionNumber) ?? 0) + 1, actor, customer, description);
            if (quote is null)
            {
                quote = new QuoteRecord(Guid.NewGuid(), await repository.NextQuoteCodeAsync(now.Year, ct), null, now, now, null, actor, "PYG", null, null, QuoteStatus.Draft, [revision], customer, description);
                await repository.AddQuoteAsync(quote, ct);
            }
            else await repository.UpdateQuoteAsync(quote with { CustomerReference = customer, ItemDescription = description, UpdatedAt = now, Revisions = [.. quote.Revisions, revision] }, ct);
            order = order with { QuoteId = quote.Id };
        }
        else await UpdateMetadata(order, actor, ct);
        await Save(order, actor, "Order.QuickDraftSaved", ct); return new QuickOrderResult(preview, Public(order));
    }, ct);
    public Task<QuoteRecord> TransitionQuoteAsync(Guid id, QuoteStatus status, Guid actor, CancellationToken ct) => store.TransactionAsync(async () =>
    {
        var order = (await store.ListAsync(ct)).SingleOrDefault(x => x.QuoteId == id);
        var terminal = status is QuoteStatus.Cancelled or QuoteStatus.Rejected or QuoteStatus.Expired;
        if (terminal && order is not null && order.Status is not OrderStatus.Draft and not OrderStatus.Discarded)
            throw new OrderConflictException("Este presupuesto ya tiene un pedido confirmado. Abrí el pedido para cancelarlo.");
        var quote = await workflow.TransitionAsync(id, status, actor, ct);
        if (terminal && order?.Status == OrderStatus.Draft)
            await Save(order with { Status = OrderStatus.Discarded, QuickLocked = true, Version = order.Version + 1,
                UpdatedAt = DateTimeOffset.UtcNow }, actor, "Order.QuoteDiscarded", ct);
        return quote;
    }, ct);
    public Task<QuoteRecord> DuplicateQuoteAsync(Guid id, Guid actor, CancellationToken ct) => store.TransactionAsync(async () =>
    {
        var source = await repository.GetQuoteAsync(id, ct) ?? throw new KeyNotFoundException("Presupuesto no encontrado.");
        var revision = source.Revisions.MaxBy(x => x.RevisionNumber)!;
        var quote = await workflow.CreateAsync(new CreateQuoteRequest(revision.Request, source.CustomerId, source.ValidUntil, source.Notes, source.Terms,
            revision.EffectiveLines.Select(x => new QuoteLineRequest(x.Description, x.Request)).ToArray(), source.CustomerReference, source.ItemDescription),
            actor, cancellationToken: ct);
        var all = await store.ListAsync(ct);
        await Save(FromQuote(quote, all.Select(x => x.Position).DefaultIfEmpty(0).Max() + 1, quote.CustomerReference), actor, "Order.QuoteDuplicated", ct);
        return quote;
    }, ct);
    public Task<QuoteRecord> EditQuoteAsync(Guid id, CreateQuoteRequest request, bool editInputs, Guid actor, CancellationToken ct) => store.TransactionAsync(async () =>
    {
        var quote = await repository.GetQuoteAsync(id, ct) ?? throw new KeyNotFoundException("Presupuesto no encontrado.");
        if (quote.Status is not QuoteStatus.Draft and not QuoteStatus.Calculated || editInputs && quote.Status != QuoteStatus.Draft)
            throw new OrderConflictException("El estado del presupuesto no permite editar estos datos.");
        var previous = quote.Revisions.MaxBy(x => x.RevisionNumber)!;
        var lines = request.Lines ?? [new QuoteLineRequest(previous.EffectiveLines[0].Description, request.Calculation)];
        var originalLines = previous.EffectiveLines.Select(x => new QuoteLineRequest(x.Description, x.Request)).ToArray();
        var changedInputs = editInputs && JsonSerializer.Serialize(lines) != JsonSerializer.Serialize(originalLines);
        if (changedInputs) quote = await workflow.UpdateDraftAsync(id, request with { Lines = lines }, actor, ct);
        else
        {
            var customer = Clean(request.CustomerReference ?? quote.CustomerReference);
            var description = Clean(request.ItemDescription ?? quote.ItemDescription);
            var metadataChanged = quote.CustomerReference != customer || quote.ItemDescription != description;
            quote = quote with { CustomerId = request.CustomerId, CustomerReference = customer, ItemDescription = description,
                ValidUntil = request.ValidUntil, Notes = request.Notes, Terms = request.Terms, UpdatedAt = DateTimeOffset.UtcNow,
                Revisions = metadataChanged ? [.. quote.Revisions, QuickQuoteRevision.WithMetadata(previous, actor, customer, description)] : quote.Revisions };
            await repository.UpdateQuoteAsync(quote, ct);
        }
        var order = (await store.ListAsync(ct)).SingleOrDefault(x => x.QuoteId == id);
        if (order is not null)
        {
            order = order with { CustomerReference = quote.CustomerReference, Description = quote.ItemDescription,
                TotalGs = changedInputs && order.Status == OrderStatus.Draft && !order.PriceIsManual ? quote.Revisions.MaxBy(x => x.RevisionNumber)!.TotalCustomerPriceGs : order.TotalGs,
                QuickLocked = order.QuickLocked || order.QuickSessionId is not null, Version = order.Version + 1, UpdatedAt = DateTimeOffset.UtcNow };
            Validate(order, false); await Save(order, actor, "Order.QuoteEdited", ct);
        }
        await repository.AddAuditAsync(actor, "Quote.Updated", "Quote", id, null, ct);
        return quote;
    }, ct);
    public Task<PrintJobRecord> ConvertQuoteAsync(Guid quoteId, Guid actor, CancellationToken ct) => store.TransactionAsync(async () =>
    {
        var all = await store.ListAsync(ct); var existing = all.SingleOrDefault(x => x.QuoteId == quoteId);
        if (existing?.JobId is { } jobId) return (await repository.GetJobAsync(jobId, ct))!;
        if (existing?.Status is OrderStatus.Discarded or OrderStatus.Cancelled) throw new OrderConflictException("Recuperá el pedido descartado antes de convertirlo.");
        var job = await workflow.ConvertToJobAsync(quoteId, actor, ct); var quote = (await repository.GetQuoteAsync(quoteId, ct))!;
        var order = existing ?? FromQuote(quote, all.Count + 1, quote.CustomerReference);
        await Save(order with { JobId = job.Id, Status = order.Status == OrderStatus.Draft ? OrderStatus.Confirmed : order.Status, Version = order.Version + 1,
            TotalGs = order.PriceIsManual ? order.TotalGs : quote.Revisions.MaxBy(x => x.RevisionNumber)!.TotalCustomerPriceGs,
            UpdatedAt = DateTimeOffset.UtcNow, ProductionStatus = job.Status.ToString() }, actor, "Order.LinkedToProduction", ct); return job;
    }, ct);
    private static OrderRecord FromQuote(QuoteRecord quote, int position, string? customer) => new(Guid.NewGuid(), quote.Code.Replace("COT-", "PED-", StringComparison.Ordinal),
        quote.CustomerReference ?? customer, quote.ItemDescription ?? quote.Revisions.MaxBy(x => x.RevisionNumber)!.EffectiveLines.FirstOrDefault()?.Description,
        quote.Revisions.MaxBy(x => x.RevisionNumber)!.EffectiveLines.Sum(x => x.Breakdown.Quantity), quote.Revisions.MaxBy(x => x.RevisionNumber)!.TotalCustomerPriceGs,
        quote.Status switch { QuoteStatus.Accepted or QuoteStatus.ConvertedToJob => OrderStatus.Confirmed,
            QuoteStatus.Rejected or QuoteStatus.Expired or QuoteStatus.Cancelled => OrderStatus.Discarded, _ => OrderStatus.Draft },
        quote.CreatedAt, quote.UpdatedAt, null, null, null, quote.Notes, false, position, 1, quote.Id);
    public Task<int> ImportExistingAsync(CancellationToken ct) => store.TransactionAsync(async () =>
    {
        var all = (await store.ListAsync(ct)).ToList(); var added = 0;
        for (var skip = 0; ; skip += 100)
        {
            var summaries = await repository.ListQuotesAsync(null, null, null, skip, 100, ct);
            foreach (var summary in summaries.Where(x => all.All(o => o.QuoteId != x.Id)))
            {
                var order = FromQuote((await repository.GetQuoteAsync(summary.Id, ct))!, all.Count + 1, summary.CustomerName);
                await store.SaveAsync(order, ct); all.Add(order); added++;
            }
            if (summaries.Count < 100) break;
        }
        for (var skip = 0; ; skip += 100)
        {
            var summaries = await repository.ListJobsAsync(null, null, null, skip, 100, ct);
            foreach (var summary in summaries.Where(x => all.All(o => o.JobId != x.Id)))
            {
                var job = (await repository.GetJobAsync(summary.Id, ct))!;
                var existing = all.SingleOrDefault(x => x.QuoteId is not null && x.QuoteId == job.QuoteId);
                var order = existing ?? new OrderRecord(Guid.NewGuid(), job.Code.Replace("JOB-", "PED-", StringComparison.Ordinal), null, summary.Description,
                    1, summary.ActualCustomerTotalGs ?? summary.EstimatedCustomerTotalGs, OrderStatus.Confirmed, job.CreatedAt, job.CreatedAt,
                    null, null, null, null, true, all.Count + 1, 1, job.QuoteId);
                order = order with { JobId = job.Id, ProductionStatus = job.Status.ToString(), ActualCostGs = job.ActualResult?.FullyLoadedCostGs,
                    Status = job.Status switch { PrintJobStatus.Printing or PrintJobStatus.Paused => OrderStatus.InProgress,
                        PrintJobStatus.Completed => OrderStatus.Ready, PrintJobStatus.Cancelled => OrderStatus.Cancelled, _ => OrderStatus.Confirmed } };
                await store.SaveAsync(order, ct); if (existing is not null) all.Remove(existing); all.Add(order);
            }
            if (summaries.Count < 100) break;
        }
        return added;
    }, ct);
}
