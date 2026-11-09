// Excel formula exercises (type "sheet", training step 5, 2026-11-09): evaluates a formula on a small sheet with the
// self-hosted parser fast-formula-parser (MIT, js/vendor/formula.esm.min.js), plus the functions it lacks, written
// here to Excel's documented rules: COUNTIFS, SUMIFS, AVERAGEIFS, MAXIFS, MINIFS (and COUNTIF / SUMIF / AVERAGEIF
// with the same criteria rules), MATCH, XLOOKUP, MAX, MIN, COUNTA, COUNTBLANK, LARGE, SMALL, RANK, TEXTJOIN,
// SUBSTITUTE, SEARCH, VALUE, CHOOSE, SWITCH, UPPER, LOWER, TRIM, MEDIAN. Checked against hand-worked Excel results. No DOM: the same code runs in the browser
// (drills.js, loaded on demand) and in CI (scripts/check-content.mjs), so an answer accepted by CI is accepted in the app.
//   evaluate(rows, formula) -> { value } or { error: "#N/A" | "#NAME?" | … }   rows: the sheet from A1, row by row
//   grade(rows, answer, attempt) -> { ok, mine, want, reason? }   same value as the answer on the sheet AND on a
//     changed copy (numbers × 3 + 1 and ÷ 3 + 1 in turn), so a typed result ("=45000") is not accepted; the attempt must use a cell
//   NOT supported (do not write exercises with them): array maths such as (A2:A9="x")*B2:B9, dynamic arrays (FILTER,
//   SORT, UNIQUE), structured references (Table[Column]), named ranges.
import { FormulaParser, FormulaError } from "./vendor/formula.esm.min.js";

const NA = FormulaError.NA, VALUE = FormulaError.VALUE, DIV0 = FormulaError.DIV0;
const raw = (p) => (p && typeof p === "object" && "value" in p ? p.value : p);
const flat = (p) => { const v = raw(p); return Array.isArray(v) ? v.flat(Infinity) : [v]; };
const isNum = (v) => typeof v === "number" && Number.isFinite(v);
const numText = (s) => typeof s === "string" && /^\s*-?\d+(\.\d+)?\s*$/.test(s);
const low = (v) => String(v ?? "").toLowerCase();
// Excel wildcards: * any text, ? one character, ~ escapes them.
function wild(pattern) {
  let re = "";
  for (let i = 0; i < pattern.length; i++) {
    const c = pattern[i];
    if (c === "~" && i + 1 < pattern.length) { re += pattern[++i].replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); continue; }
    re += c === "*" ? ".*" : c === "?" ? "." : c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }
  return new RegExp(`^${re}$`, "is");
}
// A criterion ("Interview", ">=50000", "<>de", 5, "D*", "") -> predicate on a cell value (Excel's COUNTIF rules).
export function criterion(c) {
  const v = raw(c);
  if (isNum(v)) return (x) => isNum(x) && x === v || (typeof x === "string" && numText(x) && Number(x) === v);
  if (typeof v === "boolean") return (x) => x === v;
  const m = /^(<=|>=|<>|<|>|=)?(.*)$/s.exec(String(v ?? ""));
  const op = m[1] || "=", rest = m[2];
  if (rest !== "" && numText(rest)) {
    const n = Number(rest);
    const cmp = { "=": (x) => x === n, "<>": (x) => x !== n, "<": (x) => x < n, ">": (x) => x > n, "<=": (x) => x <= n, ">=": (x) => x >= n }[op];
    return (x) => (isNum(x) ? cmp(x) : op === "<>");
  }
  if (op === "=" || op === "<>") {
    const eq = rest === "" ? (x) => x == null || x === "" : (() => { const re = wild(rest); return (x) => x != null && re.test(String(x)); })();
    return op === "=" ? eq : (x) => !eq(x);
  }
  const t = rest.toLowerCase(); // text comparison: only text cells
  const cmp = { "<": (x) => x < t, ">": (x) => x > t, "<=": (x) => x <= t, ">=": (x) => x >= t }[op];
  return (x) => typeof x === "string" && cmp(x.toLowerCase());
}
// Rows that meet every (range, criterion) pair.
function meets(pairs) {
  const ranges = [];
  for (let i = 0; i < pairs.length; i += 2) ranges.push([flat(pairs[i]), criterion(pairs[i + 1])]);
  const n = ranges[0]?.[0].length ?? 0;
  if (ranges.some(([r]) => r.length !== n)) throw VALUE;
  return [...Array(n).keys()].filter((k) => ranges.every(([r, ok]) => ok(r[k])));
}
const nums = (list) => list.filter(isNum);
const avg = (list) => { const n = nums(list); if (!n.length) throw DIV0; return n.reduce((a, b) => a + b, 0) / n.length; };

// Exact match (case-insensitive text, wildcards when wildcard is true) or position by approximate mode.
function find(value, list, mode = 0, wildcard = false) {
  const v = raw(value);
  const same = (x) => (typeof v === "string" ? (wildcard ? wild(v).test(String(x ?? "")) : low(x) === low(v) && typeof x === "string") : x === v);
  const exact = list.findIndex(same);
  if (exact >= 0 || mode === 0) return exact;
  let best = -1;
  list.forEach((x, k) => {
    if (typeof x !== typeof v) return;
    if (mode < 0 ? x < v && (best < 0 || x > list[best]) : x > v && (best < 0 || x < list[best])) best = k;
  });
  return best;
}

export const FUNCTIONS = {
  COUNTIF: (r, c) => meets([r, c]).length,
  COUNTIFS: (...p) => meets(p).length,
  SUMIF: (r, c, s) => { const v = flat(s ?? r); return nums(meets([r, c]).map((k) => v[k])).reduce((a, b) => a + b, 0); },
  SUMIFS: (s, ...p) => { const v = flat(s); return nums(meets(p).map((k) => v[k])).reduce((a, b) => a + b, 0); },
  AVERAGEIF: (r, c, s) => { const v = flat(s ?? r); return avg(meets([r, c]).map((k) => v[k])); },
  AVERAGEIFS: (s, ...p) => { const v = flat(s); return avg(meets(p).map((k) => v[k])); },
  MAXIFS: (s, ...p) => { const v = nums(meets(p).map((k) => flat(s)[k])); return v.length ? Math.max(...v) : 0; },
  MINIFS: (s, ...p) => { const v = nums(meets(p).map((k) => flat(s)[k])); return v.length ? Math.min(...v) : 0; },
  MATCH: (v, r, type) => {
    const list = flat(r), t = raw(type) ?? 1, x = raw(v);
    if (t === 0) { const k = find(v, list, 0, typeof x === "string" && /[*?]/.test(x)); if (k < 0) throw NA; return k + 1; }
    // sorted lists: last position <= x (type 1, ascending) or >= x (type -1, descending)
    let pos = -1;
    list.forEach((y, k) => { if (typeof y === typeof x && (t > 0 ? y <= x : y >= x)) pos = k; });
    if (pos < 0) throw NA; return pos + 1;
  },
  XLOOKUP: (v, look, ret, notFound, matchMode) => {
    const list = flat(look), out = flat(ret), mode = raw(matchMode) ?? 0;
    const k = find(v, list, mode === 2 ? 0 : mode, mode === 2);
    if (k < 0) { if (notFound != null && raw(notFound) != null) return raw(notFound); throw NA; }
    return out[k] ?? null;
  },
  UPPER: (s) => String(raw(s) ?? "").toUpperCase(),
  LOWER: (s) => String(raw(s) ?? "").toLowerCase(),
  TRIM: (s) => String(raw(s) ?? "").replace(/ +/g, " ").trim(),
  MAX: (...p) => { const v = nums(p.flatMap(flat)); return v.length ? Math.max(...v) : 0; },
  MIN: (...p) => { const v = nums(p.flatMap(flat)); return v.length ? Math.min(...v) : 0; },
  COUNTA: (...p) => p.flatMap(flat).filter((v) => v != null && v !== "").length,
  COUNTBLANK: (r) => flat(r).filter((v) => v == null || v === "").length,
  LARGE: (r, k) => { const v = nums(flat(r)).sort((a, b) => b - a), n = raw(k); if (!(n >= 1 && n <= v.length)) throw FormulaError.NUM; return v[Math.floor(n) - 1]; },
  SMALL: (r, k) => { const v = nums(flat(r)).sort((a, b) => a - b), n = raw(k); if (!(n >= 1 && n <= v.length)) throw FormulaError.NUM; return v[Math.floor(n) - 1]; },
  RANK: (x, r, order) => { const v = nums(flat(r)), n = raw(x); if (!v.includes(n)) throw NA; return 1 + v.filter((y) => (raw(order) ? y < n : y > n)).length; },
  TEXTJOIN: (sep, skipEmpty, ...p) => p.flatMap(flat).filter((v) => !(raw(skipEmpty) && (v == null || v === ""))).map((v) => (v == null ? "" : String(v))).join(String(raw(sep) ?? "")),
  SUBSTITUTE: (s, from, to, nth) => {
    const text = String(raw(s) ?? ""), f = String(raw(from) ?? ""), t = String(raw(to) ?? "");
    if (!f) return text;
    if (raw(nth) == null) return text.split(f).join(t);
    let k = 0; return text.replace(new RegExp(f.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"), (m) => (++k === raw(nth) ? t : m));
  },
  SEARCH: (find, within, start) => { const i = String(raw(within) ?? "").toLowerCase().indexOf(String(raw(find) ?? "").toLowerCase(), (raw(start) ?? 1) - 1); if (i < 0) throw VALUE; return i + 1; },
  VALUE: (s) => { const v = raw(s); if (isNum(v)) return v; const n = Number(String(v ?? "").trim().replace(/\s/g, "")); if (!Number.isFinite(n) || String(v ?? "").trim() === "") throw VALUE; return n; },
  CHOOSE: (i, ...p) => { const k = raw(i); if (!(k >= 1 && k <= p.length)) throw VALUE; return raw(p[Math.floor(k) - 1]); },
  SWITCH: (x, ...p) => { const v = raw(x); for (let i = 0; i + 1 < p.length; i += 2) if (raw(p[i]) === v || (typeof v === "string" && low(raw(p[i])) === low(v))) return raw(p[i + 1]); if (p.length % 2) return raw(p.at(-1)); throw NA; },
  MEDIAN: (...p) => { const v = nums(p.flatMap(flat)).sort((a, b) => a - b); if (!v.length) throw NA; const m = v.length >> 1; return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2; },
};

const letters = (c) => { let s = ""; for (let n = c; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s; return s; };
export const colName = letters;


export function evaluate(rows, formula) {
  const cell = (r, c) => { const v = rows[r - 1]?.[c - 1]; return v === undefined || v === "" ? null : v; };
  const range = (ref) => {
    const from = ref.from || ref, to = ref.to || ref, out = [];
    for (let r = from.row; r <= to.row; r++) { const line = []; for (let c = from.col; c <= to.col; c++) line.push(cell(r, c)); out.push(line); }
    return out;
  };
  // Some names the parser also defines (SUMIF, AVERAGEIF) get its context first and unresolved arguments ({ ref } or a
  // plain value): drop the context and resolve the references here.
  const args = (list) => (list[0] && typeof list[0] === "object" && "onRange" in list[0]
    ? list.slice(1).map((a) => (a && typeof a === "object" && "value" in a ? a : a && typeof a === "object" && "ref" in a ? { value: range(a.ref) } : { value: a }))
    : list);
  const parser = new FormulaParser({
    onCell: ({ row, col }) => cell(row, col),
    onRange: (ref) => { const out = []; for (let r = ref.from.row; r <= ref.to.row; r++) { const line = []; for (let c = ref.from.col; c <= ref.to.col; c++) line.push(cell(r, c)); out.push(line); } return out; },
    functions: Object.fromEntries(Object.entries(FUNCTIONS).map(([name, fn]) => [name, (...list) => { try { return fn(...args(list)); } catch (e) { if (e instanceof FormulaError) return e; throw e; } }])),
  });
  const text = String(formula || "").trim().replace(/^=/, "");
  try {
    const v = parser.parse(text, { row: 1, col: 1 });
    if (v instanceof FormulaError) return { error: v.toString() };
    if (Array.isArray(v)) return { error: "#VALUE!" }; // a range where one value is expected
    return { value: v };
  } catch (e) {
    return { error: e instanceof FormulaError ? e.toString() : "#NAME?", detail: String(e?.message || e).split("\n")[0] };
  }
}

// Same value? Numbers to 9 decimals, text ignoring case, errors equal to errors of the same kind.
const same = (a, b) => (a.error || b.error ? a.error === b.error
  : isNum(a.value) && isNum(b.value) ? Math.abs(a.value - b.value) < 1e-9 * Math.max(1, Math.abs(b.value))
  : low(a.value) === low(b.value) && typeof a.value === typeof b.value);
// Other numbers, some up and some down (so thresholds still split the rows): × 3 + 1 and ÷ 3 + 1 in turn.
export const changed = (rows) => { let k = 0; return rows.map((r) => r.map((v) => (isNum(v) ? (k++ % 2 ? Math.round(v / 3) + 1 : v * 3 + 1) : v))); };
export const usesCell = (f) => /\$?[A-Z]{1,2}\$?\d+/i.test(String(f || "").replace(/"[^"]*"/g, ""));

export function grade(rows, answer, attempt) {
  const text = String(attempt || "").trim();
  const want = evaluate(rows, answer), mine = evaluate(rows, text);
  if (!text.startsWith("=")) return { ok: false, mine, want, reason: "equals" };
  if (!usesCell(text)) return { ok: false, mine, want, reason: "constant" };
  if (mine.error && !want.error) return { ok: false, mine, want, reason: "error" };
  if (!same(mine, want)) return { ok: false, mine, want, reason: "value" };
  const rows2 = changed(rows);
  if (!same(evaluate(rows2, text), evaluate(rows2, answer))) return { ok: false, mine, want, reason: "general" };
  return { ok: true, mine, want };
}

// What a value looks like in a cell.
export function show(res) {
  if (res.error) return res.error;
  const v = res.value;
  if (v == null) return "0";
  if (typeof v === "boolean") return v ? "TRUE" : "FALSE";
  if (isNum(v)) return Number.isInteger(v) ? String(v) : String(Math.round(v * 1e6) / 1e6);
  return String(v);
}
