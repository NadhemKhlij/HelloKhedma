// Runnable DAX exercises (2026-11-09): the learner writes a measure, ▶ Run shows it in a small Power BI-like table
// visual (rows, optional columns, totals, the exercise's filters) computed in the browser on a practice model
// (content/dax/<model>.json, js/daxeval.js), and ✓ Check compares it cell by cell with the course answer. Nothing is
// sent anywhere. Used by practice.js for exercises with "dax":
//   "code": "dax", "answer": "<measure>", "dax": { "model": "retail", "rows"?: "Date[Year]", "cols"?: "Product[Category]",
//     "filters"?: { "Store[Channel]": ["Online"] }, "measures"?: ["Total Sales"], "format"?: "0.0%", "strictBlank"?: true },
//   "start"?: "<a measure the editor opens on>", "mistakes"?: [{ "dax": "<a typical wrong measure>", "says": "<hint>" }]
// "measures" are measures of the model's library the learner may use ([Total Sales]); "format" is how numbers show;
// strictBlank makes BLANK and 0 differ. A check that gives the same result as one of the "mistakes" shows its hint.
// The engine runs on the main thread with a time limit (daxeval.js budget), so a runaway formula stops by itself.
// onWrong(formula, verdict) after a failed check, for "Explain my mistake" (explain.js).
import { h } from "./lib.js";
import { t, tn } from "./i18n.js";

const models = new Map();
const engine = () => import("./daxeval.js");
async function loadModel(name) {
  if (!models.has(name)) {
    models.set(name, Promise.all([engine(), fetch(new URL(`../content/dax/${encodeURIComponent(name)}.json`, import.meta.url)).then((r) => {
      if (!r.ok) throw new Error(`content/dax/${name}.json: HTTP ${r.status}`);
      return r.json();
    })]).then(([dax, json]) => ({ dax, json, model: dax.loadModel(json) })));
    models.get(name).catch(() => models.delete(name));
  }
  return models.get(name);
}
// The measures of the library this exercise allows, parsed.
const libraryOf = (dax, json, names = []) => Object.fromEntries(names.filter((n) => json.measures?.[n]).map((n) => [n, dax.parseMeasure(json.measures[n]).expr]));
const colName = (ref) => ref.replace(/^'?([^'[]+)'?\[([^\]]+)\]$/, "$2");
// The visual in words: English for the AI (describe), translated chips for the page (chips).
const describe = (spec) => [spec.rows && `Rows: ${spec.rows}`, spec.cols && `Columns: ${spec.cols}`,
  ...Object.entries(spec.filters || {}).map(([c, v]) => `Filter: ${c} = ${v.join(", ")}`)].filter(Boolean).join(" · ") || "Card (one value)";
const chips = (spec) => {
  const list = [spec.rows && t("Rows: {col}", { col: spec.rows }), spec.cols && t("Columns: {col}", { col: spec.cols }),
    ...Object.entries(spec.filters || {}).map(([c, v]) => t("Filter: {col} = {values}", { col: c, values: v.join(", ") }))].filter(Boolean);
  return list.length ? list : [t("Card visual (no rows)")];
};

// The table visual: row headers, cells, a Total column with columns, a Total row with rows. wrong: cells to mark.
// name: the measure's name when the learner gave one ("Phones Sales = …"), as the column header.
function matrix(dax, g, spec, wrong = [], name = "") {
  const fmt = (v) => (v == null ? t("(blank)") : spec.format && typeof v === "number" && Number.isFinite(v) ? dax.formatWith(v, spec.format) : dax.formatValue(v));
  const key = (v, type) => dax.formatValue(v, type);
  const bad = new Set(wrong.map((w) => `${w.r}|${w.c}`));
  const cell = (v, r, c, extra = "") => {
    const off = bad.has(`${r}|${c}`);
    return h("td", { class: `px-2 py-1 text-right whitespace-nowrap ${extra}`, style: off ? "outline:2px solid var(--warn);outline-offset:-2px" : "",
      title: off ? t("This value differs from the expected one") : null }, fmt(v), off ? h("span", { class: "sr-only" }, ` (${t("differs")})`) : null);
  };
  if (!g.rowName && !g.colName) {
    const off = bad.size > 0;
    return h("div", { class: "rounded-xl p-4 grid gap-1 justify-items-start", style: `border:1px solid var(--line);${off ? "outline:2px solid var(--warn);outline-offset:-2px" : ""}` },
      h("span", { class: "text-2xl font-semibold font-mono" }, fmt(g.cells[0][0])), h("span", { class: "mute text-xs" }, t("Card visual (no rows)")));
  }
  const head = [h("th", { class: "text-left px-2 py-1 whitespace-nowrap" }, g.rowName ? colName(spec.rows) : ""),
    ...(g.colName ? g.colKeys.map((k) => h("th", { class: "text-right px-2 py-1 whitespace-nowrap" }, key(k, g.colType))) : [h("th", { class: "text-right px-2 py-1" }, name || t("Measure"))]),
    g.colName && g.rowName ? h("th", { class: "text-right px-2 py-1" }, t("Total")) : null];
  const body = (g.rowName ? g.rowKeys : [null]).map((rk, r) => h("tr", { style: "border-top:1px solid var(--line)" },
    h("th", { scope: "row", class: "text-left px-2 py-1 font-normal whitespace-nowrap" }, g.rowName ? key(rk, g.rowType) : t("Total")),
    ...g.cells[r].map((v, c) => cell(v, r, c)),
    g.colName && g.rowName ? cell(g.rowTotals[r], r, "total", "font-semibold") : null));
  const totalRow = g.rowName ? h("tr", { style: "border-top:2px solid var(--line)" },
    h("th", { scope: "row", class: "text-left px-2 py-1" }, t("Total")),
    ...(g.colName ? g.colTotals.map((v, c) => cell(v, "total", c, "font-semibold")) : []),
    cell(g.total, "total", "total", "font-semibold")) : null;
  return h("div", { class: "overflow-x-auto rounded-xl", style: "border:1px solid var(--line)", tabindex: "0", role: "region", "aria-label": t("Result of your measure") },
    h("table", { class: "text-xs font-mono w-full" }, h("thead", {}, h("tr", { style: "background:var(--soft)" }, head)), h("tbody", {}, body, totalRow)));
}

// The practice model: tables, columns, relationships and the measures this exercise allows.
function modelPanel(spec) {
  const box = h("details", { class: "text-xs" }, h("summary", { class: "cursor-pointer mute" }, t("The practice model (tables, relationships, measures)")));
  box.addEventListener("toggle", async () => {
    if (!box.open || box.dataset.loaded) return;
    box.dataset.loaded = "1";
    try {
      const { json } = await loadModel(spec.model);
      const allowed = (spec.measures || []).filter((n) => json.measures?.[n]);
      box.append(h("div", { class: "grid gap-2 mt-2" },
        h("p", { class: "mute" }, t("A fictional electronics retailer, 2023 to 2025: Sales has one row per order line, linked to its product, customer, store and date.")),
        h("ul", { class: "grid gap-1 font-mono" }, Object.entries(json.tables).map(([name, tb]) =>
          h("li", {}, h("b", {}, name), `(${tb.columns.join(", ")}) · `, h("span", { class: "mute" }, tn(tb.rows.length, "{n} row", "{n} rows"))))),
        h("p", { class: "font-medium" }, t("Relationships (filters flow from the one side to the many side):")),
        h("ul", { class: "grid gap-1 font-mono" }, json.relationships.map((r) => h("li", {}, `${r.from} → ${r.to}`, r.active === false ? h("span", { class: "mute" }, ` (${t("inactive")})`) : null))),
        allowed.length ? h("p", { class: "font-medium" }, t("Measures you can use:")) : h("p", { class: "mute" }, t("No ready-made measure in this exercise: write everything yourself.")),
        allowed.length ? h("ul", { class: "grid gap-1 font-mono" }, allowed.map((n) => h("li", {}, `[${n}] = ${json.measures[n]}`))) : null));
    } catch (err) { box.append(h("p", { class: "mute" }, t("The practice model could not be loaded: {msg}", { msg: err.message }))); }
  });
  return box;
}

export function daxRunner(e, onSolved, onWrong = () => {}) {
  const spec = e.dax;
  const box = h("textarea", { class: "input font-mono min-h-[110px] w-full", rows: e.start ? Math.min(14, e.start.split("\n").length + 1) : 5, spellcheck: "false",
    autocapitalize: "off", autocorrect: "off", dir: "ltr", "aria-label": t("Your DAX measure"),
    placeholder: t("Write your measure, e.g. Total Sales = SUM ( Sales[Quantity] ), then ▶ Run (Ctrl + Enter)…") });
  const out = h("div", { class: "grid gap-2", "aria-live": "polite" });
  const say = (text, color) => h("p", { class: "text-sm font-medium", style: color ? `color:${color}` : "" }, text);
  const show = (...els) => out.replaceChildren(...els.filter(Boolean));
  const busy = (on) => { run.disabled = check.disabled = on; };
  let expected = null, mistakes = null;
  const evaluate = (dax, model, measures, src) => dax.evaluateGrid(model, measures, dax.parseMeasure(src).expr, spec, { timeLimitMs: 6000 });
  const errorText = (err, dax) => (err instanceof dax.DaxError ? t("DAX error: {msg}", { msg: err.message }) : t("The practice engine could not run this formula ({msg}).", { msg: err.message }));

  async function go(withCheck) {
    if (!box.value.trim()) { box.focus(); return; }
    busy(true);
    show(h("p", { class: "mute text-sm" }, withCheck ? t("Checking…") : t("Running…")));
    await new Promise((r) => setTimeout(r, 20)); // let the message paint before the engine runs
    let ctx;
    try { ctx = await loadModel(spec.model); } catch (err) { show(say(t("The practice model could not be loaded: {msg}", { msg: err.message }), "var(--bad)")); busy(false); return; }
    const { dax, json, model } = ctx;
    const measures = libraryOf(dax, json, spec.measures);
    try {
      let mine;
      try { mine = evaluate(dax, model, measures, box.value); } catch (err) {
        if (!(err instanceof dax.DaxError)) console.error(err);
        show(say(errorText(err, dax), "var(--bad)"));
        if (withCheck) onWrong(box.value, `The measure fails in the practice engine: ${err.message}`);
        return;
      }
      const name = (() => { try { return dax.parseMeasure(box.value).name; } catch { return ""; } })();
      if (!withCheck) { show(matrix(dax, mine, spec, [], name)); return; }
      expected ||= evaluate(dax, model, measures, e.answer);
      const g = dax.gradeGrid(expected, mine, { strictBlank: !!spec.strictBlank });
      if (g.ok) { onSolved(); show(say(t("✓ Correct! Your measure gives the expected value in every cell."), "var(--ok)"), matrix(dax, mine, spec, [], name)); return; }
      // A known mistake of this exercise: its own hint.
      mistakes ||= (e.mistakes || []).map((m) => { try { return { says: m.says, g: evaluate(dax, model, measures, m.dax) }; } catch { return null; } }).filter(Boolean);
      const known = mistakes.find((m) => dax.gradeGrid(m.g, mine, { strictBlank: !!spec.strictBlank }).ok);
      const all = expected.cells.flat().length + (expected.rowTotals?.length || 0) + (expected.colTotals?.length || 0) + (expected.rowName || expected.colName ? 1 : 0);
      const onlyTotals = g.wrong.every((w) => w.r === "total" || w.c === "total");
      const blank = mine.cells.flat().every((v) => v == null);
      const msg = blank ? t("Not yet: your measure is blank everywhere. Check its filters: a condition may remove every row.")
        : onlyTotals ? t("Almost: every row is right but a total differs. A total is computed again in its own filter context: it is not the sum of the rows.")
        : t("Not yet: {n} of {all} values differ (outlined).", { n: g.wrong.length, all });
      show(say(msg, "var(--warn)"), known ? h("p", { class: "text-sm rounded-xl p-3", style: "background:var(--soft)" }, `💡 ${known.says}`) : null, matrix(dax, mine, spec, g.wrong, name));
      const where = (w) => `${w.r === "total" ? "Total" : dax.formatValue(expected.rowKeys[w.r], expected.rowType)}${expected.colName ? ` / ${w.c === "total" ? "Total" : dax.formatValue(expected.colKeys[w.c], expected.colType)}` : ""}`;
      const value = (grid, w) => (w.r === "total" && w.c === "total" ? grid.total : w.r === "total" ? grid.colTotals?.[w.c] ?? grid.total : w.c === "total" ? grid.rowTotals[w.r] : grid.cells[w.r][w.c]);
      onWrong(box.value, `Visual: ${describe(spec)}. ${g.wrong.length} of ${all} values differ from the expected measure, e.g. ${g.wrong.slice(0, 4)
        .map((w) => `${where(w)}: got ${dax.formatValue(value(mine, w))}, expected ${dax.formatValue(value(expected, w))}`).join("; ")}.`);
    } finally { busy(false); }
  }
  if (e.start) box.value = e.start;
  box.addEventListener("keydown", (ev) => { if ((ev.ctrlKey || ev.metaKey) && ev.key === "Enter") { ev.preventDefault(); go(false); } });
  const reset = e.start ? h("button", { type: "button", class: "btn-ghost", onClick: () => { box.value = e.start; show(); box.focus(); } }, t("↺ Start again")) : null;
  const run = h("button", { type: "button", class: "btn-ghost", onClick: () => go(false) }, t("▶ Run"));
  const check = h("button", { type: "button", class: "btn", onClick: () => go(true) }, t("✓ Check my answer"));
  return h("div", { class: "grid gap-2", "data-dax-runner": true },
    h("p", { class: "mute text-xs" }, t("Runs in your browser on a practice model, like a table visual in Power BI. ✓ Check compares every cell with the expected measure.")),
    h("p", { class: "text-xs flex flex-wrap gap-1", dir: "ltr" }, ...chips(spec).map((x) => h("span", { class: "chip !text-xs" }, x))),
    modelPanel(spec), box, h("div", { class: "flex flex-wrap gap-2" }, run, check, reset), out);
}
// What the AI gets as the exercise material ("Explain my mistake", explain.js).
export const daxMaterial = (e) => `Practice model "${e.dax.model}" (a Power BI-like engine in the browser). Visual: ${describe(e.dax)}.${e.dax.measures?.length ? ` Measures available: ${e.dax.measures.map((n) => `[${n}]`).join(", ")}.` : ""}${e.start ? `\nStarting measure:\n${e.start}` : ""}`;
