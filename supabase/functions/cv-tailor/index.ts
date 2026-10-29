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
// Request  (POST JSON, user session in Authorization): { cv, offer: { title, company, text }, matched[], missing[], role, lang }
// Response (JSON): { text, model } · 401 not signed in · 429 daily limit · 503 not configured · 4xx/5xx { error, code }
// The daily limit reuses job_search_hit() and job_search_hits (migration 20261028000200), bucket "tailor:<user id>".

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
  if (limitErr) return json({ error: "Could not check the daily limit.", code: "limit_check" }, 500);
  if (!allowed) return json({ error: `Daily limit reached (${DAILY_LIMIT} AI rewrites a day). Try again tomorrow.`, code: "limit" }, 429);

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

  try {
    const response = await claude.beta.messages.create({
      model: MODEL,
      max_tokens: 16000,
      output_config: { effort: "medium" },
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default", // a declined request is retried on Anthropic's recommended model
      system: SYSTEM,
      messages: [{ role: "user", content: prompt }],
    });
    if (response.stop_reason === "refusal") {
      return json({ error: "The AI declined this request. Use the prompt to copy instead.", code: "refusal" }, 422);
    }
    const text = response.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("\n").trim();
    if (!text) return json({ error: "The AI returned no text. Try again.", code: "empty" }, 502);
    return json({ text, model: response.model, truncated: response.stop_reason === "max_tokens" });
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) return json({ error: "The AI service is busy. Try again in a minute.", code: "busy" }, 503);
    if (e instanceof Anthropic.AuthenticationError) return json({ error: "AI rewriting is not set up correctly.", code: "not_configured" }, 503);
    if (e instanceof Anthropic.APIError) return json({ error: `AI service error (${e.status}).`, code: "api" }, 502);
    return json({ error: "AI rewriting failed. Try again.", code: "failed" }, 500);
  }
});
