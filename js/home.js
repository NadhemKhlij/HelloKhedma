// Home page (#/): greeting (time of day + first name when signed in), the summary cards for Training (progress ring, streak),
// Applications and Offers, then "Next actions" (follow-ups due, interviews this week, from tracker.js; an empty state
// when nothing is due). The path cards are drawn by app.js (renderPaths).
import { $, h } from "./lib.js";
import { t, tn } from "./i18n.js";
import { state, path } from "./state.js";
import { nextActions } from "./tracker.js";
import { stepsOf } from "./training.js";
import { progressRing } from "./icons.js";
import { streak } from "./activity.js";

// First name from the account: profile name if the provider gave one, else the start of the email address.
function firstName(user) {
  const m = user?.user_metadata || {};
  const raw = (m.full_name || m.name || "").split(/\s+/)[0] || (user?.email || "").split("@")[0].split(/[._+-]/)[0];
  return /^[\p{L}]{2,}$/u.test(raw) ? raw[0].toUpperCase() + raw.slice(1).toLowerCase() : "";
}
function renderGreeting() {
  const hr = new Date().getHours();
  const hello = hr < 5 || hr >= 18 ? t("Good evening") : hr < 12 ? t("Good morning") : t("Good afternoon");
  const name = firstName(state.user);
  $("#h-home").textContent = name ? `${hello}, ${name}` : hello;
}

export function renderHome() {
  renderGreeting();
  const all = state.tracks.flatMap(stepsOf), done = all.filter((s) => state.done.has(s.id)).length;
  const next = all.find((s) => !state.done.has(s.id));
  const count = (stage) => state.cards.filter((c) => c.stage === stage).length;
  // A whole-card link; the call to action looks like a small button.
  const card = (title, big, detail, href, cta, side) => h("a", { href, class: "panel flex flex-col gap-1 md:min-h-[168px]" },
    h("span", { class: "eyebrow" }, title),
    h("div", { class: "flex items-center justify-between gap-3 flex-1" },
      h("div", { class: "min-w-0" },
        h("b", { class: "block text-[1.75rem] leading-tight font-semibold tracking-tight truncate" }, big),
        h("p", { class: "mute text-sm mt-1 line-clamp-2" }, detail)),
      side),
    h("span", { class: "btn-ghost !py-1.5 self-start mt-2" }, `${t(cta)} →`));
  $("#homeSummary").replaceChildren(
    card(t("Training"), all.length ? t("{done}/{all} steps", { done, all: all.length }) : t("No tracks yet"),
      [next ? t("Next up: {title}", { title: next.title }) : all.length ? t("Every step is done. Time to apply!") : "",
        streak() ? `🔥 ${tn(streak(), "{n} day", "{n} days")}` : ""].filter(Boolean).join(" · "), "#/training", "Continue learning",
      all.length ? progressRing(done / all.length) : null),
    card(t("Applications"), String(state.cards.length),
      t("{applied} applied · {interview} interview · {offer} offer", { applied: count("applied"), interview: count("interview"), offer: count("offer") }),
      "#/applications", "Open tracker"),
    card(t("Offers"), path()?.name || t("Offers"),
      t("Live {title} offers by city and country.", { title: path()?.job_titles?.[0] || t("job") }), "#/offers", "Find offers"),
  );
  // Follow-ups due and interviews this week; an empty state otherwise, so the page keeps its shape.
  const actions = nextActions(state.cards).slice(0, 6);
  const ICON = { overdue: ["⏰", "#e0508b"], today: ["⏰", "#f08a24"], soon: ["⏰", "var(--accent)"], interview: ["📅", "var(--accent)"] };
  $("#homeActions").replaceChildren(h("div", { class: "panel" },
    h("span", { class: "eyebrow mb-3" }, t("Next actions")),
    actions.length
      ? h("ul", { class: "grid gap-1 text-sm" }, actions.map(({ c, kind, text }) => h("li", { class: "flex flex-wrap items-baseline gap-2 rounded-xl px-3 py-2 -mx-3 hover:bg-[var(--soft)]" },
        h("span", { style: `color:${ICON[kind][1]}` }, `${ICON[kind][0]} ${kind === "overdue" ? t("Overdue · ") : kind === "today" ? t("Today · ") : ""}${text}`),
        h("a", { href: "#/applications", class: "mute underline" }, [c.title, c.company].filter(Boolean).join(" · ")),
        kind === "interview" ? h("a", { href: "#/interview", class: "underline text-xs", style: "color:var(--accent)" }, t("Prepare →")) : null)))
      : h("div", { class: "flex flex-wrap items-end justify-between gap-3" },
        h("div", {},
          h("b", { class: "block text-2xl font-semibold leading-none mb-2", "aria-hidden": "true" }, "—"),
          h("p", { class: "mute text-sm" }, t("Nothing due. Follow-ups and interviews from your tracker show up here."))),
        h("a", { href: "#/applications", class: "btn-ghost" }, t("Add an application")))));
}
