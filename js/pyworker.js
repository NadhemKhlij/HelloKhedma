// Web Worker for runnable Python exercises (training step 5, js/pyrun.js): Pyodide (CPython compiled to WebAssembly,
// self-hosted in js/vendor/pyodide/, copied at build time by scripts/copy-pyodide.mjs) loads once per worker.
// Message { id, code, tests? } -> { id, stdout, error?, failed? }
//   The learner's code runs in a fresh namespace, in a fresh temporary folder; then the hidden tests (Python asserts)
//   run in the same namespace. error: the learner's code raised (last lines of the traceback); failed: a test failed
//   (its assert message). Nothing is sent anywhere. js/pyrun.js stops the worker after a time limit.
import { loadPyodide } from "./vendor/pyodide/pyodide.mjs";

const ready = loadPyodide({ indexURL: new URL("./vendor/pyodide/", import.meta.url).href });
const tail = (msg) => String(msg || "").trim().split("\n").filter((l) => l.trim()).slice(-3).join("\n");

self.onmessage = async (ev) => {
  const { id, code, tests } = ev.data || {};
  if (id === "warmup") { try { await ready; self.postMessage({ id }); } catch (e) { self.postMessage({ id, error: String(e.message || e) }); } return; }
  let out = "";
  try {
    const py = await ready;
    py.setStdout({ batched: (s) => { out += s + "\n"; } });
    py.setStderr({ batched: (s) => { out += s + "\n"; } });
    py.runPython("import os, tempfile\nos.chdir(tempfile.mkdtemp())", { globals: py.globals.get("dict")() });
    const ns = py.globals.get("dict")();
    try { await py.runPythonAsync(code, { globals: ns }); }
    catch (e) { self.postMessage({ id, stdout: out.slice(0, 20000), error: tail(e.message) }); return; }
    if (tests) {
      try { await py.runPythonAsync(tests, { globals: ns }); }
      catch (e) {
        const m = String(e.message || "");
        const assertion = m.match(/AssertionError:?\s*(.*)\s*$/s);
        self.postMessage({ id, stdout: out.slice(0, 20000), failed: assertion ? (assertion[1].trim() || "a test failed") : tail(m) });
        return;
      }
    }
    self.postMessage({ id, stdout: out.slice(0, 20000) });
  } catch (e) {
    self.postMessage({ id, stdout: out, error: tail(e.message || e) });
  }
};
