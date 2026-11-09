// Supabase Edge Function: search-alerts (ROADMAP 3.2, 2026-11-09)
// Offer alerts: each morning, every alert a signed-in user turned on for a saved search (Offers page, js/alerts.js;
// table search_alerts, migration 20261109000500) is run through the job-search function, and each user gets ONE e-mail
// with the offers not sent before, for all their alerts (newest first, at most PER_ALERT per alert). Nothing is sent
// when nothing is new. No log of the content: the response only counts.
//
// Two ways in (POST):
//   - the daily run: header x-cron-secret = CRON_SECRET (GitHub Actions, .github/workflows/reminders.yml, with the anon
//     key as Authorization because "Verify JWT" is on). It works through the users whose alerts did not run today,
//     stops after BATCH_MS and answers { remaining }: the workflow calls again until nothing remains.
//   - "Send me today's offers now": a signed-in user's session token, body { "test": true }: runs that user's alerts
//     at once and e-mails the newest offers even if they were sent before (once a day, profiles.alerts_test_on);
//     it does not change what the next daily e-mail counts as new.
// Searches: job-search with { alert: true } and the same x-cron-secret: no rate limit, and only the sources that can
// run without a visitor (no JSearch, Jooble or Careerjet; see job-search ALERT_SKIP). Identical searches share
// job-search's saved answers. Offers are kept when their title contains every word of the searched title (or of its
// English pair). ALERTS_DAILY_MAX (default 120) caps the alert searches a day to protect the providers' quotas.
// Each offer in the e-mail names its source ("via Adzuna"…), as the providers' terms ask, and links to the offer.
// Secrets: RESEND_API_KEY, CRON_SECRET (shared with follow-up-reminders); optional REMINDERS_FROM, SITE_URL,
// ALERTS_DAILY_MAX. SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided by Supabase.

import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const RESEND_API_URL = Deno.env.get("RESEND_API_URL") || "https://api.resend.com/emails"; // overridable for local tests
const SEARCH_URL = Deno.env.get("JOB_SEARCH_URL") || `${SUPABASE_URL}/functions/v1/job-search`; // idem
const CRON_SECRET = Deno.env.get("CRON_SECRET") || "";
const FROM = Deno.env.get("REMINDERS_FROM") || "HelloKhedma <no-reply@mail.hellokhedma.io>";
const SITE = (Deno.env.get("SITE_URL") || "https://hellokhedma.io").replace(/\/$/, "");
const DAILY_MAX = Number(Deno.env.get("ALERTS_DAILY_MAX")) || 120;
const PER_ALERT = 10, SEEN_MAX = 400, BATCH_MS = 100_000, USERS_PER_BATCH = 60;
const SOURCE_NAMES: Record<string, string> = {
  francetravail: "France Travail", adzuna: "Adzuna", himalayas: "Himalayas", arbeitnow: "Arbeitnow", lba: "La bonne alternance",
};

const parisDay = (d = new Date()) => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(d);
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
const safeUrl = (u: string) => { try { const x = new URL(u); return /^https?:$/.test(x.protocol) ? x.href : ""; } catch { return ""; } };
const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const words = (s: string) => fold(s).split(/[^a-z0-9+#]+/).filter((w) => w.length > 1 && !["h", "f", "hf", "fh", "m", "w", "d"].includes(w));
// Kept when the offer title has every word of the searched title, or of its English pair ("Ingénieur Data" / "Data Engineer").
const titleFits = (title: string, p: Params) => {
  const have = new Set(words(title));
  return [p.query, p.alt].filter(Boolean).some((q) => { const w = words(q!); return w.length > 0 && w.every((x) => have.has(x)); });
};

type Params = { query: string; alt?: string; path?: string; location?: string; country?: string };
type Job = { id: string; title: string; company: string; location: string; url: string; posted: string | null; source: string; salary?: string };
type Alert = { id: string; user_id: string; label: string; params: Params; lang: string; seen: string[] };
type Lang = "en" | "fr";

const TEXT = {
  en: {
    subject: (n: number) => `HelloKhedma: ${n} new offer${n > 1 ? "s" : ""} for your saved searches`,
    hello: "New offers for the searches you asked HelloKhedma to watch:",
    test: "This is the e-mail you asked for: today's newest offers, sent before or not.",
    via: "via", at: "", open: "See them on HelloKhedma",
    footer: "You get this e-mail because you turned on offer alerts for a saved search in HelloKhedma. To stop it, press 🔔 on that search on the Offers page:",
    nothing: "No offers found for your alerts today.",
  },
  fr: {
    subject: (n: number) => `HelloKhedma : ${n} nouvelle${n > 1 ? "s" : ""} offre${n > 1 ? "s" : ""} pour vos recherches enregistrées`,
    hello: "Nouvelles offres pour les recherches que vous avez demandé à HelloKhedma de surveiller :",
    test: "Voici l’e-mail demandé : les offres les plus récentes du jour, déjà envoyées ou non.",
    via: "via", at: "", open: "Les voir sur HelloKhedma",
    footer: "Vous recevez cet e-mail car vous avez activé les alertes d’offres sur une recherche enregistrée dans HelloKhedma. Pour l’arrêter, appuyez sur 🔔 sur cette recherche, page Offres :",
    nothing: "Aucune offre trouvée pour vos alertes aujourd’hui.",
  },
};

async function search(p: Params): Promise<Job[]> {
  const res = await fetch(SEARCH_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${SERVICE_KEY}`, "Content-Type": "application/json", "x-cron-secret": CRON_SECRET },
    body: JSON.stringify({ query: p.query, alt: p.alt || "", path: p.path || "", location: p.location || "", country: p.country || "fr", provider: "all", alert: true }),
  });
  if (!res.ok) throw new Error(`job-search ${res.status}`);
  const d = await res.json();
  return Array.isArray(d?.jobs) ? d.jobs : [];
}
const keyOf = (j: Job) => `${j.source}:${j.id || j.url}`;
const newest = (a: Job, b: Job) => (b.posted ?? "").localeCompare(a.posted ?? "");

type Section = { label: string; jobs: Job[] };
function render(sections: Section[], lang: Lang, test: boolean) {
  const T = TEXT[lang], n = sections.reduce((a, s) => a + s.jobs.length, 0);
  const meta = (j: Job) => [j.company, j.location, j.salary, `${T.via} ${SOURCE_NAMES[j.source] || j.source}`].filter(Boolean).join(" · ");
  const text = [test ? T.test : "", T.hello, "",
    ...sections.flatMap((s) => [`${s.label}`, ...s.jobs.map((j) => `- ${j.title} (${meta(j)})\n  ${safeUrl(j.url)}`), ""]),
    `${T.open}: ${SITE}/#/offers`, "", `${T.footer} ${SITE}/#/offers`].filter((x, i) => x !== "" || i > 1).join("\n");
  const html = `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.5;color:#222;max-width:560px">
${test ? `<p style="color:#6d51e0">${esc(T.test)}</p>` : ""}<p>${esc(T.hello)}</p>
${sections.map((s) => `<h3 style="margin:18px 0 4px">${esc(s.label)}</h3><ul style="padding-left:18px;margin:0">${s.jobs.map((j) => {
    const u = safeUrl(j.url);
    return `<li style="margin:6px 0">${u ? `<a href="${esc(u)}" style="color:#222;font-weight:bold">${esc(j.title)}</a>` : `<b>${esc(j.title)}</b>`}<br><span style="color:#666;font-size:13px">${esc(meta(j))}</span></li>`;
  }).join("")}</ul>`).join("\n")}
<p style="margin:20px 0"><a href="${SITE}/#/offers" style="background:#222;color:#fff;padding:10px 16px;border-radius:10px;text-decoration:none">${esc(T.open)}</a></p>
<p style="color:#777;font-size:12px">${esc(T.footer)} <a href="${SITE}/#/offers" style="color:#777">${SITE}/#/offers</a></p></div>`;
  return { subject: T.subject(n), text, html, n };
}

async function send(to: string, mail: { subject: string; text: string; html: string }) {
  const res = await fetch(RESEND_API_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: FROM, to: [to], subject: mail.subject, text: mail.text, html: mail.html }),
  });
  if (!res.ok) {
    const why = await res.json().then((d) => d?.message || d?.name || "", () => "");
    throw new Error(`Resend ${res.status}${why ? `: ${String(why).slice(0, 200)}` : ""}`);
  }
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const count = (kind: string, n = 1) => admin.rpc("count_usage_n", { p_kind: kind, p_n: n }).then(({ error }) => { if (error) console.error("usage count failed:", error.message); });

// Runs one user's alerts. test: the newest offers whatever was sent, and nothing saved.
async function runUser(alerts: Alert[], today: string, test: boolean, cache: Map<string, Promise<Job[]>>) {
  const sections: Section[] = [];
  for (const a of alerts) {
    const k = JSON.stringify([a.params.query, a.params.alt, a.params.path, a.params.location, a.params.country]);
    if (!cache.has(k)) cache.set(k, search(a.params));
    let jobs: Job[];
    try { jobs = (await cache.get(k)!).filter((j) => j.url && titleFits(j.title, a.params)).sort(newest); }
    catch { continue; } // a failed search: tried again tomorrow (last_run_on not set)
    const seen = new Set(a.seen || []);
    const fresh = test ? jobs : jobs.filter((j) => !seen.has(keyOf(j)));
    if (fresh.length) sections.push({ label: a.label, jobs: fresh.slice(0, PER_ALERT) });
    if (!test) {
      const nextSeen = [...new Set([...jobs.map(keyOf), ...(a.seen || [])])].slice(0, SEEN_MAX);
      await admin.from("search_alerts").update({ seen: nextSeen, last_run_on: today, ...(fresh.length ? { last_sent_on: today } : {}) }).eq("id", a.id);
    }
  }
  return sections;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Use POST." }, 405);
  if (!RESEND_API_KEY || !CRON_SECRET) return json({ error: "Offer alerts are not set up yet (RESEND_API_KEY, CRON_SECRET)." }, 503);
  const today = parisDay(), started = Date.now();
  const body = await req.json().catch(() => ({}));

  // 1. "Send me today's offers now", for the signed-in user.
  if (body?.test) {
    const token = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
    const { data: u } = token ? await admin.auth.getUser(token) : { data: { user: null } };
    const user = u?.user;
    if (!user?.email) return json({ error: "Sign in first." }, 401);
    const { data: p } = await admin.from("profiles").select("alerts_test_on").eq("user_id", user.id).maybeSingle();
    if (p?.alerts_test_on === today) return json({ error: "One test e-mail a day: try again tomorrow." }, 429);
    const { data: alerts } = await admin.from("search_alerts").select("id, user_id, label, params, lang, seen").eq("user_id", user.id);
    if (!alerts?.length) return json({ error: "Turn on an alert first." }, 400);
    const lang: Lang = alerts[0].lang === "fr" ? "fr" : "en";
    await admin.from("profiles").upsert({ user_id: user.id, alerts_test_on: today });
    await count("alert_search", alerts.length);
    const sections = await runUser(alerts as Alert[], today, true, new Map());
    if (!sections.length) return json({ sent: false, reason: TEXT[lang].nothing });
    try { await send(user.email, render(sections, lang, true)); }
    catch (e) { console.error("test e-mail failed:", (e as Error).message); return json({ error: `The e-mail could not be sent (${(e as Error).message}).` }, 502); }
    await count("alert_email");
    return json({ sent: true });
  }

  // 2. The daily run, in batches of users.
  if (req.headers.get("x-cron-secret") !== CRON_SECRET) return json({ error: "Not allowed." }, 401);
  const { data: done } = await admin.from("usage_daily").select("n").eq("day", new Date().toISOString().slice(0, 10)).eq("kind", "alert_search").maybeSingle();
  let budget = DAILY_MAX - (done?.n || 0);
  const { data: due, error } = await admin.from("search_alerts").select("user_id")
    .or(`last_run_on.is.null,last_run_on.lt.${today}`).order("last_run_on", { ascending: true, nullsFirst: true }).limit(USERS_PER_BATCH * 3);
  if (error) return json({ error: error.message }, 500);
  const users = [...new Set((due || []).map((r) => r.user_id))].slice(0, USERS_PER_BATCH);
  const cache = new Map<string, Promise<Job[]>>();
  let ran = 0, sent = 0, failed = 0, searches = 0;
  for (const userId of users) {
    if (Date.now() - started > BATCH_MS || budget <= 0) break;
    try {
      const { data: alerts } = await admin.from("search_alerts").select("id, user_id, label, params, lang, seen")
        .eq("user_id", userId).or(`last_run_on.is.null,last_run_on.lt.${today}`);
      if (!alerts?.length) continue;
      budget -= alerts.length; searches += alerts.length;
      const sections = await runUser(alerts as Alert[], today, false, cache);
      ran++;
      if (!sections.length) continue;
      const { data: u } = await admin.auth.admin.getUserById(userId);
      if (!u?.user?.email) { failed++; continue; }
      await send(u.user.email, render(sections, alerts[0].lang === "fr" ? "fr" : "en", false));
      sent++;
      await sleep(600); // Resend: 2 requests a second
    } catch { failed++; }
  }
  if (searches) await count("alert_search", searches);
  if (sent) await count("alert_email", sent);
  const { count: remaining } = await admin.from("search_alerts").select("id", { count: "exact", head: true })
    .or(`last_run_on.is.null,last_run_on.lt.${today}`);
  return json({ day: today, users: ran, sent, failed, remaining: budget > 0 ? remaining ?? 0 : 0, budget_left: Math.max(0, budget) });
});
