# Gestión de pedidos — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** conservar cotizaciones rápidas como borradores y gestionar pedidos directos, confirmación, prioridad e historia sin exigir datos técnicos ni alta de clientes.

**Architecture:** registro comercial separado y vinculado opcionalmente con Quote/PrintJob. Application define contratos, servicio y reglas; Infrastructure conserva datos y transacciones SQLite; API añade rutas autenticadas. React conserva el sistema visual y usa el mismo servidor para lista y prioridad.

**Tech Stack:** .NET 10, EF Core SQLite, React/TypeScript/Vite, Vitest/Playwright existentes.

**Spec:** `docs/superpowers/specs/2026-10-20-orders-management-design.md`

## Global Constraints

- Usuario autorizó ejecución del plan el 2026-10-20: continuar sin otra confirmación. Ejecución nativa en rama local `feat/orders-workflow`, conservando cambios previos.
- Preservar identidad, motor decimal, caso rápido auditado, datos/accesos existentes. Sin despliegue ni escritura productiva.
- Precio manual es total; cliente libre; descripción opcional; costos desconocidos no equivalen a cero.
- Terminar con API y frontend locales levantados y comprobados.

## Review Focus

- Reintentos y respuestas tardías: misma sesión/versión no crea cotizaciones o pedidos duplicados.
- Metadatos sin cambio financiero: no recalcular con otras tarifas ni reabrir confirmado/descartado.
- Pedido manual con cantidad 3 y total 100000: conserva 100000, no crea Quote/PrintJob/consumo.
- Prioridad global con búsqueda/páginas y concurrencia: movimiento persistente o conflicto, sin perder el orden.
- Base anterior y catálogos históricos: actualización aditiva repetible y vínculos únicos.

### Task 1: Persistencia comercial y reglas

**Files:** Application/Orders/{OrderModels,OrderService}.cs; Application/Abstractions/IOrderStore.cs; Infrastructure/Persistence/{OrderStore,OrderSchema}.cs; Entities/OrderEntity.cs; DbContext, DI, Program; tests/PrintCost.Api.Tests/OrderApiTests.cs.

**Interfaces:** `OrderRecord`, `OrderInput`, `OrderStatus`; `IOrderStore.GetAsync/ListAsync/SaveAsync/TransactionAsync`; `OrderService.CreateAsync/UpdateAsync/TransitionAsync/MoveAsync`.

- [x] Escribir pruebas API de alta manual exacta, datos parciales, validación y transiciones; ejecutarlas y observar fallo 404.
- [x] Implementar tabla comercial con vínculos únicos, versión de concurrencia y actualización aditiva; registrar servicios y rutas `/api/orders`.
- [x] Verificar alta, historia sin stock, descarte/recuperación, edición y cola global en pruebas SQLite reales.

### Task 2: Borrador rápido y presupuestos compatibles

**Files:** Application/Orders/OrderService.cs; QuoteModels/QuoteCalculationService; QuoteWorkflowService; QuoteAndJobEntities, PrintCostRepository, QuoteEndpoints, OrderEndpoints, OrderSchema; OrderApiTests.

**Interfaces:** `QuickOrderRequest(sessionId, sequence, calculation, customerReference, description)`; respuesta `{preview, order}`; `POST /api/orders/quick`; metadatos de cliente libre en Quote.

- [x] Pruebas de repetición/secuencia atrasada, metadatos sin recalcular, misma cifra guardada y mostrada y conversión sin duplicado.
- [x] Persistir sesión y revisión del snapshot ya calculado, actualizar una misma fila y rechazar borradores cerrados. Incorporar los presupuestos/trabajos previos sin modificar sus importes.
- [x] Verificar autenticación, migración repetida y equivalencia de importes con el preview existente.

### Task 3: Experiencia de pedidos y cotizador

**Files:** web/src/{screens/OrdersScreen.tsx, screens/QuickQuoteScreen.tsx, components/AppShell.tsx, App.tsx, api/orders.ts, styles/orders.css}; presupuesto compartido y detalle; tests y e2e de pedidos.

**Interfaces:** lista `/jobs`, detalle comercial `/orders/:id`, nueva carga `/orders/new`; rutas antiguas de producción conservadas. CRUD, transiciones y movimientos consumen `/api/orders`.

- [x] Pruebas de alta directa, confirmación, búsqueda/prioridad y guardado rápido con referencia libre.
- [x] Implementar lista con vistas y búsqueda paginada, ficha simple, carga histórica, acciones y estados de carga/error/guardado. Sin registro de clientes.
- [x] Integrar sesión rápida por pestaña, secuencia, reintentos, reset y datos comerciales en presupuesto/imagen/texto. Restaurar sin crear borradores pasivamente.
- [x] Verificar tipos, pruebas afectadas y build.

### Task 4: Revisión y servicios locales

**Files:** tools/local-preview.ps1; docs/changes/2026-10-20-orders-management.md; PRODUCT/DESIGN/docs/api según comportamiento final.

- [x] Ejecutar suites backend/frontend y navegador con escenarios reales aislados; revisar móvil/escritorio y corregir hallazgos materiales.
- [x] Ejecutar detector Impeccable una vez; revisión independiente final exigida por executing-plans.
- [x] Levantar API y Vite ocultos en loopback con base local aislada/persistente; comprobar salud, interfaz y guardado. Dejar procesos funcionando e informar URLs.
- [x] Documentar resultados, límites y regla persistente; no publicar ni modificar producción.
