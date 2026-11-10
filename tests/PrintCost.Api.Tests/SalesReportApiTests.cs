using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.Extensions.DependencyInjection;
using PrintCost.Application.Abstractions;
using PrintCost.Application.Orders;
using PrintCost.Application.Quotes;
using PrintCost.Infrastructure.Persistence;
using PrintCost.Infrastructure.Persistence.Entities;

namespace PrintCost.Api.Tests;

public sealed class SalesReportApiTests
{
    [Fact]
    public async Task Delivered_sales_include_undated_orders_and_all_rows_without_imputing_unknown_amounts()
    {
        await using var app = new OrderApiTests.OrderFactory();
        using var client = await app.LoginAsync();
        using var scope = app.Services.CreateScope();
        var orders = scope.ServiceProvider.GetRequiredService<IOrderStore>();
        var january = new DateOnly(2026, 1, 31);
        var february = new DateOnly(2026, 2, 1);

        for (var index = 0; index < 101; index++) await AddOrder(orders, 100m, february);
        await AddOrder(orders, 450m, january);
        await AddOrder(orders, 0m, january);
        await AddOrder(orders, null, january);
        await AddOrder(orders, 600m, null);
        await AddOrder(orders, 7_000m, january, OrderStatus.Confirmed);
        await AddOrder(orders, 8_000m, january, OrderStatus.Cancelled);
        await AddOrder(orders, 9_000m, january, OrderStatus.Draft);

        var report = await client.GetFromJsonAsync<JsonElement>("/api/reports/sales");
        AssertTotals(report.GetProperty("totals"), 11_150m, 0m, 105, 104, 0);
        AssertTotals(report.GetProperty("undated"), 600m, 0m, 1, 1, 0);
        Assert.Collection(report.GetProperty("months").EnumerateArray(),
            month => { Assert.Equal("2026-01", month.GetProperty("month").GetString()); AssertTotals(month, 450m, 0m, 3, 2, 0); },
            month => { Assert.Equal("2026-02", month.GetProperty("month").GetString()); AssertTotals(month, 10_100m, 0m, 101, 101, 0); });
    }

    [Fact]
    public async Task Completed_job_amounts_override_agreed_prices_and_profit_uses_the_linked_snapshot()
    {
        await using var app = new OrderApiTests.OrderFactory();
        using var client = await app.LoginAsync();
        using var scope = app.Services.CreateScope();
        var orders = scope.ServiceProvider.GetRequiredService<IOrderStore>();
        var db = scope.ServiceProvider.GetRequiredService<PrintCostDbContext>();
        var first = AddJob(db, 95_000m, 12_000m);
        var loss = AddJob(db, 0m, -5_000m);
        var zero = AddJob(db, 8_000m, 0m);
        var pending = AddJob(db, 50_000m, 20_000m);
        var cancelled = AddJob(db, 60_000m, 30_000m);
        var noResult = AddJob(db, null, null);
        await db.SaveChangesAsync();
        var delivered = new DateOnly(2026, 3, 1);

        await AddOrder(orders, 99_000m, delivered, jobId: first);
        await AddOrder(orders, 60_000m, delivered, jobId: loss);
        await AddOrder(orders, 15_000m, delivered, jobId: zero);
        await AddOrder(orders, 20_000m, delivered, jobId: noResult);
        await AddOrder(orders, 40_000m, null, OrderStatus.Ready, pending);
        await AddOrder(orders, 40_000m, delivered, OrderStatus.Cancelled, cancelled);

        var report = await client.GetFromJsonAsync<JsonElement>("/api/reports/sales");
        AssertTotals(report.GetProperty("totals"), 123_000m, 7_000m, 4, 4, 3);
        var month = Assert.Single(report.GetProperty("months").EnumerateArray());
        Assert.Equal("2026-03", month.GetProperty("month").GetString());
        AssertTotals(month, 123_000m, 7_000m, 4, 4, 3);
        AssertTotals(report.GetProperty("undated"), 0m, 0m, 0, 0, 0);
    }

    [Fact]
    public async Task Sales_report_uses_the_same_authentication_and_supports_an_empty_history()
    {
        await using var app = new OrderApiTests.OrderFactory();
        using var anonymous = app.CreateClient();
        Assert.Equal(HttpStatusCode.Unauthorized, (await anonymous.GetAsync("/api/reports/sales")).StatusCode);
        using var client = await app.LoginAsync();

        var report = await client.GetFromJsonAsync<JsonElement>("/api/reports/sales");
        Assert.Matches(@"^\d{4}-\d{2}$", report.GetProperty("currentMonth").GetString());
        AssertTotals(report.GetProperty("totals"), 0m, 0m, 0, 0, 0);
        Assert.Empty(report.GetProperty("months").EnumerateArray());
    }

    private static Task AddOrder(IOrderStore orders, decimal? amount, DateOnly? delivered, OrderStatus status = OrderStatus.Delivered, Guid? jobId = null)
    {
        var id = Guid.NewGuid();
        var imported = new DateTimeOffset(2026, 4, 10, 12, 0, 0, TimeSpan.Zero);
        return orders.SaveAsync(new OrderRecord(id, $"PED-{id:N}", null, null, 1, amount, status, imported, imported,
            new DateOnly(2026, 1, 1), null, delivered, null, true, 0, 1, JobId: jobId), CancellationToken.None);
    }

    private static Guid AddJob(PrintCostDbContext db, decimal? actualAmount, decimal? profit)
    {
        var id = Guid.NewGuid();
        var completed = new DateTimeOffset(2026, 2, 28, 23, 0, 0, TimeSpan.Zero);
        db.PrintJobs.Add(new PrintJobEntity
        {
            Id = id, PrinterId = SeedData.PrinterId, Code = $"JOB-{id:N}", Status = PrintJobStatus.Completed,
            CreatedAt = completed.AddDays(-1), CompletedAt = completed, EstimateJson = "{}",
            ActualCostGs = 10_000m,
            ActualResultJson = actualAmount is null ? null : JsonSerializer.Serialize(new
            {
                actualCustomerTotalGs = actualAmount.Value,
                realizedProfitGs = profit!.Value,
                fullyLoadedCostGs = 10_000m
            })
        });
        return id;
    }

    private static void AssertTotals(JsonElement period, decimal sales, decimal profit, int orders, int priced, int costed)
    {
        Assert.Equal(sales, period.GetProperty("salesGs").GetDecimal());
        Assert.Equal(profit, period.GetProperty("realizedProfitGs").GetDecimal());
        Assert.Equal(orders, period.GetProperty("orderCount").GetInt32());
        Assert.Equal(priced, period.GetProperty("pricedOrderCount").GetInt32());
        Assert.Equal(costed, period.GetProperty("costedOrderCount").GetInt32());
    }
}
