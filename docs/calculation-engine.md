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
nonMarginRecovery = nonMarginInternalCost / (1 - variableSellingFeeRate)
marginComponent = (marginBearingCost + fixedSellingFee)
                / (1 - targetMargin - variableSellingFeeRate)
requiredPrice = marginComponent + nonMarginRecovery + customerAdditionalCharge
afterSurcharges = requiredPrice + fixedSurcharges + requiredPrice × surchargePercent
afterDiscount = afterSurcharges - discount
beforeRounding = max(afterDiscount, minimumOrder)
finalNetPrice = round-up(beforeRounding, increment)
revenueAvailable = finalNetPrice - (taxIncluded ? extractedTax : 0)
variableFee = revenueAvailable × variableFeeRate
netRevenue = revenueAvailable - variableFee - fixedFee
profit = netRevenue - fullyLoadedCost
margin = profit / (revenueAvailable - nonMarginRecovery)
markup = profit / fullyLoadedCost
```

Se valida `margin + variableFeeRate < 1`. Ejemplo: `50000/(1-0.40)=83333.333…`; redondeo superior a 5000 produce `85000 Gs`. Un precio manual exige motivo y advierte si cae bajo costo o margen mínimo.

Los costos adicionales se clasifican por `IsInternalCost` y
`ParticipatesInMargin`: un costo interno participante recibe margen; un costo
interno no participante se recupera uno a uno cuando no hay comisión y, cuando
existe una comisión variable, se divide por `1 - variableSellingFeeRate` para que
la comisión no erosione su recuperación; un cargo comercial al cliente
participa del ingreso; y un traslado no participante se agrega al total del cliente
sin inflar ingreso, ganancia ni margen.

## Impuesto y cantidad

Si el impuesto se agrega por fuera: `tax = finalNetPrice × taxRate` y
`customerTotal = finalNetPrice + tax`; en este modo el impuesto no se resta de
`revenueAvailable`. Si está incluido: `tax = finalNetPrice - finalNetPrice / (1 + taxRate)`,
se descuenta del ingreso disponible y no aumenta el total. El impuesto nunca es ganancia.

Cuando el precio incluye impuesto, la porción extraída se descuenta del ingreso
disponible antes de calcular ganancia y margen. Un precio queda marcado con
`canUsePrice=false` si falta cualquier costo obligatorio o default requerido.

`numberOfPlates = ceil(quantity / unitsPerPlate)`. Entradas `PerPlate` multiplican material/tiempo por placas; `PerUnit`, por cantidad. El total exacto se calcula primero; costo/precio unitarios se derivan al final.

## Cotizaciones multilínea

Cada línea produce material, energía, máquina, trabajo y costos adicionales sin
tarificarse de forma independiente. El agregado de la revisión suma esa producción
y aplica una sola vez reserva de falla, overhead fijo y porcentual, margen, fee
fijo, mínimo de pedido, recargos, descuento, redondeo e impuesto.

`FixedPerOrder` solo puede aparecer en la primera línea. Todas las líneas deben
compartir política, tarifa eléctrica, impuesto y condiciones globales. El precio y
el impuesto agregados se distribuyen proporcionalmente por peso económico; cada
asignación intermedia se redondea a guaraníes y la última línea recibe el residuo.
Por eso la suma de asignaciones coincide exactamente con costo, precio, impuesto y
total del agregado.

## Familias de material

La compatibilidad de perfiles energéticos usa una sola regla pura en Domain:
`PLA* -> PLA`, `PETG* -> PETG`, `ABS* -> ABS`, `ASA* -> ASA` y
`TPU*`/`TPE* -> TPU`; otras familias se comparan luego de `Trim` y mayúsculas.
La misma normalización se aplica en preview rápido, avanzado y persistencia.

## Resultado real de un trabajo

Al completar un trabajo se registran `actualCustomerTotalGs` y `actualTaxGs` por
separado. El cálculo usa:

```text
actualNetSale = actualCustomerTotal - actualTax
variableFee = actualNetSale × variableSellingFeeRate
netRevenue = actualNetSale - variableFee - fixedSellingFee
profit = netRevenue - actualFullyLoadedCost
margin = profit / actualNetSale
```

El impuesto debe estar entre cero y el total cobrado. Si todas las líneas del
snapshot tienen impuestos deshabilitados, el impuesto real debe ser cero.
