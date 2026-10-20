using PrintCost.Application.Orders;
namespace PrintCost.Application.Abstractions;

public interface IOrderStore
{
    Task<OrderRecord?> GetAsync(Guid id, CancellationToken ct);
    Task<IReadOnlyList<OrderRecord>> ListAsync(CancellationToken ct);
    Task SaveAsync(OrderRecord order, CancellationToken ct);
    Task<T> TransactionAsync<T>(Func<Task<T>> action, CancellationToken ct);
}
