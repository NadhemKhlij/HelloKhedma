// Supabase Edge Function: job-search
// Proxies Adzuna and RapidAPI JSearch so API keys never reach the browser.
//
// Secrets (supabase secrets set ...):
//   ADZUNA_APP_ID, ADZUNA_APP_KEY   (https://developer.adzuna.com)
//   RAPIDAPI_KEY                    (subscribe to "JSearch" on RapidAPI)
//   DEFAULT_PROVIDER                optional: adzuna | jsearch | both (default adzuna)
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

type Source = "adzuna" | "jsearch";
type Job = {
  id: string;
  title: string;
  company: string;
  location: string;
  url: string;
  posted: string | null;
  snippet: string;
  source: Source;
};

const COUNTRIES = new Set([
  "fr", "gb", "us", "de", "nl", "ca", "au", "at", "be", "ch", "es", "it", "pl", "br", "in", "nz", "sg", "za", "mx",
]);

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

const strip = (s: unknown) =>
  String(s ?? "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, 280);

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

// Signed-in users are limited per account, guests (anon key) per IP.
async function rateBucket(req: Request): Promise<{ bucket: string; limit: number }> {
  const token = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
  if (admin && token) {
    const { data } = await admin.auth.getUser(token);
    if (data?.user) return { bucket: `user:${data.user.id}`, limit: LIMIT_USER };
  }
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown";
  return { bucket: `ip:${ip}`, limit: LIMIT_GUEST };
}

// deno-lint-ignore no-explicit-any
type Raw = any;

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
  if (!res.ok) throw new Error(`Adzuna returned ${res.status}.`);
  const data = await res.json();
  return (data.results ?? []).map((x: Raw): Job => ({
    id: String(x.id),
    title: strip(x.title),
    company: x.company?.display_name ?? "",
    location: x.location?.display_name ?? "",
    url: x.redirect_url,
    posted: x.created ?? null,
    snippet: strip(x.description),
    source: "adzuna",
  }));
}

async function jsearch(q: string, where: string, country: string, page: number): Promise<Job[]> {
  const key = Deno.env.get("RAPIDAPI_KEY");
  if (!key) throw new Error("JSearch is not configured (RAPIDAPI_KEY).");

  const url = new URL("https://jsearch.p.rapidapi.com/search");
  url.search = new URLSearchParams({
    query: where ? `${q} in ${where}` : q,
    page: String(page),
    num_pages: "1",
    country,
  }).toString();

  const res = await fetch(url, {
    headers: { "X-RapidAPI-Key": key, "X-RapidAPI-Host": "jsearch.p.rapidapi.com" },
  });
  if (!res.ok) throw new Error(`JSearch returned ${res.status}.`);
  const data = await res.json();
  return (data.data ?? []).map((x: Raw): Job => ({
    id: String(x.job_id),
    title: strip(x.job_title),
    company: x.employer_name ?? "",
    location: [x.job_city, x.job_state, x.job_country].filter(Boolean).join(", "),
    url: x.job_apply_link,
    posted: x.job_posted_at_datetime_utc ?? null,
    snippet: strip(x.job_description),
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
  const wanted = String(body.provider ?? Deno.env.get("DEFAULT_PROVIDER") ?? "adzuna");
  const providers: Source[] =
    wanted === "both" ? ["adzuna", "jsearch"] : wanted === "jsearch" ? ["jsearch"] : ["adzuna"];

  // Guard and cache need the migration 20261028000200_job_search_guard.sql; if it is missing we log and carry on.
  const cacheKey = [providers.join("+"), country, query.toLowerCase(), where.toLowerCase(), page].join("|");
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

  const results = await Promise.allSettled(
    providers.map((p) => (p === "adzuna" ? adzuna(query, where, country, page) : jsearch(query, where, country, page))),
  );

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
  }
  return json({ jobs, warnings });
});
