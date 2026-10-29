# HelloKhedma: launch checklist

What is done, and what still has to be done **by the owner** (outside the code: Supabase, GitHub, providers).
Update this file whenever an item changes. Last update: 2026-10-29.

## ⏳ Waiting for the owner

| # | Where | Task | Why it matters | Links / details |
|---|---|---|---|---|
| O4 | GitHub → Settings → Secrets and variables → Actions → Variables | Add **`CONTACT_EMAIL`** (dedicated address), then re-run the deploy | Legal pages show "contact address coming soon" | — |
| O5 | Resend + Supabase → Authentication → SMTP | **Half done.** Resend SMTP works with the test sender `onboarding@resend.dev` (tested 2026-10-29), which only delivers to the owner's Resend email. To finish: verify a domain in Resend (needs O8), create a sending-only key for it, set the Supabase sender to `no-reply@mail.<domain>`. **Until then keep "Confirm email" OFF**, or other people cannot sign up | Real users need confirmation / magic-link emails | Resend: Domains → Add domain (`mail.<domain>`, EU region) |
| O5b | resend.com → API Keys | Delete the key that was pasted in the chat on 2026-10-29 (the one used in Supabase was created separately) | An exposed key can send email from the account | — |
| O7 | sentry.io (optional) | Create a project, add **`SENTRY_DSN`** as a GitHub variable | Error monitoring | — |
| O8 | Domain (**needed for O5**) | Buy `hellokhedma.com`, point it to GitHub Pages, update Supabase URLs; add `mail.` subdomain in Resend | Email to real users, credibility, shareable links | — |
| O9 | Legal (before a big launch) | Have the legal notice and privacy policy reviewed | Templates, not legal advice | — |

## ✅ Done

| Date | What |
|---|---|
| 2026-10-28 | App renamed HelloKhedma; Supabase project, tables and seed; GitHub Pages deploy; Adzuna search with cache + rate limit |
| 2026-10-28 | Multi-page app (Home, Offers, Training, CV check, Applications) |
| 2026-10-28 | CV skills extraction, offer skill highlights and CV fit score |
| 2026-10-29 | France Travail support in code (owner's account has no access to the offers API, so unused) |
| 2026-10-29 | JSearch key added by owner (currently answers 404, see O3) |
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
| 2026-10-29 | O2 done: latest `job-search` deployed. **JSearch works**: 10 full offers per search (~6,000 characters each), "All sources" = Adzuna + JSearch with no warnings. Tip: deploy from a commit-pinned raw link, the plain raw link is cached ~5 min |
