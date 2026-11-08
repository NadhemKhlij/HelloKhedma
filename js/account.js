// Account & data page (#/account) and the sign-in status (top bar, Home): GDPR access, portability and erasure.
// - Export: every "hk.*" localStorage entry of this device, plus the account's rows when signed in (JSON file).
// - Delete: signed in → delete-account Edge Function, then sign out; in every case all "hk.*" entries are cleared.
// - Opt-in choices: "Save my CVs to my account" (cvsync.js, signed-in users, notice before turning it on) and
//   "Help improve HelloKhedma" (insights.js, anonymous statistics). Both are off until the user turns them on.
// - "Change password" (signed in; auth.js openPasswordDialog).
// - "Admin: site statistics" link (#/admin, admin.js), shown only when is_admin() says so.
import { $, h, ls, toast } from "./lib.js";
import { t } from "./i18n.js";
import { sb } from "./supabase.js";
import { state, fail } from "./state.js";
import { cvSyncOn, setCvSync, cvSyncExport } from "./cvsync.js";
import { insightsChoice, setInsights } from "./insights.js";
import { learnSyncExport } from "./learnsync.js";
import { checkAdmin, renderAdmin } from "./admin.js";
import { openPasswordDialog } from "./auth.js";

export function renderStatus() {
  const u = state.user;
  $("#status").textContent = u ? t("Synced · {email}", { email: u.email }) : t("Guest mode · saved on this device");
  $("#authOpen").hidden = Boolean(u);
  $("#accountLink").hidden = !u;
  $("#signOut").hidden = !u;
  $("#changePassword").hidden = !u;
  $("#accountWho").textContent = u
    ? t("Signed in as {email}. Your applications, path and learning progress (lessons, quizzes, projects, interview prep) are synced to your account.", { email: u.email })
    : t("You are using HelloKhedma as a guest: everything is stored in this browser only, nothing on our servers.");
  $("#deleteInfo").textContent = u
    ? t("Permanently deletes your account and everything linked to it (applications, progress, profile, CVs saved to the account), then clears this browser. This cannot be undone.")
    : t("Clears every HelloKhedma data from this browser: applications, progress, CV text and settings. This cannot be undone.");
  $("#deleteData").textContent = u ? t("Delete my account") : t("Delete data on this device");
  $("#adminLink").hidden = true;
  if (u) checkAdmin().then((yes) => { $("#adminLink").hidden = !yes; }); // the Admin link, for admins only
  if (location.hash.startsWith("#/admin")) renderAdmin(); // signed in or out while on the admin page
  renderChoices();
}

// The two opt-in switches (both off until the user turns them on).
function renderChoices() {
  const u = state.user, on = cvSyncOn();
  const panel = $("#cvSyncPanel"), notice = h("div", { class: "grid gap-2" });
  const turnOn = async (btn) => {
    btn.disabled = true;
    const r = await setCvSync(true);
    if (!r.ok) { toast(t("Saving CVs to the account is not available yet. Your CVs stay on this device.")); btn.disabled = false; return; }
    toast(t("Your CVs are now saved to your account."));
  };
  const ask = () => notice.replaceChildren(h("div", { class: "rounded-lg p-3 text-sm grid gap-2", style: "background:var(--bg);border:1px solid var(--accent)" },
    h("p", {}, t("Your CV versions and your CV maker draft will be stored in your HelloKhedma account (Supabase), readable only by you, so you find them on every device where you sign in. Turn it off at any time: the copy in your account is then deleted, and this device keeps its CVs.")),
    h("div", { class: "flex flex-wrap gap-2" },
      h("button", { type: "button", class: "btn", onClick: (e) => turnOn(e.currentTarget) }, t("Turn on")),
      h("button", { type: "button", class: "btn-ghost", onClick: () => notice.replaceChildren() }, t("Cancel")))));
  const turnOff = async () => {
    if (!confirm(t("Stop saving your CVs to your account? The copy in your account is deleted; this device keeps its CVs."))) return;
    const r = await setCvSync(false);
    toast(r.ok ? t("Your CVs are no longer saved to your account.") : t("Could not change the setting. Try again."));
  };
  panel.replaceChildren(h("h2", { class: "!mb-0" }, t("Your CVs")),
    h("p", { class: "text-sm" }, !u ? t("Your CVs are saved in this browser only. Sign in to keep them in your account and find them on all your devices.")
      : on ? t("✓ Your CVs are saved to your account and synced on every device where you sign in.")
      : t("Your CVs are saved on this device only (off by default). Save them to your account to find them on your phone, the installed app and your computer.")),
    u ? h("div", { class: "flex flex-wrap gap-2" }, on
      ? h("button", { type: "button", class: "btn-ghost", onClick: turnOff }, t("Stop saving my CVs to my account"))
      : h("button", { type: "button", class: "btn", onClick: ask }, t("Save my CVs to my account"))) : null,
    notice);

  const yes = insightsChoice() === "yes";
  $("#insightsPanel").replaceChildren(h("h2", { class: "!mb-0" }, t("Help improve HelloKhedma")),
    h("p", { class: "text-sm" }, t("Anonymous statistics: the skills offers ask for, the ones CVs lack, and the courses you finish. Never your CV, the offer text, your account or your IP address.")),
    h("p", { class: "text-sm font-medium" }, yes ? t("✓ You share anonymous statistics. Thank you!") : t("You do not share statistics (off by default).")),
    h("div", { class: "flex flex-wrap gap-2" }, yes
      ? h("button", { type: "button", class: "btn-ghost", onClick: () => setInsights(false) }, t("Stop sharing"))
      : h("button", { type: "button", class: "btn", onClick: () => setInsights(true) }, t("Share anonymous statistics"))));
}

// ls.keys(): this build's "hk.*" entries only (a preview build keeps its own, see lib.js).
const localData = () => Object.fromEntries(ls.keys().map((k) => [k, ls.get(k)]));
const clearLocalData = () => ls.keys().forEach((k) => ls.del(k));

async function onExport() {
  const out = { exported_at: new Date().toISOString(), app: "HelloKhedma", this_device: localData() };
  if (state.user) {
    const [profile, applications, progress] = await Promise.all([
      sb.from("profiles").select("*"), sb.from("applications").select("*"), sb.from("step_progress").select("*")]);
    const err = profile.error || applications.error || progress.error;
    if (err) { fail(err); return; }
    out.account = { email: state.user.email, created_at: state.user.created_at,
      profile: profile.data, applications: applications.data, training_progress: progress.data,
      cvs_saved_to_account: await cvSyncExport(), learning_progress: await learnSyncExport() };
  }
  const blob = new Blob([JSON.stringify(out, null, 2)], { type: "application/json" });
  const a = h("a", { href: URL.createObjectURL(blob), download: `hellokhedma-data-${new Date().toISOString().slice(0, 10)}.json` });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

async function onDelete() {
  const signedIn = Boolean(state.user);
  const ok = confirm(signedIn
    ? t("Delete your HelloKhedma account and all its data permanently?")
    : t("Delete all HelloKhedma data stored in this browser?"));
  if (!ok) return;
  const btn = $("#deleteData");
  btn.disabled = true;
  try {
    if (signedIn) {
      const { error } = await sb.functions.invoke("delete-account", { body: {} });
      if (error) {
        let msg = error.message;
        try { msg = (await error.context.json()).error || msg; } catch { /* keep message */ }
        throw new Error(t("Could not delete the account: {msg}", { msg }));
      }
      await sb.auth.signOut().catch(() => {}); // the session belongs to a deleted user
    }
    clearLocalData();
    toast(signedIn ? t("Your account and data were deleted.") : t("Data on this device was deleted."));
    setTimeout(() => { location.hash = "#/"; location.reload(); }, 1200);
  } catch (e) { fail(e); btn.disabled = false; }
}

export function initAccount() {
  window.addEventListener("hk:cvsync", renderChoices);
  window.addEventListener("hk:insights", renderChoices);
  $("#exportData").addEventListener("click", () => onExport().catch(fail));
  $("#deleteData").addEventListener("click", onDelete);
  $("#changePassword").addEventListener("click", () => openPasswordDialog());
}
