// "Save my CVs to my account" (opt-in, signed-in users; owner decision 2026-11-06). Off by default: CVs stay in this
// browser. When the user turns it on (Account page, after a notice), the CV versions ("hk.cvs"), the active version
// ("hk.cv.active") and the CV maker draft ("hk.cvmaker") are copied to the user's own row of cv_sync (RLS: own row
// only; migration 20261106000000_cv_sync_insights.sql). The row's existence is the switch, so it follows the account
// to every device (Safari, the installed app, a computer). Turning it off deletes the server copy; this device keeps
// its CVs. Deleting the account deletes the row (on delete cascade).
// Sync = merge, so no device loses a CV: versions are merged by id (the most recently edited copy of each wins),
// versions deleted on any device stay deleted ("hk.cvsync.deleted" / deleted_ids), and the CV maker draft and the
// active version come from the most recently changed side ("hk.cvsync.at" = time of the last local change). It runs on
// sign-in, when the app comes back to the foreground, and 1.5 s after every local change. When this device's CVs
// change, the "hk:cvs-synced" event tells the CV page and the CV maker to reload.
// Without the migration the switch reports that the feature is not available yet. Imports only lib and supabase, so
// cvs.js and cvmaker.js can call localChange() without import cycles.
import { ls } from "./lib.js";
import { sb } from "./supabase.js";

const LIST = "hk.cvs", ACTIVE = "hk.cv.active", MAKER = "hk.cvmaker", AT = "hk.cvsync.at", ON = "hk.cvsync.on",
  DEL = "hk.cvsync.deleted";
let user = null, timer = 0, applying = false;

export const cvSyncOn = () => Boolean(user && ls.get(ON) === user.id);
const status = () => window.dispatchEvent(new CustomEvent("hk:cvsync")); // the Account page redraws its switch

// Called by app.js when the signed-in user changes (null when signed out).
export async function cvSyncUser(u) {
  user = u || null;
  if (user) await pull();
}

// Called by cvs.js and cvmaker.js after every change of the CVs or the CV maker draft ({ deleted: id } when a
// version is removed, so the merge does not bring it back from another device).
export function localChange({ deleted } = {}) {
  if (applying) return;
  if (deleted) ls.set(DEL, JSON.stringify([...parse(DEL, []), deleted].slice(-200)));
  ls.set(AT, new Date().toISOString());
  if (!cvSyncOn()) return;
  clearTimeout(timer);
  timer = setTimeout(() => push().catch((e) => console.warn("CV sync:", e.message)), 1500);
}

const parse = (k, fallback) => { try { return JSON.parse(ls.get(k) || "null") ?? fallback; } catch { return fallback; } };
const localCopy = () => ({ versions: parse(LIST, []), active_id: ls.get(ACTIVE) || null, maker: parse(MAKER, null),
  deleted_ids: parse(DEL, []) });
const time = (v) => Date.parse(v || 0) || 0;

async function push() {
  if (!cvSyncOn()) return;
  const at = ls.get(AT) || new Date().toISOString();
  const { error } = await sb.from("cv_sync").upsert({ user_id: user.id, ...localCopy(), updated_at: at });
  // (deleted_ids travels with localCopy so every device learns about removed versions)
  if (error) throw error;
}

// Reads the account's copy (no row = sync off) and merges it with this device's; pushes the result if the account's
// copy lacks something.
async function pull() {
  const { data, error } = await sb.from("cv_sync").select("versions, active_id, maker, deleted_ids, updated_at").maybeSingle();
  if (error || !data) { ls.del(ON); status(); return; } // no row: off. Error: table missing (migration not run yet) or offline.
  ls.set(ON, user.id); status();
  const local = localCopy(), localAt = time(ls.get(AT)), serverAt = time(data.updated_at), localNewer = localAt > serverAt;
  const deleted = [...new Set([...(Array.isArray(data.deleted_ids) ? data.deleted_ids : []), ...local.deleted_ids])].slice(-200);
  const gone = new Set(deleted), byId = new Map();
  for (const v of [...local.versions, ...(Array.isArray(data.versions) ? data.versions : [])]) { // this device's order first
    if (!v?.id || gone.has(v.id)) continue;
    const cur = byId.get(v.id);
    if (!cur || time(v.updated_at) > time(cur.updated_at)) byId.set(v.id, v);
  }
  const versions = [...byId.values()];
  const pick = (a, b) => (localNewer ? a ?? b : b ?? a);
  const merged = { versions, active_id: pick(local.active_id, data.active_id), maker: pick(local.maker, data.maker), deleted_ids: deleted };
  const same = (x, y) => JSON.stringify(x) === JSON.stringify(y);
  const at = new Date(Math.max(localAt, serverAt) || Date.now()).toISOString();

  if (!same(merged.versions, local.versions) || merged.active_id !== local.active_id || !same(merged.maker, local.maker)) {
    applying = true;
    try {
      ls.set(LIST, JSON.stringify(merged.versions));
      if (merged.active_id) ls.set(ACTIVE, merged.active_id); else ls.del(ACTIVE);
      if (merged.maker) ls.set(MAKER, JSON.stringify(merged.maker)); else ls.del(MAKER);
    } finally { applying = false; }
    window.dispatchEvent(new CustomEvent("hk:cvs-synced"));
  }
  ls.set(DEL, JSON.stringify(deleted));
  ls.set(AT, at);
  const serverHas = { versions: data.versions, active_id: data.active_id, maker: data.maker, deleted_ids: data.deleted_ids };
  if (!same(serverHas, merged)) await push();
}

// Turns the sync on (copies this device's CVs, or takes the account's copy if it is newer) or off (deletes the
// account's copy). Returns { ok, error }.
export async function setCvSync(on) {
  if (!user) return { ok: false, error: "signed_out" };
  if (on) {
    const { data, error } = await sb.from("cv_sync").select("updated_at").maybeSingle();
    if (error) return { ok: false, error: "unavailable" };
    ls.set(ON, user.id);
    if (data) await pull(); else await push();
    status();
    return { ok: true };
  }
  const { error } = await sb.from("cv_sync").delete().eq("user_id", user.id);
  if (error) return { ok: false, error: "unavailable" };
  ls.del(ON); status();
  return { ok: true };
}

// The account's copy, for the data export (null when the sync is off).
export async function cvSyncExport() {
  if (!user) return null;
  const { data } = await sb.from("cv_sync").select("*").maybeSingle();
  return data || null;
}

// Back in the foreground (the installed app is often resumed rather than reopened): take the newer copy.
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && cvSyncOn()) pull().catch(() => {});
});
