// Site activity for the admin page (2026-11-12, owner: "the stats page is not showing correct numbers"; migration
// 20261112000100_site_activity.sql). Two things, both numbers only:
// - countFeature(kind): anonymous daily counter of a feature, for guests and signed-in users alike (count_feature():
//   day + kind + count, no account, no IP kept). At most once per feature per day per browser ("hk.counted"), so a
//   number reads "browsers that used it that day". Kinds: FEATURES below (the database ignores any other).
// - touchSeen(): a signed-in account used the site today → profiles.last_seen_at (touch_seen(), at most once a day,
//   "hk.seenDay"), so "Active accounts" also counts people who stay signed in.
// Never on a local / test server, a preview build or an automated browser (navigator.webdriver: the smoke tests), so
// test runs do not inflate the numbers. Fire and forget: a failure (migration not run yet, offline) changes nothing.
import { ls, PREVIEW } from "./lib.js";
import { sb } from "./supabase.js";

export const FEATURES = ["visit", "job_search_page", "tailor_open", "tailor_prompt", "tailor_signin", "cover_letter", "cv_check",
  "cv_pdf", "tracker_add", "lesson_done", "quiz_done", "review", "interview", "skillcheck"];
const COUNTED = "hk.counted", SEEN = "hk.seenDay";
const today = () => new Date().toISOString().slice(0, 10);
const off = () => !sb || PREVIEW || navigator.webdriver || /^(localhost|127\.|\[?::1\]?$|0\.0\.0\.0)/.test(location.hostname);

export function countFeature(kind) {
  if (off() || !FEATURES.includes(kind)) return;
  let done;
  try { done = JSON.parse(ls.get(COUNTED) || "{}"); } catch { done = {}; }
  if (!done || typeof done !== "object" || Array.isArray(done)) done = {};
  const d = today();
  if (done[kind] === d) return;
  for (const k of Object.keys(done)) if (done[k] !== d) delete done[k]; // keep today's only
  done[kind] = d;
  ls.set(COUNTED, JSON.stringify(done));
  sb.rpc("count_feature", { p_kind: kind }).then(() => {}, () => {});
}

export function touchSeen(user) {
  if (off() || !user) return;
  const d = today(), key = `${user.id}|${d}`;
  if (ls.get(SEEN) === key) return;
  ls.set(SEEN, key);
  sb.rpc("touch_seen").then(() => {}, () => {});
}
