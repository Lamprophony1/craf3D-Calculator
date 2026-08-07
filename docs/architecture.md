# Arquitectura

## Comparación con GymQuest/GymChall

| Aspecto | GymQuest/GymChall observado | PrintCost reutilizado |
|---|---|---|
| Solución | Domain / Application / Infrastructure / API | Misma separación con namespace `PrintCost` |
| HTTP | ASP.NET Core Minimal APIs | Minimal APIs REST, Problem Details, paginación y OpenAPI dev |
| Persistencia | EF Core + SQLite + seed | EF Core 10 + SQLite, entidades/índices/constraints y snapshots |
| Autenticación | PIN PBKDF2, cookie HttpOnly, DevSelector/PinLogin | Patrón adaptado a Rafa/Clari, rate limit, políticas Owner |
| Frontend | React + TS + Vite, cliente same-origin | Mismo patrón, pantallas de costos y reportes |
| PWA | Manifest, SW y registro manual | Shell estático; API/auth siempre network-only |
| Producción | Docker único, GHCR, runner propio, tunnel | Igual estrategia con recursos exclusivamente `printcost` |

No se reutilizó lógica fitness, datos productivos, dominio, puerto, base, llaves, contenedor, directorio, tunnel ni concurrency group de GymQuest.

## Dependencias

```text
API ───────► Application ───────► Domain
 │                 ▲
 └──────► Infrastructure ───────┘
```

- `Domain`: fórmulas puras, records de entrada/salida y validaciones; no depende de EF ni HTTP.
- `Application`: resuelve costos vigentes a snapshots, ejecuta cotizaciones, estados, trabajos, autenticación y auditoría.
- `Infrastructure`: EF Core, entidades, SQLite, seed y repositorio.
- `Api`: composición, cookies, autorización, rate limiting, endpoints, OpenAPI y SPA same-origin.
- `web`: solo solicita previews/acciones y muestra resultados. Nunca es la fuente de verdad de un precio.

## Decisiones

- `decimal` en todo cálculo y persistencia económica; SQLite usa representación `TEXT` para no degradar a binario flotante.
- Las revisiones almacenan request, input ya resuelto y resultado como JSON inmutable, además de líneas normalizadas para trazabilidad. Las revisiones nuevas persisten `AggregateJson` con el snapshot global y `QuoteAggregateBreakdown`, fuente de verdad para resúmenes, documento de cliente y trabajos.
- `AggregateJson` es nullable por compatibilidad: una revisión histórica sin agregado se lee y muestra en modo legado sin recalcularla silenciosamente. Una nueva revisión genera el agregado actual.
- Los catálogos usan `IsActive`; las relaciones históricas usan `DeleteBehavior.Restrict`.
- `EnsureCreated` sigue el patrón actual de GymQuest para el MVP. Antes de una evolución de esquema productivo se debe introducir una estrategia explícita de migraciones.
- Los timestamps son UTC; la presentación usa `America/Asuncion`.
- La marca visual es provisional y neutral. La constante está en `web/src/config/app.ts`; manifest e `index.html` deben actualizarse junto con ella cuando se defina el nombre final.
