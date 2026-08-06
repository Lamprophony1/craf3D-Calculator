using System.Security.Claims;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using PrintCost.Api.Auth;
using PrintCost.Application.Abstractions;
using PrintCost.Application.Auth;

namespace PrintCost.Api.Endpoints;

public static class AuthEndpoints
{
    public static IEndpointRouteBuilder MapAuthEndpoints(this IEndpointRouteBuilder app, AuthSettings settings)
    {
        app.MapGet("/api/auth/login-options", async (PinAuthService service, CancellationToken ct) =>
            Results.Ok(await service.ListOptionsAsync(ct)));

        app.MapPost("/api/auth/login", async (LoginRequest request, PinAuthService service, HttpContext context, CancellationToken ct) =>
        {
            try
            {
                var user = await service.LoginAsync(request, cancellationToken: ct);
                var claims = new[]
                {
                    new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
                    new Claim(ClaimTypes.Name, user.Username),
                    new Claim(ClaimTypes.Role, user.Role)
                };
                await context.SignInAsync(CookieAuthenticationDefaults.AuthenticationScheme,
                    new ClaimsPrincipal(new ClaimsIdentity(claims, CookieAuthenticationDefaults.AuthenticationScheme)));
                return Results.Ok(new { user });
            }
            catch (InvalidOperationException)
            {
                return Results.Problem(statusCode: 400, title: "No se pudo iniciar sesión", detail: "Usuario o PIN inválido.");
            }
        }).RequireRateLimiting("login");

        app.MapGet("/api/auth/me", async (ClaimsPrincipal principal, IPrintCostRepository repository, CancellationToken ct) =>
        {
            if (principal.Identity?.IsAuthenticated != true)
            {
                if (settings.IsPinLogin) return Results.Unauthorized();
                return Results.Ok(new { user = await repository.GetUserAsync(PrintCost.Infrastructure.Persistence.SeedData.RafaId, ct), mode = settings.Mode });
            }
            var user = await repository.GetUserAsync(principal.RequireActorId(settings), ct);
            return user is null ? Results.Unauthorized() : Results.Ok(new { user, mode = settings.Mode });
        });

        app.MapPost("/api/auth/logout", async (HttpContext context) =>
        {
            await context.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);
            return Results.NoContent();
        });

        app.MapPost("/api/auth/change-pin", async (ChangePinRequest request, ClaimsPrincipal principal, PinAuthService service, CancellationToken ct) =>
        {
            try
            {
                await service.ChangePinAsync(principal.RequireActorId(settings), request, ct);
                return Results.NoContent();
            }
            catch (InvalidOperationException)
            {
                return Results.Problem(statusCode: 400, title: "No se pudo cambiar el PIN", detail: "PIN actual inválido o nuevo PIN no válido.");
            }
        }).RequireAuthIfPin(settings);

        return app;
    }
}
