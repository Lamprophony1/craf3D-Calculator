using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using PrintCost.Application.Auth;
using PrintCost.Infrastructure.Persistence;

namespace PrintCost.Api.Tests;

public sealed class OrderApiTests
{
    [Theory]
    [InlineData("cancel")]
    [InlineData("reject")]
    public async Task Legacy_quote_terminal_actions_discard_pending_and_allow_explicit_recovery(string action)
    {
        await using var app = new OrderFactory(); using var client = await app.LoginAsync();
        var spoolResponse = await client.PostAsJsonAsync("/api/filaments/simple", new { material = "PLA", displayName = "Blanco", landedCostGs = 132000m, netWeightGrams = 1000 });
        spoolResponse.EnsureSuccessStatusCode(); var spool = (await spoolResponse.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetGuid();
        var response = await client.PostAsJsonAsync("/api/orders/quick", new { sessionId = Guid.NewGuid(), sequence = 1,
            calculation = new { spoolId = spool, printDurationMinutes = 220, totalGrams = 131.04m }, customerReference = "Ana" });
        response.EnsureSuccessStatusCode(); var initial = (await response.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("order");
        var id = initial.GetProperty("id").GetGuid(); var quoteId = initial.GetProperty("quoteId").GetGuid();
        if (action == "reject") foreach (var step in new[] { "calculate", "ready", "send" }) (await client.PostAsync($"/api/quotes/{quoteId}/{step}", null)).EnsureSuccessStatusCode();
        (await client.PostAsync($"/api/quotes/{quoteId}/{action}", null)).EnsureSuccessStatusCode();
        Assert.Equal(0, (await client.GetFromJsonAsync<JsonElement>("/api/orders?view=drafts")).GetProperty("total").GetInt32());
        var discarded = await client.GetFromJsonAsync<JsonElement>($"/api/orders/{id}");
        Assert.Equal("Discarded", discarded.GetProperty("status").GetString());
        Assert.Equal(initial.GetProperty("totalGs").GetDecimal(), discarded.GetProperty("totalGs").GetDecimal());
        var recovered = await client.PostAsJsonAsync($"/api/orders/{id}/status", new { status = "Draft", version = discarded.GetProperty("version").GetInt64() }); recovered.EnsureSuccessStatusCode();
        var current = await recovered.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("Draft", (await client.GetFromJsonAsync<JsonElement>($"/api/quotes/{quoteId}")).GetProperty("status").GetString());
        (await client.PostAsJsonAsync($"/api/orders/{id}/status", new { status = "Confirmed", version = current.GetProperty("version").GetInt64() })).EnsureSuccessStatusCode();
        Assert.Equal(HttpStatusCode.Conflict, (await client.PostAsync($"/api/quotes/{quoteId}/cancel", null)).StatusCode);
        Assert.Equal("Confirmed", (await client.GetFromJsonAsync<JsonElement>($"/api/orders/{id}")).GetProperty("status").GetString());
    }

    [Fact]
    public async Task Duplicating_a_quote_immediately_adds_its_visible_pending_record()
    {
        await using var app = new OrderFactory(); using var client = await app.LoginAsync();
        var spoolResponse = await client.PostAsJsonAsync("/api/filaments/simple", new { material = "PLA", displayName = "Blanco", landedCostGs = 132000m, netWeightGrams = 1000 });
        spoolResponse.EnsureSuccessStatusCode(); var spool = (await spoolResponse.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetGuid();
        var saved = await client.PostAsJsonAsync("/api/orders/quick", new { sessionId = Guid.NewGuid(), sequence = 1,
            calculation = new { spoolId = spool, printDurationMinutes = 220, totalGrams = 131.04m }, customerReference = "Ana" });
        saved.EnsureSuccessStatusCode(); var source = (await saved.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("order");
        var response = await client.PostAsync($"/api/quotes/{source.GetProperty("quoteId").GetGuid()}/duplicate", null); response.EnsureSuccessStatusCode();
        var quote = await response.Content.ReadFromJsonAsync<JsonElement>();
        var linked = await client.GetFromJsonAsync<JsonElement>($"/api/orders/by-quote/{quote.GetProperty("id").GetGuid()}");
        Assert.NotEqual(source.GetProperty("id").GetGuid(), linked.GetProperty("id").GetGuid());
        Assert.Equal("Ana", linked.GetProperty("customerReference").GetString());
        Assert.Equal("Draft", linked.GetProperty("status").GetString());
        Assert.Equal(2, (await client.GetFromJsonAsync<JsonElement>("/api/orders?view=drafts")).GetProperty("total").GetInt32());
    }

    [Fact]
    public async Task Budget_confirmation_moves_the_same_record_from_pending_into_orders_without_production()
    {
        await using var app = new OrderFactory(); using var client = await app.LoginAsync();
        var spoolResponse = await client.PostAsJsonAsync("/api/filaments/simple", new { material = "PLA", displayName = "Blanco", landedCostGs = 132000m, netWeightGrams = 1000 });
        spoolResponse.EnsureSuccessStatusCode();
        var spool = (await spoolResponse.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetGuid();
        var saved = await client.PostAsJsonAsync("/api/orders/quick", new { sessionId = Guid.NewGuid(), sequence = 1,
            calculation = new { spoolId = spool, printDurationMinutes = 220, totalGrams = 131.04m }, customerReference = "Ana" });
        saved.EnsureSuccessStatusCode(); var original = (await saved.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("order");
        var id = original.GetProperty("id").GetGuid();
        var linked = await client.GetFromJsonAsync<JsonElement>($"/api/orders/by-quote/{original.GetProperty("quoteId").GetGuid()}");
        Assert.Equal(id, linked.GetProperty("id").GetGuid());
        var pending = await client.GetFromJsonAsync<JsonElement>("/api/orders?view=drafts");
        Assert.Equal(id, pending.GetProperty("items")[0].GetProperty("id").GetGuid());
        Assert.Equal(0, (await client.GetFromJsonAsync<JsonElement>("/api/orders?view=quoted")).GetProperty("total").GetInt32());
        (await client.PostAsJsonAsync($"/api/orders/{id}/status", new { status = "Confirmed", version = 1 })).EnsureSuccessStatusCode();
        Assert.Equal(0, (await client.GetFromJsonAsync<JsonElement>("/api/orders?view=drafts")).GetProperty("total").GetInt32());
        var accepted = await client.GetFromJsonAsync<JsonElement>("/api/orders?view=quoted");
        Assert.Equal(id, accepted.GetProperty("items")[0].GetProperty("id").GetGuid());
        Assert.Equal(original.GetProperty("totalGs").GetDecimal(), accepted.GetProperty("items")[0].GetProperty("totalGs").GetDecimal());
        Assert.Equal(1, (await client.GetFromJsonAsync<JsonElement>("/api/orders?view=active")).GetProperty("total").GetInt32());
        (await client.PostAsJsonAsync("/api/orders", new { id = Guid.NewGuid(), customerReference = "Precio fijo", totalGs = 50000, status = "Confirmed" })).EnsureSuccessStatusCode();
        Assert.Equal(1, (await client.GetFromJsonAsync<JsonElement>("/api/orders?view=quoted")).GetProperty("total").GetInt32());
        using var scope = app.Services.CreateScope(); var db = scope.ServiceProvider.GetRequiredService<PrintCostDbContext>();
        Assert.Equal(2, await db.Orders.CountAsync()); Assert.Equal(1, await db.Quotes.CountAsync());
        Assert.Equal(0, await db.PrintJobs.CountAsync()); Assert.Equal(0, await db.InventoryMovements.CountAsync());
    }

    [Fact]
    public async Task Manual_order_keeps_total_without_quote_production_or_stock()
    {
        await using var app = new OrderFactory();
        using var client = await app.LoginAsync();
        var response = await client.PostAsJsonAsync("/api/orders", new { id = Guid.NewGuid(), customerReference = "Ana / WhatsApp", quantity = 3, totalGs = 100000, status = "Confirmed" });
        response.EnsureSuccessStatusCode();
        var order = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(100000m, order.GetProperty("totalGs").GetDecimal());
        Assert.Equal("Confirmed", order.GetProperty("status").GetString());
        Assert.Equal(JsonValueKind.Null, order.GetProperty("quoteId").ValueKind);
        using var scope = app.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<PrintCostDbContext>();
        Assert.Equal(0, await db.Quotes.CountAsync());
        Assert.Equal(0, await db.PrintJobs.CountAsync());
        Assert.Equal(0, await db.InventoryMovements.CountAsync());
    }

    [Fact]
    public async Task Partial_draft_retries_validation_discard_and_restore()
    {
        await using var app = new OrderFactory();
        using var client = await app.LoginAsync();
        var id = Guid.NewGuid();
        (await client.PostAsJsonAsync("/api/orders", new { id, status = "Draft", quantity = 1 })).EnsureSuccessStatusCode();
        (await client.PostAsJsonAsync("/api/orders", new { id, status = "Draft", quantity = 1 })).EnsureSuccessStatusCode();
        Assert.Equal(HttpStatusCode.BadRequest, (await client.PostAsJsonAsync($"/api/orders/{id}/status", new { status = "Confirmed", version = 1 })).StatusCode);
        (await client.PostAsJsonAsync($"/api/orders/{id}/status", new { status = "Discarded", version = 1 })).EnsureSuccessStatusCode();
        (await client.PostAsJsonAsync($"/api/orders/{id}/status", new { status = "Draft", version = 2 })).EnsureSuccessStatusCode();
        var list = await client.GetFromJsonAsync<JsonElement>("/api/orders?view=drafts");
        Assert.Equal(1, list.GetProperty("total").GetInt32());
    }

    [Fact]
    public async Task Quick_quote_preserves_real_price_metadata_retries_and_rejects_late_or_closed_updates()
    {
        await using var app = new OrderFactory(); using var client = await app.LoginAsync();
        (await client.PutAsJsonAsync("/api/pricing/simple-settings", new { machineHourlyRateGs = 2000, preparationMinutes = 30,
            laborHourlyRateGs = 10000, packagingCostGs = 1500, failureProbabilityPercent = 10, overheadPercent = 5,
            targetMarginPercent = 40, minimumMarginPercent = 30, minimumOrderGs = 10000, roundingIncrementGs = 10000 })).EnsureSuccessStatusCode();
        var spoolResponse = await client.PostAsJsonAsync("/api/filaments/simple", new { material = "PLA", displayName = "Creality blanco", landedCostGs = 132000.01m, netWeightGrams = 1000 });
        spoolResponse.EnsureSuccessStatusCode();
        var spool = (await spoolResponse.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetGuid();
        var session = Guid.NewGuid();
        object Payload(long sequence, string customer, decimal grams = 131.04m) => new { sessionId = session, sequence,
            calculation = new { spoolId = spool, printDurationMinutes = 220, totalGrams = grams }, customerReference = customer, description = "Soporte" };
        var response = await client.PostAsJsonAsync("/api/orders/quick", Payload(1, "Ana")); response.EnsureSuccessStatusCode();
        var first = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(60000m, first.GetProperty("preview").GetProperty("breakdown").GetProperty("customerTotalGs").GetDecimal());
        var id = first.GetProperty("order").GetProperty("id").GetGuid();
        var quoteId = first.GetProperty("order").GetProperty("quoteId").GetGuid();
        (await client.PostAsJsonAsync("/api/orders/quick", Payload(1, "Ana"))).EnsureSuccessStatusCode();
        (await client.PutAsJsonAsync($"/api/filaments/{spool}/simple", new { material = "PLA", displayName = "Creality blanco", landedCostGs = 264000m, netWeightGrams = 1000 })).EnsureSuccessStatusCode();
        var metadata = await client.PostAsJsonAsync("/api/orders/quick", Payload(2, "Ana WhatsApp")); metadata.EnsureSuccessStatusCode();
        var second = await metadata.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(60000m, second.GetProperty("order").GetProperty("totalGs").GetDecimal());
        Assert.Equal(id, second.GetProperty("order").GetProperty("id").GetGuid());
        var quote = await client.GetFromJsonAsync<JsonElement>($"/api/quotes/{quoteId}");
        Assert.Equal("Ana WhatsApp", quote.GetProperty("customerReference").GetString());
        Assert.Equal(2, quote.GetProperty("revisions").GetArrayLength());
        Assert.Equal("Ana", quote.GetProperty("revisions")[0].GetProperty("customerReference").GetString());
        var changed = await client.PostAsJsonAsync("/api/orders/quick", Payload(3, "Ana WhatsApp", 200m)); changed.EnsureSuccessStatusCode();
        var latest = await changed.Content.ReadFromJsonAsync<JsonElement>();
        Assert.True(latest.GetProperty("order").GetProperty("totalGs").GetDecimal() > 60000m);
        Assert.Equal(HttpStatusCode.Conflict, (await client.PostAsJsonAsync("/api/orders/quick", Payload(2, "Ana WhatsApp"))).StatusCode);
        var manualEdit = await client.PutAsJsonAsync($"/api/orders/{id}", new { id, customerReference = "Ana WhatsApp", description = "Soporte", quantity = 1,
            totalGs = 123456m, version = latest.GetProperty("order").GetProperty("version").GetInt64() });
        manualEdit.EnsureSuccessStatusCode();
        var manual = await manualEdit.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(HttpStatusCode.Conflict, (await client.PostAsJsonAsync("/api/orders/quick", Payload(4, "Ana WhatsApp", 200m))).StatusCode);
        Assert.Equal(123456m, (await client.GetFromJsonAsync<JsonElement>($"/api/orders/{id}")).GetProperty("totalGs").GetDecimal());
        (await client.PostAsJsonAsync($"/api/orders/{id}/status", new { status = "Confirmed", version = manual.GetProperty("version").GetInt64() })).EnsureSuccessStatusCode();
        Assert.Equal(HttpStatusCode.Conflict, (await client.PostAsJsonAsync("/api/orders/quick", Payload(5, "Ana WhatsApp"))).StatusCode);
        using var scope = app.Services.CreateScope(); var db = scope.ServiceProvider.GetRequiredService<PrintCostDbContext>();
        Assert.Equal(1, await db.Orders.CountAsync()); Assert.Equal(1, await db.Quotes.CountAsync()); Assert.Equal(0, await db.InventoryMovements.CountAsync());
    }

    [Fact]
    public async Task Priority_is_global_versioned_and_history_accepts_unknown_data_without_stock()
    {
        await using var app = new OrderFactory(); using var client = await app.LoginAsync();
        var ids = new[] { Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid() };
        for (var i = 0; i < ids.Length; i++) (await client.PostAsJsonAsync("/api/orders", new { id = ids[i], customerReference = $"Cliente {i}", quantity = 1, totalGs = 10000, status = "Confirmed" })).EnsureSuccessStatusCode();
        (await client.PostAsJsonAsync($"/api/orders/{ids[2]}/move", new { direction = "first", version = 1 })).EnsureSuccessStatusCode();
        var page = await client.GetFromJsonAsync<JsonElement>("/api/orders?view=active&take=1");
        Assert.Equal(ids[2], page.GetProperty("items")[0].GetProperty("id").GetGuid()); Assert.Equal(3, page.GetProperty("total").GetInt32());
        var found = await client.GetFromJsonAsync<JsonElement>("/api/orders?view=active&search=Cliente%200");
        Assert.Equal(2, found.GetProperty("items")[0].GetProperty("position").GetInt32());
        Assert.Equal(HttpStatusCode.Conflict, (await client.PostAsJsonAsync($"/api/orders/{ids[2]}/move", new { direction = "down", version = 1 })).StatusCode);
        (await client.PostAsJsonAsync("/api/orders", new { id = Guid.NewGuid(), quantity = 1, status = "Delivered", historical = true, orderDate = "2026-07-15" })).EnsureSuccessStatusCode();
        var history = await client.GetFromJsonAsync<JsonElement>("/api/orders?view=history");
        Assert.Equal(JsonValueKind.Null, history.GetProperty("items")[0].GetProperty("totalGs").ValueKind);
        using var scope = app.Services.CreateScope(); var db = scope.ServiceProvider.GetRequiredService<PrintCostDbContext>();
        await OrderSchema.EnsureAsync(db); await OrderSchema.EnsureAsync(db);
        Assert.Equal(4, await db.Orders.CountAsync()); Assert.Equal(0, await db.InventoryMovements.CountAsync());
    }

    [Fact]
    public async Task Quote_metadata_edit_keeps_snapshot_syncs_order_and_locks_old_quick_tab()
    {
        await using var app = new OrderFactory(); using var client = await app.LoginAsync();
        var spoolResponse = await client.PostAsJsonAsync("/api/filaments/simple", new { material = "PLA", displayName = "Blanco", landedCostGs = 132000m, netWeightGrams = 1000 });
        spoolResponse.EnsureSuccessStatusCode();
        var spool = (await spoolResponse.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetGuid();
        var session = Guid.NewGuid();
        object Payload(int sequence) => new { sessionId = session, sequence, calculation = new { spoolId = spool, printDurationMinutes = 220, totalGrams = 131.04m }, customerReference = "Ana" };
        var response = await client.PostAsJsonAsync("/api/orders/quick", Payload(1)); response.EnsureSuccessStatusCode();
        var initial = (await response.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("order");
        var quoteId = initial.GetProperty("quoteId").GetGuid(); var orderId = initial.GetProperty("id").GetGuid();
        var before = await client.GetFromJsonAsync<JsonElement>($"/api/quotes/{quoteId}");
        var revision = before.GetProperty("revisions")[0];
        (await client.PutAsJsonAsync($"/api/filaments/{spool}/simple", new { material = "PLA", displayName = "Blanco", landedCostGs = 264000m, netWeightGrams = 1000 })).EnsureSuccessStatusCode();
        var edit = await client.PutAsJsonAsync($"/api/quotes/{quoteId}", new { customerReference = "Luis", itemDescription = "Soporte", calculation = revision.GetProperty("request"),
            lines = revision.GetProperty("lines").EnumerateArray().Select(x => new { description = x.GetProperty("description").GetString(), calculation = x.GetProperty("request") }).ToArray() });
        edit.EnsureSuccessStatusCode();
        var after = await edit.Content.ReadFromJsonAsync<JsonElement>(); var revisions = after.GetProperty("revisions");
        Assert.Equal(revision.GetProperty("aggregate").GetProperty("breakdown").GetRawText(), revisions[revisions.GetArrayLength() - 1].GetProperty("aggregate").GetProperty("breakdown").GetRawText());
        var order = await client.GetFromJsonAsync<JsonElement>($"/api/orders/{orderId}");
        Assert.Equal("Luis", order.GetProperty("customerReference").GetString());
        Assert.Equal(initial.GetProperty("totalGs").GetDecimal(), order.GetProperty("totalGs").GetDecimal());
        Assert.Equal(HttpStatusCode.Conflict, (await client.PostAsJsonAsync("/api/orders/quick", Payload(2))).StatusCode);
    }

    [Theory]
    [InlineData("InProgress")]
    [InlineData("Ready")]
    [InlineData("Delivered")]
    [InlineData("Discarded")]
    public async Task Linking_production_preserves_commercial_state_and_rejects_discarded(string target)
    {
        await using var app = new OrderFactory(); using var client = await app.LoginAsync();
        var spoolResponse = await client.PostAsJsonAsync("/api/filaments/simple", new { material = "PLA", displayName = "Blanco", landedCostGs = 132000m, netWeightGrams = 1000 });
        spoolResponse.EnsureSuccessStatusCode();
        var spool = (await spoolResponse.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetGuid();
        var saved = await client.PostAsJsonAsync("/api/orders/quick", new { sessionId = Guid.NewGuid(), sequence = 1,
            calculation = new { spoolId = spool, printDurationMinutes = 220, totalGrams = 131.04m }, customerReference = "Ana" });
        saved.EnsureSuccessStatusCode(); var initial = (await saved.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("order");
        var quoteId = initial.GetProperty("quoteId").GetGuid(); var orderId = initial.GetProperty("id").GetGuid();
        long version = 1;
        foreach (var status in target == "Discarded" ? ["Discarded"] : new[] { "Confirmed", "InProgress", "Ready", "Delivered" })
        {
            (await client.PostAsJsonAsync($"/api/orders/{orderId}/status", new { status, version = version++ })).EnsureSuccessStatusCode();
            if (status == target) break;
        }
        foreach (var action in new[] { "calculate", "ready", "send", "accept" }) (await client.PostAsync($"/api/quotes/{quoteId}/{action}", null)).EnsureSuccessStatusCode();
        var converted = await client.PostAsync($"/api/quotes/{quoteId}/convert-to-job", null);
        if (target == "Discarded") Assert.Equal(HttpStatusCode.Conflict, converted.StatusCode); else converted.EnsureSuccessStatusCode();
        Assert.Equal(target, (await client.GetFromJsonAsync<JsonElement>($"/api/orders/{orderId}")).GetProperty("status").GetString());
    }

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task Accepted_quote_conversion_reuses_its_order_and_is_idempotent(bool manualOverride)
    {
        await using var app = new OrderFactory(); using var client = await app.LoginAsync();
        var spoolResponse = await client.PostAsJsonAsync("/api/filaments/simple", new { material = "PLA", displayName = "Blanco", landedCostGs = 132000m, netWeightGrams = 1000 });
        spoolResponse.EnsureSuccessStatusCode();
        var spool = (await spoolResponse.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetGuid();
        var saved = await client.PostAsJsonAsync("/api/orders/quick", new { sessionId = Guid.NewGuid(), sequence = 1,
            calculation = new { spoolId = spool, printDurationMinutes = 220, totalGrams = 131.04m }, customerReference = "Cliente libre" });
        saved.EnsureSuccessStatusCode(); var draft = await saved.Content.ReadFromJsonAsync<JsonElement>();
        var quoteId = draft.GetProperty("order").GetProperty("quoteId").GetGuid();
        var orderId = draft.GetProperty("order").GetProperty("id").GetGuid();
        if (manualOverride) (await client.PutAsJsonAsync($"/api/orders/{orderId}", new { id = orderId, customerReference = "Cliente libre", quantity = 1, totalGs = 123456m, version = 1 })).EnsureSuccessStatusCode();
        (await client.PutAsJsonAsync($"/api/filaments/{spool}/simple", new { material = "PLA", displayName = "Blanco", landedCostGs = 264000m, netWeightGrams = 1000 })).EnsureSuccessStatusCode();
        foreach (var action in new[] { "calculate", "ready", "send", "accept" }) (await client.PostAsync($"/api/quotes/{quoteId}/{action}", null)).EnsureSuccessStatusCode();
        var quote = await client.GetFromJsonAsync<JsonElement>($"/api/quotes/{quoteId}");
        var first = await client.PostAsync($"/api/quotes/{quoteId}/convert-to-job", null); first.EnsureSuccessStatusCode();
        var second = await client.PostAsync($"/api/quotes/{quoteId}/convert-to-job", null); second.EnsureSuccessStatusCode();
        Assert.Equal((await first.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetGuid(), (await second.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetGuid());
        var order = await client.GetFromJsonAsync<JsonElement>($"/api/orders/{orderId}");
        var revisions = quote.GetProperty("revisions");
        Assert.Equal(manualOverride ? 123456m : revisions[revisions.GetArrayLength() - 1].GetProperty("aggregate").GetProperty("breakdown").GetProperty("customerTotalGs").GetDecimal(), order.GetProperty("totalGs").GetDecimal());
        using var scope = app.Services.CreateScope(); var db = scope.ServiceProvider.GetRequiredService<PrintCostDbContext>();
        Assert.Equal(1, await db.Orders.CountAsync()); Assert.Equal(1, await db.PrintJobs.CountAsync());
    }

    [Fact]
    public async Task Previous_schema_is_upgraded_without_repricing_or_duplicate_links()
    {
        var app = new OrderFactory(); using var client = await app.LoginAsync();
        var spoolResponse = await client.PostAsJsonAsync("/api/filaments/simple", new { material = "PLA", displayName = "Antiguo", landedCostGs = 132000m, netWeightGrams = 1000 });
        spoolResponse.EnsureSuccessStatusCode();
        var spool = (await spoolResponse.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetGuid();
        var saved = await client.PostAsJsonAsync("/api/orders/quick", new { sessionId = Guid.NewGuid(), sequence = 1, calculation = new { spoolId = spool, printDurationMinutes = 120, totalGrams = 100m } });
        saved.EnsureSuccessStatusCode(); var before = await saved.Content.ReadFromJsonAsync<JsonElement>();
        var quoteId = before.GetProperty("order").GetProperty("quoteId").GetGuid();
        var original = await client.GetFromJsonAsync<JsonElement>($"/api/quotes/{quoteId}");
        foreach (var action in new[] { "calculate", "ready", "send", "accept", "convert-to-job" }) (await client.PostAsync($"/api/quotes/{quoteId}/{action}", null)).EnsureSuccessStatusCode();
        using (var scope = app.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<PrintCostDbContext>();
            await db.Database.ExecuteSqlRawAsync("DROP TABLE Orders; ALTER TABLE Quotes DROP COLUMN CustomerReference; ALTER TABLE Quotes DROP COLUMN ItemDescription; ALTER TABLE QuoteRevisions DROP COLUMN CustomerReference; ALTER TABLE QuoteRevisions DROP COLUMN ItemDescription;");
        }
        await app.DisposeAsync();
        await using var restarted = new OrderFactory(app.DatabasePath); using var next = await restarted.LoginAsync();
        var page = await next.GetFromJsonAsync<JsonElement>("/api/orders?view=active");
        Assert.Equal(1, page.GetProperty("total").GetInt32());
        Assert.Equal(quoteId, page.GetProperty("items")[0].GetProperty("quoteId").GetGuid());
        var legacy = page.GetProperty("items")[0];
        (await next.PutAsJsonAsync($"/api/orders/{legacy.GetProperty("id").GetGuid()}", new { id = legacy.GetProperty("id").GetGuid(),
            quantity = 1, totalGs = legacy.GetProperty("totalGs").GetDecimal(), version = legacy.GetProperty("version").GetInt64(), notes = "Completar referencia después" })).EnsureSuccessStatusCode();
        var after = await next.GetFromJsonAsync<JsonElement>($"/api/quotes/{quoteId}");
        Assert.Equal(original.GetProperty("revisions")[0].GetProperty("breakdown").GetRawText(), after.GetProperty("revisions")[0].GetProperty("breakdown").GetRawText());
        using var verification = restarted.Services.CreateScope(); var context = verification.ServiceProvider.GetRequiredService<PrintCostDbContext>();
        await OrderSchema.EnsureAsync(context); await OrderSchema.EnsureAsync(context);
        Assert.Equal(1, await context.Orders.CountAsync());
    }

    public sealed class OrderFactory(string? databasePath = null) : WebApplicationFactory<Program>
    {
        public string DatabasePath { get; } = databasePath ?? Path.Combine(Path.GetTempPath(), $"orders-{Guid.NewGuid():N}.db");
        protected override void ConfigureWebHost(IWebHostBuilder builder)
        {
            builder.UseEnvironment("Test");
            builder.UseSetting("ConnectionStrings:PrintCost", $"Data Source={DatabasePath}");
            builder.UseSetting("Auth:Mode", "PinLogin");
            builder.UseSetting("Auth:CookieSecure", "false");
            builder.UseSetting("Auth:DataProtectionKeysPath", Path.Combine(Path.GetTempPath(), $"orders-keys-{Guid.NewGuid():N}"));
            builder.UseSetting("Auth:BootstrapRafaPin", "1234");
            builder.UseSetting("Auth:BootstrapClariPin", "5678");
        }
        public async Task<HttpClient> LoginAsync()
        {
            var client = CreateClient();
            (await client.PostAsJsonAsync("/api/auth/login", new LoginRequest("rafa", "1234"))).EnsureSuccessStatusCode();
            return client;
        }
    }
}
