using System.Security.Claims;
using PrintCost.Api.Auth;
using PrintCost.Application.Orders;
using PrintCost.Domain.Pricing;
namespace PrintCost.Api.Endpoints;

public static class OrderEndpoints
{
    public static IEndpointRouteBuilder MapOrderEndpoints(this IEndpointRouteBuilder app, AuthSettings settings)
    {
        var api = app.MapGroup("/api/orders").RequireAuthIfPin(settings);
        api.MapGet("", async (string? view, string? search, int? skip, int? take, OrderService service, CancellationToken ct) =>
            Results.Ok(await service.ListAsync(view, search, skip ?? 0, take ?? 25, ct)));
        api.MapGet("/{id:guid}", async (Guid id, OrderService service, CancellationToken ct) =>
            await service.GetAsync(id, ct) is { } order ? Results.Ok(order) : Results.NotFound());
        api.MapGet("/by-quote/{quoteId:guid}", async (Guid quoteId, OrderService service, CancellationToken ct) =>
            await service.GetByQuoteAsync(quoteId, ct) is { } order ? Results.Ok(order) : Results.NotFound());
        api.MapPost("", (OrderInput input, ClaimsPrincipal user, OrderService service, CancellationToken ct) =>
            Run(async () => Results.Ok(await service.CreateAsync(input, user.RequireActorId(settings), ct))));
        api.MapPut("/{id:guid}", (Guid id, OrderInput input, ClaimsPrincipal user, OrderService service, CancellationToken ct) =>
            Run(async () => Results.Ok(await service.UpdateAsync(id, input, user.RequireActorId(settings), ct))));
        api.MapPost("/{id:guid}/status", (Guid id, OrderStatusRequest input, ClaimsPrincipal user, OrderService service, CancellationToken ct) =>
            Run(async () => Results.Ok(await service.TransitionAsync(id, input.Status, input.Version, user.RequireActorId(settings), ct))));
        api.MapPost("/{id:guid}/move", (Guid id, OrderMoveRequest input, ClaimsPrincipal user, OrderService service, CancellationToken ct) =>
            Run(async () => Results.Ok(await service.MoveAsync(id, input.Direction, input.Version, user.RequireActorId(settings), ct))));
        api.MapPost("/quick", (QuickOrderRequest input, ClaimsPrincipal user, OrderService service, CancellationToken ct) =>
            Run(async () => Results.Ok(await service.QuickAsync(input, user.RequireActorId(settings), ct))));
        return app;
    }
    private static async Task<IResult> Run(Func<Task<IResult>> action)
    {
        try { return await action(); }
        catch (OrderConflictException e) { return Results.Conflict(new { message = e.Message }); }
        catch (KeyNotFoundException e) { return Results.NotFound(new { message = e.Message }); }
        catch (Exception e) when (e is InvalidOperationException or DomainValidationException)
        { return Results.BadRequest(new { message = e.Message }); }
    }
}
public sealed record OrderStatusRequest(OrderStatus Status, long Version);
public sealed record OrderMoveRequest(string Direction, long Version);
