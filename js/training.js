// Training page (#/training): learning tracks and steps (Supabase training_tracks / training_steps), step progress
// (guests: "hk.progress.v2"; signed in: step_progress, guest progress imported on sign-in by app.js), the weekly
// study plan ("hk.hours" h/week), tools, tips and the course list (courses.js).
import { $, h, safeUrl, ls } from "./lib.js";
import { t, tn, LOCALE, localize } from "./i18n.js";
import { sb } from "./supabase.js";
import { state, byKind, fail } from "./state.js";
import { extractSkills } from "./ats.js";
import { renderCourseList, courseForSkill, courseMeta } from "./courses.js";
import { renderHome } from "./home.js";

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
  const url = safeUrl(s.url);
  const box = h("input", { type: "checkbox", class: "mt-1", checked: state.done.has(s.id), "aria-label": t("Mark \"{title}\" as done", { title: s.title }),
    onChange: (e) => toggleStep(s.id, e.target.checked) });
  const badge = (txt, accent) => h("span", { class: "chip !py-0 text-xs", style: accent ? "border-color:var(--accent)" : "" }, txt);
  return h("li", { class: "flex gap-3" }, box, h("div", { class: "min-w-0" },
    url ? h("a", { href: url, target: "_blank", rel: "noopener noreferrer", class: "font-medium underline", style: "color:var(--accent)" }, s.title) : h("b", {}, s.title),
    h("p", { class: "mute text-sm" }, s.description),
    h("div", { class: "flex flex-wrap gap-1.5 mt-1" },
      badge(KIND[s.kind] ? t(KIND[s.kind]) : s.kind, true), s.provider ? badge(t(s.provider)) : null, // "Your repo", "Your notes"… are translated; real providers stay
      badge(`${Number(s.est_hours)} h`), badge(s.is_free ? t("Free") : t("Paid")))));
}

function trackCard(tr) {
  const steps = stepsOf(tr), n = steps.filter((s) => state.done.has(s.id)).length;
  const pct = steps.length ? Math.round((n / steps.length) * 100) : 0;
  const hours = steps.reduce((a, s) => a + Number(s.est_hours), 0);
  return h("details", { class: "rounded-lg", style: "background:var(--bg);border:1px solid var(--line)", open: state.open.has(tr.id),
    onToggle: (e) => { e.target.open ? state.open.add(tr.id) : state.open.delete(tr.id); } },
    h("summary", { class: "cursor-pointer p-3 grid gap-2" },
      h("div", { class: "flex flex-wrap items-center gap-2" },
        h("span", { class: "chip chip-ok !py-0 text-xs" }, LEVEL[tr.level] ? t(LEVEL[tr.level]) : tr.level),
        h("b", {}, tr.title),
        h("span", { class: "mute text-sm ml-auto" }, t("{done}/{all} steps · {hours} h", { done: n, all: steps.length, hours: Math.round(hours) }))),
      h("div", { class: "h-1.5 rounded-full", style: "background:var(--line)" },
        h("div", { class: "h-1.5 rounded-full", style: `width:${pct}%;background:var(--accent)` }))),
    h("div", { class: "px-3 pb-3 grid gap-3" },
      tr.summary ? h("p", { class: "text-sm mute" }, tr.summary) : null,
      tr.outcome ? h("p", { class: "text-sm" }, h("b", {}, t("You will be able to: ")), tr.outcome) : null,
      h("ul", { class: "grid gap-3" }, steps.map(stepRow))));
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
    ? [h("p", { class: "text-sm rounded-lg p-3", style: "background:var(--bg);border:1px solid var(--accent)" },
        h("span", { class: "mute" }, t("Next up: ")),
        url ? h("a", { href: url, target: "_blank", rel: "noopener noreferrer", class: "underline font-medium", style: "color:var(--accent)" }, next.title) : h("b", {}, next.title),
        h("span", { class: "mute" }, ` · ${Number(next.est_hours)} h`))]
    : all.length ? [h("p", { class: "text-sm" }, t("Every step is done. Time to apply!"))] : []));
  $("#tracks").replaceChildren(...state.tracks.map(trackCard));
  renderStudyPlan();
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
      items.push({ title: c.name, hours: Math.max(1, Math.round(c.hours * (1 - c.done))), href: `#/course/${id}`, why: t("missing in your CV: {skill}", { skill }), gap: true });
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

// Redraws the whole Training page (and Home, which shows training progress).
export function renderLearn() {
  renderTracks();
  $("#tools").replaceChildren(...byKind("tool").map((x) => h("li", {}, h("b", {}, x.title), h("small", { class: "mute block" }, x.description))));
  $("#tips").replaceChildren(...byKind("tip").map((x) => h("li", { class: "rounded-lg p-3 text-sm", style: "background:var(--bg);border:1px solid var(--line)" }, x.title)));
  renderCourseList($("#courseList"), state.pathId);
  renderHome();
}

export function initTraining() {
  $("#hoursPerWeek").value = ls.get("hk.hours") || "5";
  $("#hoursPerWeek").addEventListener("input", (e) => { ls.set("hk.hours", e.target.value); renderTracks(); });
}
