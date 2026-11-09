// Offer alerts (ROADMAP 3.2, 2026-11-09): "🔔" on each saved search (Offers page, offers.js renderSavedSearches).
// Signed-in users only: turning it on saves that search to the account (table search_alerts, migration
// 20261109000500: label, { query, alt, path, location, country }, e-mail language) after a notice shown once
// ("hk.alertsOk"); every morning the search-alerts Edge Function e-mails the new offers. At most 3 per account (the
// database refuses a 4th). Turning it off deletes the row. Alerts made on another device show up as saved searches here.
//   loadAlerts()        state.alerts = the user's alerts ([] for a guest, null when the table is missing), once per user
//   alertOf(s)          the alert of a saved search, if any (same title, place and country)
//   toggleAlert(s)      on / off; resolves true when something changed
//   testAlerts()        "Send me today's offers now" (Account page, reminders.js), once a day
// Privacy policy (FR + EN): offer alerts.
import { ls, toast } from "./lib.js";
import { t, lang } from "./i18n.js";
import { sb } from "./supabase.js";
import { state } from "./state.js";

const OK_KEY = "hk.alertsOk", MAX = 3;
const norm = (x) => String(x || "").trim().toLowerCase();
const same = (a, s) => norm(a.params?.query) === norm(s.query) && norm(a.params?.location) === norm(s.location) && norm(a.params?.country) === norm(s.country);
export const alertLabel = (s) => [s.query, s.location, String(s.country || "").toUpperCase()].filter(Boolean).join(" · ");

let loadedFor = undefined, loading = null;
export function loadAlerts() {
  const id = state.user?.id || null;
  if (loading && loadedFor === id) return loading;
  if (loadedFor === id && state.alerts !== undefined) return Promise.resolve(state.alerts);
  loadedFor = id;
  if (!id || !sb) { state.alerts = []; return Promise.resolve(state.alerts); }
  loading = sb.from("search_alerts").select("id, label, params, lang, last_sent_on").order("created_at")
    .then(({ data, error }) => { state.alerts = error ? null : data || []; loading = null; return state.alerts; });
  return loading;
}
export const alertOf = (s) => (state.alerts || []).find((a) => same(a, s)) || null;

export async function toggleAlert(s) {
  if (!state.user) { toast(t("Sign in to get the new offers of this search by e-mail each morning.")); document.querySelector("#authOpen")?.click(); return false; }
  if (state.alerts === null) { toast(t("Offer alerts are not available yet.")); return false; }
  const on = alertOf(s);
  if (on) {
    const { error } = await sb.from("search_alerts").delete().eq("id", on.id);
    if (error) { toast(t("Could not change the setting. Try again.")); return false; }
    state.alerts = state.alerts.filter((a) => a.id !== on.id);
    toast(t("Alert off: no more e-mails for this search."));
    return true;
  }
  if (state.alerts.length >= MAX) { toast(t("At most {n} alerts: turn one off first.", { n: MAX })); return false; }
  if (!ls.get(OK_KEY)) {
    const ok = confirm(t("Each morning HelloKhedma will run this search for you and e-mail the new offers to {email}. The search (job title, place, country) is saved to your account; the e-mail goes through our e-mail provider (Resend). At most {n} alerts. Turn it off here at any time.", { email: state.user.email, n: MAX }));
    if (!ok) return false;
    ls.set(OK_KEY, "1");
  }
  const params = { query: s.query, alt: s.alt || "", path: s.path || state.pathId || "", location: s.location || "", country: s.country || "fr" };
  const { data, error } = await sb.from("search_alerts").insert({ label: alertLabel(s).slice(0, 200), params, lang: lang === "fr" ? "fr" : "en" })
    .select("id, label, params, lang, last_sent_on").single();
  if (error) { toast(/3 offer alerts/.test(error.message) ? t("At most {n} alerts: turn one off first.", { n: MAX }) : t("Could not change the setting. Try again.")); return false; }
  state.alerts = [...state.alerts, data];
  toast(t("Alert on: the new offers of this search will be e-mailed to you each morning."));
  return true;
}

export async function testAlerts() {
  const { data: r, error: e } = await sb.functions.invoke("search-alerts", { body: { test: true } });
  let msg = r?.sent ? t("E-mail sent to {email}. Check your inbox (and the spam folder).", { email: state.user?.email || "" }) : r?.reason || "";
  if (e) { try { msg = (await e.context.json()).error || e.message; } catch { msg = e.message; } }
  toast(msg || t("No offers found for your alerts today."));
}
