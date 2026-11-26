// Sign-in dialog (#authDialog): password sign-in, account creation, email magic link and "Forgot password?" (reset
// email), via Supabase Auth. #pwDialog sets a new password: opened by the reset link (PASSWORD_RECOVERY event: the
// link signs the user in, then asks for the new password) or by "Change password" on the Account page (openPasswordDialog).
// Email links redirect to this page (must be listed in Supabase → Auth → URL Configuration). onUser(user | null) is
// called on load (INITIAL_SESSION) and on every sign-in / sign-out; app.js then switches LocalStore ↔ CloudStore.
// Sign-out (audit 2026-11-23, section 4): "Sign out" asks for confirmation in #signOutDialog, with "Also delete my CVs and
// the app's data from this device" for shared computers (every "hk.*" key except language and theme, then a reload). A
// sign-out the user did not ask for (session ended elsewhere, refresh token refused, storage cleared) opens the sign-in
// dialog with "You were signed out…" instead of switching to guest mode silently. account.js calls leaving() before its
// own signOut (account deletion). "hk.accountUsed" remembers that an account was used on this device, so the tracker can
// tell a guest that their applications are in their account (applications.js); it never leaves the browser.
import { sb, EMAIL_LINK } from "./supabase.js";
import { $, toast, ls } from "./lib.js";

export const ACCOUNT_USED = "hk.accountUsed";
let signingOut = false; // set by our own sign-outs, so SIGNED_OUT is not reported as unexpected
export const leaving = () => { signingOut = true; };
const KEEP = new Set(["hk.lang", "hk.theme"]);
function wipeDevice() { ls.keys().filter((k) => !KEEP.has(k)).forEach((k) => ls.del(k)); }
import { t } from "./i18n.js";

// New password for the signed-in user (reset link, or Account page → Change password).
export function openPasswordDialog(recovery = false) {
  const dlg = $("#pwDialog");
  $("#pwForm").reset();
  $("#pwMsg").textContent = recovery ? t("Your reset link worked. Choose a new password to finish.") : "";
  $("#pwMsg").style.color = recovery ? "var(--ok)" : "var(--warn)";
  if (!dlg.open) dlg.showModal();
  $("#newPassword").focus();
}

function initPasswordDialog() {
  const dlg = $("#pwDialog"), msg = $("#pwMsg");
  $("#pwClose").onclick = () => dlg.close();
  $("#pwForm").onsubmit = async (ev) => {
    ev.preventDefault();
    const p1 = $("#newPassword").value, p2 = $("#newPassword2").value;
    msg.style.color = "var(--warn)";
    if (p1.length < 8) { msg.textContent = t("The password needs at least 8 characters."); return; }
    if (p1 !== p2) { msg.textContent = t("The two passwords are different."); return; }
    $("#pwSave").disabled = true;
    try {
      const { error } = await sb.auth.updateUser({ password: p1 });
      if (error) throw error;
      dlg.close();
      toast(t("Password changed."));
    } catch (e) { msg.textContent = e.message; }
    finally { $("#pwSave").disabled = false; }
  };
}

export function initAuth({ onUser }) {
  const dlg = $("#authDialog"), msg = $("#authMsg");
  const creds = () => ({ email: $("#email").value.trim(), password: $("#password").value });
  const redirect = location.origin + location.pathname;

  async function run(fn, okMsg) {
    msg.textContent = "";
    try {
      const { error } = await fn();
      if (error) throw error;
      if (okMsg) { msg.style.color = "var(--ok)"; msg.textContent = okMsg; } else dlg.close();
    } catch (e) { msg.style.color = "var(--warn)"; msg.textContent = e.message; }
  }

  $("#authOpen").onclick = () => { msg.textContent = ""; $("#authNotice").hidden = true; dlg.showModal(); };
  $("#authClose").onclick = () => dlg.close();
  const out = $("#signOutDialog");
  $("#signOut").onclick = () => { $("#signOutWipe").checked = false; out.showModal(); };
  $("#signOutCancel").onclick = () => out.close();
  $("#signOutConfirm").onclick = async () => {
    const wipe = $("#signOutWipe").checked;
    leaving();
    await sb.auth.signOut().catch(() => {});
    out.close();
    if (wipe) { wipeDevice(); location.reload(); } else toast(t("Signed out."));
  };
  $("#doSignIn").onclick = () => run(() => sb.auth.signInWithPassword(creds()));
  $("#doSignUp").onclick = () =>
    run(() => sb.auth.signUp({ ...creds(), options: { emailRedirectTo: redirect } }), t("Account created. Check your inbox if confirmation is required."));
  $("#doMagic").onclick = () =>
    run(() => sb.auth.signInWithOtp({ email: creds().email, options: { emailRedirectTo: redirect } }), t("Link sent. Open it on this device."));
  // The same message whether or not an account exists for this address (nobody can test which e-mails are registered).
  $("#doForgot").onclick = () => {
    const email = creds().email;
    if (!email || !$("#email").checkValidity()) { msg.style.color = "var(--warn)"; msg.textContent = t("Enter your email address above first."); $("#email").focus(); return; }
    run(() => sb.auth.resetPasswordForEmail(email, { redirectTo: redirect }),
      t("If an account exists for this address, we sent a link to choose a new password. Open it on this device."));
  };
  initPasswordDialog();

  // Fires INITIAL_SESSION on load, then SIGNED_IN / SIGNED_OUT. Defer to avoid auth-lock deadlocks.
  // A reset link signs the user in, then asks for the new password (once). Supabase emits PASSWORD_RECOVERY while the
  // client starts, before this listener exists, so the link is also read from the address (supabase.js EMAIL_LINK).
  let recovery = EMAIL_LINK.recovery;
  if (EMAIL_LINK.error) {
    if (location.hash.includes("error")) history.replaceState(null, "", location.pathname + location.search);
    toast(t("This e-mail link has expired or was already used. Ask for a new one."));
  }
  let signedIn = false;
  sb.auth.onAuthStateChange((event, session) => setTimeout(() => {
    if (session) ls.set(ACCOUNT_USED, "1");
    // Signed out without asking: say so and offer to sign in again, instead of a silent switch to guest mode.
    if (event === "SIGNED_OUT" && signedIn && !signingOut) {
      msg.textContent = ""; $("#authNotice").hidden = false;
      if (!dlg.open) dlg.showModal();
    }
    if (event === "SIGNED_OUT") signingOut = false;
    signedIn = Boolean(session);
    onUser(session?.user ?? null);
    if (session && (recovery || event === "PASSWORD_RECOVERY")) { recovery = false; dlg.close(); openPasswordDialog(true); }
  }, 0));
}
