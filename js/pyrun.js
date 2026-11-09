// Runs Python in the browser for the runnable Python exercises (training step 5, 2026-11-09): Pyodide in a Web Worker
// (js/pyworker.js), loaded only when the learner first presses ▶ Run or ✓ Check (about 13 MB, then cached by the
// browser). A run longer than 5 s stops the worker (an endless loop never freezes the page); the next run starts a
// new one. Nothing is sent anywhere: the code and the tests stay in the browser.
//   runPython(code, tests?) -> { stdout, error?, failed? }  (see pyworker.js), or throws Error("timeout" | "load")
//   pythonLoaded()          -> true once the engine answered (the UI says "loading Python" before that)
const RUN_MS = 5000, LOAD_MS = 90000;
let worker = null, ready = null, seq = 0;
const pending = new Map();

function start() {
  worker = new Worker(new URL("./pyworker.js", import.meta.url), { type: "module" });
  worker.onmessage = (ev) => { const p = pending.get(ev.data?.id); if (p) { pending.delete(ev.data.id); p(ev.data); } };
  worker.onerror = () => { for (const p of pending.values()) p({ error: "load" }); pending.clear(); };
  ready = new Promise((resolve, reject) => {
    const timer = setTimeout(() => { stop(); reject(new Error("load")); }, LOAD_MS);
    pending.set("warmup", (d) => { clearTimeout(timer); if (d.error) { stop(); reject(new Error("load")); } else resolve(true); });
    worker.postMessage({ id: "warmup" });
  });
  ready.loaded = false;
  ready.then(() => { if (ready) ready.loaded = true; }, () => {});
}
function stop() { worker?.terminate(); worker = null; ready = null; pending.clear(); }

export const pythonLoaded = () => !!ready?.loaded;

export async function runPython(code, tests = "") {
  if (!worker) start();
  await ready;
  const id = ++seq;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { stop(); reject(new Error("timeout")); }, RUN_MS);
    pending.set(id, (d) => { clearTimeout(timer); if (d.error === "load" && d.stdout == null) reject(new Error("load")); else resolve(d); });
    worker.postMessage({ id, code, tests });
  });
}
