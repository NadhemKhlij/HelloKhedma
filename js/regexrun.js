// Runs a regular expression for the regex exercises (training step 2c) in a Web Worker (regexworker.js) with a 2 s
// limit: a runaway pattern is stopped, the worker dropped and a new one started on the next call. Nothing is sent
// anywhere. runRegex(source, flags, text, mode) -> Promise<[matches]> (see regexRun in drillcheck.js); rejects with
// Error(message) for an invalid pattern, or Error("timeout").
const TIMEOUT_MS = 2000;
const url = new URL("./regexworker.js", import.meta.url).href;
let worker = null, seq = 0;
const pending = new Map();
function start() {
  worker = new Worker(url, { type: "module" });
  worker.onmessage = (e) => {
    const p = pending.get(e.data?.id);
    if (!p) return;
    pending.delete(e.data.id);
    if (e.data.error) p.reject(new Error(e.data.error)); else p.resolve(e.data.result);
  };
  worker.onerror = (e) => { for (const p of pending.values()) p.reject(new Error(e.message || "regex engine error")); pending.clear(); };
}
export function runRegex(source, flags, text, mode) {
  if (!worker) start();
  const id = ++seq;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      worker.terminate(); worker = null;
      for (const p of pending.values()) p.reject(new Error("timeout"));
      pending.clear();
      reject(new Error("timeout"));
    }, TIMEOUT_MS);
    pending.set(id, { resolve: (v) => { clearTimeout(timer); resolve(v); }, reject: (e) => { clearTimeout(timer); reject(e); } });
    worker.postMessage({ id, source, flags, text, mode });
  });
}
