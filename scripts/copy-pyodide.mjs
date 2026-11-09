// Build step (npm run build): puts the Python engine for runnable Python exercises into js/vendor/pyodide/ (gitignored),
// so it is served by this site (no CDN at run time) without keeping binaries in git. js/pyworker.js loads it on demand.
// 1. Pyodide itself (MPL-2.0, devDependency "pyodide", exact version) is copied from node_modules (13 MB).
// 2. pandas and what it needs (numpy, python-dateutil, pytz, six: the "depends" of pyodide-lock.json) are downloaded
//    from Pyodide's release files on jsDelivr for this exact version, and each file is checked against the SHA-256 of
//    the lock file before it is kept. Files already present with the right hash are not downloaded again.
//    In CI (env CI set) a failed download stops the build; locally it only warns (pandas exercises then cannot run).
// Only these packages are served: a learner's "import <other package>" fails with ModuleNotFoundError.
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";

const FROM = "node_modules/pyodide/", TO = "js/vendor/pyodide/";
const FILES = ["pyodide.mjs", "pyodide.asm.mjs", "pyodide.asm.wasm", "python_stdlib.zip", "pyodide-lock.json", "package.json"];
const PACKAGES = ["pandas"]; // with their dependencies

if (!existsSync(FROM)) {
  console.warn("copy-pyodide: node_modules/pyodide is missing (npm install); runnable Python exercises will not load.");
  process.exit(0);
}
mkdirSync(TO, { recursive: true });
for (const f of FILES) cpSync(FROM + f, TO + f);
console.log(`copy-pyodide: ${FILES.length} files to ${TO}`);

const version = JSON.parse(readFileSync(FROM + "package.json", "utf8")).version;
const lock = JSON.parse(readFileSync(FROM + "pyodide-lock.json", "utf8")).packages;
const wanted = new Set();
const add = (name) => { if (wanted.has(name) || !lock[name]) return; wanted.add(name); (lock[name].depends || []).forEach(add); };
PACKAGES.forEach(add);
const sha = (buf) => createHash("sha256").update(buf).digest("hex");
let failed = 0;
for (const name of wanted) {
  const { file_name: file, sha256 } = lock[name];
  if (existsSync(TO + file) && sha(readFileSync(TO + file)) === sha256) continue;
  const url = `https://cdn.jsdelivr.net/pyodide/v${version}/full/${file}`;
  try {
    let buf = null;
    for (let attempt = 1; attempt <= 3 && !buf; attempt++) {
      try { const r = await fetch(url); if (!r.ok) throw new Error(`HTTP ${r.status}`); buf = Buffer.from(await r.arrayBuffer()); }
      catch (err) { if (attempt === 3) throw err; await new Promise((ok) => setTimeout(ok, 2000 * attempt)); }
    }
    if (sha(buf) !== sha256) throw new Error("SHA-256 does not match pyodide-lock.json");
    writeFileSync(TO + file, buf);
    console.log(`copy-pyodide: ${file} (${(buf.length / 1e6).toFixed(1)} MB)`);
  } catch (err) {
    failed++;
    console.warn(`copy-pyodide: could not get ${file} from ${url}: ${err.message}`);
  }
}
if (failed && process.env.CI) { console.error(`copy-pyodide: ${failed} package file(s) missing, stopping the build.`); process.exit(1); }
if (failed) console.warn("copy-pyodide: pandas exercises will not run in this local build.");
