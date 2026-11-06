// Auto-checked exercise formats on the Practice tab (training steps 2b + 2c), drawn by practice.js for any exercise
// with a "kind". No engine: plain JS checks (js/excheck.js, also used by CI). Content in the course JSON, per exercise:
//   common: { kind, q, hint?, answer }   answer = the explanation shown after a correct try or on "Reveal the answer"
//   "fill" | "predict": accept: ["…"], pattern?: "regex" (case-insensitive), given?: { lang, code } (code to read,
//            "predict" = what does it print / return), data?: "<file>" (a file in content/data/, shown with a line
//            filter, e.g. a log or an API response), verify?: { count | first | last | top: "regex" } (CI computes the
//            answer from the data file and checks it is accepted)
//   "order":    steps: ["…"] in the right order (shown shuffled; ↑ ↓ buttons, or drag and drop with a mouse)
//   "match":    pairs: [["left", "right"]] (each left gets a list of the shuffled rights)
//   "groups":   groups: [{ name, items: ["…"] }] (every item is sorted into one group)
//   "bug":      given: { lang, code }, bug: [line numbers, from 1] (tap the wrong line(s)), answer = the fix
//   "scenario": steps: [{ text, options: [{ text, ok?: true, why }] }] (one ok option per step, options shown shuffled; a wrong choice
//            explains why and can be retried; the next step opens after the right one)
//   "regex":    code: "regex", answer: "<the reference regex>", flags?: "i", data?: "<file>" or lines: ["…"]
//            (graded on what it extracts: group 1 when there is a group, else the match, line by line)
//   "cron":     code: "cron", answer: "<the reference expression>" (graded on when it runs; shows the next runs)
// French copies: same kind, given, data, verify, bug, flags, lines, code answers and array lengths; texts translated
// (accept may differ for words). A correct try marks the exercise solved (same store as the self-graded ones).
import { h } from "./lib.js";
import { t, tn, lang } from "./i18n.js";
import { fillOk, regexValues, compareValues, parseCron, sameCron, nextRuns, makeRegex } from "./excheck.js";

const OK = "#18a999", BAD = "#e0508b", WARN = "#f08a24";
const say = (text, color) => h("p", { class: "text-sm font-medium", style: color ? `color:${color}` : "" }, text);
const shuffle = (a) => { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };
// Shuffled, but never left in the right order.
const mixed = (a) => { if (a.length < 2) return [...a]; let b; do b = shuffle(a); while (b.every((x, i) => x === a[i])); return b; };

const files = new Map();
export function dataFile(name) {
  if (!/^[a-z0-9_.-]+$/i.test(name)) return Promise.reject(new Error("bad file name"));
  if (!files.has(name)) files.set(name, fetch(`content/data/${name}`).then((r) => { if (!r.ok) throw new Error(r.statusText); return r.text(); }));
  return files.get(name).catch((e) => { files.delete(name); throw e; });
}

// A data file (log, JSON…) with a line filter: plain text, or a regex when it is one; shows the matching count.
function dataViewer(name) {
  const MAX = 400;
  const pre = h("pre", { class: "codeblock !text-xs max-h-72 overflow-auto", dir: "ltr", tabindex: "0", "aria-label": t("Data file {name}", { name }) }, h("code", {}, t("Loading…")));
  const count = h("span", { class: "mute text-xs" });
  const filter = h("input", { class: "input font-mono !text-sm flex-1 min-w-0", type: "search", spellcheck: "false", autocapitalize: "off", autocorrect: "off",
    "aria-label": t("Filter the lines"), placeholder: t("Filter: text or regex") });
  let lines = [];
  const draw = () => {
    const q = filter.value;
    let shown = lines;
    if (q) {
      const re = makeRegex(q, "i");
      shown = re ? lines.filter((l) => re.test(l)) : lines.filter((l) => l.toLowerCase().includes(q.toLowerCase()));
    }
    pre.firstChild.textContent = shown.slice(0, MAX).join("\n") || t("(no line matches)");
    count.textContent = q ? t("{n} of {all} lines match", { n: shown.length, all: lines.length }) : tn(lines.length, "{n} line", "{n} lines")
      + (shown.length > MAX ? ` · ${t("first {max} shown", { max: MAX })}` : "");
  };
  filter.addEventListener("input", draw);
  dataFile(name).then((text) => { lines = text.replace(/\n$/, "").split("\n"); draw(); })
    .catch(() => { pre.firstChild.textContent = t("Could not load the data file. Check your connection."); });
  return h("div", { class: "grid gap-2", "data-data-viewer": name },
    h("div", { class: "flex items-center gap-2 text-xs" }, h("span", { class: "chip !py-0 font-mono" }, name), count),
    pre, h("div", { class: "flex gap-2" }, filter));
}

// A check button + verdict line; check() returns { ok, msg, color? } (or a promise of it).
function checker(check, onSolved, label = t("✓ Check my answer")) {
  const out = h("div", { class: "grid gap-2", "aria-live": "polite" });
  const btn = h("button", { type: "button", class: "btn", onClick: async () => {
    btn.disabled = true;
    try {
      const r = await check();
      out.replaceChildren(...[r.msg ? say(r.msg, r.color || (r.ok ? OK : WARN)) : null, r.extra || null].filter(Boolean));
      if (r.ok) onSolved();
    } finally { btn.disabled = false; }
  } }, label);
  return { btn, out };
}

/* ---------- fill in the blank / predict the output ---------- */
function fill(e, ctx) {
  const box = h("input", { class: "input font-mono flex-1 min-w-0", type: "text", spellcheck: "false", autocapitalize: "off", autocorrect: "off",
    "aria-label": t("Your answer"), placeholder: e.kind === "predict" ? t("What does it print or return?") : t("Your answer…") });
  const { btn, out } = checker(() => {
    if (!box.value.trim()) { box.focus(); return { ok: false, msg: "" }; }
    return fillOk(e, box.value) ? { ok: true, msg: t("✓ Correct!") } : { ok: false, msg: t("Not yet. Check again, or show the hint.") };
  }, ctx.onSolved);
  box.addEventListener("keydown", (ev) => { if (ev.key === "Enter") { ev.preventDefault(); btn.click(); } });
  return [e.given ? ctx.codeBlock(e.given.lang, e.given.code) : null, e.data ? dataViewer(e.data) : null,
    h("div", { class: "flex flex-wrap gap-2" }, box, btn), out];
}

/* ---------- put the steps in order ---------- */
function order(e, ctx) {
  let cur = mixed(e.steps.map((_, i) => i)), dragFrom = null;
  const list = h("ol", { class: "grid gap-2", "aria-label": t("Steps to put in order") });
  const move = (from, to) => { if (to < 0 || to >= cur.length) return; const [x] = cur.splice(from, 1); cur.splice(to, 0, x); draw(to); };
  const draw = (focus) => {
    list.replaceChildren(...cur.map((s, pos) => {
      const up = h("button", { type: "button", class: "btn-ghost !px-2 !py-0.5", "aria-label": t("Move up: {step}", { step: e.steps[s] }), disabled: pos === 0, onClick: () => move(pos, pos - 1) }, "↑");
      const down = h("button", { type: "button", class: "btn-ghost !px-2 !py-0.5", "aria-label": t("Move down: {step}", { step: e.steps[s] }), disabled: pos === cur.length - 1, onClick: () => move(pos, pos + 1) }, "↓");
      const li = h("li", { class: "opt flex items-center gap-2 !py-2", draggable: "true", "data-step": String(s) },
        h("span", { class: "mute text-xs w-5 shrink-0" }, `${pos + 1}.`), h("span", { class: "flex-1" }, e.steps[s]), up, down);
      li.addEventListener("dragstart", (ev) => { dragFrom = pos; ev.dataTransfer.effectAllowed = "move"; });
      li.addEventListener("dragover", (ev) => ev.preventDefault());
      li.addEventListener("drop", (ev) => { ev.preventDefault(); if (dragFrom != null) move(dragFrom, pos); dragFrom = null; });
      return li;
    }));
    if (focus != null) list.children[focus]?.querySelector("button:not(:disabled)")?.focus();
  };
  draw();
  const { btn, out } = checker(() => {
    const right = cur.filter((s, pos) => s === pos).length;
    [...list.children].forEach((li, pos) => li.classList.toggle("opt-ok", cur[pos] === pos));
    return right === cur.length ? { ok: true, msg: t("✓ Correct! Every step is in the right place.") }
      : { ok: false, msg: t("{n} of {all} steps are in the right place (in green). Move the others.", { n: right, all: cur.length }) };
  }, ctx.onSolved);
  return [list, h("div", {}, btn), out];
}

/* ---------- match pairs / sort into groups ---------- */
// rows: [{ label, want }], choices: [...] — one select per row.
function selects(rows, choices, ctx, okMsg) {
  const opts = shuffle(choices);
  const sels = rows.map((r) => h("select", { class: "input !py-1.5 text-sm w-full", "aria-label": r.label },
    h("option", { value: "" }, t("Choose…")), opts.map((c) => h("option", { value: c }, c))));
  const list = h("ul", { class: "grid gap-2" }, rows.map((r, i) => h("li", { class: "opt grid gap-2 sm:grid-cols-2 sm:items-center !py-2" },
    h("span", {}, r.label), sels[i])));
  const { btn, out } = checker(() => {
    const empty = sels.filter((x) => !x.value).length;
    if (empty) return { ok: false, msg: t("Choose an answer for every line first ({n} left).", { n: empty }) };
    let right = 0;
    rows.forEach((r, i) => { const ok = sels[i].value === r.want; if (ok) right++; list.children[i].classList.toggle("opt-ok", ok); list.children[i].classList.toggle("opt-bad", !!sels[i].value && !ok); });
    return right === rows.length ? { ok: true, msg: okMsg } : { ok: false, msg: t("{n} of {all} right (in green). Change the others.", { n: right, all: rows.length }) };
  }, ctx.onSolved);
  return [list, h("div", {}, btn), out];
}
const match = (e, ctx) => selects(shuffle(e.pairs.map(([a, b]) => ({ label: a, want: b }))), [...new Set(e.pairs.map((p) => p[1]))], ctx, t("✓ Correct! Every pair matches."));
const groups = (e, ctx) => selects(shuffle(e.groups.flatMap((g) => g.items.map((it) => ({ label: it, want: g.name })))), e.groups.map((g) => g.name), ctx, t("✓ Correct! Everything is in the right group."));

/* ---------- spot the bug ---------- */
function bug(e, ctx) {
  const want = new Set(e.bug), picked = new Set();
  const lines = e.given.code.split("\n");
  const box = h("div", { class: "codeblock !p-0 overflow-x-auto", dir: "ltr", role: "group", "aria-label": t("Code lines: tap the line with the bug") },
    lines.map((l, i) => {
      const b = h("button", { type: "button", class: "bugline", "aria-pressed": "false", onClick: () => {
        picked.has(i + 1) ? picked.delete(i + 1) : picked.add(i + 1);
        b.setAttribute("aria-pressed", String(picked.has(i + 1)));
      } }, h("span", { class: "mute select-none w-6 shrink-0 text-right" }, String(i + 1)), h("code", {}, l || " "));
      return b;
    }));
  const { btn, out } = checker(() => {
    if (!picked.size) return { ok: false, msg: t("Tap the line that holds the bug first.") };
    const ok = picked.size === want.size && [...picked].every((n) => want.has(n));
    if (ok) return { ok: true, msg: t("✓ Correct! That is the line with the bug.") };
    const right = [...picked].filter((n) => want.has(n)).length;
    return { ok: false, msg: right ? t("Partly: some of your lines are right, but not all of them.") : t("Not this one. Read the code again, line by line.") };
  }, ctx.onSolved);
  return [h("p", { class: "mute text-xs" }, tn(want.size, "Tap the line with the bug, then check.", "Tap the {n} lines with bugs, then check.")), box, h("div", {}, btn), out];
}

/* ---------- branching scenario ---------- */
function scenario(e, ctx) {
  const wrap = h("div", { class: "grid gap-3" });
  let firstTry = 0;
  const step = (i) => {
    const s = e.steps[i];
    let missed = false;
    const why = h("div", { class: "text-sm", "aria-live": "polite" });
    const shown = shuffle(s.options);
    const opts = shown.map((o) => h("button", { type: "button", class: "opt", onClick: (ev) => {
      const b = ev.currentTarget;
      b.disabled = true;
      if (o.ok) {
        opts.forEach((x) => { x.disabled = true; }); b.classList.add("opt-ok");
        if (!missed) firstTry++;
        const last = i === e.steps.length - 1;
        why.replaceChildren(say(t("✓ Good call."), OK), h("p", { class: "mute" }, o.why),
          last ? say(t("Scenario complete: best choice at the first try in {n} of {all} steps.", { n: firstTry, all: e.steps.length }), OK)
            : h("button", { type: "button", class: "btn mt-2", onClick: (x) => { x.currentTarget.remove(); step(i + 1); } }, t("Next →")));
        if (last) ctx.onSolved();
      } else {
        missed = true; b.classList.add("opt-bad");
        why.replaceChildren(say(t("✗ Not the best choice."), BAD), h("p", { class: "mute" }, o.why), h("p", { class: "mute text-xs" }, t("Try another option.")));
      }
    } }, o.text));
    wrap.append(h("div", { class: "grid gap-2", "data-scenario-step": String(i) },
      h("p", { class: "eyebrow" }, t("Step {n} of {all}", { n: i + 1, all: e.steps.length })),
      h("p", { class: "text-sm" }, s.text), h("div", { class: "grid gap-2" }, opts), why));
  };
  step(0);
  return [wrap];
}

/* ---------- regex extraction ---------- */
function regex(e, ctx) {
  const lines = e.data ? dataFile(e.data).then((x) => x.replace(/\n$/, "").split("\n")) : Promise.resolve(e.lines || []);
  const flags = e.flags || "";
  const box = h("input", { class: "input font-mono flex-1 min-w-0", type: "text", spellcheck: "false", autocapitalize: "off", autocorrect: "off",
    "aria-label": t("Your regular expression"), placeholder: t("Your regex, e.g. (\\d+) ms") });
  const sample = e.data ? dataViewer(e.data) : h("pre", { class: "codeblock !text-xs max-h-60 overflow-auto", dir: "ltr" }, h("code", {}, (e.lines || []).join("\n")));
  const list = (vals) => h("code", { class: "inline-code !text-xs break-all" }, vals.slice(0, 12).map((v) => JSON.stringify(v)).join(", ") + (vals.length > 12 ? " …" : ""));
  const { btn, out } = checker(async () => {
    const src = box.value.replace(/^\/(.*)\/[a-z]*$/, "$1");
    if (!src) { box.focus(); return { ok: false, msg: "" }; }
    if (!makeRegex(src, flags)) return { ok: false, msg: t("This regex does not compile. Check the brackets and escapes."), color: BAD };
    const ls = await lines;
    const want = regexValues(e.answer, flags, ls), got = regexValues(src, flags, ls);
    const cmp = compareValues(want, got);
    const extra = h("div", { class: "grid gap-1 text-xs" },
      h("p", {}, tn(got.length, "Your regex extracts {n} value:", "Your regex extracts {n} values:"), " ", got.length ? list(got) : "—"),
      cmp.missing.length ? h("p", {}, t("Missing:"), " ", list(cmp.missing)) : null,
      cmp.extra.length ? h("p", {}, t("Not expected:"), " ", list(cmp.extra)) : null);
    if (cmp.ok) return { ok: true, msg: t("✓ Correct! Your regex extracts exactly the expected values."), extra };
    return { ok: false, extra, msg: cmp.sameSet ? t("Almost: the right values, but not in the order of the lines.")
      : t("Not yet: the expected result has {want} values. Use a group ( ) around the part to extract.", { want: want.length }) };
  }, ctx.onSolved);
  box.addEventListener("keydown", (ev) => { if (ev.key === "Enter") { ev.preventDefault(); btn.click(); } });
  return [sample, h("div", { class: "flex items-center gap-2" }, h("span", { class: "mute font-mono" }, "/"), box,
    h("span", { class: "mute font-mono" }, `/${flags}g`)), h("div", {}, btn), out];
}

/* ---------- cron expressions ---------- */
const when = (d) => new Intl.DateTimeFormat(lang === "fr" ? "fr-FR" : "en-GB",
  { weekday: "short", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "UTC" }).format(d);
function cron(e, ctx) {
  const box = h("input", { class: "input font-mono flex-1 min-w-0", type: "text", spellcheck: "false", autocapitalize: "off", autocorrect: "off",
    "aria-label": t("Your cron expression"), placeholder: "m h dom mon dow" });
  const { btn, out } = checker(() => {
    if (!box.value.trim()) { box.focus(); return { ok: false, msg: "" }; }
    let runs;
    try { runs = nextRuns(box.value, 5); } catch (err) { return { ok: false, msg: t("Not a valid cron expression: {msg}", { msg: err.message }), color: BAD }; }
    const extra = h("div", { class: "text-xs grid gap-1" }, h("p", { class: "mute" }, t("Your schedule runs next (from 1 Jan 2027):")),
      runs.length ? h("ul", { class: "font-mono grid gap-0.5" }, runs.map((d) => h("li", {}, when(d)))) : h("p", {}, t("Never.")));
    return sameCron(box.value, e.answer) ? { ok: true, msg: t("✓ Correct! It runs exactly when asked."), extra }
      : { ok: false, msg: t("Not yet: it does not run at the times asked. Compare the next runs with the question."), extra };
  }, ctx.onSolved);
  box.addEventListener("keydown", (ev) => { if (ev.key === "Enter") { ev.preventDefault(); btn.click(); } });
  return [h("p", { class: "mute text-xs font-mono" }, t("minute · hour · day of month · month · day of week")),
    h("div", { class: "flex flex-wrap gap-2" }, box, btn), out];
}

const KINDS = { fill, predict: fill, order, match, groups, bug, scenario, regex, cron };
export function kindLabel(k) {
  switch (k) {
    case "fill": return t("Fill in the blank");
    case "predict": return t("Predict the output");
    case "order": return t("Put in order");
    case "match": return t("Match the pairs");
    case "groups": return t("Sort into groups");
    case "bug": return t("Spot the bug");
    case "scenario": return t("Scenario");
    case "regex": return t("Regex");
    case "cron": return t("Cron");
    default: return "";
  }
}
export const isAuto = (e) => !!KINDS[e.kind];

// The interactive part of an auto-checked exercise; ctx = { onSolved, codeBlock }.
export function autoExercise(e, ctx) {
  return h("div", { class: "grid gap-3", "data-kind": e.kind }, KINDS[e.kind](e, ctx));
}
