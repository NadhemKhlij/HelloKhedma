// Learning progress synced between the devices of a signed-in user (training step 1, 2026-11-06): lessons done,
// quiz best scores, flashcards known, exercises solved, project steps, XP and study days, last course, interview
// ratings, STAR stories and checklist, study and application goals, flashcard reviews and skill checks (srs.js). Guests keep everything in this browser only.
// Storage: the user's own row of learning_sync (RLS; migration 20261106000100_learning_sync_reports.sql): data =
// the stored strings by localStorage key, stamps = when each key last changed. CVs are not here (opt-in cvsync.js).
// Merge, key by key, so progress made on two devices is never lost:
//   - lists of ids (lessons, projects, checklist…): union; inside objects, numbers keep the highest (quiz best, XP,
//     activity per day) and lists are united (flashcards known, exercises solved);
//   - records with a numeric "at" on both sides (a card's review, a skill check, srs.js): the later "at" wins whole,
//     so a card missed on one device really goes back to box 1;
//   - anything else (stories, ratings values, goals, last course): the most recent change wins.
//   Consequence: something un-ticked on one device can come back from another; ticking is what matters for progress.
// Runs on sign-in, when the app comes back to the foreground and 2 s after a local change (lib.js onStore). After a
// merge that changed this device, "hk:learning-synced" tells the pages to redraw. Without the migration it stays off.
import { ls, onStore } from "./lib.js";
import { sb } from "./supabase.js";

export const LEARNING_KEYS = ["hk.lessons", "hk.quiz", "hk.cards", "hk.exercises", "hk.projects", "hk.activity",
  "hk.lastCourse", "hk.iv.ratings", "hk.iv.stories", "hk.iv.checklist", "hk.hours", "hk.weeklyGoal", "hk.srs", "hk.placement"];
const WATCHED = new Set(LEARNING_KEYS), STAMPS = "hk.learnsync.stamps";
let user = null, timer = 0, applying = false, available = true;

const parseJson = (s) => { try { return JSON.parse(s); } catch { return undefined; } };
const stamps = () => parseJson(ls.get(STAMPS) || "{}") || {};
const time = (v) => Date.parse(v || 0) || 0;
const isObj = (x) => x && typeof x === "object" && !Array.isArray(x);
const primitives = (arr) => arr.every((x) => x === null || typeof x !== "object");

// Deep merge of two stored values (see the header). aNewer: a changed more recently than b.
function mergeDeep(a, b, aNewer) {
  if (Array.isArray(a) && Array.isArray(b)) return primitives(a) && primitives(b) ? [...new Set([...a, ...b])] : aNewer ? a : b;
  if (isObj(a) && isObj(b) && typeof a.at === "number" && typeof b.at === "number") return a.at >= b.at ? a : b;
  if (isObj(a) && isObj(b)) {
    const out = {};
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
      if (!(k in a)) out[k] = b[k];
      else if (!(k in b)) out[k] = a[k];
      else if (typeof a[k] === "number" && typeof b[k] === "number") out[k] = Math.max(a[k], b[k]);
      else out[k] = mergeDeep(a[k], b[k], aNewer);
    }
    return out;
  }
  return aNewer ? a : b;
}
// Merge of one key: stored strings in, stored string out.
export function mergeStored(localStr, remoteStr, localNewer) {
  if (localStr == null) return remoteStr;
  if (remoteStr == null) return localStr;
  const a = parseJson(localStr), b = parseJson(remoteStr);
  if ((Array.isArray(a) && Array.isArray(b)) || (isObj(a) && isObj(b))) return JSON.stringify(mergeDeep(a, b, localNewer));
  return localNewer ? localStr : remoteStr; // plain values ("5" hours, a story list…): the newer one
}

// Local changes: remember when, and push soon (signed in only).
onStore((k) => {
  if (applying || !WATCHED.has(k)) return;
  ls.set(STAMPS, JSON.stringify({ ...stamps(), [k]: new Date().toISOString() }));
  if (!user || !available) return;
  clearTimeout(timer);
  timer = setTimeout(() => sync().catch((e) => console.warn("Learning sync:", e.message)), 2000);
});

// Called by app.js when the signed-in user changes (null when signed out).
export async function learnSyncUser(u) {
  user = u || null;
  available = true;
  if (user) await sync();
}

export async function sync() {
  if (!user || !available) return;
  const { data, error } = await sb.from("learning_sync").select("data, stamps").maybeSingle();
  if (error) { available = false; return; } // table missing (migration not run yet) or offline: stay local
  const remote = data?.data || {}, rStamps = data?.stamps || {}, lStamps = stamps();
  const merged = {}, mStamps = {};
  let localChanged = false;
  for (const k of LEARNING_KEYS) {
    const local = ls.get(k), lt = time(lStamps[k]), rt = time(rStamps[k]);
    const value = mergeStored(local, remote[k] ?? null, lt >= rt);
    if (value == null) continue;
    merged[k] = value;
    mStamps[k] = new Date(Math.max(lt, rt) || Date.now()).toISOString();
    if (value !== local) {
      applying = true;
      try { ls.set(k, value); } finally { applying = false; }
      localChanged = true;
    }
  }
  ls.set(STAMPS, JSON.stringify({ ...lStamps, ...mStamps }));
  if (localChanged) window.dispatchEvent(new CustomEvent("hk:learning-synced"));
  const same = data && LEARNING_KEYS.every((k) => (remote[k] ?? null) === (merged[k] ?? null));
  if (!same) {
    const { error: e2 } = await sb.from("learning_sync")
      .upsert({ user_id: user.id, data: merged, stamps: mStamps, updated_at: new Date().toISOString() });
    if (e2) throw e2;
  }
}

// The account's copy, for the data export.
export async function learnSyncExport() {
  if (!user) return null;
  const { data } = await sb.from("learning_sync").select("*").maybeSingle();
  return data || null;
}

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && user && available) sync().catch(() => {});
});
