// Checks for the auto-checked exercise formats (training steps 2b + 2c), with no DOM so CI can use them too
// (scripts/check-content.mjs). The renderer is js/exkinds.js; the formats are described in its header.
// - normalize() / fillOk(): typed answers ("fill", "predict"): trimmed, lower case, spaces collapsed, surrounding
//   quotes / backticks and a final period removed, then compared with the accepted answers or the optional pattern.
// - regexValues(): what a regular expression extracts from lines (group 1 when the expression has a group, else the
//   whole match), so a learner's regex is graded on its result, not on how it is written.
// - parseCron() / sameCron() / nextRuns(): 5-field cron expressions (lists, ranges, steps, names, @daily…; day of
//   month and day of week combine with OR when both are restricted, as in Vixie cron), compared on what they run.
// - verifyData(): CI only, computes the answer of a data question from the data file (count / first / last / top).

export const normalize = (s) => String(s ?? "").trim().toLowerCase().replace(/\s+/g, " ")
  .replace(/^["'`«»“”]+|["'`«»“”]+$/g, "").replace(/\.$/, "").trim();

// A safe RegExp from content or learner input (null when it does not compile).
export function makeRegex(src, flags = "") {
  try { return new RegExp(src, flags); } catch { return null; }
}

export function fillOk(e, input) {
  const v = normalize(input);
  if (!v) return false;
  if ((e.accept || []).some((a) => normalize(a) === v)) return true;
  const re = e.pattern ? makeRegex(e.pattern, "i") : null;
  return !!re && re.test(String(input).trim());
}

/* ---------- regex extraction ---------- */
const MAX_MATCHES = 5000;
export function regexValues(src, flags, lines) {
  const re = makeRegex(src, (flags || "").replace(/g/g, "") + "g");
  if (!re) return null;
  const out = [];
  for (const line of lines) {
    re.lastIndex = 0;
    for (const m of line.matchAll(re)) {
      if (m[0] === "" && m.length < 2) continue; // an empty match extracts nothing
      out.push(m.length > 1 ? (m[1] ?? "") : m[0]);
      if (out.length >= MAX_MATCHES) return out;
    }
  }
  return out;
}
// { ok, missing: [...], extra: [...] } comparing the values in order (multiset difference for the feedback).
export function compareValues(want, got) {
  const ok = want.length === got.length && want.every((v, i) => v === got[i]);
  const left = [...got], missing = [];
  for (const v of want) { const k = left.indexOf(v); if (k >= 0) left.splice(k, 1); else missing.push(v); }
  return { ok, missing, extra: left, sameSet: !missing.length && !left.length };
}

/* ---------- cron ---------- */
const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const DAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
const FIELDS = [
  { name: "minute", min: 0, max: 59 }, { name: "hour", min: 0, max: 23 }, { name: "day of month", min: 1, max: 31 },
  { name: "month", min: 1, max: 12, names: MONTHS, base: 1 }, { name: "day of week", min: 0, max: 7, names: DAYS, base: 0 },
];
const ALIASES = { "@yearly": "0 0 1 1 *", "@annually": "0 0 1 1 *", "@monthly": "0 0 1 * *", "@weekly": "0 0 * * 0",
  "@daily": "0 0 * * *", "@midnight": "0 0 * * *", "@hourly": "0 * * * *" };

function parseField(src, f) {
  const set = new Set();
  const num = (s) => {
    const k = f.names ? f.names.indexOf(s.toLowerCase()) : -1;
    if (k >= 0) return k + f.base;
    if (!/^\d+$/.test(s)) throw new Error(`"${s}" is not a number in the ${f.name} field`);
    return Number(s);
  };
  for (const part of src.split(",")) {
    const m = part.match(/^([^/]+)(?:\/(\d+))?$/);
    if (!m) throw new Error(`"${part}" is not valid in the ${f.name} field`);
    const step = m[2] ? Number(m[2]) : 1;
    if (step < 1) throw new Error(`the step must be 1 or more in the ${f.name} field`);
    let lo, hi;
    if (m[1] === "*") { lo = f.min; hi = f.max; }
    else if (m[1].includes("-")) { const [a, b] = m[1].split("-"); lo = num(a); hi = num(b); }
    else { lo = num(m[1]); hi = m[2] ? f.max : lo; }
    if (lo < f.min || hi > f.max || lo > hi) throw new Error(`${m[1]} is out of range in the ${f.name} field (${f.min}-${f.max})`);
    for (let v = lo; v <= hi; v += step) set.add(v);
  }
  return set;
}

// { minute, hour, dom, month, dow: Set, domStar, dowStar } or throws an Error with a readable message.
export function parseCron(expr) {
  let s = String(expr || "").trim().toLowerCase();
  s = ALIASES[s] || s;
  const parts = s.split(/\s+/);
  if (parts.length !== 5) throw new Error(`a cron expression has 5 fields (minute hour day-of-month month day-of-week), this one has ${parts[0] ? parts.length : 0}`);
  const [minute, hour, dom, month, dow] = parts.map((p, i) => parseField(p, FIELDS[i]));
  if (dow.has(7)) { dow.delete(7); dow.add(0); } // 7 = Sunday too
  return { minute, hour, dom, month, dow, domStar: parts[2].startsWith("*"), dowStar: parts[4].startsWith("*") };
}

const dayMatches = (c, d) => {
  if (!c.month.has(d.getUTCMonth() + 1)) return false;
  const a = c.dom.has(d.getUTCDate()), b = c.dow.has(d.getUTCDay());
  if (c.domStar && c.dowStar) return true;
  if (c.domStar) return b;
  if (c.dowStar) return a;
  return a || b;
};
const sameSet = (a, b) => a.size === b.size && [...a].every((x) => b.has(x));

// Same runs over 8 years (2027-2034: every weekday / date combination, leap years included).
export function sameCron(a, b) {
  const x = parseCron(a), y = parseCron(b);
  if (!sameSet(x.minute, y.minute) || !sameSet(x.hour, y.hour)) return false;
  for (let t = Date.UTC(2027, 0, 1); t < Date.UTC(2035, 0, 1); t += 864e5) {
    const d = new Date(t);
    if (dayMatches(x, d) !== dayMatches(y, d)) return false;
  }
  return true;
}

// The next n run times (Date, UTC fields) after `from`, searching up to 8 years ahead.
export function nextRuns(expr, n = 5, from = new Date(Date.UTC(2027, 0, 1))) {
  const c = parseCron(expr), out = [];
  const mins = [...c.minute].sort((a, b) => a - b), hours = [...c.hour].sort((a, b) => a - b);
  for (let t = Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()); out.length < n && t < from.getTime() + 8 * 366 * 864e5; t += 864e5) {
    const d = new Date(t);
    if (!dayMatches(c, d)) continue;
    for (const hh of hours) for (const mm of mins) {
      const r = new Date(t + (hh * 60 + mm) * 6e4);
      if (r >= from && out.length < n) out.push(r);
    }
  }
  return out;
}

/* ---------- data questions (CI) ---------- */
// verify: { count: regex } number of matching lines; { first | last: regex } group 1 (or the match) of the first /
// last matching line; { top: regex } the most frequent group 1 (must be a unique maximum). Returns a string or throws.
export function verifyData(text, v) {
  const lines = text.split("\n");
  const [kind, src] = Object.entries(v)[0] || [];
  const re = makeRegex(src || "");
  if (!re) throw new Error(`verify.${kind}: the regex does not compile`);
  const hits = lines.map((l) => l.match(re)).filter(Boolean);
  const val = (m) => (m.length > 1 ? m[1] : m[0]);
  if (kind === "count") return String(hits.length);
  if (!hits.length) throw new Error(`verify.${kind}: no line matches`);
  if (kind === "first") return val(hits[0]);
  if (kind === "last") return val(hits.at(-1));
  if (kind === "top") {
    const n = new Map();
    for (const m of hits) n.set(val(m), (n.get(val(m)) || 0) + 1);
    const sorted = [...n.entries()].sort((a, b) => b[1] - a[1]);
    if (sorted[1] && sorted[1][1] === sorted[0][1]) throw new Error(`verify.top: a tie between "${sorted[0][0]}" and "${sorted[1][0]}"`);
    return sorted[0][0];
  }
  throw new Error(`verify: unknown check "${kind}"`);
}
