// "See an example score" (2026-11-23, owner: show the CV score at the start of the visit): a made-up junior CV for the
// selected path, scored on the spot with the same ATS check as a real CV (atsscore.js), so a visitor sees what the
// score and its fixes look like before trusting the tool with their own CV. Nothing is saved or sent anywhere.
// The sample is built from the path's first job title and about half of its keywords, with a few lines that lack a
// number or an action verb, so the example shows a middling score with real fixes. English or French with the interface.
// exampleBox(): a button that unfolds the compact report under it (guide step 2 on Home, empty CV page).
import { h } from "./lib.js";
import { t, lang } from "./i18n.js";
import { path, byKind } from "./state.js";
import { extractSkills } from "./ats.js";
import { atsReport, atsView } from "./atsscore.js";

export function sampleCv() {
  const p = path(), title = p?.job_titles?.[0] || p?.name || "Analyst";
  const keys = extractSkills(byKind("keyword").map((k) => k.title).join(" ; ")).map((s) => s.name);
  const have = keys.filter((_, i) => i % 2 === 0).slice(0, 8), more = have.slice(0, 3).join(", ") || "Excel";
  return lang === "fr" ? [
    "Camille Martin", `${title} junior`, "camille.martin@example.com · 06 00 00 00 00 · Lyon", "",
    "Profil", `${title} junior, curieuse et rigoureuse, à la recherche d’un premier poste en CDI.`, "",
    "Compétences", have.join(", "), "",
    "Expérience", `${title} (alternance) · Northwind (entreprise fictive) · 2024 – 2025`,
    `- Construit un suivi hebdomadaire avec ${more} pour l’équipe, en réduisant de 30 % le temps de préparation.`,
    "- Participation aux réunions d’équipe et aux tâches quotidiennes.", "- Aide sur différents projets internes.", "",
    "Formation", "Master, Université Lyon 2 · 2025",
  ].join("\n") : [
    "Alex Martin", `Junior ${title}`, "alex.martin@example.com · +33 6 00 00 00 00 · Lyon", "",
    "Summary", `Junior ${title}, curious and reliable, looking for a first permanent role.`, "",
    "Skills", have.join(", "), "",
    "Experience", `${title} (work-study) · Northwind (a made-up company) · 2024 – 2025`,
    `- Built a weekly tracking report with ${more} for the team, cutting preparation time by 30%.`,
    "- Responsible for team meetings and daily tasks.", "- Helped on various internal projects.", "",
    "Education", "Master's degree, Université Lyon 2 · 2025",
  ].join("\n");
}

export function exampleBox() {
  const out = h("div", { class: "grid gap-3", "aria-live": "polite" });
  const btn = h("button", { type: "button", class: "btn-ghost", "aria-expanded": "false", onClick: () => {
    const open = btn.getAttribute("aria-expanded") === "true";
    btn.setAttribute("aria-expanded", String(!open));
    if (open) { out.replaceChildren(); return; }
    const p = path(), keys = extractSkills(byKind("keyword").map((k) => k.title).join(" ; ")).map((s) => s.name);
    const text = sampleCv();
    const r = atsReport(text, { required: keys, jobTitles: p?.job_titles || [], source: "path" });
    out.replaceChildren(h("div", { class: "rounded-xl p-4 grid gap-3", style: "background:var(--soft)", "data-cv-example": "" },
      h("p", { class: "text-sm" }, h("b", {}, t("Example: a made-up junior CV")), " ",
        h("span", { class: "mute" }, t("scored for the {path} path. Your own CV gets the same check, and stays on this device.", { path: p?.name || "" }))),
      atsView(r, { compact: true }),
      h("details", {}, h("summary", { class: "cursor-pointer text-sm", style: "color:var(--accent-ink)" }, t("Show the example CV")),
        h("pre", { class: "text-xs whitespace-pre-wrap mt-2", tabindex: "0" }, text))));
  } }, t("See an example score"));
  return h("div", { class: "grid gap-3" }, h("div", { class: "flex flex-wrap gap-2" }, btn), out);
}
