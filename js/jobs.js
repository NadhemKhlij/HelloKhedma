// Job search ("Job search" tab): calls the job-search Edge Function, which queries France Travail, Adzuna, JSearch,
// Himalayas and Arbeitnow server-side, Jooble as a backup (only the providers whose secrets are set), so API keys never
// reach the browser. alt: the English title sent with a French one (country France), searched together; path: the
// career path id (La bonne alternance searches by trade codes, not words). Careerjet and La bonne alternance run too
// when their keys are set.
// The Offers filters (contract, remote, posted within) go with the search so the sources return matching offers
// (the page filters the results again). salaryStats(): Adzuna's statistics for a job title (Home): advertised salaries,
// top companies, regions and the offers of the last 7 days.
// boardLinks() builds direct links to job boards as a fallback when the function is unavailable.
import { sb } from "./supabase.js";

// Calls the job-search Edge Function. Keys stay server-side.
export async function searchJobs({ query, alt = "", path = "", location, provider, country, page = 1, filters = {} }) {
  const { data, error } = await sb.functions.invoke("job-search", {
    body: { query, ...(alt ? { alt } : {}), ...(path ? { path } : {}), location, provider, country, page, filters },
  });
  if (error) {
    let msg = error.message;
    try { const j = await error.context.json(); if (j?.error) msg = j.error; } catch { /* keep message */ }
    throw new Error(msg);
  }
  return data; // { jobs, warnings }
}

// { histogram: [[from, count]..], history: [["YYYY-MM", average]..], currency, companies: [{ name, count, salary }],
//   regions: [{ name, count }], regionTotal, week } or throws (companies… missing from a function deployed before 2026-11-09).
export async function salaryStats({ query, country }) {
  const { data, error } = await sb.functions.invoke("job-search", { body: { kind: "salary", query, country } });
  if (error) throw new Error(error.message);
  if (!Array.isArray(data?.histogram)) throw new Error("no salary statistics"); // an older function answers with jobs
  return data;
}

// Fallback when the function is not deployed or quota is exhausted.
export function boardLinks(q, loc) {
  const e = encodeURIComponent;
  return [
    ["LinkedIn", `https://www.linkedin.com/jobs/search/?keywords=${e(q)}&location=${e(loc)}`],
    ["Indeed", `https://fr.indeed.com/jobs?q=${e(q)}&l=${e(loc)}`],
    ["Welcome to the Jungle", `https://www.welcometothejungle.com/fr/jobs?query=${e(q)}`],
    ["France Travail", `https://candidat.francetravail.fr/offres/recherche?motsCles=${e(q)}&lieux=${e(loc)}`],
    ["Google Jobs", `https://www.google.com/search?q=${e(`${q} jobs ${loc}`)}&ibp=htl;jobs`],
  ];
}
