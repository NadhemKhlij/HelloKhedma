import { $, h, safeUrl, safeColor, ls, toast } from "./lib.js";
import { sb, configured, CONFIG } from "./supabase.js";
import { LocalStore, CloudStore, importLocalToCloud } from "./store.js";
import { searchJobs, boardLinks } from "./jobs.js";
import { renderBoard } from "./tracker.js";
import { analyze } from "./ats.js";
import { initAuth } from "./auth.js";

const PATH_KEY = "hk.path", LOC_KEY = "hk.location", PROG_KEY = "hk.progress.v2";
const COUNTRIES = ["fr", "gb", "us", "de", "nl", "ca", "au", "be", "ch", "es", "it"];

const state = {
  paths: [], pathId: null, resources: [], tracks: [], open: new Set(), openInit: false, done: new Set(),
  user: null, store: new LocalStore(), cards: [],
};

const path = () => state.paths.find((p) => p.id === state.pathId);
const byKind = (k) => state.resources.filter((r) => r.kind === k);
const fail = (e) => toast(e?.message || "Something went wrong.");

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
  $("#results").replaceChildren(); $("#searchMsg").textContent = ""; $("#atsOut").replaceChildren();
  try { state.openInit = false; await Promise.all([loadResources(), loadTracks()]); } catch (e) { fail(e); }
  renderAll();
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

function renderJob(j) {
  const url = safeUrl(j.url);
  const btn = h("button", { type: "button", class: "btn-ghost", onClick: (e) => track(j, e.currentTarget) }, "Track");
  return h("li", { class: "rounded-lg p-3", style: "background:var(--bg);border:1px solid var(--line)" },
    h("b", { class: "block" }, j.title),
    h("span", { class: "mute text-sm block" }, [j.company, j.location].filter(Boolean).join(" · ")),
    h("p", { class: "text-sm mt-1 mute" }, j.snippet),
    h("div", { class: "flex items-center gap-2 mt-2" },
      url ? h("a", { href: url, target: "_blank", rel: "noopener noreferrer", class: "btn" }, "View offer") : null,
      btn, h("span", { class: "mute text-xs ml-auto" }, j.source)));
}

async function onSearch(e) {
  e.preventDefault();
  const btn = $("#searchBtn"), msg = $("#searchMsg");
  const params = { query: $("#role").value, location: $("#loc").value.trim(), provider: $("#provider").value, country: $("#country").value };
  ls.set(LOC_KEY, params.location);
  btn.disabled = true; msg.textContent = "Searching…"; $("#results").replaceChildren();
  try {
    const { jobs, warnings } = await searchJobs(params);
    msg.textContent = jobs.length ? `${jobs.length} offers.${warnings.length ? " " + warnings.join(" ") : ""}` : "No offers found. Try another title, city or country.";
    $("#results").replaceChildren(...jobs.map(renderJob));
  } catch (err) {
    msg.textContent = `Live search is unavailable (${err.message}). Use the job board links below.`;
  } finally { btn.disabled = false; }
}

function onAts() {
  const keywords = byKind("keyword").map((k) => k.title);
  const cv = $("#cv").value;
  if (!cv.trim()) { toast("Paste your CV text first."); return; }
  const r = analyze(cv, $("#jd").value, keywords);
  const chips = (list, ok) => list.map((k) => h("span", { class: `chip ${ok ? "chip-ok" : ""}` }, k));
  $("#atsOut").replaceChildren(
    h("p", { class: "text-lg font-bold" }, `${r.score}% match`, h("span", { class: "mute text-sm font-normal" }, ` · ${r.found.length} of ${r.total} ${r.usedJd ? "keywords from the job description" : "path keywords"}`)),
    h("p", { class: "mute text-sm mt-3 mb-1" }, "Found"),
    h("div", { class: "flex flex-wrap gap-2" }, r.found.length ? chips(r.found, true) : h("span", { class: "mute text-sm" }, "None yet.")),
    h("p", { class: "mute text-sm mt-3 mb-1" }, "Missing: add the ones you genuinely have"),
    h("div", { class: "flex flex-wrap gap-2" }, r.missing.length ? chips(r.missing, false) : h("span", { class: "mute text-sm" }, "Nothing missing.")),
  );
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
  if (!configured) { $("#setup").hidden = false; $("#status").textContent = "Setup needed"; return; }
  try {
    await loadPaths();
    const saved = ls.get(PATH_KEY);
    state.pathId = state.paths.some((p) => p.id === saved) ? saved : state.paths[0]?.id;
    if (!state.pathId) throw new Error("No career paths found. Did you run supabase/seed.sql?");
    await Promise.all([loadResources(), loadTracks()]);
  } catch (e) { fail(e); return; }

  $("#loc").value = ls.get(LOC_KEY) || "";
  $("#role").addEventListener("change", renderBoards);
  $("#loc").addEventListener("input", renderBoards);
  $("#searchForm").addEventListener("submit", onSearch);
  $("#atsBtn").addEventListener("click", onAts);
  $("#addForm").addEventListener("submit", onAdd);
  $("#hoursPerWeek").value = ls.get("hk.hours") || "5";
  $("#hoursPerWeek").addEventListener("input", (e) => { ls.set("hk.hours", e.target.value); renderTracks(); });

  await loadProgress();
  renderAll();
  await refreshTracker();
  initAuth({ onUser });
}

init();
