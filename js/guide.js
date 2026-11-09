// Guided first visit (2026-11-09): three steps for a newcomer, at the top of Home: 1. choose your role (path buttons),
// 2. add your CV (upload / paste on #/cv, or build one in the CV maker), 3. find your first offers (#/offers). Each step
// ticks itself off from what the visitor actually did; "Skip the guide" hides it for good. While it is on, #/cv and
// #/offers show a one-line reminder of the current step (#guideBar) with a way back to Home. Home's two shortcut buttons
// (#homeQuick) are hidden until the three steps are done.
// Who sees it: decided once, at the first start-up of this browser (initGuide): someone with nothing saved yet (no path
// chosen, CV, application, lesson, search or saved search). Anyone who already used the site never sees it. A signed-in account that already has
// applications skips it too (guideSeenOnAccount, app.js onUser).
// Stored in this browser only: "hk.guide" = "on" | "done" | "skip", "hk.guide.path" = "1" once a role is chosen.
// Progress: the path is chosen with selectPath (app.js) through a guide button or the path cards / top-bar select
// (markPathChosen); the CV step is done when a CV version has text (cvs.js "hk.cvs"); the offers step when a job search
// ran ("hk.searchRuns", offers.js). Redrawn when those keys change (lib.js onStore) and on every route change.
import { $, h, ls, onStore } from "./lib.js";
import { t } from "./i18n.js";
import { state, path } from "./state.js";
import { loadCvs } from "./cvs.js";

const KEY = "hk.guide", PATH_DONE = "hk.guide.path";
let pickPath = () => {};

const on = () => ls.get(KEY) === "on";
const hasCv = () => loadCvs().some((c) => (c.text || "").trim());
const searched = () => { try { return Object.keys(JSON.parse(ls.get("hk.searchRuns") || "{}")).length > 0; } catch { return false; } };
const steps = () => [Boolean(ls.get(PATH_DONE)), hasCv(), searched()];

export function initGuide({ selectPath }) {
  pickPath = selectPath;
  if (ls.get(KEY) == null) {
    const used = ["hk.path", "hk.cvs", "hk.cv.text", "hk.applications.v1", "hk.activity", "hk.lessons", "hk.searchRuns", "hk.savedSearches"];
    const newcomer = used.every((k) => ls.get(k) == null);
    ls.set(KEY, newcomer ? "on" : "skip");
  }
  onStore((k) => { if ([KEY, PATH_DONE, "hk.path", "hk.cvs", "hk.searchRuns"].includes(k)) renderGuide(); });
  window.addEventListener("hashchange", renderGuideBar);
  renderGuide();
}
export function markPathChosen() { if (on() && !ls.get(PATH_DONE)) ls.set(PATH_DONE, "1"); }
// Signed in with applications already on the account: an existing user on a new device.
export function guideSeenOnAccount() { if (on()) ls.set(KEY, "skip"); }

function close(value) { ls.set(KEY, value); }

export function renderGuide() {
  renderGuideBar();
  const root = $("#homeGuide");
  if (!root) return;
  const quick = $("#homeQuick"); // the two Home shortcuts would compete with the guide's own buttons
  if (!on()) { root.replaceChildren(); if (quick) quick.hidden = false; return; }
  const done = steps(), n = done.filter(Boolean).length, cur = done.indexOf(false), p = path();
  if (quick) quick.hidden = n < 3;
  const title = p?.job_titles?.[0] || p?.name || "";
  const mark = (i) => h("span", { class: "w-7 h-7 shrink-0 rounded-full grid place-items-center text-xs font-semibold", "aria-hidden": "true",
    style: done[i] ? "background:var(--ok-fill);color:#fff" : i === cur ? "background:var(--accent-fill);color:#fff" : "background:var(--soft)" }, done[i] ? "✓" : String(i + 1));
  const step = (i, name, doneText, body) => h("li", { class: "flex gap-3", "aria-current": i === cur ? "step" : null },
    mark(i),
    h("div", { class: "grid gap-2 min-w-0 flex-1" },
      h("p", { class: "font-semibold" }, name,
        h("span", { class: "sr-only" }, done[i] ? t(" (done)") : ""),
        done[i] && doneText ? h("span", { class: "mute font-normal" }, ` · ${doneText}`) : null),
      i === cur ? body : null));
  const cv = loadCvs().find((c) => (c.text || "").trim());
  const list = h("ol", { class: "grid gap-4" },
    step(0, t("Choose your role"), p?.name,
      h("div", { class: "grid gap-2" },
        h("p", { class: "mute text-sm" }, t("Offers, courses, CV keywords and interview questions all follow it. You can change it at any time.")),
        h("div", { class: "flex flex-wrap gap-2" }, state.paths.map((x) => h("button", { type: "button", class: x.id === state.pathId ? "btn" : "btn-ghost",
          "aria-pressed": String(x.id === state.pathId), onClick: async () => { await pickPath(x.id); markPathChosen(); } }, x.name))))),
    step(1, t("Add your CV"), cv?.name,
      h("div", { class: "grid gap-2" },
        h("p", { class: "mute text-sm" }, t("You get its ATS score out of 100 at once, with the fixes that add the most points. It stays in this browser.")),
        h("div", { class: "flex flex-wrap gap-2" },
          h("a", { href: "#/cv", class: "btn" }, t("Upload or paste my CV")),
          h("a", { href: "#/cv/maker", class: "btn-ghost" }, t("I have no CV: build one"))))),
    step(2, t("Find your first offers"), null,
      h("div", { class: "grid gap-2" },
        h("p", { class: "mute text-sm" }, t("Live {title} offers from several job boards, each scored against your CV.", { title })),
        h("div", { class: "flex flex-wrap gap-2" }, h("a", { href: "#/offers", class: "btn" }, t("Search {title} offers", { title }))))));
  const finished = n === 3;
  root.replaceChildren(h("section", { class: "panel grid gap-4", "aria-labelledby": "guideTitle", style: "border-color:color-mix(in srgb, var(--accent) 45%, var(--line))" },
    h("div", { class: "flex flex-wrap items-baseline justify-between gap-2" },
      h("h2", { id: "guideTitle", class: "!mb-0" }, finished ? t("🎉 You're all set") : t("Get started in 3 steps")),
      h("span", { class: "mute text-sm" }, t("{n} of 3 done", { n }))),
    h("div", { class: "h-1.5 rounded-full", style: "background:var(--line)", role: "progressbar", "aria-label": t("Getting started"),
      "aria-valuemin": "0", "aria-valuemax": "3", "aria-valuenow": String(n) },
      h("div", { class: "h-1.5 rounded-full", style: `width:${Math.round((n / 3) * 100)}%;background:var(--accent)` })),
    finished
      ? h("div", { class: "grid gap-2 text-sm" },
          h("p", {}, t("Next, when you are ready:")),
          h("ul", { class: "grid gap-1.5 list-disc pl-5" },
            h("li", {}, t("Press “Track” on the offers you like: they go to your tracker, with follow-up reminders.")),
            h("li", {}, h("a", { href: "#/skillcheck", class: "underline", style: "color:var(--accent-ink)" }, t("Take the skill check")),
              t(": the courses you already master leave your study plan.")),
            state.user ? null : h("li", {}, t("Sign in to keep your tracker and progress on every device."))))
      : list,
    h("div", { class: "flex flex-wrap gap-2" },
      finished
        ? h("button", { type: "button", class: "btn", onClick: () => close("done") }, t("Close the guide"))
        : h("button", { type: "button", class: "btn-ghost !py-1 text-sm", onClick: () => close("skip") }, t("Skip the guide")))));
}

// One line on #/cv and #/offers while the guide is on and that page is the current step.
function renderGuideBar() {
  const bar = $("#guideBar");
  if (!bar) return;
  const route = (location.hash.match(/^#\/([a-z]+)/) || [])[1] || "";
  const done = steps(), cur = done.indexOf(false);
  const text = !on() ? null
    : route === "cv" && cur === 1 ? t("Step 2 of 3: upload your CV (PDF) or paste its text, then press “Save and score my CV”. No CV yet? Open the CV maker tab.")
    : route === "cv" && cur === 2 ? t("✓ Your CV is saved. Last step: find your first offers.")
    : route === "offers" && cur === 2 ? t("Step 3 of 3: choose a city (or leave it empty for the whole country) and press Search.")
    : route === "offers" && cur === -1 && done[2] ? t("✓ All three steps done. Press “Track” on the offers you like.")
    : null;
  bar.hidden = !text;
  if (!text) { bar.replaceChildren(); return; }
  bar.replaceChildren(h("div", { class: "panel !py-3 flex flex-wrap items-center justify-between gap-2 text-sm", role: "status",
    style: "border-color:color-mix(in srgb, var(--accent) 45%, var(--line))" },
    h("span", {}, text),
    route === "cv" && cur === 2 ? h("a", { href: "#/offers", class: "btn !py-1" }, t("Find offers →"))
      : h("a", { href: "#/", class: "underline", style: "color:var(--accent-ink)" }, t("Back to the guide"))));
}
