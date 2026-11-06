// Grades a learner's SQL result against the result of the course answer (training step 2, 2026-11-06). Pure logic,
// shared by the browser (practice.js) and CI (scripts/check-content.mjs, which checks every answer grades as correct).
// Results are { columns: [names], values: [[row], …] } as returned by sql.js. Rules, so a correct query written
// differently still passes:
//   - column names and column order do not matter (aliases differ); each learner column is matched to an expected
//     column holding the same values, and extra learner columns are ignored;
//   - the learner must return at least `minColumns` of the expected columns (default: all of them);
//   - rows are compared as a multiset, or in order when the exercise says `ordered` (an ORDER BY is asked for);
//   - numbers equal within 0.05 when not whole (ROUND(…, 1) vs no rounding), text compared exactly, NULL = NULL.
// Returns { ok, reason, got, want }: reason is "none" (no result), "rows", "columns", "order" or "values".

const close = (a, b) => {
  if (a === b) return true;
  if (typeof a === "number" && typeof b === "number") return Number.isInteger(a) && Number.isInteger(b) ? a === b : Math.abs(a - b) <= 0.0501;
  return a == null && b == null;
};
const key = (v) => (v == null ? "∅" : typeof v === "number" ? (Number.isInteger(v) ? String(v) : v.toFixed(1)) : `s:${v}`);
const column = (res, i) => res.values.map((row) => row[i]);
const sameMultiset = (a, b) => {
  if (a.length !== b.length) return false;
  const x = [...a].map(key).sort(), y = [...b].map(key).sort();
  return x.every((v, i) => v === y[i]) || a.every((v) => b.some((w) => close(v, w)));
};

export function gradeResult(expected, actual, { ordered = false, minColumns } = {}) {
  const want = expected.values.length;
  if (!actual || !actual.columns?.length) return { ok: false, reason: "none", got: 0, want };
  const got = actual.values.length;
  if (got !== want) return { ok: false, reason: "rows", got, want };

  // Match each learner column to a distinct expected column with the same values (ignoring row order for now).
  const map = []; // [learnerIndex, expectedIndex]
  const used = new Set();
  actual.columns.forEach((_, i) => {
    const mine = column(actual, i);
    const j = expected.columns.findIndex((__, k) => !used.has(k) && sameMultiset(mine, column(expected, k)));
    if (j >= 0) { used.add(j); map.push([i, j]); }
  });
  const need = Math.min(minColumns ?? expected.columns.length, expected.columns.length);
  if (map.length < need) return { ok: false, reason: "columns", got, want };

  // Compare whole rows on the matched columns, so values stay paired (a city with its own count).
  const rowOf = (res, idx) => (row) => idx.map((i) => row[i]);
  const mine = actual.values.map(rowOf(actual, map.map(([i]) => i)));
  const theirs = expected.values.map(rowOf(expected, map.map(([, j]) => j)));
  const sameRow = (a, b) => a.every((v, i) => close(v, b[i]));
  if (ordered) {
    if (mine.every((r, i) => sameRow(r, theirs[i]))) return { ok: true, reason: "", got, want };
  }
  const left = [...theirs];
  for (const r of mine) {
    const k = left.findIndex((t) => sameRow(r, t));
    if (k < 0) return { ok: false, reason: "values", got, want };
    left.splice(k, 1);
  }
  return ordered ? { ok: false, reason: "order", got, want } : { ok: true, reason: "", got, want };
}
