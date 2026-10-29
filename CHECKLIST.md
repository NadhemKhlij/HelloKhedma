# HelloKhedma: launch checklist

What is done, and what still has to be done **by the owner** (outside the code: Supabase, GitHub, providers).
Update this file whenever an item changes. Last update: 2026-10-29.

## ⏳ Waiting for the owner

| # | Where | Task | Why it matters | Links / details |
|---|---|---|---|---|
| O1 | Supabase → Edge Functions | Create **`delete-account`** (Via Editor) with the code from `supabase/functions/delete-account/index.ts` | "Delete my account" fails until it exists | [raw code](https://raw.githubusercontent.com/NadhemKhlij/HelloKhedma/main/supabase/functions/delete-account/index.ts) |
| O4 | GitHub → Settings → Secrets and variables → Actions → Variables | Add **`CONTACT_EMAIL`** (dedicated address), then re-run the deploy | Legal pages show "contact address coming soon" | — |
| O5 | Supabase → Authentication → SMTP Settings | Set up **Resend or Brevo** SMTP, then turn **Confirm email** back on | Real users do not receive sign-up / magic-link emails | — |
| O6 | Supabase → SQL Editor | Run **`supabase/migrations/20261029000000_application_details.sql`** | Signed-in users: syncs application details (salary, contact, follow-up, interview, history). Guests work without it | [raw SQL](https://raw.githubusercontent.com/NadhemKhlij/HelloKhedma/main/supabase/migrations/20261029000000_application_details.sql) |
| O7 | sentry.io (optional) | Create a project, add **`SENTRY_DSN`** as a GitHub variable | Error monitoring | — |
| O8 | Domain (optional) | Buy `hellokhedma.com`, point it to GitHub Pages, update Supabase URLs | Credibility, shareable links | — |
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
| 2026-10-29 | Installable app (PWA, offline), "Remote jobs" tab, weekly study plan; no setup needed |
| 2026-10-29 | Interview prep page (practice, STAR stories, checklist); no setup needed |
| 2026-10-29 | "Companies I follow" on the Offers page (no setup needed: career-page APIs are called from the browser) |
| 2026-10-29 | O2 done: latest `job-search` deployed. **JSearch works**: 10 full offers per search (~6,000 characters each), "All sources" = Adzuna + JSearch with no warnings. Tip: deploy from a commit-pinned raw link, the plain raw link is cached ~5 min |
