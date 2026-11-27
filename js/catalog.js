// The course catalogue (split from courses.js, functional audit of 2026-11-23, P3: every visit loaded the whole course
// player, quizzes and drills because state.js needed courseForSkill). What Training, "Close the gaps", Interview prep,
// the skill check and the admin page need without the player:
// - loadCourseIndex(): content/courses/index.json (+ French names and summaries) and the ready AI track courses;
// - courseMeta(id), courseForSkill(name), indexEntry(id); renderCourseList(root, pathId) (Training's course cards);
// - loadCourse(id): one course file (AI track from content/ai/<language>/), cached per language;
// - courseInterviewQuestions(pathId); doneSet() / saveDone() for lesson progress ("hk.lessons", synced by learnsync.js).
// Imports nothing heavy: no practice.js (the quiz best score is read from "hk.quiz" directly).
import { h, ls } from "./lib.js";
import { t, lang, fetchContent } from "./i18n.js";
import { isAiCourse, aiScript, aiText, loadAiCourse, loadAiIndex } from "./aitrack.js";
import { formatMinutes } from "./coursetime.js";
import { passedCourses } from "./srs.js";

const BASE = "content/courses/";
const LESSONS_KEY = "hk.lessons";
let index = [];
const cache = new Map();
const quizBest = (id) => { try { return JSON.parse(ls.get("hk.quiz") || "{}")[id] ?? null; } catch { return null; } };
export const indexEntry = (id) => index.find((x) => x.id === id);

export const doneSet = () => { try { return new Set(JSON.parse(ls.get(LESSONS_KEY) || "[]")); } catch { return new Set(); } };
export const saveDone = (s) => ls.set(LESSONS_KEY, JSON.stringify([...s]));

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
  // AI engineer track courses: the courses of the AI Engineer path (names kept in every language, see aiView).
  const ai = await loadAiIndex();
  index = index.filter((c) => !isAiCourse(c.id)).concat(ai.filter((c) => c.status === "ready")
    .map((c) => ({ ...c, category: "AI", paths: ["ai"], names: c.name, summaries: c.summary })));
  return index.map(aiView);
}
// An AI track entry with its name and summary in the track's current language (it can change on #/ai).
const aiView = (c) => (c.names ? { ...c, name: aiText(c.names), summary: aiText(c.summaries) } : c);

// Course metadata + share of lessons done in this browser (0..1), for the weekly study plan.
export function courseMeta(id) {
  const c = index.map(aiView).find((x) => x.id === id);
  if (!c) return null;
  const d = [...doneSet()].filter((k) => k.startsWith(`${id}:`)).length;
  return { ...c, done: c.lessonCount ? Math.min(1, d / c.lessonCount) : 0 };
}

// Skill name (as extracted by js/ats.js) -> course id, so missing skills can link to a course.
export function courseForSkill(name) {
  return index.find((c) => c.skills.includes(name))?.id || null;
}

function lessonCount(c) { return c.lessonCount || 0; }
const fill = (el, ...kids) => el.replaceChildren(...kids.filter(Boolean)); // replaceChildren() would print null as text
const lessonsDone = (id, done = doneSet()) => [...done].filter((k) => k.startsWith(`${id}:`)).length;

function courseCard(c, done, known = new Set()) {
  const n = lessonCount(c), d = lessonsDone(c.id, done), best = quizBest(c.id);
  const complete = n && d >= n;
  return h("a", { href: `#/course/${c.id}`, class: "panel flex flex-col gap-2 !p-4" },
    h("div", { class: "flex items-center gap-2" },
      h("span", { class: "chip !py-0 text-xs" }, t(c.level)),
      h("span", { class: "mute text-xs ml-auto", title: t("Reading and practice") }, `≈ ${formatMinutes(c.minutes)}`)),
    h("b", { class: "block" }, c.name),
    h("p", { class: "mute text-sm flex-1" }, c.summary),
    n ? h("div", { class: "h-1.5 rounded-full", style: "background:var(--line)" },
      h("div", { class: "h-1.5 rounded-full", style: `width:${Math.round((d / n) * 100)}%;background:${complete ? "var(--ok)" : "var(--accent)"}` })) : null,
    h("div", { class: "flex items-center gap-2 text-xs" },
      h("span", { class: "font-medium", style: complete ? "color:var(--ok)" : d ? "color:var(--accent-ink)" : "" },
        complete ? t("✓ Completed") : d ? t("Continue · {d}/{n} lessons", { d, n }) : t("Start →")),
      known.has(c.id) ? h("span", { class: "ml-auto", style: "color:var(--ok)", title: t("Skill check passed: the study plan skips this course") }, t("🎯 Known")) : null,
      best != null ? h("span", { class: `mute ${known.has(c.id) ? "" : "ml-auto"}` }, t("Quiz best {s}", { s: best })) : null));
}

// Courses for the current path first; the others in a collapsible block.
export function renderCourseList(root, pathId) {
  if (!index.length) { root.replaceChildren(h("p", { class: "mute text-sm" }, t("Courses could not be loaded."))); return; }
  const done = doneSet(), known = passedCourses(), all = index.map(aiView);
  const mine = all.filter((c) => c.paths.includes(pathId));
  const others = all.filter((c) => !c.paths.includes(pathId));
  root.replaceChildren(...[ // filter: replaceChildren() would print null as text
    h("div", { class: "grid gap-3 sm:grid-cols-2 lg:grid-cols-3" }, mine.map((c) => courseCard(c, done, known))),
    others.length ? h("details", { class: "mt-3" },
      h("summary", { class: "cursor-pointer mute text-sm" }, t("Other courses ({n})", { n: others.length })),
      h("div", { class: "grid gap-3 sm:grid-cols-2 lg:grid-cols-3 mt-3" }, others.map((c) => courseCard(c, done, known)))) : null,
  ].filter(Boolean));
}

// AI track courses ("ai-…", aitrack.js) come from content/ai/<language>/, cached per language.
export async function loadCourse(id) {
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
  const mine = index.map(aiView).filter((c) => c.paths.includes(pathId));
  const loaded = await Promise.all(mine.map((c) => loadCourse(c.id).then((x) => ({ c, x })).catch(() => null)));
  return loaded.filter(Boolean).flatMap(({ c, x }) => (x.interview || []).map((iv, i) =>
    ({ id: `tech:${c.id}:${i}`, q: iv.q, model: iv.a, course: { id: c.id, name: c.name } })));
}
