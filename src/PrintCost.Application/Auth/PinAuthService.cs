using PrintCost.Application.Abstractions;

namespace PrintCost.Application.Auth;

public sealed class PinAuthService(IPrintCostRepository repository, PinHasher hasher)
{
    private const int MaxAttempts = 5;
    private static readonly TimeSpan Lockout = TimeSpan.FromMinutes(1);

    public async Task<IReadOnlyList<LoginOptionDto>> ListOptionsAsync(CancellationToken cancellationToken = default) =>
        (await repository.ListActiveUsersAsync(cancellationToken))
            .OrderBy(x => x.DisplayName)
            .Select(x => new LoginOptionDto(x.Id, x.Username, x.DisplayName))
            .ToArray();

    public async Task<AppUserDto> LoginAsync(LoginRequest request, DateTimeOffset? now = null, CancellationToken cancellationToken = default)
    {
        ValidatePin(request.Pin);
        var current = now ?? DateTimeOffset.UtcNow;
        var user = (await repository.ListActiveUsersAsync(cancellationToken))
            .SingleOrDefault(x => string.Equals(x.Username, request.Username, StringComparison.OrdinalIgnoreCase));
        if (user is null) throw InvalidCredentials();
        var credential = await repository.GetCredentialAsync(user.Id, cancellationToken);
        if (credential is null || credential.LockedUntil > current) throw InvalidCredentials();

        if (!hasher.Verify(request.Pin, credential.PinHash))
        {
            var attempts = credential.FailedAttemptCount + 1;
            await repository.UpsertCredentialAsync(credential with
            {
                FailedAttemptCount = attempts,
                LockedUntil = attempts >= MaxAttempts ? current.Add(Lockout) : null,
                UpdatedAt = current
            }, cancellationToken);
            throw InvalidCredentials();
        }

        await repository.UpsertCredentialAsync(credential with { FailedAttemptCount = 0, LockedUntil = null, UpdatedAt = current }, cancellationToken);
        await repository.AddAuditAsync(user.Id, "Auth.Login", "AppUser", user.Id, null, cancellationToken);
        return user;
    }

    public async Task ChangePinAsync(Guid userId, ChangePinRequest request, CancellationToken cancellationToken = default)
    {
        ValidatePin(request.CurrentPin);
        ValidatePin(request.NewPin);
        var credential = await repository.GetCredentialAsync(userId, cancellationToken) ?? throw InvalidCredentials();
        if (!hasher.Verify(request.CurrentPin, credential.PinHash)) throw InvalidCredentials();
        await repository.UpsertCredentialAsync(credential with
        {
            PinHash = hasher.Hash(request.NewPin),
            FailedAttemptCount = 0,
            LockedUntil = null,
            UpdatedAt = DateTimeOffset.UtcNow
        }, cancellationToken);
        await repository.AddAuditAsync(userId, "Auth.PinChanged", "AppUser", userId, null, cancellationToken);
    }

    public async Task BootstrapAsync(Guid userId, string? pin, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(pin) || await repository.GetCredentialAsync(userId, cancellationToken) is not null) return;
        ValidatePin(pin);
        await repository.UpsertCredentialAsync(new AuthCredentialDto(userId, hasher.Hash(pin), 0, null, DateTimeOffset.UtcNow), cancellationToken);
        await repository.AddAuditAsync(null, "Auth.PinBootstrapped", "AppUser", userId, null, cancellationToken);
    }

    private static InvalidOperationException InvalidCredentials() => new("Usuario o PIN inválido.");

    private static void ValidatePin(string pin)
    {
        if (pin.Length is < 4 or > 6 || pin.Any(x => !char.IsDigit(x))) throw InvalidCredentials();
    }
}

