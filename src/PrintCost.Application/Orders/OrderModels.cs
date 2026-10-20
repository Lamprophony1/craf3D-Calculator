using PrintCost.Application.Quotes;
namespace PrintCost.Application.Orders;

public enum OrderStatus { Draft, Confirmed, InProgress, Ready, Delivered, Discarded, Cancelled }
public sealed record OrderRecord(Guid Id, string Code, string? CustomerReference, string? Description,
    int Quantity, decimal? TotalGs, OrderStatus Status, DateTimeOffset CreatedAt, DateTimeOffset UpdatedAt,
    DateOnly? OrderDate, DateOnly? DueDate, DateOnly? DeliveredDate, string? Notes, bool Historical,
    int Position, long Version, Guid? QuoteId = null, Guid? JobId = null, Guid? QuickSessionId = null,
    long QuickSequence = 0, string? QuickKey = null, QuickQuotePreviewResult? QuickPreview = null,
    string? ProductionStatus = null, decimal? ActualCostGs = null, bool QuickLocked = false, bool PriceIsManual = false);
public sealed record OrderInput(Guid Id, string? CustomerReference = null, string? Description = null,
    int Quantity = 1, decimal? TotalGs = null, OrderStatus Status = OrderStatus.Draft,
    DateOnly? OrderDate = null, DateOnly? DueDate = null, DateOnly? DeliveredDate = null,
    string? Notes = null, bool Historical = false, long Version = 0);
public sealed record QuickOrderRequest(Guid SessionId, long Sequence, QuickQuotePreviewRequest Calculation,
    string? CustomerReference = null, string? Description = null);
public sealed record QuickOrderResult(QuickQuotePreviewResult Preview, OrderRecord? Order);
public sealed record OrderPage(IReadOnlyList<OrderRecord> Items, int Total, int DraftCount, int ActiveCount);
public sealed class OrderConflictException(string message) : Exception(message);
