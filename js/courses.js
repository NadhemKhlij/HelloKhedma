// HelloKhedma's own skill courses and cheat sheets.
// Content lives in content/courses/*.json (published with the site, edited like code):
//   index.json  -> [{ id, name, category, paths: [path ids], skills: [skill names from js/ats.js], level, hours,
//                     lessonCount, summary }]
//   <id>.json   -> { why, outcome, lessons: [{ title, minutes, text: [..], points: [..], example?: { lang, code, note? } }],
//                    cheatsheet: [{ group, items: [[syntax, meaning]] }],
//                    exercises: [{ q, hint?, answer, code?: "sql" | "python" | ... (answer shown as code) }],
//                    pitfalls: [..], interview: [{ q, a }] }
// French: content/courses/fr/<id>.json (same structure and lesson order: progress is stored by lesson index) and
// fr/index.json ([{ id, name, summary }], merged over index.json). Missing French files fall back to English.
// Lesson progress is kept in this browser ("hk.lessons").
import { $, h, ls, toast } from "./lib.js";
import { t, lang, fetchContent } from "./i18n.js";

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
  if (lang === "fr") { // French names and summaries; ids, skills, paths and hours stay in index.json
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

function courseCard(c, done) {
  const n = lessonCount(c), d = [...done].filter((k) => k.startsWith(`${c.id}:`)).length;
  return h("a", { href: `#/course/${c.id}`, class: "panel block hover:opacity-90 !p-4" },
    h("div", { class: "flex items-center gap-2 mb-1" },
      h("span", { class: "chip chip-ok !py-0 text-xs" }, t(c.level)),
      h("span", { class: "mute text-xs ml-auto" }, `${c.hours} h${n ? t(" · {d}/{n} lessons", { d, n }) : ""}`)),
    h("b", { class: "block" }, c.name),
    h("p", { class: "mute text-sm mt-1" }, c.summary));
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

async function loadCourse(id) {
  if (cache.has(id)) return cache.get(id);
  const c = await fetchContent(BASE, `${encodeURIComponent(id)}.json`).catch(() => { throw new Error(t("This course does not exist (yet).")); });
  cache.set(id, c);
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

const codeBlock =(lang, code) => h("pre", { class: "codeblock", "data-lang": lang || "" }, h("code", {}, code));

function lessonBlock(course, l, i, done) {
  const key = `${course.id}:${i}`;
  const box = h("input", { type: "checkbox", checked: done.has(key), "aria-label": t("Mark \"{title}\" as done", { title: l.title }),
    onChange: (e) => {
      const s = doneSet();
      e.target.checked ? s.add(key) : s.delete(key);
      saveDone(s);
      updateCourseProgress(course);
    } });
  return h("details", { class: "rounded-lg", style: "background:var(--bg);border:1px solid var(--line)", open: i === 0 },
    h("summary", { class: "cursor-pointer p-3 flex items-center gap-2" },
      h("span", { class: "chip !py-0 text-xs" }, t("Lesson {n}", { n: i + 1 })), h("b", {}, l.title),
      h("span", { class: "mute text-xs ml-auto" }, `${l.minutes} min`)),
    h("div", { class: "px-3 pb-3 grid gap-2 text-sm" },
      ...(l.text || []).map((p) => h("p", {}, p)),
      l.points?.length ? h("ul", { class: "list-disc pl-5 grid gap-1" }, l.points.map((p) => h("li", {}, p))) : null,
      l.example ? h("div", {},
        codeBlock(l.example.lang, l.example.code),
        l.example.note ? h("p", { class: "mute text-xs mt-1" }, l.example.note) : null) : null,
      h("label", { class: "flex items-center gap-2 mt-1" }, box, h("span", { class: "mute" }, t("I've done this lesson")))));
}

function updateCourseProgress(course) {
  const done = doneSet(), n = course.lessons.length;
  const d = course.lessons.filter((_, i) => done.has(`${course.id}:${i}`)).length;
  $("#courseProgress").textContent = t("{d}/{n} lessons done", { d, n }) + (d === n ? t(" · course complete 🎉") : "");
}

function printCheatsheet() {
  document.documentElement.classList.add("print-cheatsheet");
  window.addEventListener("afterprint", () => document.documentElement.classList.remove("print-cheatsheet"), { once: true });
  window.print();
}

export async function renderCourse(id) {
  const root = $("#courseBody");
  root.replaceChildren(h("p", { class: "mute" }, t("Loading course…")));
  const meta = index.find((c) => c.id === id);
  try {
    const c = { ...(await loadCourse(id)), ...meta, id };
    document.title = `${c.name} · HelloKhedma`;
    const done = doneSet();
    root.replaceChildren(
      h("a", { href: "#/training", class: "mute text-sm underline", "data-print-hide": "" }, t("← All courses")),
      h("header", { class: "panel", "data-print-hide": "" },
        h("div", { class: "flex flex-wrap items-center gap-2 mb-2" },
          h("span", { class: "chip chip-ok !py-0 text-xs" }, c.level ? t(c.level) : ""),
          h("span", { class: "mute text-sm" }, t("{category} · about {hours} h", { category: c.category ? t(c.category) : "", hours: c.hours })),
          h("span", { id: "courseProgress", class: "mute text-sm ml-auto" })),
        h("h1", { id: "h-course", tabindex: "-1", class: "page-title !mb-1" }, c.name),
        h("p", { class: "mute" }, c.summary),
        c.why ? h("p", { class: "text-sm mt-3" }, h("b", {}, t("Why recruiters care: ")), c.why) : null,
        c.outcome ? h("p", { class: "text-sm mt-1" }, h("b", {}, t("After this course you can: ")), c.outcome) : null),

      h("section", { class: "panel", "data-print-hide": "" },
        h("h2", {}, t("Lessons")),
        h("div", { class: "grid gap-3" }, c.lessons.map((l, i) => lessonBlock(c, l, i, done)))),

      h("section", { class: "panel cheatsheet" },
        h("div", { class: "flex flex-wrap items-center gap-2 mb-3" },
          h("h2", { class: "!mb-0" }, t("{name} cheat sheet", { name: c.name })),
          h("button", { type: "button", class: "btn-ghost !py-1 ml-auto", "data-print-hide": "", onClick: printCheatsheet }, t("Print / save as PDF"))),
        h("div", { class: "grid gap-4 md:grid-cols-2" }, c.cheatsheet.map((g) => h("div", {},
          h("h3", { class: "font-bold text-sm mb-1", style: "color:var(--accent)" }, g.group),
          h("table", { class: "w-full text-sm" }, h("tbody", {}, g.items.map(([syntax, meaning]) => h("tr", { style: "border-top:1px solid var(--line)" },
            h("td", { class: "py-1 pr-3 align-top" }, h("code", { class: "inline-code" }, syntax)),
            h("td", { class: "py-1 align-top mute" }, meaning))))))))),

      c.pitfalls?.length ? h("section", { class: "panel", "data-print-hide": "" },
        h("h2", {}, t("Common mistakes")),
        h("ul", { class: "list-disc pl-5 grid gap-1 text-sm" }, c.pitfalls.map((p) => h("li", {}, p)))) : null,

      h("section", { class: "panel", "data-print-hide": "" },
        h("h2", {}, t("Practice")),
        h("ol", { class: "grid gap-3 text-sm list-decimal pl-5" }, c.exercises.map((e) => h("li", {},
          h("p", {}, e.q),
          e.hint ? h("p", { class: "mute text-xs mt-1" }, t("Hint: {hint}", { hint: e.hint })) : null,
          h("details", { class: "mt-1" }, h("summary", { class: "cursor-pointer text-xs", style: "color:var(--accent)" }, t("Show answer")),
            e.code ? codeBlock(e.code, e.answer) : h("p", { class: "mt-1" }, e.answer)))))),

      c.interview?.length ? h("section", { class: "panel", "data-print-hide": "" },
        h("h2", {}, t("Interview questions")),
        h("div", { class: "grid gap-2 text-sm" }, c.interview.map((x) => h("details", { class: "rounded-lg p-3", style: "background:var(--bg);border:1px solid var(--line)" },
          h("summary", { class: "cursor-pointer font-medium" }, x.q),
          h("p", { class: "mt-2 mute" }, x.a))))) : null,
    );
    updateCourseProgress(c);
  } catch (e) {
    root.replaceChildren(h("a", { href: "#/training", class: "mute text-sm underline" }, t("← All courses")),
      h("p", { class: "panel" }, e.message || t("Could not load this course.")));
    toast(e.message || t("Could not load this course."));
  }
}
