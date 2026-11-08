// Build step (npm run build): copies the Python engine for runnable Python exercises (Pyodide, MPL-2.0, devDependency
// "pyodide", exact version) from node_modules into js/vendor/pyodide/, so it is served by this site (no CDN) without
// keeping 13 MB of binaries in git (js/vendor/pyodide/ is gitignored). js/pyworker.js loads it on demand.
// Plain Python only (standard library): packages such as pandas are not copied.
import { cpSync, existsSync, mkdirSync } from "node:fs";

const FROM = "node_modules/pyodide/", TO = "js/vendor/pyodide/";
const FILES = ["pyodide.mjs", "pyodide.asm.mjs", "pyodide.asm.wasm", "python_stdlib.zip", "pyodide-lock.json", "package.json"];
if (!existsSync(FROM)) {
  console.warn("copy-pyodide: node_modules/pyodide is missing (npm install); runnable Python exercises will not load.");
} else {
  mkdirSync(TO, { recursive: true });
  for (const f of FILES) cpSync(FROM + f, TO + f);
  console.log(`copy-pyodide: ${FILES.length} files to ${TO}`);
}
