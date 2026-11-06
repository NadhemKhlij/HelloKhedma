// Supabase Edge Function: cv-tailor
// "Rewrite with AI" in the Tailor my CV dialog (js/tailor.js): rewrites the user's CV bullet points for one job offer
// with Claude, honestly (no invented skills, numbers or experience), and lists the gaps.
// Signed-in users only, after an explicit notice in the app; limited per account per day. The CV and the offer are
// sent to the Claude API for this request only: this function never stores or logs them.
//
// Secrets (supabase secrets set ...):
//   ANTHROPIC_API_KEY        required (console.anthropic.com → API keys). Without it the function answers 503.
//   CV_TAILOR_DAILY_LIMIT    optional, rewrites per account per 24 h (default 5)
//   CV_TAILOR_MODEL          optional, Claude model id (default claude-opus-5-5; claude-sonnet-5-5 costs about half)
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided by Supabase automatically.
//
// Request  (POST JSON, user session in Authorization): { cv, offer: { title, company, text }, matched[], missing[], role, lang, mode }
// Response (JSON): mode "rewrite" (default) → { text, model }; mode "cv" → { cv, model }: the whole CV corrected and
// tailored to this offer, as structured output in the CV maker's format (js/cvmaker.js), with changes (what was corrected
// and tailored) and notes (gaps, numbers to add) for the user.
// Errors: 401 not signed in · 429 daily limit (shared by both modes) · 503 not configured · 4xx/5xx { error, code }
// The daily limit reuses job_search_hit() and job_search_hits (migration 20261028000200), bucket "tailor:<user id>".
// Each allowed call bumps the anonymous daily counter usage_daily (count_usage(), migration 20261106000200), and each
// Claude reply adds its token counts to ai_usage_daily (count_ai_tokens(), migration 20261106000300): numbers only.

import { createClient } from "npm:@supabase/supabase-js@2.45.4";
import Anthropic from "npm:@anthropic-ai/sdk";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

const MAX_CV = 12000, MAX_OFFER = 6000; // characters; the app sends at most this much
const DAILY_LIMIT = Number(Deno.env.get("CV_TAILOR_DAILY_LIMIT")) || 5;
const MODEL = Deno.env.get("CV_TAILOR_MODEL") || "claude-opus-5-5";
const apiKey = Deno.env.get("ANTHROPIC_API_KEY");

const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false },
});
const claude = apiKey ? new Anthropic({ apiKey }) : null;

const SYSTEM = `You are an experienced recruiter and CV coach. You help a job seeker adapt their CV to one job offer, honestly.

Rules:
- Never invent experience, employers, dates, degrees, skills, tools, certifications or numbers. Use only what the CV says.
- Rewrite and reorder the existing bullet points so the ones that match the offer come first, using the offer's wording only where it is true for this person.
- When a bullet would be stronger with a number the CV does not give (volume, time saved, %), do not make one up: write [number?] in the bullet and ask for it under "Questions".
- Never add a skill the offer asks for that the CV does not show. List it under "Gaps" with an honest way to address it: a related experience the person really has, a course to take, or how to talk about it in an interview.
- Keep the CV's own language for the rewritten bullets. Write the section titles and your explanations in the language given in the request.
- Be concise. Plain text only: no Markdown tables, no bold, no code blocks. Use "- " for bullets.

Answer with exactly these four sections, each starting with its title on its own line:
1. Profile summary (2-3 lines for this offer)
2. Rewritten bullet points (grouped by job, most relevant first)
3. Gaps (requirement, then how to address it honestly)
4. Questions (missing numbers or details that would make the CV stronger)`;

// Mode "cv": the full CV corrected, tailored to the offer and rebuilt in the CV maker's fields (structured output, so the
// app can fill the form), with the list of changes and the notes (gaps, numbers to add).
const SYSTEM_CV = `You are an experienced recruiter and CV writer. You correct a job seeker's CV, tailor it to one job offer and turn it into a complete, ATS-friendly CV, honestly.

Rules:
- Never invent experience, employers, dates, degrees, schools, skills, tools, certifications, languages, links or numbers. Use only what the CV says; leave a field empty when the CV does not give it.
- Correct the CV: spelling, grammar, punctuation, typos, verb tense (past for past jobs, present for the current one), consistent date format, consistent capitalisation of tools and companies, vague or repeated wording, and anything that hurts ATS parsing (symbols, text in odd places).
- Keep every job and degree of the CV with its real dates. Order the bullet points of each job so the ones that match the offer come first, rewrite them with strong verbs and the offer's wording only where it is true for this person, and drop bullets that add nothing for this offer.
- Length: the CV must fit on 2 A4 pages at most (1 page when the CV shows less than 5 years of experience). Bullets: 4 at most for the two most recent jobs, 3 for the next ones, 1-2 for jobs older than 8 years or unrelated to the offer. One line per bullet when possible (about 20 words at most). Summary: 3 lines at most. Never repeat in a bullet what the context line or the skills already say.
- When a bullet would be stronger with a number the CV does not give, do not make one up: write [number?] in the bullet and add a note asking for it.
- Headline: the offer's job title if the CV supports it, otherwise the closest honest title.
- Summary: 2-3 lines for this offer. Skills: the skills the CV really shows, those the offer asks for first, using the offer's exact words when they mean the same thing.
- Write the CV in the language of the job offer (lang "fr" for French, "en" otherwise), translating the CV content faithfully when needed.
- context: an optional one-line description of the team, product or scope of a job, taken from the CV (e.g. "Within the regulatory reporting team…"); when the CV lists the tools of a job, end the context with them ("… Tools: Snowflake, SQL, Git") instead of making a bullet of them; empty if the CV has none of this.
- skills: always grouped, one group per line ("Databases: SQL, Oracle"), 4 to 7 lines, the groups the offer cares about first; each skill once.
- involvement: volunteering, associations and events from the CV (organisation, role, dates); empty if none. Never put a paid job here.
- Bullets, details, links and certifications: one per line, with no leading dash. Certifications: "Name (Issuer), YYYY", most recent first. Dates as MM/YYYY (e.g. "03/2023"), or YYYY alone when the CV gives only the year; never abbreviated month names; end is empty for a current job.
- changes: short notes for the job seeker, in the language given in the request, listing what you corrected (e.g. "Fixed 3 spelling mistakes", "Put every date as Mon. YYYY") and the main ways you tailored the CV to the offer (bullets moved up, wording aligned, bullets dropped).
- notes: short notes for the job seeker, in the language given in the request: each requirement of the offer the CV does not show (with an honest way to address it) and each [number?] to fill in.`;

const STR = { type: "string" } as const;
const obj = (props: Record<string, unknown>) =>
  ({ type: "object", properties: props, required: Object.keys(props), additionalProperties: false });
const CV_SCHEMA = obj({
  lang: { type: "string", enum: ["en", "fr"] },
  name: STR, headline: STR, email: STR, phone: STR, location: STR, links: STR, summary: STR, skills: STR,
  experience: { type: "array", items: obj({ role: STR, company: STR, location: STR, start: STR, end: STR, context: STR, bullets: STR }) },
  education: { type: "array", items: obj({ degree: STR, school: STR, location: STR, start: STR, end: STR, details: STR }) },
  projects: { type: "array", items: obj({ name: STR, link: STR, bullets: STR }) },
  involvement: { type: "array", items: obj({ org: STR, role: STR, start: STR, end: STR }) },
  certifications: STR, languages: STR,
  changes: { type: "array", items: STR },
  notes: { type: "array", items: STR },
});

const str = (v: unknown, max: number) => String(v ?? "").slice(0, max + 1);
const list = (v: unknown) => (Array.isArray(v) ? v.map((x) => String(x)).slice(0, 40).join(", ") : "");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Use POST.", code: "method" }, 405);
  if (!claude) return json({ error: "AI rewriting is not set up yet.", code: "not_configured" }, 503);

  // Only a real user session: the anon key resolves to no user.
  const token = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
  const { data, error } = token ? await admin.auth.getUser(token) : { data: { user: null }, error: null };
  if (error || !data?.user) return json({ error: "Sign in to use AI rewriting.", code: "signed_out" }, 401);

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return json({ error: "Invalid request.", code: "bad_request" }, 400); }
  const offer = (body.offer ?? {}) as Record<string, unknown>;
  const cv = str(body.cv, MAX_CV).trim(), offerText = str(offer.text, MAX_OFFER).trim();
  if (!cv || !offerText) return json({ error: "The CV and the offer are both needed.", code: "bad_request" }, 400);
  if (cv.length > MAX_CV || offerText.length > MAX_OFFER) {
    return json({ error: "The CV or the offer is too long for AI rewriting.", code: "too_long" }, 413);
  }

  // Daily limit per account (counted before the call, so failed calls count too: keeps costs bounded).
  const { data: allowed, error: limitErr } = await admin.rpc("job_search_hit", {
    p_bucket: `tailor:${data.user.id}`, p_limit: DAILY_LIMIT, p_window_seconds: 86400,
  });
  // Rate-limit rows are kept 24 h at most (privacy policy): purged on every call, here and in job-search.
  await admin.from("job_search_hits").delete().lt("window_start", new Date(Date.now() - 24 * 3600_000).toISOString());
  if (limitErr) return json({ error: "Could not check the daily limit.", code: "limit_check" }, 500);
  if (!allowed) return json({ error: `Daily limit reached (${DAILY_LIMIT} AI rewrites a day). Try again tomorrow.`, code: "limit" }, 429);
  // Anonymous daily counter for the admin page (day + count only; migration 20261106000200). Never blocks the call.
  const { error: countErr } = await admin.rpc("count_usage", { p_kind: "cv_tailor" });
  if (countErr) console.error("usage count failed:", countErr.message);

  const language = body.lang === "fr" ? "French" : "English";
  const prompt = [
    `Write the section titles and explanations in ${language}.`,
    `Target role: ${str(body.role, 80)}`,
    `Skills from the offer found in the CV: ${list(body.matched) || "none detected"}`,
    `Skills from the offer missing from the CV: ${list(body.missing) || "none detected"}`,
    "",
    `<job_offer title="${str(offer.title, 200).replace(/"/g, "'")}" company="${str(offer.company, 120).replace(/"/g, "'")}">`,
    offerText,
    "</job_offer>",
    "",
    "<cv>",
    cv,
    "</cv>",
  ].join("\n");

  const asCv = body.mode === "cv";
  try {
    const response = await claude.beta.messages.create({
      model: MODEL,
      max_tokens: 16000,
      output_config: asCv ? { effort: "medium", format: { type: "json_schema", schema: CV_SCHEMA } } : { effort: "medium" },
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default", // a declined request is retried on Anthropic's recommended model
      system: asCv ? SYSTEM_CV : SYSTEM,
      messages: [{ role: "user", content: prompt }],
    });
    // Token counts for the admin page's cost estimate (numbers only; migration 20261106000300). Recorded before the
    // checks below: refused or truncated replies are billed too. Never blocks the answer.
    const u = response.usage;
    const { error: tokErr } = await admin.rpc("count_ai_tokens", {
      p_model: response.model, p_input: u?.input_tokens ?? 0, p_output: u?.output_tokens ?? 0,
      p_cache_read: u?.cache_read_input_tokens ?? 0, p_cache_write: u?.cache_creation_input_tokens ?? 0,
    });
    if (tokErr) console.error("token count failed:", tokErr.message);
    if (response.stop_reason === "refusal") {
      return json({ error: "The AI declined this request. Use the prompt to copy instead.", code: "refusal" }, 422);
    }
    const text = response.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("\n").trim();
    if (!text) return json({ error: "The AI returned no text. Try again.", code: "empty" }, 502);
    if (asCv) {
      if (response.stop_reason === "max_tokens") return json({ error: "The CV was too long to finish. Try again.", code: "truncated" }, 502);
      try { return json({ cv: JSON.parse(text), model: response.model }); }
      catch { return json({ error: "The AI returned an unreadable CV. Try again.", code: "empty" }, 502); }
    }
    return json({ text, model: response.model, truncated: response.stop_reason === "max_tokens" });
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) return json({ error: "The AI service is busy. Try again in a minute.", code: "busy" }, 503);
    if (e instanceof Anthropic.AuthenticationError) return json({ error: "AI rewriting is not set up correctly.", code: "not_configured" }, 503);
    if (e instanceof Anthropic.APIError) return json({ error: `AI service error (${e.status}).`, code: "api" }, 502);
    return json({ error: "AI rewriting failed. Try again.", code: "failed" }, 500);
  }
});
