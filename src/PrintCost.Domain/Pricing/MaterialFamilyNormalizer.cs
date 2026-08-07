namespace PrintCost.Domain.Pricing;

public static class MaterialFamilyNormalizer
{
    public static string Normalize(string? material)
    {
        var normalized = material?.Trim().ToUpperInvariant() ?? string.Empty;
        if (normalized.StartsWith("PLA", StringComparison.Ordinal)) return "PLA";
        if (normalized.StartsWith("PETG", StringComparison.Ordinal)) return "PETG";
        if (normalized.StartsWith("ABS", StringComparison.Ordinal)) return "ABS";
        if (normalized.StartsWith("ASA", StringComparison.Ordinal)) return "ASA";
        if (normalized.StartsWith("TPU", StringComparison.Ordinal)
            || normalized.StartsWith("TPE", StringComparison.Ordinal)) return "TPU";
        return normalized;
    }

    public static bool Matches(string? left, string? right) => Normalize(left) == Normalize(right);
}
