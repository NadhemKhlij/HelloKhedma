// CV ↔ offer fit, one rule for every list that shows it (the Offers page and "Choose an offer" on #/cv).
// Functional audit of 2026-11-23, section 1: an offer whose summary named 2 skills, both in the CV, got "100% · 2/2" and
// went to the top of "Best fit"; a "Java Fullstack Senior, strong backend" offer got 100% for an Application Support CV,
// because the dictionary only saw Java and Oracle in it. The fix measures the offer's real requirements, whatever path
// is selected (a developer CV can fit a support job and the other way round):
// - js/ats.js knows development skills (backend, frontend, fullstack, Spring, Angular, microservices…), so a development
//   offer shows the requirements a non-developer CV lacks;
// - skills named in the job title are the core of the job and weigh TITLE_WEIGHT, the others 1;
// - below MIN_SKILLS_FOR_FIT distinct skills found there is no percentage (score null, reason "few"): the lists say
//   "Not enough information" and sort these offers after every scored one (Adzuna's API sends 500 characters only).
// No DOM: offerFit() is also checked by the smoke tests (tests/smoke.spec.mjs, "fit score").
import { extractSkills, matchSkills } from "./ats.js";

export const MIN_SKILLS_FOR_FIT = 4;
export const TITLE_WEIGHT = 3;

// { skills, matched, missing, total, score (0-100 or null), reason: "few" | null, core, missingCore }
// core: the offer's skills named in its title; missingCore: those the CV lacks.
export function offerFit({ title = "", text = "", cvNames, skills = null }) {
  const found = skills || extractSkills(`${title} ${text}`).map((s) => s.name);
  const inTitle = new Set(extractSkills(title).map((s) => s.name));
  const m = matchSkills(found, cvNames);
  const core = found.filter((n) => inTitle.has(n)), missingCore = m.missing.filter((n) => inTitle.has(n));
  if (m.total < MIN_SKILLS_FOR_FIT) return { ...m, skills: found, score: null, reason: "few", core, missingCore };
  const weight = (n) => (inTitle.has(n) ? TITLE_WEIGHT : 1);
  const sum = (list) => list.reduce((a, n) => a + weight(n), 0);
  return { ...m, skills: found, score: Math.round((100 * sum(m.matched)) / sum(found)), reason: null, core, missingCore };
}

// Sorting key for "best fit first": offers without a score come last.
export const fitRank = (fit) => (fit?.score == null ? -1 : fit.score);
