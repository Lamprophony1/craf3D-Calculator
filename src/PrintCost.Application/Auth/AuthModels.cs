namespace PrintCost.Application.Auth;

public sealed record AppUserDto(Guid Id, string Username, string DisplayName, string Role, bool IsActive);
public sealed record LoginOptionDto(Guid Id, string Username, string DisplayName);
public sealed record LoginRequest(string Username, string Pin);
public sealed record ChangePinRequest(string CurrentPin, string NewPin);
public sealed record AuthCredentialDto(Guid UserId, string PinHash, int FailedAttemptCount, DateTimeOffset? LockedUntil, DateTimeOffset UpdatedAt);

