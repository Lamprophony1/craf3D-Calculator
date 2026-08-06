namespace PrintCost.Api.Auth;

public sealed record AuthSettings(
    string Mode,
    string? BootstrapRafaPin,
    string? BootstrapClariPin,
    bool CookieSecure,
    string DataProtectionKeysPath)
{
    public bool IsPinLogin => string.Equals(Mode, "PinLogin", StringComparison.OrdinalIgnoreCase);

    public static AuthSettings From(IConfiguration configuration, IWebHostEnvironment environment)
    {
        var mode = configuration["Auth:Mode"] ?? (environment.IsDevelopment() ? "DevSelector" : "PinLogin");
        var secure = bool.TryParse(configuration["Auth:CookieSecure"], out var configured) ? configured : !environment.IsDevelopment();
        var keys = configuration["Auth:DataProtectionKeysPath"] ?? Path.Combine(environment.ContentRootPath, ".data-protection-keys");
        return new AuthSettings(mode, configuration["Auth:BootstrapRafaPin"], configuration["Auth:BootstrapClariPin"], secure, keys);
    }
}

