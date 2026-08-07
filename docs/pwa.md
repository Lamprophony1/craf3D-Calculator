# PWA y offline

- `manifest.webmanifest`, iconos 192/512/maskable, Apple touch icon y `display: standalone`.
- El archivo original recibido se conserva byte a byte en `web/public/branding/logo-master.jpg`; los iconos son derivados redimensionados.
- Registro explícito en `src/pwa/registerServiceWorker.ts`.
- El service worker usa `printcost-shell-v3`, cachea shell, logo, iconos y assets Vite versionados, y limpia caches anteriores.
- `/api`, `/health`, auth y toda mutación son network-only. No se usa cache-first para datos.
- Los borradores `printcost.quick-quote-draft.v1` y `printcost.quote-draft.v1` se guardan en `localStorage`.
- Offline: se muestra el shell y borrador, se bloquean cálculo/guardado definitivos y nunca se afirma persistencia.
- Al reconectar, el usuario envía manualmente; el backend recalcula.

No hay sincronización automática de mutaciones en el MVP.
El shell no afirma una sesión autenticada o verificada cuando se recupera sin red.
