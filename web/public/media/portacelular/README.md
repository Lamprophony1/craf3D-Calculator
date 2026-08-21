# Medios del portacelular

La página pública está preparada para estos archivos, que deben agregarse cuando exista el material final:

```text
hero.webp
montaje-poster.webp
montaje.mp4
antistress-poster.webp
antistress.mp4
```

Después de copiar los archivos, configurá únicamente `hero.imageSrc`, `modes[0].video` y `modes[1].video` en `web/src/config/portacelularProduct.ts`.

Recomendación de entrega: video vertical o 4:5, MP4 H.264, hasta 1080 px de ancho, entre 8 y 20 segundos y comprensible sin audio. Los posters deben exportarse como WebP liviano. No hace falta incluir los MP4 en el shell precacheado de la PWA.
