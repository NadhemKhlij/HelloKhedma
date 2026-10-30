// Training page (#/training): learning tracks and steps (Supabase training_tracks / training_steps), step progress
// (guests: "hk.progress.v2"; signed in: step_progress, guest progress imported on sign-in by app.js), the weekly
// study plan ("hk.hours" h/week), tools, tips, the course list (courses.js) and the portfolio projects (projects.js).
// Tracks are drawn as a roadmap (done / current / upcoming nodes); "My learning" shows the streak, XP and the course to
// resume (activity.js). Ticking a step adds XP.
import { $, h, safeUrl, ls } from "./lib.js";
import { activityStrip, lastCourse, logActivity, streak } from "./activity.js";
import { t, tn, LOCALE, localize } from "./i18n.js";
import { sb } from "./supabase.js";
import { state, byKind, fail } from "./state.js";
import { extractSkills } from "./ats.js";
import { renderCourseList, courseForSkill, courseMeta } from "./courses.js";
import { renderHome } from "./home.js";
import { renderProjectList } from "./projects.js";

export const PROG_KEY = "hk.progress.v2";
const LEVEL = { beginner: "Beginner", intermediate: "Intermediate", advanced: "Advanced" };
const KIND = { learn: "Learn", practice: "Practice", project: "Project", certification: "Certification" };
export const stepsOf = (tr) => tr.training_steps || [];

export async function loadTracks() {
  const { data, error } = await sb.from("training_tracks")
    .select("*, training_steps(*)").eq("path_id", state.pathId)
    .order("sort_order").order("sort_order", { referencedTable: "training_steps" });
  if (error) throw error;
  state.tracks = localize(data, ["title", "summary", "outcome"]);
  for (const tr of state.tracks) localize(tr.training_steps, ["title", "description"]);
}

export async function loadProgress() {
  state.done = new Set();
  if (!state.user) {
    try { JSON.parse(ls.get(PROG_KEY) || "[]").forEach((id) => state.done.add(id)); } catch { /* ignore */ }
    return;
  }
  const { data } = await sb.from("step_progress").select("step_id").eq("done", true);
  (data || []).forEach((r) => state.done.add(r.step_id));
}

async function toggleStep(id, done) {
  if (done && !state.done.has(id)) logActivity(10);
  done ? state.done.add(id) : state.done.delete(id);
  renderLearn();
  if (state.user) {
    const { error } = await sb.from("step_progress").upsert({ user_id: state.user.id, step_id: id, done, updated_at: new Date().toISOString() });
    if (error) fail(error);
  } else {
    ls.set(PROG_KEY, JSON.stringify([...state.done]));
  }
}

function stepRow(s) {
  const url = safeUrl(s.url), on = state.done.has(s.id);
  const box = h("button", { type: "button", class: `check ${on ? "on" : ""}`, "aria-pressed": String(on),
    "aria-label": t("Mark \"{title}\" as done", { title: s.title }), onClick: () => toggleStep(s.id, !on) }, on ? "✓" : "");
  const badge = (txt) => h("span", { class: "chip !py-0 text-xs" }, txt);
  return h("li", { class: "flex gap-3 rounded-xl p-2 -mx-2 hover:bg-[var(--soft)]" }, box, h("div", { class: "min-w-0" },
    url ? h("a", { href: url, target: "_blank", rel: "noopener noreferrer", class: `font-medium underline underline-offset-2 ${on ? "mute line-through" : ""}` }, `${s.title} ↗`)
      : h("b", { class: on ? "mute line-through" : "" }, s.title),
    h("p", { class: "mute text-sm" }, s.description),
    h("div", { class: "flex flex-wrap gap-1.5 mt-1" },
      badge(KIND[s.kind] ? t(KIND[s.kind]) : s.kind), s.provider ? badge(t(s.provider)) : null, // "Your repo", "Your notes"… are translated; real providers stay
      badge(`${Number(s.est_hours)} h`), badge(s.is_free ? t("Free") : t("Paid")))));
}

// One roadmap node: status dot on the line, the track as a collapsible card.
function trackCard(tr, status, i) {
  const steps = stepsOf(tr), n = steps.filter((s) => state.done.has(s.id)).length;
  const pct = steps.length ? Math.round((n / steps.length) * 100) : 0;
  const hours = steps.reduce((a, s) => a + Number(s.est_hours), 0);
  const dot = status === "done" ? ["✓", "background:#18a999;color:#fff"]
    : status === "current" ? [String(i + 1), "background:var(--accent);color:#fff;box-shadow:0 0 0 5px color-mix(in srgb,var(--accent) 22%,transparent)"]
    : [String(i + 1), "background:var(--panel);border:1px solid var(--line);color:var(--mute)"];
  return h("li", { class: "roadmap-item relative pl-12" },
    h("span", { class: "absolute left-0 top-3 w-9 h-9 rounded-full grid place-items-center text-sm font-semibold z-[1]", style: dot[1], "aria-hidden": "true" }, dot[0]),
    h("details", { class: "panel !p-0 !shadow-none", open: state.open.has(tr.id),
      onToggle: (e) => { e.target.open ? state.open.add(tr.id) : state.open.delete(tr.id); } },
      h("summary", { class: "cursor-pointer p-4 grid gap-2 list-none" },
        h("div", { class: "flex flex-wrap items-center gap-2" },
          h("b", { class: "text-base" }, tr.title),
          h("span", { class: "chip !py-0 text-xs" }, LEVEL[tr.level] ? t(LEVEL[tr.level]) : tr.level),
          status === "current" ? h("span", { class: "badge" }, t("You are here")) : null,
          h("span", { class: "mute text-sm ml-auto" }, t("{done}/{all} steps · {hours} h", { done: n, all: steps.length, hours: Math.round(hours) }))),
        h("div", { class: "h-1.5 rounded-full", style: "background:var(--line)" },
          h("div", { class: "h-1.5 rounded-full", style: `width:${pct}%;background:${pct === 100 ? "#18a999" : "var(--accent)"};transition:width .4s ease` }))),
      h("div", { class: "px-4 pb-4 grid gap-3" },
        tr.summary ? h("p", { class: "text-sm mute" }, tr.summary) : null,
        tr.outcome ? h("p", { class: "text-sm rounded-xl p-3", style: "background:var(--soft)" }, h("b", {}, t("You will be able to: ")), tr.outcome) : null,
        h("ul", { class: "grid gap-1" }, steps.map(stepRow)))));
}

function renderTracks() {
  const all = state.tracks.flatMap(stepsOf);
  if (!state.openInit && state.tracks.length) {
    const first = state.tracks.find((tr) => stepsOf(tr).some((s) => !state.done.has(s.id))) || state.tracks[0];
    state.open = new Set([first.id]);
    state.openInit = true;
  }
  const left = all.filter((s) => !state.done.has(s.id));
  const hoursLeft = left.reduce((a, s) => a + Number(s.est_hours), 0);
  const perWeek = Math.max(1, Number($("#hoursPerWeek").value) || 5);
  $("#progress").textContent = all.length
    ? t("{done}/{all} steps done · about {left} h left · roughly {weeks} weeks at {perWeek} h/week", {
        done: all.length - left.length, all: all.length, left: Math.round(hoursLeft), weeks: Math.ceil(hoursLeft / perWeek), perWeek })
    : t("No tracks for this path yet.");
  const next = left[0], url = next && safeUrl(next.url);
  $("#nextUp").replaceChildren(...(next
    ? [h("div", { class: "flex flex-wrap items-center gap-3 rounded-xl p-3", style: "background:color-mix(in srgb,var(--accent) 10%,var(--panel));border:1px solid color-mix(in srgb,var(--accent) 35%,transparent)" },
        h("span", { class: "text-sm" }, h("span", { class: "mute" }, t("Next up: ")), h("b", {}, next.title), h("span", { class: "mute" }, ` · ${Number(next.est_hours)} h`)),
        h("span", { class: "flex gap-2 ml-auto" },
          url ? h("a", { href: url, target: "_blank", rel: "noopener noreferrer", class: "btn !py-1.5" }, t("Open ↗")) : null,
          h("button", { type: "button", class: "btn-ghost !py-1.5", onClick: () => toggleStep(next.id, true) }, t("✓ Done"))))]
    : all.length ? [h("p", { class: "text-sm" }, t("Every step is done. Time to apply!"))] : []));
  const current = state.tracks.find((tr) => stepsOf(tr).some((s) => !state.done.has(s.id)));
  $("#tracks").replaceChildren(h("ol", { class: "roadmap grid gap-3" }, state.tracks.map((tr, i) => trackCard(tr,
    stepsOf(tr).length && stepsOf(tr).every((s) => state.done.has(s.id)) ? "done" : tr === current ? "current" : "todo", i))));
  renderHub();
  renderStudyPlan();
}

// "My learning": streak, XP, this week's study days and the course to resume.
function renderHub() {
  const last = lastCourse(), c = last && courseMeta(last.id);
  $("#learnHub").replaceChildren(h("div", { class: "flex flex-wrap items-center justify-between gap-5" },
    activityStrip(),
    c ? h("a", { href: `#/course/${c.id}`, class: "panel !shadow-none flex items-center gap-3 !py-3 !px-4 min-w-[240px]" },
      h("span", { class: "text-2xl", "aria-hidden": "true" }, "📘"),
      h("span", { class: "min-w-0" }, h("span", { class: "eyebrow" }, t("Resume")),
        h("b", { class: "block truncate" }, c.name),
        h("span", { class: "mute text-xs" }, t("Lesson {n} · {p}% done", { n: (last.lesson || 0) + 1, p: Math.round(c.done * 100) }))),
      h("span", { class: "ml-auto", style: "color:var(--accent)" }, "→"))
      : h("p", { class: "mute text-sm max-w-xs" }, streak() ? t("Keep the streak going: one lesson or ten flashcards is enough today.")
        : t("Study a little every day: lessons, quizzes and flashcards all count toward your streak."))));
}

// Weekly study plan: courses for skills the CV lacks (path keywords) first, then unfinished track steps,
// packed into weeks of `h/week` hours. Items longer than the time left in a week continue the next week.
export function renderStudyPlan() {
  const perWeek = Math.max(1, Number($("#hoursPerWeek").value) || 5);
  const items = [];
  if (state.cv.skills.length) {
    const required = extractSkills(byKind("keyword").map((k) => k.title).join(" ; ")).map((s) => s.name);
    const seen = new Set();
    for (const skill of required.filter((s) => !state.cv.names.has(s))) {
      const id = courseForSkill(skill), c = id && courseMeta(id);
      if (!c || seen.has(id) || c.done >= 1) continue;
      seen.add(id);
      items.push({ title: c.name, hours: Math.max(0.5, Math.round((c.minutes / 60) * (1 - c.done) * 2) / 2), href: `#/course/${id}`, why: t("missing in your CV: {skill}", { skill }), gap: true });
    }
  }
  for (const tr of state.tracks) for (const s of stepsOf(tr)) {
    if (!state.done.has(s.id)) items.push({ title: s.title, hours: Number(s.est_hours) || 1, href: safeUrl(s.url), why: tr.title });
  }
  const weeks = [];
  let week = [], room = perWeek;
  for (const it of items) {
    let left = it.hours, part = 0;
    while (left > 0) {
      const take = Math.min(left, room);
      week.push({ ...it, hours: take, part: left > take || part ? ++part : 0 });
      left -= take; room -= take;
      if (room <= 0) { weeks.push(week); week = []; room = perWeek; }
    }
  }
  if (week.length) weeks.push(week);

  const monday = new Date(); monday.setHours(0, 0, 0, 0);
  monday.setDate(monday.getDate() + ((8 - monday.getDay()) % 7 || 7)); // next Monday
  const label = (i) => new Date(monday.getTime() + i * 7 * 86_400_000).toLocaleDateString(LOCALE, { day: "numeric", month: "short" });
  const SHOW = 4;
  $("#studyPlan").replaceChildren(...(weeks.length ? [h("details", { class: "rounded-lg mb-3", style: "background:var(--bg);border:1px solid var(--line)", open: true },
    h("summary", { class: "cursor-pointer p-3 font-bold" },
      `📅 ${tn(weeks.length, "Your study plan: {n} week at {perWeek} h/week", "Your study plan: {n} weeks at {perWeek} h/week", { perWeek })}`,
      h("span", { class: "mute font-normal text-sm" }, state.cv.skills.length ? t(" · CV gaps first") : t(" · add your CV to put your skill gaps first"))),
    h("div", { class: "px-3 pb-3 grid gap-3 md:grid-cols-2" }, weeks.slice(0, SHOW).map((w, i) => h("div", {},
      h("p", { class: "text-sm font-medium mb-1" }, t("Week {n} · from {date}", { n: i + 1, date: label(i) })),
      h("ul", { class: "grid gap-1 text-sm" }, w.map((x) => h("li", { class: "flex gap-2" },
        h("span", { class: "mute shrink-0 w-10 text-right" }, `${Math.round(x.hours * 10) / 10} h`),
        h("span", { class: "min-w-0" },
          x.href ? h("a", { href: x.href, class: "underline", style: x.gap ? "color:var(--accent)" : "", ...(x.href.startsWith("#") ? {} : { target: "_blank", rel: "noopener noreferrer" }) },
            `${x.gap ? "📘 " : ""}${x.title}`) : h("span", {}, x.title),
          x.part ? h("span", { class: "mute" }, t(" (part {n})", { n: x.part })) : null,
          h("span", { class: "mute text-xs block" }, x.why)))))))),
    weeks.length > SHOW ? h("p", { class: "px-3 pb-3 mute text-sm" }, tn(weeks.length - SHOW,
      "…then {n} more week. Tick steps and lessons as you go: the plan updates.",
      "…then {n} more weeks. Tick steps and lessons as you go: the plan updates.")) : null)] : []));
}

// Coming back to Training: lessons, quiz scores and XP may have changed on a course page.
export function refreshLearning() {
  renderHub();
  renderCourseList($("#courseList"), state.pathId);
  renderProjectList($("#projectList"), state.pathId);
  renderStudyPlan();
}

// Redraws the whole Training page (and Home, which shows training progress).
export function renderLearn() {
  renderTracks();
  $("#tools").replaceChildren(...byKind("tool").map((x) => h("li", {}, h("b", {}, x.title), h("small", { class: "mute block" }, x.description))));
  $("#tips").replaceChildren(...byKind("tip").map((x) => h("li", { class: "rounded-lg p-3 text-sm", style: "background:var(--bg);border:1px solid var(--line)" }, x.title)));
  renderCourseList($("#courseList"), state.pathId);
  renderProjectList($("#projectList"), state.pathId);
  renderHome();
}

export function initTraining() {
  document.addEventListener("hk:activity", () => { if (!$("#learnHub").closest("[hidden]")) renderHub(); });
  $("#hoursPerWeek").value = ls.get("hk.hours") || "5";
  $("#hoursPerWeek").addEventListener("input", (e) => { ls.set("hk.hours", e.target.value); renderTracks(); });
}
