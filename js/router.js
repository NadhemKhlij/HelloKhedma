// Hash router: #/<route>[/<param>] shows <section data-page="route"> (ROUTES), highlights the nav tab (NAV_OF for
// sub-pages) and moves focus to the page title. Anything else shows Home, untouched, so supabase-js can read
// "#access_token=..." after a magic link. Also refreshes pages that depend on data changed elsewhere.
import { $ } from "./lib.js";
import { t } from "./i18n.js";
import { state, path } from "./state.js";
import { loadCourseIndex, renderCourse } from "./courses.js";
import { renderInterview } from "./interview.js";
import { refreshLearning } from "./training.js";
import { renderHome } from "./home.js";

const ROUTES = {
  home: "Home", offers: "Offers", training: "Training", cv: "CV check", applications: "My applications", course: "Course",
  account: "Your account & data", legal: "Legal notice", privacy: "Privacy policy", interview: "Interview prep",
};
const NAV_OF = { course: "training" }; // which nav tab is highlighted for sub-pages
export const coursesReady = loadCourseIndex();

const routeOf = () => {
  const [, r = "home", param = null] = location.hash.match(/^#\/([a-z]*)(?:\/([a-z0-9-]+))?/) || [];
  return r in ROUTES ? { r: r || "home", param } : { r: "home", param: null };
};

export function showRoute(moveFocus) {
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
  if (r === "training" && path()) refreshLearning(); // lessons, quiz scores and XP may have changed on a course page
  if (r === "home" && path()) renderHome(); // streak
}

// The interview page depends on the path (role questions, courses) and the tracker (upcoming interviews).
export function refreshInterview() {
  if (routeOf().r === "interview" && path()) renderInterview({ path: path(), cards: state.cards });
}
