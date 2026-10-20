# Herramientas UI de craf3D Calculator

Instalación local adaptada del flujo existente de SorteoApp el 2026-10-20. Son herramientas de desarrollo separadas del frontend.

## Versiones recuperadas

- Impeccable skill **4.5.2** y motor **0.1.14**, ejecutados con el launcher del skill.
- shadcn CLI **4.21.0** y Skills CLI **1.7.0**, fijados en `package.json` y `package-lock.json`.
- Runtime local ya existente en craf3D: Node **24.19.0** y npm **11.17.0**. El wrapper Windows usa `.tools/node-v24.19.0-win-x64/node.exe`, o `node.exe` del PATH cuando no existe esa copia.

No se incorpora el CLI npm antiguo de Impeccable que el referente conserva por historia: su motor era distinto. El launcher del skill es la única entrada al motor activo. Los playbooks de diseño se leen desde el skill; no todos sus nombres son subcomandos del ejecutable.

## Uso desde la raíz

```powershell
# Contexto: una vez por sesión desde el producto.
.\.agents\skills\impeccable\scripts\impeccable.cmd context

# Comprobaciones locales, sin inicializar ni generar frontend.
.\.agents\skills\impeccable\scripts\impeccable.cmd engine-probe
.\tools\ui\ui.cmd shadcn --version
.\tools\ui\ui.cmd skills --version

# Consulta de documentación para un incremento concreto.
.\tools\ui\ui.cmd --project-root .\web shadcn docs button
```

En otro sistema con Node 24, `node tools/ui/ui.mjs ...` ejecuta las mismas herramientas. El launcher POSIX del skill está en `.agents/skills/impeccable/scripts/impeccable`.

`ui.mjs` conserva el patrón del referente: argumentos separados, `shell: false`, directorio explícito y `DO_NOT_TRACK=1`. El wrapper no usa `npx`, no resuelve `latest` ni descarga paquetes por su cuenta. Algunos comandos del proveedor, como consultar documentación o registros, sí pueden necesitar red.

shadcn es apoyo técnico; actualmente el producto usa React y CSS propios. No ejecutar `shadcn init`, agregar Tailwind ni importar un preset como preparación rutinaria. Revisar primero el contrato del incremento en `docs/ui-ux.md`.

## Restaurar en un checkout nuevo

1. Disponer de Node 24 y npm; la versión local verificada se indica arriba. Los runtimes y `node_modules` están ignorados.
2. Desde la raíz:

   ```powershell
   npm.cmd ci --prefix .\tools\ui --ignore-scripts --no-audit --no-fund
   ```

   Si Node no está en PATH, agregar temporalmente su carpeta. `--ignore-scripts` corresponde sólo a este tooling auxiliar.

3. Restaurar los skills desde Git. El binario Windows del motor está ignorado; el launcher puede recuperarlo en la primera ejecución con comprobación de checksum. Para mantener la caché dentro del proyecto, establecer `IMPECCABLE_HOME` en `.tools/impeccable`. En esta migración se usó la copia local de SorteoApp, comprobada contra su SHA-256 registrado.
4. Ejecutar las comprobaciones de versión y contexto. Si el launcher no está disponible, informar el límite y leer `PRODUCT.md`/`DESIGN.md` directamente, como indica el skill.

La copia inicial evita descargas y scripts de instalación. El lockfile permite restauración reproducible de paquetes; no reinstalar los skills por rutina, porque el contenido del proveedor puede cambiar. Los archivos y hashes de esta instalación están en `installation.json`.

No se activaron hooks ni se copiaron contexto, identidad, datos, credenciales o permisos de publicación de SorteoApp. `tools/ui` y `.agents` se excluyen del contexto Docker. Licencias y referencias originales de los skills se conservan.

`engine-probe` identifica `impeccable-engine 0.1.14`; `--version` imprime 4.0.0 por compatibilidad y no identifica la versión de distribución del motor. La licencia Apache 2.0 del proveedor Impeccable se conserva en `licenses/impeccable-LICENSE`; el skill de shadcn incluye su licencia original.
