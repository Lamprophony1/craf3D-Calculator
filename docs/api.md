# API

La API es same-origin en producción, usa JSON, enums como texto, cookies con `credentials: include`, `ProblemDetails`, `CancellationToken` y límites de 1 a 100 (auditoría hasta 500).

## Rutas

- Salud: `GET /health`.
- Auth: `GET login-options`, `POST login`, `GET me`, `POST logout`, `POST change-pin` bajo `/api/auth`.
- Configuración: `GET/PUT /api/settings`; `GET/POST/PUT /api/pricing-policies`.
- Impresoras: CRUD lógico en `/api/printers`; perfiles en `/api/printers/{id}/energy-profiles` y `/api/energy-profiles/{id}`.
- Tarifas: `GET/POST/PUT /api/electricity-tariffs`.
- Filamentos: `GET/POST/PUT /api/filaments`, movimientos y ajustes.
- Clientes y plantillas: `GET/POST/PUT`.
- Cálculo: `POST /api/calculations/quote-preview` y `POST /api/calculations/quick-quote-preview`.
- Cotizaciones: lista, detalle, create/update, calculate, ready, send, accept, reject, cancel, duplicate, revisión y conversión.
- Trabajos: lista, detalle, create/update, start, complete, fail y cancel.
- Reportes: summary, profitability, estimate-vs-actual, material-consumption, printer-utilization y energy-calibration.
- Auditoría: `GET /api/audit` (Owner).

El preview resuelve los IDs de catálogo en el servidor. Guardar vuelve a resolver y recalcular; el frontend no puede persistir un resultado arbitrario.

La cotización rápida recibe únicamente `spoolId`, `printDurationMinutes` y
`totalGrams`. El servidor resuelve los defaults persistidos, selecciona un perfil
energético activo compatible con el material y adapta esa entrada al mismo
`QuoteCalculationService` utilizado por el preview completo. La respuesta incluye
`breakdown`, `resolvedAssumptions`, `canUsePrice` y advertencias estructuradas.

Las cotizaciones se crean como `Draft`. Sus líneas independientes se pueden editar
con `PUT /api/quotes/{id}` antes del cálculo y envío. Los trabajos admiten
`pause`, `resume`, `fail` y `cancel` mediante transiciones estrictas.
