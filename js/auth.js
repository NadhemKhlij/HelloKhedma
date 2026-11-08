// Sign-in dialog (#authDialog): password sign-in, account creation, email magic link and "Forgot password?" (reset
// email), via Supabase Auth. #pwDialog sets a new password: opened by the reset link (PASSWORD_RECOVERY event: the
// link signs the user in, then asks for the new password) or by "Change password" on the Account page (openPasswordDialog).
// Email links redirect to this page (must be listed in Supabase → Auth → URL Configuration). onUser(user | null) is
// called on load (INITIAL_SESSION) and on every sign-in / sign-out; app.js then switches LocalStore ↔ CloudStore.
import { sb, EMAIL_LINK } from "./supabase.js";
import { $, toast } from "./lib.js";
import { t } from "./i18n.js";

// New password for the signed-in user (reset link, or Account page → Change password).
export function openPasswordDialog(recovery = false) {
  const dlg = $("#pwDialog");
  $("#pwForm").reset();
  $("#pwMsg").textContent = recovery ? t("Your reset link worked. Choose a new password to finish.") : "";
  $("#pwMsg").style.color = recovery ? "#18a999" : "#f08a24";
  if (!dlg.open) dlg.showModal();
  $("#newPassword").focus();
}

function initPasswordDialog() {
  const dlg = $("#pwDialog"), msg = $("#pwMsg");
  $("#pwClose").onclick = () => dlg.close();
  $("#pwForm").onsubmit = async (ev) => {
    ev.preventDefault();
    const p1 = $("#newPassword").value, p2 = $("#newPassword2").value;
    msg.style.color = "#f08a24";
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
      if (okMsg) { msg.style.color = "#18a999"; msg.textContent = okMsg; } else dlg.close();
    } catch (e) { msg.style.color = "#f08a24"; msg.textContent = e.message; }
  }

  $("#authOpen").onclick = () => { msg.textContent = ""; dlg.showModal(); };
  $("#authClose").onclick = () => dlg.close();
  $("#signOut").onclick = () => sb.auth.signOut();
  $("#doSignIn").onclick = () => run(() => sb.auth.signInWithPassword(creds()));
  $("#doSignUp").onclick = () =>
    run(() => sb.auth.signUp({ ...creds(), options: { emailRedirectTo: redirect } }), t("Account created. Check your inbox if confirmation is required."));
  $("#doMagic").onclick = () =>
    run(() => sb.auth.signInWithOtp({ email: creds().email, options: { emailRedirectTo: redirect } }), t("Link sent. Open it on this device."));
  // The same message whether or not an account exists for this address (nobody can test which e-mails are registered).
  $("#doForgot").onclick = () => {
    const email = creds().email;
    if (!email || !$("#email").checkValidity()) { msg.style.color = "#f08a24"; msg.textContent = t("Enter your email address above first."); $("#email").focus(); return; }
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
  sb.auth.onAuthStateChange((event, session) => setTimeout(() => {
    onUser(session?.user ?? null);
    if (session && (recovery || event === "PASSWORD_RECOVERY")) { recovery = false; dlg.close(); openPasswordDialog(true); }
  }, 0));
}
