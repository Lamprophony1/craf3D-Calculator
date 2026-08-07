using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using PrintCost.Api.Auth;
using PrintCost.Application.Catalogs;
using PrintCost.Domain.Pricing;
using PrintCost.Infrastructure.Persistence;
using PrintCost.Infrastructure.Persistence.Entities;

namespace PrintCost.Api.Endpoints;

public static class CatalogEndpoints
{
    public static IEndpointRouteBuilder MapCatalogEndpoints(this IEndpointRouteBuilder app, AuthSettings settings)
    {
        var api = app.MapGroup("/api").RequireAuthIfPin(settings);

        api.MapGet("/pricing/simple-settings", async (SimplePricingSettingsService service, CancellationToken ct) =>
        {
            try { return Results.Ok(await service.GetAsync(ct)); }
            catch (InvalidOperationException exception) { return Validation(exception.Message); }
        });
        api.MapPut("/pricing/simple-settings", async (
            UpdateSimplePricingSettingsRequest request,
            SimplePricingSettingsService service,
            CancellationToken ct) =>
        {
            try { return Results.Ok(await service.UpdateAsync(request, ct)); }
            catch (DomainValidationException exception) { return Validation(exception.Message); }
            catch (InvalidOperationException exception) { return Validation(exception.Message); }
        }).RequireOwnerIfPin(settings);
        api.MapPost("/pricing/simple-settings/restore-recommended", async (
            SimplePricingSettingsService service,
            CancellationToken ct) =>
        {
            try { return Results.Ok(await service.RestoreRecommendedAsync(ct)); }
            catch (InvalidOperationException exception) { return Validation(exception.Message); }
        }).RequireOwnerIfPin(settings);

        api.MapGet("/settings", async (PrintCostDbContext db, CancellationToken ct) =>
        {
            var value = await db.ApplicationSettings.AsNoTracking().SingleAsync(ct);
            var today = DateOnly.FromDateTime(DateTime.UtcNow);
            var defaultPrinter = value.DefaultPrinterId is null ? null
                : await db.Printers.AsNoTracking().SingleOrDefaultAsync(x => x.Id == value.DefaultPrinterId, ct);
            var defaultTariff = value.DefaultElectricityTariffId is null ? null
                : await db.ElectricityTariffs.AsNoTracking().SingleOrDefaultAsync(x => x.Id == value.DefaultElectricityTariffId, ct);
            var defaultPolicy = value.DefaultPricingPolicyId is null ? null
                : await db.PricingPolicies.AsNoTracking().SingleOrDefaultAsync(x => x.Id == value.DefaultPricingPolicyId, ct);
            var activeFilaments = await db.FilamentSpools.AsNoTracking()
                .Where(x => x.IsActive && x.NetWeightGrams > 0m && x.LandedCostGs > 0m)
                .ToArrayAsync(ct);
            var compatibleProfiles = defaultPrinter is null ? Array.Empty<EnergyProfileEntity>()
                : await db.EnergyProfiles.AsNoTracking()
                    .Where(x => x.PrinterId == defaultPrinter.Id && x.IsActive)
                    .ToArrayAsync(ct);
            var defaultPrinterConfigured = defaultPrinter is { IsActive: true } && HasPositiveMachineRate(defaultPrinter);
            var defaultTariffConfigured = defaultTariff is { IsActive: true }
                && IsEffective(defaultTariff.EffectiveFrom, defaultTariff.EffectiveTo, today)
                && (defaultTariff.ExplicitEffectiveRateGsPerKWh
                    ?? defaultTariff.BaseRateGsPerKWh * (1m + defaultTariff.AdditionalChargesPercent / 100m)) > 0m;
            var defaultPolicyConfigured = defaultPolicy is { IsActive: true }
                && IsEffective(defaultPolicy.EffectiveFrom, defaultPolicy.EffectiveTo, today)
                && defaultPolicy.TargetMarginPercent + defaultPolicy.VariableSellingFeePercent < 100m
                && defaultPolicy.MinimumMarginPercent + defaultPolicy.VariableSellingFeePercent < 100m
                && (defaultPolicy.MonthlyOverheadGs == 0m || defaultPolicy.ExpectedMonthlyProductiveHours > 0m);
            var defaultLaborRateConfigured = defaultPolicy?.DefaultLaborRateGsPerHour is > 0m;
            var setupConfigured = value.DefaultQuickSetupMinutes is >= 0m;
            var packagingConfigured = value.DefaultQuickPackagingCostGs is >= 0m;
            var activePricedFilamentAvailable = activeFilaments.Length > 0;
            var effectiveProfiles = compatibleProfiles
                .Where(profile => IsEffective(profile.EffectiveFrom, profile.EffectiveTo, today)
                    && profile.AveragePrintPowerW > 0m)
                .ToArray();
            var compatibleEnergyProfileAvailable = activeFilaments.Any(spool => effectiveProfiles.Any(profile =>
                    MaterialFamilyNormalizer.Matches(spool.Material, profile.MaterialFamily)))
                || (activeFilaments.Length > 0 && effectiveProfiles.Length > 0);
            var quickQuoteReady = defaultPrinterConfigured
                && defaultTariffConfigured
                && defaultPolicyConfigured
                && setupConfigured
                && packagingConfigured
                && (value.DefaultQuickSetupMinutes == 0m || defaultLaborRateConfigured)
                && activePricedFilamentAvailable
                && compatibleEnergyProfileAvailable;
            var readiness = new
            {
                defaultPrinterConfigured,
                defaultPrinterMachineCostConfigured = defaultPrinterConfigured,
                defaultTariffConfigured,
                defaultPolicyConfigured,
                defaultLaborRateConfigured,
                defaultQuickSetupConfigured = setupConfigured,
                defaultQuickPackagingConfigured = packagingConfigured,
                activePricedFilamentAvailable,
                compatibleEnergyProfileAvailable,
                quickQuoteReady,
                // Legacy aliases are retained for clients deployed before this schema.
                machineCostConfigured = defaultPrinterConfigured,
                laborRateConfigured = defaultLaborRateConfigured,
                pricingPolicyConfigured = defaultPolicyConfigured,
                electricityTariffReviewed = defaultTariffConfigured,
                activeFilamentAvailable = activePricedFilamentAvailable,
                quickQuoteDefaultsConfigured = quickQuoteReady,
                pinsConfigured = await db.AuthCredentials.CountAsync(ct) == 2,
                productionHostnameConfigured = !string.IsNullOrWhiteSpace(value.ProductionHostname)
            };
            return Results.Ok(new { settings = value, readiness });
        });

        api.MapPut("/settings", async (SettingsRequest request, PrintCostDbContext db, CancellationToken ct) =>
        {
            if (request.TaxRatePercent is < 0m or > 100m) return Validation("La tasa de impuesto debe estar entre 0 y 100%.");
            if (request.TaxEnabled && (string.IsNullOrWhiteSpace(request.TaxName) || request.TaxRatePercent <= 0m))
                return Validation("Un impuesto habilitado requiere nombre y una tasa positiva.");
            if (request.DefaultQuickSetupMinutes is < 0m || request.DefaultQuickPackagingCostGs is < 0m)
                return Validation("Los defaults de cotización rápida no pueden ser negativos.");
            if (request.DefaultPrinterId is not null && !await db.Printers.AnyAsync(x => x.Id == request.DefaultPrinterId && x.IsActive, ct))
                return Validation("La impresora predeterminada debe existir y estar activa.");
            if (request.DefaultElectricityTariffId is not null && !await db.ElectricityTariffs.AnyAsync(x => x.Id == request.DefaultElectricityTariffId && x.IsActive, ct))
                return Validation("La tarifa predeterminada debe existir y estar activa.");
            if (request.DefaultPricingPolicyId is not null && !await db.PricingPolicies.AnyAsync(x => x.Id == request.DefaultPricingPolicyId && x.IsActive, ct))
                return Validation("La política predeterminada debe existir y estar activa.");
            var value = await db.ApplicationSettings.SingleAsync(ct);
            value.VisibleAppName = string.IsNullOrWhiteSpace(request.VisibleAppName) ? "Calculadora 3D" : request.VisibleAppName.Trim();
            value.ProductionHostname = string.IsNullOrWhiteSpace(request.ProductionHostname) ? null : request.ProductionHostname.Trim();
            value.TaxEnabled = request.TaxEnabled;
            value.TaxName = request.TaxName;
            value.TaxRatePercent = request.TaxRatePercent;
            value.PriceIncludesTax = request.PriceIncludesTax;
            value.DefaultPrinterId = request.DefaultPrinterId;
            value.DefaultElectricityTariffId = request.DefaultElectricityTariffId;
            value.DefaultPricingPolicyId = request.DefaultPricingPolicyId;
            value.DefaultQuickSetupMinutes = request.DefaultQuickSetupMinutes;
            value.DefaultQuickPackagingCostGs = request.DefaultQuickPackagingCostGs;
            if (request.DefaultPricingPolicyId is not null)
            {
                await db.PricingPolicies.ExecuteUpdateAsync(
                    setters => setters.SetProperty(x => x.IsDefault, x => x.Id == request.DefaultPricingPolicyId),
                    ct);
            }
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
            if (request.IsDefault) await UpdateDefaultPolicySetting(db, entity.Id, ct);
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
            if (request.IsDefault) await UpdateDefaultPolicySetting(db, entity.Id, ct);
            else
            {
                var appSettings = await db.ApplicationSettings.SingleAsync(ct);
                if (appSettings.DefaultPricingPolicyId == entity.Id)
                {
                    appSettings.DefaultPricingPolicyId = null;
                    appSettings.UpdatedAt = DateTimeOffset.UtcNow;
                    await db.SaveChangesAsync(ct);
                }
            }
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
            var error = ValidateEnergyProfile(request);
            if (error is not null) return error;
            if (!await db.Printers.AnyAsync(x => x.Id == printerId, ct)) return Results.NotFound();
            var entity = Map(request, Guid.NewGuid(), printerId);
            db.EnergyProfiles.Add(entity);
            await db.SaveChangesAsync(ct);
            return Results.Created($"/api/energy-profiles/{entity.Id}", entity);
        }).RequireOwnerIfPin(settings);
        api.MapPut("/energy-profiles/{id:guid}", async (Guid id, EnergyProfileRequest request, PrintCostDbContext db, CancellationToken ct) =>
        {
            var error = ValidateEnergyProfile(request);
            if (error is not null) return error;
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
            var error = ValidateTariff(request);
            if (error is not null) return error;
            var entity = Map(request, Guid.NewGuid());
            db.ElectricityTariffs.Add(entity);
            await db.SaveChangesAsync(ct);
            return Results.Created($"/api/electricity-tariffs/{entity.Id}", entity);
        }).RequireOwnerIfPin(settings);
        api.MapPut("/electricity-tariffs/{id:guid}", async (Guid id, ElectricityTariffRequest request, PrintCostDbContext db, CancellationToken ct) =>
        {
            var error = ValidateTariff(request);
            if (error is not null) return error;
            var entity = await db.ElectricityTariffs.SingleOrDefaultAsync(x => x.Id == id, ct);
            if (entity is null) return Results.NotFound();
            Apply(entity, request);
            await db.SaveChangesAsync(ct);
            return Results.Ok(entity);
        }).RequireOwnerIfPin(settings);

        api.MapGet("/filaments", async (PrintCostDbContext db, CancellationToken ct) =>
            Results.Ok(await db.FilamentSpools.AsNoTracking().OrderBy(x => x.Material).ThenBy(x => x.Color).ToArrayAsync(ct)));
        api.MapPost("/filaments/simple", async (SimpleFilamentRequest request, PrintCostDbContext db, CancellationToken ct) =>
        {
            var error = ValidateSimpleFilament(request);
            if (error is not null) return error;
            var displayName = request.DisplayName.Trim();
            var entity = new FilamentSpoolEntity
            {
                Id = Guid.NewGuid(),
                Manufacturer = "Sin fabricante",
                ProductName = displayName,
                Material = request.Material.Trim(),
                Color = displayName,
                PurchaseCurrency = "PYG",
                PurchaseAmount = request.LandedCostGs,
                ExchangeRateGs = null,
                AllocatedShippingGs = 0m,
                AllocatedImportFeesGs = 0m,
                AllocatedOtherCostsGs = 0m,
                LandedCostGs = request.LandedCostGs,
                NetWeightGrams = request.NetWeightGrams,
                RemainingWeightGrams = request.NetWeightGrams,
                IsInventoryTracked = false,
                IsActive = true
            };
            db.FilamentSpools.Add(entity);
            await db.SaveChangesAsync(ct);
            return Results.Created($"/api/filaments/{entity.Id}", entity);
        });
        api.MapPut("/filaments/{id:guid}/simple", async (Guid id, SimpleFilamentRequest request, PrintCostDbContext db, CancellationToken ct) =>
        {
            var error = ValidateSimpleFilament(request);
            if (error is not null) return error;
            var entity = await db.FilamentSpools.SingleOrDefaultAsync(x => x.Id == id, ct);
            if (entity is null) return Results.NotFound();
            if (entity.IsInventoryTracked && request.NetWeightGrams < entity.RemainingWeightGrams)
                return Validation("El peso neto no puede ser menor que el inventario restante del rollo.");
            var displayName = request.DisplayName.Trim();
            entity.Material = request.Material.Trim();
            entity.ProductName = displayName;
            entity.Color = displayName;
            entity.PurchaseCurrency = "PYG";
            entity.PurchaseAmount = request.LandedCostGs;
            entity.ExchangeRateGs = null;
            entity.AllocatedShippingGs = 0m;
            entity.AllocatedImportFeesGs = 0m;
            entity.AllocatedOtherCostsGs = 0m;
            entity.LandedCostGs = request.LandedCostGs;
            entity.NetWeightGrams = request.NetWeightGrams;
            await db.SaveChangesAsync(ct);
            return Results.Ok(entity);
        });
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
            if (spool.IsInventoryTracked && spool.RemainingWeightGrams + request.Grams < 0m)
                return Validation("El ajuste dejaría el inventario del filamento en negativo.");
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
        api.MapGet("/customers/{id:guid}", async (Guid id, PrintCostDbContext db, CancellationToken ct) =>
        {
            var customer = await db.Customers.AsNoTracking()
                .Where(x => x.Id == id)
                .Select(x => new { x.Id, x.Name, x.Phone, x.Email, x.IsActive })
                .SingleOrDefaultAsync(ct);
            return customer is null ? Results.NotFound() : Results.Ok(customer);
        });
        api.MapPost("/customers", async (CustomerRequest request, PrintCostDbContext db, CancellationToken ct) =>
        {
            if (string.IsNullOrWhiteSpace(request.Name)) return Validation("El nombre es obligatorio.");
            var entity = new CustomerEntity { Id = Guid.NewGuid(), Name = request.Name.Trim(), Phone = request.Phone, Email = request.Email, Notes = request.Notes, IsActive = request.IsActive };
            db.Customers.Add(entity); await db.SaveChangesAsync(ct); return Results.Created($"/api/customers/{entity.Id}", entity);
        });
        api.MapPut("/customers/{id:guid}", async (Guid id, CustomerRequest request, PrintCostDbContext db, CancellationToken ct) =>
        {
            if (string.IsNullOrWhiteSpace(request.Name)) return Validation("El nombre es obligatorio.");
            var entity = await db.Customers.SingleOrDefaultAsync(x => x.Id == id, ct); if (entity is null) return Results.NotFound();
            entity.Name = request.Name.Trim(); entity.Phone = request.Phone; entity.Email = request.Email; entity.Notes = request.Notes; entity.IsActive = request.IsActive;
            await db.SaveChangesAsync(ct); return Results.Ok(entity);
        });

        api.MapGet("/product-templates", async (PrintCostDbContext db, CancellationToken ct) => Results.Ok(await db.ProductTemplates.AsNoTracking().OrderBy(x => x.Name).ToArrayAsync(ct)));
        api.MapPost("/product-templates", async (ProductTemplateRequest request, PrintCostDbContext db, CancellationToken ct) =>
        {
            if (string.IsNullOrWhiteSpace(request.Name)) return Validation("El nombre es obligatorio.");
            var entity = Map(request, Guid.NewGuid()); db.ProductTemplates.Add(entity); await db.SaveChangesAsync(ct); return Results.Created($"/api/product-templates/{entity.Id}", entity);
        });
        api.MapPut("/product-templates/{id:guid}", async (Guid id, ProductTemplateRequest request, PrintCostDbContext db, CancellationToken ct) =>
        {
            if (string.IsNullOrWhiteSpace(request.Name)) return Validation("El nombre es obligatorio.");
            var entity = await db.ProductTemplates.SingleOrDefaultAsync(x => x.Id == id, ct); if (entity is null) return Results.NotFound();
            Apply(entity, request); await db.SaveChangesAsync(ct); return Results.Ok(entity);
        });

        return app;
    }

    private static IResult Validation(string detail) => Results.ValidationProblem(new Dictionary<string, string[]> { ["request"] = [detail] });
    private static IResult? ValidatePolicy(PricingPolicyRequest x)
    {
        if (string.IsNullOrWhiteSpace(x.Name)) return Validation("El nombre es obligatorio.");
        if (!IsPercent(x.TargetMarginPercent) || !IsPercent(x.MinimumMarginPercent) || !IsPercent(x.SimpleFailureReservePercent)
            || !IsPercent(x.OverheadPercent) || !IsPercent(x.VariableSellingFeePercent)
            || x.FailureProbability is < 0m or > 0.95m)
            return Validation("Márgenes, porcentajes o probabilidad de falla inválidos.");
        if (x.TargetMarginPercent < x.MinimumMarginPercent || x.TargetMarginPercent + x.VariableSellingFeePercent >= 100m
            || x.MinimumMarginPercent + x.VariableSellingFeePercent >= 100m)
            return Validation("Los márgenes y comisiones no dejan un denominador de precio válido.");
        if (x.MinimumOrderGs < 0m || x.RoundingIncrementGs < 0m || x.FixedOverheadPerOrderGs < 0m
            || x.MonthlyOverheadGs < 0m || x.ExpectedMonthlyProductiveHours < 0m || x.DefaultLaborRateGsPerHour is <= 0m
            || x.FixedSellingFeeGs < 0m)
            return Validation("Los costos, horas y tarifas no pueden ser negativos.");
        if (x.MonthlyOverheadGs > 0m && x.ExpectedMonthlyProductiveHours <= 0m)
            return Validation("Las horas productivas deben ser mayores que cero cuando existe overhead mensual.");
        return ValidateEffectiveDates(x.EffectiveFrom, x.EffectiveTo);
    }

    private static IResult? ValidatePrinter(PrinterRequest x)
    {
        if (string.IsNullOrWhiteSpace(x.Name) || string.IsNullOrWhiteSpace(x.Manufacturer) || string.IsNullOrWhiteSpace(x.Model))
            return Validation("Nombre, fabricante y modelo son obligatorios.");
        if (x.Voltage <= 0m || x.PurchaseCostGs is < 0m || x.ResidualValueGs < 0m || x.UsefulLifeHours is <= 0m
            || x.ExpectedLifetimeRepairCostGs < 0m || x.MaintenanceReserveGsPerHour < 0m || x.RecoveryYears is <= 0m
            || x.BusinessDaysPerYear is <= 0m || x.PlannedBillableHoursPerDay is <= 0m || x.RepairReserveGsPerHour < 0m
            || x.ManualHourlyRateGs is < 0m)
            return Validation("Los valores de impresora no pueden ser negativos y los denominadores configurados deben ser mayores que cero.");
        return null;
    }

    private static IResult? ValidateEnergyProfile(EnergyProfileRequest x)
    {
        if (string.IsNullOrWhiteSpace(x.Name) || string.IsNullOrWhiteSpace(x.MaterialFamily))
            return Validation("Nombre y familia de material son obligatorios.");
        if (x.AveragePrintPowerW < 0m || x.IdlePowerW < 0m || x.MaxPowerW < 0m || x.WarmupKWh < 0m || x.AccessoryKWh < 0m)
            return Validation("Potencias y energía no pueden ser negativas.");
        return ValidateEffectiveDates(x.EffectiveFrom, x.EffectiveTo);
    }

    private static IResult? ValidateTariff(ElectricityTariffRequest x)
    {
        if (string.IsNullOrWhiteSpace(x.Provider) || string.IsNullOrWhiteSpace(x.Name) || string.IsNullOrWhiteSpace(x.Category))
            return Validation("Proveedor, nombre y categoría son obligatorios.");
        if (x.BaseRateGsPerKWh < 0m || x.ExplicitEffectiveRateGsPerKWh is < 0m || !IsPercent(x.AdditionalChargesPercent))
            return Validation("La tarifa y sus porcentajes deben ser válidos y no negativos.");
        return ValidateEffectiveDates(x.EffectiveFrom, x.EffectiveTo);
    }
    private static IResult? ValidateFilament(FilamentRequest x)
    {
        if (string.IsNullOrWhiteSpace(x.Manufacturer) || string.IsNullOrWhiteSpace(x.ProductName)
            || string.IsNullOrWhiteSpace(x.Material) || string.IsNullOrWhiteSpace(x.Color))
            return Validation("Fabricante, producto, material y color son obligatorios.");
        if (x.NetWeightGrams <= 0m || x.RemainingWeightGrams < 0m || x.PurchaseAmount < 0m
            || x.AllocatedShippingGs < 0m || x.AllocatedImportFeesGs < 0m || x.AllocatedOtherCostsGs < 0m)
            return Validation("Pesos o costos de compra inválidos.");
        if (!string.Equals(x.PurchaseCurrency, "PYG", StringComparison.OrdinalIgnoreCase) && x.ExchangeRateGs is not > 0m) return Validation("Se requiere tipo de cambio para moneda extranjera.");
        return null;
    }

    private static IResult? ValidateSimpleFilament(SimpleFilamentRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Material) || string.IsNullOrWhiteSpace(request.DisplayName))
            return Validation("Material y nombre son obligatorios.");
        if (request.LandedCostGs <= 0m || request.NetWeightGrams <= 0m)
            return Validation("El costo total y el peso neto deben ser mayores que cero.");
        return null;
    }

    private static IResult? ValidateEffectiveDates(DateOnly? from, DateOnly? to) =>
        from is not null && to is not null && from > to
            ? Validation("La vigencia final no puede ser anterior a la inicial.")
            : null;

    private static bool IsPercent(decimal value) => value is >= 0m and <= 100m;

    private static bool IsEffective(DateOnly? from, DateOnly? to, DateOnly today) =>
        (from is null || from <= today) && (to is null || to >= today);

    private static bool HasPositiveMachineRate(PrinterEntity printer) => printer.MachineCostMode switch
    {
        MachineCostMode.ManualHourlyRate => printer.ManualHourlyRateGs is > 0m,
        MachineCostMode.UsefulLifeDepreciation => printer.PurchaseCostGs is not null
            && printer.UsefulLifeHours is > 0m
            && (Math.Max(printer.PurchaseCostGs.Value - printer.ResidualValueGs, 0m)
                + printer.ExpectedLifetimeRepairCostGs) / printer.UsefulLifeHours.Value
                + printer.MaintenanceReserveGsPerHour > 0m,
        MachineCostMode.TargetRecoveryPeriod => printer.PurchaseCostGs is not null
            && printer.RecoveryYears is > 0m
            && printer.BusinessDaysPerYear is > 0m
            && printer.PlannedBillableHoursPerDay is > 0m
            && Math.Max(printer.PurchaseCostGs.Value - printer.ResidualValueGs, 0m)
                / (printer.RecoveryYears.Value * printer.BusinessDaysPerYear.Value * printer.PlannedBillableHoursPerDay.Value)
                + printer.RepairReserveGsPerHour + printer.MaintenanceReserveGsPerHour > 0m,
        _ => false
    };

    private static async Task UpdateDefaultPolicySetting(PrintCostDbContext db, Guid policyId, CancellationToken ct)
    {
        var appSettings = await db.ApplicationSettings.SingleAsync(ct);
        appSettings.DefaultPricingPolicyId = policyId;
        appSettings.UpdatedAt = DateTimeOffset.UtcNow;
        await db.SaveChangesAsync(ct);
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

public sealed record SettingsRequest(
    string VisibleAppName,
    string? ProductionHostname,
    bool TaxEnabled,
    string? TaxName,
    decimal TaxRatePercent,
    bool PriceIncludesTax,
    Guid? DefaultPrinterId,
    Guid? DefaultElectricityTariffId,
    Guid? DefaultPricingPolicyId,
    decimal? DefaultQuickSetupMinutes,
    decimal? DefaultQuickPackagingCostGs);
public sealed record PrinterRequest(string Name,string Manufacturer,string Model,decimal Voltage,MachineCostMode MachineCostMode,decimal? PurchaseCostGs,decimal ResidualValueGs,decimal? UsefulLifeHours,decimal ExpectedLifetimeRepairCostGs,decimal MaintenanceReserveGsPerHour,decimal? RecoveryYears,decimal? BusinessDaysPerYear,decimal? PlannedBillableHoursPerDay,decimal RepairReserveGsPerHour,decimal? ManualHourlyRateGs,bool IsActive=true);
public sealed record EnergyProfileRequest(string Name,string MaterialFamily,decimal AveragePrintPowerW,decimal IdlePowerW,decimal MaxPowerW,decimal WarmupKWh,decimal AccessoryKWh,string? SourceName,DateOnly? VerifiedAt,DateOnly? EffectiveFrom,DateOnly? EffectiveTo,bool IsActive=true);
public sealed record ElectricityTariffRequest(string Provider,string Name,string Category,decimal BaseRateGsPerKWh,bool ExcludesTax,decimal AdditionalChargesPercent,decimal? ExplicitEffectiveRateGsPerKWh,string? SourceName,DateOnly? VerifiedAt,DateOnly? EffectiveFrom,DateOnly? EffectiveTo,bool IsActive=true);
public sealed record FilamentRequest(string Manufacturer,string ProductName,string Material,string Color,string? BatchCode,string PurchaseCurrency,decimal PurchaseAmount,decimal? ExchangeRateGs,decimal AllocatedShippingGs,decimal AllocatedImportFeesGs,decimal AllocatedOtherCostsGs,decimal NetWeightGrams,decimal RemainingWeightGrams,DateOnly? PurchasedAt,string? Supplier,bool IsInventoryTracked=true,bool IsActive=true);
public sealed record InventoryAdjustmentRequest(decimal Grams,string Reason);
public sealed record CustomerRequest(string Name,string? Phone,string? Email,string? Notes,bool IsActive=true);
public sealed record ProductTemplateRequest(string Name,string? Description,Guid? DefaultPrinterId,Guid? DefaultEnergyProfileId,string? DefaultQuantityData,string? DefaultLaborLines,string? DefaultCostLines,bool IsActive=true);
public sealed record PricingPolicyRequest(string Name,decimal TargetMarginPercent,decimal MinimumMarginPercent,decimal MinimumOrderGs,decimal RoundingIncrementGs,bool RoundUp,FailureReserveMode FailureMode,decimal FailureProbability,decimal SimpleFailureReservePercent,decimal FixedOverheadPerOrderGs,decimal OverheadPercent,decimal MonthlyOverheadGs,decimal ExpectedMonthlyProductiveHours,decimal? DefaultLaborRateGsPerHour,decimal VariableSellingFeePercent,decimal FixedSellingFeeGs,bool IsDefault,DateOnly? EffectiveFrom,DateOnly? EffectiveTo,bool IsActive=true);
