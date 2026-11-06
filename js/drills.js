// Auto-graded exercise formats for the Practice tab (training steps 2b + 2c, 2026-11-06). An exercise with a "type"
// (content/courses/<id>.json, same in the French copy) is drawn here instead of the free scratch box; a correct
// answer calls onSolved() (practice.js marks the exercise solved). The checks live in drillcheck.js (shared with CI).
// No engine to download: everything runs in this browser, nothing is sent anywhere.
//   choice   { q, snippet?, lang?, mono?, options: [..], correct: index, answer }    predict the output / pick one
//   fill     { q, snippet? with ___ blanks, lang?, blanks: [[accepted..]], exact?, answer }   one blank if no snippet
//   order    { q, steps: [.. in the right order], answer }                          put the steps in order (↑ ↓ or drag)
//   match    { q, pairs: [[left, right]..], answer }                                match each left item to its pair
//   groups   { q, groups: [{ name, items: [..] }], answer }                        sort items into groups
//   bug      { q, snippet, lang?, line: n (1-based), fix?, answer }                tap the line with the bug
//   scenario { q, steps: [{ text, choices: [{ label, best?, feedback }] }], answer }  branching: each choice has a consequence
//   logs     { q, file: "logs/<name>.log" (content/), fields: [{ label, accept: [..] }], answer }   read a log, answer
//   regex    { q, code: "regex", text? | file?, mode: "lines" | "extract", flags?, answer: pattern, explain }  result = the answer's
//   cron     { q, code: "cron", answer: expression, explain }                      same run times as the answer
//   json     { q, code: "jq", file: "data/<name>.json", answer: jq filter, explain } same output as the answer's filter
//   fixfile  { q, code: "yaml" | "dockerfile", start: the file to fix, rules: [id | { id, ...params }], answer: a fixed
//            file, explain }   edit the file until every check passes (Kubernetes, GitHub Actions, Dockerfile; step 2d,
//            rules in filecheck.js, loaded on demand with the self-hosted YAML parser); edits kept until the page reloads
// (regex, cron, json and fixfile keep the solution in answer, shown as code, and the explanation in explain.)
// Accepted answers: equal after trimming and ignoring case and extra spaces, or "/regex/flags" (drillcheck.accepts).
// solution(e) draws the worked answer shown by "Reveal the answer" (before the explanation in e.answer).
import { h } from "./lib.js";
import { t, tn, lang } from "./i18n.js";
import { accepts, parseCron, sameCron, nextRuns, jq, sameList } from "./drillcheck.js";

export const DRILL_TYPES = ["choice", "fill", "order", "match", "groups", "bug", "scenario", "logs", "regex", "cron", "json", "fixfile"];
const OK = "#18a999", BAD = "#e0508b", WARN = "#f08a24";
const say = (text, color) => h("p", { class: "text-sm font-medium", style: color ? `color:${color}` : "" }, text);
const out = () => h("div", { class: "grid gap-2", "aria-live": "polite" });
const shuffle = (a) => { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };
// A shuffle that is never the answer itself (when there is more than one item).
const mixed = (n) => { let p = shuffle([...Array(n).keys()]); if (n > 1 && p.every((x, i) => x === i)) p = [...p.slice(1), p[0]]; return p; };
const pre = (code, lang) => h("pre", { class: "codeblock", "data-lang": lang || "", dir: "ltr" }, h("code", {}, code));
const btn = (label, onClick, cls = "btn") => h("button", { type: "button", class: cls, onClick }, label);
const mark = (el, ok) => { el.style.borderColor = ok == null ? "" : ok ? OK : BAD; };
const plain = (list) => (list || []).find((a) => !/^\/.+\/[a-z]*$/s.test(a)) ?? list?.[0] ?? "";
const files = new Map();
export function loadFile(file) {
  if (!files.has(file)) files.set(file, fetch(new URL(`../content/${file}`, import.meta.url)).then((r) => {
    if (!r.ok) throw new Error(String(r.status));
    return r.text();
  }).catch((err) => { files.delete(file); throw err; }));
  return files.get(file);
}

/* ---------- choice: predict the output / pick the right one ---------- */
function choice(e, done) {
  const fb = out();
  const opts = e.options.map((o, k) => h("button", { type: "button", class: `opt ${e.mono ? "font-mono" : ""}`, onClick: () => pick(k) }, o));
  function pick(k) {
    if (k === e.correct) { opts.forEach((b) => { b.disabled = true; }); opts[k].classList.add("opt-ok"); fb.replaceChildren(say(t("✓ Correct!"), OK)); done(); }
    else { opts[k].classList.add("opt-bad"); opts[k].disabled = true; fb.replaceChildren(say(t("✗ Not this one. Try again."), BAD)); }
  }
  return [e.snippet ? pre(e.snippet, e.lang) : null, h("div", { class: "grid gap-2 sm:grid-cols-2" }, opts), fb];
}

/* ---------- fill in the blanks ---------- */
function fill(e, done) {
  const fb = out();
  const width = (acc) => Math.max(4, ...acc.filter((a) => !a.startsWith("/")).map((a) => a.length)) + 2;
  const inputs = e.blanks.map((acc, k) => h("input", { class: "input font-mono !py-0.5 !px-1.5", style: e.snippet ? `width:${width(acc)}ch` : "",
    "aria-label": e.blanks.length > 1 ? t("Blank {n}", { n: k + 1 }) : t("Your answer"), autocapitalize: "off", autocorrect: "off", spellcheck: "false",
    onKeydown: (ev) => { if (ev.key === "Enter") { ev.preventDefault(); check(); } } }));
  function check() {
    const res = inputs.map((inp, k) => accepts(e.blanks[k], inp.value, e.exact));
    res.forEach((ok, k) => mark(inputs[k], ok));
    const wrong = res.filter((x) => !x).length;
    if (!wrong) { fb.replaceChildren(say(t("✓ Correct!"), OK)); done(); }
    else fb.replaceChildren(say(e.blanks.length > 1 ? tn(wrong, "{n} blank is not right yet.", "{n} blanks are not right yet.") : t("Not yet. Check your answer and try again."), WARN));
  }
  let body;
  if (e.snippet) {
    const parts = e.snippet.split("___");
    body = h("pre", { class: "codeblock", "data-lang": e.lang || "", dir: "ltr" }, h("code", {}, parts.flatMap((p, k) => (k < inputs.length ? [p, inputs[k]] : [p]))));
  } else body = h("div", { class: "grid" }, inputs[0]);
  return [body, h("div", {}, btn(t("✓ Check my answer"), check)), fb];
}

/* ---------- put the steps in order ---------- */
function order(e, done) {
  let cur = mixed(e.steps.length), solved = false, drag = null;
  const fb = out(), list = h("ol", { class: "grid gap-2" });
  const move = (from, to) => {
    if (solved || to < 0 || to >= cur.length || from === to) return;
    const [x] = cur.splice(from, 1); cur.splice(to, 0, x); draw(); fb.replaceChildren();
    list.querySelectorAll("li")[to]?.querySelector(`[data-dir="${to < from ? "up" : "down"}"]`)?.focus();
  };
  const arrow = (dir, pos, label) => h("button", { type: "button", class: "btn-ghost !px-2 !py-0.5", "data-dir": dir, "aria-label": label,
    disabled: solved || (dir === "up" ? pos === 0 : pos === cur.length - 1), onClick: () => move(pos, dir === "up" ? pos - 1 : pos + 1) }, dir === "up" ? "↑" : "↓");
  function draw(marks) {
    list.replaceChildren(...cur.map((idx, pos) => {
      const li = h("li", { class: "panel !shadow-none !p-2 flex items-center gap-2", draggable: solved ? false : "true",
        onDragstart: (ev) => { drag = pos; ev.dataTransfer.effectAllowed = "move"; },
        onDragover: (ev) => ev.preventDefault(),
        onDrop: (ev) => { ev.preventDefault(); if (drag != null) move(drag, pos); drag = null; } },
      h("span", { class: "mute text-xs w-5 text-center shrink-0" }, String(pos + 1)),
      h("span", { class: "flex-1 text-sm" }, e.steps[idx]),
      arrow("up", pos, t("Move up")), arrow("down", pos, t("Move down")));
      if (marks) mark(li, idx === pos);
      return li;
    }));
  }
  function check() {
    const right = cur.filter((idx, pos) => idx === pos).length;
    if (right === cur.length) { solved = true; draw(true); fb.replaceChildren(say(t("✓ Correct! Everything is in the right order."), OK)); done(); }
    else { draw(true); fb.replaceChildren(say(t("{d} of {n} in the right place. Move the others and check again.", { d: right, n: cur.length }), WARN)); }
  }
  draw();
  return [h("p", { class: "mute text-xs" }, t("Use ↑ ↓ (or drag) to put the steps in order.")), list, h("div", {}, btn(t("✓ Check my answer"), check)), fb];
}

/* ---------- match pairs / sort into groups (a list of dropdowns) ---------- */
function picker(rows, choices, done, okText) {
  const fb = out();
  const sels = rows.map(([label]) => h("select", { class: "input w-full sm:w-auto sm:min-w-[12rem]", "aria-label": label },
    h("option", { value: "" }, t("Choose…")), choices.map((c) => h("option", { value: c }, c))));
  sels.forEach((s) => s.addEventListener("change", () => mark(s, null)));
  function check() {
    const res = sels.map((s, k) => s.value === rows[k][1]);
    res.forEach((ok, k) => mark(sels[k], ok));
    const right = res.filter(Boolean).length;
    if (right === rows.length) { sels.forEach((s) => { s.disabled = true; }); fb.replaceChildren(say(okText, OK)); done(); }
    else fb.replaceChildren(say(t("{d} of {n} right. Change the red ones and check again.", { d: right, n: rows.length }), WARN));
  }
  return [h("ul", { class: "grid gap-2" }, rows.map(([label], k) => h("li", { class: "grid gap-1 sm:flex sm:items-center sm:gap-3" },
    h("span", { class: "text-sm flex-1" }, label), sels[k]))), h("div", {}, btn(t("✓ Check my answer"), check)), fb];
}
function match(e, done) {
  const order = mixed(e.pairs.length);
  return picker(order.map((i) => e.pairs[i]), shuffle(e.pairs.map((p) => p[1])), done, t("✓ Correct! Every pair matches."));
}
function groups(e, done) {
  const rows = shuffle(e.groups.flatMap((g) => g.items.map((it) => [it, g.name])));
  return picker(rows, e.groups.map((g) => g.name), done, t("✓ Correct! Everything is in the right group."));
}

/* ---------- spot the bug: tap the line ---------- */
function bug(e, done) {
  const fb = out();
  const lines = e.snippet.split("\n").map((text, k) => h("button", { type: "button", class: "block w-full text-left px-2 rounded hover:bg-[var(--soft)]",
    style: "border-left:3px solid transparent", "aria-label": t("Line {n}", { n: k + 1 }), onClick: () => pick(k) },
    h("span", { class: "mute select-none inline-block w-6 text-right mr-3" }, String(k + 1)), text || " "));
  function pick(k) {
    if (k + 1 === e.line) {
      lines.forEach((b) => { b.disabled = true; }); lines[k].style.borderLeftColor = OK;
      fb.replaceChildren(say(t("✓ Found it: line {n}. Reveal the answer to see the fix.", { n: k + 1 }), OK)); done();
    } else { lines[k].style.borderLeftColor = BAD; fb.replaceChildren(say(t("✗ Line {n} is fine. Look again.", { n: k + 1 }), BAD)); }
  }
  return [h("p", { class: "mute text-xs" }, t("Tap the line that has the bug.")),
    h("div", { class: "codeblock !p-2 font-mono text-[.8rem] whitespace-pre overflow-x-auto", "data-lang": e.lang || "", dir: "ltr" }, lines), fb];
}

/* ---------- branching scenario ---------- */
function scenario(e, done) {
  let step = 0, firstTry = 0, missed = false;
  const box = h("div", { class: "grid gap-3" });
  function draw() {
    if (step >= e.steps.length) {
      box.replaceChildren(say(t("✓ Scenario complete: {d} of {n} decisions right the first time.", { d: firstTry, n: e.steps.length }), OK));
      done(); return;
    }
    const s = e.steps[step], fb = out();
    const next = btn(step + 1 < e.steps.length ? t("Next →") : t("Finish"), () => { step++; missed = false; draw(); });
    next.hidden = true;
    const opts = s.choices.map((c, k) => h("button", { type: "button", class: "opt", onClick: () => pick(c, k) }, c.label));
    function pick(c, k) {
      fb.replaceChildren(h("p", { class: "text-sm" }, h("b", { style: `color:${c.best ? OK : BAD}` }, c.best ? t("Good call.") : t("Risky.")), " ", c.feedback));
      opts[k].classList.add(c.best ? "opt-ok" : "opt-bad"); opts[k].disabled = true;
      if (c.best) { if (!missed) firstTry++; opts.forEach((b) => { b.disabled = true; }); next.hidden = false; next.focus(); }
      else missed = true;
    }
    box.replaceChildren(h("p", { class: "mute text-xs" }, t("Step {n} of {all}", { n: step + 1, all: e.steps.length })),
      h("p", { class: "text-sm rounded-xl p-3", style: "background:var(--soft)" }, s.text), h("div", { class: "grid gap-2" }, opts), fb, h("div", {}, next));
  }
  draw();
  return [box];
}

/* ---------- read a log (or any text file) and answer ---------- */
function fileView(file, { filter = true } = {}) {
  const view = h("div", { class: "codeblock !p-2 font-mono text-[.75rem] !whitespace-pre-wrap [overflow-wrap:anywhere] overflow-auto max-h-80", dir: "ltr", tabindex: "0", "aria-label": file });
  const count = h("span", { class: "mute text-xs" });
  const q = h("input", { class: "input !py-1 text-xs flex-1 font-mono", type: "search", "aria-label": t("Filter the lines"), placeholder: t("Filter: words that every line must contain…"),
    autocapitalize: "off", autocorrect: "off", spellcheck: "false" });
  let lines = [];
  const draw = () => {
    const words = q.value.toLowerCase().split(/\s+/).filter(Boolean);
    const shown = lines.map((l, i) => [i + 1, l]).filter(([, l]) => words.every((w) => l.toLowerCase().includes(w)));
    view.replaceChildren(...shown.map(([n, l]) => h("div", { class: "flex" }, h("span", { class: "mute select-none shrink-0 w-8 text-right mr-2" }, String(n)), h("span", { class: "min-w-0" }, l))));
    count.textContent = t("{d} of {n} lines", { d: shown.length, n: lines.length });
  };
  q.addEventListener("input", draw);
  view.textContent = t("Loading…");
  const ready = loadFile(file).then((text) => { lines = text.replace(/\n$/, "").split(/\r?\n/); draw(); return text; })
    .catch(() => { view.textContent = t("Could not load the file. Check your connection and try again."); return ""; });
  return { ready, el: h("div", { class: "grid gap-2" }, filter ? h("div", { class: "flex flex-wrap items-center gap-2" }, q, count) : null, view) };
}
function logs(e, done) {
  const fb = out(), v = fileView(e.file);
  const inputs = e.fields.map((f) => h("input", { class: "input w-full font-mono", "aria-label": f.label, autocapitalize: "off", autocorrect: "off", spellcheck: "false",
    onKeydown: (ev) => { if (ev.key === "Enter") { ev.preventDefault(); check(); } } }));
  function check() {
    const res = inputs.map((inp, k) => accepts(e.fields[k].accept, inp.value, e.fields[k].exact));
    res.forEach((ok, k) => mark(inputs[k], ok));
    const wrong = res.filter((x) => !x).length;
    if (!wrong) { fb.replaceChildren(say(t("✓ Correct!"), OK)); done(); }
    else fb.replaceChildren(say(tn(wrong, "{n} answer is not right yet.", "{n} answers are not right yet."), WARN));
  }
  return [v.el, h("div", { class: "grid gap-2" }, e.fields.map((f, k) => h("label", { class: "grid gap-1 text-sm" }, h("span", { class: "font-medium" }, f.label), inputs[k]))),
    h("div", {}, btn(t("✓ Check my answer"), check)), fb];
}

/* ---------- regex on a sample ---------- */
function regex(e, done) {
  const fb = out();
  const text = e.text != null ? Promise.resolve(e.text) : loadFile(e.file);
  const pat = h("input", { class: "input font-mono flex-1 min-w-0", "aria-label": t("Your regular expression"), placeholder: t("Your pattern, without slashes"),
    autocapitalize: "off", autocorrect: "off", spellcheck: "false", onKeydown: (ev) => { if (ev.key === "Enter") { ev.preventDefault(); check(); } } });
  const flags = h("input", { class: "input font-mono w-12 shrink-0 !px-2", value: e.flags || "", placeholder: "i", "aria-label": t("Flags (i = ignore case)"), title: t("Flags (i = ignore case)"),
    autocapitalize: "off", autocorrect: "off", spellcheck: "false" });
  const sample = h("div", { class: "codeblock !p-2 font-mono text-[.75rem] !whitespace-pre-wrap [overflow-wrap:anywhere] overflow-auto max-h-72 grid gap-1", dir: "ltr" }, t("Loading…"));
  let lines = [], expected = null;
  const paint = (mine, want) => {
    if (e.mode !== "lines") { sample.replaceChildren(...lines.map((l) => h("div", {}, l))); return; }
    const M = new Set(mine || []), W = new Set(want || []);
    sample.replaceChildren(...lines.map((l) => {
      const got = M.has(l), need = W.has(l);
      const tag = !mine ? "" : got && need ? "✓" : got ? "✗" : need ? "…" : "";
      return h("div", { class: "flex", style: !mine ? "" : got && need ? `color:${OK}` : got ? `color:${BAD}` : need ? `color:${WARN}` : "opacity:.6" },
        h("span", { class: "select-none shrink-0 w-4" }, tag), h("span", { class: "min-w-0" }, l));
    }));
  };
  text.then((s) => { lines = s.split(/\r?\n/).filter((l) => l.length); paint(); }).catch(() => { sample.textContent = t("Could not load the file. Check your connection and try again."); });
  const errText = (err) => (err.message === "timeout" ? t("Your pattern took too long and was stopped (too much backtracking).") : t("Invalid pattern: {msg}", { msg: err.message }));
  async function check() {
    if (!pat.value) { pat.focus(); return; }
    const [{ runRegex }, s] = await Promise.all([import("./regexrun.js"), text]);
    try { expected ||= await runRegex(e.answer, e.flags || "", s, e.mode); } catch (err) { fb.replaceChildren(say(errText(err), BAD)); return; }
    let mine;
    try { mine = await runRegex(pat.value, flags.value, s, e.mode); } catch (err) { paint(); fb.replaceChildren(say(errText(err), BAD)); return; }
    paint(mine, expected);
    if (sameList(mine, expected)) { fb.replaceChildren(say(t("✓ Correct! Your pattern gives exactly the expected result."), OK)); done(); return; }
    if (e.mode === "lines") {
      const W = new Set(expected), M = new Set(mine);
      const extra = mine.filter((l) => !W.has(l)).length, missing = expected.filter((l) => !M.has(l)).length;
      fb.replaceChildren(say(t("Not yet: {extra} line(s) matched that should not be (✗), {missing} line(s) missed (…).", { extra, missing }), WARN));
    } else {
      fb.replaceChildren(say(t("Not yet: your pattern finds {got} value(s), the expected answer finds {want}.", { got: mine.length, want: expected.length }), WARN),
        mine.length ? h("p", { class: "text-xs font-mono break-words" }, t("Yours: {list}", { list: mine.slice(0, 12).join(" · ") + (mine.length > 12 ? " …" : "") })) : null);
    }
  }
  return [h("p", { class: "mute text-xs" }, e.mode === "lines" ? t("Write a pattern that matches exactly the lines asked for (like grep).") : t("Write a pattern that extracts the values asked for (use a ( ) group to keep only part of the match).")),
    sample, h("div", { class: "flex items-center gap-1.5" }, h("span", { class: "font-mono mute" }, "/"), pat, h("span", { class: "font-mono mute" }, "/"), flags),
    h("p", { class: "mute text-xs -mt-1" }, t("Flags (i = ignore case)")), h("div", {}, btn(t("✓ Check my answer"), check)), fb];
}

/* ---------- cron expression ---------- */
const CRON_FIELDS = ["minute", "hour", "day of month", "month", "day of week"];
function cron(e, done) {
  const fb = out();
  const inp = h("input", { class: "input font-mono w-full sm:w-72", "aria-label": t("Your cron expression"), placeholder: "* * * * *",
    autocapitalize: "off", autocorrect: "off", spellcheck: "false", onKeydown: (ev) => { if (ev.key === "Enter") { ev.preventDefault(); check(); } } });
  const fmt = new Intl.DateTimeFormat(lang === "fr" ? "fr-FR" : "en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
  function check() {
    const v = inp.value.trim();
    if (!v) { inp.focus(); return; }
    let runs;
    try { runs = nextRuns(v, new Date(), 5); } catch (err) {
      const m = /^field:(\d)$/.exec(err.message);
      fb.replaceChildren(say(m ? t("The {field} field is not valid.", { field: t(CRON_FIELDS[m[1]]) }) : t("A cron expression has 5 fields: minute hour day-of-month month day-of-week."), BAD));
      return;
    }
    const ok = sameCron(v, e.answer);
    if (ok) done();
    fb.replaceChildren(say(ok ? t("✓ Correct! Same schedule as the expected answer.") : t("Not yet: this runs at other times than asked."), ok ? OK : WARN),
      h("p", { class: "mute text-xs" }, t("Your expression runs next at:")),
      h("ul", { class: "text-xs font-mono grid gap-0.5" }, runs.length ? runs.map((d) => h("li", {}, fmt.format(d))) : h("li", {}, t("never (no matching date)"))));
  }
  return [h("p", { class: "mute text-xs font-mono" }, t("minute hour day-of-month month day-of-week")), h("div", { class: "flex flex-wrap gap-2" }, inp, btn(t("✓ Check my answer"), check)), fb];
}

/* ---------- JSON with a jq filter ---------- */
const JQ_ERR = {
  syntax: "jq could not read this filter. Check the dots, brackets, quotes and parentheses.",
  key: "A .key was used on something that is not an object.",
  index: "An [n] index was used on something that is not a list.",
  iterate: "[] was used on something that is not a list or an object.",
  length: "length only works on lists, objects, strings and numbers.",
  keys: "keys only works on objects and lists.",
  size: "The filter returns too many values.",
};
function json(e, done) {
  const fb = out(), v = fileView(e.file, { filter: false });
  const inp = h("input", { class: "input font-mono flex-1 min-w-[12rem]", "aria-label": t("Your jq filter"), placeholder: ".items[] | .name",
    autocapitalize: "off", autocorrect: "off", spellcheck: "false", onKeydown: (ev) => { if (ev.key === "Enter") { ev.preventDefault(); check(); } } });
  const show = (vals) => h("pre", { class: "codeblock !text-[.75rem] max-h-56 overflow-auto", dir: "ltr" }, h("code", {}, vals.map((x) => JSON.stringify(x, null, 2)).join("\n") || " "));
  async function check() {
    if (!inp.value.trim()) { inp.focus(); return; }
    const text = await v.ready;
    let data, mine, want;
    try { data = JSON.parse(text); want = jq(e.answer, data); } catch { fb.replaceChildren(say(t("Could not load the file. Check your connection and try again."), BAD)); return; }
    try { mine = jq(inp.value, data); } catch (err) { fb.replaceChildren(say(t(JQ_ERR[err.message.replace(/^jq:/, "")] || JQ_ERR.syntax), BAD)); return; }
    const ok = sameList(mine, want);
    if (ok) done();
    fb.replaceChildren(say(ok ? t("✓ Correct! Same output as the expected answer.") : t("Not yet: your filter returns {got} value(s), the expected answer returns {want}.", { got: mine.length, want: want.length }), ok ? OK : WARN),
      h("p", { class: "mute text-xs" }, t("Your output:")), show(mine));
  }
  return [v.el, h("p", { class: "mute text-xs" }, t("Supported: .key .[n] .[] [ … ] | length keys select(… == value)")),
    h("div", { class: "flex flex-wrap items-center gap-2" }, h("span", { class: "font-mono mute" }, "jq"), inp, btn(t("✓ Check my answer"), check)), fb];
}

/* ---------- fix this file (Kubernetes, GitHub Actions, Dockerfile) ---------- */
const drafts = new Map(); // edits survive a tab switch, not a reload
const tr = (x) => t(x.m, x.p);
function fixfile(e, done) {
  const fb = out(), key = e.start;
  const lines = e.start.split("\n").length;
  const area = h("textarea", { class: "input font-mono !text-[.75rem] !leading-5 w-full whitespace-pre overflow-auto", rows: Math.min(28, lines + 2), wrap: "off", dir: "ltr",
    spellcheck: "false", autocapitalize: "off", autocorrect: "off", "aria-label": t("The file to fix"),
    onInput: () => drafts.set(key, area.value),
    onKeydown: (ev) => {
      // Tab indents with two spaces (YAML refuses tabs); Esc then Tab leaves the box.
      if (ev.key === "Tab" && !ev.shiftKey && !area.dataset.esc) { ev.preventDefault(); area.setRangeText("  ", area.selectionStart, area.selectionEnd, "end"); drafts.set(key, area.value); }
      area.dataset.esc = ev.key === "Escape" ? "1" : "";
    } });
  area.value = drafts.get(key) ?? e.start;
  const items = (e.rules || []).map(() => h("li", { class: "flex gap-2 items-start" }));
  let titles = items.map(() => ({ m: "…", p: {} })); // filled once filecheck.js has loaded
  const paint = (res) => items.forEach((li, k) => {
    const r = res?.[k];
    const icon = h("span", { class: "shrink-0 w-4 font-semibold", style: r ? `color:${r.ok ? OK : BAD}` : "" }, r ? (r.ok ? "✓" : "✗") : "○");
    li.replaceChildren(icon, h("div", { class: "grid gap-0.5 min-w-0" }, h("span", {}, tr(r?.title || titles[k])),
      r && !r.ok ? h("ul", { class: "grid gap-0.5 text-xs [overflow-wrap:anywhere]", style: `color:${BAD}` }, r.problems.map((p) => h("li", {}, tr(p)))) : null));
  });
  const lib = import("./filecheck.js");
  lib.then((m) => { titles = (e.rules || []).map(m.ruleTitle); paint(); }).catch(() => {});
  paint();
  async function check() {
    let m;
    try { m = await lib; } catch { fb.replaceChildren(say(t("Could not load the checker. Check your connection and try again."), BAD)); return; }
    const res = m.checkFile(e.code, area.value, e.rules);
    if (res.error) {
      paint();
      fb.replaceChildren(say(t("Line {line}: the file cannot be read.", { line: res.error.line }), BAD), h("p", { class: "text-xs font-mono [overflow-wrap:anywhere]", dir: "ltr" }, res.error.reason));
      return;
    }
    paint(res.results);
    const wrong = res.results.filter((r) => !r.ok).length;
    if (!wrong) { fb.replaceChildren(say(t("✓ Correct! Every check passes."), OK)); done(); }
    else fb.replaceChildren(say(tn(wrong, "{n} check still fails.", "{n} checks still fail."), WARN));
  }
  const reset = () => { area.value = e.start; drafts.delete(key); paint(); fb.replaceChildren(); };
  return [h("p", { class: "mute text-xs" }, e.code === "dockerfile" ? t("Edit the Dockerfile below, then check it.") : t("Edit the YAML below (indent with spaces), then check it.")),
    h("div", { class: "rounded-xl p-3 grid gap-1 text-sm", style: "background:var(--soft)" }, h("b", { class: "text-xs" }, t("The checks")), h("ul", { class: "grid gap-1.5" }, items)),
    area, h("div", { class: "flex flex-wrap gap-2" }, btn(t("✓ Check my file"), check), btn(t("↺ Start again"), reset, "btn-ghost")), fb];
}

const DRAW = { choice, fill, order, match, groups, bug, scenario, logs, regex, cron, json, fixfile };
export function drill(e, onSolved) {
  let fired = false;
  const done = () => { if (!fired) { fired = true; onSolved(); } };
  return h("div", { class: "grid gap-3", "data-drill": e.type }, DRAW[e.type](e, done));
}

// The worked answer shown by "Reveal the answer" (the explanation in e.answer follows it).
export function solution(e) {
  const box = (...kids) => h("div", { class: "grid gap-1 text-sm rounded-xl p-3", style: "background:var(--soft)" }, ...kids);
  const label = (s) => h("b", {}, s);
  switch (e.type) {
    case "choice": return box(label(t("Answer:")), h("span", { class: e.mono ? "font-mono" : "" }, e.options[e.correct]));
    case "fill": {
      const parts = (e.snippet || "___").split("___");
      return pre(parts.map((p, k) => (k < e.blanks.length ? p + plain(e.blanks[k]) : p)).join(""), e.lang);
    }
    case "order": return box(h("ol", { class: "list-decimal pl-5 grid gap-1" }, e.steps.map((s) => h("li", {}, s))));
    case "match": return box(h("ul", { class: "grid gap-1" }, e.pairs.map(([a, b]) => h("li", {}, a, " → ", h("b", {}, b)))));
    case "groups": return box(...e.groups.map((g) => h("p", {}, label(`${g.name}: `), g.items.join(" · "))));
    case "bug": return h("div", { class: "grid gap-2" }, box(label(t("The bug is on line {n}:", { n: e.line })), h("code", { class: "inline-code" }, e.snippet.split("\n")[e.line - 1].trim())),
      e.fix ? h("div", { class: "grid gap-1" }, h("p", { class: "mute text-xs" }, t("Fixed version:")), pre(e.fix, e.lang)) : null);
    case "scenario": return box(h("ol", { class: "list-decimal pl-5 grid gap-1" }, e.steps.map((s) => h("li", {}, s.choices.filter((c) => c.best).map((c) => c.label).join(" / ")))));
    case "logs": return box(...e.fields.map((f) => h("p", {}, label(`${f.label} `), h("code", { class: "inline-code" }, plain(f.accept)))));
    default: return null; // regex, cron, json, fixfile: the answer is the code shown below
  }
}
