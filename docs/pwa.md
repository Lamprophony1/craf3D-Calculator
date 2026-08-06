# PWA y offline

- `manifest.webmanifest`, iconos 192/512/maskable, Apple touch icon y `display: standalone`.
- El archivo original recibido se conserva byte a byte en `web/public/branding/logo-master.jpg`; los iconos son derivados redimensionados.
- Registro explícito en `src/pwa/registerServiceWorker.ts`.
- El service worker cachea shell, logo, iconos y assets Vite versionados; limpia caches anteriores.
- `/api`, `/health`, auth y toda mutación son network-only. No se usa cache-first para datos.
- El borrador `printcost.quote-draft.v1` se guarda en `localStorage`.
- Offline: se muestra el shell y borrador, se bloquean cálculo/guardado definitivos y nunca se afirma persistencia.
- Al reconectar, el usuario envía manualmente; el backend recalcula.

No hay sincronización automática de mutaciones en el MVP.

