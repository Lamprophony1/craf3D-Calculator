using Microsoft.EntityFrameworkCore;
using PrintCost.Infrastructure.Persistence.Entities;

namespace PrintCost.Infrastructure.Persistence;

public sealed class PrintCostDbContext(DbContextOptions<PrintCostDbContext> options) : DbContext(options)
{
    public DbSet<OrderEntity> Orders => Set<OrderEntity>();
    public DbSet<AppUserEntity> AppUsers => Set<AppUserEntity>();
    public DbSet<AuthCredentialEntity> AuthCredentials => Set<AuthCredentialEntity>();
    public DbSet<PrinterEntity> Printers => Set<PrinterEntity>();
    public DbSet<EnergyProfileEntity> EnergyProfiles => Set<EnergyProfileEntity>();
    public DbSet<ElectricityTariffEntity> ElectricityTariffs => Set<ElectricityTariffEntity>();
    public DbSet<FilamentSpoolEntity> FilamentSpools => Set<FilamentSpoolEntity>();
    public DbSet<InventoryMovementEntity> InventoryMovements => Set<InventoryMovementEntity>();
    public DbSet<PricingPolicyEntity> PricingPolicies => Set<PricingPolicyEntity>();
    public DbSet<CustomerEntity> Customers => Set<CustomerEntity>();
    public DbSet<ProductTemplateEntity> ProductTemplates => Set<ProductTemplateEntity>();
    public DbSet<ApplicationSettingEntity> ApplicationSettings => Set<ApplicationSettingEntity>();
    public DbSet<QuoteEntity> Quotes => Set<QuoteEntity>();
    public DbSet<QuoteRevisionEntity> QuoteRevisions => Set<QuoteRevisionEntity>();
    public DbSet<QuoteLineEntity> QuoteLines => Set<QuoteLineEntity>();
    public DbSet<QuoteMaterialLineEntity> QuoteMaterialLines => Set<QuoteMaterialLineEntity>();
    public DbSet<QuoteLaborLineEntity> QuoteLaborLines => Set<QuoteLaborLineEntity>();
    public DbSet<QuoteAdditionalCostLineEntity> QuoteAdditionalCostLines => Set<QuoteAdditionalCostLineEntity>();
    public DbSet<QuoteCostSnapshotEntity> QuoteCostSnapshots => Set<QuoteCostSnapshotEntity>();
    public DbSet<PrintJobEntity> PrintJobs => Set<PrintJobEntity>();
    public DbSet<PrintJobMaterialUsageEntity> PrintJobMaterialUsages => Set<PrintJobMaterialUsageEntity>();
    public DbSet<PrintJobLaborEntryEntity> PrintJobLaborEntries => Set<PrintJobLaborEntryEntity>();
    public DbSet<PrintJobAdditionalCostEntity> PrintJobAdditionalCosts => Set<PrintJobAdditionalCostEntity>();
    public DbSet<PrintJobCostSnapshotEntity> PrintJobCostSnapshots => Set<PrintJobCostSnapshotEntity>();
    public DbSet<AuditLogEntity> AuditLogs => Set<AuditLogEntity>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<OrderEntity>(b =>
        {
            b.HasKey(x => x.Id); b.HasIndex(x => x.QuoteId).IsUnique(); b.HasIndex(x => x.JobId).IsUnique();
            b.HasIndex(x => x.QuickSessionId).IsUnique(); b.Property(x => x.Version).IsConcurrencyToken();
            b.HasOne<QuoteEntity>().WithMany().HasForeignKey(x => x.QuoteId).OnDelete(DeleteBehavior.Restrict);
            b.HasOne<PrintJobEntity>().WithMany().HasForeignKey(x => x.JobId).OnDelete(DeleteBehavior.Restrict);
        });
        modelBuilder.Entity<AppUserEntity>(b =>
        {
            b.HasKey(x => x.Id);
            b.Property(x => x.Username).HasMaxLength(80);
            b.Property(x => x.DisplayName).HasMaxLength(120);
            b.Property(x => x.Role).HasMaxLength(40);
            b.HasIndex(x => x.Username).IsUnique();
        });
        modelBuilder.Entity<AuthCredentialEntity>(b =>
        {
            b.HasKey(x => x.UserId);
            b.Property(x => x.PinHash).HasMaxLength(256);
            b.HasOne(x => x.User).WithOne(x => x.Credential).HasForeignKey<AuthCredentialEntity>(x => x.UserId).OnDelete(DeleteBehavior.Restrict);
        });
        modelBuilder.Entity<PrinterEntity>(b =>
        {
            b.HasKey(x => x.Id);
            b.Property(x => x.Name).HasMaxLength(160);
            b.Property(x => x.Manufacturer).HasMaxLength(120);
            b.Property(x => x.Model).HasMaxLength(120);
            DecimalProperties(b);
        });
        modelBuilder.Entity<EnergyProfileEntity>(b =>
        {
            b.HasKey(x => x.Id);
            b.HasOne(x => x.Printer).WithMany(x => x.EnergyProfiles).HasForeignKey(x => x.PrinterId).OnDelete(DeleteBehavior.Restrict);
            b.HasIndex(x => new { x.PrinterId, x.EffectiveFrom });
            DecimalProperties(b);
        });
        modelBuilder.Entity<ElectricityTariffEntity>(b =>
        {
            b.HasKey(x => x.Id);
            b.HasIndex(x => new { x.Provider, x.EffectiveFrom });
            DecimalProperties(b);
        });
        modelBuilder.Entity<FilamentSpoolEntity>(b =>
        {
            b.HasKey(x => x.Id);
            b.Property(x => x.BatchCode).HasMaxLength(120);
            b.HasIndex(x => x.BatchCode);
            b.ToTable(t => t.HasCheckConstraint("CK_Filament_NetWeight", "NetWeightGrams > 0"));
            DecimalProperties(b);
        });
        modelBuilder.Entity<InventoryMovementEntity>(b =>
        {
            b.HasKey(x => x.Id);
            b.HasOne(x => x.Spool).WithMany(x => x.Movements).HasForeignKey(x => x.SpoolId).OnDelete(DeleteBehavior.Restrict);
            b.HasIndex(x => new { x.SpoolId, x.CreatedAt });
            DecimalProperties(b);
        });
        modelBuilder.Entity<PricingPolicyEntity>(b => { b.HasKey(x => x.Id); DecimalProperties(b); });
        modelBuilder.Entity<CustomerEntity>(b => { b.HasKey(x => x.Id); b.Property(x => x.Name).HasMaxLength(160); });
        modelBuilder.Entity<ProductTemplateEntity>(b => { b.HasKey(x => x.Id); b.Property(x => x.Name).HasMaxLength(160); });
        modelBuilder.Entity<ApplicationSettingEntity>(b =>
        {
            b.HasKey(x => x.Id);
            b.Property(x => x.VisibleAppName).HasMaxLength(120);
            b.Property(x => x.BrandDisplayName).HasMaxLength(120);
            b.Property(x => x.BrandContactLine).HasMaxLength(180);
            b.Property(x => x.ClientQuoteNote).HasMaxLength(280);
            DecimalProperties(b);
        });
        modelBuilder.Entity<QuoteEntity>(b =>
        {
            b.HasKey(x => x.Id);
            b.Property(x => x.Code).HasMaxLength(40);
            b.HasIndex(x => x.Code).IsUnique();
            b.HasIndex(x => new { x.Status, x.CreatedAt });
            b.HasOne(x => x.Customer).WithMany().HasForeignKey(x => x.CustomerId).OnDelete(DeleteBehavior.Restrict);
            b.HasOne(x => x.Creator).WithMany().HasForeignKey(x => x.CreatedBy).OnDelete(DeleteBehavior.Restrict);
        });
        modelBuilder.Entity<QuoteRevisionEntity>(b =>
        {
            b.HasKey(x => x.Id);
            b.HasIndex(x => new { x.QuoteId, x.RevisionNumber }).IsUnique();
            b.HasOne(x => x.Quote).WithMany(x => x.Revisions).HasForeignKey(x => x.QuoteId).OnDelete(DeleteBehavior.Cascade);
            DecimalProperties(b);
        });
        modelBuilder.Entity<QuoteLineEntity>(b => { b.HasKey(x => x.Id); b.HasOne(x => x.Revision).WithMany(x => x.Lines).HasForeignKey(x => x.QuoteRevisionId); });
        modelBuilder.Entity<QuoteMaterialLineEntity>(b => { b.HasKey(x => x.Id); b.HasOne(x => x.QuoteLine).WithMany(x => x.Materials).HasForeignKey(x => x.QuoteLineId); DecimalProperties(b); });
        modelBuilder.Entity<QuoteLaborLineEntity>(b => { b.HasKey(x => x.Id); b.HasOne(x => x.QuoteLine).WithMany(x => x.Labor).HasForeignKey(x => x.QuoteLineId); DecimalProperties(b); });
        modelBuilder.Entity<QuoteAdditionalCostLineEntity>(b => { b.HasKey(x => x.Id); b.HasOne(x => x.QuoteLine).WithMany(x => x.AdditionalCosts).HasForeignKey(x => x.QuoteLineId); DecimalProperties(b); });
        modelBuilder.Entity<QuoteCostSnapshotEntity>(b =>
        {
            b.HasKey(x => x.Id);
            b.HasIndex(x => x.QuoteRevisionId).IsUnique();
            b.HasOne(x => x.Revision).WithOne(x => x.CostSnapshot).HasForeignKey<QuoteCostSnapshotEntity>(x => x.QuoteRevisionId);
        });
        modelBuilder.Entity<PrintJobEntity>(b =>
        {
            b.HasKey(x => x.Id);
            b.Property(x => x.Code).HasMaxLength(40);
            b.HasIndex(x => x.Code).IsUnique();
            b.HasIndex(x => new { x.PrinterId, x.CreatedAt });
            b.HasOne(x => x.Quote).WithMany().HasForeignKey(x => x.QuoteId).OnDelete(DeleteBehavior.Restrict);
            b.HasOne(x => x.Printer).WithMany().HasForeignKey(x => x.PrinterId).OnDelete(DeleteBehavior.Restrict);
            DecimalProperties(b);
        });
        modelBuilder.Entity<PrintJobMaterialUsageEntity>(b => { b.HasKey(x => x.Id); b.HasOne(x => x.PrintJob).WithMany(x => x.MaterialUsages).HasForeignKey(x => x.PrintJobId); DecimalProperties(b); });
        modelBuilder.Entity<PrintJobLaborEntryEntity>(b => { b.HasKey(x => x.Id); b.HasOne(x => x.PrintJob).WithMany(x => x.LaborEntries).HasForeignKey(x => x.PrintJobId); DecimalProperties(b); });
        modelBuilder.Entity<PrintJobAdditionalCostEntity>(b => { b.HasKey(x => x.Id); b.HasOne(x => x.PrintJob).WithMany(x => x.AdditionalCosts).HasForeignKey(x => x.PrintJobId); DecimalProperties(b); });
        modelBuilder.Entity<PrintJobCostSnapshotEntity>(b =>
        {
            b.HasKey(x => x.Id);
            b.HasIndex(x => x.PrintJobId).IsUnique();
            b.HasOne(x => x.PrintJob).WithOne(x => x.CostSnapshot).HasForeignKey<PrintJobCostSnapshotEntity>(x => x.PrintJobId);
        });
        modelBuilder.Entity<AuditLogEntity>(b => { b.HasKey(x => x.Id); b.HasIndex(x => x.CreatedAt); });
    }

    private static void DecimalProperties<T>(Microsoft.EntityFrameworkCore.Metadata.Builders.EntityTypeBuilder<T> builder) where T : class
    {
        foreach (var property in builder.Metadata.GetProperties().Where(x => x.ClrType == typeof(decimal) || x.ClrType == typeof(decimal?)))
            property.SetColumnType("TEXT");
    }
}
