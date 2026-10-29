// App entry point: state, hash router, and the rendering of Home, Offers, Training, CV check and Account.
// - Router: #/<route>[/<param>] → shows <section data-page="route"> (ROUTES, NAV_OF). Anything else shows Home,
//   untouched, so supabase-js can read "#access_token=..." after a magic link.
// - Data: path content from Supabase (career_paths, path_resources, training_tracks/steps); applications through
//   state.store (LocalStore for guests, CloudStore when signed in, see store.js); onUser() imports guest data on sign-in.
// - Offers has three tabs feeding one results list (state.jobs): Job search (jobs.js → job-search function),
//   Companies I follow (companies.js), Remote jobs (remote.js). Each tab keeps state.<mode>Jobs / <mode>Msg.
//   Source credits required by providers' terms: CREDITS. Offer tags, hide/seen and saved searches: this browser.
// - CV: text kept only in localStorage ("hk.cv.text", never sent to Supabase); skills via ats.js.
// - Also here: theme toggle ("hk.theme"), weekly study plan, account export/delete (delete-account function),
//   error toasts + optional Sentry (CONFIG.SENTRY_DSN), PWA registration (sw.js) and the "Install the app" link.
// - Every user-facing text goes through t() / tn() (i18n.js, imported first so the static page is translated
//   before anything renders); the FR / EN button reloads the page in the other language.
import { t, tn, lang, LOCALE, setLang } from "./i18n.js";
import { $, h, safeUrl, safeColor, ls, toast, download } from "./lib.js";
import { sb, configured, CONFIG } from "./supabase.js";
import { LocalStore, CloudStore, importLocalToCloud, STAGES } from "./store.js";
import { searchJobs, boardLinks } from "./jobs.js";
import { renderBoard, renderStats, openDetails, nextActions, toCsv, parseCsv } from "./tracker.js";
import { extractSkills, matchSkills, addKeywords, readCvFile, norm } from "./ats.js";
import { initAuth } from "./auth.js";
import { loadCourseIndex, renderCourseList, renderCourse, courseForSkill, courseMeta } from "./courses.js";
import { renderInterview } from "./interview.js";
import { searchRemote } from "./remote.js";
import {
  loadWatchlist, saveWatchlist, entryKey, PROVIDER_NAMES, SUGGESTED, titleMatcher, findCompany, fetchCompanyJobs, clearCompanyCache,
} from "./companies.js";

const PATH_KEY = "hk.path", LOC_KEY = "hk.location", PROG_KEY = "hk.progress.v2";
const CV_KEY = "hk.cv.text"; // the CV text stays in this browser only, even for signed-in users
const COUNTRIES = ["fr", "gb", "us", "de", "nl", "ca", "au", "be", "ch", "es", "it"];

const state = {
  paths: [], pathId: null, resources: [], tracks: [], open: new Set(), openInit: false, done: new Set(),
  user: null, store: new LocalStore(), cards: [],
  cv: { text: "", skills: [], names: new Set() }, jobs: [], skillFilter: null,
};

// Offer preferences kept in this browser: hidden ("not interested") and seen offers, saved searches, weekly goal.
const HIDDEN_KEY = "hk.offers.hidden", SEEN_KEY = "hk.offers.seen", SAVED_KEY = "hk.savedSearches", GOAL_KEY = "hk.weeklyGoal";
const loadList = (k) => { try { return JSON.parse(ls.get(k) || "[]"); } catch { return []; } };
const saveSet = (k, s) => ls.set(k, JSON.stringify([...s].slice(-500)));
state.hidden = new Set(loadList(HIDDEN_KEY));
state.seen = new Set(loadList(SEEN_KEY));
const weeklyGoal = () => Number(ls.get(GOAL_KEY)) || 5;

const path = () => state.paths.find((p) => p.id === state.pathId);
const byKind = (k) => state.resources.filter((r) => r.kind === k);
const fail = (e) => toast(e?.message || t("Something went wrong."));

/* ---------- theme (the inline script in index.html applies it before first paint) ---------- */
const THEME_KEY = "hk.theme";
function renderThemeToggle() {
  const light = document.documentElement.dataset.theme === "light";
  const btn = $("#themeToggle");
  btn.textContent = light ? "☾" : "☀";
  btn.title = light ? t("Switch to dark theme") : t("Switch to light theme");
  btn.setAttribute("aria-label", btn.title);
}
// Shows the other language; the page reloads in it.
function renderLangToggle() {
  const btn = $("#langToggle");
  btn.textContent = lang === "fr" ? "EN" : "FR";
  btn.title = lang === "fr" ? "Switch to English" : "Passer en français";
  btn.setAttribute("aria-label", btn.title);
  btn.setAttribute("lang", lang === "fr" ? "en" : "fr");
  btn.addEventListener("click", () => setLang(lang === "fr" ? "en" : "fr"));
}
function toggleTheme() {
  const next = document.documentElement.dataset.theme === "light" ? "dark" : "light";
  document.documentElement.dataset.theme = next;
  ls.set(THEME_KEY, next);
  renderThemeToggle();
}

/* ---------- pages (hash routes: #/, #/offers, #/training, #/cv, #/applications, #/course/<id>) ---------- */
const ROUTES = {
  home: "Home", offers: "Offers", training: "Training", cv: "CV check", applications: "My applications", course: "Course",
  account: "Your account & data", legal: "Legal notice", privacy: "Privacy policy", interview: "Interview prep",
};
const NAV_OF = { course: "training" }; // which nav tab is highlighted for sub-pages
const coursesReady = loadCourseIndex();
// Anything that is not "#/<route>" (e.g. Supabase's "#access_token=..." after a magic link) shows Home
// and is left untouched so supabase-js can read it.
const routeOf = () => {
  const [, r = "home", param = null] = location.hash.match(/^#\/([a-z]*)(?:\/([a-z0-9-]+))?/) || [];
  return r in ROUTES ? { r: r || "home", param } : { r: "home", param: null };
};
function showRoute(moveFocus) {
  const { r, param } = routeOf();
  const nav = NAV_OF[r] || r;
  document.querySelectorAll("[data-page]").forEach((s) => { s.hidden = s.dataset.page !== r; });
  document.querySelectorAll("[data-route]").forEach((a) => {
    if (a.dataset.route === nav) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
  });
  document.title = r === "home" ? "HelloKhedma" : `${t(ROUTES[r])} · HelloKhedma`;
  if (moveFocus) window.scrollTo(0, 0);
  if (r === "course") {
    coursesReady.then(() => renderCourse(param)).then(() => { if (moveFocus) $("#h-course")?.focus({ preventScroll: true }); });
  } else if (moveFocus) $(`#h-${r}`)?.focus({ preventScroll: true });
  if (r === "interview") refreshInterview();
  if (r === "training" && path()) renderStudyPlan(); // lesson progress may have changed on a course page
}
// The interview page depends on the path (role questions, courses) and the tracker (upcoming interviews).
function refreshInterview() {
  if (routeOf().r === "interview" && path()) renderInterview({ path: path(), cards: state.cards });
}

/* ---------- data loading (all content comes from Supabase) ---------- */
async function loadPaths() {
  const { data, error } = await sb.from("career_paths").select("*").order("sort_order");
  if (error) throw error;
  state.paths = data;
}
async function loadResources() {
  const { data, error } = await sb.from("path_resources").select("*").eq("path_id", state.pathId).order("sort_order");
  if (error) throw error;
  state.resources = data;
  addKeywords(byKind("keyword").map((k) => k.title)); // make every path keyword detectable in CVs and offers
}
async function loadTracks() {
  const { data, error } = await sb.from("training_tracks")
    .select("*, training_steps(*)").eq("path_id", state.pathId)
    .order("sort_order").order("sort_order", { referencedTable: "training_steps" });
  if (error) throw error;
  state.tracks = data;
}
async function loadProgress() {
  state.done = new Set();
  if (!state.user) {
    try { JSON.parse(ls.get(PROG_KEY) || "[]").forEach((id) => state.done.add(id)); } catch { /* ignore */ }
    return;
  }
  const { data } = await sb.from("step_progress").select("step_id").eq("done", true);
  (data || []).forEach((r) => state.done.add(r.step_id));
}
async function refreshTracker() {
  try { state.cards = await state.store.list(); } catch (e) { fail(e); state.cards = []; }
  const detailsOk = await state.store.detailsSupported();
  $("#detailsNotice").hidden = detailsOk;
  // Run a store action, then redraw everything that depends on the cards.
  const act = (fn) => async (...args) => { try { await fn(...args); await refreshTracker(); } catch (e) { fail(e); } };
  renderBoard($("#board"), state.cards, {
    colorOf: (id) => state.paths.find((p) => p.id === id)?.color,
    onMove: act((id, stage) => state.store.move(id, stage)),
    onOpen: (c) => openDetails(c, {
      detailsOk,
      onSave: act((patch) => state.store.update(c.id, patch)),
      onRemove: act(() => state.store.remove(c.id)),
    }),
  });
  const drawStats = () => renderStats($("#appStats"), state.cards, weeklyGoal(), (g) => { ls.set(GOAL_KEY, String(g)); drawStats(); });
  drawStats();
  renderHome();
  if (state.jobs.length) renderOffers(); // refresh the "Tracked" markers
  refreshInterview();
}

function onCsvExport() {
  if (!state.cards.length) { toast(t("No applications to export yet.")); return; }
  // The BOM makes Excel open accents correctly.
  download(`hellokhedma-applications-${new Date().toISOString().slice(0, 10)}.csv`, `﻿${toCsv(state.cards)}`, "text/csv");
}

async function onCsvImport(e) {
  const file = e.target.files?.[0];
  e.target.value = "";
  if (!file) return;
  const isoOrUndef = (v) => { const d = new Date(v); return v && !Number.isNaN(d.getTime()) ? d.toISOString() : undefined; };
  try {
    const rows = parseCsv(await file.text()).filter((r) => r.title);
    if (!rows.length) { toast(t("No rows found. The file needs a 'title' column (see Export CSV for the format).")); return; }
    for (const r of rows) {
      await state.store.add({
        ...r, path_id: state.pathId,
        stage: STAGES.some((s) => s.id === r.stage) ? r.stage : "saved",
        url: safeUrl(r.url) || undefined,
        follow_up_on: /^\d{4}-\d{2}-\d{2}$/.test(r.follow_up_on || "") ? r.follow_up_on : undefined,
        interview_at: isoOrUndef(r.interview_at),
      });
    }
    toast(tn(rows.length, "Imported {n} application.", "Imported {n} applications."));
    await refreshTracker();
  } catch (err) { fail(err); }
}

/* ---------- rendering ---------- */
function renderPaths() {
  $("#paths").replaceChildren(...state.paths.map((p) => {
    const on = p.id === state.pathId, c = safeColor(p.color);
    return h("button", {
      type: "button", class: "panel text-left", "aria-pressed": String(on),
      style: on ? `border-color:${c};box-shadow:inset 0 0 0 1px ${c}` : "",
      onClick: () => selectPath(p.id),
    }, h("b", { class: "block text-lg" }, p.name), h("span", { class: "mute text-sm" }, p.blurb));
  }));
  $("#pathSelect").replaceChildren(...state.paths.map((p) => h("option", { value: p.id, selected: p.id === state.pathId }, p.name)));
}

function renderHome() {
  const all = state.tracks.flatMap(stepsOf), done = all.filter((s) => state.done.has(s.id)).length;
  const next = all.find((s) => !state.done.has(s.id));
  const count = (stage) => state.cards.filter((c) => c.stage === stage).length;
  const card = (title, big, detail, href, cta) => h("a", { href, class: "panel block hover:opacity-90" },
    h("span", { class: "mute text-sm" }, title),
    h("b", { class: "block text-2xl my-1" }, big),
    h("p", { class: "mute text-sm mb-2" }, detail),
    h("span", { class: "text-sm font-medium", style: "color:var(--accent)" }, `${t(cta)} →`));
  // Follow-ups due and interviews this week, at the top of Home.
  const actions = nextActions(state.cards).slice(0, 6);
  const ICON = { overdue: ["⏰", "#e0508b"], today: ["⏰", "#f08a24"], soon: ["⏰", "var(--accent)"], interview: ["📅", "var(--accent)"] };
  $("#homeActions").replaceChildren(...(actions.length ? [h("div", { class: "panel" },
    h("h2", { class: "!mb-2" }, t("Next actions")),
    h("ul", { class: "grid gap-2 text-sm" }, actions.map(({ c, kind, text }) => h("li", { class: "flex flex-wrap items-baseline gap-2" },
      h("span", { style: `color:${ICON[kind][1]}` }, `${ICON[kind][0]} ${kind === "overdue" ? t("Overdue · ") : kind === "today" ? t("Today · ") : ""}${text}`),
      h("a", { href: "#/applications", class: "mute underline" }, [c.title, c.company].filter(Boolean).join(" · ")),
      kind === "interview" ? h("a", { href: "#/interview", class: "underline text-xs", style: "color:var(--accent)" }, t("Prepare →")) : null))))] : []));
  $("#homeSummary").replaceChildren(
    card(t("Training"), all.length ? t("{done}/{all} steps", { done, all: all.length }) : t("No tracks yet"),
      next ? t("Next up: {title}", { title: next.title }) : all.length ? t("Every step is done. Time to apply!") : "", "#/training", "Continue learning"),
    card(t("Applications"), String(state.cards.length),
      t("{applied} applied · {interview} interview · {offer} offer", { applied: count("applied"), interview: count("interview"), offer: count("offer") }),
      "#/applications", "Open tracker"),
    card(t("Offers"), path()?.name || t("Offers"),
      t("Live {title} offers by city and country.", { title: path()?.job_titles?.[0] || t("job") }), "#/offers", "Find offers"),
  );
}

function renderSearchControls() {
  const p = path();
  $("#role").replaceChildren(...(p?.job_titles || []).map((t) => h("option", { value: t }, t)));
  renderRemoteRoles();
  if (!$("#country").children.length) {
    $("#country").replaceChildren(...COUNTRIES.map((c) => h("option", { value: c, selected: c === (CONFIG.DEFAULT_COUNTRY || "fr") }, c.toUpperCase())));
  }
  renderBoards();
}
function renderBoards() {
  $("#boards").replaceChildren(...boardLinks($("#role").value, $("#loc").value.trim()).map(([name, href]) =>
    h("a", { href, target: "_blank", rel: "noopener noreferrer", class: "btn-ghost" }, name)));
}

const LEVEL = { beginner: "Beginner", intermediate: "Intermediate", advanced: "Advanced" };
const KIND = { learn: "Learn", practice: "Practice", project: "Project", certification: "Certification" };
const stepsOf = (t) => t.training_steps || [];

function stepRow(s) {
  const url = safeUrl(s.url);
  const box = h("input", { type: "checkbox", class: "mt-1", checked: state.done.has(s.id), "aria-label": t("Mark \"{title}\" as done", { title: s.title }),
    onChange: (e) => toggleStep(s.id, e.target.checked) });
  const badge = (txt, accent) => h("span", { class: "chip !py-0 text-xs", style: accent ? "border-color:var(--accent)" : "" }, txt);
  return h("li", { class: "flex gap-3" }, box, h("div", { class: "min-w-0" },
    url ? h("a", { href: url, target: "_blank", rel: "noopener noreferrer", class: "font-medium underline", style: "color:var(--accent)" }, s.title) : h("b", {}, s.title),
    h("p", { class: "mute text-sm" }, s.description),
    h("div", { class: "flex flex-wrap gap-1.5 mt-1" },
      badge(KIND[s.kind] ? t(KIND[s.kind]) : s.kind, true), s.provider ? badge(s.provider) : null,
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
    const first = state.tracks.find((t) => stepsOf(t).some((s) => !state.done.has(s.id))) || state.tracks[0];
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
function renderStudyPlan() {
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

function renderLearn() {
  renderTracks();
  $("#tools").replaceChildren(...byKind("tool").map((t) => h("li", {}, h("b", {}, t.title), h("small", { class: "mute block" }, t.description))));
  $("#tips").replaceChildren(...byKind("tip").map((t) => h("li", { class: "rounded-lg p-3 text-sm", style: "background:var(--bg);border:1px solid var(--line)" }, t.title)));
  renderCourseList($("#courseList"), state.pathId);
  renderHome();
}

function renderStatus() {
  const u = state.user;
  $("#status").textContent = u ? t("Synced · {email}", { email: u.email }) : t("Guest mode · saved on this device");
  $("#authOpen").hidden = Boolean(u);
  $("#accountLink").hidden = !u;
  $("#signOut").hidden = !u;
  $("#accountWho").textContent = u
    ? t("Signed in as {email}. Your applications, training progress and path are synced to your account; your CV stays on this device.", { email: u.email })
    : t("You are using HelloKhedma as a guest: everything is stored in this browser only, nothing on our servers.");
  $("#deleteInfo").textContent = u
    ? t("Permanently deletes your account and everything linked to it (applications, progress, profile), then clears this browser. This cannot be undone.")
    : t("Clears every HelloKhedma data from this browser: applications, progress, CV text and settings. This cannot be undone.");
  $("#deleteData").textContent = u ? t("Delete my account") : t("Delete data on this device");
}

/* ---------- account & data (GDPR: access, portability, erasure) ---------- */
const localData = () => Object.fromEntries(
  Object.keys(localStorage).filter((k) => k.startsWith("hk.")).map((k) => [k, ls.get(k)]));
const clearLocalData = () => Object.keys(localStorage).filter((k) => k.startsWith("hk.")).forEach((k) => ls.del(k));

async function onExport() {
  const out = { exported_at: new Date().toISOString(), app: "HelloKhedma", this_device: localData() };
  if (state.user) {
    const [profile, applications, progress] = await Promise.all([
      sb.from("profiles").select("*"), sb.from("applications").select("*"), sb.from("step_progress").select("*")]);
    const err = profile.error || applications.error || progress.error;
    if (err) { fail(err); return; }
    out.account = { email: state.user.email, created_at: state.user.created_at,
      profile: profile.data, applications: applications.data, training_progress: progress.data };
  }
  const blob = new Blob([JSON.stringify(out, null, 2)], { type: "application/json" });
  const a = h("a", { href: URL.createObjectURL(blob), download: `hellokhedma-data-${new Date().toISOString().slice(0, 10)}.json` });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

async function onDelete() {
  const signedIn = Boolean(state.user);
  const ok = confirm(signedIn
    ? t("Delete your HelloKhedma account and all its data permanently?")
    : t("Delete all HelloKhedma data stored in this browser?"));
  if (!ok) return;
  const btn = $("#deleteData");
  btn.disabled = true;
  try {
    if (signedIn) {
      const { error } = await sb.functions.invoke("delete-account", { body: {} });
      if (error) {
        let msg = error.message;
        try { msg = (await error.context.json()).error || msg; } catch { /* keep message */ }
        throw new Error(t("Could not delete the account: {msg}", { msg }));
      }
      await sb.auth.signOut().catch(() => {}); // the session belongs to a deleted user
    }
    clearLocalData();
    toast(signedIn ? t("Your account and data were deleted.") : t("Data on this device was deleted."));
    setTimeout(() => { location.hash = "#/"; location.reload(); }, 1200);
  } catch (e) { fail(e); btn.disabled = false; }
}

/* ---------- errors: friendly message + optional Sentry (CONFIG.SENTRY_DSN) ---------- */
let lastErrorToast = 0;
function onUnexpectedError(err) {
  console.error(err);
  if (Date.now() - lastErrorToast > 10_000) { // at most one message every 10 s
    lastErrorToast = Date.now();
    toast(t("Something went wrong. Please try again; if it persists, reload the page."));
  }
}
function initMonitoring() {
  window.addEventListener("error", (e) => onUnexpectedError(e.error || e.message));
  window.addEventListener("unhandledrejection", (e) => onUnexpectedError(e.reason));
  if (!CONFIG.SENTRY_DSN) return;
  const s = document.createElement("script");
  s.src = "https://browser.sentry-cdn.com/8.38.0/bundle.min.js";
  s.crossOrigin = "anonymous";
  s.onload = () => window.Sentry?.init({ dsn: CONFIG.SENTRY_DSN, tracesSampleRate: 0, sendDefaultPii: false });
  document.head.append(s);
}

/* ---------- installable app (PWA): service worker + "Install the app" link ---------- */
function initPwa() {
  if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost")) {
    navigator.serviceWorker.register("sw.js").catch((e) => console.warn("Service worker not registered:", e));
  }
  // Chrome / Edge / Android offer installation through this event; Safari users use Share → Add to Home Screen.
  let deferred = null;
  window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); deferred = e; $("#installApp").hidden = false; });
  window.addEventListener("appinstalled", () => { $("#installApp").hidden = true; toast(t("HelloKhedma is installed.")); });
  $("#installApp").addEventListener("click", async () => {
    if (!deferred) return;
    deferred.prompt();
    await deferred.userChoice.catch(() => null);
    deferred = null; $("#installApp").hidden = true;
  });
}

function renderAll() {
  document.documentElement.style.setProperty("--accent", safeColor(path()?.color));
  renderPaths(); renderSearchControls(); renderLearn(); renderStatus();
}

/* ---------- actions ---------- */
async function selectPath(id) {
  state.pathId = id;
  ls.set(PATH_KEY, id);
  state.jobs = []; state.searchJobs = []; state.companyJobs = []; state.companyLoaded = false; state.skillFilter = null;
  state.searchMsg = state.companyMsg = state.remoteMsg = ""; state.remoteJobs = [];
  $("#searchMsg").textContent = ""; $("#atsOut").replaceChildren();
  try { state.openInit = false; await Promise.all([loadResources(), loadTracks()]); } catch (e) { fail(e); }
  setCv(state.cv.text); // new path keywords may now be detectable
  renderAll(); renderCvSkills(); renderOffers();
  if (state.offerMode === "companies") loadCompanyJobs(); // "only roles for my path" depends on the path
  refreshInterview();
  if (state.user) sb.from("profiles").upsert({ user_id: state.user.id, selected_path: id });
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

async function track(job, btn) {
  try {
    await state.store.add({ path_id: state.pathId, title: job.title, company: job.company, location: job.location,
      url: job.url, source: job.source, external_id: job.id, stage: "saved" });
    btn.disabled = true; btn.textContent = t("Tracked");
    toast(t("Added to Saved"));
    await refreshTracker();
  } catch (e) { toast(e.code === "DUPLICATE" ? t("Already in your tracker") : e.message); }
}

/* ---------- CV skills (the CV text is kept in this browser only) ---------- */
const fitColor = (score) => (score >= 70 ? "#18a999" : score >= 40 ? "#f08a24" : "#e0508b");
// A skill you have shows ✓; a missing skill with a HelloKhedma course links to it (📘).
const skillChip = (name, inCv) => {
  const course = inCv ? null : courseForSkill(name);
  return course
    ? h("a", { href: `#/course/${course}`, class: "chip text-xs mute hover:opacity-80", title: t("Learn {name}: HelloKhedma course", { name }) }, `📘 ${name}`)
    : h("span", { class: `chip text-xs ${inCv ? "chip-ok" : "mute"}` }, inCv ? `✓ ${name}` : name);
};

function setCv(text) {
  const skills = extractSkills(text);
  state.cv = { text, skills, names: new Set(skills.map((s) => s.name)) };
}

function saveCv(text) {
  setCv(text);
  if (text.trim()) ls.set(CV_KEY, text); else ls.del(CV_KEY);
  renderCvSkills(); renderOffers(); renderStudyPlan();
}

function renderCvSkills() {
  const { text, skills } = state.cv;
  if (!text.trim()) { $("#cvSkills").replaceChildren(h("p", { class: "mute text-sm" }, t("No CV saved yet."))); return; }
  const cats = [...new Set(skills.map((s) => s.cat))];
  $("#cvSkills").replaceChildren(...[
    h("p", { class: "font-bold" }, tn(skills.length, "{n} skill found in your CV", "{n} skills found in your CV"),
      h("span", { class: "mute text-sm font-normal" }, t(" · saved on this device and used to score offers"))),
    skills.length ? null : h("p", { class: "mute text-sm" }, t("No known skills detected. Check the text is readable, or paste it instead.")),
    ...cats.map((c) => h("div", { class: "mt-2" },
      h("p", { class: "mute text-xs mb-1" }, t(c)), // skill categories from ats.js
      h("div", { class: "flex flex-wrap gap-1.5" }, skills.filter((s) => s.cat === c)
        .map((s) => h("span", { class: "chip chip-ok text-xs" }, s.count > 1 ? `${s.name} ×${s.count}` : s.name))))),
  ].filter(Boolean));
}

async function onCvFile(e) {
  const file = e.target.files?.[0];
  if (!file) return;
  const msg = $("#cvFileMsg");
  msg.textContent = t("Reading {file}…", { file: file.name });
  try {
    const text = (await readCvFile(file)).trim();
    if (!text) throw new Error(t("no text found. If it is a scanned PDF, paste the text instead."));
    $("#cv").value = text;
    saveCv(text);
    msg.textContent = t("{file} read.", { file: file.name });
  } catch (err) { msg.textContent = t("Could not read {file}: {msg}", { file: file.name, msg: err.message }); }
  e.target.value = "";
}

function onCvSave() {
  const text = $("#cv").value;
  if (!text.trim()) { toast(t("Upload or paste your CV first.")); return; }
  saveCv(text);
}

function onCvClear() {
  $("#cv").value = ""; $("#atsOut").replaceChildren(); $("#cvFileMsg").textContent = "";
  saveCv("");
  toast(t("Your CV was removed from this device."));
}

function onAts() {
  if (!state.cv.text.trim()) { toast(t("Add your CV first (upload or paste it above).")); return; }
  const jd = $("#jd").value, usedJd = Boolean(jd.trim());
  // Path keywords go through the extractor too, so aliases map to the same names as in the CV.
  const required = extractSkills(usedJd ? jd : byKind("keyword").map((k) => k.title).join(" ; ")).map((s) => s.name);
  const r = matchSkills(required, state.cv.names);
  if (!r.total) { $("#atsOut").replaceChildren(h("p", { class: "mute text-sm" }, t("No known skills found in this job description."))); return; }
  const chips = (list, inCv) => list.map((n) => skillChip(n, inCv));
  const vars = { matched: r.matched.length, total: r.total };
  $("#atsOut").replaceChildren(
    h("p", { class: "text-lg font-bold", style: `color:${fitColor(r.score)}` }, t("{score}% match", { score: r.score }),
      h("span", { class: "mute text-sm font-normal" }, usedJd
        ? t(" · {matched} of {total} skills from the offer are in your CV", vars)
        : t(" · {matched} of {total} path keywords are in your CV", vars))),
    h("p", { class: "mute text-sm mt-3 mb-1" }, t("In your CV")),
    h("div", { class: "flex flex-wrap gap-2" }, r.matched.length ? chips(r.matched, true) : h("span", { class: "mute text-sm" }, t("None yet."))),
    h("p", { class: "mute text-sm mt-3 mb-1" }, t("Missing: add the ones you genuinely have · 📘 = open the HelloKhedma course")),
    h("div", { class: "flex flex-wrap gap-2" }, r.missing.length ? chips(r.missing, false) : h("span", { class: "mute text-sm" }, t("Nothing missing."))),
  );
}

/* ---------- offers: skills per offer + CV fit ---------- */
// `text` is the fuller description from the job-search function; older cached results only have `snippet`.
const jobText = (j) => `${j.title} ${j.text || j.snippet || ""}`;
// Below this many detected skills a percentage says more about the short summary than about the fit.
const MIN_SKILLS_FOR_FIT = 2;

const offerKey = (j) => `${j.source}:${j.id}`;

// Contract type and remote policy, detected from the offer text (EN + FR wording). null when not stated.
function offerTags(j) {
  const t = norm(`${j.title} ${j.text || j.snippet || ""}`), title = norm(j.title);
  const contract =
    /alternance|apprenti|apprentissage|work[- ]study/.test(t) ? "Apprenticeship"
    : /\bstage\b|stagiaire|internship|\bintern\b/.test(title) || /stagiaire|internship/.test(t) ? "Internship"
    : /\bcdi\b|permanent contract|contrat a duree indeterminee/.test(t) ? "CDI"
    : /\bcdd\b|fixed[- ]term|contrat a duree determinee/.test(t) ? "CDD"
    : /freelance|independant|contractor|portage salarial|\btjm\b/.test(t) ? "Freelance" : null;
  const remote =
    /full remote|fully remote|100 ?% remote|100 ?% teletravail|teletravail complet|remote first/.test(t) ? "Remote"
    : /hybride|hybrid|teletravail|remote|a distance/.test(t) ? "Hybrid" : null;
  return { contract, remote };
}

function toggleHidden(key) {
  state.hidden.has(key) ? state.hidden.delete(key) : state.hidden.add(key);
  saveSet(HIDDEN_KEY, state.hidden);
  renderOffers();
}
function markSeen(key) {
  if (state.seen.has(key)) return;
  state.seen.add(key);
  saveSet(SEEN_KEY, state.seen);
  setTimeout(renderOffers, 300); // after the new tab opened
}

function renderJob({ j, skills, fit, tags, key }) {
  const url = safeUrl(j.url);
  const tracked = state.cards.some((c) => c.external_id === j.id && c.source === j.source);
  const hidden = state.hidden.has(key), seen = state.seen.has(key);
  const btn = tracked
    ? h("button", { type: "button", class: "btn-ghost", disabled: true }, t("Tracked ✓"))
    : h("button", { type: "button", class: "btn-ghost", onClick: (e) => track(j, e.currentTarget) }, t("Track"));
  const hideBtn = h("button", { type: "button", class: "btn-ghost !px-2", title: hidden ? t("Show this offer again") : t("Hide this offer from future results"),
    onClick: () => toggleHidden(key) }, hidden ? t("Unhide") : t("Not interested"));
  const tag = (text) => h("span", { class: "chip !py-0 text-xs" }, text);
  const badge = fit?.score != null
    ? h("span", { class: "chip text-xs font-bold shrink-0 ml-auto whitespace-nowrap", style: `border-color:${fitColor(fit.score)};color:${fitColor(fit.score)}`,
        title: t("{matched} of {total} skills from this offer are in your CV", { matched: fit.matched.length, total: fit.total }) },
        t("{score}% fit · {matched}/{total}", { score: fit.score, matched: fit.matched.length, total: fit.total }))
    : fit ? h("span", { class: "mute text-xs shrink-0 ml-auto whitespace-nowrap", title: t("The offer summary names too few skills to score it.") }, t("Fit: n/a"))
    : null;
  return h("li", { class: "rounded-lg p-3", style: `background:var(--bg);border:1px solid var(--line);${hidden || seen ? "opacity:.7" : ""}` },
    h("div", { class: "flex items-start gap-2" },
      h("div", { class: "min-w-0" },
        h("b", { class: "block" }, j.title),
        h("span", { class: "mute text-sm block" }, [j.company, j.location].filter(Boolean).join(" · "))),
      badge),
    tags.contract || tags.remote || seen || hidden || j.isNew ? h("div", { class: "flex flex-wrap gap-1.5 mt-2" },
      j.isNew ? h("span", { class: "chip chip-ok !py-0 text-xs font-bold", style: "color:var(--accent)" }, t("New")) : null,
      tags.contract ? tag(t(tags.contract)) : null,
      tags.remote ? tag(tags.remote === "Remote" ? t("Full remote") : t("Hybrid / remote")) : null,
      seen ? h("span", { class: "mute text-xs" }, t("Seen")) : null,
      hidden ? h("span", { class: "mute text-xs" }, t("Hidden")) : null) : null,
    skills.length
      ? h("div", { class: "flex flex-wrap gap-1.5 mt-2", "aria-label": t("Skills in this offer") }, skills.slice(0, 8).map((s) => skillChip(s, state.cv.names.has(s))))
      : h("p", { class: "mute text-xs mt-2" }, t("No specific skills detected in the offer summary.")),
    h("p", { class: "text-sm mt-2 mute" }, j.snippet),
    h("div", { class: "flex flex-wrap items-center gap-2 mt-2" },
      url ? h("a", { href: url, target: "_blank", rel: "noopener noreferrer", class: "btn", onClick: () => markSeen(key) }, t("View offer")) : null,
      btn, hideBtn, h("span", { class: "mute text-xs ml-auto" },
        SOURCE_NAMES[j.source] || (PROVIDER_NAMES[j.source] ? t("Careers page") : j.source))));
}
const SOURCE_NAMES = { francetravail: "France Travail", adzuna: "Adzuna", jsearch: "JSearch", remotive: "Remotive", jobicy: "Jobicy" };

function renderOffers() {
  const hasCv = state.cv.skills.length > 0;
  if (!state.jobs.length) { $("#offerTools").hidden = true; $("#results").replaceChildren(); $("#sourceCredits").replaceChildren(); return; }
  let list = state.jobs.map((j) => {
    const skills = extractSkills(jobText(j)).map((s) => s.name);
    let fit = hasCv ? matchSkills(skills, state.cv.names) : null;
    if (fit && fit.total < MIN_SKILLS_FOR_FIT) fit = { ...fit, score: null };
    return { j, skills, fit, tags: offerTags(j), key: offerKey(j) };
  });
  const total = list.length, showHidden = $("#fHidden").checked;
  const hiddenCount = list.filter((x) => state.hidden.has(x.key)).length;
  if (!showHidden) list = list.filter((x) => !state.hidden.has(x.key));

  // Skills most requested across these offers; clicking one filters the list.
  const freq = new Map();
  list.forEach((x) => x.skills.forEach((s) => freq.set(s, (freq.get(s) || 0) + 1)));
  if (state.skillFilter && !freq.has(state.skillFilter)) state.skillFilter = null;
  $("#offerSkills").replaceChildren(...[...freq].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([name, n]) => {
    const on = state.skillFilter === name, inCv = state.cv.names.has(name);
    return h("button", { type: "button", class: `chip text-xs ${inCv ? "chip-ok" : ""}`, "aria-pressed": String(on),
      style: on ? "background:var(--accent);color:#fff" : "",
      onClick: () => { state.skillFilter = on ? null : name; renderOffers(); } }, `${inCv ? "✓ " : ""}${name} · ${n}`);
  }));

  const scored = list.filter((x) => x.fit?.score != null);
  const avg = scored.length ? Math.round(scored.reduce((a, x) => a + x.fit.score, 0) / scored.length) : null;
  $("#fitNote").replaceChildren(hasCv
    ? h("span", {}, t("Average CV fit: "), h("b", { style: avg == null ? "" : `color:${fitColor(avg)}` }, avg == null ? t("n/a") : `${avg}%`),
        h("span", { class: "mute" }, t(" · ✓ = skill found in your CV")))
    : h("span", { class: "mute" }, t("Add your CV on the "),
        h("a", { href: "#/cv", class: "underline", style: "color:var(--accent)" }, t("CV check")), t(" page to see how well you fit each offer.")));

  $("#sortBy").disabled = $("#fFit").disabled = !hasCv;
  const contract = $("#fContract").value, remote = $("#fRemote").value, minFit = hasCv ? Number($("#fFit").value) : 0;
  list = list.filter((x) =>
    (!state.skillFilter || x.skills.includes(state.skillFilter))
    && (!contract || x.tags.contract === contract)
    && (!remote || (remote === "Remote" ? x.tags.remote === "Remote" : Boolean(x.tags.remote)))
    && (!minFit || (x.fit?.score ?? -1) >= minFit));
  if (hasCv && $("#sortBy").value === "fit") list = [...list].sort((a, b) => (b.fit?.score ?? -1) - (a.fit?.score ?? -1));
  $("#fitNote").append(h("span", { class: "mute" }, t(" · Showing {shown} of {total}", { shown: list.length, total })
    + (hiddenCount ? t(" ({n} hidden)", { n: hiddenCount }) : "")));
  $("#offerTools").hidden = false;
  $("#results").replaceChildren(...(list.length ? list.map(renderJob)
    : [h("li", { class: "mute text-sm" }, t("No offer matches these filters. Loosen a filter to see more."))]));
  renderSourceCredits();
}

// Attribution required by the job providers' terms, for the sources present in the results.
const CREDITS = {
  remotive: ["Remotive", "https://remotive.com"],
  jobicy: ["Jobicy", "https://jobicy.com"],
  adzuna: ["Jobs by Adzuna", "https://www.adzuna.fr"], // provider's required wording: not translated
  jsearch: ["JSearch by OpenWeb Ninja", "https://rapidapi.com/letscrape-6bRBa3QguO5/api/jsearch"],
  francetravail: ["France Travail", "https://www.francetravail.fr"],
};
function renderSourceCredits() {
  const used = [...new Set(state.jobs.map((j) => j.source))].filter((s) => CREDITS[s]);
  $("#sourceCredits").replaceChildren(...(used.length ? [t("Job offers: "), ...used.flatMap((s, i) => [
    i ? " · " : "", h("a", { href: CREDITS[s][1], target: "_blank", rel: "noopener noreferrer", class: "underline" }, CREDITS[s][0])])] : []));
}

/* ---------- saved searches (this browser) ---------- */
const currentSearch = () => ({ query: $("#role").value, location: $("#loc").value.trim(), provider: $("#provider").value, country: $("#country").value });
const sameSearch = (a, b) => ["query", "location", "provider", "country"].every((k) => a[k] === b[k]);

function renderSavedSearches() {
  const saved = loadList(SAVED_KEY);
  $("#savedSearches").replaceChildren(...saved.map((s, i) => h("span", { class: "chip text-xs flex items-center gap-2" },
    h("button", { type: "button", class: "hover:underline", title: t("Run this search"), onClick: () => runSavedSearch(s) },
      `☆ ${s.query}${s.location ? ` · ${s.location}` : ""} · ${s.country.toUpperCase()}`),
    h("button", { type: "button", class: "mute", "aria-label": t("Remove saved search {query}", { query: s.query }), onClick: () => {
      const list = loadList(SAVED_KEY); list.splice(i, 1); ls.set(SAVED_KEY, JSON.stringify(list)); renderSavedSearches();
    } }, "×"))));
}
function onSaveSearch() {
  const s = currentSearch();
  ls.set(SAVED_KEY, JSON.stringify([s, ...loadList(SAVED_KEY).filter((x) => !sameSearch(x, s))].slice(0, 8)));
  renderSavedSearches();
  toast(t("Search saved. Click it any time to run it again."));
}
function runSavedSearch(s) {
  // A search saved on another path may use a job title that is not in the current list.
  if (![...$("#role").options].some((o) => o.value === s.query)) $("#role").append(h("option", { value: s.query }, s.query));
  $("#role").value = s.query; $("#loc").value = s.location; $("#country").value = s.country; $("#provider").value = s.provider;
  renderBoards();
  $("#searchForm").requestSubmit();
}

async function onSearch(e) {
  e.preventDefault();
  const btn = $("#searchBtn"), msg = $("#searchMsg");
  const params = currentSearch();
  ls.set(LOC_KEY, params.location);
  btn.disabled = true; msg.textContent = t("Searching…");
  state.jobs = []; state.skillFilter = null; renderOffers();
  try {
    const { jobs, warnings } = await searchJobs(params);
    msg.textContent = jobs.length ? tn(jobs.length, "{n} offer.", "{n} offers.") + (warnings.length ? " " + warnings.join(" ") : "")
      : t("No offers found. Try another title, city or country.");
    state.jobs = jobs;
  } catch (err) {
    msg.textContent = t("Live search is unavailable ({msg}). Use the job board links below.", { msg: err.message });
  } finally { btn.disabled = false; }
  state.searchJobs = state.jobs; state.searchMsg = msg.textContent; // kept while switching to "Companies I follow"
  renderOffers();
}

/* ---------- Offers tabs: "Job search" vs "Companies I follow" (both feed the same results list) ---------- */
const MODE_KEY = "hk.offerMode";
// Each tab keeps its own results and message: state.<mode>Jobs / state.<mode>Msg.
const OFFER_MODES = { search: ["#tabSearch", "#searchPanel"], companies: ["#tabCompanies", "#companiesPanel"], remote: ["#tabRemote", "#remotePanel"] };
function setOfferMode(mode) {
  state.offerMode = mode in OFFER_MODES ? mode : "search";
  ls.set(MODE_KEY, state.offerMode);
  for (const [m, [tab, panel]] of Object.entries(OFFER_MODES)) {
    const on = m === state.offerMode;
    $(panel).hidden = !on;
    $(tab).className = on ? "btn" : "btn-ghost";
    $(tab).setAttribute("aria-selected", String(on));
  }
  $("#boardsBlock").hidden = state.offerMode !== "search";
  state.skillFilter = null;
  state.jobs = state[`${state.offerMode === "companies" ? "company" : state.offerMode}Jobs`] || [];
  $("#searchMsg").textContent = state[`${state.offerMode === "companies" ? "company" : state.offerMode}Msg`] || "";
  renderOffers();
  if (state.offerMode === "companies") { renderWatchlist(); if (!state.companyLoaded) loadCompanyJobs(); }
}

/* ---------- remote jobs (Remotive + Jobicy, browser-side, cached 6 h) ---------- */
function renderRemoteRoles() {
  $("#remoteBtn").textContent = t("Find remote {path} jobs", { path: path()?.name || "" });
}
async function onRemoteSearch(e) {
  e.preventDefault();
  const btn = $("#remoteBtn"), msg = $("#searchMsg");
  btn.disabled = true; msg.textContent = t("Searching remote job boards…");
  try {
    const { jobs, warnings, cached } = await searchRemote(state.pathId, $("#remoteRegion").value);
    // The boards' keyword search is loose: keep titles that match the path (as for "Companies I follow").
    const matches = titleMatcher(path()), relevant = jobs.filter((j) => matches(j.title));
    const name = path()?.name || "", left = jobs.length - relevant.length;
    state.remoteJobs = relevant;
    state.remoteMsg = (relevant.length
      ? tn(relevant.length, "{n} remote {path} offer", "{n} remote {path} offers", { path: name })
        + (left ? t(" ({n} unrelated titles left out)", { n: left }) : "") + (cached ? t(" · from the last 6 hours") : "") + "."
      : $("#remoteRegion").value ? t("No remote {path} offers right now for this region: try 'Anywhere'.", { path: name })
      : t("No remote {path} offers right now: these boards list few roles for this path, check back in a few days.", { path: name }))
      + (warnings.length ? ` ${warnings.join(" ")}` : "");
  } catch (err) {
    state.remoteJobs = []; state.remoteMsg = t("Remote job boards are unavailable ({msg}).", { msg: err.message });
  } finally { btn.disabled = false; }
  if (state.offerMode === "remote") { state.jobs = state.remoteJobs; msg.textContent = state.remoteMsg; state.skillFilter = null; renderOffers(); }
}

function renderWatchlist() {
  const list = loadWatchlist();
  $("#tabCompanies").textContent = t("Companies I follow") + (list.length ? ` (${list.length})` : "");
  $("#companyList").replaceChildren(...(list.length ? list.map((e) => h("span", { class: "chip text-xs flex items-center gap-2" },
    h("span", {}, e.name, h("span", { class: "mute" }, ` · ${PROVIDER_NAMES[e.provider]}${e.count ? ` · ${tn(e.count, "{n} job", "{n} jobs")}` : ""}`)),
    h("button", { type: "button", class: "mute", "aria-label": t("Stop following {name}", { name: e.name }), title: t("Stop following"), onClick: () => unfollow(e) }, "×")))
    : [h("p", { class: "mute text-sm" }, t("You don't follow any company yet. Add one above or pick a suggestion."))]));
  const followed = new Set(list.map(entryKey));
  const sugg = SUGGESTED.filter((s) => !followed.has(entryKey(s)));
  $("#companySuggest").replaceChildren(...(sugg.length ? [
    h("p", { class: "mute text-xs mb-1" }, t("Popular in France, one click to follow:")),
    h("div", { class: "flex flex-wrap gap-1.5" }, sugg.map((s) =>
      h("button", { type: "button", class: "chip text-xs hover:opacity-80", onClick: () => follow(s) }, `+ ${s.name}`)))] : []));
}

function follow(e) {
  const list = loadWatchlist();
  if (!list.some((x) => entryKey(x) === entryKey(e))) {
    list.push({ provider: e.provider, slug: e.slug, name: e.name, count: e.count ?? null, added: new Date().toISOString() });
    saveWatchlist(list);
  }
  renderWatchlist();
  loadCompanyJobs();
}
function unfollow(e) {
  saveWatchlist(loadWatchlist().filter((x) => entryKey(x) !== entryKey(e)));
  renderWatchlist();
  loadCompanyJobs();
}

async function onCompanyFind(ev) {
  ev.preventDefault();
  const input = $("#companyInput").value.trim(), btn = $("#companyFind"), msg = $("#companyMsg");
  if (!input) return;
  btn.disabled = true; msg.textContent = t("Looking for {name}'s careers page…", { name: input });
  try {
    const found = (await findCompany(input)).sort((a, b) => (b.count ?? 0) - (a.count ?? 0));
    if (!found.length) {
      msg.textContent = t("No careers page found for \"{name}\" on Greenhouse, Lever, Ashby, Workable or SmartRecruiters. Try the exact company name, or paste the link of a job on their careers site.", { name: input });
      return;
    }
    const best = found[0]; // a company present on two systems (during a migration) keeps the one with most jobs
    follow(best);
    msg.textContent = t("Following {name} ({provider}{count}).", { name: best.name, provider: PROVIDER_NAMES[best.provider],
      count: best.count ? tn(best.count, ", {n} open job in total", ", {n} open jobs in total") : "" });
    $("#companyInput").value = "";
  } catch (e) { msg.textContent = e.message; } finally { btn.disabled = false; }
}

// Loads every followed company's jobs into the shared results list. "New" = published since the previous session.
async function loadCompanyJobs({ force = false } = {}) {
  const list = loadWatchlist();
  const run = (state.companyRun = (state.companyRun || 0) + 1); // only the latest load may update the screen
  if (force) clearCompanyCache();
  state.companyLoaded = true;
  state.prevChecked ??= Object.fromEntries(list.map((e) => [entryKey(e), e.lastChecked]));
  const pathOnly = $("#companyPathOnly").checked, p = path();
  const show = (m) => { state.companyMsg = m; if (state.offerMode === "companies") { state.jobs = state.companyJobs; $("#searchMsg").textContent = m; renderOffers(); } };
  if (!list.length) { state.companyJobs = []; show(""); return; }
  if (state.offerMode === "companies") $("#searchMsg").textContent = tn(list.length, "Loading jobs from {n} company…", "Loading jobs from {n} companies…");
  const results = await Promise.allSettled(list.map((e) =>
    fetchCompanyJobs(e, pathOnly ? titleMatcher(p) : () => true, pathOnly ? state.pathId : "all")));
  const jobs = [], errors = [];
  results.forEach((r, i) => {
    const prev = state.prevChecked[entryKey(list[i])];
    if (r.status === "fulfilled") {
      jobs.push(...r.value.map((j) => ({ ...j, isNew: Boolean(prev && j.posted && new Date(j.posted) > new Date(prev)) })));
    } else errors.push(r.reason?.message || list[i].name);
  });
  // Re-read the watchlist: companies may have been followed / unfollowed while this load was running.
  const checked = new Set(list.filter((_, i) => results[i].status === "fulfilled").map(entryKey)), now = new Date().toISOString();
  saveWatchlist(loadWatchlist().map((e) => (checked.has(entryKey(e)) ? { ...e, lastChecked: now } : e)));
  if (run !== state.companyRun) return;
  state.companyJobs = jobs.sort((a, b) => new Date(b.posted || 0) - new Date(a.posted || 0));
  const fresh = jobs.filter((j) => j.isNew).length, where = tn(list.length, "at {n} company", "at {n} companies");
  show((jobs.length
    ? tn(jobs.length, "{n} open role", "{n} open roles") + (pathOnly ? t(" for {path}", { path: p?.name }) : "") + ` ${where}`
      + (fresh ? t(" · {n} new since your last visit", { n: fresh }) : "") + "."
    : pathOnly ? t("No open {path} roles {where} right now. Untick \"Only roles for my path\" to see every job.", { path: p?.name, where })
    : t("No open roles {where} right now.", { where }))
    + (errors.length ? t(" Could not load: {list}.", { list: errors.join("; ") }) : ""));
}

async function onAdd(e) {
  e.preventDefault();
  const url = $("#cUrl").value.trim();
  if (url && !safeUrl(url)) { toast(t("The offer link must start with http:// or https://")); return; }
  try {
    await state.store.add({ path_id: state.pathId, title: $("#cTitle").value.trim(), company: $("#cCo").value.trim(), url: url || undefined, stage: "saved" });
    e.target.reset();
    await refreshTracker();
  } catch (err) { fail(err); }
}

/* ---------- auth ---------- */
async function onUser(user) {
  if ((user?.id || null) === (state.user?.id || null)) return;
  state.user = user;
  if (user) {
    state.store = new CloudStore(sb);
    try {
      const n = await importLocalToCloud(sb);
      const local = JSON.parse(ls.get(PROG_KEY) || "[]");
      if (local.length) {
        await sb.from("step_progress").upsert(local.map((id) => ({ user_id: user.id, step_id: id, done: true })));
        ls.del(PROG_KEY);
      }
      if (n) toast(tn(n, "Imported {n} guest application.", "Imported {n} guest applications."));
      const { data: prof } = await sb.from("profiles").select("*").maybeSingle();
      if (prof?.location && !$("#loc").value) $("#loc").value = prof.location;
      if (prof?.selected_path && prof.selected_path !== state.pathId && state.paths.some((p) => p.id === prof.selected_path)) await selectPath(prof.selected_path);
      else await sb.from("profiles").upsert({ user_id: user.id, selected_path: state.pathId });
    } catch (e) { fail(e); }
  } else {
    state.store = new LocalStore();
  }
  await Promise.all([refreshTracker(), loadProgress()]);
  renderLearn(); renderStatus();
}

/* ---------- init ---------- */
async function init() {
  initMonitoring();
  initPwa();
  renderThemeToggle();
  $("#themeToggle").addEventListener("click", toggleTheme);
  renderLangToggle();
  document.querySelectorAll(".contact-email").forEach((el) => {
    const m = CONFIG.CONTACT_EMAIL;
    el.replaceChildren(m ? h("a", { href: `mailto:${m}`, class: "underline" }, m) : t("contact address coming soon"));
  });
  showRoute(false);
  window.addEventListener("hashchange", () => showRoute(true));
  if (!configured) { $("#setup").hidden = false; $("#status").textContent = t("Setup needed"); return; }
  try {
    await loadPaths();
    const saved = ls.get(PATH_KEY);
    state.pathId = state.paths.some((p) => p.id === saved) ? saved : state.paths[0]?.id;
    if (!state.pathId) throw new Error(t("No career paths found. Did you run supabase/seed.sql?"));
    await Promise.all([loadResources(), loadTracks(), coursesReady]);
  } catch (e) { fail(e); return; }

  $("#loc").value = ls.get(LOC_KEY) || "";
  $("#pathSelect").addEventListener("change", (e) => selectPath(e.target.value));
  $("#role").addEventListener("change", renderBoards);
  $("#loc").addEventListener("input", renderBoards);
  $("#searchForm").addEventListener("submit", onSearch);
  $("#atsBtn").addEventListener("click", onAts);
  $("#cvFile").addEventListener("change", onCvFile);
  $("#cvSave").addEventListener("click", onCvSave);
  $("#cvClear").addEventListener("click", onCvClear);
  for (const id of ["#sortBy", "#fContract", "#fRemote", "#fFit", "#fHidden"]) $(id).addEventListener("change", renderOffers);
  $("#saveSearch").addEventListener("click", onSaveSearch);
  renderSavedSearches();
  $("#tabSearch").addEventListener("click", () => setOfferMode("search"));
  $("#tabCompanies").addEventListener("click", () => setOfferMode("companies"));
  $("#tabRemote").addEventListener("click", () => setOfferMode("remote"));
  $("#remoteForm").addEventListener("submit", onRemoteSearch);
  $("#companyForm").addEventListener("submit", onCompanyFind);
  $("#companyPathOnly").addEventListener("change", () => loadCompanyJobs());
  $("#companyRefresh").addEventListener("click", () => loadCompanyJobs({ force: true }));
  renderWatchlist();
  setOfferMode(ls.get(MODE_KEY));
  refreshInterview();
  $("#csvExport").addEventListener("click", onCsvExport);
  $("#csvImport").addEventListener("change", onCsvImport);
  $("#addForm").addEventListener("submit", onAdd);
  $("#exportData").addEventListener("click", () => onExport().catch(fail));
  $("#deleteData").addEventListener("click", onDelete);
  $("#cv").value = ls.get(CV_KEY) || "";
  setCv($("#cv").value);
  renderCvSkills();
  $("#hoursPerWeek").value = ls.get("hk.hours") || "5";
  $("#hoursPerWeek").addEventListener("input", (e) => { ls.set("hk.hours", e.target.value); renderTracks(); });

  await loadProgress();
  renderAll();
  await refreshTracker();
  initAuth({ onUser });
}

init();
