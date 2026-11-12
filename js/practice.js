// Interactive practice on a course page (courses.js), built from the course JSON, so it works in both languages
// without extra content:
// - quiz(): multiple-choice questions generated from the cheat sheet (syntax → meaning or meaning → syntax, distractors
//   from the same course), instant feedback, best score per course ("hk.quiz").
// - flashcards(): the cheat sheet as flip cards; "I knew it" cards are remembered per course ("hk.cards") and every
//   answer schedules the card for spaced-repetition reviews (srs.js, #/review); a link shows the cards due in the course.
//   flipCard() and makeQuestions() are shared with the review page (review.js) and the skill check (skillcheck.js).
// - exercises(): try first in a scratch box (not saved), reveal the answer, then grade yourself ("hk.exercises").
//   Runnable Python exercises (exercise.run = { python: hidden tests }, training step 5): pyRunner below, pyrun.js.
//   Runnable SQL exercises (exercise.run = { db, ordered?, minColumns?, plan? }, training step 2): ▶ Run shows the result
//   table on the practice dataset (sqlrun.js: SQLite in a Web Worker, nothing sent anywhere) and ✓ Check compares it
//   with the result of the course answer (sqlgrade.js); a correct result marks the exercise solved. With "start" (a
//   query, training step 2e: "fix this query"), the editor opens on that query and "↺ Start again" brings it back.
//   Auto-graded formats (exercise.type, training steps 2b, 2c + 2d, drills.js): choice, fill, order, match, groups, bug,
//   scenario, logs, regex, cron, json, fixfile; a correct answer marks the exercise solved, "Reveal" shows the worked answer.
// - "🤖 Explain my mistake" (explain.js, training step 4): after a wrong SQL check or auto-graded answer, or once the
//   answer of a written exercise is revealed with an attempt in the scratch box, a signed-in learner can ask Claude why;
//   only on that click is anything sent (explain-mistake function).
// - Courses with a playground (DAX.do): written exercises with "try" get "▶ Run my attempt on …" (copies the attempt,
//   opens the playground in a new tab) and a ▶ button on the answer code (courses.js playLink).
// - lessonChecks() + quickCheck(): the "⚡ Quick check" at the end of a lesson (courses.js): up to 2 questions on the
//   cheat sheet items that lesson teaches (matched on the words of its example code and text), answered in place;
//   every answer schedules the card for spaced-repetition reviews (srs.js), like a flashcard.
// - interviewCards(): think first, then reveal the model answer.
// Everything stays in this browser (synced to the account when signed in, learnsync.js); each action adds XP (activity.js).
import { h, ls } from "./lib.js";
import { t, tn } from "./i18n.js";
import { logActivity } from "./activity.js";
import { drill, solution } from "./drills.js";
import { grade, dueCards } from "./srs.js";
import { explainBox } from "./explain.js";
import { countFeature } from "./usage.js";

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
// One question on a cheat sheet item: syntax → meaning (toMeaning) or meaning → syntax, 3 distractors from the same
// group first, then the rest of the course, never a duplicate text.
function ask(all, it, toMeaning) {
  const field = toMeaning ? "back" : "front";
  const seen = new Set([it[field]]);
  const pool = [...shuffle(all.filter((x) => x.group === it.group)), ...shuffle(all.filter((x) => x.group !== it.group))];
  const wrong = [];
  for (const x of pool) { if (wrong.length === 3) break; if (!seen.has(x[field])) { seen.add(x[field]); wrong.push(x); } }
  return { it, toMeaning, options: shuffle([it, ...wrong]) };
}
export function makeQuestions(c, n = 8) {
  const all = items(c);
  return shuffle(all).slice(0, Math.min(n, all.length)).map((it, qi) => ask(all, it, qi % 2 === 0)); // alternate the direction
}

/* ---------- quick check at the end of a lesson ---------- */
// For each lesson, the cheat sheet items (up to 2) it teaches: an item goes to the lesson whose example code (full
// weight) and text (0.6) share the most of its words, rare words counting more (a word used by every lesson counts
// little). Items with no clear lesson (score ≤ 0.9) are left out, so a lesson can have no check. Works in every
// language: the code is identical and the syntax column of the cheat sheet is mostly code.
const STOP = new Set("the a an and or of to in is for with on by as at be it from this that not no col table name value df".split(" "));
const words = (s) => new Set((String(s || "").match(/[A-Za-z_][A-Za-z0-9_.]*[A-Za-z0-9_]/g) || []).map((w) => w.toLowerCase()).filter((w) => !STOP.has(w)));
const checkCache = new WeakMap();
export function lessonChecks(c) {
  if (checkCache.has(c)) return checkCache.get(c);
  const lessons = c.lessons || [], all = items(c);
  const lw = lessons.map((l) => [words(l.example?.code), words([l.title, ...(l.text || []), ...(l.points || [])].join(" "))]);
  const df = new Map();
  for (const [a, b] of lw) for (const w of new Set([...a, ...b])) df.set(w, (df.get(w) || 0) + 1);
  const found = lessons.map(() => []);
  if (all.length >= 4) for (const it of all) { // 4 items at least: one answer + 3 distractors
    const fw = words(it.front);
    if (!fw.size) continue;
    let best = 0, at = -1;
    lw.forEach(([code, text], i) => {
      let s = 0;
      for (const w of fw) {
        const idf = Math.log((lessons.length + 1) / ((df.get(w) || 0) + 0.5));
        if (code.has(w)) s += idf; else if (text.has(w)) s += 0.6 * idf;
      }
      s /= Math.sqrt(fw.size);
      if (s > best) { best = s; at = i; }
    });
    if (best > 0.9) found[at].push({ it, s: best });
  }
  const out = found.map((x) => x.sort((a, b) => b.s - a.s).slice(0, 2).map((x) => x.it));
  checkCache.set(c, out);
  return out;
}

// The questions one under the other: an answer shows the right option and opens the next question. +2 XP per right
// answer. onDone(score, total) after the last one.
export function quickCheck(c, its, { onDone } = {}) {
  const all = items(c), qs = its.map((it, i) => ask(all, it, i % 2 === 0));
  let score = 0;
  const list = h("div", { class: "grid gap-4" });
  const summary = h("p", { class: "text-sm font-medium", "aria-live": "polite", dir: "auto", hidden: true });
  const one = (qi) => {
    const { it, toMeaning, options } = qs[qi];
    const feedback = h("p", { class: "text-sm min-h-[1.25rem]", "aria-live": "polite", dir: "auto" });
    const opts = options.map((o) => h("button", { type: "button", class: "opt", onClick: (e) => answer(o, e.currentTarget) },
      toMeaning ? o.back : code(o.front)));
    function answer(o, btn) {
      const ok = o.key === it.key;
      opts.forEach((b, k) => { b.disabled = true; if (options[k].key === it.key) b.classList.add("opt-ok"); });
      if (!ok) btn.classList.add("opt-bad");
      grade(c.id, it.key, ok);
      if (ok) { score++; logActivity(2); }
      feedback.replaceChildren(ok ? h("span", { style: "color:var(--ok)" }, t("✓ Correct! +2 XP"))
        : h("span", {}, h("span", { style: "color:var(--bad)" }, t("✗ Not quite. ")), h("span", { class: "mute" }, t("The answer: ")), toMeaning ? it.back : code(it.front)));
      if (qi + 1 < qs.length) {
        const next = one(qi + 1);
        list.append(next);
        next.querySelector(".opt")?.focus({ preventScroll: true });
        next.scrollIntoView({ behavior: "smooth", block: "nearest" });
      } else {
        summary.textContent = t("{s}/{n} right · these cards come back in your reviews.", { s: score, n: qs.length });
        summary.hidden = false;
        onDone?.(score, qs.length);
      }
    }
    return h("div", { class: "grid gap-2 step-in", "data-q": "" },
      h("p", { class: "text-sm mute", dir: "auto" }, qs.length > 1 ? `${qi + 1}/${qs.length} · ` : null, toMeaning ? t("What does this do?") : t("Which one does this?")),
      h("p", { class: "font-medium text-[1.05rem]", "data-prompt": toMeaning ? "front" : "back" }, toMeaning ? h("code", { class: "inline-code !text-[.95rem] !px-1.5 !py-0.5" }, it.front) : it.back),
      h("div", { class: "grid gap-2 sm:grid-cols-2" }, opts), feedback);
  };
  if (qs.length) list.append(one(0));
  return h("div", { class: "quick-check grid gap-3", "data-quick-check": "" },
    h("p", { class: "eyebrow font-medium", style: "color:var(--accent-ink)", dir: "auto" }, t("⚡ Quick check")), list, summary);
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
        ? h("span", { style: "color:var(--ok)" }, t("✓ Correct! +2 XP"))
        : h("span", {}, h("span", { style: "color:var(--bad)" }, t("✗ Not quite. ")), h("span", { class: "mute" }, t("The answer: ")),
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
    countFeature("quiz_done");
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
    return n ? h("a", { href: `#/review/${c.id}`, class: "text-sm underline justify-self-start", style: "color:var(--accent-ink)" },
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
    const help = explainBox(c, e); // "Explain my mistake", shown after a wrong answer
    const solvedNow = () => { markSolved(i, status); help.reset(); };
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
    const reveal = h("button", { type: "button", class: "btn-ghost", onClick: () => {
      answer.hidden = false; reveal.hidden = true;
      if (scratch?.value.trim()) help.offer(scratch.value, "Written answer: the learner revealed the model answer and wants to know what is wrong or missing in theirs.");
    } }, t("Reveal the answer"));
    const scratch = e.run || e.type ? null : h("textarea", { class: "input font-mono min-h-[90px] w-full", rows: 4, spellcheck: "false", "aria-label": t("Your attempt (not saved)"),
      placeholder: t("Try it here first (not saved)…") });
    return h("li", { class: "panel !shadow-none grid gap-3" },
      h("div", { class: "flex items-start gap-3" },
        h("span", { class: "w-7 h-7 shrink-0 rounded-full grid place-items-center text-xs font-semibold", style: "background:var(--soft)" }, String(i + 1)),
        h("p", { class: "font-medium flex-1" }, e.q), status),
      hint,
      e.run?.python != null ? pyRunner(e, solvedNow, help.offer) : e.run ? sqlRunner(e, solvedNow, help.offer) : e.type ? drill(e, solvedNow, help.offer) : scratch,
      help.el,
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

/* ---------- runnable Python exercises (training step 5) ---------- */
// exercise.run = { python: "<hidden tests: Python asserts>" } with code "python": ▶ Run shows what the code prints,
// ✓ Check runs the code then the tests (pyrun.js, Pyodide in a Worker, loaded on the first click). onWrong(code,
// verdict) after a failed check, for "Explain my mistake".
function pyRunner(e, onSolved, onWrong = () => {}) {
  const box = h("textarea", { class: "input font-mono min-h-[130px] w-full", rows: e.start ? Math.min(16, e.start.split("\n").length + 1) : 7, spellcheck: "false", autocapitalize: "off", autocorrect: "off",
    "aria-label": t("Your Python code"), placeholder: t("Write your Python code, then ▶ Run (Ctrl + Enter)…") });
  const out = h("div", { class: "grid gap-2", "aria-live": "polite" });
  const say = (text, color) => h("p", { class: "text-sm font-medium whitespace-pre-wrap", style: color ? `color:${color}` : "" }, text);
  const printed = (s) => (s?.trim() ? h("pre", { tabindex: "0", class: "codeblock !text-xs max-h-60 overflow-auto", dir: "ltr" }, h("code", {}, s.trimEnd())) : null);
  const busy = (on) => { run.disabled = check.disabled = on; };
  const show = (...els) => out.replaceChildren(...els.filter(Boolean));
  const fail = (err) => say(err.message === "timeout" ? t("Your code ran too long and was stopped (an endless loop?).")
    : t("Python could not be loaded. Check your connection and try again."), "var(--bad)");
  async function go(withTests) {
    if (!box.value.trim()) { box.focus(); return; }
    busy(true);
    const { runPython, pythonLoaded, needsPandas } = await import("./pyrun.js");
    show(h("p", { class: "mute text-sm" }, !pythonLoaded() ? t("Loading Python in your browser (about 13 MB, only the first time)…")
      : needsPandas(box.value + (withTests ? e.run.python : "")) ? t("Loading pandas in your browser (about 8 MB, only the first time)…")
      : withTests ? t("Checking…") : t("Running…")));
    try {
      const r = await runPython(box.value, withTests ? e.run.python : "");
      if (r.error) {
        show(say(t("Python error:"), "var(--bad)"), printed(r.error), printed(r.stdout));
        if (withTests) onWrong(box.value, `The code raises an error: ${r.error}`);
      } else if (!withTests) {
        show(r.stdout.trim() ? printed(r.stdout) : h("p", { class: "mute text-sm" }, t("The code ran and printed nothing. Call your function with print(…) to see a result.")));
      } else if (r.failed) {
        show(say(t("Not yet: a test fails: {msg}", { msg: r.failed }), "var(--warn)"), printed(r.stdout));
        onWrong(box.value, `A hidden test fails: ${r.failed}`);
      } else {
        onSolved();
        show(say(t("✓ Correct! Your code passes every test."), "var(--ok)"), printed(r.stdout));
      }
    } catch (err) { show(fail(err)); }
    finally { busy(false); }
  }
  if (e.start) box.value = e.start;
  box.addEventListener("keydown", (ev) => {
    if ((ev.ctrlKey || ev.metaKey) && ev.key === "Enter") { ev.preventDefault(); go(false); }
    // Enter keeps the indentation of the line (4 more spaces after a colon), as Python needs. Tab still moves focus.
    if (ev.key === "Enter" && !ev.ctrlKey && !ev.metaKey && !ev.shiftKey) {
      const { selectionStart: a, selectionEnd: b, value } = box;
      const line = value.slice(value.lastIndexOf("\n", a - 1) + 1, a);
      const indent = line.match(/^ */)[0] + (/:\s*$/.test(line) ? "    " : "");
      ev.preventDefault(); box.setRangeText("\n" + indent, a, b, "end");
    }
  });
  const reset = e.start ? h("button", { type: "button", class: "btn-ghost", onClick: () => { box.value = e.start; show(); box.focus(); } }, t("↺ Start again")) : null;
  const run = h("button", { type: "button", class: "btn-ghost", onClick: () => go(false) }, t("▶ Run"));
  const check = h("button", { type: "button", class: "btn", onClick: () => go(true) }, t("✓ Check my answer"));
  return h("div", { class: "grid gap-2", "data-py-runner": true },
    h("p", { class: "mute text-xs" }, t("Runs in your browser (Python 3.14 with pandas). ✓ Check runs hidden tests on your code.")),
    box, h("div", { class: "flex flex-wrap gap-2" }, run, check, reset), out);
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
// onWrong(query, verdict): a failed check or an SQL error on ✓ Check (for "Explain my mistake").
function sqlRunner(e, onSolved, onWrong = () => {}) {
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
    catch (err) { out.replaceChildren(say(errorText(err), "var(--bad)")); }
    finally { busy(false); }
  }
  async function onCheck() {
    if (!box.value.trim()) { box.focus(); return; }
    busy(true); out.replaceChildren(h("p", { class: "mute text-sm" }, t("Checking…")));
    try {
      const [{ runSql }, { gradeResult }] = await engine();
      expected ||= await runSql(e.run.db, e.answer);
      let mine;
      try { mine = await runSql(e.run.db, box.value); } catch (err) { out.replaceChildren(say(errorText(err), "var(--bad)")); onWrong(box.value, `The query fails in SQLite: ${err.message}`); return; }
      const g = gradeResult(expected, mine, e.run);
      if (g.ok) { onSolved(); out.replaceChildren(say(t("✓ Correct! Same result as the expected answer."), "var(--ok)"), resultTable(mine)); }
      else {
        out.replaceChildren(say(t(VERDICT[g.reason] || VERDICT.values, { got: g.got, want: g.want }), "var(--warn)"), resultTable(mine));
        onWrong(box.value, `${VERDICT[g.reason] || VERDICT.values} (got ${g.got ?? "?"}, want ${g.want ?? "?"}). Learner's first rows: ${JSON.stringify(mine.values.slice(0, 5))}; columns: ${mine.columns.join(", ")}`);
      }
    } catch (err) { out.replaceChildren(say(errorText(err), "var(--bad)")); }
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
