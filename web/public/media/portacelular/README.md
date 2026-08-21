# Medios del portacelular

Este directorio contiene los medios públicos usados por `/portacelular`:

| Archivo | URL pública | Dimensiones | Uso |
| --- | --- | --- | --- |
| `montaje-portacelular.gif` | `/media/portacelular/montaje-portacelular.gif` | 600 × 800 | Instructivo principal; carga `eager` y prioridad alta. |
| `rueda-antistres.gif` | `/media/portacelular/rueda-antistres.gif` | 598 × 760 | Segundo instructivo; carga `lazy`. |
| `montaje-portacelular-static.jpg` | `/media/portacelular/montaje-portacelular-static.jpg` | 600 × 800 | Primer fotograma para movimiento reducido y fallback. |
| `rueda-antistres-static.jpg` | `/media/portacelular/rueda-antistres-static.jpg` | 598 × 760 | Primer fotograma para movimiento reducido y fallback. |

## Integración

- Referenciar los archivos mediante sus URLs públicas. No importarlos desde TypeScript, no convertirlos a Base64 y no duplicarlos dentro del bundle de Vite.
- El GIF de montaje debe usar `loading="eager"`, `fetchpriority="high"` y `decoding="async"`.
- El GIF de la rueda debe usar `loading="lazy"` y `decoding="async"`; no debe precargarse.
- Mantener `width` y `height` explícitos con las dimensiones intrínsecas indicadas para evitar cambios de layout. Si ambas superficies se normalizan visualmente a 3:4, usar `object-fit: contain` para no recortar el segundo GIF.
- Para `prefers-reduced-motion: reduce`, servir el JPG correspondiente como fuente estática. Los mismos JPG pueden reemplazar al GIF si ocurre un error de carga, mientras las instrucciones textuales permanecen disponibles.
- Si se reemplaza un GIF, regenerar su JPG desde el primer fotograma para mantener el fallback sincronizado.

Los cuatro archivos viven en `public`, por lo que el build los copia como recursos estáticos sin incorporarlos al bundle. No forman parte del shell precacheado ni del caché de runtime de `public/sw.js`; sin conexión, la interfaz debe conservar un fallback compacto y las instrucciones textuales.
