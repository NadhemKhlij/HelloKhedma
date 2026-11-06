// Runs SQL in the browser for the runnable exercises (training step 2, 2026-11-06): SQLite compiled to WebAssembly
// (sql.js, self-hosted in js/vendor, loaded only when a runnable exercise is opened), in a Web Worker so a slow or
// endless query never freezes the page: after 5 s the worker is stopped and a new one is started.
// Every run starts from a fresh copy of the exercise's dataset (content/sql/<db>.sql), so INSERT / UPDATE / DELETE
// never change it for the next run. Nothing is sent anywhere: the data and the queries stay in the browser.
//   runSql(db, query) -> { columns, values } (the last result set; empty columns for a statement without rows)
//                        or throws Error(message) (SQL error, or "timeout")
//   tablesOf(db)      -> [{ name, columns: [names], rows }] for the schema panel
const TIMEOUT_MS = 5000;
const workerUrl = new URL("./vendor/worker.sql-wasm.js", import.meta.url).href;
const datasets = new Map();
let worker = null, seq = 0;
const pending = new Map();

function startWorker() {
  worker = new Worker(workerUrl);
  worker.onmessage = (e) => {
    const p = pending.get(e.data?.id);
    if (!p) return;
    pending.delete(e.data.id);
    if (e.data.error) p.reject(new Error(e.data.error)); else p.resolve(e.data);
  };
  worker.onerror = (e) => { for (const p of pending.values()) p.reject(new Error(e.message || "SQL engine error")); pending.clear(); };
}
function call(msg) {
  if (!worker) startWorker();
  const id = ++seq;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      worker.terminate(); worker = null; // a runaway query: drop this engine, the next call starts a new one
      for (const p of pending.values()) p.reject(new Error("timeout"));
      pending.clear();
      reject(new Error("timeout"));
    }, TIMEOUT_MS);
    pending.set(id, { resolve: (v) => { clearTimeout(timer); resolve(v); }, reject: (e) => { clearTimeout(timer); reject(e); } });
    worker.postMessage({ id, ...msg });
  });
}

async function dataset(db) {
  if (!datasets.has(db)) {
    datasets.set(db, fetch(new URL(`../content/sql/${encodeURIComponent(db)}.sql`, import.meta.url))
      .then((r) => { if (!r.ok) throw new Error(`dataset ${db}: ${r.status}`); return r.text(); })
      .catch((e) => { datasets.delete(db); throw e; }));
  }
  return datasets.get(db);
}

// Fresh database with the dataset, then the query. The two messages are queued in order by the worker.
export async function runSql(db, query) {
  const setup = await dataset(db);
  await call({ action: "open" });
  await call({ action: "exec", sql: setup });
  const { results } = await call({ action: "exec", sql: query });
  const last = (results || []).at(-1);
  return last ? { columns: last.columns, values: last.values } : { columns: [], values: [] };
}

export async function tablesOf(db) {
  const setup = await dataset(db);
  await call({ action: "open" });
  await call({ action: "exec", sql: setup });
  const { results } = await call({ action: "exec", sql: "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY rowid" });
  const names = (results?.[0]?.values || []).map((r) => r[0]);
  const out = [];
  for (const name of names) {
    const info = await call({ action: "exec", sql: `SELECT name FROM pragma_table_info('${name.replace(/'/g, "''")}'); SELECT COUNT(*) FROM "${name.replace(/"/g, '""')}"` });
    out.push({ name, columns: (info.results?.[0]?.values || []).map((r) => r[0]), rows: info.results?.[1]?.values?.[0]?.[0] ?? 0 });
  }
  return out;
}
