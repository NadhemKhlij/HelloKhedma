// Supabase Edge Function: job-search
// Proxies France Travail, Adzuna and RapidAPI JSearch so API keys never reach the browser.
//
// Secrets (supabase secrets set ...), each source is optional:
//   FRANCE_TRAVAIL_CLIENT_ID, FRANCE_TRAVAIL_CLIENT_SECRET
//                                   (francetravail.io, API "Offres d'emploi v2"; France only, full descriptions)
//   ADZUNA_APP_ID, ADZUNA_APP_KEY   (https://developer.adzuna.com)
//   RAPIDAPI_KEY                    (subscribe to "JSearch" on RapidAPI)
//   DEFAULT_PROVIDER                optional: all | francetravail | adzuna | jsearch (default all)
//                                   "all" uses every source whose secrets are set.
//   CACHE_TTL_HOURS                 optional: how long identical searches are served from cache (default 6)
//   RATE_LIMIT_GUEST                optional: searches per hour per IP for guests (default 20)
//   RATE_LIMIT_USER                 optional: searches per hour per signed-in user (default 60)
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided by Supabase automatically.
//
// Request  (POST JSON): { query, location?, provider?, country?, page? }
// Response (JSON):      { jobs: Job[], warnings: string[], cached?: true }   429 when rate limited

import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type Source = "francetravail" | "adzuna" | "jsearch";
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
};

const COUNTRIES = new Set([
  "fr", "gb", "us", "de", "nl", "ca", "au", "at", "be", "ch", "es", "it", "pl", "br", "in", "nz", "sg", "za", "mx",
]);

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

const strip = (s: unknown, max = 280) =>
  String(s ?? "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, max);

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

// Signed-in users are limited per account, guests (anon key) per IP. IPs are stored only as a SHA-256 hash
// (privacy policy: no raw IP addresses kept), and rows older than 24 h are purged.
async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
async function rateBucket(req: Request): Promise<{ bucket: string; limit: number }> {
  const token = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
  if (admin && token) {
    const { data } = await admin.auth.getUser(token);
    if (data?.user) return { bucket: `user:${data.user.id}`, limit: LIMIT_USER };
  }
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown";
  return { bucket: `ip:${await sha256(ip)}`, limit: LIMIT_GUEST };
}

// deno-lint-ignore no-explicit-any
type Raw = any;

// The provider's own error text (shortened), so a failing source says why in the app's search message.
async function providerMessage(res: Response): Promise<string> {
  const text = await res.text().catch(() => "");
  try { const j = JSON.parse(text); return String(j.message ?? j.error ?? j.exception ?? text).slice(0, 160); } catch { return text.slice(0, 160) || "no details"; }
}

const configured: Record<Source, () => boolean> = {
  francetravail: () => Boolean(Deno.env.get("FRANCE_TRAVAIL_CLIENT_ID") && Deno.env.get("FRANCE_TRAVAIL_CLIENT_SECRET")),
  adzuna: () => Boolean(Deno.env.get("ADZUNA_APP_ID") && Deno.env.get("ADZUNA_APP_KEY")),
  jsearch: () => Boolean(Deno.env.get("RAPIDAPI_KEY")),
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

async function franceTravail(q: string, where: string, country: string, page: number): Promise<Job[]> {
  if (!configured.francetravail()) throw new Error("France Travail is not configured (FRANCE_TRAVAIL_CLIENT_ID / _SECRET).");
  if (country !== "fr") throw new Error("France Travail only covers France.");
  const params = new URLSearchParams({ motsCles: q, range: `${(page - 1) * 20}-${page * 20 - 1}`, sort: "1" });
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
  }));
}

async function adzuna(q: string, where: string, country: string, page: number): Promise<Job[]> {
  const appId = Deno.env.get("ADZUNA_APP_ID");
  const appKey = Deno.env.get("ADZUNA_APP_KEY");
  if (!appId || !appKey) throw new Error("Adzuna is not configured (ADZUNA_APP_ID / ADZUNA_APP_KEY).");

  const url = new URL(`https://api.adzuna.com/v1/api/jobs/${country}/search/${page}`);
  url.search = new URLSearchParams({
    app_id: appId,
    app_key: appKey,
    results_per_page: "20",
    what: q,
    ...(where ? { where } : {}),
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
  }));
}

// JSearch employment types, written the way the app's contract detection reads them.
const EMPLOYMENT: Record<string, string> = {
  FULLTIME: "full-time", PARTTIME: "part-time", CONTRACTOR: "contractor", INTERN: "internship", // full-time ≠ CDI
};

async function jsearch(q: string, where: string, country: string, page: number): Promise<Job[]> {
  const key = Deno.env.get("RAPIDAPI_KEY");
  if (!key) throw new Error("JSearch is not configured (RAPIDAPI_KEY).");

  // JSearch replaced /search with /search-v2 (cursor pagination, same job fields); older plans may still have /search.
  // The app only asks for page 1, so no cursor is needed.
  const query = where ? `${q} in ${where}` : q;
  const call = (path: string, params: Record<string, string>) => {
    const url = new URL(`https://jsearch.p.rapidapi.com${path}`);
    url.search = new URLSearchParams(params).toString();
    return fetch(url, { headers: { "X-RapidAPI-Key": key, "X-RapidAPI-Host": "jsearch.p.rapidapi.com" } });
  };
  let res = await call("/search-v2", { query, country, ...(country === "fr" ? { language: "fr" } : {}) });
  if (res.status === 404) res = await call("/search", { query, country, page: String(page), num_pages: "1" });
  if (!res.ok) throw new Error(`JSearch returned ${res.status}: ${await providerMessage(res)}`);
  const data = await res.json();
  return (data.data ?? data.jobs ?? []).map((x: Raw): Job => ({
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
  }));
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
  const country = COUNTRIES.has(String(body.country)) ? String(body.country) : "fr";
  const page = Math.min(Math.max(parseInt(body.page, 10) || 1, 1), 5);
  const wanted = String(body.provider ?? Deno.env.get("DEFAULT_PROVIDER") ?? "all");
  // France Travail comes first so that, for an offer listed on several sources, its full description wins the dedupe.
  const ALL: Source[] = ["francetravail", "adzuna", "jsearch"];
  const providers: Source[] = wanted === "all" || wanted === "both"
    ? ALL.filter((p) => configured[p]() && !(p === "francetravail" && country !== "fr"))
    : ALL.includes(wanted as Source) ? [wanted as Source] : ["adzuna"];
  if (!providers.length) return json({ error: "No job source is configured for this country." }, 502);

  // Guard and cache need the migration 20261028000200_job_search_guard.sql; if it is missing we log and carry on.
  // "v2": results now carry `text`; bumping the key skips entries cached before that change.
  const cacheKey = ["v2", providers.join("+"), country, query.toLowerCase(), where.toLowerCase(), page].join("|");
  if (admin) {
    const { bucket, limit } = await rateBucket(req);
    const { data: allowed, error } = await admin.rpc("job_search_hit", {
      p_bucket: bucket, p_limit: limit, p_window_seconds: 3600,
    });
    if (error) console.error("rate limit check failed:", error.message);
    else if (allowed === false) {
      return json({ error: "Too many searches in the last hour. Please try again later." }, 429);
    }

    const { data: hit, error: cacheErr } = await admin.from("job_search_cache").select("results")
      .eq("key", cacheKey).gte("created_at", new Date(Date.now() - CACHE_TTL_MS).toISOString()).maybeSingle();
    if (cacheErr) console.error("cache read failed:", cacheErr.message);
    else if (hit) return json({ ...hit.results, cached: true });
  }

  const fetchers = { francetravail: franceTravail, adzuna, jsearch };
  const results = await Promise.allSettled(providers.map((p) => fetchers[p](query, where, country, page)));

  const warnings: string[] = [];
  const seen = new Set<string>();
  const jobs: Job[] = [];
  for (const r of results) {
    if (r.status === "rejected") {
      warnings.push(r.reason instanceof Error ? r.reason.message : "A provider failed.");
      continue;
    }
    for (const j of r.value) {
      const key = `${j.title}|${j.company}`.toLowerCase();
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
    await admin.from("job_search_hits").delete().lt("window_start", new Date(Date.now() - 24 * 3600_000).toISOString());
  }
  return json({ jobs, warnings });
});
