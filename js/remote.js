// Remote jobs from Jobicy and Remotive: free public APIs, CORS-enabled, called from the browser.
// Their terms: credit the source with a link and send applicants to the original job URL (we do both), and do not
// poll often (Remotive: max ~4 calls a day), so results are cached in this browser for 6 hours per path.
// Keyword search on these boards is loose, so we read Jobicy by category for each path (checked 2026-10-29) and the
// app keeps only titles matching the path. Remotive's free feed is small (~a dozen jobs, delayed 24 h) but costs one call.
// Jobs are normalised to the job-search shape: { id, title, company, location, url, posted, snippet, text, source,
// salary } (salary: the board's own salary text, read by salary.js).
// The required credit links are rendered under the results by offers.js (CREDITS). Cache key: "hk.remoteCache".
import { ls } from "./lib.js";

const CACHE_KEY = "hk.remoteCache", TTL = 6 * 3600_000;
const JOBICY_INDUSTRIES = {
  de: ["data-science", "admin"], da: ["data-science"], ba: ["management", "business"], as: ["technical-support", "admin"],
};
const textOf = (html) => new DOMParser().parseFromString(String(html ?? ""), "text/html").body.textContent || "";
const squash = (s, max) => String(s ?? "").replace(/\s+/g, " ").trim().slice(0, max);
// tags (remote, contract type) go first in `text` so truncation never drops them; the card summary is the description only.
const job = ({ tags, desc, ...o }) => ({ ...o, snippet: squash(desc, 280), text: squash(`${tags} ${desc}`, 4000) });

async function remotive() {
  const res = await fetch("https://remotive.com/api/remote-jobs?limit=100");
  if (!res.ok) throw new Error(`Remotive returned ${res.status}`);
  const d = await res.json();
  return (d.jobs || []).map((x) => job({
    id: String(x.id), title: x.title, company: x.company_name, location: x.candidate_required_location || "Remote",
    url: x.url, posted: x.publication_date, source: "remotive", salary: x.salary || "", // free text, read by salary.js
    tags: `full remote ${x.job_type === "contract" ? "contractor" : x.job_type === "internship" ? "internship" : ""}`, desc: textOf(x.description),
  }));
}
async function jobicy(industry) {
  const res = await fetch(`https://jobicy.com/api/v2/remote-jobs?count=50&industry=${encodeURIComponent(industry)}`);
  if (!res.ok) throw new Error(`Jobicy returned ${res.status}`);
  const d = await res.json();
  return (d.jobs || []).map((x) => job({
    id: String(x.id), title: textOf(x.jobTitle), company: x.companyName, location: x.jobGeo || "Remote",
    url: x.url, posted: x.pubDate, source: "jobicy",
    salary: x.annualSalaryMin ? `${x.annualSalaryMin}-${x.annualSalaryMax || x.annualSalaryMin} ${x.salaryCurrency || "USD"} per year` : "",
    tags: `full remote ${[].concat(x.jobType || []).join(" ").replace(/contract/i, "contractor")}`, desc: textOf(x.jobDescription || x.jobExcerpt),
  }));
}

// Region filter on the location text. "Anywhere / worldwide" jobs are kept for every region.
const REGIONS = {
  europe: /europe|emea|eu\b|france|germany|spain|portugal|netherlands|belgium|uk|united kingdom|ireland|poland|cet|anywhere|worldwide|global/i,
  france: /france|europe|emea|eu\b|cet|anywhere|worldwide|global/i,
};

// All remote jobs for a path (before the app's title filter). Returns { jobs, warnings, cached }.
export async function searchRemote(pathId, region = "") {
  let cache = {};
  try { cache = JSON.parse(ls.get(CACHE_KEY) || "{}"); } catch { /* ignore */ }
  let entry = cache[pathId], cached = true;
  const warnings = [];
  if (!entry || Date.now() - entry.at > TTL) {
    cached = false;
    const calls = [remotive(), ...(JOBICY_INDUSTRIES[pathId] || ["dev"]).map(jobicy)];
    const results = await Promise.allSettled(calls);
    const jobs = [];
    results.forEach((r) => (r.status === "fulfilled" ? jobs.push(...r.value) : warnings.push(r.reason?.message || "A source failed.")));
    if (!jobs.length && warnings.length) throw new Error(warnings.join(" "));
    entry = { at: Date.now(), jobs };
    // Keep the 3 most recent fresh entries so local storage stays small.
    cache = Object.fromEntries(Object.entries({ ...cache, [pathId]: entry })
      .filter(([, v]) => Date.now() - v.at < TTL).sort((a, b) => b[1].at - a[1].at).slice(0, 3));
    ls.set(CACHE_KEY, JSON.stringify(cache));
  }
  const seen = new Set();
  const jobs = entry.jobs
    .filter((j) => j.url && (!region || REGIONS[region].test(j.location)))
    .filter((j) => { const k = `${j.title}|${j.company}`.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; })
    .sort((a, b) => new Date(b.posted || 0) - new Date(a.posted || 0));
  return { jobs, warnings, cached };
}
