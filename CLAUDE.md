# HelloKhedma

## Project overview
A multi-path job hunting web app targeting Data Engineers, Business Analysts, Application Support, Data Analysts and DevOps Engineers.
The selected path adapts the job search, trainings, tools, tips and ATS keywords. Includes an interactive Kanban tracker.

## Commands
- `npm install` then `npm run build`: writes js/config.js from env vars (scripts/write-config.mjs) and compiles Tailwind.
- Local dev: `npm run watch:css` + a static server, e.g. `npx serve -l 5173 .` (ES modules need http, not file://).
- No Node on the machine: `sh scripts/preview-cdn.sh`, then `scripts/serve.ps1` (or the "hellokhedma" entry of
  .claude/launch.json) and open /preview-test.html. Never commit preview-test.html. The real build runs in CI.
- `npm run check-links`: checks every URL in supabase/seed.sql (Node 18+).
- Translations: `perl scripts/check-i18n.pl js` (every t() text has French) and
  `powershell -File scripts/check-fr-content.ps1 -Root .` (French course / interview files match the English structure).
- Windows: deep checkout paths need `git config core.longpaths true`.
- When the owner deploys a function or runs SQL from the dashboard, give commit-pinned raw links
  (raw.githubusercontent.com/<owner>/<repo>/<commit>/…): the branch link is cached for ~5 minutes.
- Supabase CLI (or the dashboard equivalents):
  - `npx supabase link --project-ref <ref>`, then `npx supabase db push` (migrations); seed: run supabase/seed.sql.
  - `npx supabase functions deploy <name> --use-api` for job-search, delete-account and cv-tailor
  - `npx supabase secrets set NAME=value`
- Smoke tests: `npm test` (Playwright, tests/smoke.spec.mjs) on the assembled site in _site/. CI runs them before
  every deploy; a failure stops the deploy. Push a branch other than `main` to run build + tests without publishing.
  Failures show as annotations on the run, readable without signing in:
  api.github.com/repos/NadhemKhlij/HelloKhedma/check-runs/<job id>/annotations. No Node on the owner's machine:
  check changes on a branch first.
- Deploy: push to `main`; .github/workflows/deploy.yml builds, runs the smoke tests and publishes to GitHub Pages.

## Tech stack
- Frontend: HTML, Tailwind CSS 3 (css/input.css → css/app.css), vanilla JS ES modules, no bundler; installable PWA.
- Backend: Supabase (PostgreSQL, Auth, Row Level Security, Edge Functions `job-search`, `delete-account`, `cv-tailor`).
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
| ANTHROPIC_API_KEY; CV_TAILOR_DAILY_LIMIT, CV_TAILOR_MODEL (optional) | Supabase → Edge Functions → Secrets (cv-tailor) |
| SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (functions) | Provided automatically by Supabase; never in frontend |

## Rules for Claude Code
- Keep the UI responsive and clean, in both the dark and light themes: warm ivory / charcoal surfaces, serif page
  titles (Source Serif 4, `.serif` / `.page-title`), Inter text, soft `.panel` cards, ink `.btn`, filled `.chip` pills;
  the path color (--accent) is for highlights. Use the tokens in css/input.css rather than new colors.
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
- CV texts (every version, "hk.cvs" via js/cvs.js) stay in localStorage only; never send them to Supabase or any API.
  Single exception: "Rewrite with AI" (js/tailor.js → cv-tailor function → Claude API), signed-in users only, after a
  notice shown before every send; the function stores and logs nothing. Never send the CV anywhere else.
- Keep the privacy policy (index.html, #/privacy) in sync when adding a provider or any new personal data.
- Every user-facing text is written in English and goes through t() / tn() (js/i18n.js); add its French to
  js/i18n-fr.js. Static text in index.html is translated automatically if its English is a key there. The legal notice
  and privacy policy exist twice in index.html (data-lang="fr" / "en"): update both.
- Content is bilingual too: courses and interview JSON have French copies under content/courses/fr/ and
  content/interview/fr/ (same ids, same array lengths and order: lesson progress, ratings and ticks use them; code
  stays identical); path content has `_fr` columns filled by the French block at the end of supabase/seed.sql
  (matched on the English title). Missing French falls back to English. Keywords and job titles stay English.

## Before editing a file
Read the header comment of any file before modifying it; update the header if behaviour changes.

## Definition of done
- `npm run build` passes, and the smoke tests pass in CI; a new page or main flow gets a test in tests/smoke.spec.mjs.
- Tested as a guest AND as a signed-in user (persistence and guest import intact).
- Checked at mobile width.
- New texts translated in js/i18n-fr.js and checked in French (FR/EN button).
- Privacy policy updated if a provider or personal data was added.
- Seed / content JSON / migrations updated instead of hardcoded data.
- CHECKLIST.md updated with any new owner task (migration to run, function to deploy, secret to set).

## Routes (`#/<route>[/<param>]`, router in js/router.js)
- `#/` → home → home.js (path cards: app.js)
- `#/offers` → offers → offers.js + jobs.js, companies.js, remote.js (three tabs)
- `#/training` → training → training.js (My learning, roadmap of tracks, study plan) + courses.js (course list)
- `#/course/<id>` → course → courses.js
- `#/cv` → cv → cvpage.js + cvs.js, ats.js
- `#/interview` → interview → interview.js
- `#/applications` → applications → applications.js + tracker.js, store.js
- `#/account` → account → account.js
- `#/legal`, `#/privacy` → legal, privacy → static HTML in index.html
- Anything else → home (keeps Supabase's `#access_token=` for supabase-js)

## Layout
- index.html — page shell, nav, one `<section data-page>` per route, dialogs, legal and privacy text
- css/input.css — Tailwind source and theme variables (css/app.css is generated, gitignored)
- js/app.js — entry point: start-up, career path selection, sign-in, theme / language, error monitoring, PWA
- js/state.js — shared state (state, path(), fail(), skill chips); js/router.js — routes and page focus
- js/home.js, js/offers.js, js/training.js, js/cvpage.js, js/applications.js, js/account.js — one module per page
- js/lib.js — DOM helpers (h, svg, $), localStorage wrapper, toast, download
- js/icons.js — path card illustrations and the progress ring (Home)
- js/i18n.js — interface language (t, tn, FR/EN switch, static page translation); js/i18n-fr.js — French texts
- js/supabase.js — Supabase client and runtime CONFIG
- js/config.example.js — template for js/config.js (generated in production, gitignored)
- js/auth.js — sign-in dialog
- js/store.js — LocalStore / CloudStore and guest import
- js/tracker.js — tracker board, details dialog, stats, CSV, calendar files
- js/jobs.js — client for the job-search function, job-board fallback links
- js/companies.js — "Companies I follow" (career-page APIs)
- js/remote.js — "Remote jobs" (Jobicy, Remotive)
- js/cvs.js — CV versions (local only): list, active version, version linked to a path
- js/ats.js — skills dictionary, extraction, CV/offer matching, CV file reading
- js/salary.js — salary of an offer (provider field or description, FR + EN wording), yearly amount, display
- js/offercheck.js — age of an offer, level (Junior…Lead) and trust warnings (scam signals, stale, no company)
- js/tailor.js — "Tailor my CV" dialog: honest gap analysis, prompt to copy for the user's own AI, and "Rewrite with AI"
  (cv-tailor function, signed-in users, after a notice)
- js/letters.js — letters pack: cover letter prompt to copy (offers, CV match), thank-you / follow-up emails from a
  tracker card (templates EN + FR, copy or open in the email app; nothing is sent by HelloKhedma)
- js/courses.js — course list and course page (tabs: lessons one at a time, quiz, flashcards, practice, interview, cheat sheet)
- js/practice.js — quiz (generated from the cheat sheet), flashcards, self-graded exercises, interview reveal
- js/activity.js — XP, study streak, 7-day strip, last course for "Resume" (local only, "hk.activity")
- js/interview.js — interview prep page
- sw.js, manifest.json, icons/ — installable app and offline cache
- content/courses/, content/interview/ — course and interview content (JSON)
- supabase/migrations/ — schema and RLS
- supabase/seed.sql — paths, tracks, steps, tools, tips, keywords (idempotent)
- supabase/functions/job-search/, delete-account/, cv-tailor/ — Edge Functions (cv-tailor: AI CV rewrite with Claude)
- scripts/ — write-config.mjs (build config), check-links.mjs (link checker), preview-cdn.sh + serve.ps1 (preview without Node)
- .github/workflows/deploy.yml — build, smoke tests, publish to GitHub Pages (main only)
- tests/smoke.spec.mjs, playwright.config.mjs — smoke tests (guest flows; no sign-in, no job search)
- CHECKLIST.md — next-session note, owner tasks, done log; ROADMAP.md — roadmap + decisions log; README.md, GO-LIVE.md — setup guides

## Owner checklist
CHECKLIST.md tracks what is done and what the owner still has to do outside the code (Supabase, GitHub, providers).
At the start of a session and when finishing a feature, remind the owner briefly of the open items, add any new
owner task you create (e.g. a migration or function to deploy), and move items to "Done" when the owner confirms.
