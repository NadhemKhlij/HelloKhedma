// Job search ("Job search" tab): calls the job-search Edge Function, which queries France Travail, Adzuna and
// JSearch server-side (only the providers whose secrets are set), so API keys never reach the browser.
// boardLinks() builds direct links to job boards as a fallback when the function is unavailable.
import { sb } from "./supabase.js";

// Calls the job-search Edge Function. Keys stay server-side.
export async function searchJobs({ query, location, provider, country, page = 1 }) {
  const { data, error } = await sb.functions.invoke("job-search", {
    body: { query, location, provider, country, page },
  });
  if (error) {
    let msg = error.message;
    try { const j = await error.context.json(); if (j?.error) msg = j.error; } catch { /* keep message */ }
    throw new Error(msg);
  }
  return data; // { jobs, warnings }
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
