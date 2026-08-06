# Motor de cálculo

Todas las fórmulas viven en `PrintCost.Domain.Pricing.PricingCalculator`, usan `decimal`, no redondean pasos intermedios y redondean el precio solo al final.

## Material

```text
purchaseCostGs = purchaseAmount                         (PYG)
purchaseCostGs = purchaseAmount × exchangeRateGs        (otra moneda)
landedCostGs = purchaseCostGs + shipping + importFees + otherCosts
costPerGramGs = landedCostGs / originalNetWeightGrams
```

Si existe `slicerTotalGrams`, tiene prioridad. Si no, el modo detallado suma modelo, soportes, purga, torre, adhesión y otras mermas. El modo simple usa `baseGrams × (1 + wastePercent/100)`. El porcentaje solo se suma al desglose si se marca como merma adicional.

Ejemplo: `131250 / 1000 = 131.25 Gs/g`; `131.25 × 142 = 18637.50 Gs`.

## Electricidad

```text
printingKWh = printHours × averagePrintPowerW / 1000
idleKWh = idleHours × idlePowerW / 1000
estimatedKWh = printingKWh + idleKWh + warmupKWh + accessoryKWh
totalKWh = measuredKWh ?? estimatedKWh
effectiveRate = explicitRate ?? baseRate × (1 + additionalChargesPercent/100)
electricityCost = totalKWh × effectiveRate
```

Ejemplo: `0.095 kW × 5.4 h = 0.513 kWh`; `0.513 × 435.51 = 223.41663 Gs`. Los 1300 W máximos nunca sustituyen automáticamente los 95 W promedio. Un valor medido, incluso cero, tiene prioridad.

Calibración: `empiricalAveragePowerW = measuredKWh / occupiedHours × 1000`. El reporte entrega promedio, mediana y cantidad; crear un perfil sigue siendo una acción manual.

## Máquina

Useful life:

```text
capital/hour = max(purchaseCost - residualValue, 0) / usefulLifeHours
repair/hour = expectedLifetimeRepairCost / usefulLifeHours
rate = capital/hour + repair/hour + maintenance/hour
```

Target recovery:

```text
plannedHours = years × businessDays/year × billableHours/day
rate = max(purchaseCost - residualValue, 0) / plannedHours
     + repairReserve/hour + maintenance/hour
```

Manual: `rate = manualHourlyRate`. El modo manual reemplaza los otros. `machineCost = occupiedHours × rate`. Una tarifa ausente genera advertencia y bloquea `ReadyToSend`, salvo aceptación explícita y auditada de cero con motivo.

## Trabajo y otros costos

`laborCost = minutes / 60 × hourlyRate × scopeMultiplier`.

Multiplicadores: `FixedPerOrder=1`, `FixedPerQuoteLine=1`, `PerPlate=numberOfPlates`, `PerUnit=quantity`. Consumibles usan la misma regla y declaran si se repiten al fallar.

## Falla

```text
expectedAttempts = 1 / (1 - failureProbability)
eligible = material + electricity + machine + repeatableLabor + repeatableConsumables
failureReserve = eligible × (expectedAttempts - 1)
```

Ejemplo: `30000 × (1/(1-0.10)-1) = 3333.333333… Gs`. `failureProbability` admite 0 a 0,95. El modo compatible simple es `selectedBase × percent/100`.

## Overhead

```text
productionBeforeOverhead = directCost + failureReserve
percentageOverhead = productionBeforeOverhead × overheadPercent/100
hourlyRate = monthlyOverhead / expectedMonthlyProductiveHours
hourlyOverhead = hourlyRate × occupiedPrinterHours
fullyLoadedCost = productionBeforeOverhead + fixedOverhead + percentageOverhead + hourlyOverhead
```

## Precio, margen y markup

```text
requiredPrice = (fullyLoadedCost + fixedSellingFee)
              / (1 - targetMargin - variableSellingFeeRate)
afterSurcharges = requiredPrice + fixedSurcharges + requiredPrice × surchargePercent
afterDiscount = afterSurcharges - discount
beforeRounding = max(afterDiscount, minimumOrder)
finalNetPrice = round-up(beforeRounding, increment)
variableFee = finalNetPrice × variableFeeRate
netRevenue = finalNetPrice - variableFee - fixedFee
profit = netRevenue - fullyLoadedCost
margin = profit / finalNetPrice
markup = profit / fullyLoadedCost
```

Se valida `margin + variableFeeRate < 1`. Ejemplo: `50000/(1-0.40)=83333.333…`; redondeo superior a 5000 produce `85000 Gs`. Un precio manual exige motivo y advierte si cae bajo costo o margen mínimo.

## Impuesto y cantidad

Si el impuesto se agrega por fuera: `customerTotal = finalNetPrice × (1 + taxRate)`. Si está incluido, se separa la porción fiscal sin aumentar el total. El impuesto no es ganancia.

`numberOfPlates = ceil(quantity / unitsPerPlate)`. Entradas `PerPlate` multiplican material/tiempo por placas; `PerUnit`, por cantidad. El total exacto se calcula primero; costo/precio unitarios se derivan al final.

