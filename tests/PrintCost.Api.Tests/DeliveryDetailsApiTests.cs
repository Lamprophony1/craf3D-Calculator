using System.Globalization;
using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using PrintCost.Application.Abstractions;
using PrintCost.Application.Orders;
using PrintCost.Application.Quotes;
using PrintCost.Infrastructure.Persistence;
using PrintCost.Infrastructure.Persistence.Entities;

namespace PrintCost.Api.Tests;

public sealed class DeliveryDetailsApiTests
{
    private const string DetailsPath = "/api/orders/delivery-details";
    private const string ReportPath = "/api/reports/sales";

    [Fact]
    public async Task Partial_updates_preserve_the_order_and_apply_actual_costs_to_the_delivery_month()
    {
        await using var app = new OrderApiTests.OrderFactory();
        using var client = await app.LoginAsync();
        var id = await CreateDelivered(client, 100_000m);

        var initial = await client.GetFromJsonAsync<JsonElement>(DetailsPath);
        var row = Assert.Single(initial.GetProperty("items").EnumerateArray());
        Assert.Equal(id, row.GetProperty("id").GetGuid());
        Assert.Equal("Cliente histórico", row.GetProperty("customerReference").GetString());
        Assert.Equal("Piezas de prueba", row.GetProperty("description").GetString());
        Assert.Equal(JsonValueKind.Null, row.GetProperty("realizedProfitGs").ValueKind);

        var costs = await SaveDetails(client, id, 1, null, 125_000m);
        Assert.Equal(2, costs.GetProperty("version").GetInt64());
        Assert.Equal(JsonValueKind.Null, costs.GetProperty("deliveredDate").ValueKind);
        Assert.Equal(-25_000m, costs.GetProperty("realizedProfitGs").GetDecimal());
        var undated = await client.GetFromJsonAsync<JsonElement>(ReportPath);
        Assert.Equal(-25_000m, undated.GetProperty("undated").GetProperty("realizedProfitGs").GetDecimal());

        var day = new DateOnly(2026, 1, 31);
        var dated = await SaveDetails(client, id, 2, day, 125_000m);
        Assert.Equal(3, dated.GetProperty("version").GetInt64());
        Assert.Equal("2026-01-31", dated.GetProperty("deliveredDate").GetString());
        var report = await client.GetFromJsonAsync<JsonElement>(ReportPath);
        var month = Assert.Single(report.GetProperty("months").EnumerateArray());
        Assert.Equal("2026-01", month.GetProperty("month").GetString());
        Assert.Equal(-25_000m, month.GetProperty("realizedProfitGs").GetDecimal());
        Assert.Equal(1, month.GetProperty("costedOrderCount").GetInt32());
        Assert.Equal(0, report.GetProperty("undated").GetProperty("orderCount").GetInt32());

        var originalOrder = await client.GetFromJsonAsync<JsonElement>($"/api/orders/{id}");
        Assert.Equal("Delivered", originalOrder.GetProperty("status").GetString());
        Assert.Equal(100_000m, originalOrder.GetProperty("totalGs").GetDecimal());
        Assert.Equal(3, originalOrder.GetProperty("quantity").GetInt32());
        Assert.Equal("Notas anteriores", originalOrder.GetProperty("notes").GetString());
        Assert.Equal(JsonValueKind.Null, originalOrder.GetProperty("quoteId").ValueKind);
        Assert.Equal(JsonValueKind.Null, originalOrder.GetProperty("jobId").ValueKind);
        Assert.Equal(HttpStatusCode.Conflict, (await Write(client, id, 2, day, 0)).StatusCode);

        using var scope = app.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<PrintCostDbContext>();
        Assert.Equal(2, await db.AuditLogs.CountAsync(log => log.Action == "Order.DeliveryDetailsUpdated"));
    }

    [Fact]
    public async Task Zero_costs_are_known_and_missing_sales_leave_profit_unknown()
    {
        await using var app = new OrderApiTests.OrderFactory();
        using var anonymous = app.CreateClient();
        Assert.Equal(HttpStatusCode.Unauthorized, (await anonymous.GetAsync(DetailsPath)).StatusCode);
        using var client = await app.LoginAsync();
        var known = await CreateDelivered(client, 20_000m);
        var unknown = await CreateDelivered(client, null);
        var ready = await CreateDelivered(client, 99_000m, "Ready");
        var initial = await client.GetFromJsonAsync<JsonElement>(DetailsPath);
        Assert.Equal(2, initial.GetProperty("items").GetArrayLength());
        var today = DateOnly.ParseExact(initial.GetProperty("today").GetString()!, "yyyy-MM-dd", CultureInfo.InvariantCulture);
        Assert.Equal(HttpStatusCode.BadRequest, (await Write(client, known, 1, today.AddDays(1), 0m)).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await Write(client, known, 1, today, -1m)).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await Write(client, ready, 1, today, 0m)).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await client.PutAsJsonAsync($"/api/orders/{known}/delivery-details", new { version = 1, manualActualCostGs = 0 })).StatusCode);

        var dateOnly = await SaveDetails(client, known, 1, today, null);
        Assert.Equal(JsonValueKind.Null, dateOnly.GetProperty("manualActualCostGs").ValueKind);
        Assert.Equal(20_000m, (await SaveDetails(client, known, 2, today, 0m)).GetProperty("realizedProfitGs").GetDecimal());
        Assert.Equal(JsonValueKind.Null, (await SaveDetails(client, unknown, 1, today, 0m)).GetProperty("realizedProfitGs").ValueKind);
        var report = await client.GetFromJsonAsync<JsonElement>(ReportPath);
        var month = Assert.Single(report.GetProperty("months").EnumerateArray());
        Assert.Equal(2, month.GetProperty("orderCount").GetInt32());
        Assert.Equal(1, month.GetProperty("costedOrderCount").GetInt32());
    }

    [Fact]
    public async Task Production_amount_and_profit_are_protected_when_completing_the_date()
    {
        await using var app = new OrderApiTests.OrderFactory();
        using var client = await app.LoginAsync();
        using var scope = app.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<PrintCostDbContext>();
        var store = scope.ServiceProvider.GetRequiredService<IOrderStore>();
        var jobId = Guid.NewGuid();
        var id = Guid.NewGuid();
        var now = DateTimeOffset.UtcNow;
        var actual = JsonSerializer.Serialize(new { actualCustomerTotalGs = 80_000m, fullyLoadedCostGs = 52_000m, realizedProfitGs = 21_000m });
        db.PrintJobs.Add(new PrintJobEntity { Id = jobId, PrinterId = SeedData.PrinterId, Code = "JOB-REAL",
            Status = PrintJobStatus.Completed, CreatedAt = now, CompletedAt = now, EstimateJson = "{}", ActualResultJson = actual, ActualCostGs = 52_000m });
        await db.SaveChangesAsync();
        await store.SaveAsync(new OrderRecord(id, "PED-REAL", null, null, 1, 90_000m, OrderStatus.Delivered, now, now,
            null, null, null, null, true, 0, 1, JobId: jobId, ActualCostGs: 52_000m), CancellationToken.None);

        var day = new DateOnly(2026, 3, 1);
        Assert.Equal(HttpStatusCode.BadRequest, (await Write(client, id, 1, day, 0m)).StatusCode);
        var edited = await SaveDetails(client, id, 1, day, null);
        Assert.True(edited.GetProperty("hasProductionResult").GetBoolean());
        Assert.Equal(52_000m, edited.GetProperty("productionActualCostGs").GetDecimal());
        Assert.Equal(80_000m, edited.GetProperty("salesGs").GetDecimal());
        Assert.Equal(21_000m, edited.GetProperty("realizedProfitGs").GetDecimal());
        Assert.Equal("2026-03-01", edited.GetProperty("deliveredDate").GetString());
        Assert.Equal(actual, await db.PrintJobs.Where(job => job.Id == jobId).Select(job => job.ActualResultJson).SingleAsync());
    }

    private static async Task<Guid> CreateDelivered(HttpClient client, decimal? amount, string status = "Delivered")
    {
        var id = Guid.NewGuid();
        using var response = await client.PostAsJsonAsync("/api/orders", new { id, customerReference = "Cliente histórico", description = "Piezas de prueba",
            quantity = 3, totalGs = amount, status, notes = "Notas anteriores", historical = true });
        response.EnsureSuccessStatusCode();
        return id;
    }

    private static Task<HttpResponseMessage> Write(HttpClient client, Guid id, long version, DateOnly? date, decimal? cost) =>
        client.PutAsJsonAsync($"/api/orders/{id}/delivery-details", new { version, deliveredDate = date, manualActualCostGs = cost });

    private static async Task<JsonElement> SaveDetails(HttpClient client, Guid id, long version, DateOnly? date, decimal? cost)
    {
        using var response = await Write(client, id, version, date, cost);
        Assert.True(response.IsSuccessStatusCode, await response.Content.ReadAsStringAsync());
        return await response.Content.ReadFromJsonAsync<JsonElement>();
    }
}
