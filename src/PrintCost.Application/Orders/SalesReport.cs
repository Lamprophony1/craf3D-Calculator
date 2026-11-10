using System.Globalization;
using System.Text.Json.Serialization;

namespace PrintCost.Application.Orders;

public sealed record DeliveredOrderFinancials(DateOnly? DeliveredDate, decimal? SalesGs, decimal? RealizedProfitGs);

public sealed record SalesPeriod(
    decimal SalesGs,
    decimal RealizedProfitGs,
    int OrderCount,
    int PricedOrderCount,
    int CostedOrderCount,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? Month = null);

public sealed record SalesReport(string CurrentMonth, SalesPeriod Totals, IReadOnlyList<SalesPeriod> Months, SalesPeriod Undated)
{
    public static SalesReport FromDeliveries(IReadOnlyList<DeliveredOrderFinancials> deliveries, DateTimeOffset now)
    {
        var localNow = TimeZoneInfo.ConvertTimeBySystemTimeZoneId(now, "America/Asuncion");
        var months = deliveries
            .Where(order => order.DeliveredDate.HasValue)
            .GroupBy(order => order.DeliveredDate!.Value.ToString("yyyy-MM", CultureInfo.InvariantCulture))
            .OrderBy(month => month.Key, StringComparer.Ordinal)
            .Select(month => Sum(month, month.Key))
            .ToArray();

        return new SalesReport(localNow.ToString("yyyy-MM", CultureInfo.InvariantCulture), Sum(deliveries), months,
            Sum(deliveries.Where(order => order.DeliveredDate is null)));
    }

    private static SalesPeriod Sum(IEnumerable<DeliveredOrderFinancials> orders, string? month = null) => new(
        orders.Sum(order => order.SalesGs ?? 0m),
        orders.Sum(order => order.RealizedProfitGs ?? 0m),
        orders.Count(),
        orders.Count(order => order.SalesGs.HasValue),
        orders.Count(order => order.RealizedProfitGs.HasValue),
        month);
}
