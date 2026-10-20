# PrintCost — registro de producto

<!-- impeccable:product-schema 1 -->

## Platform

web

## Brand Commitments

Proyecto craf3D Calculator. Por decisión del usuario del 2026-10-20 se conserva su identidad visual existente al sustituir TypeUI por el flujo Impeccable/shadcn de SorteoApp. Paleta crema, naranja quemado y ámbar; Chakra Petch, logo y composición actuales. Tokens y reglas en `DESIGN.md`, verificados contra el CSS. El nombre visible se centraliza en `web/src/config/app.ts`; `PrintCost` sigue siendo el namespace técnico.

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

## Prioridades confirmadas — 2026-10-20

1. **Gestión de pedidos — implementada, publicación autorizada:** cotizaciones guardadas en **Presupuestos** como borradores pendientes de aceptación; confirmar las pasa a **Pedidos**. También hay alta directa con precio acordado, descarte recuperable, prioridad manual global y registro de trabajos anteriores. **Cliente / referencia** es texto libre y acompaña al presupuesto con la descripción opcional. No exige alta de cliente ni una ficha técnica para seguir el trabajo. La ejecución y posterior publicación fueron autorizadas el 2026-10-20; ver [definición](docs/superpowers/specs/2026-10-20-orders-management-design.md), [incremento inicial](docs/changes/2026-10-20-orders-management.md), [ajuste de recorrido solicitado](docs/changes/2026-10-20-budget-acceptance.md) y [preparación del despliegue](docs/changes/2026-10-20-production-release.md). El workflow y la imagen instalada acreditan la versión productiva.
2. **Calculadora avanzada — pendiente prioritario:** el usuario actualmente utiliza exclusivamente la cotización rápida. La versión avanzada requiere una mejora de usabilidad y resolver los errores confirmados en la [auditoría del software](docs/changes/2026-10-20-software-audit.md) antes de promover su uso. Esta tarea queda después del incremento de pedidos.

La cotización rápida sigue siendo el recorrido de cálculo utilizado en producción. Su caso real de Gs.60.000 fue verificado con los ajustes productivos; conservar esos ajustes y el motor autoritativo.

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
3. Pedidos
4. Más

El menú **Más** contiene Filamentos, Ajustes, Perfil, Configuración avanzada y Cerrar sesión.

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

El formulario conserva tres grupos de cálculo:

1. Filamento: selección visual con marca, material, color con nombre, buscador y recientes; mantiene la acción “Agregar filamento”.
2. Tiempo de impresión: horas y minutos enteros, con minutos entre 0 y 59.
3. Gramos totales del slicer, con ayuda “Incluí soportes y purga.”

Para quienes gestionan pedidos, **Cliente / referencia** libre y **Qué se va a imprimir (opcional)** recogen datos comerciales; no son requisitos para calcular ni guardar el borrador.

No se muestran inicialmente impresora, energía, tarifa, política, cantidad, placas, tiempo ocupado, setup, mano de obra, margen, overhead, comisión, impuesto ni segunda línea.

El cálculo se ejecuta automáticamente con debounce de 450 ms cuando los tres grupos son válidos. También existe el submit accesible “Calcular precio”. Las respuestas anteriores se abortan o ignoran.

## Resultado principal

Existe una única cifra dominante:

> PRECIO RECOMENDADO  
> Gs. 75.000

Apoyo: “Ya incluye costos, imprevistos y ganancia.”

Acciones:

- Copiar precio.
- Compartir con cliente y copiar el presupuesto completo con los datos comerciales informados.
- Ver presupuesto, o Guardar presupuesto si todavía no está guardado. El guardado automático informa su estado y ofrece acceso al presupuesto pendiente.
- Nuevo cálculo.
- Ver cómo se calculó (secundaria y colapsada).
- Necesito ajustar algo (terciaria; abre `/calculator` con los mismos datos).

Costo, ganancia, margen, impuesto y detalle permanecen colapsados. El desglose cotidiano usa Material, Impresión, Preparación, Embalaje, Reserva por posibles fallas, Costos generales, Ganancia incluida y Total. IDs, potencia, tarifa, política y códigos sólo aparecen en “Detalles técnicos”.

“Nuevo cálculo” limpia horas, minutos y gramos, conserva el último filamento y devuelve el foco a Horas.

## Flujos ligeros

### Nuevo filamento

Dialog o bottom sheet con Marca opcional, Material, Color o nombre, Costo total del rollo y Peso neto. Defaults: 1000 g, PYG e inventario desactivado. Al guardar, se cierra, selecciona el filamento y vuelve al cálculo. La edición cotidiana permite completar la marca conservando variantes y datos financieros. Los detalles avanzados son opcionales.

### Elegir filamento

El rollo seleccionado muestra color, marca, material, variante y costo por gramo. Abrir el control revela filtros combinables de **Marca** y **Material** y opciones visuales con muestras de color y su nombre. Se puede seguir Marca → Material → Color o buscar directamente varias palabras, sin acentos y en cualquier orden. No exige pasar siempre por tres etapas.

Filtrar, buscar, abrir y ampliar resultados no cambia el filamento ni recalcula. Sólo elegir una opción asigna su ID exacto al mismo motor autoritativo. Un resultado vacío mantiene la selección anterior y ofrece limpiar filtros. La lista inicial muestra seis opciones y permite ampliar de seis en seis; los últimos rollos elegidos tienen accesos directos locales, excluyendo inactivos. Escape cierra y devuelve el foco; las opciones usan botones nativos y estados visibles.

Los registros sin fabricante se agrupan como **Sin marca**. No se deduce una marca de un color/nombre ni se alteran datos existentes al agrupar. Las muestras reconocen nombres de color habituales; un nombre especial conserva su texto y usa un icono neutro. La marca opcional se puede completar desde Filamentos. Ver [selección visual de filamento](docs/changes/2026-10-20-filament-picker.md).

### Guardar presupuesto

La cotización rápida se conserva automáticamente en **Presupuestos** como borrador pendiente de aceptación. No exige un dialog adicional ni un cliente. Compartir o copiar utiliza la versión autoritativa guardada; el dialog compatible de guardado manual se conserva para el flujo que no gestiona pedidos.

### Gestión comercial de pedidos

**Presupuestos** (`/quotes`) es la bandeja previa a confirmar: **Pendientes**, **Con pedido** y **Descartados**. Las cotizaciones se guardan aquí sin crear manualmente un borrador aparte. **Confirmar pedido** mueve el mismo registro a Pedidos; si faltan referencia o importe, **Completar y confirmar** abre su ficha en `/quotes/pending/:id`. El documento original permanece en `/quotes/:quoteId` y también da acceso a la confirmación.

**Pedidos** (`/jobs`) contiene **Confirmados** como cola de trabajo e **Historial**. No ofrece alta de borradores ni vistas de presupuestos pendientes o descartados. La búsqueda y paginación abarcan todo el conjunto de cada vista. La ficha confirmada vive en `/orders/:id`; la producción y sus costos existentes siguen en `/jobs/:id` como información secundaria.

**Nuevo pedido** (`/orders/new`) permite **Crear pedido** directamente confirmado, con precio ya acordado y sin usar la calculadora. No ofrece crear un borrador desde cero. Usa cliente/referencia libre, descripción opcional, cantidad inicial 1, importe total, fechas y notas opcionales. Exige referencia, cantidad entera válida e importe informado no negativo; desconocido se distingue de cero. El importe es el total: cantidad 3 e importe Gs.100.000 conserva Gs.100.000, sin multiplicación, márgenes ni redondeos. El alta manual no calcula, no crea presupuesto o producción ficticios y no consume stock.

Una interacción válida en el cotizador guarda un único borrador por sesión de cotización. Editar el cálculo actualiza ese pedido; cambiar solo referencia o descripción mantiene el precio y su desglose. **Nuevo cálculo** conserva el anterior y comienza otra sesión. Con Web Locks, recargar conserva la sesión y una pestaña duplicada obtiene una propia. Sin esa API del navegador, navegar inicia otra sesión para evitar un escritor compartido. Restaurar entradas pasivamente no crea pedidos. El guardado, su fallo y el estado pendiente sin conexión se muestran explícitamente; no se afirma guardado antes de la respuesta del servidor.

Un borrador confirmado, descartado o editado independientemente en Pedidos queda protegido frente a la pestaña antigua del cotizador. Se informa el conflicto y se ofrece comenzar otro cálculo o abrir el pedido cuando corresponde. Las revisiones de presupuesto conservan sus precios y metadatos; la conversión desde presupuesto vincula el registro comercial existente sin duplicarlo ni retroceder su estado.

El seguimiento es **Presupuesto pendiente → Pedido confirmado → En proceso → Listo para entregar → Entregado**. Confirmar no recalcula, no inicia producción ni registra cobro. **Descartar** archiva el presupuesto y permite recuperarlo desde Descartados en Presupuestos; **Cancelar** corresponde a un pedido ya confirmado. La prioridad de los confirmados activos es manual, persistente y compartida: **Subir**, **Bajar** y **Poner primero** operan sobre toda la cola aunque haya búsqueda o paginación. Las fechas no la reordenan automáticamente.

La ficha permite completar datos y notas después; cambiar el estado guarda primero las entradas pendientes. Una respuesta de guardado bloquea temporalmente la edición; ante conflicto se puede actualizar la versión conservando las entradas para revisarlas antes de guardar. Las reglas de alta no invalidan registros anteriores incompletos.

**Registrar un trabajo anterior** admite estados y fechas conocidas sin reconstruir transiciones, inventar cliente o aplicar tarifas actuales. No consume stock. Sin costos reales conocidos, la ganancia permanece **Sin calcular**. Producción terminada, entrega y cobro son hechos distintos. Se conservan los presupuestos, trabajos, clientes de catálogo y vínculos anteriores, con evolución aditiva del esquema local; esta implementación no autoriza su aplicación en producción.

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
- Identidad propia de craf3D conservada en nuevas funcionalidades, con Impeccable como herramienta de diseño y revisión.
- Navegación cotidiana sin catálogos técnicos.
- Primer filamento fácil de crear dentro del flujo.
- Ajustes cotidianos comprensibles.
- Configuración avanzada disponible pero secundaria.
- Ejemplo numérico devuelve 75.000 Gs.
- Pruebas backend/frontend, compilaciones y Docker pasan realmente.
