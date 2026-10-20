import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const toolingRoot = dirname(fileURLToPath(import.meta.url));
const workspaceRoot = resolve(toolingRoot, "../..");
const argv = process.argv.slice(2);
let projectRoot = workspaceRoot;

if (argv[0] === "--project-root") {
  if (!argv[1]) {
    console.error("Falta la ruta después de --project-root.");
    process.exit(2);
  }
  projectRoot = resolve(argv[1]);
  argv.splice(0, 2);
}

const tool = argv.shift();
if (!["shadcn", "skills"].includes(tool)) {
  console.error("Uso: ui.cmd [--project-root RUTA] <shadcn|skills> [argumentos]");
  process.exit(2);
}

try {
  const packageRoot = join(toolingRoot, "node_modules", tool);
  const pkg = JSON.parse(readFileSync(join(packageRoot, "package.json"), "utf8"));
  const bin = typeof pkg.bin === "string" ? pkg.bin : pkg.bin?.[tool];
  if (!bin) throw new Error("El paquete no declara el ejecutable solicitado.");
  const nodeDir = dirname(process.execPath);
  const env = { ...process.env, DO_NOT_TRACK: "1" };
  const pathKey = Object.keys(env).find((key) => key.toLowerCase() === "path") ?? "PATH";
  env[pathKey] = nodeDir + (process.platform === "win32" ? ";" : ":") + (env[pathKey] ?? "");
  const result = spawnSync(process.execPath, [resolve(packageRoot, bin), ...argv], {
    cwd: projectRoot, stdio: "inherit", env, shell: false,
  });
  if (result.error) throw result.error;
  process.exit(result.status ?? 1);
} catch (error) {
  console.error("No se pudo ejecutar la herramienta: " + error.message);
  process.exit(1);
}
