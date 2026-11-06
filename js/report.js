// "⚑ Report a problem" (training step 1, 2026-11-06), at the bottom of every course page (courses.js) and project page
// (projects.js): what is wrong (lesson, exercise, quiz…), its number and a short message, sent with the course id and
// the interface language through report_content() (migration 20261106000100_learning_sync_reports.sql). No account
// id, no IP. If the database cannot take it (migration not run, offline), the user's email app opens instead, with
// the same text addressed to the contact address. The owner reads the reports in the content_reports_open view.
import { h, toast } from "./lib.js";
import { t, lang } from "./i18n.js";
import { sb, CONFIG } from "./supabase.js";

const PARTS = [["lesson", "Lesson"], ["exercise", "Exercise"], ["quiz", "Quiz question"], ["flashcard", "Flashcard"],
  ["interview", "Interview question"], ["cheatsheet", "Cheat sheet"], ["project", "Project"], ["other", "Something else"]];

// courseId: course or project id. current(): { part, number } preselected from where the user is (number from 1).
export function reportBox(courseId, current = () => ({ part: "other", number: null })) {
  const part = h("select", { class: "input !py-1", "aria-label": t("What is wrong?") }, PARTS.map(([v, label]) => h("option", { value: v }, t(label))));
  const num = h("input", { class: "input !py-1 w-24", type: "number", min: "1", max: "999", placeholder: "#", "aria-label": t("Number") });
  const msg = h("textarea", { class: "input w-full text-sm", rows: "3", maxlength: "1000",
    placeholder: t("What is wrong or unclear? (no personal information, please)") });
  const send = h("button", { type: "button", class: "btn !py-1" }, t("Send"));
  const box = h("details", { class: "panel text-sm", "data-print-hide": "", "data-report": true },
    h("summary", { class: "cursor-pointer mute" }, t("⚑ Report a problem in this content")),
    h("div", { class: "grid gap-2 mt-3" },
      h("p", { class: "mute text-xs" }, t("The courses were written with AI help: your reports get mistakes fixed. Sent without your account or IP address.")),
      h("div", { class: "flex flex-wrap items-center gap-2" }, part, num), msg, h("div", { class: "flex gap-2" }, send)));
  box.addEventListener("toggle", () => {
    if (!box.open) return;
    const c = current();
    part.value = c.part || "other";
    num.value = c.number ?? "";
  });
  send.addEventListener("click", async () => {
    const text = msg.value.trim();
    if (text.length < 3) { msg.focus(); return; }
    send.disabled = true;
    const n = Number(num.value) || null;
    const args = { p_course: courseId, p_part: part.value, p_position: n ? n - 1 : null, p_lang: lang, p_message: text };
    let ok = false;
    try { const { data, error } = sb ? await sb.rpc("report_content", args) : { error: true }; ok = !error && data === true; } catch { ok = false; }
    if (ok) {
      toast(t("Thank you! The problem was reported."));
      msg.value = ""; box.open = false;
    } else if (CONFIG.CONTACT_EMAIL) {
      const subject = `HelloKhedma: ${courseId} · ${part.value}${n ? ` #${n}` : ""}`;
      location.href = `mailto:${CONFIG.CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`;
    } else toast(t("Could not send the report. Try again later."));
    send.disabled = false;
  });
  return box;
}
