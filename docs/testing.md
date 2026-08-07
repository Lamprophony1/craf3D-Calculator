# Pruebas

## Backend

```bash
dotnet restore PrintCost.slnx
dotnet build PrintCost.slnx
dotnet test PrintCost.slnx
```

- Domain: casos exactos de material, energía, máximo vs promedio, measured kWh, modos de máquina, scopes, fallas, margen, redondeo y validaciones.
- Application: preview resuelto por backend, contexto Standard/QuickQuote persistido, severidad idéntica después de guardar/recalcular, snapshot inmutable, nueva revisión, estados, job, actuals, inventario y PIN bootstrap.
- Infrastructure: SQLite real in-memory, decimal exacto, índice único, snapshot e inventory ledger.
- API: salud, 401, login/cookie, catálogo, preview, fachada simple PYG de filamentos, overrides/restauración completa de ajustes, cotización, job y consumo real.

## Frontend

```bash
cd web
npm ci
npm test
npm run build
```

Vitest valida formato PYG, restauración de borrador, login, validación inline sin requests inválidos, foco/ARIA de modales, acciones separadas de copiar/compartir y contrato del manifest/service worker v3.

También cubre la pantalla rápida de tres datos, sincronización inicial del tiempo
ocupado, edición/desactivación de catálogos, impresión legible y recarga offline sin
una sesión ficticia. Backend cubre el caso 142 g / 5 h 24 min, impuestos incluidos,
costos internos y trasladados, defaults faltantes, agregado multiline, rechazo de
`FixedPerOrder` repetido y política distinta, asignaciones exactas, actuals multicolor e
inventario negativo.

El parche de calidad agrega cobertura de los estados sin desglose/incompleto/válido,
advertencias estructuradas, menú móvil accesible, resumen compartible sin datos
internos y documento imprimible exclusivo para cliente. Domain/Application/API
cubren normalización de materiales, tarifa laboral nula/cero/positiva, recuperación
sin margen bajo comisión y actuals con total, impuesto y venta neta separados.
También verifica IVA externo sin detracción del ingreso, persistencia/lectura
legada del agregado, cliente inactivo por ID y readiness de defaults reales.

## Imagen

```bash
docker build .
docker run --rm -p 127.0.0.1:5080:8080 \
  -e Auth__BootstrapRafaPin=1234 -e Auth__BootstrapClariPin=5678 \
  -v printcost-test-data:/var/lib/printcost/data \
  -v printcost-test-keys:/var/lib/printcost/keys printcost:local
curl -fsS http://127.0.0.1:5080/health
```

No desactivar pruebas ni análisis de vulnerabilidades. Se fijaron explícitamente `SQLitePCLRaw.lib.e_sqlite3 2.1.12` y `Microsoft.OpenApi 2.7.5` para evitar versiones transitivas con advisories altos.
