// Practice data for training step 2e (2026-11-06): writes content/sql/dwh.sql, content/sql/payments.sql and
// content/logs/payments-api.log with a fixed seed (18: the seed chosen so the Data Analyst case tells one clear story:
// every store grows in Q2 except Lyon, whose electronics stop). Run from the repo root: node scripts/gen-practice-2e.mjs
// Re-running it rewrites the three files identically; after any change, rerun npm run check-content (every answer
// is executed) and update the numbers quoted in the exercise explanations.
import { writeFileSync } from "node:fs";

let s = Number(process.argv[2] || 18);
const rnd = () => { s |= 0; s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const pick = (a) => a[Math.floor(rnd() * a.length)];
const q = (v) => (v == null ? "NULL" : typeof v === "number" ? String(v) : `'${String(v).replace(/'/g, "''")}'`);
const row = (vals) => `  (${vals.map(q).join(", ")})`;
const ins = (table, cols, rows) => `INSERT INTO ${table} (${cols.join(", ")}) VALUES\n${rows.map(row).join(",\n")};\n`;
const pad = (n) => String(n).padStart(2, "0");
const iso = (d) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
const key = (d) => Number(iso(d).replace(/-/g, ""));

/* ================= dwh ================= */
const stores = [
  [1, "PAR01", "Paris", "France", "store"], [2, "LYO01", "Lyon", "France", "store"], [3, "MRS01", "Marseille", "France", "store"],
  [4, "TUN01", "Tunis", "Tunisia", "store"], [5, "SFX01", "Sfax", "Tunisia", "store"], [6, "WEB01", "Online", "France", "online"],
];
const products = [
  [1, "LAP-14", "Laptop 14in", "Electronics", 520, 899], [2, "MON-27", "Monitor 27in", "Electronics", 140, 249],
  [3, "HDP-01", "Headphones", "Electronics", 35, 79], [4, "DSK-01", "Standing desk", "Furniture", 210, 449],
  [5, "CHR-01", "Office chair", "Furniture", 95, 219], [6, "LMP-01", "Desk lamp", "Furniture", 12, 39],
  [7, "NTB-A5", "Notebook A5", "Office", 1.2, 4.5], [8, "PEN-10", "Pens x10", "Office", 1.5, 6],
  [9, "PPR-500", "Paper 500 sheets", "Office", 3, 7.9], [10, "MSE-01", "Mouse", "Accessories", 6, 19],
  [11, "KBD-01", "Keyboard", "Accessories", 14, 45], [12, "USB-C", "USB-C hub", "Accessories", 11, 35],
];
const weights = [3, 4, 6, 2, 3, 5, 8, 8, 7, 7, 5, 5];
const names = ["Amira Ben Salah", "Lucas Martin", "Inès Haddad", "Thomas Bernard", "Sarah Cohen", "Youssef Trabelsi", "Emma Petit",
  "Hugo Robert", "Léa Richard", "Karim Mansour", "Chloé Durand", "Mehdi Jaziri", "Yasmine Gharbi", "Louis Moreau", "Camille Laurent",
  "Nour Hamdi", "Adam Michel", "Salma Ayari", "Rayan Bouaziz", "Zoé Leroy"];
const cities = ["Paris", "Lyon", "Marseille", "Tunis", "Sfax"];
const homes = ["Tunis", "Paris", "Lyon", "Marseille", "Paris", "Sfax", "Lyon", "Marseille", "Lyon", "Tunis", "Paris", "Tunis", "Sfax", "Paris", "Lyon", "Tunis", "Marseille", "Sfax", "Paris", "Lyon"];
const segs = ["Consumer", "Business", "Consumer", "Business", "Consumer", "Consumer", "Consumer", "Business", "Consumer", "Business",
  "Consumer", "Consumer", "Consumer", "Business", "Consumer", "Business", "Consumer", "Consumer", "Business", "Consumer"];
// SCD type 2: [customer index, change date, field, new value]
const changes = [[2, "2025-03-01", "city", "Paris"], [6, "2025-04-15", "segment", "Business"], [11, "2025-02-10", "city", "Sfax"]];
const customers = []; // [key, id, name, city, segment, valid_from, valid_to, is_current]
names.forEach((n, i) => customers.push([i + 1, `C${String(i + 1).padStart(3, "0")}`, n, homes[i], segs[i], "2024-01-01", "9999-12-31", 1]));
changes.forEach(([i, date, field, val], k) => {
  const old = customers[i];
  const prev = new Date(date + "T00:00:00Z"); prev.setUTCDate(prev.getUTCDate() - 1);
  old[6] = iso(prev); old[7] = 0;
  const nw = [21 + k, old[1], old[2], field === "city" ? val : old[3], field === "segment" ? val : old[4], date, "9999-12-31", 1];
  customers.push(nw);
});
const versionAt = (id, day) => customers.find((c) => c[1] === id && c[5] <= day && day <= c[6]);
const churned = new Set(["C005", "C009", "C015", "C018"]);

const lines = []; // [line_id, ticket_id, date_key, store_key, product_key, customer_key, quantity, unit_price, discount, amount]
let ticket = 1000;
const start = new Date("2025-01-01T00:00:00Z");
const addTicket = (d, store, custId) => {
  const day = iso(d);
  const cust = custId ? versionAt(custId, day) : null;
  const n = 1 + (rnd() < 0.45 ? 1 : 0) + (rnd() < 0.2 ? 1 : 0);
  const id = ++ticket;
  const used = new Set();
  for (let k = 0; k < n; k++) {
    let p;
    do {
      let r = rnd() * weights.reduce((a, b) => a + b), j = 0;
      while ((r -= weights[j]) > 0) j++;
      p = products[j];
      // Lyon: electronics out of stock from 14 April (the story of the Data Analyst case)
    } while (used.has(p[0]) || (store[0] === 2 && day >= "2025-04-14" && p[3] === "Electronics"));
    used.add(p[0]);
    const qty = p[3] === "Office" ? 1 + Math.floor(rnd() * 6) : p[5] > 200 ? 1 : 1 + (rnd() < 0.3 ? 1 : 0);
    const disc = rnd() < 0.15 ? 0.1 : 0;
    lines.push([lines.length + 1, id, key(d), store[0], p[0], cust ? cust[0] : null, qty, p[5], disc, Math.round(qty * p[5] * (1 - disc) * 100) / 100]);
  }
  return cust;
};
for (let d = new Date(start); iso(d) <= "2025-06-30"; d.setUTCDate(d.getUTCDate() + 1)) {
  const day = iso(d), q2 = day >= "2025-04-01", wk = [0, 6].includes(d.getUTCDay());
  for (const st of stores) {
    const rate = { 1: 0.24, 2: 0.24, 3: 0.17, 4: 0.15, 5: 0.1, 6: 0.28 }[st[0]] * (q2 ? 1.2 : 1) * (wk && st[4] === "store" ? 1.35 : 1);
    if (rnd() >= rate) continue;
    let cid = null;
    if (st[4] === "online" || rnd() >= 0.35) {
      const pool = customers.filter((c) => c[5] <= day && day <= c[6] && (st[4] === "online" || c[3] === st[2]) && !(churned.has(c[1]) && day >= "2025-05-01"));
      if (pool.length) cid = pick(pool)[1];
    }
    addTicket(d, st, cid);
  }
}
// Every customer that did not churn buys at least once from 1 May (online).
for (const c of customers.filter((c) => c[7] === 1)) {
  if (churned.has(c[1])) continue;
  const keys = customers.filter((x) => x[1] === c[1]).map((x) => x[0]);
  if (!lines.some((l) => l[2] >= 20250501 && keys.includes(l[5]))) addTicket(new Date(`2025-0${5 + Math.floor(rnd() * 2)}-${pad(1 + Math.floor(rnd() * 28))}T00:00:00Z`), stores[5], c[1]);
}
lines.sort((a, b) => a[2] - b[2] || a[1] - b[1]);
// renumber tickets and lines in date order
const tmap = new Map(); let tn = 5000;
lines.forEach((l, i) => { if (!tmap.has(l[1])) tmap.set(l[1], ++tn); l[1] = tmap.get(l[1]); l[0] = i + 1; });

// Staging batch (data quality + Data Engineer case): orders from the web shop to load into fact_sales.
const stg = []; // [order_id, batch_id, customer_id, sku, order_date, ship_date, quantity, unit_price]
let oid = 90000;
const batches = [["B-0701", "orders_2025-07-01.csv", 0], ["B-0702", "orders_2025-07-02.csv", 0], ["B-0703", "orders_2025-07-03.csv", 0]];
for (const [b, , ] of batches) {
  const n = 9 + Math.floor(rnd() * 4);
  for (let k = 0; k < n; k++) {
    const p = pick(products.slice(0, 12)), c = pick(customers.filter((x) => x[7] === 1));
    const day = `2025-07-0${b.slice(-1)}`;
    stg.push([++oid, b, c[1], p[1], day, `2025-07-0${Number(b.slice(-1)) + 1 + Math.floor(rnd() * 3)}`, 1 + Math.floor(rnd() * 3), p[5]]);
  }
}
// Planted problems
const at = (i) => stg[i];
at(3)[2] = null;                      // not_null: customer missing
at(12)[6] = null;                     // not_null: quantity missing
at(7)[3] = "LAP-15";                  // relationship: unknown sku
at(20)[3] = "CAB-HDMI";               // relationship: unknown sku
at(15)[2] = "C099";                   // unknown customer
at(10)[6] = -1;                       // impossible quantity
at(18)[5] = "2025-06-30";             // shipped before ordered
stg.splice(6, 0, [...stg[5]]);        // exact duplicate
stg.splice(24, 0, [...stg[23]]);      // exact duplicate
const expected = { "B-0701": 0, "B-0702": 0, "B-0703": 0 };
for (const r of stg) expected[r[1]]++;
// B-0702 file announced 2 more rows than received (a truncated file)
expected["B-0702"] += 2;
batches.forEach((b) => { b[2] = expected[b[0]]; });

const dwh = `-- HelloKhedma practice dataset "dwh" (SQLite): a small sales data warehouse (star schema) for the data modeling,
-- dbt, SQL and Airflow exercises ("run": { "db": "dwh" }). Fictional data, generated with a fixed seed. Loaded in the
-- browser by js/sqlrun.js and in CI by scripts/check-content.mjs, which runs every answer against it.
-- Star schema: fact_sales (one row per ticket line) with dim_date, dim_store, dim_product and dim_customer (slowly
-- changing dimension type 2: a new row with a new customer_key when a customer moves or changes segment; valid_from /
-- valid_to / is_current). customer_key is NULL for walk-in sales (no loyalty card). Staging: stg_orders (the next web
-- orders to load, with planted quality problems) and load_batches (rows announced by each file).

CREATE TABLE dim_store (store_key INTEGER PRIMARY KEY, store_code TEXT NOT NULL, city TEXT NOT NULL, country TEXT NOT NULL, channel TEXT NOT NULL);
CREATE TABLE dim_product (product_key INTEGER PRIMARY KEY, sku TEXT NOT NULL UNIQUE, name TEXT NOT NULL, category TEXT NOT NULL,
  unit_cost REAL NOT NULL, list_price REAL NOT NULL);
CREATE TABLE dim_customer (customer_key INTEGER PRIMARY KEY, customer_id TEXT NOT NULL, name TEXT NOT NULL, city TEXT NOT NULL,
  segment TEXT NOT NULL, valid_from TEXT NOT NULL, valid_to TEXT NOT NULL, is_current INTEGER NOT NULL);
CREATE TABLE dim_date (date_key INTEGER PRIMARY KEY, full_date TEXT NOT NULL, year INTEGER NOT NULL, quarter INTEGER NOT NULL,
  month INTEGER NOT NULL, month_name TEXT NOT NULL, day_of_week INTEGER NOT NULL, day_name TEXT NOT NULL, is_weekend INTEGER NOT NULL);
CREATE TABLE fact_sales (line_id INTEGER PRIMARY KEY, ticket_id INTEGER NOT NULL, date_key INTEGER NOT NULL REFERENCES dim_date(date_key),
  store_key INTEGER NOT NULL REFERENCES dim_store(store_key), product_key INTEGER NOT NULL REFERENCES dim_product(product_key),
  customer_key INTEGER REFERENCES dim_customer(customer_key), quantity INTEGER NOT NULL, unit_price REAL NOT NULL,
  discount REAL NOT NULL, amount REAL NOT NULL);
CREATE INDEX idx_sales_date ON fact_sales (date_key);
CREATE TABLE stg_orders (order_id INTEGER, batch_id TEXT, customer_id TEXT, sku TEXT, order_date TEXT, ship_date TEXT,
  quantity INTEGER, unit_price REAL);
CREATE TABLE load_batches (batch_id TEXT PRIMARY KEY, source_file TEXT NOT NULL, expected_rows INTEGER NOT NULL);

-- One row per day of the first half of 2025 (day_of_week: 0 = Sunday … 6 = Saturday).
INSERT INTO dim_date
WITH RECURSIVE d(day) AS (SELECT '2025-01-01' UNION ALL SELECT date(day, '+1 day') FROM d WHERE day < '2025-06-30')
SELECT CAST(strftime('%Y%m%d', day) AS INTEGER), day, CAST(strftime('%Y', day) AS INTEGER), (CAST(strftime('%m', day) AS INTEGER) + 2) / 3,
  CAST(strftime('%m', day) AS INTEGER),
  CASE strftime('%m', day) WHEN '01' THEN 'January' WHEN '02' THEN 'February' WHEN '03' THEN 'March' WHEN '04' THEN 'April' WHEN '05' THEN 'May' ELSE 'June' END,
  CAST(strftime('%w', day) AS INTEGER),
  CASE strftime('%w', day) WHEN '0' THEN 'Sunday' WHEN '1' THEN 'Monday' WHEN '2' THEN 'Tuesday' WHEN '3' THEN 'Wednesday' WHEN '4' THEN 'Thursday' WHEN '5' THEN 'Friday' ELSE 'Saturday' END,
  CASE WHEN strftime('%w', day) IN ('0', '6') THEN 1 ELSE 0 END
FROM d;

${ins("dim_store", ["store_key", "store_code", "city", "country", "channel"], stores)}
${ins("dim_product", ["product_key", "sku", "name", "category", "unit_cost", "list_price"], products)}
${ins("dim_customer", ["customer_key", "customer_id", "name", "city", "segment", "valid_from", "valid_to", "is_current"], customers)}
${ins("fact_sales", ["line_id", "ticket_id", "date_key", "store_key", "product_key", "customer_key", "quantity", "unit_price", "discount", "amount"], lines)}
${ins("stg_orders", ["order_id", "batch_id", "customer_id", "sku", "order_date", "ship_date", "quantity", "unit_price"], stg)}
${ins("load_batches", ["batch_id", "source_file", "expected_rows"], batches)}`;
writeFileSync("content/sql/dwh.sql", dwh);

/* ================= payments (Application Support case) ================= */
const merchants = [["M01", "BoutiqueNour", "paylink"], ["M02", "CaféDuPort", "stripeish"], ["M03", "LibrairieSfax", "paylink"],
  ["M04", "VéloCity", "stripeish"], ["M05", "PharmaPlus", "paylink"], ["M06", "TechZone", "adyenish"], ["M07", "MaisonBio", "paylink"],
  ["M08", "SportShop", "adyenish"]];
const pays = []; // [id, merchant_id, created_at, amount, psp, status, error_code]
const logs = [];
let pid = 700000;
const ts = (h, m, sec) => `2026-03-18T${pad(h)}:${pad(m)}:${pad(sec)}Z`;
for (let minute = 13 * 60 + 30; minute < 15 * 60 + 30; minute++) {
  const per = rnd() < 0.55 ? 1 : rnd() < 0.5 ? 2 : 0;
  for (let k = 0; k < per; k++) {
    const m = pick(merchants), h = Math.floor(minute / 60), mi = minute % 60, sec = Math.floor(rnd() * 60);
    const amount = Math.round((5 + rnd() * 180) * 100) / 100;
    const down = m[2] === "paylink" && minute >= 14 * 60 + 2 && minute < 14 * 60 + 41;
    const status = down ? "failed" : rnd() < 0.03 ? "declined" : "succeeded";
    const err = down ? "PSP_TIMEOUT" : status === "declined" ? "CARD_DECLINED" : null;
    pays.push([++pid, m[0], ts(h, mi, sec), amount, m[2], status, err]);
    if (status === "succeeded") logs.push([ts(h, mi, sec), `INFO  service=payments-api payment_id=${pid} merchant=${m[0]} psp=${m[2]} status=succeeded duration_ms=${180 + Math.floor(rnd() * 400)}`]);
    else if (status === "declined") logs.push([ts(h, mi, sec), `WARN  service=payments-api payment_id=${pid} merchant=${m[0]} psp=${m[2]} status=declined code=CARD_DECLINED`]);
    else logs.push([ts(h, mi, sec), `ERROR service=payments-api payment_id=${pid} merchant=${m[0]} psp=paylink status=failed code=PSP_TIMEOUT msg="upstream api.paylink.example timed out after 30000 ms"`]);
  }
}
logs.push([ts(13, 30, 0), `INFO  service=payments-api msg="service started" version=2.14.1`]);
logs.push([ts(14, 1, 37), `WARN  service=payments-api psp=paylink msg="TLS handshake slow" duration_ms=8120`]);
logs.push([ts(14, 9, 5), `WARN  service=payments-api msg="circuit breaker half-open" psp=paylink`]);
logs.push([ts(14, 35, 50), `INFO  service=payments-api msg="config reload: psp.paylink.endpoint=api-eu2.paylink.example (failover)"`]);
logs.push([ts(14, 41, 2), `INFO  service=payments-api psp=paylink msg="upstream healthy again" duration_ms=212`]);
logs.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
const paySql = `-- HelloKhedma practice dataset "payments" (SQLite) for the Application Support incident case (ITIL course,
-- "run": { "db": "payments" }). Fictional data generated with a fixed seed, consistent with content/logs/payments-api.log
-- (same payment ids and times, UTC). Loaded in the browser by js/sqlrun.js and in CI by scripts/check-content.mjs.

CREATE TABLE merchants (merchant_id TEXT PRIMARY KEY, name TEXT NOT NULL, psp TEXT NOT NULL);
CREATE TABLE payments (payment_id INTEGER PRIMARY KEY, merchant_id TEXT NOT NULL REFERENCES merchants(merchant_id),
  created_at TEXT NOT NULL, amount REAL NOT NULL, psp TEXT NOT NULL, status TEXT NOT NULL, error_code TEXT);

${ins("merchants", ["merchant_id", "name", "psp"], merchants)}
${ins("payments", ["payment_id", "merchant_id", "created_at", "amount", "psp", "status", "error_code"], pays)}`;
writeFileSync("content/sql/payments.sql", paySql);
writeFileSync("content/logs/payments-api.log", logs.map(([t, m]) => `${t} ${m}`).join("\n") + "\n");
console.log({ lines: lines.length, tickets: tmap.size, customers: customers.length, stg: stg.length, payments: pays.length, logLines: logs.length });
