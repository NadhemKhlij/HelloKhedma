// App entry point: start-up, career path selection, sign-in, theme / language, error monitoring and the PWA.
// Each page has its own module, sharing state.js:
//   router.js (routes, page focus) · home.js · offers.js · training.js · cvpage.js · applications.js · account.js
//   (+ courses.js and interview.js, which render their own pages).
// - Data: path content from Supabase (career_paths, path_resources here; tracks in training.js); applications through
//   state.store (LocalStore for guests, CloudStore when signed in, see store.js); onUser() imports guest data on sign-in.
// - selectPath() reloads the path content and redraws every page; the CV version linked to the path becomes active.
// - Also here: keyboard helpers (skip link, arrow keys in tab bars: initKeyboard), theme toggle ("hk.theme", shows the current theme; the browser bar colour follows the page), EN / FR button (both shown, the current one highlighted), error toasts + optional Sentry (CONFIG.SENTRY_DSN), optional Cloudflare Web Analytics (CONFIG.CF_ANALYTICS_TOKEN),
//   PWA registration (sw.js) and the "Install the app" link.
// - Every user-facing text goes through t() / tn(). i18n.js is imported first so the static page is translated
//   before anything renders; the FR / EN button reloads the page in the other language.
import { t, tn, lang, setLang, localize } from "./i18n.js";
import { $, h, safeColor, inkFor, ls, toast, PREVIEW } from "./lib.js";
import { sb, configured, CONFIG } from "./supabase.js";
import { LocalStore, CloudStore, importLocalToCloud } from "./store.js";
import { cvSyncUser } from "./cvsync.js";
import { learnSyncUser } from "./learnsync.js";
import { addKeywords } from "./ats.js";
import { initAuth } from "./auth.js";
import { state, path, byKind, fail } from "./state.js";
import { pathArt } from "./icons.js";
import { showRoute, refreshInterview, refreshSkillCheck, coursesReady } from "./router.js";
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
  btn.textContent = light ? "☀" : "☾"; // the theme in use (not the one a click switches to)
  btn.title = light ? t("Switch to dark theme") : t("Switch to light theme");
  btn.setAttribute("aria-label", btn.title);
}
function toggleTheme() {
  const next = document.documentElement.dataset.theme === "light" ? "dark" : "light";
  document.documentElement.dataset.theme = next;
  $('meta[name="theme-color"]')?.setAttribute("content", next === "light" ? "#faf9f5" : "#1f1e1d"); // browser bar = page
  ls.set(THEME_KEY, next);
  renderThemeToggle();
}
// Shows both languages, the current one highlighted; a click reloads the page in the other one.
function renderLangToggle() {
  const btn = $("#langToggle");
  btn.replaceChildren(...["EN", "FR"].map((x) => h("span", { class: `lang-opt${x.toLowerCase() === lang ? " on" : ""}`, "aria-hidden": "true" }, x)));
  btn.title = lang === "fr" ? "Switch to English" : "Passer en français";
  btn.setAttribute("aria-label", btn.title);
  btn.setAttribute("lang", lang === "fr" ? "en" : "fr");
  btn.addEventListener("click", () => setLang(lang === "fr" ? "en" : "fr"));
}

/* ---------- data loading (all content comes from Supabase) ---------- */
async function loadPaths() {
  const { data, error } = await sb.from("career_paths").select("*").order("sort_order");
  if (error) throw error;
  state.paths = localize(data, ["name", "blurb"]);
}
async function loadResources() {
  const { data, error } = await sb.from("path_resources").select("*").eq("path_id", state.pathId).order("sort_order");
  if (error) throw error;
  state.resources = localize(data, ["title", "description"]); // keywords have no French: they stay English for matching
  addKeywords(byKind("keyword").map((k) => k.title)); // make every path keyword detectable in CVs and offers
}

/* ---------- career path ---------- */
// Path cards: a colored band with the path illustration (icons.js), name + "Selected" badge, blurb, job titles as chips.
function renderPaths() {
  $("#paths").replaceChildren(...state.paths.map((p) => {
    const on = p.id === state.pathId, c = safeColor(p.color);
    return h("button", {
      type: "button", class: "panel !p-0 overflow-hidden text-left flex flex-col", "aria-pressed": String(on),
      style: on ? `border-color:${c};box-shadow:0 0 0 1px ${c}` : "",
      onClick: () => selectPath(p.id),
    },
      h("div", { class: "grid place-items-center h-24 sm:h-32", style: `background:color-mix(in srgb, ${c} 62%, #fff)` }, pathArt(p.id)),
      h("div", { class: "p-5 grid gap-2" },
        h("div", { class: "flex items-center gap-2 flex-wrap" }, h("b", { class: "text-lg font-semibold" }, p.name),
          on ? h("span", { class: "badge" }, t("Selected")) : null),
        h("span", { class: "mute text-sm" }, p.blurb),
        h("div", { class: "flex flex-wrap gap-1.5 mt-1" }, (p.job_titles || []).slice(1, 4).map((j) => h("span", { class: "chip !text-xs" }, j)))));
  }));
  $("#pathSelect").replaceChildren(...state.paths.map((p) => h("option", { value: p.id, selected: p.id === state.pathId }, p.name)));
}

function renderAll() {
  const c = safeColor(path()?.color), root = document.documentElement.style;
  root.setProperty("--accent", c); // fills, bars, borders
  // Text in the path colour and white text on it, readable in both themes (WCAG AA: lib.js inkFor, css/input.css).
  root.setProperty("--accent-ink-light", inkFor(c, "light")); root.setProperty("--accent-ink-dark", inkFor(c, "dark"));
  root.setProperty("--accent-fill", inkFor(c, "fill"));
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
  refreshInterview(); refreshSkillCheck();
  if (state.user) sb.from("profiles").upsert({ user_id: state.user.id, selected_path: id });
}

// Learning progress merged from another device (learnsync.js): redraw Training, Home and the interview page.
window.addEventListener("hk:learning-synced", () => { renderLearn(); refreshInterview(); });

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
  cvSyncUser(user).catch((e) => console.warn("CV sync:", e.message)); // opt-in CV sync (no-op when it is off)
  learnSyncUser(user).catch((e) => console.warn("Learning sync:", e.message)); // lessons, quizzes, XP… on every device
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
  initWebAnalytics();
  if (!CONFIG.SENTRY_DSN) return;
  const s = document.createElement("script");
  s.src = "https://browser.sentry-cdn.com/8.38.0/bundle.min.js";
  s.crossOrigin = "anonymous";
  s.onload = () => window.Sentry?.init({ dsn: CONFIG.SENTRY_DSN, tracesSampleRate: 0, sendDefaultPii: false });
  document.head.append(s);
}

// Visitor counts (CONFIG.CF_ANALYTICS_TOKEN, 2026-11-06): Cloudflare Web Analytics, cookie-free, aggregated page views
// only (privacy policy); never on a preview build or a local / test server (localhost, 127.x: the smoke tests in CI),
// so test visits are not counted (and Cloudflare refuses those origins anyway).
function initWebAnalytics() {
  if (!CONFIG.CF_ANALYTICS_TOKEN || PREVIEW || /^(localhost|127\.|\[?::1\]?$|0\.0\.0\.0)/.test(location.hostname)) return;
  const s = document.createElement("script");
  s.defer = true;
  s.src = "https://static.cloudflareinsights.com/beacon.min.js";
  s.dataset.cfBeacon = JSON.stringify({ token: CONFIG.CF_ANALYTICS_TOKEN, spa: true });
  document.head.append(s);
}

/* ---------- installable app (PWA): service worker + "Install the app" link ---------- */
function initPwa() {
  // A preview build (lib.js PREVIEW) shows a banner and registers no service worker: its cache would compete with the
  // live site's on the same origin, and a test version does not need to work offline.
  if (PREVIEW) {
    document.body.prepend(h("div", { role: "note", class: "text-sm text-center px-4 py-2", style: "background:var(--accent-fill);color:#fff" },
      t("Test version (branch {b}): its data is kept apart from the live site. ", { b: PREVIEW }),
      h("a", { href: "../../", class: "underline font-medium" }, t("Open the live site"))));
    return;
  }
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
// Keyboard (accessibility pass, 2026-11-09): the skip link moves focus to the visible page's title; in any tab bar
// (role="tablist"), ←/→ (and Home/End) move to the next tab and open it, as screen-reader users expect.
function initKeyboard() {
  $("#skipLink").addEventListener("click", (e) => {
    e.preventDefault();
    const title = [...document.querySelectorAll("section[data-page]")].find((s) => !s.hidden)?.querySelector("h1");
    if (title) { if (!title.hasAttribute("tabindex")) title.setAttribute("tabindex", "-1"); title.focus(); }
  });
  document.addEventListener("keydown", (e) => {
    const tab = e.target.closest?.('[role="tab"]'), list = tab?.closest('[role="tablist"]');
    if (!list || !["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) return;
    const tabs = [...list.querySelectorAll('[role="tab"]')].filter((x) => !x.disabled && !x.hidden);
    const i = tabs.indexOf(tab), rtl = getComputedStyle(list).direction === "rtl";
    const step = (e.key === "ArrowRight") !== rtl ? 1 : -1;
    const next = e.key === "Home" ? tabs[0] : e.key === "End" ? tabs.at(-1) : tabs[(i + step + tabs.length) % tabs.length];
    if (!next || next === tab) return;
    e.preventDefault(); next.focus(); next.click();
  });
}

async function init() {
  initKeyboard();
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
  renderAll(); refreshSkillCheck();
  await refreshTracker();
  initAuth({ onUser });
}

init();
