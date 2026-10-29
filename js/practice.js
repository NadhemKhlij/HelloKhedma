// Interactive practice on a course page (courses.js), built from the course JSON, so it works in both languages
// without extra content:
// - quiz(): multiple-choice questions generated from the cheat sheet (syntax → meaning or meaning → syntax, distractors
//   from the same course), instant feedback, best score per course ("hk.quiz").
// - flashcards(): the cheat sheet as flip cards; "I knew it" cards are remembered per course ("hk.cards").
// - exercises(): try first in a scratch box (not saved), reveal the answer, then grade yourself ("hk.exercises").
// - interviewCards(): think first, then reveal the model answer.
// Everything stays in this browser; each action adds XP (activity.js).
import { h, ls } from "./lib.js";
import { t, tn } from "./i18n.js";
import { logActivity } from "./activity.js";

const store = (key) => ({
  all() { try { return JSON.parse(ls.get(key) || "{}"); } catch { return {}; } },
  get(id) { return this.all()[id]; },
  set(id, v) { const a = this.all(); a[id] = v; ls.set(key, JSON.stringify(a)); },
});
const QUIZ = store("hk.quiz"), CARDS = store("hk.cards"), EX = store("hk.exercises");
export const quizBest = (id) => QUIZ.get(id) ?? null;
export const exercisesSolved = (id) => (EX.get(id) || []).length;

const shuffle = (a) => { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };
const items = (c) => (c.cheatsheet || []).flatMap((g, gi) => g.items.map(([front, back], i) => ({ key: `${gi}:${i}`, group: g.group, front, back })));
const code = (s) => h("code", { class: "inline-code !text-[.85rem]" }, s);
const bar = (pct) => h("div", { class: "h-1.5 rounded-full", style: "background:var(--line)" },
  h("div", { class: "h-1.5 rounded-full", style: `width:${pct}%;background:var(--accent);transition:width .3s ease` }));

/* ---------- quiz ---------- */
function makeQuestions(c, n = 8) {
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
export function flashcards(root, c) {
  const all = items(c);
  let known = new Set(CARDS.get(c.id) || []), deck = shuffle(all.filter((x) => !known.has(x.key))), flipped = false;
  const save = () => CARDS.set(c.id, [...known]);
  const draw = () => {
    const head = h("div", { class: "grid gap-2" },
      h("div", { class: "flex justify-between text-sm mute" }, h("span", {}, t("Known {k}/{n}", { k: known.size, n: all.length })),
        h("button", { type: "button", class: "underline", onClick: () => { known = new Set(); save(); deck = shuffle(all); flipped = false; draw(); } }, t("Reset"))),
      bar(all.length ? (known.size / all.length) * 100 : 0));
    if (!deck.length) {
      root.replaceChildren(h("div", { class: "grid gap-4 max-w-xl" }, head,
        h("div", { class: "panel !shadow-none text-center grid gap-2 py-10" }, h("b", { class: "serif text-2xl" }, t("You know every card 🎉")),
          h("p", { class: "mute text-sm" }, t("Come back in a few days, or reset to go through them again.")))));
      return;
    }
    const card = deck[0];
    const flip = h("button", { type: "button", class: `flip w-full ${flipped ? "on" : ""}`, "aria-label": flipped ? t("Show the front") : t("Show the answer"),
      onClick: () => { flipped = !flipped; flip.classList.toggle("on", flipped); flip.setAttribute("aria-label", flipped ? t("Show the front") : t("Show the answer")); actions.hidden = !flipped; } },
      h("div", { class: "flip-inner" },
        h("div", { class: "face" }, h("span", { class: "eyebrow" }, card.group), h("code", { class: "text-lg font-mono break-words" }, card.front),
          h("span", { class: "mute text-xs" }, t("Tap to flip"))),
        h("div", { class: "face back" }, h("span", { class: "eyebrow" }, card.group), h("p", { class: "text-lg font-medium" }, card.back))));
    const actions = h("div", { class: "grid grid-cols-2 gap-2", hidden: !flipped },
      h("button", { type: "button", class: "btn-ghost", onClick: () => { deck.push(deck.shift()); flipped = false; logActivity(1); draw(); } }, t("↻ Again")),
      h("button", { type: "button", class: "btn", onClick: () => { known.add(card.key); save(); deck.shift(); flipped = false; logActivity(1); draw(); } }, t("✓ I knew it")));
    root.replaceChildren(h("div", { class: "grid gap-4 max-w-xl" }, head, flip, actions,
      h("p", { class: "mute text-xs" }, tn(deck.length, "{n} card left in this round.", "{n} cards left in this round."))));
  };
  draw();
}

/* ---------- practice exercises ---------- */
export function exercises(root, c, codeBlock) {
  const solved = new Set(EX.get(c.id) || []);
  const count = h("span", { class: "mute text-sm" });
  const upd = () => { count.textContent = t("{d}/{n} solved", { d: solved.size, n: c.exercises.length }); };
  const one = (e, i) => {
    const status = h("span", { class: "badge", hidden: !solved.has(i) }, t("Solved"));
    const hint = e.hint ? h("p", { class: "mute text-sm", hidden: true }, t("Hint: {hint}", { hint: e.hint })) : null;
    const grade = h("div", { class: "flex flex-wrap gap-2" },
      h("button", { type: "button", class: "btn", onClick: () => { if (!solved.has(i)) logActivity(3); solved.add(i); EX.set(c.id, [...solved]); status.hidden = false; upd(); } }, t("✓ I got it")),
      h("button", { type: "button", class: "btn-ghost", onClick: () => { solved.delete(i); EX.set(c.id, [...solved]); status.hidden = true; upd(); } }, t("↻ Not yet")));
    const answer = h("div", { class: "grid gap-3", hidden: true },
      e.code ? codeBlock(e.code, e.answer) : h("p", { class: "text-sm rounded-xl p-3", style: "background:var(--soft)" }, e.answer),
      h("p", { class: "mute text-xs" }, t("Compare with your attempt. Did you get it?")), grade);
    const reveal = h("button", { type: "button", class: "btn-ghost", onClick: () => { answer.hidden = false; reveal.hidden = true; } }, t("Reveal the answer"));
    return h("li", { class: "panel !shadow-none grid gap-3" },
      h("div", { class: "flex items-start gap-3" },
        h("span", { class: "w-7 h-7 shrink-0 rounded-full grid place-items-center text-xs font-semibold", style: "background:var(--soft)" }, String(i + 1)),
        h("p", { class: "font-medium flex-1" }, e.q), status),
      hint,
      h("textarea", { class: "input font-mono min-h-[90px] w-full", rows: 4, spellcheck: "false", "aria-label": t("Your attempt (not saved)"),
        placeholder: t("Try it here first (not saved)…") }),
      h("div", { class: "flex flex-wrap gap-2" }, reveal,
        hint ? h("button", { type: "button", class: "btn-ghost", onClick: (ev) => { hint.hidden = false; ev.currentTarget.remove(); } }, t("💡 Show a hint")) : null),
      answer);
  };
  upd();
  root.replaceChildren(h("div", { class: "grid gap-3" }, count, h("ol", { class: "grid gap-3" }, c.exercises.map(one))));
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
