// "Review today" (#/review, #/review/<courseId>; training step 3): the flashcards due for review (srs.js), from every
// course the learner graded cards in (or one course), most overdue first, at most SESSION cards at a time. Flip,
// then "↻ Again" (back to box 1: tomorrow, and once more at the end of this session) or "✓ I knew it" (next box:
// later). The end screen says when the next cards are due. Cards come from the course cheat sheets in the interface
// language (AI-track courses in the chosen script, right to left in Arabic letters). XP via activity.js.
import { $, h } from "./lib.js";
import { t, tn } from "./i18n.js";
import { dueCards, grade, nextDueIn, INTERVALS } from "./srs.js";
import { loadCourse, courseMeta, loadCourseIndex } from "./courses.js";
import { isAiCourse, aiMeta, aiDir } from "./aitrack.js";
import { items, flipCard } from "./practice.js";
import { logActivity } from "./activity.js";
import { countFeature } from "./usage.js";

const SESSION = 20;
const bar = (pct) => h("div", { class: "h-1.5 rounded-full", style: "background:var(--line)" },
  h("div", { class: "h-1.5 rounded-full", style: `width:${pct}%;background:var(--accent);transition:width .3s ease` }));

// Due cards with their text: [{ courseId, key, name, card, dir }]; cards whose course or cheat-sheet line is gone are left out.
async function loadDue(courseId) {
  await loadCourseIndex();
  const due = dueCards(courseId).slice(0, SESSION * 2);
  const ids = [...new Set(due.map((d) => d.courseId))];
  const courses = new Map(await Promise.all(ids.map(async (id) => {
    try {
      const c = await loadCourse(id);
      const name = isAiCourse(id) ? (await aiMeta(id))?.name : courseMeta(id)?.name;
      return [id, { cards: new Map(items(c).map((x) => [x.key, x])), name: name || id, dir: isAiCourse(id) ? aiDir().dir : null }];
    } catch { return [id, null]; }
  })));
  return due.map((d) => {
    const c = courses.get(d.courseId), card = c?.cards.get(d.key);
    return card ? { ...d, card, name: c.name, dir: c.dir } : null;
  }).filter(Boolean).slice(0, SESSION);
}

const when = (days) => (days === 0 ? t("today") : tn(days, "tomorrow", "in {n} days"));

export async function renderReview(courseId = null) {
  countFeature("review");
  const root = $("#reviewBody");
  root.replaceChildren(h("p", { class: "mute" }, t("Loading your cards…")));
  const deck = await loadDue(courseId);
  const total = deck.length;
  let right = 0, again = 0;
  const head = (title, sub) => h("div", { class: "grid gap-1" },
    h("a", { href: courseId ? `#/course/${courseId}` : "#/training", class: "mute text-sm underline justify-self-start" }, courseId ? t("← Back to the course") : t("← Training")),
    h("h1", { id: "h-review", tabindex: "-1", class: "page-title !mb-0" }, title), sub ? h("p", { class: "mute text-sm" }, sub) : null);

  if (!total) {
    const next = nextDueIn();
    root.replaceChildren(head(t("Review today")), h("div", { class: "panel grid gap-3 max-w-xl" },
      h("b", { class: "serif text-2xl" }, t("Nothing to review today 🎉")),
      h("p", { class: "mute text-sm" }, next != null
        ? t("Your next cards come back {when}. Reviews bring each card back just before you would forget it.", { when: when(next) })
        : t("Open a course's Flashcards and answer a few cards: they come back here just before you would forget them.")),
      h("a", { href: "#/training", class: "btn-ghost justify-self-start" }, t("Go to my courses →"))));
    return;
  }

  const draw = () => {
    if (!deck.length) {
      const next = nextDueIn();
      root.replaceChildren(head(t("Review today")), h("div", { class: "panel grid gap-3 max-w-xl" },
        h("b", { class: "serif text-2xl" }, t("Review done 🎉")),
        h("p", {}, t("{right} of {total} cards known the first time.", { right, total })),
        h("p", { class: "mute text-sm" }, next != null ? t("Next cards: {when}.", { when: when(next) }) : ""),
        h("div", { class: "flex flex-wrap gap-2" },
          h("a", { href: "#/", class: "btn" }, t("Back home")),
          courseId ? h("a", { href: `#/course/${courseId}`, class: "btn-ghost" }, t("← Back to the course")) : h("a", { href: "#/training", class: "btn-ghost" }, t("Go to my courses →")))));
      logActivity(3);
      return;
    }
    const cur = deck[0], done = total - deck.length;
    const actions = h("div", { class: "grid grid-cols-2 gap-2", hidden: true },
      h("button", { type: "button", class: "btn-ghost", onClick: () => {
        if (!cur.retry) { grade(cur.courseId, cur.key, false); again++; }
        deck.push({ ...deck.shift(), retry: true }); logActivity(1); draw(); // once more at the end of this session
      } }, t("↻ Again")),
      h("button", { type: "button", class: "btn", onClick: () => {
        if (!cur.retry) { grade(cur.courseId, cur.key, true); right++; }
        deck.shift(); logActivity(1); draw();
      } }, t("✓ I knew it")));
    const flip = flipCard(cur.card, (on) => { actions.hidden = !on; }, { label: `${cur.name} · ${cur.card.group}` });
    if (cur.dir) flip.setAttribute("dir", cur.dir);
    const nextBox = Math.min(INTERVALS.length - 1, (cur.box || 1) + 1);
    root.replaceChildren(head(t("Review today"), tn(total, "{n} card due", "{n} cards due")), h("div", { class: "panel grid gap-4 max-w-xl" },
      h("div", { class: "grid gap-2" },
        h("div", { class: "flex justify-between text-sm mute" }, h("span", {}, t("Card {n} of {all}", { n: Math.min(done + 1, total), all: total })),
          h("span", {}, cur.retry ? t("Once more") : t("Known: back in {days} days", { days: INTERVALS[nextBox] }))),
        bar((done / total) * 100)),
      flip, actions,
      again ? h("p", { class: "mute text-xs" }, tn(again, "{n} card comes back tomorrow.", "{n} cards come back tomorrow.")) : null));
    flip.focus({ preventScroll: true });
  };
  draw();
}
