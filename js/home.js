// Home page (#/): greeting (time of day + first name when signed in), the summary cards for Offers, CV (its ATS score
// for the path and the fix worth the most points, or an invitation to get one; cvpage.js pathReport), Training (progress
// ring, streak) and Applications (only once something is tracked), then "Next actions" (follow-ups due, interviews this
// week, from tracker.js; hidden when nothing is due, 2026-11-23 shorter Home), led by the flashcards due for review today (srs.js → #/review). A follow-up of a sent
// application gets "Write the email" (letters.js). Last, the market
// pulse for the path (pulse.js). The path cards are drawn by app.js (renderPaths).
import { $, h } from "./lib.js";
import { t, tn } from "./i18n.js";
import { state, path } from "./state.js";
import { nextActions } from "./tracker.js";
import { openCardLetter } from "./letters.js";
import { openOfferCoach } from "./offercoach.js";
import { renderPulse } from "./pulse.js";
import { stepsOf, stepDone } from "./training.js";
import { progressRing } from "./icons.js";
import { streak } from "./activity.js";
import { dueCards } from "./srs.js";
import { pathReport } from "./cvpage.js";

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
  const all = state.tracks.flatMap(stepsOf), done = all.filter(stepDone).length;
  const next = all.find((s) => !stepDone(s));
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
  // CV: the score of the active CV for this path, with the biggest fix; before any CV, an invitation (nothing uploaded).
  const r = state.cv?.text?.trim() ? pathReport() : null;
  const fix = r?.checks.filter((c) => !c.ok && c.fix).sort((a, b) => (b.gain || 0) - (a.gain || 0))[0];
  const cvCard = r
    ? card(t("Your CV"), `${r.score}/100`, fix ? t("Next fix: {fix}", { fix: fix.fix }) : t("Scored for the {path} path.", { path: path()?.name || "" }),
      "#/cv", "Improve my CV", progressRing(r.score / 100))
    : card(t("CV score"), t("Your score in 30 s"), t("Out of 100, with the fixes that add the most points. Your CV stays on this device."),
      "#/cv", "Score my CV");
  cvCard.dataset.homeCv = r ? "score" : "invite";
  const tracked = state.cards.length > 0;
  $("#homeSummary").className = `grid grid-cols-[minmax(0,1fr)] gap-4 ${tracked ? "md:grid-cols-2 xl:grid-cols-4" : "md:grid-cols-3"}`;
  $("#homeSummary").replaceChildren(...[
    card(t("Offers"), path()?.name || t("Offers"),
      t("Live {title} offers by city and country.", { title: path()?.job_titles?.[0] || t("job") }), "#/offers", "Find offers"),
    cvCard,
    card(t("Training"), all.length ? t("{done}/{all} steps", { done, all: all.length }) : t("No tracks yet"),
      [next ? t("Next up: {title}", { title: next.title }) : all.length ? t("Every step is done. Time to apply!") : "",
        streak() ? `🔥 ${tn(streak(), "{n} day", "{n} days")}` : ""].filter(Boolean).join(" · "), "#/training", "Continue learning",
      all.length ? progressRing(done / all.length) : null),
    tracked ? card(t("Applications"), String(state.cards.length),
      [tn(count("applied"), "one|{n} applied", "{n} applied"), tn(count("interview"), "{n} interview", "{n} interviews"),
        tn(count("offer"), "{n} offer", "{n} offers")].join(" · "),
      "#/applications", "Open tracker") : null,
  ].filter(Boolean));
  // Follow-ups due and interviews this week; nothing at all when nothing is due (a shorter Home on phones).
  const actions = nextActions(state.cards).slice(0, 6), due = dueCards().length;
  const reviewItem = due ? h("li", { class: "flex flex-wrap items-baseline gap-2 rounded-xl px-3 py-2 -mx-3 hover:bg-[var(--soft)]", "data-review-due": "" },
    h("span", { style: "color:var(--accent-ink)" }, `🔁 ${tn(due, "{n} flashcard to review today", "{n} flashcards to review today")}`),
    h("span", { class: "mute" }, t("≈ {m} min", { m: Math.max(1, Math.round(Math.min(due, 20) / 3)) })),
    h("a", { href: "#/review", class: "underline text-xs", style: "color:var(--accent-ink)" }, t("Review now →"))) : null;
  const ICON = { overdue: ["⏰", "var(--bad)"], today: ["⏰", "var(--warn)"], soon: ["⏰", "var(--accent-ink)"], interview: ["📅", "var(--accent-ink)"], offer: ["💼", "var(--ok)"] };
  if (!actions.length && !reviewItem) { $("#homeActions").replaceChildren(); renderPulse(); return; }
  $("#homeActions").replaceChildren(h("div", { class: "panel" },
    h("span", { class: "eyebrow mb-3" }, t("Next actions")),
    h("ul", { class: "grid gap-1 text-sm" }, reviewItem, ...actions.map(({ c, kind, text }) => h("li", { class: "flex flex-wrap items-baseline gap-2 rounded-xl px-3 py-2 -mx-3 hover:bg-[var(--soft)]" },
        h("span", { style: `color:${ICON[kind][1]}` }, `${ICON[kind][0]} ${kind === "overdue" ? t("Overdue · ") : kind === "today" ? t("Today · ") : ""}${text}`),
        h("a", { href: "#/applications", class: "mute underline" }, [c.title, c.company].filter(Boolean).join(" · ")),
        kind === "offer" ? h("button", { type: "button", class: "underline text-xs", style: "color:var(--accent-ink)", onClick: () => openOfferCoach(c) }, t("Negotiate →"))
          : kind === "interview" ? h("a", { href: "#/interview", class: "underline text-xs", style: "color:var(--accent-ink)" }, t("Prepare →"))
          : c.stage !== "saved" ? h("button", { type: "button", class: "underline text-xs", style: "color:var(--accent-ink)", onClick: () => openCardLetter(c, "followup") }, t("Write the email →")) : null)))));
  renderPulse();
}
