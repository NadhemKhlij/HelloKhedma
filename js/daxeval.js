// DAX engine for runnable DAX exercises (2026-11-09): parses a measure and evaluates it on a small practice model
// (content/dax/<model>.json, made by scripts/gen-dax-model.mjs) the way Power BI would, so learners write real DAX on
// the site and get it checked. No DOM: shared by the Practice tab (js/practice.js daxRunner) and CI
// (scripts/test-dax.mjs compares the engine with SQL on the same data; scripts/check-content.mjs runs every answer).
//
//   loadModel(json)                      -> model (dates become day numbers, relationships indexed)
//   parseMeasure("Name = expr")          -> { name, expr: ast }     (the "Name =" part is optional)
//   evaluateGrid(model, measures, ast, grid, { timeLimitMs = 4000 })
//      grid = { rows: "Date[Year]", cols?: "Product[Category]", filters?: { "Store[Channel]": ["Online"] } }
//      measures = { "Total Sales": ast, … } other measures the formula may use ([Total Sales])
//      -> { rowKeys, colKeys, cells: [[v]], rowTotals: [v], colTotals: [v], total }   (v: number | string | boolean | null)
//      Row / column headers are the values left by grid.filters, in the model's sort order (sortBy in the model JSON).
//   gradeGrid(expected, mine, { strictBlank })  -> { ok, wrong: [{ r, c }] }   (blank and 0 equal unless strictBlank)
//   formatValue(v, type) / formatWith(v, "0.0%") -> display text ("(blank)" for BLANK)
//
// What it models: filter context (column filters, row filters on a table), row context (iterators), relationships
// many-to-one with filters flowing from dimension to fact (one active per pair, USERELATIONSHIP for the others),
// expanded tables (ALL / REMOVEFILTERS / ALLEXCEPT on a fact table, a fact table used as a filter or a context
// transition on its rows filters the dimension rows it points to), CALCULATE (filter arguments evaluated in the outer
// context, context transition, modifiers, then filters that replace the existing ones on their columns, or intersect
// with KEEPFILTERS), the marked date table (a filter on 'Date'[Date] removes the other Date filters), time
// intelligence that moves whole months like DAX (end of month stays end of month), measure references with implicit
// CALCULATE, VAR / RETURN, BLANK arithmetic, Number vs Text comparison errors and DAX's error for a column used
// without row context. The work is bounded by a time limit (a runaway formula stops with a DaxError). Not modelled (exercises avoid them): bidirectional relationships,
// many-to-many, the blank row of an invalid relationship, calculation groups, formatting strings beyond the
// common ones. ALLSELECTED goes back to the grid's own filters (grid.filters, the "slicers"), which is what it does in a
// simple visual. Errors are thrown as DaxError with a message close to Power BI's.

export class DaxError extends Error {}
const fail = (msg) => { throw new DaxError(msg); };

/* ------------------------------------------------------------------ model */
const EPOCH = Date.UTC(1899, 11, 30);
export const toSerial = (iso) => Math.round((Date.parse(`${iso}T00:00:00Z`) - EPOCH) / 86400000);
export const fromSerial = (n) => new Date(EPOCH + Math.round(n) * 86400000).toISOString().slice(0, 10);
const ymd = (n) => { const d = new Date(EPOCH + Math.round(n) * 86400000); return [d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate()]; };
const serialOf = (y, m, d) => Math.round((Date.UTC(y, m - 1, d) - EPOCH) / 86400000);
const parseCol = (ref) => { const m = /^'?([^'[]+)'?\[([^\]]+)\]$/.exec(ref); if (!m) fail(`Bad column reference ${ref}`); return { table: m[1], col: m[2], id: `${m[1]}[${m[2]}]` }; };

export function loadModel(json) {
  const tables = {};
  for (const [name, t] of Object.entries(json.tables)) {
    const types = t.types || t.columns.map(() => "text");
    const data = t.rows.map((r) => r.map((v, i) => (types[i] === "date" && typeof v === "string" ? toSerial(v) : v)));
    const colIndex = new Map(t.columns.map((c, i) => [c.toLowerCase(), i]));
    tables[name] = { name, columns: t.columns, types, data, colIndex, key: t.key, dateTable: !!t.dateTable, sortBy: t.sortBy || {} };
  }
  const tableByLower = new Map(Object.keys(tables).map((n) => [n.toLowerCase(), n]));
  const rels = (json.relationships || []).map((r) => {
    const f = parseCol(r.from), to = parseCol(r.to);
    return { from: f.table, fromCol: tables[f.table].colIndex.get(f.col.toLowerCase()), fromId: f.id,
      to: to.table, toCol: tables[to.table].colIndex.get(to.col.toLowerCase()), toId: to.id, active: r.active !== false };
  });
  return { tables, tableByLower, rels, json };
}
const tableOf = (model, name) => { const n = model.tableByLower.get(String(name).toLowerCase()); if (!n) fail(`Cannot find table '${name}'.`); return model.tables[n]; };
function colRef(model, table, col) {
  const t = tableOf(model, table), i = t.colIndex.get(col.toLowerCase());
  if (i == null) fail(`Column '${col}' in table '${t.name}' cannot be found or may not be used in this expression.`);
  return { table: t.name, i, id: `${t.name}[${t.columns[i]}]`, name: t.columns[i], type: t.types[i] };
}
// Tables reachable many-to-one from t (its "expanded" table), t included.
function expanded(model, t, seen = new Set()) {
  if (seen.has(t)) return seen;
  seen.add(t);
  for (const r of model.rels) if (r.from === t && r.active) expanded(model, r.to, seen);
  return seen;
}

/* ------------------------------------------------------------------ lexer + parser */
const FUNC_CHARS = /[A-Za-z0-9_.]/;
function lex(src) {
  const out = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (/\s/.test(c)) { i++; continue; }
    if (src.startsWith("//", i) || src.startsWith("--", i)) { while (i < src.length && src[i] !== "\n") i++; continue; }
    if (src.startsWith("/*", i)) { const e = src.indexOf("*/", i + 2); i = e < 0 ? src.length : e + 2; continue; }
    if (c === '"') {
      let s = "", j = i + 1;
      for (;;) { if (j >= src.length) fail("A text value is missing its closing quote (\")."); if (src[j] === '"') { if (src[j + 1] === '"') { s += '"'; j += 2; continue; } break; } s += src[j++]; }
      out.push({ k: "str", v: s, at: i }); i = j + 1; continue;
    }
    if (c === "'") {
      const e = src.indexOf("'", i + 1); if (e < 0) fail("A table name is missing its closing quote (').");
      out.push({ k: "table", v: src.slice(i + 1, e), at: i }); i = e + 1; continue;
    }
    if (c === "[") {
      const e = src.indexOf("]", i + 1); if (e < 0) fail("A name is missing its closing bracket (]).");
      out.push({ k: "bracket", v: src.slice(i + 1, e), at: i }); i = e + 1; continue;
    }
    if (/[0-9]/.test(c) || (c === "." && /[0-9]/.test(src[i + 1]))) {
      const m = /^[0-9]*\.?[0-9]+(?:[eE][+-]?[0-9]+)?/.exec(src.slice(i)) || /^[0-9]+\.?/.exec(src.slice(i));
      out.push({ k: "num", v: Number(m[0]), at: i }); i += m[0].length; continue;
    }
    if (/[A-Za-z_]/.test(c)) {
      let j = i; while (j < src.length && FUNC_CHARS.test(src[j])) j++;
      out.push({ k: "id", v: src.slice(i, j), at: i }); i = j; continue;
    }
    const two = src.slice(i, i + 2);
    if (["&&", "||", "<>", "<=", ">=", "==", ":="].includes(two)) { out.push({ k: "op", v: two, at: i }); i += 2; continue; }
    if ("+-*/^&=<>(),{}".includes(c)) { out.push({ k: "op", v: c, at: i }); i++; continue; }
    fail(`The syntax for '${c}' is incorrect.`);
  }
  out.push({ k: "end", at: src.length });
  return out;
}

function parse(src) {
  const toks = lex(src);
  let p = 0;
  const peek = (o = 0) => toks[p + o];
  const isOp = (v, o = 0) => peek(o).k === "op" && peek(o).v === v;
  const isId = (v, o = 0) => peek(o).k === "id" && peek(o).v.toUpperCase() === v;
  const take = () => toks[p++];
  const expect = (v) => { if (!isOp(v)) fail(`The syntax for '${tokText(peek())}' is incorrect: '${v}' was expected.`); return take(); };
  const tokText = (t) => (t.k === "end" ? "the end of the formula" : t.k === "str" ? `"${t.v}"` : t.k === "bracket" ? `[${t.v}]` : t.k === "table" ? `'${t.v}'` : String(t.v));

  function expr() {
    if (isId("VAR")) {
      const vars = [];
      while (isId("VAR")) { take(); const n = take(); if (n.k !== "id") fail("A variable needs a name after VAR."); expect("="); vars.push([n.v, expr()]); }
      if (!isId("RETURN")) fail("A VAR block must end with RETURN.");
      take();
      return { t: "var", vars, body: expr() };
    }
    return or();
  }
  const bin = (next, ops) => () => {
    let l = next();
    for (;;) {
      const t = peek();
      const op = t.k === "op" && ops.includes(t.v) ? t.v : null;
      if (!op) return l;
      take(); l = { t: "bin", op, l, r: next() };
    }
  };
  const or = () => { let l = and(); while (isOp("||")) { take(); l = { t: "bin", op: "||", l, r: and() }; } return l; };
  const and = () => { let l = not(); while (isOp("&&")) { take(); l = { t: "bin", op: "&&", l, r: not() }; } return l; };
  const not = () => {
    if (isId("NOT") && !isOp("(", 1)) { take(); return { t: "call", name: "NOT", args: [not()] }; }
    return cmp();
  };
  const cmp = () => {
    let l = concat();
    for (;;) {
      if (peek().k === "op" && ["=", "==", "<>", "<", ">", "<=", ">="].includes(peek().v)) { const op = take().v; l = { t: "bin", op, l, r: concat() }; continue; }
      if (isId("IN")) { take(); l = { t: "in", l, r: concat() }; continue; }
      if (isId("NOT") && isId("IN", 1)) { take(); take(); l = { t: "call", name: "NOT", args: [{ t: "in", l, r: concat() }] }; continue; }
      return l;
    }
  };
  const concat = bin(() => add(), ["&"]);
  const add = bin(() => mul(), ["+", "-"]);
  const mul = bin(() => unary(), ["*", "/"]);
  const unary = () => {
    if (isOp("-")) { take(); return { t: "neg", e: unary() }; }
    if (isOp("+")) { take(); return unary(); }
    return pow();
  };
  const pow = () => { const l = primary(); if (isOp("^")) { take(); return { t: "bin", op: "^", l, r: unary() }; } return l; };
  function primary() {
    const t = take();
    if (t.k === "num") return { t: "lit", v: t.v };
    if (t.k === "str") return { t: "lit", v: t.v };
    if (t.k === "bracket") return { t: "mref", name: t.v };
    if (t.k === "table") {
      if (peek().k === "bracket") return { t: "col", table: t.v, col: take().v };
      return { t: "tref", name: t.v };
    }
    if (t.k === "op" && t.v === "(") { const e = expr(); expect(")"); return e; }
    if (t.k === "op" && t.v === "{") {
      const items = [];
      if (!isOp("}")) do {
        if (isOp("(")) { take(); const tuple = [expr()]; while (isOp(",")) { take(); tuple.push(expr()); } expect(")"); items.push(tuple); }
        else items.push([expr()]);
      } while (isOp(",") && take());
      expect("}");
      return { t: "tablelit", items };
    }
    if (t.k === "id") {
      const up = t.v.toUpperCase();
      if (peek().k === "bracket" && peek().at === t.at + t.v.length) return { t: "col", table: t.v, col: take().v };
      if (isOp("(")) {
        take();
        const args = [];
        if (!isOp(")")) { do { args.push(isOp(",") || isOp(")") ? { t: "skip" } : expr()); } while (isOp(",") && take()); }
        expect(")");
        return { t: "call", name: up, args };
      }
      if (up === "TRUE") return { t: "lit", v: true };
      if (up === "FALSE") return { t: "lit", v: false };
      if (up === "BLANK") return { t: "lit", v: null };
      return { t: "name", name: t.v }; // a variable, or a table name without quotes
    }
    fail(`The syntax for '${tokText(t)}' is incorrect.`);
  }
  const e = expr();
  if (peek().k !== "end") fail(`The syntax for '${tokText(peek())}' is incorrect.`);
  return e;
}

// "Total Sales = SUM(…)" or "Total Sales := …" or just the expression.
export function parseMeasure(src) {
  const text = String(src || "").trim();
  if (!text) fail("Write a formula first.");
  const m = /^([^=()[\]"'{}]+?|\[[^\]]+\])\s*:?=(?!=)\s*([\s\S]*)$/.exec(text);
  if (m && !/^(VAR|RETURN)\b/i.test(m[1].trim()) && !/[<>&|+*\/^-]$/.test(m[1].trim())) {
    return { name: m[1].trim().replace(/^\[|\]$/g, ""), expr: parse(m[2]) };
  }
  return { name: "", expr: parse(text) };
}
export const parseExpr = (src) => parse(String(src || ""));

/* ------------------------------------------------------------------ values */
const isBlank = (v) => v === null || v === undefined;
const num = (v) => (isBlank(v) ? 0 : typeof v === "boolean" ? (v ? 1 : 0) : typeof v === "number" ? v : (() => { const n = Number(v); if (Number.isNaN(n)) fail(`Cannot convert value '${v}' of type Text to type Number.`); return n; })());
const truthy = (v) => (isBlank(v) ? false : typeof v === "boolean" ? v : typeof v === "number" ? v !== 0 : fail(`Cannot convert value '${v}' of type Text to type True/False.`));
const text = (v) => (isBlank(v) ? "" : typeof v === "boolean" ? (v ? "TRUE" : "FALSE") : String(v));
function compare(a, b) {
  if (isBlank(a) && isBlank(b)) return 0;
  if ((typeof a === "string") !== (typeof b === "string") && !isBlank(a) && !isBlank(b)) {
    const kind = (v) => (typeof v === "string" ? "Text" : typeof v === "boolean" ? "True/False" : "Number");
    fail(`DAX comparison operations do not support comparing values of type ${kind(a)} with values of type ${kind(b)}. Consider using the VALUE or FORMAT function to convert one of the values.`);
  }
  if (typeof a === "string" || typeof b === "string") {
    const x = isBlank(a) ? "" : text(a).toLowerCase(), y = isBlank(b) ? "" : text(b).toLowerCase();
    return x < y ? -1 : x > y ? 1 : 0;
  }
  const x = num(a), y = num(b);
  return x < y ? -1 : x > y ? 1 : 0;
}
const eqKey = (v) => (typeof v === "string" ? `s:${v.toLowerCase()}` : isBlank(v) ? "b" : `n:${Number(v)}`);

// A table value: rows as arrays; cols carry their lineage (model column id) when they come from the model.
// base/idx: the rows are rows of a model table (all its columns), so row context reads the model and RELATED works.
class Tbl {
  constructor(cols, rows, base = null, idx = null) { this.cols = cols; this.rows = rows; this.base = base; this.idx = idx; }
  get size() { return this.rows.length; }
}

/* ------------------------------------------------------------------ filter context */
// F = { cols: Map<colId, Set<eqKey>>, rows: Map<table, Set<rowIdx>>, rel: Map<"from>to", rel> }
const EMPTY = Object.freeze({ cols: new Map(), rows: new Map(), rel: new Map() });
const clone = (F) => ({ cols: new Map(F.cols), rows: new Map(F.rows), rel: new Map(F.rel) });
const sigCache = new WeakMap();
function sig(F) {
  let s = sigCache.get(F);
  if (s == null) {
    s = [...F.cols].map(([k, v]) => `${k}=${[...v].sort().join("|")}`).sort().join(";") + "#" +
      [...F.rows].map(([k, v]) => `${k}=${[...v].sort((a, b) => a - b).join(",")}`).sort().join(";") + "#" +
      [...F.rel].map(([k, r]) => `${k}:${r.fromId}`).sort().join(";");
    sigCache.set(F, s);
  }
  return s;
}

// sel: the grid's own filters (what ALLSELECTED goes back to); scope: the grid's row / column columns (ISINSCOPE).
class Ctx {
  constructor(model, measures, F = EMPTY, opts = {}) {
    Object.assign(this, { model, measures, F, rowCtx: [], vars: new Map(), budget: { n: 0, next: 50000, t0: Date.now(), ms: 4000 }, cache: new Map(), scope: new Set(), sel: EMPTY, depth: 0 }, opts);
  }
  with(patch) { return Object.assign(Object.create(Ctx.prototype), this, patch); }
  tick(n = 1) {
    const b = this.budget;
    b.n += n;
    if (b.n < b.next) return;
    b.next = b.n + 50000;
    if (Date.now() - b.t0 > b.ms || b.n > 3e8) fail("This formula needs too many calculations for the practice engine (it would take too long). Look for an iterator inside another iterator over a big table.");
  }
}

function activeRel(ctx, from, to, F = ctx.F) {
  return F.rel.get(`${from}>${to}`) || ctx.model.rels.find((r) => r.from === from && r.to === to && r.active);
}
// Cached per model table: every row index, and the eqKey of every value of a column.
const allRows = (t) => (t.all ||= t.data.map((_, i) => i));
const colKeys = (t, i) => ((t.keys ||= [])[i] ||= t.data.map((r) => eqKey(r[i])));
// Rows of the "many" side for each key of a relationship (built once per relationship).
function relRows(model, rel) {
  if (!rel.rows) {
    rel.rows = new Map();
    colKeys(model.tables[rel.from], rel.fromCol).forEach((k, r) => { const a = rel.rows.get(k); if (a) a.push(r); else rel.rows.set(k, [r]); });
  }
  return rel.rows;
}
// Row index of the "one" side for each key of a relationship (built once per relationship).
function relLookup(model, rel) {
  if (!rel.lookup) { rel.lookup = new Map(); model.tables[rel.to].data.forEach((r, i) => rel.lookup.set(eqKey(r[rel.toCol]), i)); }
  return rel.lookup;
}
// Rows of every table reachable many-to-one from the given rows of `table` (the rows of its expanded table).
function reach(ctx, F, table, idx, out = new Map()) {
  out.set(table, idx);
  const t = ctx.model.tables[table];
  for (const to of new Set(ctx.model.rels.filter((r) => r.from === table).map((r) => r.to))) {
    const rel = activeRel(ctx, table, to, F);
    if (!rel || out.has(to)) continue;
    const look = relLookup(ctx.model, rel), dimRows = new Set();
    for (const r of idx) { const j = look.get(eqKey(t.data[r][rel.fromCol])); if (j != null) dimRows.add(j); }
    reach(ctx, F, to, dimRows, out);
  }
  return out;
}
function hasFilter(ctx, table, seen = new Set()) {
  if (seen.has(table)) return false;
  seen.add(table);
  const t = ctx.model.tables[table];
  if (ctx.F.rows.has(table)) return true;
  for (const c of t.columns) if (ctx.F.cols.has(`${table}[${c}]`)) return true;
  for (const to of new Set(ctx.model.rels.filter((r) => r.from === table).map((r) => r.to))) {
    if (activeRel(ctx, table, to) && hasFilter(ctx, to, seen)) return true;
  }
  return false;
}
// Row indices of a model table visible in the filter context.
function visible(ctx, table) {
  const key = `${table}|${sig(ctx.F)}`;
  const hit = ctx.cache.get(key);
  if (hit) return hit;
  const t = ctx.model.tables[table];
  const rf = ctx.F.rows.get(table);
  let rows = rf ? [...rf].sort((a, b) => a - b) : null;
  const keep = (pred) => { const from = rows || allRows(t); ctx.tick(from.length); rows = from.filter(pred); };
  // filters coming from the dimensions: the key values left in each one
  const dims = [];
  for (const to of new Set(ctx.model.rels.filter((r) => r.from === table).map((r) => r.to))) {
    const rel = activeRel(ctx, table, to);
    if (!rel || !hasFilter(ctx, to)) continue;
    const dk = colKeys(ctx.model.tables[to], rel.toCol);
    dims.push([rel, new Set(visible(ctx, to).map((r) => dk[r]))]);
  }
  dims.sort((a, b) => a[1].size - b[1].size);
  if (!rows && dims.length) { // start from the rows of the most selective key values (index), not a full scan
    const [rel, keys] = dims.shift(), idx = relRows(ctx.model, rel);
    rows = [];
    for (const k of keys) { const a = idx.get(k); if (a) for (const r of a) rows.push(r); }
    rows.sort((a, b) => a - b);
    ctx.tick(rows.length + keys.size);
  }
  t.columns.forEach((c, i) => { const f = ctx.F.cols.get(`${table}[${c}]`); if (f) { const k = colKeys(t, i); keep((r) => f.has(k[r])); } });
  for (const [rel, keys] of dims) { const k = colKeys(t, rel.fromCol); keep((r) => keys.has(k[r])); }
  const out = rows || allRows(t);
  ctx.cache.set(key, out);
  return out;
}
const baseTable = (ctx, table, idx) => {
  const t = ctx.model.tables[table];
  return new Tbl(t.columns.map((c, i) => ({ name: c, lin: `${table}[${c}]`, type: t.types[i] })), idx.map((r) => t.data[r]), table, idx);
};
function distinctCol(ctx, ref, rows) {
  const t = ctx.model.tables[ref.table], seen = new Map();
  for (const r of rows) { const v = t.data[r][ref.i]; const k = eqKey(v); if (!seen.has(k)) seen.set(k, v); }
  return new Tbl([{ name: ref.name, lin: ref.id, type: ref.type }], [...seen.values()].map((v) => [v]));
}

/* ------------------------------------------------------------------ evaluation */
function resolveCol(ctx, node) {
  if (node.t === "col") return colRef(ctx.model, node.table, node.col);
  if (node.t === "mref") {
    // [Column] alone, inside a row context on a model table
    for (let k = ctx.rowCtx.length - 1; k >= 0; k--) {
      const rc = ctx.rowCtx[k];
      if (rc.tbl.base) { const t = ctx.model.tables[rc.tbl.base]; const i = t.colIndex.get(node.name.toLowerCase()); if (i != null) return colRef(ctx.model, t.name, t.columns[i]); }
    }
  }
  fail("A column reference (Table[Column]) is expected here.");
}
// Value of a column in the innermost row context that has it.
function rowValue(ctx, ref, earlier = 0) {
  let skip = earlier;
  for (let k = ctx.rowCtx.length - 1; k >= 0; k--) {
    const rc = ctx.rowCtx[k];
    const j = rc.tbl.cols.findIndex((c) => c.lin === ref.id);
    if (j >= 0) { if (skip-- > 0) continue; return rc.tbl.rows[rc.i][j]; }
  }
  return undefined;
}

function ev(node, ctx) {
  switch (node.t) {
    case "lit": return node.v;
    case "skip": return null;
    case "var": {
      const vars = new Map(ctx.vars);
      let c = ctx.with({ vars });
      for (const [n, e] of node.vars) { vars.set(n.toLowerCase(), isTableExpr(e, c) ? table(e, c) : ev(e, c)); c = ctx.with({ vars: new Map(vars) }); }
      return ev(node.body, c);
    }
    case "name": {
      const k = node.name.toLowerCase();
      if (ctx.vars.has(k)) {
        const v = ctx.vars.get(k);
        if (!(v instanceof Tbl)) return v;
        if (!v.size) return null;
        if (v.size > 1 || v.cols.length > 1) fail("A table of multiple values was supplied where a single value was expected.");
        return v.rows[0][0];
      }
      if (ctx.model.tableByLower.has(k)) fail(`The table '${node.name}' can't be used as a single value. Use it inside a function such as COUNTROWS or SUMX.`);
      fail(`Failed to resolve name '${node.name}'. It is not a valid table, variable, or function name.`);
    }
    case "col": {
      const ref = colRef(ctx.model, node.table, node.col);
      const v = rowValue(ctx, ref);
      if (v === undefined) fail(`A single value for column '${ref.name}' in table '${ref.table}' cannot be determined. This can happen when a measure formula refers to a column that contains many values without specifying an aggregation such as min, max, count, or sum to get a single result.`);
      return v;
    }
    case "mref": {
      // a column added by ADDCOLUMNS / SUMMARIZE in the current row context, else a measure
      for (let k = ctx.rowCtx.length - 1; k >= 0; k--) {
        const rc = ctx.rowCtx[k], j = rc.tbl.cols.findIndex((c) => !c.lin && c.name.toLowerCase() === node.name.toLowerCase());
        if (j >= 0) return rc.tbl.rows[rc.i][j];
      }
      const m = Object.entries(ctx.measures).find(([n]) => n.toLowerCase() === node.name.toLowerCase());
      if (!m) {
        for (let k = ctx.rowCtx.length - 1; k >= 0; k--) {
          const rc = ctx.rowCtx[k];
          if (rc.tbl.base && ctx.model.tables[rc.tbl.base].colIndex.has(node.name.toLowerCase())) return ev({ t: "col", table: rc.tbl.base, col: node.name }, ctx);
        }
        fail(`The measure [${node.name}] cannot be found. Check its name, or define it first.`);
      }
      if (ctx.depth > 30) fail(`The measure [${node.name}] refers to itself.`);
      return calculate(ctx.with({ depth: ctx.depth + 1 }), m[1], []);
    }
    case "tref": case "tablelit": fail("A table expression can't be used where a single value is expected.");
    case "neg": { const v = ev(node.e, ctx); return isBlank(v) ? null : -num(v); }
    case "in": {
      const v = ev(node.l, ctx), tb = table(node.r, ctx);
      return tb.rows.some((r) => compare(r[0], v) === 0);
    }
    case "bin": return binop(node.op, node.l, node.r, ctx);
    case "call": return call(node, ctx);
  }
  fail("Unexpected expression.");
}
function binop(op, ln, rn, ctx) {
  if (op === "&&") return truthy(ev(ln, ctx)) && truthy(ev(rn, ctx));
  if (op === "||") return truthy(ev(ln, ctx)) || truthy(ev(rn, ctx));
  const a = ev(ln, ctx), b = ev(rn, ctx);
  switch (op) {
    case "+": return isBlank(a) && isBlank(b) ? null : num(a) + num(b);
    case "-": return isBlank(a) && isBlank(b) ? null : num(a) - num(b);
    case "*": return isBlank(a) || isBlank(b) ? null : num(a) * num(b);
    case "/": {
      if (isBlank(a) && isBlank(b)) return null;
      const d = num(b);
      if (d === 0) return isBlank(a) || num(a) === 0 ? Number.NaN : num(a) > 0 ? Infinity : -Infinity;
      return isBlank(a) ? null : num(a) / d;
    }
    case "^": return isBlank(a) ? null : Math.pow(num(a), num(b));
    case "&": return text(a) + text(b);
    case "=": return compare(a, b) === 0;
    case "==": return isBlank(a) || isBlank(b) ? isBlank(a) && isBlank(b) : compare(a, b) === 0;
    case "<>": return compare(a, b) !== 0;
    case "<": return compare(a, b) < 0;
    case ">": return compare(a, b) > 0;
    case "<=": return compare(a, b) <= 0;
    case ">=": return compare(a, b) >= 0;
  }
  fail(`Unknown operator ${op}`);
}

// Evaluates a table expression.
function table(node, ctx) {
  if (node.t === "_tbl") return node.v; // SUMMARIZE hands its grouped table to ADDCOLUMNS this way
  if (node.t === "tref" || (node.t === "name" && !ctx.vars.has(node.name.toLowerCase()))) {
    const t = tableOf(ctx.model, node.name);
    return baseTable(ctx, t.name, visible(ctx, t.name));
  }
  if (node.t === "name") { const v = ctx.vars.get(node.name.toLowerCase()); if (v instanceof Tbl) return v; fail(`The variable ${node.name} is not a table.`); }
  if (node.t === "tablelit") {
    const n = Math.max(...node.items.map((r) => r.length));
    return new Tbl(Array.from({ length: n }, (_, i) => ({ name: i ? `Value${i + 1}` : "Value", lin: null })), node.items.map((r) => r.map((e) => ev(e, ctx))));
  }
  if (node.t === "col") fail("A column reference can't be used as a table here: wrap it in VALUES() or ALL().");
  if (node.t === "call") {
    const f = TABLE_FUNCS[node.name];
    if (f) return f(node.args, ctx);
    fail(`The function ${node.name} does not return a table, or is not available in the practice engine.`);
  }
  fail("A table expression is expected here.");
}

/* ---------- CALCULATE */
// Turns a CALCULATE filter argument into operations, evaluated in the outer context.
function filterOps(arg, ctx) {
  if (arg.t === "skip") return [];
  if (arg.t === "call") {
    const n = arg.name;
    if (n === "ALL" || n === "REMOVEFILTERS" || n === "ALLNOBLANKROW") return [removal(arg.args, ctx)];
    if (n === "ALLSELECTED") { const o = removal(arg.args, ctx); return [{ ...o, op: o.op.replace(/^all/, "sel") }]; }
    if (n === "ALLEXCEPT") return [{ op: "allexcept", table: tableOf(ctx.model, tableName(arg.args[0])).name, keep: arg.args.slice(1).map((a) => resolveCol(ctx, a).id) }];
    if (n === "USERELATIONSHIP") {
      const a = resolveCol(ctx, arg.args[0]), b = resolveCol(ctx, arg.args[1]);
      const rel = ctx.model.rels.find((r) => (r.fromId === a.id && r.toId === b.id) || (r.fromId === b.id && r.toId === a.id));
      if (!rel) fail(`USERELATIONSHIP: there is no relationship between ${a.id} and ${b.id}.`);
      return [{ op: "userel", rel }];
    }
    if (n === "CROSSFILTER") fail("CROSSFILTER is not available in the practice engine (relationships here filter one way).");
    if (n === "KEEPFILTERS") return filterOps(arg.args[0], ctx).map((o) => ({ ...o, keep: true }));
  }
  if (isTableExpr(arg, ctx)) return [tableFilter(table(arg, ctx), ctx)];
  // A boolean condition: FILTER(ALL(column), condition) on the column(s) it uses, all from one table.
  if (usesMeasure(arg, ctx)) fail("A function 'CALCULATE' has been used in a True/False expression that is used as a table filter expression. This is not allowed: use FILTER(), for example FILTER(VALUES(Product[Product]), [Total Sales] > 1000).");
  const cols = [...new Map(columnsIn(arg, ctx).map((c) => [c.id, c])).values()];
  if (!cols.length) fail("A filter argument must use a column, for example Product[Color] = \"Blue\".");
  const tables = new Set(cols.map((c) => c.table));
  if (tables.size > 1) fail("A filter condition can only use columns of one table. Use FILTER() for conditions across tables.");
  if (cols.length === 1) {
    const ref = cols[0], all = distinctCol(ctx, ref, ctx.model.tables[ref.table].data.map((_, i) => i));
    const keep = new Set();
    all.rows.forEach((r, i) => { if (truthy(ev(arg, ctx.with({ rowCtx: [...ctx.rowCtx, { tbl: all, i }] })))) keep.add(eqKey(r[0])); });
    return [{ op: "cols", cols: [ref.id], sets: [keep] }];
  }
  const tName = cols[0].table, t = ctx.model.tables[tName], all = baseTable(ctx, tName, t.data.map((_, i) => i));
  const idx = new Set();
  all.rows.forEach((_, i) => { if (truthy(ev(arg, ctx.with({ rowCtx: [...ctx.rowCtx, { tbl: all, i }] })))) idx.add(i); });
  return [{ op: "rows", table: tName, idx, cols: cols.map((c) => c.id) }];
}
function removal(args, ctx) {
  if (!args.length || args[0].t === "skip") return { op: "allall" };
  const a0 = args[0];
  if (a0.t === "tref" || a0.t === "name") return { op: "alltable", table: tableOf(ctx.model, a0.name).name };
  return { op: "allcols", cols: args.map((a) => resolveCol(ctx, a).id) };
}
function tableFilter(tb, ctx) {
  if (tb.base) return { op: "rows", table: tb.base, idx: new Set(tb.idx), base: true };
  const cols = tb.cols.map((c, i) => [c.lin, i]).filter(([lin]) => lin);
  if (!cols.length) fail("This table can't be used as a filter: its columns don't come from the model.");
  const tables = new Set(cols.map(([lin]) => parseCol(lin).table));
  if (cols.length > 1 && tables.size === 1) {
    const tName = [...tables][0], t = ctx.model.tables[tName];
    const refs = cols.map(([lin]) => colRef(ctx.model, tName, parseCol(lin).col));
    const tuples = new Set(tb.rows.map((r) => cols.map(([, i]) => eqKey(r[i])).join("|")));
    const idx = new Set();
    t.data.forEach((r, k) => { if (tuples.has(refs.map((ref) => eqKey(r[ref.i])).join("|"))) idx.add(k); });
    return { op: "rows", table: tName, idx, cols: refs.map((r) => r.id) };
  }
  return { op: "cols", cols: cols.map(([lin]) => lin), sets: cols.map(([, i]) => new Set(tb.rows.map((r) => eqKey(r[i])))) };
}
function applyOps(ctx, ops) {
  const F = clone(ctx.F), model = ctx.model;
  const dropTable = (tn) => { const t = model.tables[tn]; for (const c of t.columns) F.cols.delete(`${tn}[${c}]`); F.rows.delete(tn); };
  for (const o of ops.filter((x) => x.op === "userel")) {
    for (const r of model.rels) if (r.from === o.rel.from && r.to === o.rel.to) F.rel.set(`${r.from}>${r.to}`, o.rel);
  }
  for (const o of ops) {
    if (o.op === "allall") { F.cols.clear(); F.rows.clear(); }
    else if (o.op === "alltable") for (const tn of expanded(model, o.table)) dropTable(tn);
    else if (o.op === "allcols") for (const c of o.cols) F.cols.delete(c);
    else if (o.op === "selall") { F.cols = new Map(ctx.sel.cols); F.rows = new Map(ctx.sel.rows); }
    else if (o.op === "seltable") for (const tn of expanded(model, o.table)) {
      dropTable(tn);
      for (const c of model.tables[tn].columns) { const id = `${tn}[${c}]`; if (ctx.sel.cols.has(id)) F.cols.set(id, ctx.sel.cols.get(id)); }
    }
    else if (o.op === "selcols") for (const c of o.cols) { if (ctx.sel.cols.has(c)) F.cols.set(c, ctx.sel.cols.get(c)); else F.cols.delete(c); }
    else if (o.op === "allexcept") {
      for (const tn of expanded(model, o.table)) {
        for (const c of model.tables[tn].columns) { const id = `${tn}[${c}]`; if (!o.keep.includes(id)) F.cols.delete(id); }
        if (!o.keep.some((k) => k.startsWith(`${tn}[`))) F.rows.delete(tn);
      }
    }
  }
  const setRows = (tn, idx, keep) => { const prev = F.rows.get(tn); F.rows.set(tn, keep && prev ? new Set([...idx].filter((k) => prev.has(k))) : idx); };
  for (const o of ops) {
    if (o.op === "cols") o.cols.forEach((c, i) => {
      // A filter on the date column of the date table removes every other filter on that table ("Mark as date table").
      const ref = parseCol(c), dt = model.tables[ref.table];
      if (!o.keep && dt.dateTable && dt.key === ref.col) dropTable(dt.name);
      const prev = F.cols.get(c);
      F.cols.set(c, o.keep && prev ? new Set([...o.sets[i]].filter((k) => prev.has(k))) : o.sets[i]);
    });
    else if (o.op === "rows" && o.base) {
      // Rows of a model table filter its expanded table: the table itself and the dimension rows they point to.
      for (const [tn, idx] of reach(ctx, F, o.table, o.idx)) { if (!o.keep) dropTable(tn); setRows(tn, idx, o.keep); }
    } else if (o.op === "rows") {
      if (!o.keep) for (const c of o.cols) F.cols.delete(c);
      setRows(o.table, o.idx, o.keep);
    }
  }
  return F;
}
// Row contexts become filters (context transition).
function transition(ctx) {
  const ops = [];
  for (const rc of ctx.rowCtx) {
    if (rc.tbl.base) ops.push({ op: "rows", table: rc.tbl.base, idx: new Set([rc.tbl.idx[rc.i]]), base: true });
    else rc.tbl.cols.forEach((c, j) => { if (c.lin) ops.push({ op: "cols", cols: [c.lin], sets: [new Set([eqKey(rc.tbl.rows[rc.i][j])])] }); });
  }
  return ops;
}
function calculate(ctx, exprNode, args) {
  const ops = args.flatMap((a) => filterOps(a, ctx)); // evaluated in the outer context
  let F = ctx.rowCtx.length ? applyOps(ctx, transition(ctx)) : ctx.F;
  F = applyOps(ctx.with({ F }), ops);
  return ev(exprNode, ctx.with({ F, rowCtx: [] }));
}
function calculateTable(ctx, tableNode, args) {
  const ops = args.flatMap((a) => filterOps(a, ctx));
  let F = ctx.rowCtx.length ? applyOps(ctx, transition(ctx)) : ctx.F;
  F = applyOps(ctx.with({ F }), ops);
  return table(tableNode, ctx.with({ F, rowCtx: [] }));
}

function isTableExpr(node, ctx) {
  if (node.t === "tref" || node.t === "tablelit") return true;
  if (node.t === "name") return !ctx.vars.has(node.name.toLowerCase()) ? ctx.model.tableByLower.has(node.name.toLowerCase()) : ctx.vars.get(node.name.toLowerCase()) instanceof Tbl;
  return node.t === "call" && !!TABLE_FUNCS[node.name] && !(node.name in SCALAR_FUNCS);
}
function columnsIn(node, ctx, out = []) {
  if (!node || typeof node !== "object") return out;
  if (node.t === "col") out.push(colRef(ctx.model, node.table, node.col));
  for (const v of Object.values(node)) if (Array.isArray(v)) v.forEach((x) => (Array.isArray(x) ? x.forEach((y) => columnsIn(y, ctx, out)) : columnsIn(x, ctx, out))); else if (v && typeof v === "object" && v.t) columnsIn(v, ctx, out);
  return out;
}
function usesMeasure(node, ctx) {
  if (!node || typeof node !== "object") return false;
  if (node.t === "mref" && Object.keys(ctx.measures).some((n) => n.toLowerCase() === node.name.toLowerCase())) return true;
  if (node.t === "call" && node.name === "CALCULATE") return true;
  return Object.values(node).some((v) => (Array.isArray(v) ? v.some((x) => (Array.isArray(x) ? x.some((y) => usesMeasure(y, ctx)) : usesMeasure(x, ctx))) : v && typeof v === "object" && v.t && usesMeasure(v, ctx)));
}
const tableName = (node) => (node.t === "tref" || node.t === "name" ? node.name : fail("A table name is expected here."));

/* ---------- iterators */
function iterate(tb, ctx, fn) {
  ctx.tick(tb.size);
  for (let i = 0; i < tb.size; i++) fn(ctx.with({ rowCtx: [...ctx.rowCtx, { tbl: tb, i }] }), i);
}
function xagg(args, ctx, kind) {
  const tb = table(args[0], ctx), vals = [];
  iterate(tb, ctx, (c) => { const v = ev(args[1], c); if (!isBlank(v)) vals.push(v); });
  return aggregate(vals, kind);
}
function aggregate(vals, kind) {
  if (kind === "countx") return vals.length ? vals.length : null;
  const nums = vals.filter((v) => typeof v === "number" || typeof v === "boolean").map(num);
  if (!nums.length) return kind === "minx" || kind === "maxx" ? (vals.length ? vals.reduce((a, b) => (kind === "minx" ? (compare(a, b) <= 0 ? a : b) : (compare(a, b) >= 0 ? a : b))) : null) : null;
  if (kind === "sumx") return nums.reduce((a, b) => a + b, 0);
  if (kind === "averagex") return nums.reduce((a, b) => a + b, 0) / nums.length;
  if (kind === "minx") return Math.min(...nums);
  if (kind === "maxx") return Math.max(...nums);
  if (kind === "medianx") { const s = [...nums].sort((a, b) => a - b), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; }
  fail(`Unknown aggregation ${kind}`);
}
function columnValues(args, ctx) {
  const ref = resolveCol(ctx, args[0]);
  const t = ctx.model.tables[ref.table];
  return visible(ctx, ref.table).map((r) => t.data[r][ref.i]);
}

/* ---------- time intelligence: tables of dates (Date[Date] lineage) */
function datesOf(arg, ctx) {
  const tb = arg.t === "col" ? (() => { const ref = resolveCol(ctx, arg); return distinctCol(ctx, ref, visible(ctx, ref.table)); })() : table(arg, ctx);
  const j = tb.cols.findIndex((c) => c.lin);
  if (j < 0) fail("Time intelligence functions need a column of dates, for example 'Date'[Date].");
  return { lin: tb.cols[j].lin, dates: tb.rows.map((r) => r[j]).filter((v) => !isBlank(v)).sort((a, b) => a - b) };
}
function allDates(ctx, lin) { const ref = parseCol(lin), c = colRef(ctx.model, ref.table, ref.col); return ctx.model.tables[c.table].data.map((r) => r[c.i]); }
const dateTable = (lin, dates) => new Tbl([{ name: parseCol(lin).col, lin, type: "date" }], [...new Set(dates)].sort((a, b) => a - b).map((d) => [d]));
function shift(serial, n, unit) {
  const [y, m, d] = ymd(serial);
  if (unit === "DAY") return serial + n;
  const months = unit === "YEAR" ? 12 * n : unit === "QUARTER" ? 3 * n : n;
  const ty = y + Math.floor((m - 1 + months) / 12), tm = ((m - 1 + months) % 12 + 12) % 12 + 1;
  const last = new Date(Date.UTC(ty, tm, 0)).getUTCDate();
  return serialOf(ty, tm, Math.min(d, last));
}
// DATEADD / SAMEPERIODLASTYEAR: a continuous range moves as a range, and a range ending on the last day of a month ends
// on the last day of the target month (February 2025 -> 1-29 February 2024), like DAX; other selections move date by date.
function shiftDates(ctx, arg, n, unit) {
  const { lin, dates } = datesOf(arg, ctx), all = allDates(ctx, lin), have = new Set(all);
  if (!dates.length) return dateTable(lin, []);
  const lo = dates[0], hi = dates[dates.length - 1];
  if (unit !== "DAY" && hi - lo + 1 === dates.length) {
    const start = shift(lo, n, unit), [y, m, d] = ymd(hi), monthEnd = d === new Date(Date.UTC(y, m, 0)).getUTCDate();
    let end = shift(hi, n, unit);
    if (monthEnd) { const [ey, em] = ymd(end); end = serialOf(ey, em + 1, 0); }
    return dateTable(lin, all.filter((x) => x >= start && x <= end));
  }
  return dateTable(lin, dates.map((x) => shift(x, n, unit)).filter((x) => have.has(x)));
}
function toDate(ctx, args) {
  const { lin, dates } = datesOf(args[0], ctx);
  if (!dates.length) return { lin, dates, last: null };
  return { lin, dates, last: dates[dates.length - 1], first: dates[0] };
}
function periodToDate(ctx, args, unit) {
  const { lin, last } = toDate(ctx, args);
  if (last == null) return dateTable(lin, []);
  const [y, m] = ymd(last);
  const start = unit === "YEAR" ? serialOf(y, 1, 1) : unit === "QUARTER" ? serialOf(y, 3 * Math.floor((m - 1) / 3) + 1, 1) : serialOf(y, m, 1);
  return dateTable(lin, allDates(ctx, lin).filter((d) => d >= start && d <= last));
}
const UNIT = (node, ctx) => { const v = node.t === "name" ? node.name : text(ev(node, ctx)); const u = String(v).toUpperCase(); if (!["DAY", "MONTH", "QUARTER", "YEAR"].includes(u)) fail(`The interval '${v}' is not valid: use DAY, MONTH, QUARTER or YEAR.`); return u; };

/* ------------------------------------------------------------------ functions */
const TABLE_FUNCS = {
  FILTER: (a, ctx) => {
    const tb = table(a[0], ctx), keep = [];
    iterate(tb, ctx, (c, i) => { if (truthy(ev(a[1], c))) keep.push(i); });
    return new Tbl(tb.cols, keep.map((i) => tb.rows[i]), tb.base, tb.base ? keep.map((i) => tb.idx[i]) : null);
  },
  ALL: (a, ctx) => {
    if (!a.length) fail("ALL() without arguments can only be used as a CALCULATE filter.");
    if (a[0].t === "tref" || a[0].t === "name") { const t = tableOf(ctx.model, a[0].name); return baseTable(ctx, t.name, t.data.map((_, i) => i)); }
    const refs = a.map((x) => resolveCol(ctx, x)), t = ctx.model.tables[refs[0].table], seen = new Map();
    for (const r of t.data) { const vals = refs.map((ref) => r[ref.i]); const k = vals.map(eqKey).join("|"); if (!seen.has(k)) seen.set(k, vals); }
    return new Tbl(refs.map((ref) => ({ name: ref.name, lin: ref.id, type: ref.type })), [...seen.values()]);
  },
  ALLSELECTED: (a, ctx) => {
    if (!a.length) fail("ALLSELECTED() without arguments can only be used as a CALCULATE filter.");
    const c = ctx.with({ F: ctx.sel });
    if (a[0].t === "tref" || a[0].t === "name") { const t = tableOf(ctx.model, a[0].name); return baseTable(c, t.name, visible(c, t.name)); }
    const ref = resolveCol(ctx, a[0]); return distinctCol(c, ref, visible(c, ref.table));
  },
  VALUES: (a, ctx) => {
    if (a[0].t === "tref" || a[0].t === "name") { const t = tableOf(ctx.model, a[0].name); return baseTable(ctx, t.name, visible(ctx, t.name)); }
    const ref = resolveCol(ctx, a[0]); return distinctCol(ctx, ref, visible(ctx, ref.table));
  },
  CALCULATETABLE: (a, ctx) => calculateTable(ctx, a[0], a.slice(1)),
  RELATEDTABLE: (a, ctx) => calculateTable(ctx, a[0], []),
  TOPN: (a, ctx) => {
    const n = num(ev(a[0], ctx)), tb = table(a[1], ctx);
    const keys = []; iterate(tb, ctx, (c, i) => keys.push([i, a[2] ? ev(a[2], c) : 0]));
    const desc = !a[3] || a[3].t === "skip" || /^(DESC|0|FALSE)$/i.test(orderWord(a[3], ctx));
    keys.sort((x, y) => (desc ? -1 : 1) * compare(x[1], y[1]));
    if (n <= 0 || !keys.length) return new Tbl(tb.cols, [], tb.base, tb.base ? [] : null);
    const cut = keys[Math.min(n, keys.length) - 1][1];
    const pick = keys.filter((k, i) => i < n || compare(k[1], cut) === 0).map((k) => k[0]); // ties at the cut are kept, like DAX
    return new Tbl(tb.cols, pick.map((i) => tb.rows[i]), tb.base, tb.base ? pick.map((i) => tb.idx[i]) : null);
  },
  ADDCOLUMNS: (a, ctx) => {
    const tb = table(a[0], ctx), names = [], exprs = [];
    for (let k = 1; k + 1 < a.length; k += 2) { names.push(text(ev(a[k], ctx))); exprs.push(a[k + 1]); }
    const rows = tb.rows.map((r) => [...r]);
    iterate(tb, ctx, (c, i) => exprs.forEach((e) => rows[i].push(ev(e, c))));
    return new Tbl([...tb.cols, ...names.map((n) => ({ name: n, lin: null }))], rows, tb.base, tb.idx);
  },
  SELECTCOLUMNS: (a, ctx) => {
    const tb = table(a[0], ctx), cols = [], exprs = [];
    for (let k = 1; k + 1 < a.length; k += 2) { const nm = text(ev(a[k], ctx)); const lin = a[k + 1].t === "col" ? colRef(ctx.model, a[k + 1].table, a[k + 1].col).id : null; cols.push({ name: nm, lin }); exprs.push(a[k + 1]); }
    const rows = []; iterate(tb, ctx, (c) => rows.push(exprs.map((e) => ev(e, c))));
    return new Tbl(cols, rows);
  },
  SUMMARIZE: (a, ctx) => {
    const tb = table(a[0], ctx), groups = [];
    let k = 1;
    while (k < a.length && a[k].t === "col") groups.push(colRef(ctx.model, a[k].table, a[k].col)), k++;
    const seen = new Map();
    iterate(tb, ctx, (c, i) => {
      const vals = groups.map((g) => (g.table === tb.base ? tb.rows[i][g.i] : related(c, g)));
      const key = vals.map(eqKey).join("|"); if (!seen.has(key)) seen.set(key, vals);
    });
    let out = new Tbl(groups.map((g) => ({ name: g.name, lin: g.id, type: g.type })), [...seen.values()]);
    if (k < a.length) out = TABLE_FUNCS.ADDCOLUMNS([{ t: "_tbl", v: out }, ...a.slice(k)], ctx);
    return out;
  },
  DISTINCT: (a, ctx) => TABLE_FUNCS.VALUES(a, ctx),
  CROSSJOIN: (a, ctx) => {
    const ts = a.map((x) => table(x, ctx));
    let rows = [[]];
    for (const tb of ts) rows = rows.flatMap((r) => tb.rows.map((x) => [...r, ...x]));
    return new Tbl(ts.flatMap((tb) => tb.cols), rows);
  },
  TREATAS: (a, ctx) => {
    const tb = table(a[0], ctx), refs = a.slice(1).map((x) => resolveCol(ctx, x));
    return new Tbl(refs.map((r) => ({ name: r.name, lin: r.id, type: r.type })), tb.rows.map((r) => refs.map((_, i) => r[i])));
  },
  DATESYTD: (a, ctx) => periodToDate(ctx, a, "YEAR"),
  DATESQTD: (a, ctx) => periodToDate(ctx, a, "QUARTER"),
  DATESMTD: (a, ctx) => periodToDate(ctx, a, "MONTH"),
  SAMEPERIODLASTYEAR: (a, ctx) => shiftDates(ctx, a[0], -1, "YEAR"),
  DATEADD: (a, ctx) => shiftDates(ctx, a[0], num(ev(a[1], ctx)), UNIT(a[2], ctx)),
  PARALLELPERIOD: (a, ctx) => {
    const { lin, dates } = datesOf(a[0], ctx), n = num(ev(a[1], ctx)), u = UNIT(a[2], ctx);
    if (!dates.length) return dateTable(lin, []);
    const lo = shift(dates[0], n, u), hi = shift(dates[dates.length - 1], n, u);
    const [ly, lm] = ymd(lo), [hy, hm] = ymd(hi);
    const start = u === "YEAR" ? serialOf(ly, 1, 1) : u === "QUARTER" ? serialOf(ly, 3 * Math.floor((lm - 1) / 3) + 1, 1) : serialOf(ly, lm, 1);
    const end = u === "YEAR" ? serialOf(hy, 12, 31) : u === "QUARTER" ? serialOf(hy, 3 * Math.floor((hm - 1) / 3) + 4, 0) : serialOf(hy, hm + 1, 0);
    return dateTable(lin, allDates(ctx, lin).filter((d) => d >= start && d <= end));
  },
  PREVIOUSYEAR: (a, ctx) => { const { lin, first } = toDate(ctx, a); if (first == null) return dateTable(lin, []); const y = ymd(first)[0] - 1; return dateTable(lin, allDates(ctx, lin).filter((d) => ymd(d)[0] === y)); },
  PREVIOUSMONTH: (a, ctx) => { const { lin, first } = toDate(ctx, a); if (first == null) return dateTable(lin, []); const p = shift(first, -1, "MONTH"), [y, m] = ymd(p); return dateTable(lin, allDates(ctx, lin).filter((d) => { const [yy, mm] = ymd(d); return yy === y && mm === m; })); },
  DATESINPERIOD: (a, ctx) => {
    const { lin } = datesOf(a[0], ctx), start = num(ev(a[1], ctx)), n = num(ev(a[2], ctx)), u = UNIT(a[3], ctx);
    let other = shift(start, n, u);
    // from the last day of a month, the period ends on the last day of the target month (30 April, -3 months -> 1 February)
    if (u !== "DAY") { const [y, m, d] = ymd(start); if (d === new Date(Date.UTC(y, m, 0)).getUTCDate()) { const [oy, om] = ymd(other); other = serialOf(oy, om + 1, 0); } }
    const [lo, hi] = n < 0 ? [other + 1, start] : [start, other - 1];
    return dateTable(lin, allDates(ctx, lin).filter((d) => d >= lo && d <= hi));
  },
  DATESBETWEEN: (a, ctx) => {
    const { lin } = datesOf(a[0], ctx), lo = ev(a[1], ctx), hi = ev(a[2], ctx);
    return dateTable(lin, allDates(ctx, lin).filter((d) => (isBlank(lo) || d >= lo) && (isBlank(hi) || d <= hi)));
  },
  FIRSTDATE: (a, ctx) => { const { lin, dates } = datesOf(a[0], ctx); return dateTable(lin, dates.slice(0, 1)); },
  LASTDATE: (a, ctx) => { const { lin, dates } = datesOf(a[0], ctx); return dateTable(lin, dates.slice(-1)); },
};
const orderWord = (node, ctx) => (node.t === "name" ? node.name : text(ev(node, ctx)));
// RELATED(column) from the row context: follows many-to-one relationships from the row's table.
function related(ctx, ref) {
  for (let k = ctx.rowCtx.length - 1; k >= 0; k--) {
    const rc = ctx.rowCtx[k];
    if (!rc.tbl.base) { const j = rc.tbl.cols.findIndex((c) => c.lin === ref.id); if (j >= 0) return rc.tbl.rows[rc.i][j]; continue; }
    if (rc.tbl.base === ref.table) return rc.tbl.rows[rc.i][ref.i];
    const path = findPath(ctx, rc.tbl.base, ref.table);
    if (!path) continue;
    let tName = rc.tbl.base, row = ctx.model.tables[tName].data[rc.tbl.idx[rc.i]];
    for (const rel of path) {
      const dim = ctx.model.tables[rel.to], key = eqKey(row[rel.fromCol]);
      row = dim.data.find((r) => eqKey(r[rel.toCol]) === key);
      if (!row) return null;
      tName = rel.to;
    }
    return row[ref.i];
  }
  fail(`The column '${ref.id}' either doesn't exist or doesn't have a relationship to any table available in the current context.`);
}
function findPath(ctx, from, to, seen = new Set()) {
  if (from === to) return [];
  seen.add(from);
  for (const r of ctx.model.rels) {
    if (r.from !== from || seen.has(r.to)) continue;
    const rel = activeRel(ctx, r.from, r.to);
    if (rel !== r) continue;
    const rest = findPath(ctx, r.to, to, seen);
    if (rest) return [r, ...rest];
  }
  return null;
}

const SCALAR_FUNCS = {
  SUM: (a, ctx) => aggregate(columnValues(a, ctx), "sumx"),
  AVERAGE: (a, ctx) => aggregate(columnValues(a, ctx), "averagex"),
  MIN: (a, ctx) => (a.length === 2 ? (() => { const x = ev(a[0], ctx), y = ev(a[1], ctx); return isBlank(x) ? y : isBlank(y) ? x : compare(x, y) <= 0 ? x : y; })() : aggregate(columnValues(a, ctx), "minx")),
  MAX: (a, ctx) => (a.length === 2 ? (() => { const x = ev(a[0], ctx), y = ev(a[1], ctx); return isBlank(x) ? y : isBlank(y) ? x : compare(x, y) >= 0 ? x : y; })() : aggregate(columnValues(a, ctx), "maxx")),
  MEDIAN: (a, ctx) => aggregate(columnValues(a, ctx), "medianx"),
  COUNT: (a, ctx) => { const n = columnValues(a, ctx).filter((v) => !isBlank(v) && typeof v !== "string").length; return n || null; },
  COUNTA: (a, ctx) => { const n = columnValues(a, ctx).filter((v) => !isBlank(v)).length; return n || null; },
  COUNTBLANK: (a, ctx) => { const n = columnValues(a, ctx).filter((v) => isBlank(v) || v === "").length; return n || null; },
  DISTINCTCOUNT: (a, ctx) => { const n = new Set(columnValues(a, ctx).map(eqKey)).size; return n || null; },
  COUNTROWS: (a, ctx) => { const n = table(a[0], ctx).size; return n || null; },
  SUMX: (a, ctx) => xagg(a, ctx, "sumx"), AVERAGEX: (a, ctx) => xagg(a, ctx, "averagex"),
  MINX: (a, ctx) => xagg(a, ctx, "minx"), MAXX: (a, ctx) => xagg(a, ctx, "maxx"),
  COUNTX: (a, ctx) => xagg(a, ctx, "countx"), MEDIANX: (a, ctx) => xagg(a, ctx, "medianx"),
  CONCATENATEX: (a, ctx) => {
    const tb = table(a[0], ctx), parts = [];
    iterate(tb, ctx, (c) => parts.push([text(ev(a[1], c)), a[3] ? ev(a[3], c) : null]));
    if (a[3]) { const desc = a[4] && /^(DESC|0|FALSE)$/i.test(orderWord(a[4], ctx)); parts.sort((x, y) => (desc ? -1 : 1) * compare(x[1], y[1])); }
    return parts.map((p) => p[0]).join(a[2] ? text(ev(a[2], ctx)) : "");
  },
  CALCULATE: (a, ctx) => calculate(ctx, a[0], a.slice(1)),
  RELATED: (a, ctx) => related(ctx, resolveCol(ctx, a[0])),
  RANKX: (a, ctx) => {
    const tb = table(a[0], ctx), vals = [];
    iterate(tb, ctx, (c) => vals.push(ev(a[1], c)));
    const v = a[2] && a[2].t !== "skip" ? ev(a[2], ctx) : ev(a[1], ctx);
    const asc = a[3] && a[3].t !== "skip" && /^(ASC|1|TRUE)$/i.test(orderWord(a[3], ctx));
    const dense = a[4] && /^DENSE$/i.test(orderWord(a[4], ctx));
    const better = (x) => (asc ? compare(x, v) < 0 : compare(x, v) > 0);
    if (dense) return new Set(vals.filter(better).map(eqKey)).size + 1;
    return vals.filter(better).length + 1;
  },
  DIVIDE: (a, ctx) => {
    const x = ev(a[0], ctx), y = ev(a[1], ctx), alt = a[2] ? ev(a[2], ctx) : null;
    if (isBlank(y) || num(y) === 0) return alt;
    return isBlank(x) ? null : num(x) / num(y);
  },
  IF: (a, ctx) => (truthy(ev(a[0], ctx)) ? ev(a[1], ctx) : a[2] ? ev(a[2], ctx) : null),
  "IF.EAGER": (a, ctx) => SCALAR_FUNCS.IF(a, ctx),
  SWITCH: (a, ctx) => {
    const v = ev(a[0], ctx);
    let k = 1;
    for (; k + 1 < a.length; k += 2) { const w = ev(a[k], ctx); if (v === true ? truthy(w) : compare(v, w) === 0 && isBlank(v) === isBlank(w)) return ev(a[k + 1], ctx); }
    return k < a.length ? ev(a[k], ctx) : null;
  },
  AND: (a, ctx) => truthy(ev(a[0], ctx)) && truthy(ev(a[1], ctx)),
  OR: (a, ctx) => truthy(ev(a[0], ctx)) || truthy(ev(a[1], ctx)),
  NOT: (a, ctx) => !truthy(ev(a[0], ctx)),
  TRUE: () => true, FALSE: () => false, BLANK: () => null,
  ISBLANK: (a, ctx) => isBlank(ev(a[0], ctx)),
  COALESCE: (a, ctx) => { for (const x of a) { const v = ev(x, ctx); if (!isBlank(v)) return v; } return null; },
  ISERROR: (a, ctx) => { try { const v = ev(a[0], ctx); return typeof v === "number" && !Number.isFinite(v); } catch (e) { if (e instanceof DaxError) return true; throw e; } },
  IFERROR: (a, ctx) => { try { const v = ev(a[0], ctx); return typeof v === "number" && !Number.isFinite(v) ? ev(a[1], ctx) : v; } catch (e) { if (e instanceof DaxError) return ev(a[1], ctx); throw e; } },
  ROUND: (a, ctx) => { const v = ev(a[0], ctx), d = num(ev(a[1], ctx)); if (isBlank(v)) return null; const f = 10 ** d; return Math.sign(num(v)) * Math.round(Math.abs(num(v)) * f + 1e-9) / f; },
  ROUNDUP: (a, ctx) => { const v = num(ev(a[0], ctx)), f = 10 ** num(ev(a[1], ctx)); return Math.sign(v) * Math.ceil(Math.abs(v) * f - 1e-9) / f; },
  ROUNDDOWN: (a, ctx) => { const v = num(ev(a[0], ctx)), f = 10 ** num(ev(a[1], ctx)); return Math.sign(v) * Math.floor(Math.abs(v) * f + 1e-9) / f; },
  INT: (a, ctx) => Math.floor(num(ev(a[0], ctx))),
  TRUNC: (a, ctx) => Math.trunc(num(ev(a[0], ctx))),
  ABS: (a, ctx) => { const v = ev(a[0], ctx); return isBlank(v) ? null : Math.abs(num(v)); },
  MOD: (a, ctx) => { const x = num(ev(a[0], ctx)), y = num(ev(a[1], ctx)); return x - y * Math.floor(x / y); },
  POWER: (a, ctx) => num(ev(a[0], ctx)) ** num(ev(a[1], ctx)),
  SQRT: (a, ctx) => Math.sqrt(num(ev(a[0], ctx))),
  YEAR: (a, ctx) => { const v = ev(a[0], ctx); return isBlank(v) ? null : ymd(num(v))[0]; },
  MONTH: (a, ctx) => { const v = ev(a[0], ctx); return isBlank(v) ? null : ymd(num(v))[1]; },
  DAY: (a, ctx) => { const v = ev(a[0], ctx); return isBlank(v) ? null : ymd(num(v))[2]; },
  QUARTER: (a, ctx) => { const v = ev(a[0], ctx); return isBlank(v) ? null : Math.ceil(ymd(num(v))[1] / 3); },
  WEEKDAY: (a, ctx) => { const v = ev(a[0], ctx); if (isBlank(v)) return null; const d = new Date(EPOCH + num(v) * 86400000).getUTCDay(); const t = a[1] ? num(ev(a[1], ctx)) : 1; return t === 2 ? ((d + 6) % 7) + 1 : t === 3 ? (d + 6) % 7 : d + 1; },
  DATE: (a, ctx) => serialOf(num(ev(a[0], ctx)), num(ev(a[1], ctx)), num(ev(a[2], ctx))),
  EOMONTH: (a, ctx) => { const [y, m] = ymd(num(ev(a[0], ctx))); const n = num(ev(a[1], ctx)); return serialOf(y, m + n + 1, 0); },
  EDATE: (a, ctx) => shift(num(ev(a[0], ctx)), num(ev(a[1], ctx)), "MONTH"),
  DATEDIFF: (a, ctx) => {
    const x = num(ev(a[0], ctx)), y = num(ev(a[1], ctx)), u = UNIT(a[2], ctx);
    if (u === "DAY") return y - x;
    const [y1, m1] = ymd(x), [y2, m2] = ymd(y);
    return u === "YEAR" ? y2 - y1 : u === "QUARTER" ? (y2 * 4 + Math.ceil(m2 / 3)) - (y1 * 4 + Math.ceil(m1 / 3)) : (y2 * 12 + m2) - (y1 * 12 + m1);
  },
  TODAY: () => toSerial("2025-12-31"), NOW: () => toSerial("2025-12-31"),
  FORMAT: (a, ctx) => formatWith(ev(a[0], ctx), text(ev(a[1], ctx))),
  CONCATENATE: (a, ctx) => text(ev(a[0], ctx)) + text(ev(a[1], ctx)),
  LEFT: (a, ctx) => text(ev(a[0], ctx)).slice(0, a[1] ? num(ev(a[1], ctx)) : 1),
  RIGHT: (a, ctx) => { const s = text(ev(a[0], ctx)), n = a[1] ? num(ev(a[1], ctx)) : 1; return n ? s.slice(-n) : ""; },
  MID: (a, ctx) => text(ev(a[0], ctx)).substr(num(ev(a[1], ctx)) - 1, num(ev(a[2], ctx))),
  LEN: (a, ctx) => text(ev(a[0], ctx)).length,
  UPPER: (a, ctx) => text(ev(a[0], ctx)).toUpperCase(),
  LOWER: (a, ctx) => text(ev(a[0], ctx)).toLowerCase(),
  TRIM: (a, ctx) => text(ev(a[0], ctx)).trim().replace(/\s+/g, " "),
  SUBSTITUTE: (a, ctx) => text(ev(a[0], ctx)).split(text(ev(a[1], ctx))).join(text(ev(a[2], ctx))),
  CONTAINSSTRING: (a, ctx) => text(ev(a[0], ctx)).toLowerCase().includes(text(ev(a[1], ctx)).toLowerCase()),
  SEARCH: (a, ctx) => { const i = text(ev(a[1], ctx)).toLowerCase().indexOf(text(ev(a[0], ctx)).toLowerCase(), a[2] ? num(ev(a[2], ctx)) - 1 : 0); if (i < 0) { if (a[3]) return ev(a[3], ctx); fail("SEARCH did not find the text."); } return i + 1; },
  VALUE: (a, ctx) => num(ev(a[0], ctx)),
  HASONEVALUE: (a, ctx) => { const ref = resolveCol(ctx, a[0]); return distinctCol(ctx, ref, visible(ctx, ref.table)).size === 1; },
  SELECTEDVALUE: (a, ctx) => { const ref = resolveCol(ctx, a[0]); const tb = distinctCol(ctx, ref, visible(ctx, ref.table)); return tb.size === 1 ? tb.rows[0][0] : a[1] ? ev(a[1], ctx) : null; },
  ISFILTERED: (a, ctx) => {
    if (a[0].t === "tref" || a[0].t === "name") { const t = tableOf(ctx.model, a[0].name); return ctx.F.rows.has(t.name) || t.columns.some((c) => ctx.F.cols.has(`${t.name}[${c}]`)); }
    const ref = resolveCol(ctx, a[0]); return ctx.F.cols.has(ref.id);
  },
  ISINSCOPE: (a, ctx) => { const ref = resolveCol(ctx, a[0]); return ctx.scope.has(ref.id) && ctx.F.cols.has(ref.id); },
  EARLIER: (a, ctx) => { const ref = resolveCol(ctx, a[0]); const v = rowValue(ctx, ref, a[1] ? num(ev(a[1], ctx)) : 1); if (v === undefined) fail("EARLIER refers to an earlier row context which doesn't exist."); return v; },
  LOOKUPVALUE: (a, ctx) => {
    const res = resolveCol(ctx, a[0]), t = ctx.model.tables[res.table], pairs = [];
    for (let k = 1; k + 1 < a.length; k += 2) pairs.push([resolveCol(ctx, a[k]), ev(a[k + 1], ctx)]);
    const hits = new Set(t.data.filter((r) => pairs.every(([c, v]) => compare(r[c.i], v) === 0)).map((r) => eqKey(r[res.i])));
    if (hits.size > 1) fail("LOOKUPVALUE found several different values: add more search columns.");
    const row = t.data.find((r) => pairs.every(([c, v]) => compare(r[c.i], v) === 0));
    return row ? row[res.i] : null;
  },
  TOTALYTD: (a, ctx) => calculate(ctx, a[0], [{ t: "call", name: "DATESYTD", args: [a[1]] }, ...a.slice(2)]),
  TOTALQTD: (a, ctx) => calculate(ctx, a[0], [{ t: "call", name: "DATESQTD", args: [a[1]] }, ...a.slice(2)]),
  TOTALMTD: (a, ctx) => calculate(ctx, a[0], [{ t: "call", name: "DATESMTD", args: [a[1]] }, ...a.slice(2)]),
};
// FIRSTDATE / LASTDATE also work where a single value is expected (one row, one column).
for (const n of ["FIRSTDATE", "LASTDATE", "VALUES", "DISTINCT", "TOPN", "FILTER", "CALCULATETABLE", "SELECTCOLUMNS", "SUMMARIZE", "ADDCOLUMNS", "ALL"]) {
  const tf = TABLE_FUNCS[n];
  SCALAR_FUNCS[`__${n}`] = (a, ctx) => { const tb = tf(a, ctx); if (!tb.size) return null; if (tb.size > 1 || tb.cols.length > 1) fail("A table of multiple values was supplied where a single value was expected."); return tb.rows[0][0]; };
}

function call(node, ctx) {
  const f = SCALAR_FUNCS[node.name] || SCALAR_FUNCS[`__${node.name}`];
  if (f) return f(node.args, ctx);
  if (TABLE_FUNCS[node.name]) fail(`The function ${node.name} returns a table, but a single value is expected here.`);
  if (["ALLEXCEPT", "REMOVEFILTERS", "KEEPFILTERS", "USERELATIONSHIP", "CROSSFILTER"].includes(node.name)) fail(`${node.name} can only be used as a filter argument of CALCULATE.`);
  fail(`The function '${node.name}' is not available in the practice engine.`);
}
/* ------------------------------------------------------------------ formatting */
export function formatWith(v, f) {
  if (isBlank(v)) return "";
  const F = f.trim();
  if (/^(yyyy|yy|mmm|mmmm|mm|m|dd|d)([-/ ](mm|m|dd|d|mmm|yyyy))*$/i.test(F) && typeof v === "number") {
    const [y, m, d] = ymd(v), M = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    return F.replace(/yyyy|yy|mmmm|mmm|mm|m|dd|d/gi, (t) => ({ yyyy: y, yy: String(y).slice(2), mmmm: M[m - 1], mmm: M[m - 1].slice(0, 3), mm: String(m).padStart(2, "0"), m, dd: String(d).padStart(2, "0"), d }[t.toLowerCase()]));
  }
  const n = num(v);
  const pct = /%$/.test(F), body = F.replace(/%$/, "");
  const dec = (body.split(".")[1] || "").replace(/[^0#]/g, "").length;
  const x = pct ? n * 100 : n;
  const s = /,/.test(body) ? x.toLocaleString("en-US", { minimumFractionDigits: dec, maximumFractionDigits: dec }) : x.toFixed(dec);
  return pct ? `${s}%` : s;
}
export function formatValue(v, type) {
  if (isBlank(v)) return "(blank)";
  if (typeof v === "boolean") return v ? "TRUE" : "FALSE";
  if (typeof v === "number") {
    if (type === "date") return fromSerial(v);
    if (type === "int") return String(v);
    if (!Number.isFinite(v)) return Number.isNaN(v) ? "NaN" : v > 0 ? "∞" : "-∞";
    return Math.abs(v - Math.round(v)) < 1e-9 ? Math.round(v).toLocaleString("en-US") : v.toLocaleString("en-US", { maximumFractionDigits: 4 });
  }
  return String(v);
}

/* ------------------------------------------------------------------ grids */
export function evaluateGrid(model, measures, expr, grid = {}, { timeLimitMs = 4000 } = {}) {
  const base = new Ctx(model, measures);
  base.budget.ms = timeLimitMs;
  const share = { budget: base.budget, cache: base.cache };
  const F0 = clone(EMPTY);
  for (const [col, vals] of Object.entries(grid.filters || {})) {
    const ref = parseCol(col), c = colRef(model, ref.table, ref.col);
    F0.cols.set(c.id, new Set(vals.map((v) => eqKey(c.type === "date" ? toSerial(v) : v))));
  }
  // Row / column headers: the values left by the grid's filters (filtering 2025 shows 2025's months only), in the
  // column's sort order (the model's sortBy, e.g. Date[Month] by Date[Month Number]).
  const keysOf = (spec) => {
    if (!spec) return null;
    const ref = parseCol(spec), c = colRef(model, ref.table, ref.col);
    const t = model.tables[c.table], seen = new Map();
    for (const r of visible(new Ctx(model, measures, F0, share), c.table)) {
      const row = t.data[r];
      if (!seen.has(eqKey(row[c.i]))) seen.set(eqKey(row[c.i]), row);
    }
    const by = grid.sortBy?.[spec] || (t.sortBy[c.name] && `${c.table}[${t.sortBy[c.name]}]`);
    const sortBy = by ? colRef(model, c.table, parseCol(by).col).i : c.i;
    return { c, keys: [...seen.values()].sort((x, y) => compare(x[sortBy], y[sortBy])).map((r) => r[c.i]) };
  };
  const R = keysOf(grid.rows), C = keysOf(grid.cols);
  const scope = new Set([R?.c.id, C?.c.id].filter(Boolean));
  const at = (r, c) => {
    const F = clone(F0);
    if (r !== undefined) F.cols.set(R.c.id, new Set([eqKey(r)]));
    if (c !== undefined) F.cols.set(C.c.id, new Set([eqKey(c)]));
    const ctx = new Ctx(model, measures, F, { ...share, scope, sel: F0 });
    const v = ev(expr, ctx);
    if (v instanceof Tbl) fail("The formula returns a table: a measure must return a single value.");
    return v;
  };
  const rowKeys = R ? R.keys : [null], colKeys = C ? C.keys : [null];
  const cells = rowKeys.map((r) => colKeys.map((c) => at(R ? r : undefined, C ? c : undefined)));
  const rowTotals = R && C ? rowKeys.map((r) => at(r, undefined)) : null;
  const colTotals = R && C ? colKeys.map((c) => at(undefined, c)) : null;
  const total = R || C ? at(undefined, undefined) : null;
  return { rowKeys, colKeys, rowType: R?.c.type, colType: C?.c.type, rowName: R?.c.id, colName: C?.c.id, cells, rowTotals, colTotals, total };
}
const same = (a, b) => {
  const x = isBlank(a) ? 0 : a, y = isBlank(b) ? 0 : b;
  if (typeof x === "number" && typeof y === "number") return Math.abs(x - y) <= 1e-6 * Math.max(1, Math.abs(x), Math.abs(y)) || (Number.isNaN(x) && Number.isNaN(y));
  return String(x).toLowerCase() === String(y).toLowerCase();
};
// strictBlank: BLANK and 0 differ (for exercises about BLANK); otherwise a blank cell and 0 count as equal.
export function gradeGrid(expected, mine, { strictBlank = false } = {}) {
  const eq = (a, b) => (strictBlank && isBlank(a) !== isBlank(b) ? false : same(a, b));
  const wrong = [];
  expected.cells.forEach((row, r) => row.forEach((v, c) => { if (!eq(v, mine.cells[r]?.[c])) wrong.push({ r, c }); }));
  (expected.rowTotals || []).forEach((v, r) => { if (!eq(v, mine.rowTotals?.[r])) wrong.push({ r, c: "total" }); });
  (expected.colTotals || []).forEach((v, c) => { if (!eq(v, mine.colTotals?.[c])) wrong.push({ r: "total", c }); });
  if ((expected.rowName || expected.colName) && !eq(expected.total, mine.total)) wrong.push({ r: "total", c: "total" });
  return { ok: !wrong.length, wrong };
}
// The functions the practice engine knows (for the help line and the docs).
export const FUNCTIONS = [...new Set([...Object.keys(SCALAR_FUNCS).filter((n) => !n.startsWith("__")), ...Object.keys(TABLE_FUNCS).filter((n) => !n.startsWith("_")),
  "ALLEXCEPT", "REMOVEFILTERS", "KEEPFILTERS", "USERELATIONSHIP"])].sort();
