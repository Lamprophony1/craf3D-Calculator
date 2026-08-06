using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using PrintCost.Api.Auth;
using PrintCost.Domain.Pricing;
using PrintCost.Infrastructure.Persistence;
using PrintCost.Infrastructure.Persistence.Entities;

namespace PrintCost.Api.Endpoints;

public static class CatalogEndpoints
{
    public static IEndpointRouteBuilder MapCatalogEndpoints(this IEndpointRouteBuilder app, AuthSettings settings)
    {
        var api = app.MapGroup("/api").RequireAuthIfPin(settings);

        api.MapGet("/settings", async (PrintCostDbContext db, CancellationToken ct) =>
        {
            var value = await db.ApplicationSettings.AsNoTracking().SingleAsync(ct);
            var readiness = new
            {
                machineCostConfigured = await db.Printers.AnyAsync(x => x.IsActive && (x.ManualHourlyRateGs != null || x.PurchaseCostGs != null), ct),
                laborRateConfigured = await db.PricingPolicies.AnyAsync(x => x.IsActive && x.DefaultLaborRateGsPerHour != null, ct),
                pricingPolicyConfigured = await db.PricingPolicies.AnyAsync(x => x.IsActive, ct),
                electricityTariffReviewed = await db.ElectricityTariffs.AnyAsync(x => x.IsActive, ct),
                activeFilamentAvailable = await db.FilamentSpools.AnyAsync(x => x.IsActive, ct),
                pinsConfigured = await db.AuthCredentials.CountAsync(ct) == 2,
                productionHostnameConfigured = !string.IsNullOrWhiteSpace(value.ProductionHostname)
            };
            return Results.Ok(new { settings = value, readiness });
        });

        api.MapPut("/settings", async (SettingsRequest request, PrintCostDbContext db, CancellationToken ct) =>
        {
            if (request.TaxRatePercent < 0m) return Validation("La tasa de impuesto no puede ser negativa.");
            var value = await db.ApplicationSettings.SingleAsync(ct);
            value.VisibleAppName = string.IsNullOrWhiteSpace(request.VisibleAppName) ? "Calculadora 3D" : request.VisibleAppName.Trim();
            value.ProductionHostname = string.IsNullOrWhiteSpace(request.ProductionHostname) ? null : request.ProductionHostname.Trim();
            value.TaxEnabled = request.TaxEnabled;
            value.TaxName = request.TaxName;
            value.TaxRatePercent = request.TaxRatePercent;
            value.PriceIncludesTax = request.PriceIncludesTax;
            value.UpdatedAt = DateTimeOffset.UtcNow;
            await db.SaveChangesAsync(ct);
            return Results.Ok(value);
        }).RequireOwnerIfPin(settings);

        api.MapGet("/pricing-policies", async (PrintCostDbContext db, CancellationToken ct) =>
            Results.Ok(await db.PricingPolicies.AsNoTracking().OrderByDescending(x => x.IsDefault).ThenBy(x => x.Name).ToArrayAsync(ct)));
        api.MapPost("/pricing-policies", async (PricingPolicyRequest request, PrintCostDbContext db, CancellationToken ct) =>
        {
            var error = ValidatePolicy(request);
            if (error is not null) return error;
            if (request.IsDefault) await db.PricingPolicies.ExecuteUpdateAsync(s => s.SetProperty(x => x.IsDefault, false), ct);
            var entity = Map(request, Guid.NewGuid());
            db.PricingPolicies.Add(entity);
            await db.SaveChangesAsync(ct);
            return Results.Created($"/api/pricing-policies/{entity.Id}", entity);
        }).RequireOwnerIfPin(settings);
        api.MapPut("/pricing-policies/{id:guid}", async (Guid id, PricingPolicyRequest request, PrintCostDbContext db, CancellationToken ct) =>
        {
            var error = ValidatePolicy(request);
            if (error is not null) return error;
            var entity = await db.PricingPolicies.SingleOrDefaultAsync(x => x.Id == id, ct);
            if (entity is null) return Results.NotFound();
            if (request.IsDefault) await db.PricingPolicies.Where(x => x.Id != id).ExecuteUpdateAsync(s => s.SetProperty(x => x.IsDefault, false), ct);
            Apply(entity, request);
            await db.SaveChangesAsync(ct);
            return Results.Ok(entity);
        }).RequireOwnerIfPin(settings);

        api.MapGet("/printers", async (PrintCostDbContext db, CancellationToken ct) =>
            Results.Ok(await db.Printers.AsNoTracking().OrderBy(x => x.Name).ToArrayAsync(ct)));
        api.MapGet("/printers/{id:guid}", async (Guid id, PrintCostDbContext db, CancellationToken ct) =>
        {
            var value = await db.Printers.AsNoTracking().SingleOrDefaultAsync(x => x.Id == id, ct);
            return value is null ? Results.NotFound() : Results.Ok(value);
        });
        api.MapPost("/printers", async (PrinterRequest request, PrintCostDbContext db, CancellationToken ct) =>
        {
            var error = ValidatePrinter(request);
            if (error is not null) return error;
            var entity = Map(request, Guid.NewGuid());
            db.Printers.Add(entity);
            await db.SaveChangesAsync(ct);
            return Results.Created($"/api/printers/{entity.Id}", entity);
        }).RequireOwnerIfPin(settings);
        api.MapPut("/printers/{id:guid}", async (Guid id, PrinterRequest request, PrintCostDbContext db, CancellationToken ct) =>
        {
            var error = ValidatePrinter(request);
            if (error is not null) return error;
            var entity = await db.Printers.SingleOrDefaultAsync(x => x.Id == id, ct);
            if (entity is null) return Results.NotFound();
            Apply(entity, request);
            await db.SaveChangesAsync(ct);
            return Results.Ok(entity);
        }).RequireOwnerIfPin(settings);
        api.MapDelete("/printers/{id:guid}", async (Guid id, PrintCostDbContext db, CancellationToken ct) =>
        {
            var entity = await db.Printers.SingleOrDefaultAsync(x => x.Id == id, ct);
            if (entity is null) return Results.NotFound();
            entity.IsActive = false;
            await db.SaveChangesAsync(ct);
            return Results.NoContent();
        }).RequireOwnerIfPin(settings);

        api.MapGet("/printers/{printerId:guid}/energy-profiles", async (Guid printerId, PrintCostDbContext db, CancellationToken ct) =>
            Results.Ok(await db.EnergyProfiles.AsNoTracking().Where(x => x.PrinterId == printerId).OrderBy(x => x.Name).ToArrayAsync(ct)));
        api.MapPost("/printers/{printerId:guid}/energy-profiles", async (Guid printerId, EnergyProfileRequest request, PrintCostDbContext db, CancellationToken ct) =>
        {
            if (request.AveragePrintPowerW < 0m || request.IdlePowerW < 0m || request.MaxPowerW < 0m) return Validation("Las potencias no pueden ser negativas.");
            if (!await db.Printers.AnyAsync(x => x.Id == printerId, ct)) return Results.NotFound();
            var entity = Map(request, Guid.NewGuid(), printerId);
            db.EnergyProfiles.Add(entity);
            await db.SaveChangesAsync(ct);
            return Results.Created($"/api/energy-profiles/{entity.Id}", entity);
        }).RequireOwnerIfPin(settings);
        api.MapPut("/energy-profiles/{id:guid}", async (Guid id, EnergyProfileRequest request, PrintCostDbContext db, CancellationToken ct) =>
        {
            if (request.AveragePrintPowerW < 0m || request.IdlePowerW < 0m || request.MaxPowerW < 0m) return Validation("Las potencias no pueden ser negativas.");
            var entity = await db.EnergyProfiles.SingleOrDefaultAsync(x => x.Id == id, ct);
            if (entity is null) return Results.NotFound();
            Apply(entity, request);
            await db.SaveChangesAsync(ct);
            return Results.Ok(entity);
        }).RequireOwnerIfPin(settings);

        api.MapGet("/electricity-tariffs", async (PrintCostDbContext db, CancellationToken ct) =>
            Results.Ok(await db.ElectricityTariffs.AsNoTracking().OrderByDescending(x => x.EffectiveFrom).ToArrayAsync(ct)));
        api.MapPost("/electricity-tariffs", async (ElectricityTariffRequest request, PrintCostDbContext db, CancellationToken ct) =>
        {
            if (request.BaseRateGsPerKWh < 0m) return Validation("La tarifa no puede ser negativa.");
            var entity = Map(request, Guid.NewGuid());
            db.ElectricityTariffs.Add(entity);
            await db.SaveChangesAsync(ct);
            return Results.Created($"/api/electricity-tariffs/{entity.Id}", entity);
        }).RequireOwnerIfPin(settings);
        api.MapPut("/electricity-tariffs/{id:guid}", async (Guid id, ElectricityTariffRequest request, PrintCostDbContext db, CancellationToken ct) =>
        {
            if (request.BaseRateGsPerKWh < 0m) return Validation("La tarifa no puede ser negativa.");
            var entity = await db.ElectricityTariffs.SingleOrDefaultAsync(x => x.Id == id, ct);
            if (entity is null) return Results.NotFound();
            Apply(entity, request);
            await db.SaveChangesAsync(ct);
            return Results.Ok(entity);
        }).RequireOwnerIfPin(settings);

        api.MapGet("/filaments", async (PrintCostDbContext db, CancellationToken ct) =>
            Results.Ok(await db.FilamentSpools.AsNoTracking().OrderBy(x => x.Material).ThenBy(x => x.Color).ToArrayAsync(ct)));
        api.MapGet("/filaments/{id:guid}", async (Guid id, PrintCostDbContext db, CancellationToken ct) =>
        {
            var value = await db.FilamentSpools.AsNoTracking().SingleOrDefaultAsync(x => x.Id == id, ct);
            return value is null ? Results.NotFound() : Results.Ok(value);
        });
        api.MapPost("/filaments", async (FilamentRequest request, PrintCostDbContext db, CancellationToken ct) =>
        {
            var error = ValidateFilament(request);
            if (error is not null) return error;
            var entity = Map(request, Guid.NewGuid());
            db.FilamentSpools.Add(entity);
            await db.SaveChangesAsync(ct);
            return Results.Created($"/api/filaments/{entity.Id}", entity);
        });
        api.MapPut("/filaments/{id:guid}", async (Guid id, FilamentRequest request, PrintCostDbContext db, CancellationToken ct) =>
        {
            var error = ValidateFilament(request);
            if (error is not null) return error;
            var entity = await db.FilamentSpools.SingleOrDefaultAsync(x => x.Id == id, ct);
            if (entity is null) return Results.NotFound();
            Apply(entity, request);
            await db.SaveChangesAsync(ct);
            return Results.Ok(entity);
        });
        api.MapGet("/filaments/{id:guid}/movements", async (Guid id, PrintCostDbContext db, CancellationToken ct) =>
        {
            var rows = await db.InventoryMovements.AsNoTracking().Where(x => x.SpoolId == id).ToArrayAsync(ct);
            return Results.Ok(rows.OrderByDescending(x => x.CreatedAt).Take(200));
        });
        api.MapPost("/filaments/{id:guid}/adjustments", async (Guid id, InventoryAdjustmentRequest request, ClaimsPrincipal user, PrintCostDbContext db, CancellationToken ct) =>
        {
            if (request.Grams == 0m || string.IsNullOrWhiteSpace(request.Reason)) return Validation("El ajuste requiere gramos distintos de cero y un motivo.");
            var spool = await db.FilamentSpools.SingleOrDefaultAsync(x => x.Id == id, ct);
            if (spool is null) return Results.NotFound();
            if (spool.IsInventoryTracked) spool.RemainingWeightGrams += request.Grams;
            var movement = new InventoryMovementEntity
            {
                Id = Guid.NewGuid(), SpoolId = id, Type = "Adjustment", Grams = request.Grams,
                Reason = request.Reason.Trim(), CreatedBy = user.RequireActorId(settings), CreatedAt = DateTimeOffset.UtcNow
            };
            db.InventoryMovements.Add(movement);
            await db.SaveChangesAsync(ct);
            return Results.Created($"/api/filaments/{id}/movements", movement);
        });

        api.MapGet("/customers", async (PrintCostDbContext db, CancellationToken ct) => Results.Ok(await db.Customers.AsNoTracking().OrderBy(x => x.Name).ToArrayAsync(ct)));
        api.MapPost("/customers", async (CustomerRequest request, PrintCostDbContext db, CancellationToken ct) =>
        {
            if (string.IsNullOrWhiteSpace(request.Name)) return Validation("El nombre es obligatorio.");
            var entity = new CustomerEntity { Id = Guid.NewGuid(), Name = request.Name.Trim(), Phone = request.Phone, Email = request.Email, Notes = request.Notes, IsActive = request.IsActive };
            db.Customers.Add(entity); await db.SaveChangesAsync(ct); return Results.Created($"/api/customers/{entity.Id}", entity);
        });
        api.MapPut("/customers/{id:guid}", async (Guid id, CustomerRequest request, PrintCostDbContext db, CancellationToken ct) =>
        {
            var entity = await db.Customers.SingleOrDefaultAsync(x => x.Id == id, ct); if (entity is null) return Results.NotFound();
            entity.Name = request.Name.Trim(); entity.Phone = request.Phone; entity.Email = request.Email; entity.Notes = request.Notes; entity.IsActive = request.IsActive;
            await db.SaveChangesAsync(ct); return Results.Ok(entity);
        });

        api.MapGet("/product-templates", async (PrintCostDbContext db, CancellationToken ct) => Results.Ok(await db.ProductTemplates.AsNoTracking().OrderBy(x => x.Name).ToArrayAsync(ct)));
        api.MapPost("/product-templates", async (ProductTemplateRequest request, PrintCostDbContext db, CancellationToken ct) =>
        {
            var entity = Map(request, Guid.NewGuid()); db.ProductTemplates.Add(entity); await db.SaveChangesAsync(ct); return Results.Created($"/api/product-templates/{entity.Id}", entity);
        });
        api.MapPut("/product-templates/{id:guid}", async (Guid id, ProductTemplateRequest request, PrintCostDbContext db, CancellationToken ct) =>
        {
            var entity = await db.ProductTemplates.SingleOrDefaultAsync(x => x.Id == id, ct); if (entity is null) return Results.NotFound();
            Apply(entity, request); await db.SaveChangesAsync(ct); return Results.Ok(entity);
        });

        return app;
    }

    private static IResult Validation(string detail) => Results.ValidationProblem(new Dictionary<string, string[]> { ["request"] = [detail] });
    private static IResult? ValidatePolicy(PricingPolicyRequest x) =>
        x.TargetMarginPercent < 0m || x.TargetMarginPercent >= 100m || x.MinimumMarginPercent < 0m || x.FailureProbability is < 0m or > 0.95m
            ? Validation("Márgenes o probabilidad de falla inválidos.") : null;
    private static IResult? ValidatePrinter(PrinterRequest x) => x.Voltage <= 0m ? Validation("La tensión debe ser mayor que cero.") : null;
    private static IResult? ValidateFilament(FilamentRequest x)
    {
        if (x.NetWeightGrams <= 0m || x.RemainingWeightGrams < 0m || x.PurchaseAmount < 0m) return Validation("Pesos o costo de compra inválidos.");
        if (!string.Equals(x.PurchaseCurrency, "PYG", StringComparison.OrdinalIgnoreCase) && x.ExchangeRateGs is not > 0m) return Validation("Se requiere tipo de cambio para moneda extranjera.");
        return null;
    }

    private static PricingPolicyEntity Map(PricingPolicyRequest x, Guid id) { var e = new PricingPolicyEntity { Id = id }; Apply(e, x); return e; }
    private static void Apply(PricingPolicyEntity e, PricingPolicyRequest x)
    {
        e.Name=x.Name; e.TargetMarginPercent=x.TargetMarginPercent; e.MinimumMarginPercent=x.MinimumMarginPercent; e.MinimumOrderGs=x.MinimumOrderGs;
        e.RoundingIncrementGs=x.RoundingIncrementGs; e.RoundUp=x.RoundUp; e.FailureMode=x.FailureMode; e.FailureProbability=x.FailureProbability;
        e.SimpleFailureReservePercent=x.SimpleFailureReservePercent; e.FixedOverheadPerOrderGs=x.FixedOverheadPerOrderGs; e.OverheadPercent=x.OverheadPercent;
        e.MonthlyOverheadGs=x.MonthlyOverheadGs; e.ExpectedMonthlyProductiveHours=x.ExpectedMonthlyProductiveHours; e.DefaultLaborRateGsPerHour=x.DefaultLaborRateGsPerHour;
        e.VariableSellingFeePercent=x.VariableSellingFeePercent; e.FixedSellingFeeGs=x.FixedSellingFeeGs; e.IsDefault=x.IsDefault; e.EffectiveFrom=x.EffectiveFrom; e.EffectiveTo=x.EffectiveTo; e.IsActive=x.IsActive;
    }
    private static PrinterEntity Map(PrinterRequest x, Guid id) { var e = new PrinterEntity { Id=id }; Apply(e,x); return e; }
    private static void Apply(PrinterEntity e, PrinterRequest x)
    {
        e.Name=x.Name; e.Manufacturer=x.Manufacturer; e.Model=x.Model; e.Voltage=x.Voltage; e.MachineCostMode=x.MachineCostMode; e.PurchaseCostGs=x.PurchaseCostGs;
        e.ResidualValueGs=x.ResidualValueGs; e.UsefulLifeHours=x.UsefulLifeHours; e.ExpectedLifetimeRepairCostGs=x.ExpectedLifetimeRepairCostGs;
        e.MaintenanceReserveGsPerHour=x.MaintenanceReserveGsPerHour; e.RecoveryYears=x.RecoveryYears; e.BusinessDaysPerYear=x.BusinessDaysPerYear;
        e.PlannedBillableHoursPerDay=x.PlannedBillableHoursPerDay; e.RepairReserveGsPerHour=x.RepairReserveGsPerHour; e.ManualHourlyRateGs=x.ManualHourlyRateGs; e.IsActive=x.IsActive;
    }
    private static EnergyProfileEntity Map(EnergyProfileRequest x, Guid id, Guid printerId) { var e=new EnergyProfileEntity{Id=id,PrinterId=printerId}; Apply(e,x); return e; }
    private static void Apply(EnergyProfileEntity e, EnergyProfileRequest x)
    {
        e.Name=x.Name;e.MaterialFamily=x.MaterialFamily;e.AveragePrintPowerW=x.AveragePrintPowerW;e.IdlePowerW=x.IdlePowerW;e.MaxPowerW=x.MaxPowerW;e.WarmupKWh=x.WarmupKWh;
        e.AccessoryKWh=x.AccessoryKWh;e.SourceName=x.SourceName;e.VerifiedAt=x.VerifiedAt;e.EffectiveFrom=x.EffectiveFrom;e.EffectiveTo=x.EffectiveTo;e.IsActive=x.IsActive;
    }
    private static ElectricityTariffEntity Map(ElectricityTariffRequest x, Guid id) { var e=new ElectricityTariffEntity{Id=id}; Apply(e,x); return e; }
    private static void Apply(ElectricityTariffEntity e, ElectricityTariffRequest x)
    {
        e.Provider=x.Provider;e.Name=x.Name;e.Category=x.Category;e.BaseRateGsPerKWh=x.BaseRateGsPerKWh;e.ExcludesTax=x.ExcludesTax;e.AdditionalChargesPercent=x.AdditionalChargesPercent;
        e.ExplicitEffectiveRateGsPerKWh=x.ExplicitEffectiveRateGsPerKWh;e.SourceName=x.SourceName;e.VerifiedAt=x.VerifiedAt;e.EffectiveFrom=x.EffectiveFrom;e.EffectiveTo=x.EffectiveTo;e.IsActive=x.IsActive;
    }
    private static FilamentSpoolEntity Map(FilamentRequest x, Guid id) { var e=new FilamentSpoolEntity{Id=id}; Apply(e,x); return e; }
    private static void Apply(FilamentSpoolEntity e, FilamentRequest x)
    {
        e.Manufacturer=x.Manufacturer;e.ProductName=x.ProductName;e.Material=x.Material;e.Color=x.Color;e.BatchCode=x.BatchCode;e.PurchaseCurrency=x.PurchaseCurrency.ToUpperInvariant();
        e.PurchaseAmount=x.PurchaseAmount;e.ExchangeRateGs=x.ExchangeRateGs;e.AllocatedShippingGs=x.AllocatedShippingGs;e.AllocatedImportFeesGs=x.AllocatedImportFeesGs;
        e.AllocatedOtherCostsGs=x.AllocatedOtherCostsGs;e.LandedCostGs=(e.PurchaseCurrency=="PYG"?e.PurchaseAmount:e.PurchaseAmount*e.ExchangeRateGs!.Value)+e.AllocatedShippingGs+e.AllocatedImportFeesGs+e.AllocatedOtherCostsGs;
        e.NetWeightGrams=x.NetWeightGrams;e.RemainingWeightGrams=x.RemainingWeightGrams;e.PurchasedAt=x.PurchasedAt;e.Supplier=x.Supplier;e.IsInventoryTracked=x.IsInventoryTracked;e.IsActive=x.IsActive;
    }
    private static ProductTemplateEntity Map(ProductTemplateRequest x, Guid id) { var e=new ProductTemplateEntity{Id=id}; Apply(e,x); return e; }
    private static void Apply(ProductTemplateEntity e, ProductTemplateRequest x)
    { e.Name=x.Name;e.Description=x.Description;e.DefaultPrinterId=x.DefaultPrinterId;e.DefaultEnergyProfileId=x.DefaultEnergyProfileId;e.DefaultQuantityData=x.DefaultQuantityData;e.DefaultLaborLines=x.DefaultLaborLines;e.DefaultCostLines=x.DefaultCostLines;e.IsActive=x.IsActive; }
}

public sealed record SettingsRequest(string VisibleAppName, string? ProductionHostname, bool TaxEnabled, string? TaxName, decimal TaxRatePercent, bool PriceIncludesTax);
public sealed record PrinterRequest(string Name,string Manufacturer,string Model,decimal Voltage,MachineCostMode MachineCostMode,decimal? PurchaseCostGs,decimal ResidualValueGs,decimal? UsefulLifeHours,decimal ExpectedLifetimeRepairCostGs,decimal MaintenanceReserveGsPerHour,decimal? RecoveryYears,decimal? BusinessDaysPerYear,decimal? PlannedBillableHoursPerDay,decimal RepairReserveGsPerHour,decimal? ManualHourlyRateGs,bool IsActive=true);
public sealed record EnergyProfileRequest(string Name,string MaterialFamily,decimal AveragePrintPowerW,decimal IdlePowerW,decimal MaxPowerW,decimal WarmupKWh,decimal AccessoryKWh,string? SourceName,DateOnly? VerifiedAt,DateOnly? EffectiveFrom,DateOnly? EffectiveTo,bool IsActive=true);
public sealed record ElectricityTariffRequest(string Provider,string Name,string Category,decimal BaseRateGsPerKWh,bool ExcludesTax,decimal AdditionalChargesPercent,decimal? ExplicitEffectiveRateGsPerKWh,string? SourceName,DateOnly? VerifiedAt,DateOnly? EffectiveFrom,DateOnly? EffectiveTo,bool IsActive=true);
public sealed record FilamentRequest(string Manufacturer,string ProductName,string Material,string Color,string? BatchCode,string PurchaseCurrency,decimal PurchaseAmount,decimal? ExchangeRateGs,decimal AllocatedShippingGs,decimal AllocatedImportFeesGs,decimal AllocatedOtherCostsGs,decimal NetWeightGrams,decimal RemainingWeightGrams,DateOnly? PurchasedAt,string? Supplier,bool IsInventoryTracked=true,bool IsActive=true);
public sealed record InventoryAdjustmentRequest(decimal Grams,string Reason);
public sealed record CustomerRequest(string Name,string? Phone,string? Email,string? Notes,bool IsActive=true);
public sealed record ProductTemplateRequest(string Name,string? Description,Guid? DefaultPrinterId,Guid? DefaultEnergyProfileId,string? DefaultQuantityData,string? DefaultLaborLines,string? DefaultCostLines,bool IsActive=true);
public sealed record PricingPolicyRequest(string Name,decimal TargetMarginPercent,decimal MinimumMarginPercent,decimal MinimumOrderGs,decimal RoundingIncrementGs,bool RoundUp,FailureReserveMode FailureMode,decimal FailureProbability,decimal SimpleFailureReservePercent,decimal FixedOverheadPerOrderGs,decimal OverheadPercent,decimal MonthlyOverheadGs,decimal ExpectedMonthlyProductiveHours,decimal? DefaultLaborRateGsPerHour,decimal VariableSellingFeePercent,decimal FixedSellingFeeGs,bool IsDefault,DateOnly? EffectiveFrom,DateOnly? EffectiveTo,bool IsActive=true);
