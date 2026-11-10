using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.EntityFrameworkCore;
using PrintCost.Application.Abstractions;
using PrintCost.Application.Orders;
using PrintCost.Application.Quotes;
using PrintCost.Infrastructure.Persistence.Entities;
namespace PrintCost.Infrastructure.Persistence;

public sealed class OrderStore(PrintCostDbContext db) : IOrderStore
{
    private static readonly SemaphoreSlim WriteGate = new(1, 1);
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web) { Converters = { new JsonStringEnumConverter() } };
    public async Task<OrderRecord?> GetAsync(Guid id, CancellationToken ct)
    {
        var entity = await db.Orders.AsNoTracking().SingleOrDefaultAsync(x => x.Id == id, ct);
        return entity is null ? null : JsonSerializer.Deserialize<OrderRecord>(entity.PayloadJson, Json);
    }
    public async Task<IReadOnlyList<OrderRecord>> ListAsync(CancellationToken ct) =>
        (await db.Orders.AsNoTracking().Select(x => x.PayloadJson).ToArrayAsync(ct))
        .Select(x => JsonSerializer.Deserialize<OrderRecord>(x, Json)!).ToArray();

    public async Task<IReadOnlyList<DeliveryDetails>> ListDeliveryDetailsAsync(CancellationToken ct)
    {
        var deliveries = new List<(DeliveryDetails Details, DateTimeOffset CreatedAt)>();
        foreach (var row in await DeliveryRows(db.Orders).ToArrayAsync(ct))
        {
            if (ReadDelivery(row) is { } delivery) deliveries.Add(delivery);
        }
        return deliveries.OrderByDescending(delivery => delivery.CreatedAt)
            .ThenBy(delivery => delivery.Details.Code, StringComparer.Ordinal)
            .ThenBy(delivery => delivery.Details.Id)
            .Select(delivery => delivery.Details).ToArray();
    }

    public async Task<DeliveryDetails?> GetDeliveryDetailsAsync(Guid id, CancellationToken ct)
    {
        var row = await DeliveryRows(db.Orders.Where(order => order.Id == id)).SingleOrDefaultAsync(ct);
        return row is null ? null : ReadDelivery(row)?.Details;
    }

    private IQueryable<DeliveryRow> DeliveryRows(IQueryable<OrderEntity> orders)
    {
        var completed = db.PrintJobs.AsNoTracking().Where(job => job.Status == PrintJobStatus.Completed);
        return from order in orders.AsNoTracking()
            join job in completed on order.JobId equals (Guid?)job.Id into matches
            from job in matches.DefaultIfEmpty()
            select new DeliveryRow(order.Id, order.PayloadJson, job.ActualResultJson);
    }

    private static (DeliveryDetails Details, DateTimeOffset CreatedAt)? ReadDelivery(DeliveryRow row)
    {
        var order = JsonSerializer.Deserialize<CommercialOrderSnapshot>(row.PayloadJson, Json);
        if (order is not { Status: OrderStatus.Delivered }) return null;

        var actual = row.ActualResultJson is { } result
            ? JsonSerializer.Deserialize<CompletedJobFinancialSnapshot>(result, Json)
            : null;
        return (new DeliveryDetails(row.Id, order.Code, order.CustomerReference, order.Description, order.Version,
            order.DeliveredDate, actual?.ActualCustomerTotalGs ?? order.TotalGs, order.ManualActualCostGs,
            actual?.FullyLoadedCostGs, actual?.RealizedProfitGs), order.CreatedAt);
    }

    private sealed record DeliveryRow(Guid Id, string PayloadJson, string? ActualResultJson);
    private sealed record CommercialOrderSnapshot(string Code, string? CustomerReference, string? Description,
        long Version, OrderStatus Status, DateTimeOffset CreatedAt, DateOnly? DeliveredDate, decimal? TotalGs, decimal? ManualActualCostGs);
    private sealed record CompletedJobFinancialSnapshot(decimal? ActualCustomerTotalGs, decimal? FullyLoadedCostGs, decimal? RealizedProfitGs);

    public async Task SaveAsync(OrderRecord order, CancellationToken ct)
    {
        var entity = await db.Orders.SingleOrDefaultAsync(x => x.Id == order.Id, ct);
        if (entity is null) { entity = new OrderEntity { Id = order.Id }; db.Orders.Add(entity); }
        entity.QuoteId = order.QuoteId; entity.JobId = order.JobId;
        entity.QuickSessionId = order.QuickSessionId; entity.Version = order.Version;
        entity.PayloadJson = JsonSerializer.Serialize(order, Json);
        await db.SaveChangesAsync(ct);
    }
    public async Task<T> TransactionAsync<T>(Func<Task<T>> action, CancellationToken ct)
    {
        await WriteGate.WaitAsync(ct);
        try
        {
            await using var transaction = await db.Database.BeginTransactionAsync(ct);
            var result = await action(); await transaction.CommitAsync(ct); return result;
        }
        finally { WriteGate.Release(); }
    }
}
