// "Help improve HelloKhedma" (opt-in, guests and signed-in users; owner decision 2026-11-06): anonymous statistics.
// Nothing is sent until the user says yes ("hk.insights" = "yes" | "no"; asked once under a CV check, changeable on the
// Account page). What is sent, through the log_insight() database function (migration 20261106000000_cv_sync_insights):
//   - "offer_skills": the skill names an offer pasted on the CV page asks for, with the career path id;
//   - "gaps": the skill names that offer (or the path keywords) asks for and the CV lacks;
//   - "course_done": the id of a HelloKhedma course the user just finished.
// Never the CV text, the offer text, an account id or an IP address (the function stores the day only). Failures are
// silent: statistics must never get in the way. Imports only lib, i18n and supabase (no import cycles).
import { h, ls } from "./lib.js";
import { t } from "./i18n.js";
import { sb } from "./supabase.js";

const KEY = "hk.insights";
export const insightsChoice = () => ls.get(KEY); // "yes" | "no" | null (not asked yet)
export function setInsights(yes) {
  ls.set(KEY, yes ? "yes" : "no");
  window.dispatchEvent(new CustomEvent("hk:insights"));
}

const sent = new Set(); // the same event is counted once per visit (pressing "Calculate" twice is not two offers)
export function logInsight(kind, pathId, items) {
  const list = [...new Set((items || []).map(String).filter(Boolean))].slice(0, 40);
  if (insightsChoice() !== "yes" || !sb || !list.length) return;
  const key = `${kind}|${pathId}|${[...list].sort().join(",")}`;
  if (sent.has(key)) return;
  sent.add(key);
  sb.rpc("log_insight", { p_kind: kind, p_path: pathId || null, p_items: list }).then(() => {}, () => {});
}

// The one-time question, shown under a CV check result. Returns null once answered.
export function insightsAsk() {
  if (insightsChoice()) return null;
  const box = h("div", { class: "rounded-xl p-3 mt-3 grid gap-2 text-sm", style: "border:1px dashed var(--line)", "data-insights-ask": true },
    h("p", {}, h("b", {}, t("Help improve HelloKhedma?")), " ",
      t("Share anonymous statistics: the skills offers ask for, the ones CVs lack, and the courses you finish. Never your CV, the offer text, your account or your IP address. You can change your mind on the Account page.")),
    h("div", { class: "flex flex-wrap gap-2" },
      h("button", { type: "button", class: "btn !py-1", onClick: () => { setInsights(true); box.replaceChildren(h("p", { class: "mute" }, t("Thank you! Anonymous statistics are on."))); } },
        t("Yes, share anonymously")),
      h("button", { type: "button", class: "btn-ghost !py-1", onClick: () => { setInsights(false); box.remove(); } }, t("No thanks"))));
  return box;
}
