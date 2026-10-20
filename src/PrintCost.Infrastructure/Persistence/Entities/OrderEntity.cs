namespace PrintCost.Infrastructure.Persistence.Entities;
public sealed class OrderEntity
{
    public Guid Id { get; set; }
    public Guid? QuoteId { get; set; }
    public Guid? JobId { get; set; }
    public Guid? QuickSessionId { get; set; }
    public long Version { get; set; }
    public string PayloadJson { get; set; } = "";
}
