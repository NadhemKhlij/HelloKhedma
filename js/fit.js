// CV ↔ offer fit, one rule for every list that shows it (the Offers page and "Choose an offer" on #/cv).
// Functional audit of 2026-11-23, section 1: an offer whose summary named 2 skills, both in the CV, got "100% · 2/2" and
// went to the top of "Best fit"; a "Java Fullstack Developer" got 100% for the Application Support path.
// - Below MIN_SKILLS_FOR_FIT skills found in the offer, there is no percentage (score null, reason "few"): the lists say
//   "Not enough information" and sort these offers after every scored one.
// - When the job title is outside the selected path (onPath(title) false: the path's job titles and title words,
//   companies.js titleMatcher), the score is capped at OFF_PATH_CAP and offPath is set, so another job never ranks as a
//   perfect fit. raw keeps the uncapped percentage.
// No DOM: offerFit() is also checked by the smoke tests (tests/smoke.spec.mjs, "fit score").
import { extractSkills, matchSkills } from "./ats.js";

export const MIN_SKILLS_FOR_FIT = 4;
export const OFF_PATH_CAP = 50;

// { skills, matched, missing, total, score (0-100 or null), raw, reason: "few" | null, offPath }
export function offerFit({ title = "", text = "", cvNames, onPath = null, skills = null }) {
  const found = skills || extractSkills(`${title} ${text}`).map((s) => s.name);
  const m = matchSkills(found, cvNames);
  if (m.total < MIN_SKILLS_FOR_FIT) return { ...m, skills: found, raw: m.score, score: null, reason: "few", offPath: false };
  const offPath = Boolean(onPath && title && !onPath(title));
  return { ...m, skills: found, raw: m.score, score: offPath ? Math.min(m.score, OFF_PATH_CAP) : m.score, reason: null, offPath };
}

// Sorting key for "best fit first": offers without a score come last.
export const fitRank = (fit) => (fit?.score == null ? -1 : fit.score);
