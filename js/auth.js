import { sb } from "./supabase.js";
import { $ } from "./lib.js";

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
    run(() => sb.auth.signUp({ ...creds(), options: { emailRedirectTo: redirect } }), "Account created. Check your inbox if confirmation is required.");
  $("#doMagic").onclick = () =>
    run(() => sb.auth.signInWithOtp({ email: creds().email, options: { emailRedirectTo: redirect } }), "Link sent. Open it on this device.");

  // Fires INITIAL_SESSION on load, then SIGNED_IN / SIGNED_OUT. Defer to avoid auth-lock deadlocks.
  sb.auth.onAuthStateChange((_event, session) => setTimeout(() => onUser(session?.user ?? null), 0));
}
