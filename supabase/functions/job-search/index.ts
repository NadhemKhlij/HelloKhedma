// Supabase Edge Function: job-search
// Proxies France Travail, Adzuna, RapidAPI JSearch and Jooble so API keys never reach the browser, and two free key-less
// sources added 2026-11-09 that cannot (Himalayas: no CORS) or should not (Arbeitnow: 2 MB pages) be called from phones:
//   Himalayas (himalayas.app/jobs/api/search, remote jobs worldwide): kept when the job is open to the user's country or
//     worldwide; its terms: the apply link must be its applicationLink (we use it as the job URL), credit + link back
//     (offers.js CREDITS), no passing the jobs on to other job boards (we only show them). Public allowance, no key.
//   Arbeitnow (arbeitnow.com/api/job-board-api, Europe, mostly Germany, visa-sponsorship filter): no search, so the first
//     pages (300 jobs each) and the visa-sponsorship page are read at most once an hour into job_search_cache
//     ("arbeitnow-v1") and searched here by title; "please do not abuse, link back appreciated" (CREDITS links back).
//     Outside Germany, Austria and Switzerland only its remote jobs are kept.
// Both always run with "all" (no secret needed); their jobs mention "visa sponsorship" in `text` when Arbeitnow says so.
// Two sources with the owner's free accounts (2026-11-09; spec read from api.apprentissage.beta.gouv.fr/api/documentation/json):
//   La bonne alternance (LBA_API_TOKEN, French government, work-study offers, France only): GET /api/job/v1/search with a
//     Bearer token; no keyword search, so the career path (`path` in the request) picks ROME codes (LBA_ROMES) and the
//     place becomes a département (Geo API); titles are then kept when they share a word with the searched titles.
//   Careerjet (CAREERJET_API_KEY, publisher key for hellokhedma.io, ~90 country sites, no Tunisia): GET /v4/query, HTTP
//     Basic auth with the key as user name; its rules require the visitor's IP address and browser (user agent) with
//     every call (privacy policy); job links go through Careerjet's click tracking (its publisher model).
//
// Free quotas (checked 2026-11-09): Adzuna 250 calls a day, JSearch 200 a month, Jooble 500 for the life of the key. So:
//   - Adzuna asks for 50 offers a call (the maximum page size, same cost as 20);
//   - Jooble is no longer part of "all": it runs as a backup when the other sources found fewer than 10 offers on page 1
//     (or when chosen alone), and asks for 50 offers a call;
//   - "More offers" (page > 1) skips JSearch (its /search-v2 has no page numbers) and Jooble.
// French titles (owner request 2026-11-09): `alt` is the English title when `query` is the French one (Offers page, country
// France, career_paths.job_titles_fr): Adzuna is called for both titles, JSearch gets "fr" OR "en" in one call, and the
// English boards (Himalayas, Arbeitnow) get the English title.
//
// Secrets (supabase secrets set ...), each source is optional:
//   FRANCE_TRAVAIL_CLIENT_ID, FRANCE_TRAVAIL_CLIENT_SECRET
//                                   (francetravail.io, API "Offres d'emploi v2"; France only, full descriptions)
//   ADZUNA_APP_ID, ADZUNA_APP_KEY   (https://developer.adzuna.com)
//   RAPIDAPI_KEY                    (subscribe to "JSearch" on RapidAPI)
//   JOOBLE_API_KEY                  (jooble.org/api/about, free key by e-mail; aggregator, short snippets)
//   JOOBLE_HOST                     optional, normally unset: Jooble API host (default jooble.org; fr.jooble.org answers
//                                   403 to a jooble.org key, tested 2026-11-08)
//   DEFAULT_PROVIDER                optional: all | francetravail | adzuna | jsearch | jooble | himalayas | arbeitnow (default all)
//                                   "all" uses every source whose secrets are set.
//   CACHE_TTL_HOURS                 optional: how long identical searches are served from cache (default 6)
//   RATE_LIMIT_GUEST                optional: searches per hour per IP for guests (default 20)
//   RATE_LIMIT_USER                 optional: searches per hour per signed-in user (default 60)
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided by Supabase automatically.
//
// Request  (POST JSON): { query, alt?, path?, location?, provider?, country?, page?, filters? }   alt: see French titles
//   above; path: career path id (de, da, ba, as, do, ai), used by La bonne alternance
//   filters (Offers page, all optional): { contract: "CDI"|"CDD"|"Freelance"|"Internship"|"Apprenticeship",
//   remote: "Remote"|"any-remote", days: 1|3|7|30 }. Sent to the sources that support them (Adzuna: max_days_old,
//   permanent / contract, newest first when a date is asked; JSearch: date_posted, employment_types, work_from_home);
//   the app filters the results again, so a source without the filter is still right.
// Response (JSON):      { jobs: Job[], warnings: string[], cached?: true }   429 when rate limited
// Salary statistics (Home market pulse): { kind: "salary", query, country } → { histogram: [[from, count]..],
//   history: [["YYYY-MM", average]..], currency } from Adzuna (all its offers for that title), cached 24 h.
// Each Job carries the provider's salary as text (`salary`, Adzuna estimates flagged), read by js/salary.js.
//
// Cache (job_search_cache, 6 h) and rate limit (job_search_hits) come from migration 20261028000200; each allowed search
// also bumps the anonymous daily counter usage_daily (count_usage(), migration 20261106000200, admin page). Guests are
// limited per IP stored only as a SHA-256 hash, purged after 24 h, as stated in the privacy policy.
// Deploying from the dashboard: paste from a commit-pinned raw GitHub link (the plain raw link is cached ~5 min).

import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type Source = "francetravail" | "adzuna" | "jsearch" | "jooble" | "himalayas" | "arbeitnow" | "lba" | "careerjet";
// Per-request details some sources need: the visitor's IP and browser (Careerjet's rule), the career path (LBA codes).
type Ctx = { ip: string; ua: string; path: string };
type Job = {
  id: string;
  title: string;
  company: string;
  location: string;
  url: string;
  posted: string | null;
  snippet: string;
  text: string; // longer description, used by the app to detect skills
  source: Source;
  // The provider's own salary, as text the app reads (js/salary.js), e.g. "40000-45000 EUR per year". Empty when the
  // provider gives none; the app then looks for a salary in the description. Estimated = computed by the job site.
  salary: string;
  salaryEstimated?: boolean;
};

// Currencies the app's salary reader understands; other currencies are left out rather than shown wrongly.
const SALARY_CURRENCIES = new Set(["EUR", "USD", "GBP", "CHF"]);
const salaryText = (min: unknown, max: unknown, currency: string, period = "year") => {
  const lo = Number(min), hi = Number(max) || lo;
  return lo > 0 && SALARY_CURRENCIES.has(currency) ? `${Math.round(lo)}-${Math.round(hi)} ${currency} per ${period.toLowerCase()}` : "";
};
// Adzuna gives amounts in the country's currency, per year.
const ADZUNA_CURRENCY: Record<string, string> = {
  fr: "EUR", de: "EUR", nl: "EUR", be: "EUR", es: "EUR", it: "EUR", at: "EUR", gb: "GBP", us: "USD", ch: "CHF",
};

const COUNTRIES = new Set([
  "fr", "gb", "us", "de", "nl", "ca", "au", "at", "be", "ch", "es", "it", "pl", "br", "in", "nz", "sg", "za", "mx",
]);

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

const strip = (s: unknown, max = 280) =>
  String(s ?? "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, max);

// Duplicate detection across sources: the same offer is written slightly differently on each one ("Data Engineer
// (H/F)" vs "Data engineer F/H", "Acme SAS" vs "ACME").
const fold = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const dedupeTitle = (s: string) => fold(s).replace(/\(?\b(h\s*\/\s*f|f\s*\/\s*h|m\s*\/\s*w\s*\/\s*d|m\s*\/\s*f)\b\)?/g, " ")
  .replace(/[^a-z0-9+#]+/g, " ").trim();
const dedupeCompany = (s: string) => fold(s).replace(/\b(sas|sasu|sa|sarl|ltd|limited|inc|gmbh|llc|plc|group|groupe)\b\.?/g, " ")
  .replace(/[^a-z0-9]+/g, " ").trim();

const envNum = (name: string, fallback: number) => Number(Deno.env.get(name)) || fallback;
const CACHE_TTL_MS = envNum("CACHE_TTL_HOURS", 6) * 3600_000;
const LIMIT_GUEST = envNum("RATE_LIMIT_GUEST", 20);
const LIMIT_USER = envNum("RATE_LIMIT_USER", 60);

// Service-role client for the cache and rate-limit tables (never exposed to the browser).
const supabaseUrl = Deno.env.get("SUPABASE_URL");
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const admin = supabaseUrl && serviceKey
  ? createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })
  : null;

// Signed-in users are limited per account, guests (anon key) per IP. IPs are stored only as a keyed hash
// (HMAC-SHA-256 with a server-only key): a plain hash of an IPv4 address could be reversed by trying them all, a keyed
// one cannot without the key (privacy policy: no raw IP addresses kept). Rows older than 24 h are purged on every call.
let hmacKey: Promise<CryptoKey> | null = null;
async function ipHash(ip: string): Promise<string> {
  hmacKey ||= crypto.subtle.importKey("raw", new TextEncoder().encode(`hk-rate-limit:${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""}`),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", await hmacKey, new TextEncoder().encode(ip));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
async function rateBucket(req: Request): Promise<{ bucket: string; limit: number }> {
  const token = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
  if (admin && token) {
    const { data } = await admin.auth.getUser(token);
    if (data?.user) return { bucket: `user:${data.user.id}`, limit: LIMIT_USER };
  }
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown";
  return { bucket: `ip:${await ipHash(ip)}`, limit: LIMIT_GUEST };
}

// deno-lint-ignore no-explicit-any
type Raw = any;
type Filters = { contract: string; remote: string; days: number };
const CONTRACTS = new Set(["CDI", "CDD", "Freelance", "Internship", "Apprenticeship"]);
function readFilters(f: Raw): Filters {
  const days = Number(f?.days);
  return {
    contract: CONTRACTS.has(f?.contract) ? f.contract : "",
    remote: f?.remote === "Remote" || f?.remote === "any-remote" ? f.remote : "",
    days: [1, 3, 7, 30].includes(days) ? days : 0,
  };
}

// The provider's own error text (shortened), so a failing source says why in the app's search message.
async function providerMessage(res: Response): Promise<string> {
  const text = await res.text().catch(() => "");
  try { const j = JSON.parse(text); return String(j.message ?? j.error ?? j.exception ?? text).slice(0, 160); } catch { return text.slice(0, 160) || "no details"; }
}

const configured: Record<Source, () => boolean> = {
  francetravail: () => Boolean(Deno.env.get("FRANCE_TRAVAIL_CLIENT_ID") && Deno.env.get("FRANCE_TRAVAIL_CLIENT_SECRET")),
  adzuna: () => Boolean(Deno.env.get("ADZUNA_APP_ID") && Deno.env.get("ADZUNA_APP_KEY")),
  jsearch: () => Boolean(Deno.env.get("RAPIDAPI_KEY")),
  himalayas: () => true,
  arbeitnow: () => true,
  lba: () => Boolean(Deno.env.get("LBA_API_TOKEN")),
  careerjet: () => Boolean(Deno.env.get("CAREERJET_API_KEY")),
  jooble: () => Boolean(Deno.env.get("JOOBLE_API_KEY")),
};

// France Travail: OAuth2 client-credentials token, reused until shortly before it expires.
let ftToken: { value: string; expires: number } | null = null;
async function franceTravailToken(): Promise<string> {
  if (ftToken && ftToken.expires > Date.now()) return ftToken.value;
  const res = await fetch("https://entreprise.francetravail.fr/connexion/oauth2/access_token?realm=%2Fpartenaire", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: Deno.env.get("FRANCE_TRAVAIL_CLIENT_ID") ?? "",
      client_secret: Deno.env.get("FRANCE_TRAVAIL_CLIENT_SECRET") ?? "",
      scope: "api_offresdemploiv2 o2dsoffre",
    }),
  });
  if (!res.ok) throw new Error(`France Travail login failed (${res.status}). Check the client id/secret and the API subscription.`);
  const data = await res.json();
  ftToken = { value: data.access_token, expires: Date.now() + (Number(data.expires_in) || 1400) * 1000 - 60_000 };
  return ftToken.value;
}

// France Travail filters by département, not free text: turn "Lyon", "69" or "69003" into a département code.
async function departementOf(where: string): Promise<string | null> {
  if (/^(\d{2}|2[ab]|97\d)$/i.test(where)) return where.toUpperCase();
  const q = /^\d{5}$/.test(where) ? `codePostal=${where}` : `nom=${encodeURIComponent(where)}&boost=population`;
  const res = await fetch(`https://geo.api.gouv.fr/communes?${q}&fields=codeDepartement&limit=1`);
  if (!res.ok) return null;
  return (await res.json())[0]?.codeDepartement ?? null;
}

async function franceTravail(q: string, where: string, country: string, page: number, f: Filters): Promise<Job[]> {
  if (!configured.francetravail()) throw new Error("France Travail is not configured (FRANCE_TRAVAIL_CLIENT_ID / _SECRET).");
  if (country !== "fr") throw new Error("France Travail only covers France.");
  const params = new URLSearchParams({ motsCles: q, range: `${(page - 1) * 20}-${page * 20 - 1}`, sort: "1" });
  if (f.days) params.set("publieeDepuis", String(f.days === 30 ? 31 : f.days)); // France Travail accepts 1, 3, 7, 14 or 31
  const ftContract: Record<string, string> = { CDI: "CDI", CDD: "CDD", Freelance: "LIB" };
  if (ftContract[f.contract]) params.set("typeContrat", ftContract[f.contract]);
  if (where) {
    const dep = await departementOf(where);
    if (!dep) throw new Error(`France Travail: location "${where}" not recognised. Try a city, a postcode or a département number.`);
    params.set("departement", dep);
  }
  const res = await fetch(`https://api.francetravail.io/partenaire/offresdemploi/v2/offres/search?${params}`, {
    headers: { Authorization: `Bearer ${await franceTravailToken()}`, Accept: "application/json" },
  });
  if (res.status === 204) return []; // no offers
  if (!res.ok) throw new Error(`France Travail returned ${res.status}.`);
  const data = await res.json();
  return (data.resultats ?? []).map((x: Raw): Job => ({
    id: String(x.id),
    title: strip(x.intitule),
    company: x.entreprise?.nom ?? "",
    location: x.lieuTravail?.libelle ?? "",
    url: x.origineOffre?.urlOrigine || `https://candidat.francetravail.fr/offres/recherche/detail/${x.id}`,
    posted: x.dateCreation ?? null,
    snippet: strip(x.description),
    // Full description plus the structured skills and training fields.
    text: strip([
      x.description,
      ...(x.competences ?? []).map((c: Raw) => c.libelle),
      ...(x.formations ?? []).map((f: Raw) => [f.domaineLibelle, f.niveauLibelle].filter(Boolean).join(" ")),
      ...(x.langues ?? []).map((l: Raw) => l.libelle),
    ].filter(Boolean).join(" "), 6000),
    source: "francetravail",
    salary: strip(x.salaire?.libelle ?? ""), // e.g. "Annuel de 40000.0 Euros à 45000.0 Euros sur 12.0 mois"
  }));
}

async function adzuna(q: string, where: string, country: string, page: number, f: Filters, alt = ""): Promise<Job[]> {
  if (alt) return (await Promise.all([adzuna(q, where, country, page, f), adzuna(alt, where, country, page, f)])).flat();
  const appId = Deno.env.get("ADZUNA_APP_ID");
  const appKey = Deno.env.get("ADZUNA_APP_KEY");
  if (!appId || !appKey) throw new Error("Adzuna is not configured (ADZUNA_APP_ID / ADZUNA_APP_KEY).");

  const url = new URL(`https://api.adzuna.com/v1/api/jobs/${country}/search/${page}`);
  url.search = new URLSearchParams({
    app_id: appId,
    app_key: appKey,
    results_per_page: "50",
    what: q,
    ...(where ? { where } : {}),
    ...(f.days ? { max_days_old: String(f.days), sort_by: "date" } : {}),
    ...(f.contract === "CDI" ? { permanent: "1" } : f.contract === "CDD" || f.contract === "Freelance" ? { contract: "1" } : {}),
  }).toString();

  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`Adzuna returned ${res.status}: ${await providerMessage(res)}`);
  const data = await res.json();
  return (data.results ?? []).map((x: Raw): Job => ({
    id: String(x.id),
    title: strip(x.title),
    company: x.company?.display_name ?? "",
    location: x.location?.display_name ?? "",
    url: x.redirect_url,
    posted: x.created ?? null,
    snippet: strip(x.description),
    text: strip(x.description, 4000), // Adzuna itself only returns the first ~500 characters
    source: "adzuna",
    salary: salaryText(x.salary_min, x.salary_max, ADZUNA_CURRENCY[country] ?? ""),
    salaryEstimated: String(x.salary_is_predicted) === "1", // Adzuna's own estimate, not the employer's figure
  }));
}

// JSearch employment types, written the way the app's contract detection reads them.
const EMPLOYMENT: Record<string, string> = {
  FULLTIME: "full-time", PARTTIME: "part-time", CONTRACTOR: "contractor", INTERN: "internship", // full-time ≠ CDI
};

async function jsearch(q: string, where: string, country: string, page: number, f: Filters, alt = ""): Promise<Job[]> {
  const key = Deno.env.get("RAPIDAPI_KEY");
  if (!key) throw new Error("JSearch is not configured (RAPIDAPI_KEY).");
  if (page > 1) return []; // /search-v2 pages with a cursor only: never spend a credit to get page 1 again
  if (alt) q = `"${q}" OR "${alt}"`; // Google for Jobs understands OR

  // JSearch replaced /search with /search-v2 (cursor pagination, same job fields); older plans may still have /search.
  // The app only asks for page 1, so no cursor is needed.
  const query = where ? `${q} in ${where}` : q;
  const call = (path: string, params: Record<string, string>) => {
    const url = new URL(`https://jsearch.p.rapidapi.com${path}`);
    url.search = new URLSearchParams(params).toString();
    return fetch(url, { headers: { "X-RapidAPI-Key": key, "X-RapidAPI-Host": "jsearch.p.rapidapi.com" } });
  };
  const datePosted: Record<number, string> = { 1: "today", 3: "3days", 7: "week", 30: "month" };
  const types: Record<string, string> = { Freelance: "CONTRACTOR", Internship: "INTERN" }; // FULLTIME ≠ CDI: not sent
  const extra: Record<string, string> = {
    ...(f.days ? { date_posted: datePosted[f.days] } : {}),
    ...(types[f.contract] ? { employment_types: types[f.contract] } : {}),
    ...(f.remote === "Remote" ? { work_from_home: "true" } : {}),
  };
  let res = await call("/search-v2", { query, country, ...(country === "fr" ? { language: "fr" } : {}), ...extra });
  if (res.status === 404) res = await call("/search", { query, country, page: String(page), num_pages: "1", ...extra });
  if (!res.ok) throw new Error(`JSearch returned ${res.status}: ${await providerMessage(res)}`);
  const data = await res.json();
  // /search returned { data: [jobs] }; /search-v2 nests the list (e.g. { data: { jobs: [...], cursor } }).
  // Take the first array of job objects found up to two levels deep.
  const isJobs = (v: Raw) => Array.isArray(v) && (v.length === 0 || (v[0] && typeof v[0] === "object" && "job_id" in v[0]));
  const candidates = [data, data?.data, ...Object.values(data ?? {}), ...Object.values(data?.data ?? {})];
  const list: Raw[] | undefined = candidates.find(isJobs) ??
    candidates.flatMap((v) => (v && typeof v === "object" ? Object.values(v) : [])).find(isJobs);
  if (!list) {
    throw new Error(`JSearch: unexpected response shape (top keys: ${Object.keys(data ?? {}).join(", ")}; data keys: ${
      data?.data && typeof data.data === "object" ? Object.keys(data.data).join(", ") : typeof data?.data})`);
  }
  return list.map((x: Raw): Job => ({
    id: String(x.job_id),
    title: strip(x.job_title),
    company: x.employer_name ?? "",
    location: [x.job_city, x.job_state, x.job_country].filter(Boolean).join(", "),
    url: x.job_apply_link,
    posted: x.job_posted_at_datetime_utc ?? null,
    snippet: strip(x.job_description),
    // Description + structured fields: the app detects skills, contract type and remote policy from this text.
    text: strip([
      x.job_description,
      ...(x.job_highlights?.Qualifications ?? []),
      ...(x.job_required_skills ?? []),
      ...(x.job_employment_types ?? [x.job_employment_type]).filter(Boolean).map((t: string) => EMPLOYMENT[t] ?? t),
      x.job_is_remote ? "full remote" : "",
    ].filter(Boolean).join(" "), 6000),
    source: "jsearch",
    salary: salaryText(x.job_min_salary, x.job_max_salary, String(x.job_salary_currency ?? ""), String(x.job_salary_period || "year")),
  }));
}

// Jooble: an aggregator (many job boards and countries). POST https://<host>/api/<key> with { keywords, location, page };
// answers { totalCount, jobs: [{ id, title, company, location, snippet, salary, type, link, updated, source }] }.
// The location decides the country: without a city, the country's name is sent. Snippets are short (~250 chars), so
// Jooble comes last in the dedupe (a longer description from another source wins). Salary is free text ("€45k"…): it
// goes into the text, where the app's salary reader looks for it.
const COUNTRY_NAMES: Record<string, string> = {
  fr: "France", gb: "United Kingdom", us: "USA", de: "Germany", nl: "Netherlands", ca: "Canada", au: "Australia",
  at: "Austria", be: "Belgium", ch: "Switzerland", es: "Spain", it: "Italy", pl: "Poland", br: "Brazil", in: "India",
  nz: "New Zealand", sg: "Singapore", za: "South Africa", mx: "Mexico",
};
async function jooble(q: string, where: string, country: string, page: number, _f: Filters): Promise<Job[]> {
  const key = Deno.env.get("JOOBLE_API_KEY");
  if (!key) throw new Error("Jooble is not configured (JOOBLE_API_KEY).");
  const host = (Deno.env.get("JOOBLE_HOST") || "jooble.org").replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  const location = where ? (country === "fr" || !COUNTRY_NAMES[country] ? where : `${where}, ${COUNTRY_NAMES[country]}`) : COUNTRY_NAMES[country] ?? "";
  const call = async (loc: string) => {
    const res = await fetch(`https://${host}/api/${encodeURIComponent(key)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ keywords: q, location: loc, page: String(page), ResultOnPage: "50" }),
    });
    if (!res.ok) throw new Error(`Jooble (${host}) returned ${res.status}: ${(await providerMessage(res)).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, 100)}`);
    return await res.json();
  };
  let data = await call(location);
  // An empty answer with a country name as the location: try again without a location (some keys are tied to one
  // country site, which then searches its own country).
  if (!(data?.jobs ?? []).length && location && !where) data = await call("");
  if (!Array.isArray(data?.jobs) || !data.jobs.length) {
    // Said in the app's search message (and not cached): helps to see a wrong host or key setting at once.
    throw new Error(`Jooble (${host}) found no offer for "${q}"${location ? ` in "${location}"` : ""} (totalCount: ${data?.totalCount ?? "?"}; answer fields: ${
      Object.keys(data ?? {}).join(", ") || "none"}). Try a wider search (no city, other words).`);
  }
  return data.jobs.map((x: Raw): Job => ({
    id: String(x.id ?? x.link),
    title: strip(x.title),
    company: strip(x.company, 120),
    location: strip(x.location, 120),
    url: x.link,
    posted: x.updated ?? null,
    snippet: strip(x.snippet),
    text: strip([x.snippet, x.type, x.salary].filter(Boolean).join(" "), 2000),
    source: "jooble",
    salary: "",
  }));
}

// ---------- Himalayas (remote jobs) ----------
// Names Himalayas uses in locationRestrictions, per country code (worldwide jobs have no restriction).
const HIMALAYAS_NAMES: Record<string, string[]> = { us: ["United States", "USA"], gb: ["United Kingdom", "UK"] };
const EUROPE = new Set(["fr", "gb", "de", "nl", "at", "be", "ch", "es", "it", "pl"]);
async function himalayas(q: string, _where: string, country: string, page: number, f: Filters, alt = ""): Promise<Job[]> {
  if (alt) q = alt; // an English board: the English title
  const res = await fetch(`https://himalayas.app/jobs/api/search?q=${encodeURIComponent(q)}&page=${page}`, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`Himalayas returned ${res.status}: ${(await providerMessage(res)).slice(0, 100)}`);
  const data = await res.json();
  const names = [...(HIMALAYAS_NAMES[country] ?? []), COUNTRY_NAMES[country]].filter(Boolean).map((n) => n.toLowerCase());
  const open = (r: string[]) => !r?.length || r.some((x) => names.includes(String(x).toLowerCase())
    || (EUROPE.has(country) && /europe|emea/i.test(String(x))));
  const since = f.days ? Date.now() - f.days * 86400_000 : 0;
  return (data?.jobs ?? []).filter((x: Raw) => x.applicationLink && open(x.locationRestrictions) && (!since || x.pubDate * 1000 >= since))
    .map((x: Raw): Job => ({
      id: String(x.guid ?? x.applicationLink),
      title: strip(x.title, 200),
      company: strip(x.companyName, 120),
      location: x.locationRestrictions?.length ? `Remote (${x.locationRestrictions.slice(0, 4).join(", ")})` : "Remote (worldwide)",
      url: x.applicationLink, // required by Himalayas' terms
      posted: x.pubDate ? new Date(x.pubDate * 1000).toISOString() : null,
      snippet: strip(x.excerpt || x.description),
      text: strip(["full remote", x.employmentType, ...(x.seniority ?? []), ...(x.categories ?? []), x.description].filter(Boolean).join(" "), 4000),
      source: "himalayas",
      salary: salaryText(x.minSalary, x.maxSalary, String(x.currency ?? ""), x.salaryPeriod === "annual" || !x.salaryPeriod ? "year" : String(x.salaryPeriod)),
    }));
}

// ---------- Arbeitnow (Europe, mostly Germany) ----------
type Arbeit = { title: string; company: string; location: string; remote: boolean; url: string; created: number; text: string; visa: boolean };
async function arbeitnowPages(): Promise<Arbeit[]> {
  const key = "arbeitnow-v1";
  if (admin) {
    const { data: hit } = await admin.from("job_search_cache").select("results")
      .eq("key", key).gte("created_at", new Date(Date.now() - 3600_000).toISOString()).maybeSingle();
    if (hit?.results?.items) return hit.results.items as Arbeit[];
  }
  const get = async (qs: string) => {
    const res = await fetch(`https://www.arbeitnow.com/api/job-board-api${qs}`, { headers: { Accept: "application/json" } });
    if (!res.ok) throw new Error(`Arbeitnow returned ${res.status}`);
    return ((await res.json())?.data ?? []) as Raw[];
  };
  const [p1, p2, visa] = await Promise.all([get("?page=1"), get("?page=2").catch(() => []), get("?visa_sponsorship=true").catch(() => [])]);
  const visaSlugs = new Set(visa.map((x) => x.slug));
  const seen = new Set<string>();
  const items = [...p1, ...p2, ...visa].filter((x) => x?.url && !seen.has(x.slug) && seen.add(x.slug)).map((x): Arbeit => ({
    title: strip(x.title, 200), company: strip(x.company_name, 120), location: strip(x.location, 120), remote: Boolean(x.remote),
    url: x.url, created: Number(x.created_at) || 0, visa: visaSlugs.has(x.slug),
    text: strip([...(x.job_types ?? []), ...(x.tags ?? []), x.description].join(" "), 1500),
  }));
  if (admin && items.length) await admin.from("job_search_cache").upsert({ key, results: { items }, created_at: new Date().toISOString() });
  return items;
}
async function arbeitnow(q: string, where: string, country: string, _page: number, f: Filters, alt = ""): Promise<Job[]> {
  if (alt) q = alt; // English (and German) offers: the English title
  const words = fold(q).split(/[^a-z0-9+#]+/).filter((w) => w.length > 1);
  if (!words.length) return [];
  const local = ["de", "at", "ch"].includes(country);
  const since = f.days ? Date.now() - f.days * 86400_000 : 0;
  const place = fold(where);
  return (await arbeitnowPages())
    .filter((x) => words.every((w) => fold(x.title).includes(w)))
    .filter((x) => (local ? !place || fold(x.location).includes(place) || x.remote : x.remote))
    .filter((x) => !since || x.created * 1000 >= since)
    .slice(0, 40)
    .map((x): Job => ({
      id: x.url, title: x.title, company: x.company, location: x.remote ? `${x.location} (remote)` : x.location, url: x.url,
      posted: x.created ? new Date(x.created * 1000).toISOString() : null,
      snippet: x.text.slice(0, 280),
      text: `${x.remote ? "full remote " : ""}${x.visa ? "visa sponsorship " : ""}${x.text}`,
      source: "arbeitnow",
      salary: "",
    }));
}

// ---------- La bonne alternance (work-study offers, France) ----------
// ROME codes (France Travail's job directory) per career path.
const LBA_ROMES: Record<string, string> = {
  de: "M1805,M1810", da: "M1403,M1805", ba: "M1806", as: "M1810,M1802", do: "M1801,M1810", ai: "M1805,M1403",
};
async function lba(q: string, where: string, country: string, page: number, f: Filters, alt = "", ctx?: Ctx): Promise<Job[]> {
  const token = Deno.env.get("LBA_API_TOKEN");
  if (!token) throw new Error("La bonne alternance is not configured (LBA_API_TOKEN).");
  if (country !== "fr" || page > 1) return [];
  const romes = LBA_ROMES[ctx?.path ?? ""] ?? "M1805";
  const url = new URL("https://api.apprentissage.beta.gouv.fr/api/job/v1/search");
  url.searchParams.set("romes", romes);
  const dep = where ? await departementOf(where).catch(() => null) : null;
  if (dep) url.searchParams.append("departements", dep);
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" } });
  if (!res.ok) throw new Error(`La bonne alternance returned ${res.status}: ${(await providerMessage(res)).slice(0, 120)}`);
  const data = await res.json();
  const words = new Set(fold(`${q} ${alt}`).split(/[^a-z0-9+#]+/).filter((w) => w.length > 2 && !["les", "des", "and", "the"].includes(w)));
  const since = f.days ? Date.now() - f.days * 86400_000 : 0;
  return (data?.jobs ?? [])
    .filter((x: Raw) => x?.offer?.title && x?.apply?.url)
    .filter((x: Raw) => fold(x.offer.title).split(/[^a-z0-9+#]+/).some((w: string) => words.has(w)))
    .filter((x: Raw) => !since || !x.offer.publication?.creation || new Date(x.offer.publication.creation).getTime() >= since)
    .slice(0, 50)
    .map((x: Raw): Job => ({
      id: String(x.identifier?.id ?? x.apply.url),
      title: strip(x.offer.title, 200),
      company: strip(x.workplace?.name || x.workplace?.brand || x.workplace?.legal_name, 120),
      location: strip(x.workplace?.location?.address, 120),
      url: x.apply.url,
      posted: x.offer.publication?.creation ?? null,
      snippet: strip(x.offer.description),
      text: strip(["alternance apprenticeship", [].concat(x.contract?.type ?? []).join(" "), x.contract?.remote, x.offer.description,
        [].concat(x.offer.desired_skills ?? []).join(" ")].filter(Boolean).join(" "), 4000),
      source: "lba",
      salary: "",
    }));
}

// ---------- Careerjet (publisher API) ----------
const CAREERJET_LOCALES: Record<string, string> = {
  fr: "fr_FR", gb: "en_GB", us: "en_US", de: "de_DE", nl: "nl_NL", ca: "en_CA", au: "en_AU", at: "de_AT", be: "fr_BE",
  ch: "fr_CH", es: "es_ES", it: "it_IT", pl: "pl_PL", br: "pt_BR", in: "en_IN", nz: "en_NZ", sg: "en_SG", za: "en_ZA", mx: "es_MX",
};
async function careerjet(q: string, where: string, country: string, page: number, _f: Filters, _alt = "", ctx?: Ctx): Promise<Job[]> {
  const key = Deno.env.get("CAREERJET_API_KEY");
  if (!key) throw new Error("Careerjet is not configured (CAREERJET_API_KEY).");
  const call = async (loc: string) => {
    const url = new URL("https://search.api.careerjet.net/v4/query");
    for (const [k, v] of Object.entries({ keywords: q, locale_code: CAREERJET_LOCALES[country] ?? "en_GB", page_size: "50",
      page: String(Math.min(page, 10)), user_ip: ctx?.ip || "127.0.0.1", user_agent: ctx?.ua || "HelloKhedma", ...(loc ? { location: loc } : {}) })) {
      url.searchParams.set(k, v);
    }
    const res = await fetch(url, { headers: { Authorization: `Basic ${btoa(`${key}:`)}`, Accept: "application/json" } });
    if (!res.ok) throw new Error(`Careerjet returned ${res.status}: ${(await providerMessage(res)).slice(0, 120)}`);
    return await res.json();
  };
  let data = await call(where);
  if (data?.type === "LOCATIONS" && where) data = await call(""); // place not found or ambiguous: whole country
  return (data?.jobs ?? []).filter((x: Raw) => x?.url && x?.title).map((x: Raw): Job => ({
    id: String(x.url),
    title: strip(x.title, 200),
    company: strip(x.company, 120),
    location: strip(Array.isArray(x.locations) ? x.locations.join(", ") : x.locations, 120),
    url: x.url,
    posted: x.date ? new Date(x.date).toISOString() : null,
    snippet: strip(x.description),
    text: strip([x.description, x.salary].filter(Boolean).join(" "), 2000),
    source: "careerjet",
    salary: strip(x.salary, 80),
  }));
}

// Adzuna salary statistics for one job title in one country (Home market pulse): the distribution of advertised
// salaries (histogram: lower bound of each band → number of offers) and the average advertised salary per month.
async function salaryStats(q: string, country: string) {
  const appId = Deno.env.get("ADZUNA_APP_ID"), appKey = Deno.env.get("ADZUNA_APP_KEY");
  if (!appId || !appKey) throw new Error("Adzuna is not configured (ADZUNA_APP_ID / ADZUNA_APP_KEY).");
  const get = async (path: string, extra: Record<string, string> = {}) => {
    const url = new URL(`https://api.adzuna.com/v1/api/jobs/${country}/${path}`);
    url.search = new URLSearchParams({ app_id: appId, app_key: appKey, what: q, ...extra }).toString();
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) throw new Error(`Adzuna ${path} returned ${res.status}: ${await providerMessage(res)}`);
    return await res.json();
  };
  const [hist, history] = await Promise.all([get("histogram"), get("history", { months: "12" }).catch(() => ({}))]);
  const pairs = (o: Raw) => Object.entries(o && typeof o === "object" ? o : {})
    .map(([k, v]) => [k, Number(v)] as [string, number]).filter(([, v]) => Number.isFinite(v) && v > 0);
  return {
    histogram: pairs(hist?.histogram).map(([k, v]) => [Number(k), v]).filter(([k]) => Number.isFinite(k)).sort((a, b) => a[0] - b[0]),
    history: pairs(history?.month).sort((a, b) => a[0].localeCompare(b[0])),
    currency: ADZUNA_CURRENCY[country] ?? "",
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Use POST." }, 405);

  let body: Raw;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body." }, 400);
  }

  const query = String(body.query ?? "").trim().slice(0, 100);
  if (!query) return json({ error: "query is required." }, 400);

  const where = String(body.location ?? "").trim().slice(0, 100);
  const altRaw = String(body.alt ?? "").trim().slice(0, 100);
  const alt = altRaw.toLowerCase() === query.toLowerCase() ? "" : altRaw;
  const country = COUNTRIES.has(String(body.country)) ? String(body.country) : "fr";
  const page = Math.min(Math.max(parseInt(body.page, 10) || 1, 1), 5);

  if (body.kind === "salary") {
    // Cached 24 h per country + title; rate-limited like searches (own bucket) so a caller cannot drain the quota.
    const key = ["salary1", country, query.toLowerCase()].join("|");
    if (admin) {
      const { bucket, limit } = await rateBucket(req);
      const { data: allowed } = await admin.rpc("job_search_hit", { p_bucket: `salary:${bucket}`, p_limit: limit, p_window_seconds: 3600 });
      if (allowed === false) return json({ error: "Too many requests in the last hour. Please try again later." }, 429);
      const { data: hit } = await admin.from("job_search_cache").select("results")
        .eq("key", key).gte("created_at", new Date(Date.now() - 24 * 3600_000).toISOString()).maybeSingle();
      if (hit) return json({ ...hit.results, cached: true });
    }
    try {
      const stats = await salaryStats(query, country);
      if (admin && stats.histogram.length) {
        await admin.from("job_search_cache").upsert({ key, results: stats, created_at: new Date().toISOString() });
      }
      return json(stats);
    } catch (e) { return json({ error: e instanceof Error ? e.message : "Salary statistics failed." }, 502); }
  }
  const filters = readFilters(body.filters);
  const wanted = String(body.provider ?? Deno.env.get("DEFAULT_PROVIDER") ?? "all");
  // France Travail comes first so that, for an offer listed on several sources, its full description wins the dedupe.
  const ALL: Source[] = ["francetravail", "adzuna", "jsearch", "jooble", "himalayas", "arbeitnow", "careerjet", "lba"];
  const all = wanted === "all" || wanted === "both";
  const providers: Source[] = all
    ? ALL.filter((p) => configured[p]() && !(p === "francetravail" && country !== "fr") && p !== "jooble" && !(p === "jsearch" && page > 1))
    : ALL.includes(wanted as Source) ? [wanted as Source] : ["adzuna"];
  if (!providers.length) return json({ error: "No job source is configured for this country." }, 502);

  const ctx: Ctx = {
    ip: req.headers.get("cf-connecting-ip") || req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "",
    ua: (req.headers.get("user-agent") || "").slice(0, 300),
    path: /^(de|da|ba|as|do|ai)$/.test(String(body.path)) ? String(body.path) : "",
  };
  // Guard and cache need the migration 20261028000200_job_search_guard.sql; if it is missing we log and carry on.
  // "v5": La bonne alternance (needs the path) and Careerjet (2026-11-09); a new key skips entries cached before.
  const cacheKey = ["v5", providers.join("+"), country, query.toLowerCase(), alt.toLowerCase(), ctx.path, where.toLowerCase(), page,
    filters.contract, filters.remote, filters.days].join("|");
  if (admin) {
    const { bucket, limit } = await rateBucket(req);
    const { data: allowed, error } = await admin.rpc("job_search_hit", {
      p_bucket: bucket, p_limit: limit, p_window_seconds: 3600,
    });
    if (error) console.error("rate limit check failed:", error.message);
    // Rate-limit rows (keyed hashes, account ids) are kept 24 h at most: purged on every call.
    await admin.from("job_search_hits").delete().lt("window_start", new Date(Date.now() - 24 * 3600_000).toISOString());
    if (!error && allowed === false) {
      return json({ error: "Too many searches in the last hour. Please try again later." }, 429);
    }
    // Anonymous daily counter for the admin page (day + count only; migration 20261106000200). Never blocks a search.
    const { error: countErr } = await admin.rpc("count_usage", { p_kind: "job_search" });
    if (countErr) console.error("usage count failed:", countErr.message);

    const { data: hit, error: cacheErr } = await admin.from("job_search_cache").select("results")
      .eq("key", cacheKey).gte("created_at", new Date(Date.now() - CACHE_TTL_MS).toISOString()).maybeSingle();
    if (cacheErr) console.error("cache read failed:", cacheErr.message);
    else if (hit) return json({ ...hit.results, cached: true });
  }

  const fetchers = { francetravail: franceTravail, adzuna, jsearch, jooble, himalayas, arbeitnow, lba, careerjet };
  const results = await Promise.allSettled(providers.map((p) => fetchers[p](query, where, country, page, filters, alt, ctx)));
  // Jooble as a backup (lifetime quota): only when the other sources found fewer than 10 offers on the first page.
  const found = results.reduce((n, r) => n + (r.status === "fulfilled" ? r.value.length : 0), 0);
  if (all && page === 1 && found < 10 && configured.jooble()) {
    const [backup] = await Promise.allSettled([jooble(query, where, country, page, filters)]);
    if (backup.status === "fulfilled") results.push(backup); // a failed or empty backup is not a warning
  }

  const warnings: string[] = [];
  const seen = new Set<string>();
  const jobs: Job[] = [];
  for (const r of results) {
    if (r.status === "rejected") {
      warnings.push(r.reason instanceof Error ? r.reason.message : "A provider failed.");
      continue;
    }
    for (const j of r.value) {
      const key = `${dedupeTitle(j.title)}|${dedupeCompany(j.company)}`;
      if (!j.url || seen.has(key)) continue;
      seen.add(key);
      jobs.push(j);
    }
  }

  if (!jobs.length && warnings.length === providers.length) {
    return json({ error: warnings.join(" ") }, 502);
  }
  jobs.sort((a, b) => (b.posted ?? "").localeCompare(a.posted ?? ""));

  // Only cache complete answers, so a provider outage is not served for hours.
  if (admin && jobs.length && !warnings.length) {
    const { error } = await admin.from("job_search_cache")
      .upsert({ key: cacheKey, results: { jobs, warnings }, created_at: new Date().toISOString() });
    if (error) console.error("cache write failed:", error.message);
    await admin.from("job_search_cache").delete().lt("created_at", new Date(Date.now() - CACHE_TTL_MS).toISOString());
  }
  return json({ jobs, warnings });
});
