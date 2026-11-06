# Precios vigentes y acceso móvil — plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** resolver F01–F08 autorizados conservando el motor y la identidad visual.

**Architecture:** endpoint de preview agregado aditivo sobre el cálculo compartido; frontend invalida resultados por versión y construye las mismas líneas para preview/guardado. Ajustes de foco/reflow y ubicación del grupo comercial en componentes/CSS existentes.

**Tech Stack:** .NET10, C#, decimal, React19, TypeScript6, Vite8, Vitest, Playwright local. Sin dependencias nuevas.

**Spec:** `docs/superpowers/specs/2026-11-06-price-mobile-fixes-design.md`.

## Restricciones globales

- Trabajar en la carpeta autorizada y conservar el informe no confirmado en Git. Rama actual `feat/orders-workflow`; sin nueva worktree por la instrucción de trabajar aquí.
- No modificar tarifas, PINs, snapshots históricos, namespaces, datos existentes o producción. No publicar ni hacer push.
- Crema/naranja/ámbar, Chakra Petch, logo, bordes rectos y composición existente.
- No fórmulas financieras en React. No migraciones ni cambios del motor decimal.
- Plan y ledger registran decisiones; no hacer commits automáticos de archivos ajenos a la entrega.

## Review Focus

1. Respuesta avanzada pendiente llega después de editar o desconectar: no restaura un precio anterior.
2. Rápido importa cantidad1/consumo estimado sobre un borrador con10 unidades,4kWh y líneas anteriores: no hereda valores.
3. Dos líneas con preparación/embalaje fijo y redondeo: preview y guardado coinciden sin duplicar fijos ni persistir preview.
4. Editar cliente después del resultado: conserva foco/entradas, borrador único y precio al finalizar guardado.
5. Teclado y contenido largo a320/390px: no quedan controles enfocados ocultos ni overflow de Auditoría.

## Tarea1 — Preview agregado sin escrituras

**Files:** `src/PrintCost.Application/Quotes/QuoteModels.cs`, `QuoteWorkflowService.cs`; `src/PrintCost.Api/Endpoints/QuoteEndpoints.cs`; pruebas de Application/API existentes.

**Interfaces:** produce `QuoteAggregatePreviewRequest(Lines)` y `QuoteAggregatePreviewResult(Aggregate, Lines, CanUsePrice, Warnings)`; método `PreviewAggregateAsync` y endpoint especificados.

- [x] Agregar regresiones: dos líneas→total igual al guardado, fijos una sola vez, rechazo de condiciones globales incompatibles y preview sin escrituras/códigos/auditoría.
- [x] Ejecutar y observar fallo por contrato ausente.
- [x] Exponer/reutilizar el cálculo de revisión sin persistencia y mapear endpoint con validación equivalente.
- [x] Ejecutar pruebas Application/API afectadas y registrar resultados.

## Tarea2 — Estado avanzado y entrada equivalente

**Files:** `web/src/screens/CalculatorScreen.tsx`, `web/src/api/types.ts`; tests existentes o nuevo test funcional del calculador.

**Interfaces:** consume endpoint de Tarea1 para `saveAsQuote`; mantiene preview individual en cálculo avanzado. El mismo constructor de líneas alimenta preview/guardado.

- [x] Escribir regresiones de resultado/copia inválidos al editar, respuestas tardías, fallo/offline, importación completa y request multilínea equivalente al guardado.
- [x] Observar fallos actuales; implementar invalidación/versionado, importación desde estado limpio y agregado autoritativo.
- [x] Hacer distinguibles los rollos en los tres selectores con IDs preservados.
- [x] Ejecutar pruebas de calculador/importación y tipos.

## Tarea3 — Alta, ubicación comercial y acceso móvil

**Files:** `web/src/components/QuickQuoteDialogs.tsx`, `web/src/screens/QuickQuoteScreen.tsx`, `web/src/styles/quick-quote.css`, `shell.css`, `resources.css`; pruebas pertinentes.

**Interfaces:** conservar handlers/borradores existentes; grupo comercial después del artículo de resultado en DOM, columna de resultado en escritorio y después en móvil.

- [x] Regresión de alta con costo entero y validaciones; regresión del recorrido con datos comerciales tras precio conservando autosave/foco.
- [x] Observar fallos; corregir min/step y mover el grupo con labels explícitamente opcionales.
- [x] Ajustar scroll de foco bajo shell fijo y reflow de objetos técnicos a320px sin rediseñar reportes.
- [x] Ejecutar pruebas de rápido/pedidos y comprobar en navegador geometría/foco/reflow.

## Tarea4 — Integración, revisión y cierre

- [x] Ejecutar suites web y backend pertinentes y build con tipos.
- [x] Levantar API propia actualizada conservando la base local; usar base aislada para pruebas mutantes de aceptación.
- [x] Ronda conjunta escritorio/móvil con casos F01–F08; corregir en lote, confirmar y guardar capturas.
- [x] Detector Impeccable una vez sobre targets web afectados; revisar hallazgos contra el brief.
- [x] Revisión independiente del patch y de la implementación visible; resolver hallazgos materiales.
- [x] Alinear PRODUCT.md, DESIGN.md, contrato de superficie y resumen de cambios según reglas efectivamente cambiadas; no reescribir el informe histórico.
- [x] Verificar salud API5080, pantalla5173 y recorridos; dejar servicios activos e informar límites.
