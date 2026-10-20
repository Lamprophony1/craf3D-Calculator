using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.EntityFrameworkCore;
using PrintCost.Application.Abstractions;
using PrintCost.Application.Orders;
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
