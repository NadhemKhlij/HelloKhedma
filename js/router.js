// Hash router: #/<route>[/<param>] shows <section data-page="route"> (ROUTES), highlights the nav tab (NAV_OF for
// sub-pages) and moves focus to the page title. An unknown "#/…" address (audit 2026-11-23 P2: it showed Home with no
// message and kept the wrong address) shows Home with "Page not found" and corrects the address to "#/"; anything that
// is not "#/…" shows Home, untouched, so supabase-js can read "#access_token=..." after a magic link. Also refreshes pages that depend on data changed elsewhere.
// Sub-pages (course, AI track, review, skill check, project, interview, admin) are loaded on their first visit with a
// dynamic import (functional audit of 2026-11-23, P3: every visit loaded all of them); PAGES caches each module.
import { $, toast } from "./lib.js";
import { t } from "./i18n.js";
import { state, path } from "./state.js";
import { loadCourseIndex } from "./catalog.js";
import { showCvTab } from "./cvpage.js";
import { refreshLearning } from "./training.js";
import { renderHome } from "./home.js";
import { maybeAutoSearch } from "./offers.js";

const PAGES = {
  course: () => import("./courses.js"), ai: () => import("./aitrack.js"), review: () => import("./review.js"),
  skillcheck: () => import("./skillcheck.js"), project: () => import("./projects.js"), interview: () => import("./interview.js"),
  admin: () => import("./admin.js"),
};
const page = (name) => PAGES[name]();

const ROUTES = {
  home: "Home", offers: "Offers", training: "Training", cv: "CV check", applications: "My applications", course: "Course",
  account: "Your account & data", legal: "Legal notice", privacy: "Privacy policy", interview: "Interview prep",
  project: "Portfolio project", ai: "AI engineer track", admin: "Site statistics", review: "Review today", skillcheck: "Skill check",
};
const NAV_OF = { course: "training", project: "training", ai: "training", admin: "account", review: "training", skillcheck: "training" }; // which nav tab is highlighted for sub-pages
export const coursesReady = loadCourseIndex();

const routeOf = () => {
  const [, r = "home", param = null] = location.hash.match(/^#\/([a-z]*)(?:\/([a-z0-9-]+))?/) || [];
  if (r in ROUTES || r === "") return { r: r || "home", param };
  return { r: "home", param: null, unknown: /^#\/./.test(location.hash) };
};

export function showRoute(moveFocus) {
  // Switching tabs with the keyboard (#/cv ↔ #/cv/maker): the focus stays on the tab, not the page title.
  if (document.activeElement?.matches?.('[role="tab"]')) moveFocus = false;
  const { r, param, unknown } = routeOf();
  if (unknown) {
    history.replaceState(null, "", `${location.pathname}${location.search}#/`);
    toast(t("Page not found. Here is the home page."));
  }
  const nav = NAV_OF[r] || r;
  document.querySelectorAll("[data-page]").forEach((s) => { s.hidden = s.dataset.page !== r; });
  document.querySelectorAll("[data-route]").forEach((a) => {
    if (a.dataset.route === nav) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
  });
  document.title = r === "home" ? "HelloKhedma" : `${t(ROUTES[r])} · HelloKhedma`;
  if (moveFocus) window.scrollTo(0, 0);
  if (r === "course") {
    Promise.all([coursesReady, page("course")]).then(([, m]) => m.renderCourse(param)).then(() => { if (moveFocus) $("#h-course")?.focus({ preventScroll: true }); });
  } else if (r === "ai") {
    page("ai").then((m) => m.renderAiTrack()).then(() => { if (moveFocus) $("#h-ai")?.focus({ preventScroll: true }); });
  } else if (r === "review") {
    page("review").then((m) => m.renderReview(param)).then(() => { if (moveFocus) $("#h-review")?.focus({ preventScroll: true }); });
  } else if (r === "skillcheck") {
    if (path()) page("skillcheck").then((m) => m.renderSkillCheck()).then(() => { if (moveFocus) $("#h-skillcheck")?.focus({ preventScroll: true }); });
  } else if (r === "project") {
    page("project").then((m) => m.renderProject(param)).then(() => { if (moveFocus) $("#h-project")?.focus({ preventScroll: true }); });
  } else if (moveFocus) $(`#h-${r}`)?.focus({ preventScroll: true });
  if (r === "interview") refreshInterview();
  if (r === "offers") maybeAutoSearch(); // first visit in this session: run the search (offers.js)
  if (r === "admin") page("admin").then((m) => m.renderAdmin()); // admins only: the database refuses everyone else
  if (r === "cv" && path()) showCvTab(param); // #/cv/maker opens the CV maker tab
  if (r === "training" && path()) refreshLearning(); // lessons, quiz scores and XP may have changed on a course page
  if (r === "home" && path()) renderHome(); // streak
}

// The skill check lists the courses of the selected path: drawn again once the path is loaded or changed.
export function refreshSkillCheck() {
  if (routeOf().r === "skillcheck" && path()) page("skillcheck").then((m) => m.renderSkillCheck());
}

// The interview page depends on the path (role questions, courses) and the tracker (upcoming interviews).
export function refreshInterview() {
  if (routeOf().r === "interview" && path()) page("interview").then((m) => m.renderInterview({ path: path(), cards: state.cards }));
}
