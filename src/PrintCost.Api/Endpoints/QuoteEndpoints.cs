using System.Security.Claims;
using PrintCost.Api.Auth;
using PrintCost.Application.Abstractions;
using PrintCost.Application.Quotes;
using PrintCost.Application.Orders;
using PrintCost.Domain.Pricing;

namespace PrintCost.Api.Endpoints;

public static class QuoteEndpoints
{
    public static IEndpointRouteBuilder MapQuoteEndpoints(this IEndpointRouteBuilder app, AuthSettings settings)
    {
        var api = app.MapGroup("/api").RequireAuthIfPin(settings);

        api.MapPost("/calculations/quote-preview", async (QuotePreviewRequest request, QuoteCalculationService service, CancellationToken ct) =>
        {
            try { return Results.Ok(await service.PreviewAsync(request, ct)); }
            catch (Exception exception) when (exception is InvalidOperationException or DomainValidationException)
            { return Results.ValidationProblem(new Dictionary<string, string[]> { ["calculation"] = [exception.Message] }); }
        });

        api.MapPost("/calculations/quick-quote-preview", async (QuickQuotePreviewRequest request, QuoteCalculationService service, CancellationToken ct) =>
        {
            try { return Results.Ok(await service.QuickPreviewAsync(request, ct)); }
            catch (Exception exception) when (exception is InvalidOperationException or DomainValidationException)
            { return Results.ValidationProblem(new Dictionary<string, string[]> { ["calculation"] = [exception.Message] }); }
        });

        api.MapGet("/quotes", async (string? status, DateOnly? from, DateOnly? to, int? skip, int? take, IPrintCostRepository repository, CancellationToken ct) =>
            Results.Ok(await repository.ListQuotesAsync(status, from, to, skip ?? 0, take ?? 50, ct)));
        api.MapGet("/quotes/{id:guid}", async (Guid id, IPrintCostRepository repository, CancellationToken ct) =>
        {
            var quote = await repository.GetQuoteAsync(id, ct);
            return quote is null ? Results.NotFound() : Results.Ok(quote);
        });
        api.MapPost("/quotes", async (CreateQuoteRequest request, ClaimsPrincipal user, QuoteWorkflowService service, OrderService orders, CancellationToken ct) =>
        {
            try
            {
                var quote = await service.CreateAsync(request, user.RequireActorId(settings), cancellationToken: ct);
                await orders.ImportExistingAsync(ct);
                return Results.Created($"/api/quotes/{quote.Id}", quote);
            }
            catch (Exception exception) when (exception is InvalidOperationException or DomainValidationException)
            { return Results.ValidationProblem(new Dictionary<string, string[]> { ["quote"] = [exception.Message] }); }
        });
        api.MapPut("/quotes/{id:guid}", async (Guid id, UpdateQuoteRequest request, ClaimsPrincipal user, IPrintCostRepository repository, OrderService service, CancellationToken ct) =>
        {
            var quote = await repository.GetQuoteAsync(id, ct);
            if (quote is null) return Results.NotFound();
            var editInputs = request.Calculation is not null || request.Lines is { Count: > 0 };
            var previous = quote.Revisions.MaxBy(x => x.RevisionNumber)!;
            var lines = request.Lines is { Count: > 0 } ? request.Lines : (request.Calculation is not null
                ? [new QuoteLineRequest(previous.EffectiveLines[0].Description, request.Calculation)]
                : previous.EffectiveLines.Select(x => new QuoteLineRequest(x.Description, x.Request)).ToArray());
            try
            {
                return Results.Ok(await service.EditQuoteAsync(id, new CreateQuoteRequest(
                    lines[0].Calculation, request.CustomerId, request.ValidUntil, request.Notes, request.Terms, lines,
                    request.CustomerReference, request.ItemDescription), editInputs, user.RequireActorId(settings), ct));
            }
            catch (OrderConflictException exception) { return Results.Conflict(new { message = exception.Message }); }
            catch (Exception exception) when (exception is InvalidOperationException or DomainValidationException)
            { return Results.ValidationProblem(new Dictionary<string, string[]> { ["quote"] = [exception.Message] }); }
        });

        api.MapPost("/quotes/{id:guid}/calculate", (Guid id, ClaimsPrincipal user, QuoteWorkflowService service, CancellationToken ct) =>
            Revision(id, user, service, settings, ct));
        api.MapPost("/quotes/{id:guid}/revisions/from-current-costs", (Guid id, ClaimsPrincipal user, QuoteWorkflowService service, CancellationToken ct) =>
            Revision(id, user, service, settings, ct));
        api.MapPost("/quotes/{id:guid}/ready", (Guid id, ClaimsPrincipal user, OrderService service, CancellationToken ct) =>
            Transition(id, QuoteStatus.ReadyToSend, user, service, settings, ct));
        api.MapPost("/quotes/{id:guid}/send", (Guid id, ClaimsPrincipal user, OrderService service, CancellationToken ct) =>
            Transition(id, QuoteStatus.Sent, user, service, settings, ct));
        api.MapPost("/quotes/{id:guid}/accept", (Guid id, ClaimsPrincipal user, OrderService service, CancellationToken ct) =>
            Transition(id, QuoteStatus.Accepted, user, service, settings, ct));
        api.MapPost("/quotes/{id:guid}/reject", (Guid id, ClaimsPrincipal user, OrderService service, CancellationToken ct) =>
            Transition(id, QuoteStatus.Rejected, user, service, settings, ct));
        api.MapPost("/quotes/{id:guid}/cancel", (Guid id, ClaimsPrincipal user, OrderService service, CancellationToken ct) =>
            Transition(id, QuoteStatus.Cancelled, user, service, settings, ct));
        api.MapPost("/quotes/{id:guid}/duplicate", async (Guid id, ClaimsPrincipal user, OrderService service, CancellationToken ct) =>
        {
            try
            {
                var duplicate = await service.DuplicateQuoteAsync(id, user.RequireActorId(settings), ct);
                return Results.Created($"/api/quotes/{duplicate.Id}", duplicate);
            }
            catch (KeyNotFoundException) { return Results.NotFound(); }
        });
        api.MapPost("/quotes/{id:guid}/convert-to-job", async (Guid id, ClaimsPrincipal user, OrderService service, CancellationToken ct) =>
        {
            try
            {
                var job = await service.ConvertQuoteAsync(id, user.RequireActorId(settings), ct);
                return Results.Created($"/api/jobs/{job.Id}", job);
            }
            catch (Exception exception) when (exception is InvalidOperationException or OrderConflictException) { return Results.Conflict(new { message = exception.Message }); }
        });

        api.MapGet("/jobs", async (string? status, DateOnly? from, DateOnly? to, int? skip, int? take, IPrintCostRepository repository, CancellationToken ct) =>
            Results.Ok(await repository.ListJobsAsync(status, from, to, skip ?? 0, take ?? 50, ct)));
        api.MapGet("/jobs/{id:guid}", async (Guid id, IPrintCostRepository repository, CancellationToken ct) =>
        {
            var job = await repository.GetJobAsync(id, ct);
            return job is null ? Results.NotFound() : Results.Ok(job);
        });
        api.MapPost("/jobs", async (CreateJobRequest request, ClaimsPrincipal user, OrderService service, CancellationToken ct) =>
        {
            try
            {
                var job = await service.ConvertQuoteAsync(request.AcceptedQuoteId, user.RequireActorId(settings), ct);
                return Results.Created($"/api/jobs/{job.Id}", job);
            }
            catch (Exception exception) when (exception is InvalidOperationException or OrderConflictException) { return Results.Conflict(new { message = exception.Message }); }
        });
        api.MapPut("/jobs/{id:guid}", async (Guid id, JobNotesRequest request, ClaimsPrincipal user, IPrintCostRepository repository, CancellationToken ct) =>
        {
            var job = await repository.GetJobAsync(id, ct); if (job is null) return Results.NotFound();
            if (job.ActualInput is not null) job = job with { ActualInput = job.ActualInput with { Notes = request.Notes } };
            await repository.UpdateJobAsync(job, null, user.RequireActorId(settings), ct); return Results.Ok(job);
        });
        api.MapPost("/jobs/{id:guid}/start", async (Guid id, ClaimsPrincipal user, QuoteWorkflowService service, CancellationToken ct) =>
        {
            try { return Results.Ok(await service.StartJobAsync(id, user.RequireActorId(settings), ct)); }
            catch (InvalidOperationException exception) { return Results.Conflict(new { message = exception.Message }); }
        });
        api.MapPost("/jobs/{id:guid}/pause", (Guid id, ClaimsPrincipal user, QuoteWorkflowService service, CancellationToken ct) =>
            ChangeJobStatus(id, PrintJobStatus.Paused, user, service, settings, ct));
        api.MapPost("/jobs/{id:guid}/resume", (Guid id, ClaimsPrincipal user, QuoteWorkflowService service, CancellationToken ct) =>
            ChangeJobStatus(id, PrintJobStatus.Printing, user, service, settings, ct));
        api.MapPost("/jobs/{id:guid}/complete", async (Guid id, CompleteJobRequest request, ClaimsPrincipal user, QuoteWorkflowService service, CancellationToken ct) =>
        {
            try { return Results.Ok(await service.CompleteJobAsync(id, request, user.RequireActorId(settings), ct)); }
            catch (InvalidOperationException exception) { return Results.ValidationProblem(new Dictionary<string, string[]> { ["job"] = [exception.Message] }); }
        });
        api.MapPost("/jobs/{id:guid}/fail", (Guid id, ClaimsPrincipal user, QuoteWorkflowService service, CancellationToken ct) =>
            ChangeJobStatus(id, PrintJobStatus.Failed, user, service, settings, ct));
        api.MapPost("/jobs/{id:guid}/cancel", (Guid id, ClaimsPrincipal user, QuoteWorkflowService service, CancellationToken ct) =>
            ChangeJobStatus(id, PrintJobStatus.Cancelled, user, service, settings, ct));

        return app;
    }

    private static async Task<IResult> Revision(Guid id, ClaimsPrincipal user, QuoteWorkflowService service, AuthSettings settings, CancellationToken ct)
    {
        try { return Results.Ok(await service.CreateRevisionAsync(id, user.RequireActorId(settings), ct)); }
        catch (InvalidOperationException exception) { return Results.Conflict(new { message = exception.Message }); }
    }

    private static async Task<IResult> Transition(Guid id, QuoteStatus status, ClaimsPrincipal user, OrderService service, AuthSettings settings, CancellationToken ct)
    {
        try { return Results.Ok(await service.TransitionQuoteAsync(id, status, user.RequireActorId(settings), ct)); }
        catch (Exception exception) when (exception is InvalidOperationException or OrderConflictException) { return Results.Conflict(new { message = exception.Message }); }
    }

    private static async Task<IResult> ChangeJobStatus(Guid id, PrintJobStatus status, ClaimsPrincipal user, QuoteWorkflowService service, AuthSettings settings, CancellationToken ct)
    {
        try { return Results.Ok(await service.TransitionJobAsync(id, status, user.RequireActorId(settings), ct)); }
        catch (InvalidOperationException exception) { return Results.Conflict(new { message = exception.Message }); }
    }
}

public sealed record UpdateQuoteRequest(
    Guid? CustomerId,
    DateOnly? ValidUntil,
    string? Notes,
    string? Terms,
    QuotePreviewRequest? Calculation = null,
    IReadOnlyList<QuoteLineRequest>? Lines = null,
    string? CustomerReference = null,
    string? ItemDescription = null);
public sealed record CreateJobRequest(Guid AcceptedQuoteId);
public sealed record JobNotesRequest(string? Notes);
