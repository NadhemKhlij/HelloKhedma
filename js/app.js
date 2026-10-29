// App entry point: start-up, career path selection, sign-in, theme / language, error monitoring and the PWA.
// Each page has its own module, sharing state.js:
//   router.js (routes, page focus) · home.js · offers.js · training.js · cvpage.js · applications.js · account.js
//   (+ courses.js and interview.js, which render their own pages).
// - Data: path content from Supabase (career_paths, path_resources here; tracks in training.js); applications through
//   state.store (LocalStore for guests, CloudStore when signed in, see store.js); onUser() imports guest data on sign-in.
// - selectPath() reloads the path content and redraws every page; the CV version linked to the path becomes active.
// - Also here: theme toggle ("hk.theme"), FR / EN button, error toasts + optional Sentry (CONFIG.SENTRY_DSN),
//   PWA registration (sw.js) and the "Install the app" link.
// - Every user-facing text goes through t() / tn(). i18n.js is imported first so the static page is translated
//   before anything renders; the FR / EN button reloads the page in the other language.
import { t, tn, lang, setLang } from "./i18n.js";
import { $, h, safeColor, ls, toast } from "./lib.js";
import { sb, configured, CONFIG } from "./supabase.js";
import { LocalStore, CloudStore, importLocalToCloud } from "./store.js";
import { addKeywords } from "./ats.js";
import { initAuth } from "./auth.js";
import { state, path, byKind, fail } from "./state.js";
import { showRoute, refreshInterview, coursesReady } from "./router.js";
import { PROG_KEY, loadTracks, loadProgress, renderLearn, initTraining } from "./training.js";
import { renderSearchControls, renderOffers, resetOffers, loadCompanyJobs, initOffers } from "./offers.js";
import { renderCvVersions, renderCvSkills, useCvForPath, initCvPage } from "./cvpage.js";
import { refreshTracker, initApplications } from "./applications.js";
import { renderStatus, initAccount } from "./account.js";

const PATH_KEY = "hk.path";

/* ---------- theme (the inline script in index.html applies it before first paint) and language ---------- */
const THEME_KEY = "hk.theme";
function renderThemeToggle() {
  const light = document.documentElement.dataset.theme === "light";
  const btn = $("#themeToggle");
  btn.textContent = light ? "☾" : "☀";
  btn.title = light ? t("Switch to dark theme") : t("Switch to light theme");
  btn.setAttribute("aria-label", btn.title);
}
function toggleTheme() {
  const next = document.documentElement.dataset.theme === "light" ? "dark" : "light";
  document.documentElement.dataset.theme = next;
  ls.set(THEME_KEY, next);
  renderThemeToggle();
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

/* ---------- career path ---------- */
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

function renderAll() {
  document.documentElement.style.setProperty("--accent", safeColor(path()?.color));
  renderPaths(); renderSearchControls(); renderLearn(); renderStatus(); renderCvVersions();
}

async function selectPath(id) {
  state.pathId = id;
  ls.set(PATH_KEY, id);
  resetOffers();
  try { state.openInit = false; await Promise.all([loadResources(), loadTracks()]); } catch (e) { fail(e); }
  useCvForPath(id); // skills are re-extracted with the new path keywords
  renderAll(); renderCvSkills(); renderOffers();
  if (state.offerMode === "companies") loadCompanyJobs(); // "only roles for my path" depends on the path
  refreshInterview();
  if (state.user) sb.from("profiles").upsert({ user_id: state.user.id, selected_path: id });
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

  $("#pathSelect").addEventListener("change", (e) => selectPath(e.target.value));
  initOffers();
  initCvPage();
  initApplications();
  initAccount();
  initTraining();
  refreshInterview();

  await loadProgress();
  renderAll();
  await refreshTracker();
  initAuth({ onUser });
}

init();
