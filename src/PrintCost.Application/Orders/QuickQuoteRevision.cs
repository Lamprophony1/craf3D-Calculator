using PrintCost.Application.Quotes;
using PrintCost.Domain.Pricing;
namespace PrintCost.Application.Orders;

internal static class QuickQuoteRevision
{
    public static QuoteRevisionRecord Create(QuickQuotePreviewResult quick, int number, Guid actor, string? customer, string? description)
    {
        var capture = quick.CapturedCalculation ?? throw new InvalidOperationException("Falta el cálculo verificado.");
        var input = capture.Snapshot;
        // All projections use the captured snapshot; no second lookup of changing settings.
        var production = PricingCalculator.CalculateProduction(input);
        var aggregate = PricingCalculator.CalculateAggregate(new QuoteAggregateCalculationInput([production], input.Failure, input.Overhead, input.Pricing, input.Tax));
        if (aggregate.CustomerTotalGs != capture.Breakdown.CustomerTotalGs) throw new InvalidOperationException("El importe guardado no coincide con el cálculo.");
        var line = new QuoteLineRecord(Guid.NewGuid(), description ?? "Impresión 3D", quick.AdvancedRequest!, input,
            capture.Breakdown, capture.CanUsePrice, capture.Warnings, production, aggregate.LineAllocations[0]);
        var assumptions = capture.ResolvedAssumptions;
        return new QuoteRevisionRecord(Guid.NewGuid(), number, DateTimeOffset.UtcNow, actor, line.Request, input, line.Breakdown, [line],
            new QuoteAggregateRecord(new QuoteAggregateSnapshot(assumptions.PricingPolicyId, assumptions.PricingPolicyName,
                assumptions.ElectricityTariffId, input.Failure, input.Overhead, input.Pricing, input.Tax), aggregate), customer, description);
    }
    public static QuoteRevisionRecord WithMetadata(QuoteRevisionRecord previous, Guid actor, string? customer, string? description) =>
        previous with { Id = Guid.NewGuid(), RevisionNumber = previous.RevisionNumber + 1, CreatedAt = DateTimeOffset.UtcNow,
            CreatedBy = actor, CustomerReference = customer, ItemDescription = description,
            Lines = previous.EffectiveLines.Select(x => x with { Id = Guid.NewGuid(),
                Description = previous.EffectiveLines.Count == 1 ? description ?? "Impresión 3D" : x.Description }).ToArray() };
}
