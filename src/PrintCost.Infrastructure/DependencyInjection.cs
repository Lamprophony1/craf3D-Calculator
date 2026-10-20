using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using PrintCost.Application.Abstractions;
using PrintCost.Application.Catalogs;
using PrintCost.Infrastructure.Persistence;

namespace PrintCost.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddPrintCostInfrastructure(this IServiceCollection services, IConfiguration configuration)
    {
        var connectionString = configuration.GetConnectionString("PrintCost") ?? "Data Source=printcost.db";
        services.AddDbContext<PrintCostDbContext>(options => options.UseSqlite(connectionString));
        services.AddScoped<IPrintCostRepository, PrintCostRepository>();
        services.AddScoped<IOrderStore, OrderStore>();
        services.AddScoped<ISimplePricingSettingsRepository>(provider =>
            (PrintCostRepository)provider.GetRequiredService<IPrintCostRepository>());
        return services;
    }
}
