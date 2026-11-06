// "Close the gaps" panel, shown under the missing skills after a CV check (#/cv, cvpage.js) and in the Tailor my CV
// dialog (tailor.js): the HelloKhedma trainings that teach the skills an offer asks for and the CV lacks.
// 1. HelloKhedma courses (content/courses, courseForSkill): one row per course with the missing skills it covers,
//    the time left and the progress in this browser (Start / Continue / Completed);
// 2. unfinished steps of the path's learning tracks (Supabase training_steps in state.tracks) whose title or
//    description names a missing skill: provider, hours, free or paid, external link;
// 3. portfolio projects of the path (content/projects) that use a missing skill, to prove it on the CV (async).
// Skills with nothing to learn here are listed too. Everything runs in the browser; nothing is sent anywhere.
import { h, safeUrl } from "./lib.js";
import { t } from "./i18n.js";
import { state, path } from "./state.js";
import { extractSkills } from "./ats.js";
import { courseForSkill, courseMeta } from "./courses.js";
import { formatMinutes } from "./coursetime.js";
import { loadProjects } from "./projects.js";
import { stepsOf } from "./training.js";

const MAX_COURSES = 5, MAX_STEPS = 3, MAX_PROJECTS = 2;

// missing: skill names (as in ats.js). onOpen: called when a link is followed (the Tailor dialog closes itself).
export function gapTrainings(missing, { onOpen = () => {} } = {}) {
  const gaps = [...new Set(missing)];
  if (!gaps.length) return null;
  const gapSet = new Set(gaps);

  // 1. Courses, the ones covering the most gaps first, then the shortest.
  const byCourse = new Map();
  for (const skill of gaps) {
    const id = courseForSkill(skill);
    if (id) byCourse.set(id, [...(byCourse.get(id) || []), skill]);
  }
  const courses = [...byCourse].map(([id, skills]) => ({ c: courseMeta(id), skills })).filter((x) => x.c && x.c.done < 1)
    .sort((a, b) => b.skills.length - a.skills.length || a.c.minutes - b.c.minutes);
  const covered = new Set([...byCourse.values()].flat());

  // 2. Roadmap steps of the selected path that name a missing skill (not done yet), most gaps first.
  const steps = [];
  for (const tr of state.tracks || []) for (const s of stepsOf(tr)) {
    if (state.done?.has(s.id)) continue;
    const hits = extractSkills(`${s.title} ${s.description || ""}`).map((x) => x.name).filter((n) => gapSet.has(n));
    if (hits.length) steps.push({ s, hits });
  }
  steps.sort((a, b) => b.hits.length - a.hits.length);
  for (const { hits } of steps.slice(0, MAX_STEPS)) hits.forEach((n) => covered.add(n));
  const uncovered = gaps.filter((n) => !covered.has(n));

  const shownCourses = courses.slice(0, MAX_COURSES), shownSteps = steps.slice(0, MAX_STEPS);
  const minutes = shownCourses.reduce((m, { c }) => m + c.minutes * (1 - c.done), 0)
    + shownSteps.reduce((m, { s }) => m + (Number(s.est_hours) || 1) * 60, 0);
  const coveredCount = gaps.length - uncovered.length;

  const chips = (skills) => h("span", { class: "flex flex-wrap gap-1" }, skills.map((n) => h("span", { class: "chip !py-0 text-xs" }, n)));
  const row = (href, external, ...kids) => h("a", { href, class: "flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg p-2 text-sm hover:opacity-90",
    style: "background:var(--bg);border:1px solid var(--line)", onClick: onOpen,
    ...(external ? { target: "_blank", rel: "noopener noreferrer" } : {}) }, ...kids);
  const status = (c) => {
    const d = Math.round(c.done * c.lessonCount);
    return h("span", { class: "ml-auto text-xs font-medium", style: "color:var(--accent)" },
      d ? t("Continue · {d}/{n} lessons", { d, n: c.lessonCount }) : t("Start →"));
  };

  const projectsBox = h("div", { class: "grid gap-1.5" });
  const box = h("div", { class: "rounded-xl p-3 grid gap-2 mt-3", style: "border:1px solid var(--accent);background:var(--soft)" },
    h("p", { class: "font-medium" }, t("📘 Close the gaps with HelloKhedma"),
      coveredCount ? h("span", { class: "mute text-sm font-normal" },
        t(" · {covered} of {all} missing skills, ≈ {time}", { covered: coveredCount, all: gaps.length, time: formatMinutes(Math.round(minutes)) })) : null),
    shownCourses.length ? h("div", { class: "grid gap-1.5" },
      h("p", { class: "mute text-xs" }, t("Courses (lessons, quiz, flashcards, practice)")),
      ...shownCourses.map(({ c, skills }) => row(`#/course/${c.id}`, false,
        h("b", {}, c.name), chips(skills),
        h("span", { class: "mute text-xs" }, `${t(c.level)} · ≈ ${formatMinutes(Math.round(c.minutes * (1 - c.done)))}`), status(c)))) : null,
    shownSteps.length ? h("div", { class: "grid gap-1.5" },
      h("p", { class: "mute text-xs" }, t("From your {path} roadmap", { path: path()?.name || "" })),
      ...shownSteps.map(({ s, hits }) => {
        const url = safeUrl(s.url);
        return row(url || "#/training", Boolean(url),
          h("b", {}, s.title), chips(hits),
          h("span", { class: "mute text-xs" }, [s.provider, `${Number(s.est_hours) || 1} h`, s.is_free ? t("Free") : t("Paid")].filter(Boolean).join(" · ")),
          h("span", { class: "ml-auto text-xs font-medium", style: "color:var(--accent)" }, url ? "↗" : "→"));
      })) : null,
    projectsBox,
    uncovered.length ? h("p", { class: "mute text-xs" }, t("No HelloKhedma training yet for: {list}. Learn them from the job's documentation or a course you trust.", { list: uncovered.join(", ") })) : null,
    h("a", { href: "#/training", class: "text-sm underline justify-self-start", style: "color:var(--accent)", onClick: onOpen }, t("See your study plan on Training →")));

  // 3. Portfolio projects of the path that use a missing skill (loaded on demand).
  loadProjects(state.pathId).then((projects) => {
    const fit = projects.map((p) => ({ p, hits: p.skills.filter((n) => gapSet.has(n)) })).filter((x) => x.hits.length)
      .sort((a, b) => b.hits.length - a.hits.length).slice(0, MAX_PROJECTS);
    if (!fit.length) return;
    projectsBox.replaceChildren(h("p", { class: "mute text-xs" }, t("Prove it with a portfolio project")),
      ...fit.map(({ p, hits }) => row(`#/project/${p.id}`, false, h("b", {}, p.title), chips(hits),
        h("span", { class: "mute text-xs" }, `${t(p.level)} · ≈ ${p.hours} h`), h("span", { class: "ml-auto text-xs font-medium", style: "color:var(--accent)" }, "→"))));
  }).catch(() => {});
  return box;
}
