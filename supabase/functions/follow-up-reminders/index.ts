// Supabase Edge Function: follow-up-reminders (ROADMAP 2.2)
// Sends the opt-in daily e-mail: the tracker's follow-ups due today or overdue, and the interviews in the next 36 hours,
// to each signed-in user who turned on "E-mail me my follow-ups" (Account page; profiles.email_reminders). At most one
// e-mail a day per user (profiles.reminders_sent_on); nothing is sent when there is nothing to do. No log of the
// content: the response only counts e-mails.
//
// Two ways in (POST):
//   - the daily run: header x-cron-secret = CRON_SECRET (GitHub Actions, .github/workflows/reminders.yml, with the
//     anon key as Authorization because "Verify JWT" is on);
//   - "Send me a test e-mail now": a signed-in user's session token, body { "test": true }; sends that user's digest
//     right away (or says there is nothing due), once a day (profiles.reminders_test_on).
// Secrets (Supabase → Edge Functions → Secrets): RESEND_API_KEY (Resend, sending domain mail.hellokhedma.io),
// CRON_SECRET (same value as the GitHub secret REMINDERS_CRON_SECRET); optional REMINDERS_FROM
// (default "HelloKhedma <no-reply@mail.hellokhedma.io>"), SITE_URL (default https://hellokhedma.io).
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided by Supabase.

import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false },
});
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const RESEND_API_URL = Deno.env.get("RESEND_API_URL") || "https://api.resend.com/emails"; // overridable for local tests
const CRON_SECRET = Deno.env.get("CRON_SECRET") || "";
const FROM = Deno.env.get("REMINDERS_FROM") || "HelloKhedma <no-reply@mail.hellokhedma.io>";
const SITE = (Deno.env.get("SITE_URL") || "https://hellokhedma.io").replace(/\/$/, "");
const MAX_USERS = 500, SOON_HOURS = 36, ACTIVE = ["saved", "applied", "interview"];

// "Today" for French users: the reminders say "due today" in Paris time.
const parisDay = (d = new Date()) => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(d);
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

type App = { title: string; company: string; stage: string; next_action: string; follow_up_on: string | null; interview_at: string | null };
type Lang = "en" | "fr";

const TEXT = {
  en: {
    subject: (n: number) => `HelloKhedma: ${n} thing${n > 1 ? "s" : ""} to do for your job search today`,
    hello: "Here is what your application tracker says for today.",
    follow: "Follow-ups", interviews: "Interviews coming up",
    overdue: "overdue since", today: "today", followUp: "Follow up",
    at: "at", open: "Open my tracker", colon: ":",
    footer: "You get this e-mail because you turned on e-mail reminders in HelloKhedma. Turn them off on the Account page:",
    test: "This is the test e-mail you asked for.", nothing: "Nothing is due today: no e-mail would be sent.",
  },
  fr: {
    subject: (n: number) => `HelloKhedma : ${n} chose${n > 1 ? "s" : ""} à faire pour votre recherche aujourd’hui`,
    hello: "Voici ce que dit votre suivi de candidatures pour aujourd’hui.",
    follow: "Relances", interviews: "Entretiens à venir",
    overdue: "en retard depuis le", today: "aujourd’hui", followUp: "Relancer",
    at: "chez", open: "Ouvrir mon suivi", colon: " :",
    footer: "Vous recevez cet e-mail car vous avez activé les rappels par e-mail dans HelloKhedma. Pour les arrêter, page Compte :",
    test: "Voici l’e-mail de test que vous avez demandé.", nothing: "Rien n’est prévu aujourd’hui : aucun e-mail ne serait envoyé.",
  },
};

function digest(apps: App[], today: string, now: Date) {
  const soon = now.getTime() + SOON_HOURS * 3600_000;
  const follow = apps.filter((a) => a.follow_up_on && a.follow_up_on <= today).sort((a, b) => a.follow_up_on!.localeCompare(b.follow_up_on!));
  const interviews = apps.filter((a) => { const t = a.interview_at ? Date.parse(a.interview_at) : NaN; return t >= now.getTime() && t <= soon; })
    .sort((a, b) => Date.parse(a.interview_at!) - Date.parse(b.interview_at!));
  return { follow, interviews, count: follow.length + interviews.length };
}

function render(d: ReturnType<typeof digest>, lang: Lang, today: string, test: boolean) {
  const T = TEXT[lang], locale = lang === "fr" ? "fr-FR" : "en-GB";
  const day = (s: string) => new Date(`${s}T12:00:00Z`).toLocaleDateString(locale, { day: "numeric", month: "long" });
  const when = (s: string) => new Date(s).toLocaleString(locale, { timeZone: "Europe/Paris", weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });
  const job = (a: App) => [a.title, a.company && `${T.at} ${a.company}`].filter(Boolean).join(" ");
  const followLines = d.follow.map((a) => ({ job: job(a), what: a.next_action || T.followUp, due: a.follow_up_on === today ? T.today : `${T.overdue} ${day(a.follow_up_on!)}` }));
  const ivLines = d.interviews.map((a) => ({ job: job(a), when: when(a.interview_at!) }));
  const c = T.colon;
  const text = [test ? T.test : "", T.hello, "",
    followLines.length ? `${T.follow}${c}` : "", ...followLines.map((l) => `- ${l.job}${c} ${l.what} (${l.due})`),
    ivLines.length ? `\n${T.interviews}${c}` : "", ...ivLines.map((l) => `- ${l.job}${c} ${l.when}`),
    "", `${T.open}${c} ${SITE}/#/applications`, "", `${T.footer} ${SITE}/#/account`].filter((x) => x !== "").join("\n");
  const li = (s: string) => `<li style="margin:4px 0">${s}</li>`;
  const html = `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.5;color:#222;max-width:560px">
${test ? `<p style="color:#7c5cff">${esc(T.test)}</p>` : ""}<p>${esc(T.hello)}</p>
${followLines.length ? `<h3 style="margin:16px 0 4px">${esc(T.follow)}</h3><ul style="padding-left:18px">${followLines.map((l) => li(`<b>${esc(l.job)}</b>${c} ${esc(l.what)} <span style="color:#888">(${esc(l.due)})</span>`)).join("")}</ul>` : ""}
${ivLines.length ? `<h3 style="margin:16px 0 4px">${esc(T.interviews)}</h3><ul style="padding-left:18px">${ivLines.map((l) => li(`<b>${esc(l.job)}</b>${c} ${esc(l.when)}`)).join("")}</ul>` : ""}
<p style="margin:20px 0"><a href="${SITE}/#/applications" style="background:#222;color:#fff;padding:10px 16px;border-radius:10px;text-decoration:none">${esc(T.open)}</a></p>
<p style="color:#888;font-size:12px">${esc(T.footer)} <a href="${SITE}/#/account" style="color:#888">${SITE}/#/account</a></p></div>`;
  return { subject: TEXT[lang].subject(d.count), text, html };
}

async function send(to: string, mail: { subject: string; text: string; html: string }) {
  const res = await fetch(RESEND_API_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: FROM, to: [to], subject: mail.subject, text: mail.text, html: mail.html }),
  });
  if (!res.ok) throw new Error(`Resend ${res.status}`);
}

async function appsOf(userId: string) {
  const { data, error } = await admin.from("applications").select("title, company, stage, next_action, follow_up_on, interview_at")
    .eq("user_id", userId).in("stage", ACTIVE);
  if (error) throw error;
  return (data || []) as App[];
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Use POST." }, 405);
  if (!RESEND_API_KEY) return json({ error: "E-mail reminders are not set up yet (RESEND_API_KEY)." }, 503);
  const now = new Date(), today = parisDay(now);

  // 1. "Send me a test e-mail now", for the signed-in user.
  const body = await req.json().catch(() => ({}));
  if (body?.test) {
    const token = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
    const { data: u } = token ? await admin.auth.getUser(token) : { data: { user: null } };
    const user = u?.user;
    if (!user?.email) return json({ error: "Sign in first." }, 401);
    const { data: p } = await admin.from("profiles").select("email_reminders, reminders_lang, reminders_test_on").eq("user_id", user.id).maybeSingle();
    if (!p?.email_reminders) return json({ error: "Turn on e-mail reminders first." }, 400);
    if (p.reminders_test_on === today) return json({ error: "One test e-mail a day: try again tomorrow." }, 429);
    const lang: Lang = p.reminders_lang === "fr" ? "fr" : "en";
    const d = digest(await appsOf(user.id), today, now);
    if (!d.count) return json({ sent: false, reason: TEXT[lang].nothing });
    await send(user.email, render(d, lang, today, true));
    await admin.from("profiles").update({ reminders_test_on: today }).eq("user_id", user.id);
    return json({ sent: true });
  }

  // 2. The daily run.
  if (!CRON_SECRET || req.headers.get("x-cron-secret") !== CRON_SECRET) return json({ error: "Not allowed." }, 401);
  const { data: profiles, error } = await admin.from("profiles").select("user_id, reminders_lang")
    .eq("email_reminders", true).or(`reminders_sent_on.is.null,reminders_sent_on.lt.${today}`).limit(MAX_USERS);
  if (error) return json({ error: error.message }, 500);
  let sent = 0, empty = 0, failed = 0;
  for (const p of profiles || []) {
    try {
      const d = digest(await appsOf(p.user_id), today, now);
      if (!d.count) { empty++; continue; }
      const { data: u } = await admin.auth.admin.getUserById(p.user_id);
      if (!u?.user?.email) { failed++; continue; }
      await send(u.user.email, render(d, p.reminders_lang === "fr" ? "fr" : "en", today, false));
      await admin.from("profiles").update({ reminders_sent_on: today }).eq("user_id", p.user_id);
      sent++;
      await sleep(600); // Resend: 2 requests a second
    } catch { failed++; }
  }
  return json({ day: today, users: profiles?.length || 0, sent, nothing_due: empty, failed });
});
