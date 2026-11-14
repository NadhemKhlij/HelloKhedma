// HelloKhedma's own skill courses and cheat sheets.
// Content lives in content/courses/*.json (published with the site, edited like code):
//   index.json  -> [{ id, name, category, paths: [path ids], skills: [skill names from js/ats.js], level, minutes,
//                     lessonCount, summary }]   (minutes = courseTime() of the course file, checked by a smoke test)
//   <id>.json   -> { why, outcome, lessons: [{ title, text: [..], points: [..], example?: { lang, code, note? } }],
//                    cheatsheet: [{ group, items: [[syntax, meaning]] }],
//                    exercises: [{ q, hint?, answer, code?: "sql" | "python" | ... (answer shown as code),
//                                  run?: { db, … } (runnable SQL), type?: "choice" | "fill" | … (auto-graded, drills.js),
//                                  explain? (text under a code answer) }],
//                    pitfalls: [..], interview: [{ q, a }],
//                    playground?: { name, url, about? } }   a free online engine for this course (DAX.do for DAX):
//                    lesson examples and written exercises with "try": true are full queries that run there; a ▶ button
//                    copies the code (or the learner's attempt) and opens the playground in a new tab (just a link: nothing
//                    is sent by HelloKhedma)
// French: content/courses/fr/<id>.json (same structure and lesson order: progress is stored by lesson index) and
// fr/index.json ([{ id, name, summary }], merged over index.json). Missing French files fall back to English.
// Lesson progress is kept in this browser ("hk.lessons") and synced to the account when signed in (learnsync.js).
// The AI engineer track ("ai-…" ids, aitrack.js) uses the same player: content from content/ai/<language>/ (English,
// French, Derja in Arabic letters or 3arbizi), right-to-left content in Arabic letters, a language switch in the header
// and a back link to #/ai. Its ready courses are added to the course index as the courses of the AI Engineer path
// ("ai"), with their names in the track's current language, so Training, "Close the gaps" and Interview prep list them.
// Course page: header with progress, streak and XP, then tabs: Lessons, Quiz, Flashcards, Practice, Interview
// (practice.js) and the printable Cheat sheet. XP and "Resume" via activity.js.
// Lessons (2026-11-09, "lessons felt dull"): the lesson list is a path map (done / current / next), and a lesson is read
// one step at a time: each paragraph, then the example, the key points and a "⚡ Quick check" (practice.js
// lessonChecks / quickCheck: up to 2 questions from the cheat sheet items the lesson teaches, none when no item
// matches), with a segmented progress bar and "Continue". "Show the whole lesson" switches to reading it all at once
// (remembered in this browser, "hk.lessonView" = "all"); a lesson already done opens whole. "✓ Complete lesson" shows a
// small celebration (XP, streak, quick check score) and what comes next. Code is coloured and code words in the text
// are shown as code (highlight.js). Steps are built from the course JSON, so nothing changes in the content files.
// Under each lesson, "💬 Ask about this lesson" (asklesson.js: Claude answers from the lesson, signed-in users).
// At the bottom, "⚑ Report a problem" (report.js), preset to the open lesson or tab.
import { $, h, ls, toast, safeUrl } from "./lib.js";
import { t, tn, lang, fetchContent } from "./i18n.js";
import { isAiCourse, aiScript, aiMeta, aiDir, aiText, loadAiCourse, loadAiIndex, scriptSwitch } from "./aitrack.js";
import { logActivity, setLastCourse, lastCourse, streak, xp } from "./activity.js";
import { quiz, flashcards, exercises, interviewCards, quizBest, exercisesSolved, lessonChecks, quickCheck } from "./practice.js";
import { highlight, codeWords, inlineCode } from "./highlight.js";
import { lessonTime, courseTime, formatMinutes } from "./coursetime.js";
import { logInsight } from "./insights.js";
import { reportBox } from "./report.js";
import { askBox } from "./asklesson.js";
import { passedCourses } from "./srs.js";
import { countFeature } from "./usage.js";

const BASE = "content/courses/";
const LESSONS_KEY = "hk.lessons";
const VIEW_KEY = "hk.lessonView"; // "all": read a lesson all at once; otherwise step by step
// The header's streak and XP follow every learning action (logActivity) on the open course page.
let onActivity = null;
document.addEventListener("hk:activity", () => onActivity?.());
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

// Code with a Copy button (lessons and exercise answers). play = the course's playground ({ name, url }, e.g. DAX.do)
// when this code is a full query that runs there: "▶ name" copies the code and opens the playground in a new tab.
export function playLink(play, getCode, label) {
  const url = safeUrl(play?.url);
  if (!url) return null;
  return h("a", { href: url, target: "_blank", rel: "noopener noreferrer", class: "btn-ghost !py-0.5 !px-2 !text-xs", "data-print-hide": "", "data-play": "",
    title: t("Copies the code, then opens {name} in a new tab: paste it there and run it.", { name: play.name }),
    onClick: () => { navigator.clipboard?.writeText(getCode()).then(() => toast(t("Code copied: paste it in {name} and run it.", { name: play.name })), () => {}); } },
    label || t("▶ Run on {name}", { name: play.name }));
}
function codeBlock(lang, code, play) {
  const btn = h("button", { type: "button", class: "btn-ghost !py-0.5 !px-2 !text-xs", "data-print-hide": "",
    onClick: async () => {
      try { await navigator.clipboard.writeText(code); btn.textContent = t("Copied ✓"); } catch { btn.textContent = t("Copy failed"); }
      setTimeout(() => { btn.textContent = t("Copy"); }, 1500);
    } }, t("Copy"));
  return h("div", { class: "relative", dir: "ltr" }, h("pre", { tabindex: "0", class: `codeblock ${play ? "!pr-36" : "!pr-16"}`, "data-lang": lang || "" }, h("code", {}, highlight(code, lang))), // ltr inside Arabic text too
    h("div", { class: "absolute top-2 right-2 flex gap-1" }, play ? playLink(play, () => code) : null, btn));
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
  const ai = isAiCourse(id), back = ai ? "#/ai" : "#/training/courses";
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
        d === n ? h("span", { class: "badge", style: "background:color-mix(in srgb,var(--ok) 18%,var(--panel));color:var(--ok)" }, t("🏅 Course complete")) : null,
        h("span", { class: "chip !py-0 text-xs ml-auto", title: tn(streak(), "Study streak: {n} day", "Study streak: {n} days") }, `🔥 ${streak()} · ⚡ ${xp()} XP`)),
      h("div", { class: "h-2 rounded-full", style: "background:var(--line)" },
        h("div", { class: "h-2 rounded-full", style: `width:${Math.round((d / n) * 100)}%;background:${d === n ? "var(--ok)" : "var(--accent)"};transition:width .4s ease` })));
  };

  onActivity = () => { if (progress.isConnected) drawProgress(); };

  const tabBar = h("div", { role: "tablist", "aria-label": t("Course sections"), "data-print-hide": "" });
  const body = h("div", { role: "tabpanel", ...(ai ? aiDir() : {}) }); // Tunisian in Arabic letters reads right to left
  const show = (name) => { tab = name; drawTabs(); drawBody(); };
  const drawTabs = () => tabBar.replaceChildren(...TABS.filter(([k]) =>
    (k !== "interview" || c.interview?.length) && (k !== "practice" || c.exercises?.length)).map(([k, label]) =>
    h("button", { type: "button", role: "tab", class: tab === k ? "btn" : "btn-ghost", "aria-selected": String(tab === k), onClick: () => show(k) }, t(label))));

  /* lessons: path map on the left, one lesson on the right, read step by step */
  const words = codeWords(c), checks = lessonChecks(c);
  const rich = (text) => inlineCode(text, words);
  function drawLessons() {
    const l = c.lessons[cur], done = isDone(cur), isLast = cur === n - 1;
    setLastCourse(id, cur);
    const go = (i) => { cur = i; drawLessons(); const top = body.getBoundingClientRect().top; if (top < 0) body.scrollIntoView({ behavior: "smooth" }); };
    const toggle = (val) => {
      const s = doneSet(), key = `${id}:${cur}`;
      const wasComplete = c.lessons.every((_, i) => s.has(`${id}:${i}`));
      if (val) { if (!s.has(key)) { logActivity(10); countFeature("lesson_done"); } s.add(key); } else s.delete(key);
      saveDone(s); drawProgress();
      // Anonymous statistics, only if the user opted in (insights.js): which courses get finished.
      if (!wasComplete && c.lessons.every((_, i) => s.has(`${id}:${i}`))) logInsight("course_done", ls.get("hk.path"), [id]);
    };

    /* the path map */
    const list = h("ol", { class: "lmap grid gap-1" }, c.lessons.map((x, i) => h("li", { class: isDone(i) ? "done" : i === cur ? "cur" : "" },
      h("button", { type: "button", class: "w-full text-left flex items-start gap-3 rounded-xl px-3 py-2 hover:bg-[var(--soft)]",
        style: i === cur ? "background:var(--soft)" : "", "aria-current": i === cur ? "step" : null, onClick: () => go(i) },
        h("span", { class: "lmap-node w-7 h-7 shrink-0 rounded-full grid place-items-center text-xs font-semibold",
          style: isDone(i) ? "background:var(--ok-fill);color:#fff" : i === cur ? "background:var(--accent-fill);color:#fff" : "background:var(--panel);border:1px solid var(--line)" },
          isDone(i) ? "✓" : String(i + 1)),
        h("span", { class: "min-w-0 pt-0.5" }, h("span", { class: "block text-sm font-medium leading-snug" }, x.title),
          h("span", { class: "mute text-xs", dir: "ltr" }, `≈ ${formatMinutes(lessonTime(x).total)}`))))));

    /* the steps: each paragraph, the example, the key points, the quick check */
    let checkScore = null;
    const steps = [
      ...(l.text || []).map((p, k) => () => h("p", { class: `lesson-p${k === 0 ? " lesson-lead" : ""}` }, rich(p))),
      ...(l.example ? [() => h("div", { class: "grid gap-1" },
        h("p", { class: "eyebrow" }, t("Example")),
        codeBlock(l.example.lang, l.example.code, l.example.try && c.playground),
        l.example.note ? h("p", { class: "mute text-xs" }, rich(l.example.note)) : null)] : []),
      ...(l.points?.length ? [() => h("div", { class: "rounded-xl p-4", style: "background:var(--soft)" },
        h("p", { class: "eyebrow mb-2" }, t("Key points")),
        h("ul", { class: "grid gap-2 text-sm" }, l.points.map((p) => h("li", { class: "flex gap-2" },
          h("span", { class: "shrink-0", style: "color:var(--accent-ink)", "aria-hidden": "true" }, "✓"), h("span", {}, rich(p))))))] : []),
      ...(checks[cur]?.length ? [() => quickCheck(c, checks[cur], { onDone: (s, all) => { checkScore = { s, all }; } })] : []),
    ];
    const stepView = ls.get(VIEW_KEY) !== "all";
    let shown = done || !stepView ? steps.length : Math.min(1, steps.length);
    const stepBox = h("div", { class: "grid grid-cols-[minmax(0,1fr)] gap-4", "aria-live": "polite" });
    const segs = h("div", { class: `lseg${done ? " done" : ""}`, "aria-hidden": "true" }, steps.map(() => h("span")));
    const drawSegs = () => [...segs.children].forEach((x, i) => x.classList.toggle("on", i < shown));
    const addStep = (i, animate) => stepBox.append(h("div", { class: `min-w-0${animate ? " step-in" : ""}`, "data-step": String(i) }, steps[i]()));
    for (let i = 0; i < shown; i++) addStep(i, false);

    const foot = h("div", { class: "lesson-foot flex flex-wrap items-center gap-2 pt-4 mt-1", style: "border-top:1px solid var(--line)" });
    const prevBtn = () => (cur > 0 ? h("button", { type: "button", class: "btn-ghost", onClick: () => go(cur - 1) }, t("← Previous")) : null);
    const nextAction = () => (isLast
      ? h("button", { type: "button", class: "btn", onClick: () => show("quiz") }, t("Test yourself: take the quiz →"))
      : h("button", { type: "button", class: "btn", onClick: () => go(cur + 1) }, t("Next lesson →")));
    const drawFoot = (focus) => {
      let main;
      if (shown < steps.length) {
        main = h("button", { type: "button", class: "btn", "data-continue": "", onClick: () => {
          addStep(shown++, true); drawSegs(); drawFoot(true);
          stepBox.lastElementChild.scrollIntoView({ behavior: "smooth", block: "nearest" });
        } }, t("Continue"));
        fill(foot, prevBtn(), h("span", { class: "ml-auto mute text-xs" }, t("Step {n} of {all}", { n: shown, all: steps.length })), main);
      } else if (!isDone(cur)) {
        main = h("button", { type: "button", class: "btn", onClick: () => { toggle(true); celebrate(); } }, isLast ? t("✓ Finish the course") : t("✓ Complete lesson"));
        fill(foot, prevBtn(), h("span", { class: "ml-auto" }), main);
      } else {
        main = nextAction();
        fill(foot, prevBtn(), h("button", { type: "button", class: "mute text-xs underline", onClick: () => { toggle(false); drawLessons(); } }, t("Mark as not done")),
          h("span", { class: "ml-auto" }), main);
      }
      if (focus) main.focus({ preventScroll: true });
    };
    // Lesson done: a short celebration with what was earned and what comes next.
    const celebrate = () => {
      const all = c.lessons.every((_, i) => isDone(i)), s = streak(), nx = c.lessons[cur + 1];
      const next = nextAction(), node = list.children[cur]?.querySelector(".lmap-node");
      list.children[cur].className = "done";
      if (node) { node.textContent = "✓"; node.style.cssText = "background:var(--ok-fill);color:#fff"; }
      foot.replaceChildren(h("div", { class: "celebrate w-full grid justify-items-center gap-3 text-center", role: "status" },
        h("div", { class: "confetti", "aria-hidden": "true" }, [...Array(14)].map((_, k) => {
          const a = (k / 14) * Math.PI * 2, d = 60 + (k % 3) * 25;
          return h("i", { style: `--x:${Math.round(Math.cos(a) * d * 1.8)}px;--y:${Math.round(Math.sin(a) * d - 25)}px;--r:${(k * 47) % 360}deg;animation-delay:${(k % 4) * 40}ms` });
        })),
        h("span", { class: "celebrate-badge", "aria-hidden": "true" }, "✓"),
        h("p", { class: "serif text-2xl" }, all ? t("Course complete! 🎉") : t("Lesson complete!")),
        h("div", { class: "flex flex-wrap justify-center gap-2 text-sm" },
          h("span", { class: "chip" }, "⚡ +10 XP"),
          s ? h("span", { class: "chip" }, `🔥 ${tn(s, "{n} day in a row", "{n} days in a row")}`) : null,
          checkScore ? h("span", { class: "chip" }, t("Quick check {s}/{n}", { s: checkScore.s, n: checkScore.all })) : null,
          h("span", { class: "chip" }, t("{d}/{n} lessons", { d: c.lessons.filter((_, i) => isDone(i)).length, n }))),
        nx ? h("p", { class: "text-sm" }, h("span", { class: "mute" }, t("Up next: ")), h("b", {}, nx.title), h("span", { class: "mute" }, ` · ≈ ${formatMinutes(lessonTime(nx).total)}`)) : null,
        h("div", { class: "flex flex-wrap justify-center gap-2" }, next,
          isLast && c.exercises?.length ? h("button", { type: "button", class: "btn-ghost", onClick: () => show("practice") }, t("Practice exercises")) : null)));
      badge.hidden = false; viewBtn.hidden = true; segs.classList.add("done");
      next.focus({ preventScroll: true });
      foot.scrollIntoView({ behavior: "smooth", block: "nearest" });
    };

    const badge = h("span", { class: "badge", hidden: !done, style: "background:color-mix(in srgb,var(--ok) 18%,var(--panel));color:var(--ok)" }, t("Done"));
    // Step by step (default) or the whole lesson at once, remembered in this browser.
    const viewBtn = h("button", { type: "button", class: "ml-auto mute text-xs underline", hidden: done,
      onClick: () => { ls.set(VIEW_KEY, stepView ? "all" : "steps"); drawLessons(); } },
      stepView ? t("Show the whole lesson") : t("Read step by step"));
    drawSegs(); drawFoot(false);
    body.replaceChildren(h("div", { class: "grid gap-4 grid-cols-[minmax(0,1fr)] lg:grid-cols-[260px_minmax(0,1fr)] items-start" },
      h("nav", { class: "panel !p-2 order-last lg:order-none lg:sticky lg:top-20", "aria-label": t("Lessons") }, list),
      h("article", { class: "panel lesson grid grid-cols-[minmax(0,1fr)] gap-3 min-w-0" },
        h("div", { class: "flex flex-wrap items-center gap-2" },
          h("p", { class: "eyebrow" }, t("Lesson {n} of {all} · {time}", { n: cur + 1, all: n, time: `≈ ${formatMinutes(lessonTime(l).total)}` })),
          badge, viewBtn),
        h("h2", { class: "serif !text-2xl sm:!text-[1.75rem] !font-medium !mb-0 leading-tight" }, l.title),
        steps.length > 1 ? segs : null,
        stepBox, foot,
        askBox(c, l, cur))));
  }

  function drawCheat() {
    body.replaceChildren(h("section", { class: "panel cheatsheet" },
      h("div", { class: "flex flex-wrap items-center gap-2 mb-3" },
        h("h2", { class: "!mb-0" }, t("{name} cheat sheet", { name: c.name })),
        h("button", { type: "button", class: "btn-ghost !py-1 ml-auto", "data-print-hide": "", onClick: printCheatsheet }, t("Print / save as PDF"))),
      h("div", { class: "grid gap-4 md:grid-cols-2" }, c.cheatsheet.map((g) => h("div", {},
        h("h3", { class: "font-semibold text-sm mb-1", style: "color:var(--accent-ink)" }, g.group),
        h("table", { class: "w-full text-sm" }, h("tbody", {}, g.items.map(([syntax, meaning]) => h("tr", { style: "border-top:1px solid var(--line)" },
          h("td", { class: "py-1.5 pr-3 align-top" }, h("code", { class: "inline-code" }, syntax)),
          h("td", { class: "py-1.5 align-top mute" }, meaning)))))))),
      c.pitfalls?.length ? h("div", { class: "mt-5", "data-print-hide": "" },
        h("h3", { class: "font-semibold text-sm mb-2" }, t("Common mistakes")),
        h("ul", { class: "grid gap-1.5 text-sm" }, c.pitfalls.map((p) => h("li", { class: "flex gap-2" }, h("span", { style: "color:var(--bad)" }, "⚠"), h("span", {}, p))))) : null));
  }

  const panel = (title, sub, fill) => { const box = h("div"); body.replaceChildren(h("section", { class: "panel grid gap-4" },
    h("div", {}, h("h2", { class: "!mb-1" }, title), h("p", { class: "mute text-sm" }, sub)), box)); fill(box); };
  function drawBody() {
    if (tab === "lessons") drawLessons();
    else if (tab === "quiz") panel(t("Quiz"), t("Questions drawn from the cheat sheet. A new mix every time."), (b) => quiz(b, c, { onReview: () => show("cards") }));
    else if (tab === "cards") panel(t("Flashcards"), t("Flip each card, then say whether you knew it. Known cards are set aside."), (b) => flashcards(b, c));
    else if (tab === "practice") panel(t("Practice"), t("Try each exercise yourself before revealing the answer."), (b) => exercises(b, c, codeBlock, playLink));
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
        h("summary", { class: "cursor-pointer", style: "color:var(--accent-ink)" }, t("Why this course?")),
        c.why ? h("p", { class: "mt-2" }, h("b", {}, t("Why recruiters care: ")), ai ? h("span", { ...aiDir(), class: "block" }, c.why) : c.why) : null,
        c.outcome ? h("p", { class: "mt-1" }, h("b", {}, t("After this course you can: ")), ai ? h("span", { ...aiDir(), class: "block" }, c.outcome) : c.outcome) : null) : null,
      progress),
    tabBar, body,
    // "Report a problem", preset to where the user is (the lesson open, or the tab's kind of content).
    reportBox(id, () => ({ part: { lessons: "lesson", quiz: "quiz", cards: "flashcard", practice: "exercise", interview: "interview" }[tab] || "cheatsheet",
      number: tab === "lessons" ? cur + 1 : null })));
  drawTabs(); drawBody();
}
