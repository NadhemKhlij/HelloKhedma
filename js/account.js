// Account & data page (#/account) and the sign-in status (top bar, Home): GDPR access, portability and erasure.
// - Export: every "hk.*" localStorage entry of this device, plus the account's rows when signed in (JSON file).
// - Delete: signed in → delete-account Edge Function, then sign out; in every case all "hk.*" entries are cleared.
import { $, h, ls, toast } from "./lib.js";
import { t } from "./i18n.js";
import { sb } from "./supabase.js";
import { state, fail } from "./state.js";

export function renderStatus() {
  const u = state.user;
  $("#status").textContent = u ? t("Synced · {email}", { email: u.email }) : t("Guest mode · saved on this device");
  $("#authOpen").hidden = Boolean(u);
  $("#accountLink").hidden = !u;
  $("#signOut").hidden = !u;
  $("#accountWho").textContent = u
    ? t("Signed in as {email}. Your applications, training progress and path are synced to your account; your CV stays on this device.", { email: u.email })
    : t("You are using HelloKhedma as a guest: everything is stored in this browser only, nothing on our servers.");
  $("#deleteInfo").textContent = u
    ? t("Permanently deletes your account and everything linked to it (applications, progress, profile), then clears this browser. This cannot be undone.")
    : t("Clears every HelloKhedma data from this browser: applications, progress, CV text and settings. This cannot be undone.");
  $("#deleteData").textContent = u ? t("Delete my account") : t("Delete data on this device");
}

const localData = () => Object.fromEntries(
  Object.keys(localStorage).filter((k) => k.startsWith("hk.")).map((k) => [k, ls.get(k)]));
const clearLocalData = () => Object.keys(localStorage).filter((k) => k.startsWith("hk.")).forEach((k) => ls.del(k));

async function onExport() {
  const out = { exported_at: new Date().toISOString(), app: "HelloKhedma", this_device: localData() };
  if (state.user) {
    const [profile, applications, progress] = await Promise.all([
      sb.from("profiles").select("*"), sb.from("applications").select("*"), sb.from("step_progress").select("*")]);
    const err = profile.error || applications.error || progress.error;
    if (err) { fail(err); return; }
    out.account = { email: state.user.email, created_at: state.user.created_at,
      profile: profile.data, applications: applications.data, training_progress: progress.data };
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
  $("#exportData").addEventListener("click", () => onExport().catch(fail));
  $("#deleteData").addEventListener("click", onDelete);
}
