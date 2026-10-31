// HelloKhedma's own skill courses and cheat sheets.
// Content lives in content/courses/*.json (published with the site, edited like code):
//   index.json  -> [{ id, name, category, paths: [path ids], skills: [skill names from js/ats.js], level, minutes,
//                     lessonCount, summary }]   (minutes = courseTime() of the course file, checked by a smoke test)
//   <id>.json   -> { why, outcome, lessons: [{ title, text: [..], points: [..], example?: { lang, code, note? } }],
//                    cheatsheet: [{ group, items: [[syntax, meaning]] }],
//                    exercises: [{ q, hint?, answer, code?: "sql" | "python" | ... (answer shown as code) }],
//                    pitfalls: [..], interview: [{ q, a }] }
// French: content/courses/fr/<id>.json (same structure and lesson order: progress is stored by lesson index) and
// fr/index.json ([{ id, name, summary }], merged over index.json). Missing French files fall back to English.
// Lesson progress is kept in this browser ("hk.lessons").
// The AI engineer track in Tunisian ("ai-…" ids, aitrack.js) uses the same player: content from content/ai/<script>/,
// right-to-left content in Arabic letters, a script switch in the header and a back link to #/ai.
// Course page: header with progress, then tabs: Lessons (one lesson at a time, lesson list + "Mark as done & continue"),
// Quiz, Flashcards, Practice, Interview (practice.js) and the printable Cheat sheet. XP and "Resume" via activity.js.
import { $, h, ls, toast } from "./lib.js";
import { t, lang, fetchContent } from "./i18n.js";
import { isAiCourse, aiScript, aiMeta, aiDir, loadAiCourse, scriptSwitch } from "./aitrack.js";
import { logActivity, setLastCourse, lastCourse } from "./activity.js";
import { quiz, flashcards, exercises, interviewCards, quizBest, exercisesSolved } from "./practice.js";
import { lessonTime, courseTime, formatMinutes } from "./coursetime.js";

const BASE = "content/courses/";
const LESSONS_KEY = "hk.lessons";
let index = [];
const cache = new Map();

const doneSet = () => { try { return new Set(JSON.parse(ls.get(LESSONS_KEY) || "[]")); } catch { return new Set(); } };
const saveDone = (s) => ls.set(LESSONS_KEY, JSON.stringify([...s]));

export async function loadCourseIndex() {
  try {
    const res = await fetch(`${BASE}index.json`);
    if (res.ok) index = await res.json();
  } catch { index = []; }
  if (lang === "fr") { // French names and summaries; ids, skills, paths and minutes stay in index.json
    const fr = await fetch(`${BASE}fr/index.json`).then((r) => (r.ok ? r.json() : [])).catch(() => []);
    const byId = new Map(fr.map((x) => [x.id, x]));
    index = index.map((c) => ({ ...c, ...(byId.get(c.id) ? { name: byId.get(c.id).name, summary: byId.get(c.id).summary } : {}) }));
  }
  return index;
}

// Course metadata + share of lessons done in this browser (0..1), for the weekly study plan.
export function courseMeta(id) {
  const c = index.find((x) => x.id === id);
  if (!c) return null;
  const d = [...doneSet()].filter((k) => k.startsWith(`${id}:`)).length;
  return { ...c, done: c.lessonCount ? Math.min(1, d / c.lessonCount) : 0 };
}

// Skill name (as extracted by js/ats.js) -> course id, so missing skills can link to a course.
export function courseForSkill(name) {
  return index.find((c) => c.skills.includes(name))?.id || null;
}

function lessonCount(c) { return c.lessonCount || 0; }
const lessonsDone = (id, done = doneSet()) => [...done].filter((k) => k.startsWith(`${id}:`)).length;

function courseCard(c, done) {
  const n = lessonCount(c), d = lessonsDone(c.id, done), best = quizBest(c.id);
  const complete = n && d >= n;
  return h("a", { href: `#/course/${c.id}`, class: "panel flex flex-col gap-2 !p-4" },
    h("div", { class: "flex items-center gap-2" },
      h("span", { class: "chip !py-0 text-xs" }, t(c.level)),
      h("span", { class: "mute text-xs ml-auto", title: t("Reading and practice") }, `≈ ${formatMinutes(c.minutes)}`)),
    h("b", { class: "block" }, c.name),
    h("p", { class: "mute text-sm flex-1" }, c.summary),
    n ? h("div", { class: "h-1.5 rounded-full", style: "background:var(--line)" },
      h("div", { class: "h-1.5 rounded-full", style: `width:${Math.round((d / n) * 100)}%;background:${complete ? "#18a999" : "var(--accent)"}` })) : null,
    h("div", { class: "flex items-center gap-2 text-xs" },
      h("span", { class: "font-medium", style: complete ? "color:#18a999" : d ? "color:var(--accent)" : "" },
        complete ? t("✓ Completed") : d ? t("Continue · {d}/{n} lessons", { d, n }) : t("Start →")),
      best != null ? h("span", { class: "mute ml-auto" }, t("Quiz best {s}", { s: best })) : null));
}

// Courses for the current path first; the others in a collapsible block.
export function renderCourseList(root, pathId) {
  if (!index.length) { root.replaceChildren(h("p", { class: "mute text-sm" }, t("Courses could not be loaded."))); return; }
  const done = doneSet();
  const mine = index.filter((c) => c.paths.includes(pathId));
  const others = index.filter((c) => !c.paths.includes(pathId));
  root.replaceChildren(
    h("div", { class: "grid gap-3 sm:grid-cols-2 lg:grid-cols-3" }, mine.map((c) => courseCard(c, done))),
    others.length ? h("details", { class: "mt-3" },
      h("summary", { class: "cursor-pointer mute text-sm" }, t("Other courses ({n})", { n: others.length })),
      h("div", { class: "grid gap-3 sm:grid-cols-2 lg:grid-cols-3 mt-3" }, others.map((c) => courseCard(c, done)))) : null,
  );
}

// AI track courses ("ai-…", aitrack.js) come from content/ai/<script>/, cached per script.
async function loadCourse(id) {
  const key = isAiCourse(id) ? `${id}@${aiScript()}` : id;
  if (cache.has(key)) return cache.get(key);
  const c = isAiCourse(id) ? await loadAiCourse(id)
    : await fetchContent(BASE, `${encodeURIComponent(id)}.json`).catch(() => { throw new Error(t("This course does not exist (yet).")); });
  cache.set(key, c);
  return c;
}

// Interview questions of every course of a path, for the Interview prep "Technical" deck.
export async function courseInterviewQuestions(pathId) {
  if (!index.length) await loadCourseIndex();
  const mine = index.filter((c) => c.paths.includes(pathId));
  const loaded = await Promise.all(mine.map((c) => loadCourse(c.id).then((x) => ({ c, x })).catch(() => null)));
  return loaded.filter(Boolean).flatMap(({ c, x }) => (x.interview || []).map((iv, i) =>
    ({ id: `tech:${c.id}:${i}`, q: iv.q, model: iv.a, course: { id: c.id, name: c.name } })));
}

// Code with a Copy button (lessons and exercise answers).
function codeBlock(lang, code) {
  const btn = h("button", { type: "button", class: "btn-ghost !py-0.5 !px-2 !text-xs absolute top-2 right-2", "data-print-hide": "",
    onClick: async () => {
      try { await navigator.clipboard.writeText(code); btn.textContent = t("Copied ✓"); } catch { btn.textContent = t("Copy failed"); }
      setTimeout(() => { btn.textContent = t("Copy"); }, 1500);
    } }, t("Copy"));
  return h("div", { class: "relative", dir: "ltr" }, h("pre", { class: "codeblock !pr-16", "data-lang": lang || "" }, h("code", {}, code)), btn); // ltr inside Arabic text too
}

function printCheatsheet() {
  document.documentElement.classList.add("print-cheatsheet");
  window.addEventListener("afterprint", () => document.documentElement.classList.remove("print-cheatsheet"), { once: true });
  window.print();
}

const TABS = [["lessons", "Lessons"], ["quiz", "Quiz"], ["cards", "Flashcards"], ["practice", "Practice"], ["interview", "Interview"], ["cheat", "Cheat sheet"]];

export async function renderCourse(id) {
  const root = $("#courseBody");
  root.replaceChildren(h("p", { class: "mute" }, t("Loading course…")));
  const ai = isAiCourse(id), back = ai ? "#/ai" : "#/training";
  const meta = ai ? await aiMeta(id) : index.find((x) => x.id === id);
  let c;
  try {
    c = { ...(await loadCourse(id)), ...meta, id };
  } catch (e) {
    root.replaceChildren(h("a", { href: back, class: "mute text-sm underline" }, t("← All courses")),
      h("p", { class: "panel" }, e.message || t("Could not load this course.")));
    toast(e.message || t("Could not load this course."));
    return;
  }
  document.title = `${c.name} · HelloKhedma`;
  const n = c.lessons.length;
  const isDone = (i) => doneSet().has(`${c.id}:${i}`);
  const last = lastCourse();
  let tab = "lessons";
  let cur = last?.id === id && last.lesson < n ? last.lesson : Math.max(0, c.lessons.findIndex((_, i) => !isDone(i)));

  /* header: progress across lessons, quiz and exercises */
  const progress = h("div", { class: "grid gap-2 mt-4" });
  const drawProgress = () => {
    const d = c.lessons.filter((_, i) => isDone(i)).length, best = quizBest(id), ex = exercisesSolved(id);
    progress.replaceChildren(
      h("div", { class: "flex flex-wrap items-center gap-x-4 gap-y-1 text-sm" },
        h("span", { id: "courseProgress", class: "font-medium" }, t("{d}/{n} lessons done", { d, n })),
        h("span", { class: "mute" }, best != null ? t("Quiz best {s}", { s: best }) : t("Quiz not taken yet")),
        c.exercises?.length ? h("span", { class: "mute" }, t("{d}/{n} exercises solved", { d: ex, n: c.exercises.length })) : null,
        d === n ? h("span", { class: "badge ml-auto", style: "background:color-mix(in srgb,#18a999 18%,var(--panel));color:#18a999" }, t("🏅 Course complete")) : null),
      h("div", { class: "h-2 rounded-full", style: "background:var(--line)" },
        h("div", { class: "h-2 rounded-full", style: `width:${Math.round((d / n) * 100)}%;background:${d === n ? "#18a999" : "var(--accent)"};transition:width .4s ease` })));
  };

  const tabBar = h("div", { role: "tablist", "aria-label": t("Course sections"), "data-print-hide": "" });
  const body = h("div", { role: "tabpanel", ...(ai ? aiDir() : {}) }); // Tunisian in Arabic letters reads right to left
  const show = (name) => { tab = name; drawTabs(); drawBody(); };
  const drawTabs = () => tabBar.replaceChildren(...TABS.filter(([k]) =>
    (k !== "interview" || c.interview?.length) && (k !== "practice" || c.exercises?.length)).map(([k, label]) =>
    h("button", { type: "button", role: "tab", class: tab === k ? "btn" : "btn-ghost", "aria-selected": String(tab === k), onClick: () => show(k) }, t(label))));

  /* lessons: list on the left, one lesson on the right */
  function drawLessons() {
    const l = c.lessons[cur], done = isDone(cur);
    setLastCourse(id, cur);
    const go = (i) => { cur = i; drawLessons(); const top = body.getBoundingClientRect().top; if (top < 0) body.scrollIntoView({ behavior: "smooth" }); };
    const toggle = (val) => {
      const s = doneSet(), key = `${id}:${cur}`;
      if (val) { if (!s.has(key)) logActivity(10); s.add(key); } else s.delete(key);
      saveDone(s); drawProgress();
    };
    const list = h("ol", { class: "grid gap-1" }, c.lessons.map((x, i) => h("li", {},
      h("button", { type: "button", class: "w-full text-left flex items-center gap-3 rounded-xl px-3 py-2 hover:bg-[var(--soft)]",
        style: i === cur ? "background:var(--soft)" : "", "aria-current": i === cur ? "step" : null, onClick: () => go(i) },
        h("span", { class: "w-7 h-7 shrink-0 rounded-full grid place-items-center text-xs font-semibold",
          style: isDone(i) ? "background:#18a999;color:#fff" : i === cur ? "background:var(--accent);color:#fff" : "background:var(--panel);border:1px solid var(--line)" },
          isDone(i) ? "✓" : String(i + 1)),
        h("span", { class: "min-w-0" }, h("span", { class: "block text-sm font-medium leading-snug" }, x.title),
          h("span", { class: "mute text-xs", dir: "ltr" }, `≈ ${formatMinutes(lessonTime(x).total)}`))))));
    const isLast = cur === n - 1;
    const nextBtn = done
      ? (isLast ? h("button", { type: "button", class: "btn", onClick: () => show("quiz") }, t("Test yourself: take the quiz →"))
        : h("button", { type: "button", class: "btn", onClick: () => go(cur + 1) }, t("Next lesson →")))
      : h("button", { type: "button", class: "btn", onClick: () => {
          toggle(true);
          toast(t("+10 XP · lesson done"));
          if (isLast) { drawLessons(); show("quiz"); } else go(cur + 1);
        } }, isLast ? t("✓ Finish the course") : t("✓ Mark as done & continue"));
    body.replaceChildren(h("div", { class: "grid gap-4 grid-cols-[minmax(0,1fr)] lg:grid-cols-[260px_minmax(0,1fr)] items-start" },
      h("nav", { class: "panel !p-2 order-last lg:order-none lg:sticky lg:top-20", "aria-label": t("Lessons") }, list),
      h("article", { class: "panel grid grid-cols-[minmax(0,1fr)] gap-3 min-w-0" },
        h("p", { class: "eyebrow" }, t("Lesson {n} of {all} · {time}", { n: cur + 1, all: n, time: `≈ ${formatMinutes(lessonTime(l).total)}` }),
          done ? h("span", { class: "badge", style: "background:color-mix(in srgb,#18a999 18%,var(--panel));color:#18a999" }, t("Done")) : null),
        h("h2", { class: "serif !text-2xl !font-medium !mb-0" }, l.title),
        ...(l.text || []).map((p) => h("p", { class: "leading-relaxed" }, p)),
        l.points?.length ? h("div", { class: "rounded-xl p-4", style: "background:var(--soft)" },
          h("p", { class: "eyebrow mb-2" }, t("Key points")),
          h("ul", { class: "grid gap-1.5 text-sm" }, l.points.map((p) => h("li", { class: "flex gap-2" }, h("span", { style: "color:var(--accent)" }, "●"), h("span", {}, p))))) : null,
        l.example ? h("div", { class: "grid gap-1" },
          h("p", { class: "eyebrow" }, t("Example")),
          codeBlock(l.example.lang, l.example.code),
          l.example.note ? h("p", { class: "mute text-xs" }, l.example.note) : null) : null,
        h("div", { class: "flex flex-wrap items-center gap-2 pt-3 mt-1", style: "border-top:1px solid var(--line)" },
          cur > 0 ? h("button", { type: "button", class: "btn-ghost", onClick: () => go(cur - 1) }, t("← Previous")) : null,
          done ? h("button", { type: "button", class: "mute text-xs underline", onClick: () => { toggle(false); drawLessons(); } }, t("Mark as not done")) : null,
          h("span", { class: "ml-auto" }), nextBtn))));
  }

  function drawCheat() {
    body.replaceChildren(h("section", { class: "panel cheatsheet" },
      h("div", { class: "flex flex-wrap items-center gap-2 mb-3" },
        h("h2", { class: "!mb-0" }, t("{name} cheat sheet", { name: c.name })),
        h("button", { type: "button", class: "btn-ghost !py-1 ml-auto", "data-print-hide": "", onClick: printCheatsheet }, t("Print / save as PDF"))),
      h("div", { class: "grid gap-4 md:grid-cols-2" }, c.cheatsheet.map((g) => h("div", {},
        h("h3", { class: "font-semibold text-sm mb-1", style: "color:var(--accent)" }, g.group),
        h("table", { class: "w-full text-sm" }, h("tbody", {}, g.items.map(([syntax, meaning]) => h("tr", { style: "border-top:1px solid var(--line)" },
          h("td", { class: "py-1.5 pr-3 align-top" }, h("code", { class: "inline-code" }, syntax)),
          h("td", { class: "py-1.5 align-top mute" }, meaning)))))))),
      c.pitfalls?.length ? h("div", { class: "mt-5", "data-print-hide": "" },
        h("h3", { class: "font-semibold text-sm mb-2" }, t("Common mistakes")),
        h("ul", { class: "grid gap-1.5 text-sm" }, c.pitfalls.map((p) => h("li", { class: "flex gap-2" }, h("span", { style: "color:#e0508b" }, "⚠"), h("span", {}, p))))) : null));
  }

  const panel = (title, sub, fill) => { const box = h("div"); body.replaceChildren(h("section", { class: "panel grid gap-4" },
    h("div", {}, h("h2", { class: "!mb-1" }, title), h("p", { class: "mute text-sm" }, sub)), box)); fill(box); };
  function drawBody() {
    if (tab === "lessons") drawLessons();
    else if (tab === "quiz") panel(t("Quiz"), t("Questions drawn from the cheat sheet. A new mix every time."), (b) => quiz(b, c, { onReview: () => show("cards") }));
    else if (tab === "cards") panel(t("Flashcards"), t("Flip each card, then say whether you knew it. Known cards are set aside."), (b) => flashcards(b, c));
    else if (tab === "practice") panel(t("Practice"), t("Try each exercise yourself before revealing the answer."), (b) => exercises(b, c, codeBlock));
    else if (tab === "interview") panel(t("Interview questions"), t("Questions recruiters ask about {name}.", { name: c.name }), (b) => interviewCards(b, c));
    else drawCheat();
    drawProgress();
  }

  root.replaceChildren(
    h("a", { href: back, class: "mute text-sm underline", "data-print-hide": "" }, ai ? t("← AI engineer track") : t("← All courses")),
    h("header", { class: "panel", "data-print-hide": "" },
      h("div", { class: "flex flex-wrap items-center gap-2 mb-2" },
        h("span", { class: "chip !py-0 text-xs" }, c.level ? t(c.level) : ""),
        ai ? h("span", { class: "ml-auto order-last" }, scriptSwitch(() => renderCourse(id))) : null,
        h("span", { class: "mute text-sm" }, t("{category} · about {total} ({reading} reading, {practice} practice)", {
          category: c.category ? t(c.category) : "", ...Object.fromEntries(Object.entries(courseTime(c)).map(([k, v]) => [k, formatMinutes(v)])) }))),
      h("h1", { id: "h-course", tabindex: "-1", class: "page-title !mb-1", ...(ai ? aiDir() : {}) }, c.name),
      h("p", { class: "mute", ...(ai ? aiDir() : {}) }, c.summary),
      c.why || c.outcome ? h("details", { class: "mt-3 text-sm" },
        h("summary", { class: "cursor-pointer", style: "color:var(--accent)" }, t("Why this course?")),
        c.why ? h("p", { class: "mt-2" }, h("b", {}, t("Why recruiters care: ")), ai ? h("span", { ...aiDir(), class: "block" }, c.why) : c.why) : null,
        c.outcome ? h("p", { class: "mt-1" }, h("b", {}, t("After this course you can: ")), ai ? h("span", { ...aiDir(), class: "block" }, c.outcome) : c.outcome) : null) : null,
      progress),
    tabBar, body);
  drawTabs(); drawBody();
}
