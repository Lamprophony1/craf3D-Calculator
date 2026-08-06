using System.Security.Claims;
using PrintCost.Api.Auth;
using PrintCost.Infrastructure.Persistence;

namespace PrintCost.Api.Endpoints;

public static class EndpointExtensions
{
    public const string OwnerPolicy = "OwnerOnly";

    public static RouteHandlerBuilder RequireAuthIfPin(this RouteHandlerBuilder builder, AuthSettings settings)
    {
        if (settings.IsPinLogin) builder.RequireAuthorization();
        return builder;
    }

    public static RouteGroupBuilder RequireAuthIfPin(this RouteGroupBuilder builder, AuthSettings settings)
    {
        if (settings.IsPinLogin) builder.RequireAuthorization();
        return builder;
    }

    public static RouteHandlerBuilder RequireOwnerIfPin(this RouteHandlerBuilder builder, AuthSettings settings)
    {
        if (settings.IsPinLogin) builder.RequireAuthorization(OwnerPolicy);
        return builder;
    }

    public static Guid RequireActorId(this ClaimsPrincipal user, AuthSettings settings)
    {
        if (Guid.TryParse(user.FindFirstValue(ClaimTypes.NameIdentifier), out var id)) return id;
        if (!settings.IsPinLogin) return SeedData.RafaId;
        throw new UnauthorizedAccessException("Sesión inválida.");
    }
}

