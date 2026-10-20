# Instrucciones de trabajo — craf3D Calculator

## Contexto y método

- Leer `PRODUCT.md`, `DESIGN.md` y la documentación del frente antes de actuar. Las instrucciones del usuario prevalecen; recuperar decisiones existentes antes de preguntar.
- Decisión del usuario, 2026-10-20: sustituir TypeUI por el método de SorteoApp y conservar la identidad visual de craf3D Calculator. Este cambio de herramientas no autoriza un rediseño.
- Trabajar por incrementos concretos con criterios de aceptación y validación proporcional. Para cambios arquitectónicos, preparar definición y plan antes de implementar; para ajustes acotados, aprovechar el flujo existente.
- Usar las habilidades de Superpowers pertinentes respetando el alcance y las autorizaciones vigentes. No introducir agentes en paralelo por defecto.
- Trabajar en esta carpeta; decidir aislamiento según el frente. Conservar cambios ajenos y evitar limpiezas destructivas.
- Informar avances breves en español y registrar decisiones que afecten comportamiento, diseño u operación.

## Base técnica

- Preservar las cuatro capas `PrintCost.Domain`, `Application`, `Infrastructure` y `Api`, React + TypeScript + Vite, SQLite, autenticación y PWA.
- El backend y el motor decimal son autoritativos para costos y precios. El frontend recoge entradas, ayuda a validarlas y presenta resultados.
- `PrintCost` es el namespace técnico; la marca visible y sus recursos se consultan en `web/src/config/app.ts`. No renombrar namespaces ni migrar datos como efecto de una tarea de UI.
- Mantener versiones fijadas y lockfiles. Separar `tools/ui` y `.agents/skills` de las dependencias del producto y de la imagen de producción.
- Reutilizar patrones de SorteoApp; sus usuarios, PINs, datos, paleta, fuentes, despliegue y autorizaciones pertenecen a ese proyecto.

## UI/UX

1. Leer `docs/ui-ux.md`, `PRODUCT.md` y `DESIGN.md`.
2. Usar `.agents/skills/impeccable/SKILL.md` como guía principal de diseño y revisión. Es Impeccable independiente, no el antiguo sistema de TypeUI con el mismo nombre.
3. Ejecutar `.agents/skills/impeccable/scripts/impeccable.cmd context` una vez por sesión desde la raíz. Si falla, comunicar el límite y leer el contexto directamente conforme al fallback del skill.
4. Preservar la paleta crema/naranja quemado/ámbar, Chakra Petch, el logo existente, las esquinas rectas y la composición implementada. `web/src/styles/tokens.css` y los módulos CSS son la evidencia de los valores reales; mantener `DESIGN.md` alineado con ellos.
5. Elegir el modo por superficie: Operate para la aplicación, Read para instrucciones y Persuade para una página comercial cuando corresponda. No imponer la composición de una landing al cotizador.
6. Antes de editar UI, leer `reference/craft-floor.md` del skill. Las preferencias expresas del usuario prevalecen sobre recomendaciones estéticas genéricas.
7. Reutilizar componentes y CSS existentes. `.agents/skills/shadcn/SKILL.md` aporta apoyo técnico cuando una necesidad justifica incorporar un componente; no obliga a sustituir componentes actuales, inicializar Tailwind o cambiar el tema.
8. Consultar documentación/API de shadcn con `tools/ui/ui.cmd --project-root web shadcn ...`, que usa la versión fijada. Incorporar sólo lo necesario y adaptarlo a los tokens propios; no ejecutar `shadcn init` ni importar un preset por rutina.
9. Para cambios sustanciales, aplicar crítica, auditoría y refinamiento del skill según el problema, incluidas revisiones delegadas si el playbook aplicable las exige.
10. Revisar en navegador escritorio, móvil y estados afectados en una ronda conjunta; corregir en un lote y confirmar con una segunda ronda. Ampliar sólo por un defecto nuevo concreto o por pedido del usuario.
11. Sin hooks automáticos, ejecutar el detector Impeccable una vez al cerrar cambios de UI, sobre los archivos afectados. Evaluar hallazgos contra el brief: un detector limpio no prueba accesibilidad completa.
12. Actualizar el sistema visual y los contratos de superficie si cambian reglas reales. Guardar capturas y evidencia privada en `.impeccable/`; dejar un resumen versionable en `docs/changes/`.

## Verificación y cierre

- Ejecutar verificaciones pertinentes antes de declarar un cambio listo. Para código web: tipos/build y pruebas afectadas; navegador cuando cambian presentación o interacción. Para backend: pruebas del dominio y contratos afectados.
- No añadir suites que sólo repliquen documentación o cambios reversibles de bajo impacto. No desactivar controles para conseguir un resultado correcto.
- Por instrucción expresa del usuario del 2026-10-20, **al terminar cada corrida dejar levantados los servicios locales con los cambios actuales**, como en SorteoApp. Comprobar salud de API, pantalla realmente servida y recorridos afectados; informar las URL locales. Conservar datos y accesos del ambiente. Reutilizar procesos válidos; reiniciar sólo los propios identificados y nunca detener procesos ajenos. Si un bloqueo real impide levantar/verificar el servicio, resolver lo posible e informar el motivo concreto, sin afirmar disponibilidad.
- Informar qué se verificó y los límites reales; distinguir lectura de código, pruebas automáticas, inspección visual, dispositivos físicos y producción.
- Mantener las reglas de dominio y UI coherentes entre local y producción. No hacer push, despliegues, cambios de credenciales ni migraciones por efecto de una tarea local.

Herramientas, restauración y procedencia: `tools/ui/README.md` y `tools/ui/installation.json`.

## Revisión funcional del 2026-10-20

Leer `docs/changes/2026-10-20-software-audit.md` antes de modificar la calculadora. El caso real131,04g/3h40m/Creality blanco se verificó enGs.60.000 con los ajustes productivos; difieren de los recomendados y deben conservarse. Hay tres errores confirmados en preview avanzado, importación desde rápido y preview multilínea, además de un reparto negativo de impuestos en un caso límite; esta revisión no los corrigió.

El usuario autorizó consultar la base de la VM para esta revisión. Se usaron consultas de sólo lectura sobre printcost; esa autorización no habilita editar datos, precios, credenciales, servicios ni desplegar. Los snapshots se verifican dentro de la VM y sólo se devuelven los importes o resúmenes necesarios, sin exportar registros completos o datos personales. El acceso y resultados están documentados en el informe.

## SQLite productivo: identidad de los lectores

Incidente del 2026-10-20: una consulta `mode=ro` como usuario SSH puede crear WAL/SHM con otro propietario y bloquear las escrituras del contenedor, incluido el login. Toda consulta directa a la base activa debe ejecutarse como UID/GID `10001:10001`, identidad de la aplicación actual, además de usar lectura y `query_only`; comprobar antes y después el acceso desde el contenedor. Si falta una herramienta compatible con esa identidad, prepararla antes de abrir la base. No usar `immutable=1` en la base activa, borrar auxiliares ni ampliar permisos globalmente. Procedimiento: `docs/deployment.md`; control: `deploy/check-storage.sh`.

Por la solicitud posterior de corregir el login se restauró la propiedad de los dos auxiliares y se reinició sólo `printcost` con la misma imagen. Se verificaron dos ciclos login/logout por usuario en el origen público sin cambiar PINs. Esto no implica despliegue de las funcionalidades locales ni autorización general para operar otros servicios. Informe: `docs/changes/2026-10-20-production-login.md`.

## Publicación autorizada — 2026-10-20

Después de verificar el login, el usuario pidió expresamente desplegar los cambios pendientes. Esta instrucción autoriza integrar/publicar esta entrega y ejecutar su actualización aditiva en los recursos propios: repositorio `Lamprophony1/craf3D-Calculator`, workflow `ci-cd.yml`, runner `craf3d-production-vm`, VM `gc@10.4.28.21`, `/opt/printcost`, contenedor `printcost`, puerto loopback5030 y `https://craf3d.crg-dev.com`. No volver a pedir permiso para ese despliegue. Preservar PINs, claves, ajustes de precios, datos existentes y los servicios ajenos. El acceso SSH reutiliza la clave dedicada ya autorizada; no copiar credenciales de otras apps.

Se preparó un respaldo consistente mediante SQLite Backup API ejecutada como UID10001, con claves y configuración restringidas en la VM. La actualización se ensayó sobre una copia: integridad correcta, catálogos y snapshots de precios idénticos, importación repetida sin duplicados. Preparación y recuperación: `docs/changes/2026-10-20-production-release.md`. Comprobar el workflow y la imagen realmente instalada antes de afirmar publicación; conservar el preview local disponible.
