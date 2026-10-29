// Home page (#/): "Next actions" (follow-ups due, interviews this week, from tracker.js) and the summary cards
// for Training, Applications and Offers. The path cards are drawn by app.js (renderPaths).
import { $, h } from "./lib.js";
import { t } from "./i18n.js";
import { state, path } from "./state.js";
import { nextActions } from "./tracker.js";
import { stepsOf } from "./training.js";

export function renderHome() {
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
