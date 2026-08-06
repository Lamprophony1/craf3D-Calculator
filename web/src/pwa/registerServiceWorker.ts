import { APP_NAME } from '../config/app';

export function registerServiceWorker(): void {
  if (import.meta.env.DEV || !('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' }).catch((error: unknown) => {
      console.warn(`No se pudo registrar el service worker de ${APP_NAME}.`, error);
    });
  });
}

