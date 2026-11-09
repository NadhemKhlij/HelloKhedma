// Checks the DAX practice engine (js/daxeval.js) against SQL (2026-11-09): every case is a DAX measure shown in a grid
// (rows, optional columns, filters) and a SQL query that computes the same numbers on the same model loaded into SQLite
// (sql.js, a devDependency). The engine passes when every cell, row / column total and grand total matches. Then a few
// cases with fixed expected values (functions SQL can't express simply) and the errors a learner should get.
// Run: npm run test-dax (CI runs it with check-content). Exits 1 with one line per problem.
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { loadModel, parseMeasure, evaluateGrid, gradeGrid, DaxError } from "../js/daxeval.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const json = JSON.parse(readFileSync(join(ROOT, "content/dax/retail.json"), "utf8"));
const model = loadModel(json);
const SQL = await createRequire(import.meta.url)("sql.js")();
const db = new SQL.Database();
for (const [name, t] of Object.entries(json.tables)) {
  db.run(`CREATE TABLE "${name}" (${t.columns.map((c, i) => `"${c}" ${t.types[i] === "text" || t.types[i] === "date" ? "TEXT" : "REAL"}`).join(", ")})`);
  const st = db.prepare(`INSERT INTO "${name}" VALUES (${t.columns.map(() => "?").join(", ")})`);
  for (const r of t.rows) st.run(r);
  st.free();
}
const sql = (q) => { const r = db.exec(q); return r.length ? r[0].values : []; };

// The model's measure library (the same ones the exercises hand to the learner).
const MEASURES = Object.fromEntries(Object.entries(json.measures).map(([n, src]) => [n, parseMeasure(src).expr]));

// SQL pieces
const AMT = `s.Quantity * s."Net Price"`;
const FROM = `FROM Sales s JOIN "Date" d ON d."Date" = s.OrderDate JOIN Product p ON p.ProductKey = s.ProductKey
  JOIN Customer c ON c.CustomerKey = s.CustomerKey JOIN Store st ON st.StoreKey = s.StoreKey`;

// sql: rows [rowKey, value] (or [rowKey, colKey, value] with cols); total: one value (optional).
const CASES = [
  { dax: "[Total Sales]", grid: { rows: "Date[Year]" }, sql: `SELECT d.Year, SUM(${AMT}) ${FROM} GROUP BY 1`, total: `SELECT SUM(${AMT}) ${FROM}` },
  { dax: "[Total Sales]", grid: { rows: "Date[Year]", cols: "Product[Category]" }, sql: `SELECT d.Year, p.Category, SUM(${AMT}) ${FROM} GROUP BY 1, 2`,
    rowTotals: `SELECT d.Year, SUM(${AMT}) ${FROM} GROUP BY 1`, colTotals: `SELECT p.Category, SUM(${AMT}) ${FROM} GROUP BY 1`, total: `SELECT SUM(${AMT}) ${FROM}` },
  { dax: "[Margin]", grid: { rows: "Store[Store]" }, sql: `SELECT st.Store, SUM(${AMT} - s.Quantity * s."Unit Cost") ${FROM} GROUP BY 1` },
  { dax: "[Quantity]", grid: { rows: "Product[Subcategory]" }, sql: `SELECT p.Subcategory, SUM(s.Quantity) ${FROM} GROUP BY 1` },
  { dax: "[Customers]", grid: { rows: "Date[Year]", cols: "Store[Channel]" }, sql: `SELECT d.Year, st.Channel, COUNT(DISTINCT s.CustomerKey) ${FROM} GROUP BY 1, 2`,
    rowTotals: `SELECT d.Year, COUNT(DISTINCT s.CustomerKey) ${FROM} GROUP BY 1`, colTotals: `SELECT st.Channel, COUNT(DISTINCT s.CustomerKey) ${FROM} GROUP BY 1` },
  { dax: "COUNTROWS(Sales)", grid: { rows: "Store[Channel]" }, sql: `SELECT st.Channel, COUNT(*) ${FROM} GROUP BY 1`, total: `SELECT COUNT(*) FROM Sales` },
  { dax: "AVERAGE(Sales[Net Price])", grid: { rows: "Product[Category]" }, sql: `SELECT p.Category, AVG(s."Net Price") ${FROM} GROUP BY 1`, total: `SELECT AVG("Net Price") FROM Sales` },
  { dax: "[Orders]", grid: { rows: "Date[Quarter]", filters: { "Date[Year]": [2024] } }, sql: `SELECT d.Quarter, COUNT(DISTINCT s."Order Number") ${FROM} WHERE d.Year = 2024 GROUP BY 1` },
  // CALCULATE: a filter replaces the row's filter on the same column; KEEPFILTERS intersects
  { dax: `CALCULATE([Total Sales], Product[Category] = "Phones")`, grid: { rows: "Product[Category]" },
    sql: `SELECT k.Category, (SELECT SUM(${AMT}) ${FROM} WHERE p.Category = 'Phones') FROM (SELECT DISTINCT Category FROM Product) k` },
  { dax: `CALCULATE([Total Sales], KEEPFILTERS(Product[Category] = "Phones"))`, grid: { rows: "Product[Category]" },
    sql: `SELECT p.Category, SUM(${AMT}) ${FROM} WHERE p.Category = 'Phones' GROUP BY 1` },
  { dax: `CALCULATE([Total Sales], Store[Channel] = "Online")`, grid: { rows: "Date[Year]" }, sql: `SELECT d.Year, SUM(${AMT}) ${FROM} WHERE st.Channel = 'Online' GROUP BY 1` },
  { dax: `CALCULATE([Total Sales], Customer[Country] = "Tunisia", Store[Channel] = "Shop")`, grid: { rows: "Date[Year]" },
    sql: `SELECT d.Year, SUM(${AMT}) ${FROM} WHERE c.Country = 'Tunisia' AND st.Channel = 'Shop' GROUP BY 1` },
  { dax: `CALCULATE([Total Sales], Customer[City] IN {"Paris", "Lyon"})`, grid: { rows: "Date[Year]" },
    sql: `SELECT d.Year, SUM(${AMT}) ${FROM} WHERE c.City IN ('Paris', 'Lyon') GROUP BY 1` },
  { dax: `CALCULATE([Total Sales], Product[Color] = "Black" || Product[Category] = "Audio")`, grid: { rows: "Product[Category]" },
    sql: `SELECT k.Category, (SELECT SUM(${AMT}) ${FROM} WHERE p.Color = 'Black' OR p.Category = 'Audio') FROM (SELECT DISTINCT Category FROM Product) k` },
  { dax: `CALCULATE([Total Sales], Product[Color] = "Black" || Product[Category] = "Audio")`, grid: { rows: "Product[Color]" },
    sql: `SELECT k.Color, (SELECT SUM(${AMT}) ${FROM} WHERE p.Color = 'Black' OR p.Category = 'Audio') FROM (SELECT DISTINCT Color FROM Product) k` },
  { dax: `CALCULATE([Total Sales], Store[Channel] = "Online")`, grid: { rows: "Product[Category]", filters: { "Store[Channel]": ["Shop"] } },
    sql: `SELECT p.Category, SUM(${AMT}) ${FROM} WHERE st.Channel = 'Online' GROUP BY 1` },
  { dax: "[Total Sales]", grid: { rows: "Product[Category]", filters: { "Store[Channel]": ["Online"], "Date[Year]": [2025] } },
    sql: `SELECT p.Category, SUM(${AMT}) ${FROM} WHERE st.Channel = 'Online' AND d.Year = 2025 GROUP BY 1` },
  // ALL, ALLEXCEPT, REMOVEFILTERS, expanded tables
  { dax: "DIVIDE([Total Sales], CALCULATE([Total Sales], ALL(Product)))", grid: { rows: "Date[Year]", cols: "Product[Category]" },
    sql: `SELECT d.Year, p.Category, SUM(${AMT}) / (SELECT SUM(${AMT}) ${FROM} WHERE d.Year = x.Year) ${FROM} JOIN (SELECT DISTINCT Year FROM "Date") x ON x.Year = d.Year GROUP BY 1, 2` },
  { dax: "CALCULATE([Total Sales], ALLEXCEPT(Product, Product[Category]))", grid: { rows: "Product[Subcategory]", filters: { "Product[Category]": ["Audio"] } },
    sql: `SELECT k.Subcategory, (SELECT SUM(${AMT}) ${FROM} WHERE p.Category = 'Audio') FROM (SELECT DISTINCT Subcategory FROM Product WHERE Category = 'Audio') k` },
  // ALLEXCEPT keeps only the filters that exist: with a Subcategory filter and no Category filter, everything is back
  { dax: "CALCULATE([Total Sales], ALLEXCEPT(Product, Product[Category]))", grid: { rows: "Product[Subcategory]" },
    sql: `SELECT k.Subcategory, (SELECT SUM(${AMT}) ${FROM}) FROM (SELECT DISTINCT Subcategory FROM Product) k` },
  { dax: "[Total Sales]", grid: { rows: "Date[Month]", filters: { "Date[Year]": [2024] } },
    sql: `SELECT d.Month, SUM(${AMT}) ${FROM} WHERE d.Year = 2024 GROUP BY 1`, order: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] },
  { dax: "CALCULATE([Total Sales], REMOVEFILTERS(Product[Subcategory]))", grid: { rows: "Product[Subcategory]" },
    sql: `SELECT k.Subcategory, (SELECT SUM(${AMT}) ${FROM}) FROM (SELECT DISTINCT Subcategory FROM Product) k` },
  { dax: "CALCULATE([Total Sales], ALL(Sales))", grid: { rows: "Product[Category]" },
    sql: `SELECT k.Category, (SELECT SUM(${AMT}) ${FROM}) FROM (SELECT DISTINCT Category FROM Product) k` },
  { dax: "DIVIDE([Total Sales], CALCULATE([Total Sales], ALL('Date')))", grid: { rows: "Date[Year]" },
    sql: `SELECT d.Year, SUM(${AMT}) / (SELECT SUM(${AMT}) ${FROM}) ${FROM} GROUP BY 1` },
  { dax: "CALCULATE([Total Sales], FILTER(ALL(Product), Product[List Price] >= 500))", grid: { rows: "Product[Category]" },
    sql: `SELECT k.Category, (SELECT SUM(${AMT}) ${FROM} WHERE p."List Price" >= 500) FROM (SELECT DISTINCT Category FROM Product) k` },
  { dax: "CALCULATE(COUNTROWS(Product), Sales)", grid: { rows: "Date[Year]" },
    sql: `SELECT d.Year, COUNT(DISTINCT s.ProductKey) ${FROM} GROUP BY 1`, total: `SELECT COUNT(DISTINCT ProductKey) FROM Sales` },
  // FILTER, iterators, RELATED, context transition
  { dax: "CALCULATE([Total Sales], FILTER(Sales, Sales[Quantity] * Sales[Net Price] > 1000))", grid: { rows: "Date[Year]" },
    sql: `SELECT d.Year, SUM(${AMT}) ${FROM} WHERE ${AMT} > 1000 GROUP BY 1` },
  { dax: "SUMX(Sales, Sales[Quantity] * RELATED(Product[List Price]))", grid: { rows: "Customer[Segment]" },
    sql: `SELECT c.Segment, SUM(s.Quantity * p."List Price") ${FROM} GROUP BY 1` },
  { dax: "SUMX(FILTER(Sales, RELATED(Store[Channel]) = \"Online\"), Sales[Quantity])", grid: { rows: "Date[Year]" },
    sql: `SELECT d.Year, SUM(s.Quantity) ${FROM} WHERE st.Channel = 'Online' GROUP BY 1` },
  { dax: "AVERAGEX(VALUES(Customer[CustomerKey]), [Total Sales])", grid: { rows: "Date[Year]" },
    sql: `SELECT y, AVG(v) FROM (SELECT d.Year y, s.CustomerKey, SUM(${AMT}) v ${FROM} GROUP BY 1, 2) GROUP BY 1` },
  { dax: "MAXX(VALUES('Date'[Year Month]), [Total Sales])", grid: { rows: "Date[Year]" },
    sql: `SELECT y, MAX(v) FROM (SELECT d.Year y, d."Year Month", SUM(${AMT}) v ${FROM} GROUP BY 1, 2) GROUP BY 1` },
  { dax: "SUMX(VALUES(Product[Category]), CALCULATE(MAX(Sales[Net Price])))", grid: { rows: "Date[Year]" },
    sql: `SELECT y, SUM(v) FROM (SELECT d.Year y, p.Category, MAX(s."Net Price") v ${FROM} GROUP BY 1, 2) GROUP BY 1` },
  { dax: "SUMX(ALL(Product[Category]), [Total Sales])", grid: { rows: "Date[Year]", filters: { "Product[Category]": ["Phones"] } },
    sql: `SELECT d.Year, SUM(${AMT}) ${FROM} GROUP BY 1` },
  { dax: "SUMX(FILTER(Sales, Sales[Quantity] > 1), CALCULATE(SUM(Sales[Quantity])))", grid: { rows: "Product[Category]" },
    sql: `SELECT p.Category, SUM(s.Quantity) ${FROM} WHERE s.Quantity > 1 GROUP BY 1` },
  { dax: "COUNTROWS(FILTER(VALUES(Customer[CustomerKey]), CALCULATE(DISTINCTCOUNT(Sales[Order Number])) > 10))", grid: { rows: "Date[Year]" },
    sql: `SELECT y, COUNT(*) FROM (SELECT d.Year y, s.CustomerKey, COUNT(DISTINCT s."Order Number") n ${FROM} GROUP BY 1, 2) WHERE n > 10 GROUP BY 1` },
  { dax: "CALCULATE([Total Sales], FILTER(VALUES(Customer[CustomerKey]), [Total Sales] > 8000))", grid: { rows: "Date[Year]" },
    sql: `SELECT y, SUM(v) FROM (SELECT d.Year y, s.CustomerKey, SUM(${AMT}) v ${FROM} GROUP BY 1, 2) WHERE v > 8000 GROUP BY 1` },
  { dax: "CALCULATE([Total Sales], TOPN(5, ALL(Customer[CustomerKey]), [Total Sales]))", grid: { rows: "Date[Year]" },
    sql: `SELECT y, SUM(v) FROM (SELECT y, v, ROW_NUMBER() OVER (PARTITION BY y ORDER BY v DESC) rn FROM (SELECT d.Year y, s.CustomerKey, SUM(${AMT}) v ${FROM} GROUP BY 1, 2)) WHERE rn <= 5 GROUP BY 1` },
  { dax: "RANKX(ALL(Product[Product]), [Total Sales])", grid: { rows: "Product[Product]" },
    sql: `SELECT Product, RANK() OVER (ORDER BY v DESC) FROM (SELECT p.Product, SUM(${AMT}) v ${FROM} GROUP BY 1)` },
  { dax: "VAR s = [Total Sales] VAR c = [Total Cost] RETURN DIVIDE(s - c, s)", grid: { rows: "Product[Category]" },
    sql: `SELECT p.Category, SUM(${AMT} - s.Quantity * s."Unit Cost") / SUM(${AMT}) ${FROM} GROUP BY 1` },
  { dax: "DIVIDE([Total Sales], [Orders])", grid: { rows: "Store[Channel]" }, sql: `SELECT st.Channel, SUM(${AMT}) / COUNT(DISTINCT s."Order Number") ${FROM} GROUP BY 1` },
  // ALLSELECTED goes back to the grid's filters (the slicers)
  { dax: "DIVIDE([Total Sales], CALCULATE([Total Sales], ALLSELECTED(Product)))", grid: { rows: "Product[Category]", filters: { "Product[Category]": ["Audio", "Home"] } },
    sql: `SELECT p.Category, SUM(${AMT}) / (SELECT SUM(${AMT}) ${FROM} WHERE p.Category IN ('Audio', 'Home')) ${FROM} WHERE p.Category IN ('Audio', 'Home') GROUP BY 1` },
  { dax: "RANKX(ALLSELECTED(Product[Product]), [Total Sales])", grid: { rows: "Product[Product]", filters: { "Product[Category]": ["Phones"] } },
    sql: `SELECT Product, RANK() OVER (ORDER BY v DESC) FROM (SELECT p.Product, SUM(${AMT}) v ${FROM} WHERE p.Category = 'Phones' GROUP BY 1)` },
  { dax: "CALCULATE([Total Sales], ALLSELECTED())", grid: { rows: "Date[Year]", filters: { "Store[Channel]": ["Online"] } },
    sql: `SELECT k.Year, (SELECT SUM(${AMT}) ${FROM} WHERE st.Channel = 'Online') FROM (SELECT DISTINCT Year FROM "Date") k` },
  // relationships
  { dax: "CALCULATE([Total Sales], USERELATIONSHIP(Sales[DeliveryDate], 'Date'[Date]))", grid: { rows: "Date[Year]" },
    sql: `SELECT d.Year, SUM(${AMT}) FROM Sales s JOIN "Date" d ON d."Date" = s.DeliveryDate GROUP BY 1` },
  { dax: "CALCULATE(COUNTROWS(Sales), USERELATIONSHIP(Sales[DeliveryDate], 'Date'[Date]))", grid: { rows: "Date[Year Month]", filters: { "Date[Year]": [2024] } },
    sql: `SELECT d."Year Month", COUNT(*) FROM Sales s JOIN "Date" d ON d."Date" = s.DeliveryDate WHERE d.Year = 2024 GROUP BY 1` },
  // time intelligence
  { dax: "CALCULATE([Total Sales], SAMEPERIODLASTYEAR('Date'[Date]))", grid: { rows: "Date[Year]" },
    sql: `SELECT d.Year + 1, SUM(${AMT}) ${FROM} WHERE d.Year < 2025 GROUP BY 1` },
  { dax: "CALCULATE([Total Sales], SAMEPERIODLASTYEAR('Date'[Date]))", grid: { rows: "Date[Year Month]", filters: { "Date[Year]": [2025] } },
    sql: `SELECT '2025' || substr(d."Year Month", 5), SUM(${AMT}) ${FROM} WHERE d.Year = 2024 GROUP BY 1` },
  { dax: "CALCULATE([Total Sales], DATEADD('Date'[Date], -1, MONTH))", grid: { rows: "Date[Year Month]", filters: { "Date[Year]": [2024] } },
    sql: `SELECT strftime('%Y-%m', date(substr(s.OrderDate, 1, 7) || '-01', '+1 month')), SUM(${AMT}) FROM Sales s
      WHERE strftime('%Y', date(substr(s.OrderDate, 1, 7) || '-01', '+1 month')) = '2024' GROUP BY 1` },
  { dax: "TOTALYTD([Total Sales], 'Date'[Date])", grid: { rows: "Date[Year Month]" },
    sql: `SELECT ym, SUM(v) OVER (PARTITION BY substr(ym, 1, 4) ORDER BY ym) FROM (SELECT d."Year Month" ym, SUM(${AMT}) v ${FROM} GROUP BY 1)` },
  { dax: "TOTALQTD([Total Sales], 'Date'[Date])", grid: { rows: "Date[Year Month]", filters: { "Date[Year]": [2023] } },
    sql: `SELECT ym, SUM(v) OVER (PARTITION BY q ORDER BY ym) FROM (SELECT d."Year Month" ym, d.Quarter q, SUM(${AMT}) v ${FROM} WHERE d.Year = 2023 GROUP BY 1, 2)` },
  { dax: "CALCULATE([Total Sales], DATESINPERIOD('Date'[Date], MAX('Date'[Date]), -3, MONTH))", grid: { rows: "Date[Year Month]" },
    sql: `SELECT ym, SUM(v) OVER (ORDER BY ym ROWS BETWEEN 2 PRECEDING AND CURRENT ROW) FROM (SELECT d."Year Month" ym, SUM(${AMT}) v ${FROM} GROUP BY 1)` },
  { dax: "CALCULATE([Total Sales], PREVIOUSMONTH('Date'[Date]))", grid: { rows: "Date[Year Month]", filters: { "Date[Year]": [2025] } },
    sql: `SELECT strftime('%Y-%m', date(substr(s.OrderDate, 1, 7) || '-01', '+1 month')), SUM(${AMT}) FROM Sales s
      WHERE strftime('%Y', date(substr(s.OrderDate, 1, 7) || '-01', '+1 month')) = '2025' GROUP BY 1` },
  { dax: "CALCULATE([Total Sales], DATESBETWEEN('Date'[Date], DATE(2024, 3, 1), DATE(2024, 6, 30)))", grid: { rows: "Product[Category]" },
    sql: `SELECT p.Category, SUM(${AMT}) ${FROM} WHERE s.OrderDate BETWEEN '2024-03-01' AND '2024-06-30' GROUP BY 1` },
  { dax: "CALCULATE([Total Sales], 'Date'[Month Number] <= 6)", grid: { rows: "Date[Year]" },
    sql: `SELECT d.Year, SUM(${AMT}) ${FROM} WHERE d."Month Number" <= 6 GROUP BY 1` },
];

// Values the engine must give (no SQL): [formula, grid, expected cells (rows in order), expected total]
const FIXED = [
  ["IF(HASONEVALUE(Product[Category]), \"one\", \"many\")", { rows: "Product[Category]" }, ["one", "one", "one", "one"], "many"],
  ["IF(ISINSCOPE(Product[Category]), RANKX(ALL(Product[Category]), [Total Sales]))", { rows: "Product[Category]" }, [3, 1, 4, 2], null],
  ["RANKX(ALL(Product[Category]), [Total Sales])", { rows: "Product[Category]" }, [3, 1, 4, 2], 1],
  ["SELECTEDVALUE(Product[Category], \"All\")", { rows: "Product[Category]" }, ["Audio", "Computers", "Home", "Phones"], "All"],
  ["SWITCH(TRUE(), [Total Sales] > 300000, \"big\", [Total Sales] > 100000, \"medium\", \"small\")", { rows: "Product[Category]" }, ["medium", "big", "medium", "big"], "big"],
  ["FORMAT(DATE(2025, 3, 7), \"yyyy-mm-dd\")", {}, null, "2025-03-07"],
  ["FORMAT(0.1234, \"0.0%\")", {}, null, "12.3%"],
  ["DATEDIFF(DATE(2024, 1, 31), DATE(2024, 3, 1), DAY)", {}, null, 30],
  ["YEAR(EOMONTH(DATE(2024, 12, 15), 1)) * 100 + DAY(EOMONTH(DATE(2024, 12, 15), 2))", {}, null, 202528],
  ["COUNTROWS(DATESYTD('Date'[Date]))", { rows: "Date[Year]" }, [365, 366, 365], 365],
  ["COUNTROWS(SAMEPERIODLASTYEAR('Date'[Date]))", { rows: "Date[Year]" }, [null, 365, 366], 731],
  ["BLANK() + 1", {}, null, 1],
  ["BLANK() * 2", {}, null, null],
  ["DIVIDE(1, 0, -1)", {}, null, -1],
  ["CONCATENATEX(VALUES(Store[Channel]), Store[Channel], \", \", Store[Channel], ASC)", {}, null, "Online, Shop"],
  ["LOOKUPVALUE(Product[Product], Product[ProductKey], 15)", {}, null, "Phone Pro"],
  ["COUNTROWS(FILTER(Product, Product[Category] IN {\"Audio\", \"Home\"} && NOT(Product[Color] = \"White\")))", {}, null, 7],
  ["VAR t = ADDCOLUMNS(VALUES(Product[Category]), \"S\", [Total Sales]) RETURN MAXX(t, [S]) = MAXX(VALUES(Product[Category]), [Total Sales])", {}, null, true],
  ["COUNTROWS(SUMMARIZE(Sales, Product[Category], Store[Channel]))", {}, null, 8],
  ["COUNTROWS(CROSSJOIN(VALUES(Product[Category]), VALUES(Store[Channel])))", {}, null, 8],
  ["CALCULATE([Total Sales], TREATAS({\"Phones\"}, Product[Category])) = CALCULATE([Total Sales], Product[Category] = \"Phones\")", {}, null, true],
];

// Formulas that must fail, and part of the message the learner sees.
const ERRORS = [
  ["Sales[Quantity]", "A single value for column 'Quantity' in table 'Sales' cannot be determined"],
  ["CALCULATE([Total Sales], [Total Sales] > 100)", "True/False expression"],
  ["SUMX(Sales, Sales[Quantity] * Product[List Price])", "A single value for column 'List Price'"],
  ["SUM(Sales[Price])", "Column 'Price' in table 'Sales' cannot be found"],
  ["[Total Revenue]", "The measure [Total Revenue] cannot be found"],
  ["SUM(Sales[Quantity]", "')' was expected"],
  ["VALUES(Product[Category])", "A table of multiple values was supplied"],
  ["FOO(1)", "is not available"],
  ["CALCULATE([Total Sales], Product[Category] = \"Phones\" && Store[Channel] = \"Online\")", "only use columns of one table"],
  ["Bad = [Bad] + 1", "refers to itself"],
  ["CALCULATE([Total Sales], 'Date'[Year] = \"2024\")", "comparing values of type Number with values of type Text"],
];

const problems = [];
const near = (a, b) => (a == null || b == null ? (a ?? 0) === (b ?? 0) || Math.abs((a ?? 0) - (b ?? 0)) < 1e-6 : Math.abs(a - b) <= 1e-6 * Math.max(1, Math.abs(a), Math.abs(b)));
const keyOf = (v) => String(v);
let checked = 0;
for (const c of CASES) {
  const where = `${c.dax} | ${JSON.stringify(c.grid)}`;
  let g;
  try { g = evaluateGrid(model, MEASURES, parseMeasure(c.dax).expr, c.grid); } catch (e) { problems.push(`${where}: engine error ${e.message}`); continue; }
  const rowKey = (v) => (g.rowType === "date" ? v : keyOf(v));
  const exp = new Map(sql(c.sql).map((r) => [r.slice(0, -1).map(keyOf).join("|"), r[r.length - 1]]));
  g.rowKeys.forEach((r, i) => g.colKeys.forEach((k, j) => {
    const key = c.grid.cols ? `${rowKey(r)}|${keyOf(k)}` : rowKey(r);
    const want = exp.has(key) ? exp.get(key) : null, got = g.cells[i][j];
    checked++;
    if (!near(typeof got === "number" ? got : got == null ? null : NaN, want)) problems.push(`${where}: cell ${key} = ${got}, SQL says ${want}`);
  }));
  const cmpList = (q, keys, vals, label) => {
    const m = new Map(sql(q).map((r) => [keyOf(r[0]), r[1]]));
    keys.forEach((k, i) => { checked++; if (!near(vals[i], m.get(keyOf(k)) ?? null)) problems.push(`${where}: ${label} ${k} = ${vals[i]}, SQL says ${m.get(keyOf(k))}`); });
  };
  if (c.rowTotals) cmpList(c.rowTotals, g.rowKeys, g.rowTotals, "row total");
  if (c.colTotals) cmpList(c.colTotals, g.colKeys, g.colTotals, "column total");
  if (c.total) { checked++; const want = sql(c.total)[0][0]; if (!near(g.total, want)) problems.push(`${where}: total = ${g.total}, SQL says ${want}`); }
  if (c.order && g.rowKeys.join() !== c.order.join()) problems.push(`${where}: rows in the order ${g.rowKeys.join()}, expected ${c.order.join()}`);
  if (c.sql && exp.size !== g.rowKeys.length * (c.grid.cols ? g.colKeys.length : 1) && !c.sparse) {
    const extra = [...exp.keys()].filter((k) => !g.rowKeys.some((r) => (c.grid.cols ? g.colKeys.some((x) => `${rowKey(r)}|${keyOf(x)}` === k) : rowKey(r) === k)));
    if (extra.length) problems.push(`${where}: SQL has rows the grid doesn't show: ${extra.slice(0, 5).join(", ")}`);
  }
  // the grader accepts the formula against itself and rejects a different one
  if (!gradeGrid(g, g).ok) problems.push(`${where}: the grader rejects the formula's own result`);
}
for (const [dax, grid, cells, total] of FIXED) {
  try {
    const g = evaluateGrid(model, MEASURES, parseMeasure(dax).expr, grid);
    const same = (a, b) => (typeof a === "number" && typeof b === "number" ? near(a, b) : a === b);
    if (cells) cells.forEach((v, i) => { checked++; if (!same(g.cells[i][0], v)) problems.push(`${dax}: row ${g.rowKeys[i]} = ${g.cells[i][0]}, expected ${v}`); });
    const got = grid.rows ? g.total : g.cells[0][0];
    checked++;
    if (!same(got, total)) problems.push(`${dax}: total = ${got}, expected ${total}`);
  } catch (e) { problems.push(`${dax}: engine error ${e.message}`); }
}
for (const [dax, part] of ERRORS) {
  checked++;
  try {
    const m = parseMeasure(dax);
    const measures = m.name ? { ...MEASURES, [m.name]: m.expr } : MEASURES;
    evaluateGrid(model, measures, m.expr, { rows: "Date[Year]" });
    problems.push(`${dax}: no error, expected "${part}"`);
  } catch (e) {
    if (!(e instanceof DaxError)) problems.push(`${dax}: ${e.constructor.name} ${e.message}`);
    else if (!e.message.includes(part)) problems.push(`${dax}: error "${e.message}", expected "${part}"`);
  }
}
// a wrong formula is rejected
{
  const right = evaluateGrid(model, MEASURES, parseMeasure("[Total Sales]").expr, { rows: "Date[Year]" });
  const wrong = evaluateGrid(model, MEASURES, parseMeasure("SUM(Sales[Net Price])").expr, { rows: "Date[Year]" });
  if (gradeGrid(right, wrong).ok) problems.push("the grader accepts SUM(Net Price) for Total Sales");
  const blank = evaluateGrid(model, MEASURES, parseMeasure("CALCULATE([Total Sales], SAMEPERIODLASTYEAR('Date'[Date]))").expr, { rows: "Date[Year]" });
  const zero = evaluateGrid(model, MEASURES, parseMeasure("CALCULATE([Total Sales], SAMEPERIODLASTYEAR('Date'[Date])) + 0").expr, { rows: "Date[Year]" });
  if (!gradeGrid(blank, zero).ok) problems.push("the grader should accept 0 for BLANK by default");
  if (gradeGrid(blank, zero, { strictBlank: true }).ok) problems.push("strictBlank should reject 0 for BLANK");
  const scoped = evaluateGrid(model, MEASURES, parseMeasure("IF(ISINSCOPE('Date'[Year]), [Total Sales])").expr, { rows: "Date[Year]" });
  if (gradeGrid(scoped, right).ok) problems.push("the grader should compare the total row, blank included");
}
if (problems.length) {
  console.error(`DAX engine: ${problems.length} problem(s)\n` + problems.map((p) => `  - ${p}`).join("\n"));
  process.exit(1);
}
console.log(`DAX engine: ${CASES.length} SQL cases, ${FIXED.length} fixed cases, ${ERRORS.length} error cases, ${checked} values checked, all OK.`);
