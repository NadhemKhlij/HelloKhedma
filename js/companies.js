// "Companies I follow": open jobs read straight from companies' career pages.
// The applicant-tracking systems below publish public, key-less, CORS-enabled job APIs, so the browser calls them
// directly (no Edge Function, no quota). Jobs are normalised to the same shape as job-search results:
//   { id, title, company, location, url, posted, snippet, text, source }
// The watchlist is stored in this browser ("hk.watchlist").
// Providers: Greenhouse, Lever, Ashby, Workable, SmartRecruiters. Adding one: a FETCH entry + parseCareersLink rule,
// and add it to the privacy policy in index.html (the browser calls it directly, so it sees the user's IP).
import { ls } from "./lib.js";
import { norm } from "./ats.js";
import { t } from "./i18n.js";

const KEY = "hk.watchlist";
export const loadWatchlist = () => { try { return JSON.parse(ls.get(KEY) || "[]"); } catch { return []; } };
export const saveWatchlist = (list) => ls.set(KEY, JSON.stringify(list));
export const entryKey = (e) => `${e.provider}:${e.slug}`;

export const PROVIDER_NAMES = {
  greenhouse: "Greenhouse", lever: "Lever", ashby: "Ashby", workable: "Workable", smartrecruiters: "SmartRecruiters",
};

// Verified on 2026-10-29 (name → provider). One-click suggestions; anything else can be searched by name or link.
export const SUGGESTED = [
  ["Doctolib", "greenhouse", "doctolib"], ["Datadog", "greenhouse", "datadog"], ["Dataiku", "greenhouse", "dataiku"],
  ["Mirakl", "greenhouse", "mirakl"], ["Algolia", "greenhouse", "algolia"], ["Contentsquare", "lever", "contentsquare"],
  ["BlaBlaCar", "lever", "blablacar"], ["Swile", "lever", "swile"], ["Malt", "lever", "malt"], ["Alan", "ashby", "alan"],
  ["Qonto", "ashby", "qonto"], ["Pennylane", "ashby", "pennylane"], ["Back Market", "ashby", "backmarket"],
  ["Ledger", "ashby", "ledger"], ["Hugging Face", "workable", "huggingface"], ["Ubisoft", "smartrecruiters", "Ubisoft2"],
].map(([name, provider, slug]) => ({ name, provider, slug }));

// Job-title words per career path, used by "Only roles for my path" (in addition to the path's job titles).
const PATH_TITLE_TERMS = {
  de: ["data engineer", "analytics engineer", "data platform", "data infrastructure", "big data", "etl", "data pipeline",
    "ingenieur data", "ingenieur de donnees", "dataops", "data ops", "machine learning engineer", "mlops"],
  da: ["data analyst", "analyste", "business intelligence", "bi analyst", "bi developer", "analytics", "reporting",
    "data scientist", "insights", "data visualization"],
  ba: ["business analyst", "product analyst", "functional analyst", "analyste fonctionnel", "business process",
    "product owner", "consultant fonctionnel", "amoa", "moa"],
  as: ["application support", "support engineer", "production support", "support applicatif", "technical support",
    "sre", "site reliability", "devops", "ops engineer", "incident", "exploitation", "run", "l2", "l3"],
};
export function titleMatcher(path) {
  const terms = [...(path?.job_titles || []).map(norm), ...(PATH_TITLE_TERMS[path?.id] || [])];
  if (!terms.length) return () => true;
  const re = new RegExp(`(?<![a-z0-9])(${terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})(?![a-z0-9])`);
  return (title) => re.test(norm(title));
}

// HTML (possibly entity-escaped, like Greenhouse) → plain text. DOMParser documents never run scripts.
const textOf = (html) => new DOMParser().parseFromString(String(html ?? ""), "text/html").body.textContent || "";
const squash = (s, max) => String(s ?? "").replace(/\s+/g, " ").trim().slice(0, max);
const EMPLOYMENT = { FullTime: "full-time", PartTime: "part-time", Intern: "internship", Contract: "contractor", Temporary: "fixed-term" };
const remoteWord = (w) => (/^remote$/i.test(w || "") ? "full remote" : /^hybrid$/i.test(w || "") ? "hybrid" : "");
const job = (o) => ({ ...o, snippet: squash(o.text, 280), text: squash(o.text, 6000) });

async function getJson(url) {
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`${new URL(url).host} returned ${res.status}`);
  return res.json();
}

// Each fetcher returns { name, jobs } or null when the company is not on that provider.
// wanted(title) keeps the relevant jobs. Greenhouse and SmartRecruiters need one request per job for the description,
// so they fetch details for at most DETAIL_LIMIT of the most recent relevant jobs (big employers list thousands).
const DETAIL_LIMIT = 30;
const newestFirst = (a, b) => String(b ?? "").localeCompare(String(a ?? ""));
const FETCH = {
  async greenhouse(slug, wanted) {
    const base = `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(slug)}/jobs`;
    const d = await getJson(base);
    if (!d?.jobs) return null;
    const items = d.jobs.filter((x) => wanted(x.title))
      .sort((a, b) => newestFirst(a.first_published || a.updated_at, b.first_published || b.updated_at)).slice(0, DETAIL_LIMIT);
    const details = await Promise.all(items.map((x) => getJson(`${base}/${x.id}`).catch(() => null)));
    return { name: d.jobs[0]?.company_name, total: d.jobs.length, jobs: items.map((x, i) => job({
      id: String(x.id), title: x.title, company: x.company_name, location: x.location?.name || "", url: x.absolute_url,
      posted: x.first_published || x.updated_at,
      text: textOf(textOf(details[i]?.content)), // content is HTML escaped as entities
    })) };
  },
  async lever(slug) {
    const d = await getJson(`https://api.lever.co/v0/postings/${encodeURIComponent(slug)}?mode=json`);
    if (!Array.isArray(d)) return null;
    return { name: null, jobs: d.map((x) => job({
      id: x.id, title: x.text, location: x.categories?.location || "", url: x.hostedUrl,
      posted: x.createdAt ? new Date(x.createdAt).toISOString() : null,
      text: [x.descriptionPlain, ...(x.lists || []).map((l) => `${l.text} ${textOf(l.content)}`), x.additionalPlain,
        x.categories?.commitment, remoteWord(x.workplaceType)].filter(Boolean).join(" "),
    })) };
  },
  async ashby(slug) {
    const d = await getJson(`https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(slug)}`);
    if (!d?.jobs) return null;
    return { name: null, jobs: d.jobs.filter((x) => x.isListed !== false).map((x) => job({
      id: x.id, title: x.title, url: x.jobUrl, posted: x.publishedAt,
      location: [x.location, ...(x.secondaryLocations || []).map((s) => s.location)].filter(Boolean).join(" · "),
      text: [x.descriptionPlain, EMPLOYMENT[x.employmentType], remoteWord(x.workplaceType)].filter(Boolean).join(" "),
    })) };
  },
  async workable(slug) {
    const d = await getJson(`https://apply.workable.com/api/v1/widget/accounts/${encodeURIComponent(slug)}?details=true`);
    if (!d?.jobs) return null;
    return { name: d.name, jobs: d.jobs.map((x) => job({
      id: x.shortcode, title: x.title, company: d.name, url: x.url, posted: x.published_on || x.created_at,
      location: [x.city, x.country].filter(Boolean).join(", "),
      text: [textOf(x.description), textOf(x.requirements), x.employment_type, x.telecommuting ? "full remote" : ""].filter(Boolean).join(" "),
    })) };
  },
  async smartrecruiters(slug, wanted) {
    const d = await getJson(`https://api.smartrecruiters.com/v1/companies/${encodeURIComponent(slug)}/postings?limit=100`);
    if (!d?.content || !d.totalFound) return null;
    const items = d.content.filter((x) => wanted(x.name)).slice(0, DETAIL_LIMIT);
    const details = await Promise.all(items.map((x) =>
      getJson(`https://api.smartrecruiters.com/v1/companies/${encodeURIComponent(slug)}/postings/${x.id}`).catch(() => null)));
    return { name: d.content[0]?.company?.name, total: d.totalFound, jobs: items.map((x, i) => {
      const s = details[i]?.jobAd?.sections || {};
      return job({
        id: x.id, title: x.name, company: x.company?.name, location: x.location?.fullLocation || x.location?.city || "",
        url: details[i]?.postingUrl || `https://jobs.smartrecruiters.com/${slug}/${x.id}`, posted: x.releasedDate,
        text: [s.jobDescription?.text, s.qualifications?.text, s.additionalInformation?.text].map(textOf).join(" ")
          + ` ${x.typeOfEmployment?.label || ""} ${x.location?.remote ? "full remote" : x.location?.hybrid ? "hybrid" : ""}`,
      });
    }) };
  },
};

// A careers-page link → { provider, slug }, or null when it is not a recognised link.
export function parseCareersLink(input) {
  const s = String(input || "").trim();
  const rules = [
    ["greenhouse", /greenhouse\.io\/(?:embed\/job_board\?for=)?([\w-]+)/i],
    ["lever", /jobs\.lever\.co\/([\w.-]+)/i],
    ["ashby", /jobs\.ashbyhq\.com\/([\w.%-]+)/i],
    ["workable", /apply\.workable\.com\/(?!j\/)([\w-]+)/i],
    ["smartrecruiters", /(?:jobs|careers)\.smartrecruiters\.com\/([\w-]+)/i],
  ];
  for (const [provider, re] of rules) { const m = s.match(re); if (m) return { provider, slug: decodeURIComponent(m[1]) }; }
  return null;
}

// Find a company by careers link or by name (tries every provider with likely slugs). Returns found entries.
export async function findCompany(input) {
  const link = parseCareersLink(input);
  const base = norm(input).replace(/&/g, "and");
  const slugs = [...new Set([base.replace(/[^a-z0-9]/g, ""), base.replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")])].filter(Boolean);
  const tries = link ? [link] : Object.keys(FETCH).flatMap((provider) => slugs.map((slug) => ({ provider, slug })));
  const results = await Promise.all(tries.map(async (t) => {
    try {
      const r = await FETCH[t.provider](t.slug, () => false); // no per-job detail requests while searching
      return r ? { ...t, name: r.name, count: r.total ?? r.jobs.length } : null;
    } catch { return null; }
  }));
  // Lever and Ashby do not return the company name: use what the user typed, or a tidied slug for links.
  const typed = link ? "" : String(input).trim();
  const fromSlug = (s) => s.replace(/[-_.]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  return results.filter((r) => r && (r.count > 0 || link))
    .map((r) => ({ provider: r.provider, slug: r.slug, name: r.name || typed || fromSlug(r.slug), count: r.count }));
}

// Jobs of one watched company, kept for 30 minutes in memory. variant identifies the title filter (e.g. "de" or "all").
const cache = new Map();
export async function fetchCompanyJobs(entry, wanted, variant) {
  const k = `${entryKey(entry)}|${variant}`, hit = cache.get(k);
  if (hit && Date.now() - hit.at < 30 * 60_000) return hit.jobs;
  const r = await FETCH[entry.provider](entry.slug, wanted);
  if (!r) throw new Error(t("{name}: no careers page found on {provider} any more", { name: entry.name, provider: PROVIDER_NAMES[entry.provider] }));
  const jobs = r.jobs.filter((j) => j.url && wanted(j.title))
    .map((j) => ({ ...j, company: j.company || entry.name, source: entry.provider }));
  cache.set(k, { at: Date.now(), jobs });
  return jobs;
}
export const clearCompanyCache = () => cache.clear();
