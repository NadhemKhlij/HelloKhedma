# HelloKhedma

## Project overview
A multi-path job hunting web app targeting Data Engineers, Business Analysts, Application Support and Data Analysts.
The selected path adapts the job search, trainings, tools, tips and ATS keywords. Includes an interactive Kanban tracker.

## Commands
- `npm install` then `npm run build`: writes js/config.js from env vars (scripts/write-config.mjs) and compiles Tailwind.
- Local dev: `npm run watch:css` + a static server, e.g. `npx serve -l 5173 .` (ES modules need http, not file://).
- `npm run check-links`: checks every URL in supabase/seed.sql (Node 18+).
- Supabase CLI (or the dashboard equivalents):
  - `npx supabase link --project-ref <ref>`, then `npx supabase db push` (migrations); seed: run supabase/seed.sql.
  - `npx supabase functions deploy job-search --use-api` and `npx supabase functions deploy delete-account --use-api`
  - `npx supabase secrets set NAME=value`
- Deploy: push to `main`; .github/workflows/deploy.yml builds and publishes to GitHub Pages.

## Tech stack
- Frontend: HTML, Tailwind CSS 3 (css/input.css → css/app.css), vanilla JS ES modules, no bundler; installable PWA.
- Backend: Supabase (PostgreSQL, Auth, Row Level Security, Edge Functions `job-search`, `delete-account`).
- Job data: France Travail, Adzuna and JSearch through the `job-search` function (only providers with secrets set run);
  company career pages (Greenhouse, Lever, Ashby, Workable, SmartRecruiters) and remote boards (Jobicy, Remotive)
  are called directly from the browser (public, key-less APIs).

## Environment variables (names only, never values)
| Name | Where |
|---|---|
| SUPABASE_URL, SUPABASE_ANON_KEY | GitHub → Actions → Variables (build writes js/config.js); local js/config.js |
| DEFAULT_COUNTRY, CONTACT_EMAIL, SENTRY_DSN (optional) | GitHub → Actions → Variables; local js/config.js |
| ADZUNA_APP_ID, ADZUNA_APP_KEY, RAPIDAPI_KEY, FRANCE_TRAVAIL_CLIENT_ID, FRANCE_TRAVAIL_CLIENT_SECRET | Supabase → Edge Functions → Secrets |
| DEFAULT_PROVIDER, CACHE_TTL_HOURS, RATE_LIMIT_GUEST, RATE_LIMIT_USER (optional) | Supabase → Edge Functions → Secrets |
| SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (functions) | Provided automatically by Supabase; never in frontend |

## Rules for Claude Code
- Keep the UI responsive and clean, in both the dark and light themes (HelloKhedma modern aesthetic).
- Keep persistence intact: guests use localStorage, signed-in users use Supabase, and guest data is imported into
  Supabase on first sign-in (js/store.js).
- No permanent mock data. Path content lives in the database (career_paths, path_resources, training_tracks,
  training_steps): edit supabase/seed.sql, not the JS.
- Courses are static JSON in content/courses/ (index.json + one file per course): keep `lessonCount` in sync and use
  skill names that exist in js/ats.js so missing skills link to the course.
- Never put API keys (RapidAPI, Adzuna, France Travail) or the service_role key in frontend code. The anon key is
  public by design; RLS protects the data.
- Every user-owned table needs RLS policies scoped to auth.uid(); add schema changes as a new migration file.
- Build DOM with the h() helper (textContent), never innerHTML with remote data (course text included).
- The CV text stays in localStorage ("hk.cv.text") only; never send it to Supabase or any API.
- Keep the privacy policy (index.html, #/privacy) in sync when adding a provider or any new personal data.

## Before editing a file
Read the header comment of any file before modifying it; update the header if behaviour changes.

## Definition of done
- `npm run build` passes.
- Tested as a guest AND as a signed-in user (persistence and guest import intact).
- Checked at mobile width.
- Privacy policy updated if a provider or personal data was added.
- Seed / content JSON / migrations updated instead of hardcoded data.
- CHECKLIST.md updated with any new owner task (migration to run, function to deploy, secret to set).

## Routes (`#/<route>[/<param>]`, router in js/app.js)
- `#/` → home → app.js
- `#/offers` → offers → app.js + jobs.js, companies.js, remote.js (three tabs)
- `#/training` → training → app.js (tracks, study plan) + courses.js (course list)
- `#/course/<id>` → course → courses.js
- `#/cv` → cv → app.js + ats.js
- `#/interview` → interview → interview.js
- `#/applications` → applications → tracker.js + store.js
- `#/account` → account → app.js
- `#/legal`, `#/privacy` → legal, privacy → static HTML in index.html
- Anything else → home (keeps Supabase's `#access_token=` for supabase-js)

## Layout
- index.html — page shell, nav, one `<section data-page>` per route, dialogs, legal and privacy text
- css/input.css — Tailwind source and theme variables (css/app.css is generated, gitignored)
- js/app.js — entry point: state, router, Home / Offers / Training / CV / Account rendering
- js/lib.js — DOM helpers (h, $), localStorage wrapper, toast, download
- js/supabase.js — Supabase client and runtime CONFIG
- js/config.example.js — template for js/config.js (generated in production, gitignored)
- js/auth.js — sign-in dialog
- js/store.js — LocalStore / CloudStore and guest import
- js/tracker.js — tracker board, details dialog, stats, CSV, calendar files
- js/jobs.js — client for the job-search function, job-board fallback links
- js/companies.js — "Companies I follow" (career-page APIs)
- js/remote.js — "Remote jobs" (Jobicy, Remotive)
- js/ats.js — skills dictionary, extraction, CV/offer matching, CV file reading
- js/courses.js — course list and course page
- js/interview.js — interview prep page
- sw.js, manifest.json, icons/ — installable app and offline cache
- content/courses/, content/interview/ — course and interview content (JSON)
- supabase/migrations/ — schema and RLS
- supabase/seed.sql — paths, tracks, steps, tools, tips, keywords (idempotent)
- supabase/functions/job-search/, supabase/functions/delete-account/ — Edge Functions
- scripts/write-config.mjs, scripts/check-links.mjs — build config, link checker
- .github/workflows/deploy.yml — build and publish to GitHub Pages
- CHECKLIST.md — owner tasks and done log; ROADMAP.md — product roadmap; README.md, GO-LIVE.md — setup guides

## Owner checklist
CHECKLIST.md tracks what is done and what the owner still has to do outside the code (Supabase, GitHub, providers).
At the start of a session and when finishing a feature, remind the owner briefly of the open items, add any new
owner task you create (e.g. a migration or function to deploy), and move items to "Done" when the owner confirms.
