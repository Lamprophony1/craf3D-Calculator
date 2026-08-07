# PrintCost — registro de producto

Registro de diseño: **PRODUCT**

## Propósito

PrintCost es una aplicación funcional para que Rafa o Clari respondan rápidamente cuánto cobrar por una impresión 3D. No es una landing, una pieza de marketing ni un tablero técnico. El backend y el motor decimal de cálculo son la fuente de verdad.

El trabajo principal debe poder completarse en menos de 15 segundos:

1. Abrir la app.
2. Elegir un filamento.
3. Cargar horas y minutos de impresión.
4. Cargar los gramos totales del slicer.
5. Ver el precio recomendado.
6. Copiarlo o guardar el presupuesto.

## Contexto operativo

- Usuarios principales: Rafa y Clari.
- País: Paraguay.
- Moneda: PYG, mostrada como `Gs.` sin decimales en la interfaz cotidiana.
- Locale: `es-PY`.
- Zona horaria: `America/Asuncion`.
- Nombre técnico: PrintCost.
- Los términos internos de dominio pueden conservarse en código para evitar migraciones innecesarias.

## Principio rector

La experiencia separa dos modos:

- **Usar la app:** cotizar, guardar presupuestos, seguir pedidos y gestionar filamentos.
- **Configurar el motor:** impresoras, energía, tarifas, políticas, impuestos, comisiones, costos y auditoría.

El 95% del uso sucede en el modo simple. La complejidad existente se conserva mediante progressive disclosure; no se elimina.

## Arquitectura de información

Navegación cotidiana de escritorio:

1. Cotizar (`/`)
2. Presupuestos (`/quotes`)
3. Pedidos (`/jobs`)
4. Filamentos (`/filaments`)
5. Ajustes (`/settings`)

Navegación móvil:

1. Cotizar
2. Presupuestos
3. Filamentos
4. Más

El menú **Más** contiene Pedidos, Ajustes, Perfil, Configuración avanzada y Cerrar sesión.

Rutas secundarias conservadas:

- `/settings/advanced`: configuración avanzada.
- `/dashboard`: Resumen.
- `/calculator`: Cálculo avanzado.
- `/quotes/new`: presupuesto completo.
- `/reports`: Reportes.
- `/audit`: Auditoría.
- Rutas de catálogos técnicos existentes: compatibles, accesibles desde configuración avanzada.

## Pantalla principal

Título: **¿Cuánto cobrar?**

Apoyo: **Elegí el filamento, cargá el tiempo y los gramos.**

El formulario inicial muestra exactamente tres grupos:

1. Filamento: selector grande, buscable y con acción “Agregar filamento”.
2. Tiempo de impresión: horas y minutos enteros, con minutos entre 0 y 59.
3. Gramos totales del slicer, con ayuda “Incluí soportes y purga.”

No se muestran inicialmente impresora, energía, tarifa, política, cantidad, placas, tiempo ocupado, setup, mano de obra, margen, overhead, comisión, impuesto ni segunda línea.

El cálculo se ejecuta automáticamente con debounce de 400 ms cuando los tres grupos son válidos. También existe el submit accesible “Calcular precio”. Las respuestas anteriores se abortan o ignoran.

## Resultado principal

Existe una única cifra dominante:

> PRECIO RECOMENDADO  
> Gs. 75.000

Apoyo: “Ya incluye costos, imprevistos y ganancia.”

Acciones:

- Copiar precio.
- Compartir, como acción separada cuando Web Share está disponible.
- Guardar presupuesto.
- Nuevo cálculo.
- Ver cómo se calculó (secundaria y colapsada).
- Necesito ajustar algo (terciaria; abre `/calculator` con los mismos datos).

Costo, ganancia, margen, impuesto y detalle permanecen colapsados. El desglose cotidiano usa Material, Impresión, Preparación, Embalaje, Reserva por posibles fallas, Costos generales, Ganancia incluida y Total. IDs, potencia, tarifa, política y códigos sólo aparecen en “Detalles técnicos”.

“Nuevo cálculo” limpia horas, minutos y gramos, conserva el último filamento y devuelve el foco a Horas.

## Flujos ligeros

### Nuevo filamento

Dialog o bottom sheet con Material, Color o nombre, Costo total del rollo y Peso neto. Defaults: 1000 g, PYG e inventario desactivado. Al guardar, se cierra, selecciona el filamento y vuelve al cálculo. Los detalles avanzados son opcionales.

### Guardar presupuesto

Dialog o bottom sheet con Cliente, Descripción y Nota opcionales. Usa el cálculo ya obtenido; no redirige a la calculadora avanzada y permite guardar sin cliente.

## Ajustes de precio

`/settings` presenta en lenguaje humano:

- Uso de la impresora.
- Preparación y costo calculado.
- Valor del tiempo.
- Embalaje básico.
- Reserva por fallas.
- Costos generales.
- Ganancia objetivo y mínima.
- Precio mínimo.
- Redondeo.

Las acciones son “Guardar cambios” y “Restaurar valores recomendados”; restaurar requiere confirmación accesible. Un preview real del ejemplo de 142 g y 5 h 24 min muestra el impacto sin hardcodear el resultado.

Los datos técnicos automáticos muestran Bambu Lab A1, 95 W y ANDE 435,51 Gs/kWh, con acceso a `/settings/advanced`.
Son datos de solo lectura en la pantalla simple. Si impuestos, comisiones, overhead avanzado, vigencias u otros campos técnicos alteran el precio, se muestra un aviso explícito con acceso a la configuración avanzada.

## Valores recomendados para empezar

### Impresora Bambu Lab A1

- MachineCostMode: `ManualHourlyRate`.
- ManualHourlyRateGs: `2000`.

### Política predeterminada

- DefaultLaborRateGsPerHour: `20000`.
- FailureMode: `ExpectedAttempts`.
- FailureProbability: `0.10`.
- OverheadPercent: `5`.
- FixedOverheadPerOrderGs: `0`.
- TargetMarginPercent: `40`.
- MinimumMarginPercent: `30`.
- MinimumOrderGs: `30000`.
- RoundingIncrementGs: `5000`.
- RoundUp: `true`.
- VariableSellingFeePercent: `0`.
- FixedSellingFeeGs: `0`.
- MonthlyOverheadGs: `0`.

### Cotización rápida

- DefaultQuickSetupMinutes: `20`.
- DefaultQuickPackagingCostGs: `2000`.
- DefaultPrinterId: Bambu Lab A1 seeded.
- DefaultElectricityTariffId: ANDE seeded.
- DefaultPricingPolicyId: política seeded.

### Energía e impuestos

- AveragePrintPowerW: `95`.
- IdlePowerW: `5`.
- MaxPowerW: `1300`.
- ElectricityRateGsPerKWh: `435.51`.
- AdditionalChargesPercent: `0`.
- TaxEnabled: `false`.
- TaxRatePercent: `0`.
- PriceIncludesTax: `false`.

Estos valores son una base recomendada y editable, no una ley universal.

## Backfill seguro

Las bases nuevas nacen con los valores recomendados. En bases existentes:

- sólo se inspeccionan IDs seeded conocidos;
- no se sobrescriben valores personalizados;
- sólo se completan `null` o valores vacíos originales inequívocos;
- una versión `RecommendedDefaultsVersion` registra la aplicación del backfill;
- la restauración explícita desde Ajustes sí restablece el conjunto recomendado;
- nunca se usa `EnsureDeleted` ni se borra la base.

## Reglas del motor

- `QuickPreviewAsync` convierte la entrada simple a `QuotePreviewRequest` y usa `PreviewAsync`; no hay fórmulas de precio en React.
- El cálculo agregado y sus snapshots históricos permanecen intactos.
- La falta de perfil específico usa el perfil estándar activo de la impresora predeterminada y genera una nota técnica no bloqueante.
- Inventario insuficiente es advertencia no bloqueante al cotizar y sólo se muestra si el rollo controla inventario; el consumo real sigue rechazando inventario negativo.
- Cualquier costo obligatorio pendiente mantiene `CanUsePrice=false`.
- La fachada `SimplePricingSettings` escribe sobre impresora, política y `ApplicationSettings` existentes; energía y tarifa son técnicas y de solo lectura en esa fachada. No crea una segunda fuente de verdad.
- La fachada simple de filamentos recibe un costo final en PYG, normaliza `PurchaseCurrency=PYG`, `PurchaseAmount=LandedCostGs` y `ExchangeRateGs=null`, y conserva el estado de inventario al editar.

## Caso de aceptación

Filamento PLA de 1000 g con costo total de 131.250 Gs. Cotización rápida de 142 g y 324 minutos:

- precio final: 75.000 Gs;
- costo completo aproximado: 43.704 Gs;
- `CanUsePrice=true`;
- no requiere visitar Ajustes antes.

## Estados obligatorios

Cada flujo contempla:

- vacío: explica el propósito y ofrece la siguiente acción;
- loading: conserva el espacio y comunica progreso;
- error: describe el problema y cómo recuperarse;
- éxito: confirma en pasado y ofrece continuación;
- offline: recupera el borrador pero no afirma sesión ni precio verificados;
- disabled: permanece visible y explica qué falta.

## Restricciones técnicas

- Preservar Domain/Application/Infrastructure/API.
- Preservar el motor decimal, agregado multilínea, AggregateJson, snapshots, autenticación, PWA, Docker y CI/CD.
- No crear otra aplicación ni otro motor.
- No borrar datos históricos.
- No tocar GymQuest.
- No hacer reset, push ni deploy.

## Criterios de éxito

- Primera cotización en menos de 15 segundos con tres grupos de entrada.
- Identidad Impeccable aplicada como sistema de composición.
- Navegación cotidiana sin catálogos técnicos.
- Primer filamento fácil de crear dentro del flujo.
- Ajustes cotidianos comprensibles.
- Configuración avanzada disponible pero secundaria.
- Ejemplo numérico devuelve 75.000 Gs.
- Pruebas backend/frontend, compilaciones y Docker pasan realmente.
