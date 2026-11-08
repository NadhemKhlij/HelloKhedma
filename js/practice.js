// Interactive practice on a course page (courses.js), built from the course JSON, so it works in both languages
// without extra content:
// - quiz(): multiple-choice questions generated from the cheat sheet (syntax → meaning or meaning → syntax, distractors
//   from the same course), instant feedback, best score per course ("hk.quiz").
// - flashcards(): the cheat sheet as flip cards; "I knew it" cards are remembered per course ("hk.cards") and every
//   answer schedules the card for spaced-repetition reviews (srs.js, #/review); a link shows the cards due in the course.
//   flipCard() and makeQuestions() are shared with the review page (review.js) and the skill check (skillcheck.js).
// - exercises(): try first in a scratch box (not saved), reveal the answer, then grade yourself ("hk.exercises").
//   Runnable SQL exercises (exercise.run = { db, ordered?, minColumns?, plan? }, training step 2): ▶ Run shows the result
//   table on the practice dataset (sqlrun.js: SQLite in a Web Worker, nothing sent anywhere) and ✓ Check compares it
//   with the result of the course answer (sqlgrade.js); a correct result marks the exercise solved. With "start" (a
//   query, training step 2e: "fix this query"), the editor opens on that query and "↺ Start again" brings it back.
//   Auto-graded formats (exercise.type, training steps 2b, 2c + 2d, drills.js): choice, fill, order, match, groups, bug,
//   scenario, logs, regex, cron, json, fixfile; a correct answer marks the exercise solved, "Reveal" shows the worked answer.
// - Courses with a playground (DAX.do): written exercises with "try" get "▶ Run my attempt on …" (copies the attempt,
//   opens the playground in a new tab) and a ▶ button on the answer code (courses.js playLink).
// - interviewCards(): think first, then reveal the model answer.
// Everything stays in this browser (synced to the account when signed in, learnsync.js); each action adds XP (activity.js).
import { h, ls } from "./lib.js";
import { t, tn } from "./i18n.js";
import { logActivity } from "./activity.js";
import { drill, solution } from "./drills.js";
import { grade, dueCards } from "./srs.js";

const store = (key) => ({
  all() { try { return JSON.parse(ls.get(key) || "{}"); } catch { return {}; } },
  get(id) { return this.all()[id]; },
  set(id, v) { const a = this.all(); a[id] = v; ls.set(key, JSON.stringify(a)); },
});
const QUIZ = store("hk.quiz"), CARDS = store("hk.cards"), EX = store("hk.exercises");
export const quizBest = (id) => QUIZ.get(id) ?? null;
export const exercisesSolved = (id) => (EX.get(id) || []).length;

const shuffle = (a) => { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };
export const items = (c) => (c.cheatsheet || []).flatMap((g, gi) => g.items.map(([front, back], i) => ({ key: `${gi}:${i}`, group: g.group, front, back })));
const code = (s) => h("code", { class: "inline-code !text-[.85rem]" }, s);
const bar = (pct) => h("div", { class: "h-1.5 rounded-full", style: "background:var(--line)" },
  h("div", { class: "h-1.5 rounded-full", style: `width:${pct}%;background:var(--accent);transition:width .3s ease` }));

/* ---------- quiz ---------- */
export function makeQuestions(c, n = 8) {
  const all = items(c);
  return shuffle(all).slice(0, Math.min(n, all.length)).map((it, qi) => {
    const toMeaning = qi % 2 === 0; // alternate the direction
    const field = toMeaning ? "back" : "front";
    const seen = new Set([it[field]]);
    // distractors: same group first, then the rest of the course, never a duplicate text
    const pool = [...shuffle(all.filter((x) => x.group === it.group)), ...shuffle(all.filter((x) => x.group !== it.group))];
    const wrong = [];
    for (const x of pool) { if (wrong.length === 3) break; if (!seen.has(x[field])) { seen.add(x[field]); wrong.push(x); } }
    return { it, toMeaning, options: shuffle([it, ...wrong]) };
  });
}

export function quiz(root, c, { onReview } = {}) {
  let qs = makeQuestions(c), i = 0, score = 0;
  const draw = () => {
    if (!qs.length) { root.replaceChildren(h("p", { class: "mute text-sm" }, t("No quiz for this course yet."))); return; }
    if (i >= qs.length) return end();
    const { it, toMeaning, options } = qs[i];
    const feedback = h("p", { class: "text-sm min-h-[1.5rem]", "aria-live": "polite" });
    const next = h("button", { type: "button", class: "btn", hidden: true, onClick: () => { i++; draw(); } },
      i + 1 < qs.length ? t("Next question →") : t("See my score"));
    const opts = options.map((o) => h("button", { type: "button", class: "opt", onClick: (e) => answer(o, e.currentTarget) },
      toMeaning ? o.back : code(o.front)));
    function answer(o, btn) {
      const ok = o.key === it.key;
      opts.forEach((b, k) => { b.disabled = true; if (options[k].key === it.key) b.classList.add("opt-ok"); });
      if (!ok) btn.classList.add("opt-bad");
      if (ok) { score++; logActivity(2); }
      feedback.replaceChildren(ok
        ? h("span", { style: "color:#18a999" }, t("✓ Correct! +2 XP"))
        : h("span", {}, h("span", { style: "color:#e0508b" }, t("✗ Not quite. ")), h("span", { class: "mute" }, t("The answer: ")),
          toMeaning ? it.back : code(it.front)));
      next.hidden = false; next.focus();
    }
    root.replaceChildren(h("div", { class: "grid gap-4 max-w-2xl" },
      h("div", { class: "grid gap-2" },
        h("div", { class: "flex justify-between text-sm mute" }, h("span", {}, t("Question {n} of {all}", { n: i + 1, all: qs.length })),
          h("span", {}, t("Score {s}", { s: score }))),
        bar((i / qs.length) * 100)),
      h("div", {},
        h("p", { class: "eyebrow mb-2" }, toMeaning ? t("What does this do?") : t("Which one does this?")),
        h("p", { class: "text-lg font-medium" }, toMeaning ? code(it.front) : it.back),
        h("p", { class: "mute text-xs mt-1" }, it.group)),
      h("div", { class: "grid gap-2 sm:grid-cols-2" }, opts),
      h("div", { class: "flex flex-wrap items-center justify-between gap-3" }, feedback, next)));
    opts[0]?.focus({ preventScroll: true });
  };
  function end() {
    const best = Math.max(quizBest(c.id) ?? 0, score), pct = Math.round((score / qs.length) * 100);
    QUIZ.set(c.id, best);
    logActivity(5);
    const msg = pct === 100 ? t("Perfect score! 🎉") : pct >= 70 ? t("Well done, you know this well.") : pct >= 40 ? t("Good start. Review the cards and try again.") : t("Review the lessons and the cards, then try again.");
    root.replaceChildren(h("div", { class: "grid gap-4 max-w-2xl justify-items-start" },
      h("p", { class: "eyebrow" }, t("Quiz complete")),
      h("b", { class: "serif text-5xl" }, `${score}/${qs.length}`),
      h("p", {}, msg),
      h("p", { class: "mute text-sm" }, t("Best score: {best}/{all}", { best, all: qs.length })),
      h("div", { class: "flex flex-wrap gap-2" },
        h("button", { type: "button", class: "btn", onClick: () => { qs = makeQuestions(c); i = 0; score = 0; draw(); } }, t("↻ New quiz")),
        onReview ? h("button", { type: "button", class: "btn-ghost", onClick: onReview }, t("Review with flashcards")) : null)));
  }
  draw();
}

/* ---------- flashcards ---------- */
// One flip card (front: syntax, back: meaning). onFlip(flipped) after each tap.
export function flipCard(card, onFlip, { label = card.group } = {}) {
  let flipped = false;
  const el = h("button", { type: "button", class: "flip w-full", "aria-label": t("Show the answer"),
    onClick: () => { flipped = !flipped; el.classList.toggle("on", flipped); el.setAttribute("aria-label", flipped ? t("Show the front") : t("Show the answer")); onFlip(flipped); } },
    h("div", { class: "flip-inner" },
      h("div", { class: "face" }, h("span", { class: "eyebrow" }, label), h("code", { class: "text-lg font-mono break-words" }, card.front),
        h("span", { class: "mute text-xs" }, t("Tap to flip"))),
      h("div", { class: "face back" }, h("span", { class: "eyebrow" }, label), h("p", { class: "text-lg font-medium" }, card.back))));
  return el;
}

export function flashcards(root, c) {
  const all = items(c);
  let known = new Set(CARDS.get(c.id) || []), deck = shuffle(all.filter((x) => !known.has(x.key)));
  const save = () => CARDS.set(c.id, [...known]);
  // Cards of this course due for review (spaced repetition, #/review).
  const dueLink = () => {
    const n = dueCards(c.id).filter((d) => all.some((x) => x.key === d.key)).length;
    return n ? h("a", { href: `#/review/${c.id}`, class: "text-sm underline justify-self-start", style: "color:var(--accent)" },
      tn(n, "🔁 {n} card of this course to review today →", "🔁 {n} cards of this course to review today →")) : null;
  };
  const draw = () => {
    const head = h("div", { class: "grid gap-2" },
      h("div", { class: "flex justify-between text-sm mute" }, h("span", {}, t("Known {k}/{n}", { k: known.size, n: all.length })),
        h("button", { type: "button", class: "underline", onClick: () => { known = new Set(); save(); deck = shuffle(all); draw(); } }, t("Reset"))),
      bar(all.length ? (known.size / all.length) * 100 : 0));
    if (!deck.length) {
      root.replaceChildren(h("div", { class: "grid gap-4 max-w-xl" }, head,
        h("div", { class: "panel !shadow-none text-center grid gap-2 py-10" }, h("b", { class: "serif text-2xl" }, t("You know every card 🎉")),
          h("p", { class: "mute text-sm" }, t("They come back in your reviews just before you would forget them. Reset to go through them all now."))),
        dueLink()));
      return;
    }
    const card = deck[0];
    const actions = h("div", { class: "grid grid-cols-2 gap-2", hidden: true },
      h("button", { type: "button", class: "btn-ghost", onClick: () => { grade(c.id, card.key, false); deck.push(deck.shift()); logActivity(1); draw(); } }, t("↻ Again")),
      h("button", { type: "button", class: "btn", onClick: () => { grade(c.id, card.key, true); known.add(card.key); save(); deck.shift(); logActivity(1); draw(); } }, t("✓ I knew it")));
    const flip = flipCard(card, (on) => { actions.hidden = !on; });
    root.replaceChildren(h("div", { class: "grid gap-4 max-w-xl" }, head, flip, actions,
      h("p", { class: "mute text-xs" }, tn(deck.length, "{n} card left in this round.", "{n} cards left in this round.")), dueLink()));
  };
  draw();
}

/* ---------- practice exercises ---------- */
export function exercises(root, c, codeBlock, playLink) {
  const solved = new Set(EX.get(c.id) || []);
  const count = h("span", { class: "mute text-sm" });
  const upd = () => { count.textContent = t("{d}/{n} solved", { d: solved.size, n: c.exercises.length }); };
  const markSolved = (i, status) => { if (!solved.has(i)) logActivity(3); solved.add(i); EX.set(c.id, [...solved]); status.hidden = false; upd(); };
  const one = (e, i) => {
    const status = h("span", { class: "badge", hidden: !solved.has(i) }, t("Solved"));
    const hint = e.hint ? h("p", { class: "mute text-sm", hidden: true }, t("Hint: {hint}", { hint: e.hint })) : null;
    const grade = h("div", { class: "flex flex-wrap gap-2" },
      h("button", { type: "button", class: "btn", onClick: () => { if (!solved.has(i)) logActivity(3); solved.add(i); EX.set(c.id, [...solved]); status.hidden = false; upd(); } }, t("✓ I got it")),
      h("button", { type: "button", class: "btn-ghost", onClick: () => { solved.delete(i); EX.set(c.id, [...solved]); status.hidden = true; upd(); } }, t("↻ Not yet")));
    const answer = h("div", { class: "grid gap-3", hidden: true },
      e.type ? solution(e) : null,
      e.code ? codeBlock(e.code, e.answer, e.try && c.playground) : h("p", { class: "text-sm rounded-xl p-3", style: "background:var(--soft)" }, e.answer),
      e.explain ? h("p", { class: "text-sm rounded-xl p-3", style: "background:var(--soft)" }, e.explain) : null,
      h("p", { class: "mute text-xs" }, t("Compare with your attempt. Did you get it?")), grade);
    const reveal = h("button", { type: "button", class: "btn-ghost", onClick: () => { answer.hidden = false; reveal.hidden = true; } }, t("Reveal the answer"));
    const scratch = e.run || e.type ? null : h("textarea", { class: "input font-mono min-h-[90px] w-full", rows: 4, spellcheck: "false", "aria-label": t("Your attempt (not saved)"),
      placeholder: t("Try it here first (not saved)…") });
    return h("li", { class: "panel !shadow-none grid gap-3" },
      h("div", { class: "flex items-start gap-3" },
        h("span", { class: "w-7 h-7 shrink-0 rounded-full grid place-items-center text-xs font-semibold", style: "background:var(--soft)" }, String(i + 1)),
        h("p", { class: "font-medium flex-1" }, e.q), status),
      hint,
      e.run ? sqlRunner(e, () => markSolved(i, status)) : e.type ? drill(e, () => markSolved(i, status)) : scratch,
      h("div", { class: "flex flex-wrap gap-2" }, reveal,
        // A query exercise of a course with a playground (DAX.do): run the attempt on the real engine.
        scratch && e.try && playLink ? playLink(c.playground, () => scratch.value, t("▶ Run my attempt on {name}", { name: c.playground?.name })) : null,
        hint ? h("button", { type: "button", class: "btn-ghost", onClick: (ev) => { hint.hidden = false; ev.currentTarget.remove(); } }, t("💡 Show a hint")) : null),
      answer);
  };
  upd();
  const play = c.playground && playLink ? h("p", { class: "text-sm rounded-xl p-3 flex flex-wrap items-center gap-2", style: "background:var(--soft)" },
    t("Exercises marked ▶ run on {name}, a free online engine (no account). The button copies the code and opens it: paste, then run.", { name: c.playground.name }),
    c.playground.about ? h("span", { class: "mute text-xs" }, c.playground.about) : null) : null;
  root.replaceChildren(h("div", { class: "grid gap-3" }, play, count, h("ol", { class: "grid gap-3" }, c.exercises.map(one))));
}

/* ---------- interview questions ---------- */
export function interviewCards(root, c) {
  root.replaceChildren(h("div", { class: "grid gap-3" },
    h("p", { class: "mute text-sm" }, t("Answer out loud first, then compare with the model answer.")),
    ...c.interview.map((x) => {
      const a = h("p", { class: "mute text-sm", hidden: true }, x.a);
      const btn = h("button", { type: "button", class: "btn-ghost self-start", onClick: () => { a.hidden = false; btn.remove(); logActivity(1); } }, t("Show the model answer"));
      return h("div", { class: "panel !shadow-none grid gap-2" }, h("p", { class: "font-medium" }, x.q), btn, a);
    })));
}

/* ---------- runnable SQL exercises (training step 2) ---------- */
const MAX_ROWS = 20;
// The result table of a query (first MAX_ROWS rows).
function resultTable(res) {
  if (!res.columns.length) return h("p", { class: "mute text-sm" }, t("The query ran and returned no rows (a statement other than SELECT never returns rows)."));
  const shown = res.values.slice(0, MAX_ROWS);
  return h("div", { class: "grid gap-1" },
    h("div", { class: "overflow-x-auto rounded-xl", style: "border:1px solid var(--line)" },
      h("table", { class: "text-xs font-mono w-full" },
        h("thead", {}, h("tr", { style: "background:var(--soft)" }, res.columns.map((c) => h("th", { class: "text-left px-2 py-1 whitespace-nowrap" }, c)))),
        h("tbody", {}, shown.map((r) => h("tr", { style: "border-top:1px solid var(--line)" },
          r.map((v) => h("td", { class: "px-2 py-1 whitespace-nowrap" }, v == null ? "NULL" : String(v)))))))),
    h("p", { class: "mute text-xs" }, res.values.length > MAX_ROWS
      ? t("{n} rows ({max} shown)", { n: res.values.length, max: MAX_ROWS }) : tn(res.values.length, "{n} row", "{n} rows")));
}
const VERDICT = {
  rows: "Not yet: your query returns {got} rows, the expected result has {want}.",
  columns: "Not yet: the number of rows is right, but some expected columns are missing or hold other values.",
  values: "Not yet: same number of rows, but some values differ.",
  order: "Almost: the right rows, but not in the order asked for.",
  none: "Not yet: your query returns no rows. Check its conditions (a statement other than SELECT never returns rows).",
  plan: "Not yet: the plan does not use the index asked for, or still scans a whole table (SCAN). Keep EXPLAIN QUERY PLAN in front of the query.",
};
function sqlRunner(e, onSolved) {
  const box = h("textarea", { class: "input font-mono min-h-[110px] w-full", rows: e.start ? Math.min(14, e.start.split("\n").length + 1) : 5, spellcheck: "false", autocapitalize: "off", autocorrect: "off",
    "aria-label": t("Your SQL query"), placeholder: t("Write your SQL query, then ▶ Run (Ctrl + Enter)…") });
  const out = h("div", { class: "grid gap-2", "aria-live": "polite" });
  const say = (text, color) => h("p", { class: "text-sm font-medium", style: color ? `color:${color}` : "" }, text);
  let expected = null;
  const engine = () => Promise.all([import("./sqlrun.js"), import("./sqlgrade.js")]);
  const errorText = (err) => (err.message === "timeout" ? t("Your query took more than 5 seconds and was stopped.") : t("SQL error: {msg}", { msg: err.message }));
  const busy = (on) => { run.disabled = check.disabled = on; };
  async function onRun() {
    if (!box.value.trim()) { box.focus(); return; }
    busy(true); out.replaceChildren(h("p", { class: "mute text-sm" }, t("Running…")));
    try { const [{ runSql }] = await engine(); out.replaceChildren(resultTable(await runSql(e.run.db, box.value))); }
    catch (err) { out.replaceChildren(say(errorText(err), "#e0508b")); }
    finally { busy(false); }
  }
  async function onCheck() {
    if (!box.value.trim()) { box.focus(); return; }
    busy(true); out.replaceChildren(h("p", { class: "mute text-sm" }, t("Checking…")));
    try {
      const [{ runSql }, { gradeResult }] = await engine();
      expected ||= await runSql(e.run.db, e.answer);
      let mine;
      try { mine = await runSql(e.run.db, box.value); } catch (err) { out.replaceChildren(say(errorText(err), "#e0508b")); return; }
      const g = gradeResult(expected, mine, e.run);
      if (g.ok) { onSolved(); out.replaceChildren(say(t("✓ Correct! Same result as the expected answer."), "#18a999"), resultTable(mine)); }
      else out.replaceChildren(say(t(VERDICT[g.reason] || VERDICT.values, { got: g.got, want: g.want }), "#f08a24"), resultTable(mine));
    } catch (err) { out.replaceChildren(say(errorText(err), "#e0508b")); }
    finally { busy(false); }
  }
  if (e.start) box.value = e.start;
  const reset = e.start ? h("button", { type: "button", class: "btn-ghost", onClick: () => { box.value = e.start; out.replaceChildren(); box.focus(); } }, t("↺ Start again")) : null;
  const run = h("button", { type: "button", class: "btn-ghost", onClick: onRun }, t("▶ Run"));
  const check = h("button", { type: "button", class: "btn", onClick: onCheck }, t("✓ Check my answer"));
  box.addEventListener("keydown", (ev) => { if ((ev.ctrlKey || ev.metaKey) && ev.key === "Enter") { ev.preventDefault(); onRun(); } });
  // The practice tables, loaded when opened.
  const schema = h("details", { class: "text-xs" }, h("summary", { class: "cursor-pointer mute" }, t("Tables in the practice database")));
  schema.addEventListener("toggle", async () => {
    if (!schema.open || schema.dataset.loaded) return;
    schema.dataset.loaded = "1";
    try {
      const [{ tablesOf }] = await engine();
      schema.append(h("ul", { class: "grid gap-1 mt-2 font-mono" }, (await tablesOf(e.run.db)).map((tb) =>
        h("li", {}, h("b", {}, tb.name), `(${tb.columns.join(", ")}) · `, h("span", { class: "mute" }, tn(tb.rows, "{n} row", "{n} rows"))))));
    } catch (err) { schema.append(h("p", { class: "mute" }, errorText(err))); }
  });
  return h("div", { class: "grid gap-2", "data-sql-runner": true }, schema, box, h("div", { class: "flex flex-wrap gap-2" }, run, check, reset), out);
}
