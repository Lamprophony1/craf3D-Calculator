# PrintCost

PWA full-stack para calcular, guardar y analizar costos, precios, cotizaciones y trabajos de impresión 3D. `PrintCost` es el namespace técnico temporal; el nombre visible se centraliza en `web/src/config/app.ts` y permanece deliberadamente neutral hasta definir la marca final.

## Estado

El MVP incluye:

- motor decimal puro para material, energía, máquina, mano de obra, consumibles, fallas, overhead, margen, comisiones, impuestos, cantidad y placas;
- snapshots inmutables por revisión de cotización;
- cotizaciones versionadas y conversión a trabajos;
- presupuestos rápidos pendientes de aceptación y pedidos confirmados con alta directa, prioridad manual e historial;
- costos reales, variaciones estimado/real y ledger de inventario;
- catálogos editables con historial/estado activo;
- login de Rafa y Clari mediante PIN y cookie HttpOnly;
- API Minimal, SQLite, OpenAPI en desarrollo y Problem Details;
- SPA React mobile-first, borrador local offline, impresión, compartir y CSV;
- PWA manual instalable;
- contenedor único no-root, GHCR, CI/CD y despliegue aislado mediante Cloudflare Tunnel;
- backup online consistente y restore documentado.

La configuración inicial incluye una base recomendada editable para empezar a cotizar: Bambu Lab A1 a 2.000 Gs/h, preparación de 20 minutos, trabajo a 20.000 Gs/h, embalaje de 2.000 Gs y política sin comisiones ni impuestos. Si falta un costo obligatorio, la API devuelve `CanUsePrice=false` y advertencias estructuradas.

## Arquitectura

```text
src/
  PrintCost.Api/
  PrintCost.Application/
  PrintCost.Domain/
  PrintCost.Infrastructure/
tests/
  PrintCost.Api.Tests/
  PrintCost.Application.Tests/
  PrintCost.Domain.Tests/
  PrintCost.Infrastructure.Tests/
web/
  src/
  public/
docs/
deploy/
.github/workflows/
```

Se reutiliza el patrón técnico de GymQuest/GymChall: cuatro capas, Minimal APIs, EF Core/SQLite, PIN + cookie, frontend same-origin, PWA manual, imagen Docker única, runner self-hosted y Cloudflare Tunnel. No se copió lógica fitness ni se modificó el repositorio de referencia. Ver [arquitectura](docs/architecture.md).

## Desarrollo local

Requiere .NET SDK 10 y Node 24.

```powershell
dotnet restore PrintCost.slnx
dotnet build PrintCost.slnx
dotnet test PrintCost.slnx

cd web
npm ci
npm test
npm run build
```

API:

```powershell
$env:Auth__Mode='DevSelector'
dotnet run --project src/PrintCost.Api --urls http://127.0.0.1:5080
```

Frontend:

```powershell
cd web
npm run dev
```

- Web: `http://127.0.0.1:5173`
- API: `http://127.0.0.1:5080`
- Salud: `GET http://127.0.0.1:5080/health`
- OpenAPI en desarrollo: `GET /openapi/v1.json`

La pantalla inicial (`/`) es la cotización rápida de tres datos. El panel quedó en
`/dashboard`, la calculadora avanzada en `/calculator` y la cotización completa en
`/quotes/new`.

Para dejar API y frontend activos después de una corrida en esta PC:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\tools\local-preview.ps1
```

El script usa el SDK .NET instalado y Node de `.tools/node-v24.19.0-win-x64`, publica la API local y conserva una base de pruebas independiente en `.artifacts/local-preview/data/printcost.db`. Abre [Pedidos](http://127.0.0.1:5173/jobs), reutiliza Vite si sigue activo y registra los procesos propios en `.artifacts/local-preview/processes.json`; los logs quedan en esa carpeta. El acceso local usa `DevSelector`. La regla de comprobar y dejar los servicios actualizados funcionando está en [AGENTS.md](AGENTS.md).

La gestión comercial se abre en `/jobs`: **Nuevo pedido** permite cargar un importe total sin presupuesto; `/orders/:id` permite completar datos y actualizar su estado. La ficha técnica anterior sigue en `/jobs/:id`. Comportamiento y validación del incremento en [gestión de pedidos](docs/changes/2026-10-20-orders-management.md).

El flujo de UI/UX usa **Impeccable independiente** para diseño y revisión, con **shadcn/ui** como apoyo técnico cuando hace falta incorporar componentes. Se adaptó el método de SorteoApp conservando la identidad de craf3D Calculator y los componentes React/CSS actuales. Guía: [UI/UX](docs/ui-ux.md); herramientas y restauración: [tools/ui](tools/ui/README.md). Son herramientas de desarrollo, separadas del producto.

El proxy de Vite mantiene API y web separados solo durante desarrollo. Producción usa un único origen.

## PIN inicial

Nunca se guardan PINs reales en Git. Para el primer arranque:

```powershell
$env:Auth__BootstrapRafaPin='1234'
$env:Auth__BootstrapClariPin='5678'
```

El bootstrap se aplica solo cuando todavía no existe una credencial y jamás reemplaza un PIN existente.

## Docker

```powershell
docker build -t printcost:local .
```

La imagen sirve frontend, API y `/health` en el puerto interno `8080`, persiste SQLite y Data Protection, y corre como UID/GID `10001`.

## Datos iniciales

- Bambu Lab A1, 220 V, potencia máxima de referencia 1300 W.
- Perfil PLA predeterminado: 95 W promedio y 5 W idle.
- ANDE Residencial Normal 142, última franja: 435,51 Gs/kWh sin IVA.
- Política editable: margen 40%, mínimo 30%, falla 10%, pedido mínimo 30.000 Gs y redondeo superior a 5.000 Gs.
- Zona horaria visible: `America/Asuncion`; timestamps persistidos en UTC.

Los datos técnicos y comerciales se conservan en snapshots. Ver [fuentes](docs/research-sources.md) y [supuestos](docs/pricing-assumptions.md).

## Operación

- [API](docs/api.md)
- [PWA](docs/pwa.md)
- [Seguridad](docs/security.md)
- [Despliegue](docs/deployment.md)
- [Backups y restore](docs/backups-and-restore.md)
- [Pruebas](docs/testing.md)

Pendientes antes de producción: `APP_HOSTNAME`, `PRINTCOST_HOST_PORT`, PINs reales, hostname y validación operativa de los valores recomendados y decisiones tributarias.
