using PrintCost.Application.Orders;
namespace PrintCost.Application.Abstractions;

public interface IOrderStore
{
    Task<OrderRecord?> GetAsync(Guid id, CancellationToken ct);
    Task<IReadOnlyList<OrderRecord>> ListAsync(CancellationToken ct);
    Task<IReadOnlyList<DeliveryDetails>> ListDeliveryDetailsAsync(CancellationToken ct);
    Task<DeliveryDetails?> GetDeliveryDetailsAsync(Guid id, CancellationToken ct);
    Task SaveAsync(OrderRecord order, CancellationToken ct);
    Task<T> TransactionAsync<T>(Func<Task<T>> action, CancellationToken ct);
}
