using PrintCost.Domain.Pricing;

namespace PrintCost.Domain.Tests.Pricing;

public sealed class PricingCalculatorTests
{
    [Fact]
    public void Material_case_uses_original_net_weight_and_exact_decimal_cost()
    {
        var result = PricingCalculator.CalculateMaterial(new MaterialCostInput(
            Guid.NewGuid(), "PYG", 131_250m, null, 0m, 0m, 0m, 1_000m, SlicerTotalGrams: 142m));

        Assert.Equal(131.25m, result.CostPerGramGs);
        Assert.Equal(18_637.50m, result.CostGs);
    }

    [Fact]
    public void Detailed_material_and_additional_waste_are_supported()
    {
        var result = PricingCalculator.CalculateMaterial(new MaterialCostInput(
            null, "PYG", 100_000m, null, 0m, 0m, 0m, 1_000m,
            ModelGrams: 80m, SupportGrams: 10m, PurgeGrams: 5m, PrimeTowerGrams: 3m,
            AdhesionGrams: 1m, OtherWasteGrams: 1m, WastePercent: 10m, WastePercentIsAdditional: true));

        Assert.Equal(110m, result.TotalChargeableGrams);
        Assert.Equal(11_000m, result.CostGs);
    }

    [Fact]
    public void Simplified_waste_percent_is_not_applied_twice()
    {
        var result = PricingCalculator.CalculateMaterial(new MaterialCostInput(
            null, "PYG", 100_000m, null, 0m, 0m, 0m, 1_000m,
            BaseGrams: 100m, WastePercent: 10m, WastePercentIsAdditional: true));

        Assert.Equal(110m, result.TotalChargeableGrams);
    }

    [Fact]
    public void Energy_case_uses_average_power_not_max_power()
    {
        var result = PricingCalculator.CalculateEnergy(new EnergyCostInput(
            5.4m, 95m, 0m, 5m, 1300m, 0m, 0m, null, 435.51m, 0m, null));

        Assert.Equal(0.513m, result.TotalKWh);
        Assert.Equal(223.41663m, result.CostGs);
        Assert.Equal(1300m, result.MaxPowerReferenceW);
    }

    [Fact]
    public void Measured_energy_has_priority_over_estimate_and_explicit_rate_has_priority()
    {
        var result = PricingCalculator.CalculateEnergy(new EnergyCostInput(
            10m, 1_300m, 1m, 5m, 1_300m, 0.2m, 0.1m, 0.75m, 435.51m, 10m, 500m));

        Assert.True(result.UsedMeasuredKWh);
        Assert.Equal(0.75m, result.TotalKWh);
        Assert.Equal(375m, result.CostGs);
    }

    [Theory]
    [InlineData(MachineCostMode.UsefulLifeDepreciation, 1200)]
    [InlineData(MachineCostMode.TargetRecoveryPeriod, 1100)]
    [InlineData(MachineCostMode.ManualHourlyRate, 2000)]
    public void Machine_modes_replace_each_other(MachineCostMode mode, decimal expectedRate)
    {
        var input = mode switch
        {
            MachineCostMode.UsefulLifeDepreciation => new MachineCostInput(mode, 2m, 1_000_000m, 0m, 1_000m, 100_000m, 100m),
            MachineCostMode.TargetRecoveryPeriod => new MachineCostInput(mode, 2m, 1_000_000m, RecoveryYears: 1m, BusinessDaysPerYear: 250m, PlannedBillableHoursPerDay: 4m, RepairReserveGsPerHour: 50m, MaintenanceReserveGsPerHour: 50m),
            _ => new MachineCostInput(mode, 2m, ManualHourlyRateGs: 2_000m)
        };

        var result = PricingCalculator.CalculateMachine(input);
        Assert.Equal(expectedRate, result.HourlyRateGs);
        Assert.Equal(expectedRate * 2m, result.CostGs);
    }

    [Fact]
    public void Failure_probability_uses_expected_attempts()
    {
        var result = PricingCalculator.Calculate(CreateInput(
            materialCost: 30_000m,
            failure: new FailureReserveInput(FailureReserveMode.ExpectedAttempts, 0.10m)));

        Assert.Equal(1m / 0.9m, result.ExpectedAttempts);
        Assert.Equal(30_000m * (1m / 0.9m - 1m), result.FailureReserveGs);
    }

    [Fact]
    public void Multiple_filaments_are_summed_and_scaled_by_plate()
    {
        var input = CreateInput(0m) with
        {
            Quantity = new QuantityPlan(5, 2, QuantityInputBasis.PerPlate),
            Materials =
            [
                new MaterialCostInput(Guid.NewGuid(), "PYG", 100_000m, null, 0m, 0m, 0m, 1_000m, SlicerTotalGrams: 10m),
                new MaterialCostInput(Guid.NewGuid(), "PYG", 200_000m, null, 0m, 0m, 0m, 1_000m, SlicerTotalGrams: 5m)
            ]
        };

        var result = PricingCalculator.Calculate(input);
        Assert.Equal(3, result.NumberOfPlates);
        Assert.Equal(6_000m, result.MaterialCostGs);
    }

    [Fact]
    public void Warmup_idle_accessory_and_additional_tariff_charges_are_explicit()
    {
        var result = PricingCalculator.CalculateEnergy(new EnergyCostInput(
            1m, 100m, 2m, 5m, 1_300m, 0.1m, 0.05m, null, 400m, 10m, null));

        Assert.Equal(0.26m, result.TotalKWh);
        Assert.Equal(440m, result.EffectiveRateGsPerKWh);
        Assert.Equal(114.4m, result.CostGs);
    }

    [Fact]
    public void Margin_case_rounds_total_up_to_increment()
    {
        var result = PricingCalculator.Calculate(CreateInput(
            materialCost: 50_000m,
            pricing: new PricingInput(40m, 30m, 0m, 5_000m, true)));

        Assert.Equal(50_000m / 0.6m, result.RequiredNetPriceGs);
        Assert.Equal(85_000m, result.FinalNetSalePriceGs);
    }

    [Fact]
    public void Fixed_and_variable_selling_fees_preserve_target_margin_formula()
    {
        var result = PricingCalculator.Calculate(CreateInput(50_000m, pricing: new PricingInput(
            40m, 30m, 0m, 0m, true, VariableSellingFeePercent: 5m, FixedSellingFeeGs: 2_000m)));

        Assert.Equal(52_000m / 0.55m, result.RequiredNetPriceGs);
        Assert.Equal(result.FinalNetSalePriceGs * 0.05m, result.VariableSellingFeeGs);
    }

    [Fact]
    public void Overhead_modes_are_combined_without_intermediate_rounding()
    {
        var input = CreateInput(30_000m) with
        {
            Machine = new MachineCostInput(MachineCostMode.ManualHourlyRate, 2m, ManualHourlyRateGs: 1_000m),
            Overhead = new OverheadInput(1_000m, 10m, 100_000m, 100m)
        };
        var result = PricingCalculator.Calculate(input);
        Assert.Equal(1_000m, result.HourlyOverheadRateGs);
        Assert.Equal((32_000m * 0.10m) + 1_000m + 2_000m, result.TotalOverheadGs);
    }

    [Fact]
    public void Tax_can_be_added_or_extracted_from_inclusive_price()
    {
        var added = PricingCalculator.Calculate(CreateInput(50_000m) with { Tax = new TaxInput(true, "Test", 10m, false) });
        var included = PricingCalculator.Calculate(CreateInput(50_000m) with { Tax = new TaxInput(true, "Test", 10m, true) });
        Assert.Equal(added.FinalNetSalePriceGs * 1.10m, added.CustomerTotalGs);
        Assert.Equal(included.FinalNetSalePriceGs, included.CustomerTotalGs);
        Assert.Equal(included.FinalNetSalePriceGs - included.FinalNetSalePriceGs / 1.10m, included.TaxGs);
    }

    [Fact]
    public void Included_tax_is_excluded_from_available_revenue_profit_and_margin()
    {
        var result = PricingCalculator.Calculate(CreateInput(
            50_000m,
            pricing: new PricingInput(
                0m, 0m, 0m, 0m, true,
                ManualNetPriceGs: 110_000m,
                ManualPriceReason: "Precio final con IVA")) with
        {
            Tax = new TaxInput(true, "IVA", 10m, true)
        });

        Assert.Equal(10_000m, result.TaxGs);
        Assert.Equal(100_000m, result.RevenueAvailableBeforeCostsGs);
        Assert.Equal(50_000m, result.EstimatedProfitGs);
        Assert.Equal(50m, result.AchievedMarginPercent);
    }

    [Fact]
    public void Internal_additional_cost_that_participates_in_margin_is_marked_up()
    {
        var result = PricingCalculator.Calculate(CreateInput(
            0m,
            pricing: new PricingInput(50m, 0m, 0m, 0m, true)) with
        {
            AdditionalCosts =
            [
                new AdditionalCostInput("Consumible", 10_000m, CostScope.FixedPerOrder,
                    IsInternalCost: true, ParticipatesInMargin: true)
            ]
        });

        Assert.Equal(10_000m, result.MarginBearingAdditionalCostGs);
        Assert.Equal(10_000m, result.FullyLoadedCostGs);
        Assert.Equal(20_000m, result.FinalNetSalePriceGs);
        Assert.Equal(10_000m, result.EstimatedProfitGs);
    }

    [Fact]
    public void Internal_additional_cost_that_does_not_participate_is_recovered_one_for_one()
    {
        var result = PricingCalculator.Calculate(CreateInput(
            10_000m,
            pricing: new PricingInput(50m, 0m, 0m, 0m, true)) with
        {
            AdditionalCosts =
            [
                new AdditionalCostInput("Costo sin margen", 10_000m, CostScope.FixedPerOrder,
                    IsInternalCost: true, ParticipatesInMargin: false)
            ]
        });

        Assert.Equal(10_000m, result.NonMarginInternalCostGs);
        Assert.Equal(10_000m, result.NonMarginRecoveryChargeGs);
        Assert.Equal(20_000m, result.FullyLoadedCostGs);
        Assert.Equal(30_000m, result.FinalNetSalePriceGs);
        Assert.Equal(10_000m, result.EstimatedProfitGs);
        Assert.Equal(50m, result.AchievedMarginPercent);
    }

    [Fact]
    public void Non_margin_internal_cost_is_recovered_net_of_variable_fee_without_creating_profit()
    {
        var result = PricingCalculator.Calculate(CreateInput(
            10_000m,
            pricing: new PricingInput(50m, 0m, 0m, 0m, true, VariableSellingFeePercent: 5m)) with
        {
            AdditionalCosts =
            [
                new AdditionalCostInput("Costo sin margen", 10_000m, CostScope.FixedPerOrder,
                    IsInternalCost: true, ParticipatesInMargin: false)
            ]
        });

        Assert.Equal(10_000m / 0.95m, result.NonMarginRecoveryChargeGs);
        Assert.Equal(10_000m / 0.45m + 10_000m / 0.95m, result.RequiredNetPriceGs);
        Assert.Equal(50m, result.AchievedMarginPercent);
    }

    [Theory]
    [InlineData("PLA+", "PLA")]
    [InlineData("PLA Matte", "PLA")]
    [InlineData("PETG HF", "PETG")]
    [InlineData("TPU95A", "TPU")]
    [InlineData("TPE 88A", "TPU")]
    [InlineData("  nylon  ", "NYLON")]
    public void Material_family_is_normalized_in_one_domain_rule(string material, string expected)
    {
        Assert.Equal(expected, MaterialFamilyNormalizer.Normalize(material));
        Assert.True(MaterialFamilyNormalizer.Matches(material, expected));
    }

    [Fact]
    public void Customer_charge_can_participate_in_margin_or_be_a_true_pass_through()
    {
        var marginCharge = PricingCalculator.Calculate(CreateInput(10_000m) with
        {
            AdditionalCosts =
            [
                new AdditionalCostInput("Diseño cobrado", 5_000m, CostScope.FixedPerOrder,
                    IsInternalCost: false, ParticipatesInMargin: true)
            ]
        });
        var passThrough = PricingCalculator.Calculate(CreateInput(10_000m) with
        {
            AdditionalCosts =
            [
                new AdditionalCostInput("Envío por cuenta del cliente", 5_000m, CostScope.FixedPerOrder,
                    IsInternalCost: false, ParticipatesInMargin: false)
            ]
        });

        Assert.Equal(5_000m, marginCharge.CustomerAdditionalChargeGs);
        Assert.Equal(15_000m, marginCharge.FinalNetSalePriceGs);
        Assert.Equal(5_000m, marginCharge.EstimatedProfitGs);

        Assert.Equal(5_000m, passThrough.CustomerPassThroughGs);
        Assert.Equal(10_000m, passThrough.FinalNetSalePriceGs);
        Assert.Equal(15_000m, passThrough.CustomerTotalGs);
        Assert.Equal(0m, passThrough.EstimatedProfitGs);
    }

    [Fact]
    public void Minimum_order_and_manual_price_warnings_are_applied_to_total()
    {
        var minimum = PricingCalculator.Calculate(CreateInput(1_000m, pricing: new PricingInput(0m, 0m, 30_000m, 5_000m, true)));
        Assert.Equal(30_000m, minimum.FinalNetSalePriceGs);
        var manual = PricingCalculator.Calculate(CreateInput(50_000m, pricing: new PricingInput(40m, 30m, 0m, 0m, true, ManualNetPriceGs: 40_000m, ManualPriceReason: "Decisión comercial")));
        Assert.Contains(manual.Warnings, x => x.Contains("debajo del costo", StringComparison.OrdinalIgnoreCase));
        Assert.Contains(manual.Warnings, x => x.Contains("margen mínimo", StringComparison.OrdinalIgnoreCase));
    }

    [Fact]
    public void Scopes_and_plate_quantity_are_applied_exactly_once()
    {
        var input = CreateInput(0m) with
        {
            Quantity = new QuantityPlan(5, 2, QuantityInputBasis.PerPlate),
            Labor = [
                new("order", 60m, 100m, CostScope.FixedPerOrder),
                new("line", 60m, 100m, CostScope.FixedPerQuoteLine),
                new("plate", 60m, 100m, CostScope.PerPlate),
                new("unit", 60m, 100m, CostScope.PerUnit)
            ]
        };

        var result = PricingCalculator.Calculate(input);
        Assert.Equal(3, result.NumberOfPlates);
        Assert.Equal(1_000m, result.LaborCostGs);
    }

    [Fact]
    public void Invalid_denominators_and_percentages_are_rejected()
    {
        Assert.Throws<DomainValidationException>(() => PricingCalculator.CalculateEmpiricalAveragePower(1m, 0m));
        Assert.Throws<DomainValidationException>(() => PricingCalculator.Calculate(CreateInput(1m) with
        {
            Pricing = new PricingInput(90m, 30m, 0m, 0m, true, VariableSellingFeePercent: 10m)
        }));
    }

    private static QuoteCalculationInput CreateInput(
        decimal materialCost,
        FailureReserveInput? failure = null,
        PricingInput? pricing = null)
    {
        var materials = materialCost == 0m
            ? Array.Empty<MaterialCostInput>()
            : [new MaterialCostInput(null, "PYG", materialCost, null, 0m, 0m, 0m, 1m, SlicerTotalGrams: 1m)];
        return new QuoteCalculationInput(
            new QuantityPlan(),
            materials,
            new EnergyCostInput(0m, 0m, 0m, 0m, 1_300m, 0m, 0m, null, 0m, 0m, null),
            new MachineCostInput(MachineCostMode.ManualHourlyRate, 0m, ManualHourlyRateGs: 0m, ExplicitlyAcceptedZeroRate: true, ZeroRateReason: "Prueba"),
            [], [],
            failure ?? new FailureReserveInput(FailureReserveMode.ExpectedAttempts),
            new OverheadInput(),
            pricing ?? new PricingInput(0m, 0m, 0m, 0m, true),
            new TaxInput());
    }
}
