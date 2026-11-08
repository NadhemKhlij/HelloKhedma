// Learn smarter (training step 3, 2026-11-08): the data behind spaced-repetition reviews and the skill check. No DOM.
// Spaced repetition ("hk.srs" = { <courseId>: { <cardKey>: { box, due, at } } }, cardKey = "<group>:<item>" of the
// course cheat sheet, as in practice.js): a Leitner system. A card you knew moves up a box and comes back later
// (INTERVALS days: 1, 3, 7, 14, 30, 60); a card you missed goes back to box 1 and comes back tomorrow. due = day number
// (local days since 1970). Cards enter when they are first graded in a course's Flashcards; cards marked known before
// this existed ("hk.cards") are scheduled over the next days the first time the reviews are counted.
// Skill check ("hk.placement" = { <courseId>: { got, of, at } }, skillcheck.js): the last result per course; a course
// is passed with PASS_RATIO of its questions right (3 of 4), and its skills then count as known: the study plan
// (training.js) and "Close the gaps" (gaps.js) skip that course. at = time of the answer (ms): learnsync.js keeps the
// most recent record of a card or a check when two devices differ. Both stay in this browser (synced when signed in).
import { ls } from "./lib.js";

const SRS = "hk.srs", PLACEMENT = "hk.placement", CARDS = "hk.cards";
export const INTERVALS = [0, 1, 3, 7, 14, 30, 60]; // days, by box 1..6
export const PASS_RATIO = 0.75;
const read = (k) => { try { const v = JSON.parse(ls.get(k) || "{}"); return v && typeof v === "object" ? v : {}; } catch { return {}; } };
export const today = () => Math.floor((Date.now() - new Date().getTimezoneOffset() * 60_000) / 86_400_000);

/* ---------- spaced repetition ---------- */
export function grade(courseId, key, knew) {
  const all = read(SRS), c = all[courseId] || {}, cur = c[key];
  const box = knew ? Math.min(INTERVALS.length - 1, (cur?.box || 1) + 1) : 1;
  c[key] = { box, due: today() + INTERVALS[box], at: Date.now() };
  all[courseId] = c;
  ls.set(SRS, JSON.stringify(all));
}

// Cards marked "I knew it" before reviews existed: box 2, spread over the next 5 days (not all on one day).
function seedFromKnown(all) {
  const known = read(CARDS), d = today();
  let changed = false;
  for (const [courseId, keys] of Object.entries(known)) {
    if (!Array.isArray(keys)) continue;
    keys.forEach((key, i) => {
      if (all[courseId]?.[key]) return;
      (all[courseId] ||= {})[key] = { box: 2, due: d + 1 + (i % 5), at: 0 };
      changed = true;
    });
  }
  if (changed) ls.set(SRS, JSON.stringify(all));
  return all;
}

// Cards due today or earlier: [{ courseId, key, box, due }], the most overdue first. courseId: one course only.
export function dueCards(courseId = null) {
  const all = seedFromKnown(read(SRS)), d = today(), out = [];
  for (const [cid, cards] of Object.entries(all)) {
    if (courseId && cid !== courseId) continue;
    for (const [key, s] of Object.entries(cards || {})) if (s && s.due <= d) out.push({ courseId: cid, key, box: s.box, due: s.due });
  }
  return out.sort((a, b) => a.due - b.due || a.box - b.box);
}
// Days until the next card is due (0 = today), or null when nothing is scheduled.
export function nextDueIn() {
  const all = read(SRS), d = today();
  let min = null;
  for (const cards of Object.values(all)) for (const s of Object.values(cards || {})) if (s && (min == null || s.due < min)) min = s.due;
  return min == null ? null : Math.max(0, min - d);
}

/* ---------- skill check ---------- */
export function saveCheck(courseId, got, of) {
  const all = read(PLACEMENT);
  all[courseId] = { got, of, at: Date.now() };
  ls.set(PLACEMENT, JSON.stringify(all));
}
export const checkResult = (courseId) => read(PLACEMENT)[courseId] || null;
export const passed = (r) => Boolean(r && r.of && r.got / r.of >= PASS_RATIO);
// Course ids whose skill check was passed (their latest result).
export function passedCourses() {
  return new Set(Object.entries(read(PLACEMENT)).filter(([, r]) => passed(r)).map(([id]) => id));
}
