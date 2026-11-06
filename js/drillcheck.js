// Checks for the auto-graded exercise formats (training steps 2b + 2c, 2026-11-06). No DOM here: the same functions
// run in the browser (drills.js, regexworker.js) and in CI (scripts/check-content.mjs), so a course answer that CI
// accepts is accepted in the app too.
//   accepts(list, input, exact?)  free-text answers: equal after trimming, collapsing spaces and ignoring case (unless
//                                 exact), or matching an entry written "/regex/flags"
//   blanks(snippet)               the number of "___" blanks in a fill-in snippet
//   parseCron(expr)               5-field cron (numbers, *, lists, ranges, steps, jan-dec, sun-sat, 7 = Sunday,
//                                 @hourly … @yearly) -> schedule; throws Error("count") or Error("field:<0-4>")
//   sameCron(a, b)                true when two expressions fire at exactly the same minutes (28-year comparison)
//   nextRuns(expr, from, n)       the next n run times (Date) after `from`, local time
//   regexRun(source, flags, text, mode)  mode "lines": the lines the pattern matches (grep); "extract": every match
//                                 (group 1 when the pattern has a group) in order; throws on an invalid pattern
//   jq(program, input)            a jq subset for the JSON exercises: .key, ."key", .[n], .[], [..] collect, pipes,
//                                 length, keys, select(<path> ==|!=|<|<=|>|>= <literal>); returns the output stream
//                                 (array); throws Error("jq:<reason>")
//   sameList(a, b)                deep equality of two result lists (JSON)

/* ---------- free-text answers ---------- */
const norm = (s, exact) => { const x = String(s ?? "").trim().replace(/\s+/g, " "); return exact ? x : x.toLowerCase(); };
export function accepts(list, input, exact = false) {
  const v = norm(input, exact);
  if (!v) return false;
  return (list || []).some((a) => {
    const m = /^\/(.+)\/([a-z]*)$/s.exec(a);
    return m ? new RegExp(m[1], m[2]).test(String(input).trim()) : norm(a, exact) === v;
  });
}
export const blanks = (snippet) => (String(snippet || "").match(/___/g) || []).length;

/* ---------- cron ---------- */
const RANGES = [[0, 59], [0, 23], [1, 31], [1, 12], [0, 7]];
const NAMES = { 3: ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"], 4: ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] };
const MACROS = { "@hourly": "0 * * * *", "@daily": "0 0 * * *", "@midnight": "0 0 * * *", "@weekly": "0 0 * * 0",
  "@monthly": "0 0 1 * *", "@yearly": "0 0 1 1 *", "@annually": "0 0 1 1 *" };
function cronValue(x, i) {
  if (/^\d+$/.test(x)) return Number(x);
  const k = NAMES[i]?.indexOf(x);
  if (k >= 0) return i === 3 ? k + 1 : k;
  throw new Error(`field:${i}`);
}
function cronField(p, i) {
  const [lo, hi] = RANGES[i], out = new Set();
  for (const part of p.split(",")) {
    const m = /^(\*|[a-z0-9]+(?:-[a-z0-9]+)?)(?:\/(\d+))?$/.exec(part);
    if (!m) throw new Error(`field:${i}`);
    let a, b;
    if (m[1] === "*") { a = lo; b = hi; } else {
      const [x, y] = m[1].split("-");
      a = cronValue(x, i); b = y === undefined ? (m[2] ? hi : a) : cronValue(y, i);
    }
    const step = m[2] ? Number(m[2]) : 1;
    if (step < 1 || a > b || a < lo || b > hi) throw new Error(`field:${i}`);
    for (let v = a; v <= b; v += step) out.add(i === 4 && v === 7 ? 0 : v);
  }
  return out;
}
export function parseCron(expr) {
  const s = String(expr || "").trim().toLowerCase();
  const parts = (MACROS[s] || s).split(/\s+/).filter(Boolean);
  if (parts.length !== 5) throw new Error("count");
  const [min, hour, dom, mon, dow] = parts.map(cronField);
  // Vixie cron: when the day-of-month or day-of-week field starts with "*", both must match; otherwise either one.
  return { min, hour, dom, mon, dow, either: !parts[2].startsWith("*") && !parts[4].startsWith("*") };
}
const dayOk = (c, d) => c.mon.has(d.getMonth() + 1) &&
  (c.either ? c.dom.has(d.getDate()) || c.dow.has(d.getDay()) : c.dom.has(d.getDate()) && c.dow.has(d.getDay()));
const sameSet = (a, b) => a.size === b.size && [...a].every((x) => b.has(x));
export function sameCron(a, b) {
  const x = parseCron(a), y = parseCron(b);
  if (!sameSet(x.min, y.min) || !sameSet(x.hour, y.hour)) return false;
  // Days repeat every 28 years (weekday + leap year); compare each of them.
  for (let d = new Date(2000, 0, 1); d.getFullYear() < 2028; d.setDate(d.getDate() + 1)) if (dayOk(x, d) !== dayOk(y, d)) return false;
  return true;
}
export function nextRuns(expr, from = new Date(), n = 5) {
  const c = parseCron(expr), out = [];
  const hours = [...c.hour].sort((a, b) => a - b), mins = [...c.min].sort((a, b) => a - b);
  const day = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  for (let k = 0; k < 366 * 8 && out.length < n; k++, day.setDate(day.getDate() + 1)) {
    if (!dayOk(c, day)) continue;
    for (const hh of hours) for (const mm of mins) {
      const at = new Date(day.getFullYear(), day.getMonth(), day.getDate(), hh, mm);
      if (at > from && out.length < n) out.push(at);
    }
  }
  return out;
}

/* ---------- regex ---------- */
const MAX_HITS = 500;
export function regexRun(source, flags, text, mode) {
  const f = String(flags || "").replace(/[^imsu]/g, "");
  const one = new RegExp(source, f), all = new RegExp(source, f + "g");
  const lines = String(text).split(/\r?\n/).filter((l) => l.length);
  if (mode === "lines") return lines.filter((l) => one.test(l)).slice(0, MAX_HITS);
  const out = [];
  for (const l of lines) for (const m of l.matchAll(all)) {
    if (m[0] === "") continue;
    out.push(m.length > 1 ? m[1] ?? "" : m[0]);
    if (out.length >= MAX_HITS) return out;
  }
  return out;
}

/* ---------- jq subset ---------- */
const jqErr = (why) => new Error(`jq:${why}`);
// Split on a separator at the top level (outside quotes, brackets and parentheses).
function splitTop(s, sep) {
  const out = []; let depth = 0, q = false, cur = "";
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (q) { cur += ch; if (ch === "\\") { cur += s[++i] ?? ""; } else if (ch === '"') q = false; continue; }
    if (ch === '"') q = true;
    else if ("([".includes(ch)) depth++;
    else if (")]".includes(ch)) depth--;
    if (depth < 0) throw jqErr("syntax");
    if (depth === 0 && s.startsWith(sep, i)) { out.push(cur); cur = ""; i += sep.length - 1; continue; }
    cur += ch;
  }
  if (q || depth) throw jqErr("syntax");
  out.push(cur);
  return out;
}
const literal = (s) => {
  if (/^-?\d+(\.\d+)?$/.test(s) || /^"(?:[^"\\]|\\.)*"$/.test(s) || ["true", "false", "null"].includes(s)) return JSON.parse(s);
  return undefined;
};
function pathStage(s) {
  const segs = []; let i = 0;
  const id = /^[A-Za-z_][A-Za-z0-9_]*/;
  while (i < s.length) {
    if (s[i] === ".") {
      i++;
      if (i >= s.length) break; // "." on its own (or a trailing dot after a key is a syntax error below)
      const rest = s.slice(i), m = id.exec(rest);
      if (m) { segs.push({ key: m[0] }); i += m[0].length; continue; }
      const qm = /^"((?:[^"\\]|\\.)*)"/.exec(rest);
      if (qm) { segs.push({ key: JSON.parse(`"${qm[1]}"`) }); i += qm[0].length; continue; }
      if (s[i] !== "[") throw jqErr("syntax");
    }
    if (s[i] === "[") {
      const end = s.indexOf("]", i);
      if (end < 0) throw jqErr("syntax");
      const inner = s.slice(i + 1, end).trim();
      if (inner === "") segs.push({ all: true });
      else if (/^-?\d+$/.test(inner)) segs.push({ index: Number(inner) });
      else if (/^"(?:[^"\\]|\\.)*"$/.test(inner)) segs.push({ key: JSON.parse(inner) });
      else throw jqErr("syntax");
      i = end + 1;
      if (s[i] === "?") i++;
      continue;
    }
    throw jqErr("syntax");
  }
  return (v) => segs.reduce((stream, g) => stream.flatMap((x) => {
    if (g.all) {
      if (Array.isArray(x)) return x;
      if (x && typeof x === "object") return Object.values(x);
      throw jqErr("iterate");
    }
    if (x == null) return [null];
    if ("index" in g) { if (!Array.isArray(x)) throw jqErr("index"); return [x.at(g.index) ?? null]; }
    if (typeof x !== "object" || Array.isArray(x)) throw jqErr("key");
    return [x[g.key] ?? null];
  }), [v]);
}
function stage(s) {
  s = s.trim();
  if (!s) throw jqErr("syntax");
  if (s === ".") return (v) => [v];
  if (s === "length") return (v) => {
    if (v == null) return [0];
    if (Array.isArray(v) || typeof v === "string") return [v.length];
    if (typeof v === "object") return [Object.keys(v).length];
    if (typeof v === "number") return [Math.abs(v)];
    throw jqErr("length");
  };
  if (s === "keys") return (v) => { if (!v || typeof v !== "object") throw jqErr("keys"); return [Array.isArray(v) ? v.map((_, i) => i) : Object.keys(v).sort()]; };
  const sel = /^select\s*\((.*)\)$/s.exec(s);
  if (sel) {
    for (const op of ["==", "!=", "<=", ">=", "<", ">"]) {
      const parts = splitTop(sel[1], op);
      if (parts.length !== 2) continue;
      const left = pipe(parts[0]), right = literal(parts[1].trim());
      if (right === undefined) throw jqErr("syntax");
      const test = { "==": (a) => JSON.stringify(a) === JSON.stringify(right), "!=": (a) => JSON.stringify(a) !== JSON.stringify(right),
        "<": (a) => a < right, "<=": (a) => a <= right, ">": (a) => a > right, ">=": (a) => a >= right }[op];
      return (v) => (left([v]).some(test) ? [v] : []);
    }
    throw jqErr("syntax");
  }
  if (s.startsWith("[") && s.endsWith("]") && splitTop(s.slice(1, -1), "|").length >= 1 && !/^\[\s*(-?\d+|"[^"]*")?\s*\]/.test(s)) {
    const inner = pipe(s.slice(1, -1));
    return (v) => [inner([v])];
  }
  const lit = literal(s);
  if (lit !== undefined) return () => [lit];
  if (s.startsWith(".") || s.startsWith("[")) return pathStage(s);
  throw jqErr("syntax");
}
function pipe(src) {
  const stages = splitTop(String(src), "|").map(stage);
  return (stream) => stages.reduce((st, f) => st.flatMap(f), stream);
}
const MAX_OUT = 1000;
export function jq(program, input) {
  const out = pipe(String(program || "").trim())([input]);
  if (out.length > MAX_OUT) throw jqErr("size");
  return out;
}

export const sameList = (a, b) => JSON.stringify(a) === JSON.stringify(b);
