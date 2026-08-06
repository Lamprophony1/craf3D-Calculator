# Modelo de dominio

## Catálogos

- `AppUser` 1—0..1 `AuthCredential`.
- `Printer` 1—N `EnergyProfile`.
- `ElectricityTariff` conserva vigencia y fuente.
- `FilamentSpool` 1—N `InventoryMovement`.
- `PricingPolicy`, `Customer` y `ProductTemplate` son desactivables.
- `ApplicationSetting` centraliza nombre visible, zona horaria, hostname e impuesto de venta.

## Cotizaciones

```text
Quote
└─ QuoteRevision (inmutable, número único por quote)
   ├─ QuoteLine
   │  ├─ QuoteMaterialLine
   │  ├─ QuoteLaborLine
   │  └─ QuoteAdditionalCostLine
   └─ QuoteCostSnapshot
```

Estados: `Draft → Calculated → ReadyToSend → Sent → Accepted → ConvertedToJob`. Desde `Sent` también puede pasar a `Rejected` o `Expired`; estados no convertidos pueden cancelarse. Una nueva revisión vuelve a `Calculated` sin sobrescribir la anterior.

## Trabajos

```text
PrintJob
├─ PrintJobMaterialUsage
├─ PrintJobLaborEntry
├─ PrintJobAdditionalCost
└─ PrintJobCostSnapshot
```

Estados: `Planned`, `Printing`, `Paused`, `Completed`, `Failed`, `Cancelled`. Al completar se registra exactamente un movimiento de consumo por lote y trabajo; los reintentos idempotentes no duplican el ledger.

## Integridad

- índices únicos: usuario, código de cotización, número de revisión, código de trabajo;
- índices de estados/fechas, lote, impresora/trabajo, rollo/movimiento y auditoría;
- peso neto de rollo mayor que cero;
- relaciones históricas restringen eliminación física;
- snapshots no se actualizan al editar catálogos.

