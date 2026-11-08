// E-mail reminders (ROADMAP 2.2), the switch on the Account page (#remindersPanel). Signed-in users only (a guest has
// no e-mail address here). Off by default; turned on, the follow-up-reminders Edge Function sends one e-mail on the
// days a follow-up is due or an interview is coming (profiles.email_reminders, reminders_lang = interface language).
// "Send me a test e-mail now" asks the function for today's digest at once (one a day). Before the migration
// 20261108000100 is run, the panel says the feature is not available yet. Privacy policy: e-mail reminders (Resend).
import { h, toast } from "./lib.js";
import { t, lang } from "./i18n.js";
import { sb } from "./supabase.js";
import { state } from "./state.js";

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
  root.replaceChildren(head, what,
    h("p", { class: "text-sm font-medium" }, on ? t("✓ On: e-mails go to {email}, around 7:00 (Paris time).", { email: u.email }) : t("Off (off by default).")),
    on ? null : h("p", { class: "mute text-xs" }, t("The e-mail contains the job titles, companies, next actions and dates of those applications. It is sent through our e-mail provider (Resend) and nothing else is shared. Turn it off at any time.")),
    h("div", { class: "flex flex-wrap gap-2" }, on
      ? [h("button", { type: "button", class: "btn-ghost", onClick: (e) => test(e.currentTarget) }, t("Send me a test e-mail now")),
        h("button", { type: "button", class: "btn-ghost", onClick: (e) => set(false, e.currentTarget) }, t("Stop e-mail reminders"))]
      : h("button", { type: "button", class: "btn", onClick: (e) => set(true, e.currentTarget) }, t("E-mail me my follow-ups"))));
}
