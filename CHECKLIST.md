# HelloKhedma: launch checklist

## 👉 Next session (written 2026-10-30)
- **Just finished (2026-10-30):** offer checks (ROADMAP 3.1 + 3.8, js/offercheck.js): "Posted N days ago" chip, date
  and level filters, "Most recent" sort by date, "⚠ Check this offer" warnings with reasons and a filter to hide them.
  Before that, the letters pack (5.1, js/letters.js). Both tested as a guest in the local preview with sample offers
  (not with live search results, not signed in). Roadmap gained items from a jobicy.com review.
- **Before that:** "Rewrite with AI" in Tailor my CV (ROADMAP 5.2): cv-tailor function (Claude Opus 5.5), signed-in
  only, 5 a day, notice before every send, privacy policy updated. It needs O16 (API key + deploy); the function code
  was not run by Claude (no Deno/key here), only the app side. Before that: "Tailor my CV" prompt, salary on offers,
  French content, app.js split, "CV sent", CV versions, FR/EN interface. O13–O15 done. Not tested signed in.
- **Owner, first:** O16 (Anthropic key + deploy cv-tailor), then test "Rewrite with AI" signed in (O12). Also check
  "Confirm email" is OFF in Supabase and delete the Resend key that was pasted in the chat (O5b).
- **Next in code (owner's choice):** smoke tests in CI (ROADMAP, Engineering hygiene), accessibility pass (1.9),
  LinkedIn import (3.10), path market pulse (3.9), networking contacts; also update supabase/setup-all.sql. 2026-10-30:
  ROADMAP gained items from a jobicy.com review (2.8, 3.8–3.10, 4.4b, 4.7, 5.5).
- **Source of truth:** github.com/NadhemKhlij/HelloKhedma (`main`). If the local folder is gone, clone it again;
  local preview without Node: scripts/preview-cdn.sh + scripts/serve.ps1.

What is done, and what still has to be done **by the owner** (outside the code: Supabase, GitHub, providers).
Update this file whenever an item changes. Last update: 2026-10-29.

## ⏳ Waiting for the owner

| # | Where | Task | Why it matters | Links / details |
|---|---|---|---|---|
| O4 | GitHub → Settings → Secrets and variables → Actions → Variables | Add **`CONTACT_EMAIL`** (dedicated address), then re-run the deploy | Legal pages show "contact address coming soon" | — |
| O5 | Resend + Supabase → Authentication → SMTP | **Half done.** Resend SMTP works with the test sender `onboarding@resend.dev` (tested 2026-10-29), which only delivers to the owner's Resend email. To finish: verify a domain in Resend (needs O8), create a sending-only key for it, set the Supabase sender to `no-reply@mail.<domain>`. **Until then keep "Confirm email" OFF**, or other people cannot sign up. **Free alternative (no domain):** a dedicated Gmail (e.g. `hellokhedma.app@gmail.com`) with 2-Step Verification + an app password as Supabase SMTP (`smtp.gmail.com`, port 465, ~500 emails/day); it can also be the O4 contact address | Real users need confirmation / magic-link emails | Resend: Domains → Add domain (`mail.<domain>`, EU region) |
| O5b | resend.com → API Keys | Delete the key that was pasted in the chat on 2026-10-29 (the one used in Supabase was created separately) | An exposed key can send email from the account | — |
| O7 | sentry.io (optional) | Create a project, add **`SENTRY_DSN`** as a GitHub variable | Error monitoring | — |
| O8 | Domain (needed for O5 with Resend; not needed with the Gmail option) | `hellokhedma.com` was available on 2026-10-29 (also .fr/.app/.io/.co). Suggested: Cloudflare Registrar (~$10–11/yr, one-click Resend DNS). Then: GitHub Pages custom domain + HTTPS, Supabase Site/Redirect URLs, Resend `mail.` subdomain. Free option: eu.org (slow manual approval). Guest data is per address: sign in / export before switching | Professional email sender, credibility, shareable links | — |
| O9 | Legal (before a big launch) | Have the legal notice and privacy policy reviewed | Templates, not legal advice | — |
| O10 | Your phone | Install the app (Android: "Install the app" link in the footer; iPhone: Safari → Share → Add to Home Screen) and check it opens offline | PWA install was only tested in a desktop browser | — |
| O16 | console.anthropic.com + Supabase | **1.** Anthropic Console → API keys → create a key named "hellokhedma-cv-tailor"; set a monthly spend limit (Settings → Limits). **2.** Supabase → Edge Functions → Secrets → add `ANTHROPIC_API_KEY` = that key (never paste it in a chat). **3.** Edge Functions → Deploy a new function named `cv-tailor`, paste the file below, keep "Verify JWT" on, Deploy. Optional secrets: `CV_TAILOR_DAILY_LIMIT` (default 5), `CV_TAILOR_MODEL` (default `claude-opus-5-5`, about 8 cents a rewrite; `claude-sonnet-5-5` about half) | "Rewrite with AI" answers "not set up yet" until then; the copy-prompt option works meanwhile | [cv-tailor/index.ts at fdc6405](https://raw.githubusercontent.com/NadhemKhlij/HelloKhedma/fdc640575f9d687f88d56629550bbad490611933/supabase/functions/cv-tailor/index.ts) |
| O12 | Live site | Sign in and use the app in French, then press **EN** and back: check nothing is left in the wrong language and the French reads naturally (report odd wording) | Translations were written by Claude and only tested as a guest | js/i18n-fr.js |
| O11 | Content (before promoting) | Have the 17 courses, interview questions and model answers reviewed by people in each field, in English **and French** | Written and translated by Claude: realistic but unreviewed | content/courses/, content/interview/ (French in fr/ subfolders) |

## ✅ Done

| Date | What |
|---|---|
| 2026-10-30 | Offer checks: posted date chip + filter, level (Junior…Lead) + filter, "⚠ Check this offer" warnings (scam signals, stale, no company) + filter; no setup needed |
| 2026-10-30 | Letters pack: cover letter prompt on offers and the CV match, thank-you / follow-up emails from tracker cards and Home (EN + FR); no setup needed |
| 2026-10-29 | Interactive learning: lesson-by-lesson course player, quiz and flashcards from every cheat sheet, self-graded exercises, roadmap of tracks, streak + XP; no setup needed |
| 2026-10-29 | New look (warm ivory / charcoal, serif titles, greeting + summary cards, illustrated path cards, segmented tabs, page fade-in); no setup needed |
| 2026-10-28 | App renamed HelloKhedma; Supabase project, tables and seed; GitHub Pages deploy; Adzuna search with cache + rate limit |
| 2026-10-28 | Multi-page app (Home, Offers, Training, CV check, Applications) |
| 2026-10-28 | CV skills extraction, offer skill highlights and CV fit score |
| 2026-10-29 | France Travail support in code (owner's account has no access to the offers API, so unused) |
| 2026-10-29 | JSearch key added by owner (the 404 was fixed later: see the O2 row) |
| 2026-10-29 | Light / dark theme |
| 2026-10-29 | 17 skill courses with cheat sheets, linked from missing skills |
| 2026-10-29 | Legal notice, privacy policy, Account & data page (export / delete), source credits, error handling, SEO tags |
| 2026-10-29 | Tracker 2.0 and offer filters (see ROADMAP.md, Phase 2 and 3) |
| 2026-10-29 | Owner redeployed `job-search` (IP hashing, detailed errors). Diagnosis: JSearch removed `/search`; code moved to `/search-v2` |
| 2026-10-29 | O5 step 1: Resend SMTP configured in Supabase, sign-up confirmation email received with the test sender |
| 2026-10-29 | O1 done: `delete-account` deployed (verified: answers 401 without a session, CORS ok). O6 done: tracker detail migration run (verified: new columns exist) |
| 2026-10-29 | Installable app (PWA, offline), "Remote jobs" tab, weekly study plan; no setup needed |
| 2026-10-29 | Interview prep page (practice, STAR stories, checklist); no setup needed |
| 2026-10-29 | "Companies I follow" on the Offers page (no setup needed: career-page APIs are called from the browser) |
| 2026-10-29 | Salary on offers: chip, filter, sort, copied to the tracker, rights tip |
| 2026-10-29 | "Rewrite with AI" (cv-tailor + Claude) built; live once O16 is done |
| 2026-10-29 | "Tailor my CV": gap analysis + prompt to copy (no API, no setup); in-app AI button disabled for later |
| 2026-10-29 | O13 and O14 done by owner. Verified in the live database: cv_version column exists; French texts for 4 paths, 12 tracks, 56 steps, 20 tools, 12 tips (keywords stay English); the live Training and Home pages show them |
| 2026-10-29 | O15 done: job-search redeployed by owner. Verified: every result carries the salary field; an Adzuna salary (64–85 k€) shows on the offer |
| 2026-10-29 | French content: 17 courses + interview prep live in French; path content needs O14 |
| 2026-10-29 | js/app.js split into one module per page (no change for users) |
| 2026-10-29 | "CV sent" per application (2.7); signed-in sync needs O13 |
| 2026-10-29 | Several CV versions (3.7); no setup needed |
| 2026-10-29 | French / English interface (FR/EN button, French legal pages); no setup needed |
| 2026-10-29 | O2 done: latest `job-search` deployed. **JSearch works**: 10 full offers per search (~6,000 characters each), "All sources" = Adzuna + JSearch with no warnings. Tip: deploy from a commit-pinned raw link, the plain raw link is cached ~5 min |
