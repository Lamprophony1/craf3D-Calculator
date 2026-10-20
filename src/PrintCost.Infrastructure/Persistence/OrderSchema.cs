using Microsoft.EntityFrameworkCore;
namespace PrintCost.Infrastructure.Persistence;

public static class OrderSchema
{
    public static async Task EnsureAsync(PrintCostDbContext db, CancellationToken ct = default)
    {
        await db.Database.ExecuteSqlRawAsync("""
            CREATE TABLE IF NOT EXISTS Orders (
                Id TEXT NOT NULL PRIMARY KEY, QuoteId TEXT NULL REFERENCES Quotes(Id),
                JobId TEXT NULL REFERENCES PrintJobs(Id), QuickSessionId TEXT NULL,
                Version INTEGER NOT NULL, PayloadJson TEXT NOT NULL);
            CREATE UNIQUE INDEX IF NOT EXISTS IX_Orders_QuoteId ON Orders(QuoteId);
            CREATE UNIQUE INDEX IF NOT EXISTS IX_Orders_JobId ON Orders(JobId);
            CREATE UNIQUE INDEX IF NOT EXISTS IX_Orders_QuickSessionId ON Orders(QuickSessionId);
            CREATE TABLE IF NOT EXISTS PrintCostSchemaVersions (Version INTEGER PRIMARY KEY, AppliedAt TEXT NOT NULL);
            """, ct);
        var connection = db.Database.GetDbConnection();
        if (connection.State != System.Data.ConnectionState.Open) await connection.OpenAsync(ct);
        foreach (var table in new[] { "Quotes", "QuoteRevisions" })
        {
            var existing = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            await using (var command = connection.CreateCommand())
            {
                command.CommandText = $"PRAGMA table_info('{table}')";
                await using var reader = await command.ExecuteReaderAsync(ct);
                while (await reader.ReadAsync(ct)) existing.Add(reader.GetString(1));
            }
            foreach (var column in new[] { "CustomerReference", "ItemDescription" }.Where(x => !existing.Contains(x)))
            {
                await using var command = connection.CreateCommand();
                command.CommandText = $"ALTER TABLE {table} ADD COLUMN {column} TEXT NULL";
                await command.ExecuteNonQueryAsync(ct);
            }
        }
        await db.Database.ExecuteSqlRawAsync("INSERT OR IGNORE INTO PrintCostSchemaVersions (Version, AppliedAt) VALUES (1, datetime('now'))", ct);
    }
}
