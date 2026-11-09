// E-mail reminders (ROADMAP 2.2), the switch on the Account page (#remindersPanel). Signed-in users only (a guest has
// no e-mail address here). Off by default; turned on, the follow-up-reminders Edge Function sends one e-mail on the
// days a follow-up is due or an interview is coming (profiles.email_reminders, reminders_lang = interface language).
// "Send me a test e-mail now" asks the function for today's digest at once (one a day). Below: the offer alerts of the
// account (alerts.js; turned on with 🔔 on a saved search) and "Send me today's offers now" (search-alerts, once a day). Before the migration
// 20261108000100 is run, the panel says the feature is not available yet. Privacy policy: e-mail reminders (Resend).
import { h, toast } from "./lib.js";
import { t, lang } from "./i18n.js";
import { sb } from "./supabase.js";
import { state } from "./state.js";
import { loadAlerts, testAlerts } from "./alerts.js";

const LANG = lang === "fr" ? "fr" : "en";

export async function renderReminders(root) {
  const u = state.user;
  const head = h("h2", { class: "!mb-0" }, t("E-mail reminders"));
  const what = h("p", { class: "text-sm" }, t("One e-mail on the days something is due in your tracker: the follow-ups to send and the interviews in the next 36 hours. Nothing on the other days."));
  if (!u) { root.replaceChildren(head, what, h("p", { class: "mute text-sm" }, t("Sign in to get them: they go to your account's e-mail address. As a guest, follow-ups show on Home."))); return; }
  root.replaceChildren(head, what, h("p", { class: "mute text-sm" }, t("Loading…")));
  const { data, error } = await sb.from("profiles").select("email_reminders, reminders_lang").maybeSingle();
  if (error) { root.replaceChildren(head, what, h("p", { class: "mute text-sm" }, t("E-mail reminders are not available yet."))); return; }
  const on = Boolean(data?.email_reminders);
  if (on && data.reminders_lang !== LANG) sb.from("profiles").update({ reminders_lang: LANG }).eq("user_id", u.id).then(() => {}); // e-mails follow the interface language
  const set = async (value, btn) => {
    btn.disabled = true;
    const { error: e } = await sb.from("profiles").upsert({ user_id: u.id, email_reminders: value, reminders_lang: LANG });
    if (e) { toast(t("Could not change the setting. Try again.")); btn.disabled = false; return; }
    toast(value ? t("E-mail reminders are on.") : t("E-mail reminders are off."));
    renderReminders(root);
  };
  const test = async (btn) => {
    btn.disabled = true;
    const { data: r, error: e } = await sb.functions.invoke("follow-up-reminders", { body: { test: true } });
    let msg = r?.sent ? t("Test e-mail sent to {email}. Check your inbox (and the spam folder).", { email: u.email }) : r?.reason || "";
    if (e) { try { msg = (await e.context.json()).error || e.message; } catch { msg = e.message; } }
    toast(msg || t("Nothing is due today: no e-mail would be sent."));
    btn.disabled = false;
  };
  root.replaceChildren(...[head, what,
    h("p", { class: "text-sm font-medium" }, on ? t("✓ On: e-mails go to {email}, around 7:00 (Paris time).", { email: u.email }) : t("Off (off by default).")),
    on ? null : h("p", { class: "mute text-xs" }, t("The e-mail contains the job titles, companies, next actions and dates of those applications. It is sent through our e-mail provider (Resend) and nothing else is shared. Turn it off at any time.")),
    h("div", { class: "flex flex-wrap gap-2" }, on
      ? [h("button", { type: "button", class: "btn-ghost", onClick: (e) => test(e.currentTarget) }, t("Send me a test e-mail now")),
        h("button", { type: "button", class: "btn-ghost", onClick: (e) => set(false, e.currentTarget) }, t("Stop e-mail reminders"))]
      : h("button", { type: "button", class: "btn", onClick: (e) => set(true, e.currentTarget) }, t("E-mail me my follow-ups"))),
    alertsBlock()].filter(Boolean)); // replaceChildren would write "null" for the missing note
}

// Offer alerts of this account: their searches, and a test e-mail. Filled once the alerts are loaded.
function alertsBlock() {
  const box = h("div", { class: "grid gap-2 rounded-lg p-3 text-sm mt-1", style: "background:var(--bg);border:1px solid var(--line)" });
  loadAlerts().then((list) => {
    if (list === null) { box.remove(); return; } // the table is not there yet (migration 20261109000500)
    box.replaceChildren(
      h("p", { class: "font-medium" }, t("Offer alerts")),
      list.length
        ? h("ul", { class: "grid gap-1" }, list.map((a) => h("li", {}, `🔔 ${a.label}`)))
        : h("p", { class: "mute" }, t("None yet. On the Offers page, save a search and press 🔕 next to it: the new offers of that search are e-mailed to you each morning.")),
      list.length ? h("div", { class: "flex" }, h("button", { type: "button", class: "btn-ghost", onClick: async (e) => { e.currentTarget.disabled = true; await testAlerts(); } },
        t("Send me today's offers now"))) : null);
  });
  return box;
}
