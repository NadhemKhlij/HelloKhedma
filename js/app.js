import { $, h, safeUrl, safeColor, ls, toast } from "./lib.js";
import { sb, configured, CONFIG } from "./supabase.js";
import { LocalStore, CloudStore, importLocalToCloud } from "./store.js";
import { searchJobs, boardLinks } from "./jobs.js";
import { renderBoard } from "./tracker.js";
import { extractSkills, matchSkills, addKeywords, readCvFile } from "./ats.js";
import { initAuth } from "./auth.js";
import { loadCourseIndex, renderCourseList, renderCourse, courseForSkill } from "./courses.js";

const PATH_KEY = "hk.path", LOC_KEY = "hk.location", PROG_KEY = "hk.progress.v2";
const CV_KEY = "hk.cv.text"; // the CV text stays in this browser only, even for signed-in users
const COUNTRIES = ["fr", "gb", "us", "de", "nl", "ca", "au", "be", "ch", "es", "it"];

const state = {
  paths: [], pathId: null, resources: [], tracks: [], open: new Set(), openInit: false, done: new Set(),
  user: null, store: new LocalStore(), cards: [],
  cv: { text: "", skills: [], names: new Set() }, jobs: [], skillFilter: null,
};

const path = () => state.paths.find((p) => p.id === state.pathId);
const byKind = (k) => state.resources.filter((r) => r.kind === k);
const fail = (e) => toast(e?.message || "Something went wrong.");

/* ---------- theme (the inline script in index.html applies it before first paint) ---------- */
const THEME_KEY = "hk.theme";
function renderThemeToggle() {
  const light = document.documentElement.dataset.theme === "light";
  const btn = $("#themeToggle");
  btn.textContent = light ? "☾" : "☀";
  btn.title = light ? "Switch to dark theme" : "Switch to light theme";
  btn.setAttribute("aria-label", btn.title);
}
function toggleTheme() {
  const next = document.documentElement.dataset.theme === "light" ? "dark" : "light";
  document.documentElement.dataset.theme = next;
  ls.set(THEME_KEY, next);
  renderThemeToggle();
}

/* ---------- pages (hash routes: #/, #/offers, #/training, #/cv, #/applications, #/course/<id>) ---------- */
const ROUTES = { home: "Home", offers: "Offers", training: "Training", cv: "CV check", applications: "My applications", course: "Course" };
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
  document.title = r === "home" ? "HelloKhedma" : `${ROUTES[r]} · HelloKhedma`;
  if (moveFocus) window.scrollTo(0, 0);
  if (r === "course") {
    coursesReady.then(() => renderCourse(param)).then(() => { if (moveFocus) $("#h-course")?.focus({ preventScroll: true }); });
  } else if (moveFocus) $(`#h-${r}`)?.focus({ preventScroll: true });
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
  renderBoard($("#board"), state.cards, {
    colorOf: (id) => state.paths.find((p) => p.id === id)?.color,
    onMove: async (id, stage) => { try { await state.store.move(id, stage); await refreshTracker(); } catch (e) { fail(e); } },
    onRemove: async (id) => { try { await state.store.remove(id); await refreshTracker(); } catch (e) { fail(e); } },
  });
  renderHome();
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
    h("span", { class: "text-sm font-medium", style: "color:var(--accent)" }, `${cta} →`));
  $("#homeSummary").replaceChildren(
    card("Training", all.length ? `${done}/${all.length} steps` : "No tracks yet",
      next ? `Next up: ${next.title}` : all.length ? "Every step is done. Time to apply!" : "", "#/training", "Continue learning"),
    card("Applications", String(state.cards.length),
      `${count("applied")} applied · ${count("interview")} interview · ${count("offer")} offer`, "#/applications", "Open tracker"),
    card("Offers", path()?.name || "Offers",
      `Live ${path()?.job_titles?.[0] || "job"} offers by city and country.`, "#/offers", "Find offers"),
  );
}

function renderSearchControls() {
  const p = path();
  $("#role").replaceChildren(...(p?.job_titles || []).map((t) => h("option", { value: t }, t)));
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
  const box = h("input", { type: "checkbox", class: "mt-1", checked: state.done.has(s.id), "aria-label": `Mark "${s.title}" as done`,
    onChange: (e) => toggleStep(s.id, e.target.checked) });
  const badge = (txt, accent) => h("span", { class: "chip !py-0 text-xs", style: accent ? "border-color:var(--accent)" : "" }, txt);
  return h("li", { class: "flex gap-3" }, box, h("div", { class: "min-w-0" },
    url ? h("a", { href: url, target: "_blank", rel: "noopener noreferrer", class: "font-medium underline", style: "color:var(--accent)" }, s.title) : h("b", {}, s.title),
    h("p", { class: "mute text-sm" }, s.description),
    h("div", { class: "flex flex-wrap gap-1.5 mt-1" },
      badge(KIND[s.kind] || s.kind, true), s.provider ? badge(s.provider) : null,
      badge(`${Number(s.est_hours)} h`), badge(s.is_free ? "Free" : "Paid"))));
}

function trackCard(t) {
  const steps = stepsOf(t), n = steps.filter((s) => state.done.has(s.id)).length;
  const pct = steps.length ? Math.round((n / steps.length) * 100) : 0;
  const hours = steps.reduce((a, s) => a + Number(s.est_hours), 0);
  return h("details", { class: "rounded-lg", style: "background:var(--bg);border:1px solid var(--line)", open: state.open.has(t.id),
    onToggle: (e) => { e.target.open ? state.open.add(t.id) : state.open.delete(t.id); } },
    h("summary", { class: "cursor-pointer p-3 grid gap-2" },
      h("div", { class: "flex flex-wrap items-center gap-2" },
        h("span", { class: "chip chip-ok !py-0 text-xs" }, LEVEL[t.level] || t.level),
        h("b", {}, t.title),
        h("span", { class: "mute text-sm ml-auto" }, `${n}/${steps.length} steps · ${Math.round(hours)} h`)),
      h("div", { class: "h-1.5 rounded-full", style: "background:var(--line)" },
        h("div", { class: "h-1.5 rounded-full", style: `width:${pct}%;background:var(--accent)` }))),
    h("div", { class: "px-3 pb-3 grid gap-3" },
      t.summary ? h("p", { class: "text-sm mute" }, t.summary) : null,
      t.outcome ? h("p", { class: "text-sm" }, h("b", {}, "You will be able to: "), t.outcome) : null,
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
    ? `${all.length - left.length}/${all.length} steps done · about ${Math.round(hoursLeft)} h left · roughly ${Math.ceil(hoursLeft / perWeek)} weeks at ${perWeek} h/week`
    : "No tracks for this path yet.";
  const next = left[0], url = next && safeUrl(next.url);
  $("#nextUp").replaceChildren(...(next
    ? [h("p", { class: "text-sm rounded-lg p-3", style: "background:var(--bg);border:1px solid var(--accent)" },
        h("span", { class: "mute" }, "Next up: "),
        url ? h("a", { href: url, target: "_blank", rel: "noopener noreferrer", class: "underline font-medium", style: "color:var(--accent)" }, next.title) : h("b", {}, next.title),
        h("span", { class: "mute" }, ` · ${Number(next.est_hours)} h`))]
    : all.length ? [h("p", { class: "text-sm" }, "Every step is done. Time to apply!")] : []));
  $("#tracks").replaceChildren(...state.tracks.map(trackCard));
}

function renderLearn() {
  renderTracks();
  $("#tools").replaceChildren(...byKind("tool").map((t) => h("li", {}, h("b", {}, t.title), h("small", { class: "mute block" }, t.description))));
  $("#tips").replaceChildren(...byKind("tip").map((t) => h("li", { class: "rounded-lg p-3 text-sm", style: "background:var(--bg);border:1px solid var(--line)" }, t.title)));
  renderCourseList($("#courseList"), state.pathId);
  renderHome();
}

function renderStatus() {
  $("#status").textContent = state.user ? `Synced · ${state.user.email}` : "Guest mode · saved on this device";
  $("#authOpen").hidden = Boolean(state.user);
  $("#signOut").hidden = !state.user;
}

function renderAll() {
  document.documentElement.style.setProperty("--accent", safeColor(path()?.color));
  renderPaths(); renderSearchControls(); renderLearn(); renderStatus();
}

/* ---------- actions ---------- */
async function selectPath(id) {
  state.pathId = id;
  ls.set(PATH_KEY, id);
  state.jobs = []; state.skillFilter = null;
  $("#searchMsg").textContent = ""; $("#atsOut").replaceChildren();
  try { state.openInit = false; await Promise.all([loadResources(), loadTracks()]); } catch (e) { fail(e); }
  setCv(state.cv.text); // new path keywords may now be detectable
  renderAll(); renderCvSkills(); renderOffers();
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
    btn.disabled = true; btn.textContent = "Tracked";
    toast("Added to Saved");
    await refreshTracker();
  } catch (e) { toast(e.code === "DUPLICATE" ? "Already in your tracker" : e.message); }
}

/* ---------- CV skills (the CV text is kept in this browser only) ---------- */
const fitColor = (score) => (score >= 70 ? "#18a999" : score >= 40 ? "#f08a24" : "#e0508b");
// A skill you have shows ✓; a missing skill with a HelloKhedma course links to it (📘).
const skillChip = (name, inCv) => {
  const course = inCv ? null : courseForSkill(name);
  return course
    ? h("a", { href: `#/course/${course}`, class: "chip text-xs mute hover:opacity-80", title: `Learn ${name}: HelloKhedma course` }, `📘 ${name}`)
    : h("span", { class: `chip text-xs ${inCv ? "chip-ok" : "mute"}` }, inCv ? `✓ ${name}` : name);
};

function setCv(text) {
  const skills = extractSkills(text);
  state.cv = { text, skills, names: new Set(skills.map((s) => s.name)) };
}

function saveCv(text) {
  setCv(text);
  if (text.trim()) ls.set(CV_KEY, text); else ls.del(CV_KEY);
  renderCvSkills(); renderOffers();
}

function renderCvSkills() {
  const { text, skills } = state.cv;
  if (!text.trim()) { $("#cvSkills").replaceChildren(h("p", { class: "mute text-sm" }, "No CV saved yet.")); return; }
  const cats = [...new Set(skills.map((s) => s.cat))];
  $("#cvSkills").replaceChildren(...[
    h("p", { class: "font-bold" }, `${skills.length} skills found in your CV`,
      h("span", { class: "mute text-sm font-normal" }, " · saved on this device and used to score offers")),
    skills.length ? null : h("p", { class: "mute text-sm" }, "No known skills detected. Check the text is readable, or paste it instead."),
    ...cats.map((c) => h("div", { class: "mt-2" },
      h("p", { class: "mute text-xs mb-1" }, c),
      h("div", { class: "flex flex-wrap gap-1.5" }, skills.filter((s) => s.cat === c)
        .map((s) => h("span", { class: "chip chip-ok text-xs" }, s.count > 1 ? `${s.name} ×${s.count}` : s.name))))),
  ].filter(Boolean));
}

async function onCvFile(e) {
  const file = e.target.files?.[0];
  if (!file) return;
  const msg = $("#cvFileMsg");
  msg.textContent = `Reading ${file.name}…`;
  try {
    const text = (await readCvFile(file)).trim();
    if (!text) throw new Error("no text found. If it is a scanned PDF, paste the text instead.");
    $("#cv").value = text;
    saveCv(text);
    msg.textContent = `${file.name} read.`;
  } catch (err) { msg.textContent = `Could not read ${file.name}: ${err.message}`; }
  e.target.value = "";
}

function onCvSave() {
  const text = $("#cv").value;
  if (!text.trim()) { toast("Upload or paste your CV first."); return; }
  saveCv(text);
}

function onCvClear() {
  $("#cv").value = ""; $("#atsOut").replaceChildren(); $("#cvFileMsg").textContent = "";
  saveCv("");
  toast("Your CV was removed from this device.");
}

function onAts() {
  if (!state.cv.text.trim()) { toast("Add your CV first (upload or paste it above)."); return; }
  const jd = $("#jd").value, usedJd = Boolean(jd.trim());
  // Path keywords go through the extractor too, so aliases map to the same names as in the CV.
  const required = extractSkills(usedJd ? jd : byKind("keyword").map((k) => k.title).join(" ; ")).map((s) => s.name);
  const r = matchSkills(required, state.cv.names);
  if (!r.total) { $("#atsOut").replaceChildren(h("p", { class: "mute text-sm" }, "No known skills found in this job description.")); return; }
  const chips = (list, inCv) => list.map((n) => skillChip(n, inCv));
  $("#atsOut").replaceChildren(
    h("p", { class: "text-lg font-bold", style: `color:${fitColor(r.score)}` }, `${r.score}% match`,
      h("span", { class: "mute text-sm font-normal" }, ` · ${r.matched.length} of ${r.total} ${usedJd ? "skills from the offer" : "path keywords"} are in your CV`)),
    h("p", { class: "mute text-sm mt-3 mb-1" }, "In your CV"),
    h("div", { class: "flex flex-wrap gap-2" }, r.matched.length ? chips(r.matched, true) : h("span", { class: "mute text-sm" }, "None yet.")),
    h("p", { class: "mute text-sm mt-3 mb-1" }, "Missing: add the ones you genuinely have · 📘 = open the HelloKhedma course"),
    h("div", { class: "flex flex-wrap gap-2" }, r.missing.length ? chips(r.missing, false) : h("span", { class: "mute text-sm" }, "Nothing missing.")),
  );
}

/* ---------- offers: skills per offer + CV fit ---------- */
// `text` is the fuller description from the job-search function; older cached results only have `snippet`.
const jobText = (j) => `${j.title} ${j.text || j.snippet || ""}`;
// Below this many detected skills a percentage says more about the short summary than about the fit.
const MIN_SKILLS_FOR_FIT = 2;

function renderJob({ j, skills, fit }) {
  const url = safeUrl(j.url);
  const btn = h("button", { type: "button", class: "btn-ghost", onClick: (e) => track(j, e.currentTarget) }, "Track");
  const badge = fit?.score != null
    ? h("span", { class: "chip text-xs font-bold shrink-0 ml-auto whitespace-nowrap", style: `border-color:${fitColor(fit.score)};color:${fitColor(fit.score)}`,
        title: `${fit.matched.length} of ${fit.total} skills from this offer are in your CV` }, `${fit.score}% fit · ${fit.matched.length}/${fit.total}`)
    : fit ? h("span", { class: "mute text-xs shrink-0 ml-auto whitespace-nowrap", title: "The offer summary names too few skills to score it." }, "Fit: n/a")
    : null;
  return h("li", { class: "rounded-lg p-3", style: "background:var(--bg);border:1px solid var(--line)" },
    h("div", { class: "flex items-start gap-2" },
      h("div", { class: "min-w-0" },
        h("b", { class: "block" }, j.title),
        h("span", { class: "mute text-sm block" }, [j.company, j.location].filter(Boolean).join(" · "))),
      badge),
    skills.length
      ? h("div", { class: "flex flex-wrap gap-1.5 mt-2", "aria-label": "Skills in this offer" }, skills.slice(0, 8).map((s) => skillChip(s, state.cv.names.has(s))))
      : h("p", { class: "mute text-xs mt-2" }, "No specific skills detected in the offer summary."),
    h("p", { class: "text-sm mt-2 mute" }, j.snippet),
    h("div", { class: "flex items-center gap-2 mt-2" },
      url ? h("a", { href: url, target: "_blank", rel: "noopener noreferrer", class: "btn" }, "View offer") : null,
      btn, h("span", { class: "mute text-xs ml-auto" }, SOURCE_NAMES[j.source] || j.source)));
}
const SOURCE_NAMES = { francetravail: "France Travail", adzuna: "Adzuna", jsearch: "JSearch" };

function renderOffers() {
  const hasCv = state.cv.skills.length > 0;
  if (!state.jobs.length) { $("#offerTools").hidden = true; $("#results").replaceChildren(); return; }
  let list = state.jobs.map((j) => {
    const skills = extractSkills(jobText(j)).map((s) => s.name);
    let fit = hasCv ? matchSkills(skills, state.cv.names) : null;
    if (fit && fit.total < MIN_SKILLS_FOR_FIT) fit = { ...fit, score: null };
    return { j, skills, fit };
  });

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
    ? h("span", {}, "Average CV fit: ", h("b", { style: avg == null ? "" : `color:${fitColor(avg)}` }, avg == null ? "n/a" : `${avg}%`),
        h("span", { class: "mute" }, " · ✓ = skill found in your CV"))
    : h("span", { class: "mute" }, "Add your CV on the ",
        h("a", { href: "#/cv", class: "underline", style: "color:var(--accent)" }, "CV check"), " page to see how well you fit each offer."));

  $("#sortBy").disabled = !hasCv;
  if (state.skillFilter) list = list.filter((x) => x.skills.includes(state.skillFilter));
  if (hasCv && $("#sortBy").value === "fit") list = [...list].sort((a, b) => (b.fit?.score ?? -1) - (a.fit?.score ?? -1));
  $("#offerTools").hidden = false;
  $("#results").replaceChildren(...list.map(renderJob));
}

async function onSearch(e) {
  e.preventDefault();
  const btn = $("#searchBtn"), msg = $("#searchMsg");
  const params = { query: $("#role").value, location: $("#loc").value.trim(), provider: $("#provider").value, country: $("#country").value };
  ls.set(LOC_KEY, params.location);
  btn.disabled = true; msg.textContent = "Searching…";
  state.jobs = []; state.skillFilter = null; renderOffers();
  try {
    const { jobs, warnings } = await searchJobs(params);
    msg.textContent = jobs.length ? `${jobs.length} offers.${warnings.length ? " " + warnings.join(" ") : ""}` : "No offers found. Try another title, city or country.";
    state.jobs = jobs;
  } catch (err) {
    msg.textContent = `Live search is unavailable (${err.message}). Use the job board links below.`;
  } finally { btn.disabled = false; }
  renderOffers();
}

async function onAdd(e) {
  e.preventDefault();
  const url = $("#cUrl").value.trim();
  if (url && !safeUrl(url)) { toast("The offer link must start with http:// or https://"); return; }
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
      if (n) toast(`Imported ${n} guest application${n > 1 ? "s" : ""}.`);
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
  renderThemeToggle();
  $("#themeToggle").addEventListener("click", toggleTheme);
  showRoute(false);
  window.addEventListener("hashchange", () => showRoute(true));
  if (!configured) { $("#setup").hidden = false; $("#status").textContent = "Setup needed"; return; }
  try {
    await loadPaths();
    const saved = ls.get(PATH_KEY);
    state.pathId = state.paths.some((p) => p.id === saved) ? saved : state.paths[0]?.id;
    if (!state.pathId) throw new Error("No career paths found. Did you run supabase/seed.sql?");
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
  $("#sortBy").addEventListener("change", renderOffers);
  $("#addForm").addEventListener("submit", onAdd);
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
