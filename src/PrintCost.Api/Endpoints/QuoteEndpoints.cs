using System.Security.Claims;
using PrintCost.Api.Auth;
using PrintCost.Application.Abstractions;
using PrintCost.Application.Quotes;
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

        api.MapGet("/quotes", async (string? status, DateOnly? from, DateOnly? to, int? skip, int? take, IPrintCostRepository repository, CancellationToken ct) =>
            Results.Ok(await repository.ListQuotesAsync(status, from, to, skip ?? 0, take ?? 50, ct)));
        api.MapGet("/quotes/{id:guid}", async (Guid id, IPrintCostRepository repository, CancellationToken ct) =>
        {
            var quote = await repository.GetQuoteAsync(id, ct);
            return quote is null ? Results.NotFound() : Results.Ok(quote);
        });
        api.MapPost("/quotes", async (CreateQuoteRequest request, ClaimsPrincipal user, QuoteWorkflowService service, CancellationToken ct) =>
        {
            try
            {
                var quote = await service.CreateAsync(request, user.RequireActorId(settings), cancellationToken: ct);
                return Results.Created($"/api/quotes/{quote.Id}", quote);
            }
            catch (Exception exception) when (exception is InvalidOperationException or DomainValidationException)
            { return Results.ValidationProblem(new Dictionary<string, string[]> { ["quote"] = [exception.Message] }); }
        });
        api.MapPut("/quotes/{id:guid}", async (Guid id, UpdateQuoteRequest request, ClaimsPrincipal user, IPrintCostRepository repository, CancellationToken ct) =>
        {
            var quote = await repository.GetQuoteAsync(id, ct);
            if (quote is null) return Results.NotFound();
            if (quote.Status is not QuoteStatus.Draft and not QuoteStatus.Calculated) return Results.Conflict(new { message = "Solo se puede editar una cotización en borrador o calculada." });
            quote = quote with { CustomerId = request.CustomerId, ValidUntil = request.ValidUntil, Notes = request.Notes, Terms = request.Terms, UpdatedAt = DateTimeOffset.UtcNow };
            await repository.UpdateQuoteAsync(quote, ct);
            await repository.AddAuditAsync(user.RequireActorId(settings), "Quote.Updated", "Quote", id, null, ct);
            return Results.Ok(quote);
        });

        api.MapPost("/quotes/{id:guid}/calculate", (Guid id, ClaimsPrincipal user, QuoteWorkflowService service, CancellationToken ct) =>
            Revision(id, user, service, settings, ct));
        api.MapPost("/quotes/{id:guid}/revisions/from-current-costs", (Guid id, ClaimsPrincipal user, QuoteWorkflowService service, CancellationToken ct) =>
            Revision(id, user, service, settings, ct));
        api.MapPost("/quotes/{id:guid}/ready", (Guid id, ClaimsPrincipal user, QuoteWorkflowService service, CancellationToken ct) =>
            Transition(id, QuoteStatus.ReadyToSend, user, service, settings, ct));
        api.MapPost("/quotes/{id:guid}/send", (Guid id, ClaimsPrincipal user, QuoteWorkflowService service, CancellationToken ct) =>
            Transition(id, QuoteStatus.Sent, user, service, settings, ct));
        api.MapPost("/quotes/{id:guid}/accept", (Guid id, ClaimsPrincipal user, QuoteWorkflowService service, CancellationToken ct) =>
            Transition(id, QuoteStatus.Accepted, user, service, settings, ct));
        api.MapPost("/quotes/{id:guid}/reject", (Guid id, ClaimsPrincipal user, QuoteWorkflowService service, CancellationToken ct) =>
            Transition(id, QuoteStatus.Rejected, user, service, settings, ct));
        api.MapPost("/quotes/{id:guid}/cancel", (Guid id, ClaimsPrincipal user, QuoteWorkflowService service, CancellationToken ct) =>
            Transition(id, QuoteStatus.Cancelled, user, service, settings, ct));
        api.MapPost("/quotes/{id:guid}/duplicate", async (Guid id, ClaimsPrincipal user, IPrintCostRepository repository, QuoteWorkflowService service, CancellationToken ct) =>
        {
            var source = await repository.GetQuoteAsync(id, ct);
            if (source is null) return Results.NotFound();
            var revision = source.Revisions.MaxBy(x => x.RevisionNumber)!;
            var duplicate = await service.CreateAsync(new CreateQuoteRequest(revision.Request, source.CustomerId, source.ValidUntil, source.Notes, source.Terms), user.RequireActorId(settings), cancellationToken: ct);
            return Results.Created($"/api/quotes/{duplicate.Id}", duplicate);
        });
        api.MapPost("/quotes/{id:guid}/convert-to-job", async (Guid id, ClaimsPrincipal user, QuoteWorkflowService service, CancellationToken ct) =>
        {
            try
            {
                var job = await service.ConvertToJobAsync(id, user.RequireActorId(settings), ct);
                return Results.Created($"/api/jobs/{job.Id}", job);
            }
            catch (InvalidOperationException exception) { return Results.Conflict(new { message = exception.Message }); }
        });

        api.MapGet("/jobs", async (string? status, DateOnly? from, DateOnly? to, int? skip, int? take, IPrintCostRepository repository, CancellationToken ct) =>
            Results.Ok(await repository.ListJobsAsync(status, from, to, skip ?? 0, take ?? 50, ct)));
        api.MapGet("/jobs/{id:guid}", async (Guid id, IPrintCostRepository repository, CancellationToken ct) =>
        {
            var job = await repository.GetJobAsync(id, ct);
            return job is null ? Results.NotFound() : Results.Ok(job);
        });
        api.MapPost("/jobs", async (CreateJobRequest request, ClaimsPrincipal user, QuoteWorkflowService service, CancellationToken ct) =>
        {
            try
            {
                var job = await service.ConvertToJobAsync(request.AcceptedQuoteId, user.RequireActorId(settings), ct);
                return Results.Created($"/api/jobs/{job.Id}", job);
            }
            catch (InvalidOperationException exception) { return Results.Conflict(new { message = exception.Message }); }
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
        api.MapPost("/jobs/{id:guid}/complete", async (Guid id, CompleteJobRequest request, ClaimsPrincipal user, QuoteWorkflowService service, CancellationToken ct) =>
        {
            try { return Results.Ok(await service.CompleteJobAsync(id, request, user.RequireActorId(settings), ct)); }
            catch (InvalidOperationException exception) { return Results.ValidationProblem(new Dictionary<string, string[]> { ["job"] = [exception.Message] }); }
        });
        api.MapPost("/jobs/{id:guid}/fail", (Guid id, ClaimsPrincipal user, IPrintCostRepository repository, CancellationToken ct) =>
            ChangeJobStatus(id, PrintJobStatus.Failed, user, repository, settings, ct));
        api.MapPost("/jobs/{id:guid}/cancel", (Guid id, ClaimsPrincipal user, IPrintCostRepository repository, CancellationToken ct) =>
            ChangeJobStatus(id, PrintJobStatus.Cancelled, user, repository, settings, ct));

        return app;
    }

    private static async Task<IResult> Revision(Guid id, ClaimsPrincipal user, QuoteWorkflowService service, AuthSettings settings, CancellationToken ct)
    {
        try { return Results.Ok(await service.CreateRevisionAsync(id, user.RequireActorId(settings), ct)); }
        catch (InvalidOperationException exception) { return Results.Conflict(new { message = exception.Message }); }
    }

    private static async Task<IResult> Transition(Guid id, QuoteStatus status, ClaimsPrincipal user, QuoteWorkflowService service, AuthSettings settings, CancellationToken ct)
    {
        try { return Results.Ok(await service.TransitionAsync(id, status, user.RequireActorId(settings), ct)); }
        catch (InvalidOperationException exception) { return Results.Conflict(new { message = exception.Message }); }
    }

    private static async Task<IResult> ChangeJobStatus(Guid id, PrintJobStatus status, ClaimsPrincipal user, IPrintCostRepository repository, AuthSettings settings, CancellationToken ct)
    {
        var job = await repository.GetJobAsync(id, ct); if (job is null) return Results.NotFound();
        if (job.Status == PrintJobStatus.Completed) return Results.Conflict(new { message = "Un trabajo completado es inmutable." });
        job = job with { Status = status, CompletedAt = DateTimeOffset.UtcNow };
        await repository.UpdateJobAsync(job, null, user.RequireActorId(settings), ct);
        await repository.AddAuditAsync(user.RequireActorId(settings), $"PrintJob.{status}", "PrintJob", id, null, ct);
        return Results.Ok(job);
    }
}

public sealed record UpdateQuoteRequest(Guid? CustomerId, DateOnly? ValidUntil, string? Notes, string? Terms);
public sealed record CreateJobRequest(Guid AcceptedQuoteId);
public sealed record JobNotesRequest(string? Notes);
