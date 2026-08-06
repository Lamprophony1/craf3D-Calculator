using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using PrintCost.Application.Quotes;
using PrintCost.Domain.Pricing;
using PrintCost.Infrastructure.Persistence;
using PrintCost.Infrastructure.Persistence.Entities;

namespace PrintCost.Infrastructure.Tests.Persistence;

public sealed class PrintCostPersistenceTests
{
    [Fact]
    public async Task Sqlite_preserves_decimal_seed_values_and_required_unique_index()
    {
        await using var fixture = await DatabaseFixture.CreateAsync();
        var tariff = await fixture.Db.ElectricityTariffs.SingleAsync();
        Assert.Equal(435.51m, tariff.BaseRateGsPerKWh);

        fixture.Db.AppUsers.Add(new AppUserEntity
        {
            Id = Guid.NewGuid(), Username = "rafa", DisplayName = "Duplicado", Role = "Owner",
            IsActive = true, CreatedAt = DateTimeOffset.UtcNow, UpdatedAt = DateTimeOffset.UtcNow
        });
        await Assert.ThrowsAsync<DbUpdateException>(() => fixture.Db.SaveChangesAsync());
    }

    [Fact]
    public async Task Quote_snapshot_is_immutable_and_completion_posts_one_inventory_movement()
    {
        await using var fixture = await DatabaseFixture.CreateAsync();
        var spool = new FilamentSpoolEntity
        {
            Id = Guid.NewGuid(), Manufacturer = "Test", ProductName = "PLA", Material = "PLA", Color = "Blanco",
            PurchaseCurrency = "PYG", PurchaseAmount = 131_250m, LandedCostGs = 131_250m,
            NetWeightGrams = 1_000m, RemainingWeightGrams = 1_000m, IsInventoryTracked = true, IsActive = true
        };
        fixture.Db.FilamentSpools.Add(spool);
        await fixture.Db.SaveChangesAsync();
        var repository = new PrintCostRepository(fixture.Db);
        var workflow = new QuoteWorkflowService(repository, new QuoteCalculationService(repository));
        var preview = new QuotePreviewRequest(
            SeedData.PrinterId, SeedData.EnergyProfileId, SeedData.TariffId, SeedData.PricingPolicyId,
            new QuantityPlan(), 5.4m, 0m, 5.4m, null, 0m, 0m,
            [new MaterialSelection(spool.Id, SlicerTotalGrams: 142m)], [], [],
            AcceptZeroMachineRate: true, ZeroMachineRateReason: "Aún no configurado");
        var quote = await workflow.CreateAsync(new CreateQuoteRequest(preview, null, null, null, null), SeedData.RafaId);
        spool.PurchaseAmount = 200_000m;
        await fixture.Db.SaveChangesAsync();

        var reloaded = await repository.GetQuoteAsync(quote.Id);
        Assert.Equal(18_637.50m, reloaded!.Revisions.Single().Breakdown.MaterialCostGs);
        await workflow.TransitionAsync(quote.Id, QuoteStatus.ReadyToSend, SeedData.RafaId);
        await workflow.TransitionAsync(quote.Id, QuoteStatus.Sent, SeedData.RafaId);
        await workflow.TransitionAsync(quote.Id, QuoteStatus.Accepted, SeedData.RafaId);
        var job = await workflow.ConvertToJobAsync(quote.Id, SeedData.RafaId);
        await workflow.CompleteJobAsync(job.Id, new CompleteJobRequest(
            5.5m, 0.55m, 1, 0, [new ActualMaterialUsage(spool.Id, 140m)], [], [], 0m, 85_000m, null), SeedData.RafaId);

        Assert.Equal(860m, (await fixture.Db.FilamentSpools.SingleAsync(x => x.Id == spool.Id)).RemainingWeightGrams);
        var movement = await fixture.Db.InventoryMovements.SingleAsync();
        Assert.Equal(-140m, movement.Grams);
        Assert.Equal("Consumption", movement.Type);
    }

    private sealed class DatabaseFixture(SqliteConnection connection, PrintCostDbContext db) : IAsyncDisposable
    {
        public PrintCostDbContext Db { get; } = db;

        public static async Task<DatabaseFixture> CreateAsync()
        {
            var connection = new SqliteConnection("Data Source=:memory:;Foreign Keys=True");
            await connection.OpenAsync();
            var db = new PrintCostDbContext(new DbContextOptionsBuilder<PrintCostDbContext>().UseSqlite(connection).Options);
            await db.Database.EnsureCreatedAsync();
            await SeedData.EnsureSeededAsync(db);
            return new DatabaseFixture(connection, db);
        }

        public async ValueTask DisposeAsync()
        {
            await Db.DisposeAsync();
            await connection.DisposeAsync();
        }
    }
}
