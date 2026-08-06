# Seguridad

- PIN numérico de 4 a 6 dígitos, PBKDF2-SHA256 con salt aleatorio, 210.000 iteraciones y comparación constante.
- Respuesta genérica ante usuario/PIN inválido.
- Cinco fallos producen bloqueo temporal de un minuto; el endpoint añade rate limit por IP.
- Cookie `PrintCost.Auth`: HttpOnly, SameSite Lax y Secure en producción.
- 401/403 JSON, nunca redirect HTML.
- llaves Data Protection persistidas en volumen independiente con application name `PrintCost.Api`.
- `DevSelector` se obtiene por defecto solo en Development; producción fija `PinLogin`.
- PINs bootstrap independientes y no sobrescribibles.
- PIN hashes no aparecen en DTOs ni logs.
- política `OwnerOnly` para administración y auditoría.
- auditoría de login, bootstrap, cambio de PIN, cotizaciones y trabajos.

Los secretos viven en `/opt/printcost/printcost.env` con permisos 600. No reutilizar llaves, env o secretos de otra app.

