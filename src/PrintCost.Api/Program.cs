using System.Text.Json.Serialization;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.DataProtection;
using PrintCost.Api.Auth;
using PrintCost.Api.Endpoints;
using PrintCost.Application.Auth;
using PrintCost.Application.Catalogs;
using PrintCost.Application.Quotes;
using PrintCost.Application.Orders;
using PrintCost.Infrastructure;
using PrintCost.Infrastructure.Persistence;

var builder = WebApplication.CreateBuilder(args);
var authSettings = AuthSettings.From(builder.Configuration, builder.Environment);
Directory.CreateDirectory(authSettings.DataProtectionKeysPath);

builder.Logging.ClearProviders();
builder.Logging.AddConsole();
builder.Services.AddProblemDetails();
builder.Services.AddOpenApi();
builder.Services.ConfigureHttpJsonOptions(options => options.SerializerOptions.Converters.Add(new JsonStringEnumConverter()));
builder.Services.AddSingleton(authSettings);
builder.Services.AddSingleton<PinHasher>();
builder.Services.AddScoped<PinAuthService>();
builder.Services.AddScoped<QuoteCalculationService>();
builder.Services.AddScoped<QuoteWorkflowService>();
builder.Services.AddScoped<OrderService>();
builder.Services.AddScoped<SimplePricingSettingsService>();
builder.Services.AddPrintCostInfrastructure(builder.Configuration);
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    options.AddPolicy("login", context => RateLimitPartition.GetFixedWindowLimiter(
        context.Connection.RemoteIpAddress?.ToString() ?? "unknown",
        _ => new FixedWindowRateLimiterOptions { PermitLimit = 8, Window = TimeSpan.FromMinutes(1), QueueLimit = 0 }));
});
builder.Services.AddDataProtection().SetApplicationName("PrintCost.Api")
    .PersistKeysToFileSystem(new DirectoryInfo(authSettings.DataProtectionKeysPath));
builder.Services.AddAuthentication(CookieAuthenticationDefaults.AuthenticationScheme).AddCookie(options =>
{
    options.Cookie.Name = "PrintCost.Auth";
    options.Cookie.HttpOnly = true;
    options.Cookie.SameSite = SameSiteMode.Lax;
    options.Cookie.SecurePolicy = authSettings.CookieSecure ? CookieSecurePolicy.Always : CookieSecurePolicy.SameAsRequest;
    options.Events.OnRedirectToLogin = context => { context.Response.StatusCode = 401; return Task.CompletedTask; };
    options.Events.OnRedirectToAccessDenied = context => { context.Response.StatusCode = 403; return Task.CompletedTask; };
});
builder.Services.AddAuthorization(options => options.AddPolicy(EndpointExtensions.OwnerPolicy, policy => policy.RequireRole("Owner")));

var app = builder.Build();
app.UseExceptionHandler(exceptionApp => exceptionApp.Run(async context =>
{
    context.Response.StatusCode = StatusCodes.Status500InternalServerError;
    await Results.Problem(statusCode: 500, title: "Error interno", detail: "No se pudo completar la operación.").ExecuteAsync(context);
}));
app.UseRateLimiter();

using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<PrintCostDbContext>();
    await db.Database.EnsureCreatedAsync();
    await SeedData.EnsureSeededAsync(db);
    await OrderSchema.EnsureAsync(db);
    await scope.ServiceProvider.GetRequiredService<OrderService>().ImportExistingAsync(CancellationToken.None);
    var auth = scope.ServiceProvider.GetRequiredService<PinAuthService>();
    await auth.BootstrapAsync(SeedData.RafaId, authSettings.BootstrapRafaPin);
    await auth.BootstrapAsync(SeedData.ClariId, authSettings.BootstrapClariPin);
}

if (app.Environment.IsDevelopment()) app.MapOpenApi();

var spaRoot = app.Environment.WebRootPath ?? Path.Combine(app.Environment.ContentRootPath, "wwwroot");
var spaIndex = Path.Combine(spaRoot, "index.html");
if (Directory.Exists(spaRoot))
{
    app.UseDefaultFiles();
    app.UseStaticFiles();
}

app.UseAuthentication();
app.UseAuthorization();

app.MapGet("/health", () => Results.Ok(new { service = "PrintCost.Api", status = "ok", utc = DateTimeOffset.UtcNow }));
app.MapAuthEndpoints(authSettings);
app.MapCatalogEndpoints(authSettings);
app.MapQuoteEndpoints(authSettings);
app.MapOrderEndpoints(authSettings);
app.MapReportEndpoints(authSettings);

if (File.Exists(spaIndex))
{
    app.MapFallback(async context =>
    {
        if (context.Request.Path.StartsWithSegments("/api") || context.Request.Path.StartsWithSegments("/health"))
        {
            context.Response.StatusCode = 404;
            return;
        }
        context.Response.ContentType = "text/html; charset=utf-8";
        await context.Response.SendFileAsync(spaIndex);
    });
}

app.Run();

public partial class Program;
