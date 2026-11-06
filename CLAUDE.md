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
- `npm run check-content`: checks every content JSON (structure, French copies, identical code, skills known to
  js/ats.js, projects, AI track scripts). CI runs it before the smoke tests; a problem stops the deploy.
- Translations: `perl scripts/check-i18n.pl js` (every t() text has French) and
  `powershell -File scripts/check-fr-content.ps1 -Root .` (French course / interview files match the English structure).
- Course times: `powershell -File scripts/course-times.ps1 -Root .` writes `minutes` and `lessonCount` into
  content/courses/index.json (same formula as js/coursetime.js). Run it after adding or extending a course.
- Windows: deep checkout paths need `git config core.longpaths true`.
- When the owner deploys a function or runs SQL from the dashboard, give commit-pinned raw links
  (raw.githubusercontent.com/<owner>/<repo>/<commit>/…): the branch link is cached for ~5 minutes.
- Supabase CLI (or the dashboard equivalents):
  - `npx supabase link --project-ref <ref>`, then `npx supabase db push` (migrations); seed: run supabase/seed.sql.
  - `npx supabase functions deploy <name> --use-api` for job-search, delete-account and cv-tailor; or, from a phone:
    GitHub → Actions → "Deploy Supabase function" → Run workflow (.github/workflows/deploy-functions.yml, needs the
    SUPABASE_ACCESS_TOKEN secret). Prefer it to pasting code into the dashboard editor (long files get cut on a phone).
  - `npx supabase secrets set NAME=value`
- Smoke tests: `npm test` (Playwright, tests/smoke.spec.mjs) on the assembled site in _site/. CI runs them before
  every deploy; a failure stops the deploy. Push a branch other than `main` to run build + tests without publishing.
  Failures show as annotations on the run, readable without signing in:
  api.github.com/repos/NadhemKhlij/HelloKhedma/check-runs/<job id>/annotations. No Node on the owner's machine:
  check changes on a branch first.
- Deploy: push to `main`; .github/workflows/deploy.yml builds, runs the smoke tests and publishes to GitHub Pages,
  live at https://hellokhedma.io (custom domain set in GitHub → Settings → Pages; DNS at Cloudflare, "DNS only").
- Preview branches: a branch listed in PREVIEW_BRANCHES (deploy.yml) is published with main under
  `preview/<branch>/` (e.g. hellokhedma.io/preview/<branch>/). Pushing it runs its tests,
  then a publish run on main. A preview build keeps its own browser data ("preview:hk.*", js/lib.js), registers no
  service worker and shows a banner. Remove the branch from PREVIEW_BRANCHES once merged.

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
| SUPABASE_ACCESS_TOKEN | GitHub → Actions → Secrets (deploy-functions.yml only); never in code |
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
- Course playground: `"playground": { "name": "DAX.do", "url": "https://dax.do/", "about" }` in a course file (same url
  in French) + `"try": true` on lesson examples / written exercises with code that are full queries running there (▶
  copies the code and opens it; just a link). DAX.do queries build their own table with DATATABLE (no reliance on its
  sample model). Used by power-bi and dax.
- Runnable SQL exercises: add `"run": { "db": "shop", "ordered"?: true, "minColumns"?: n }` to an exercise with
  `"code": "sql"` (same in the French copy); the answer must run on content/sql/<db>.sql in SQLite (CI checks it).
  Datasets are fictional, small, and designed so each answer has one unambiguous result (no ties at a LIMIT):
  shop (SQL basics), dwh (star schema + SCD2 customers + staging orders with planted quality problems), payments
  (incident case, consistent with content/logs/payments-api.log). "Fix this query": `"start"` = the broken query the
  editor opens on (identical in French; CI checks it is not accepted). Query plans: `"run": { "db", "plan": "<index>" }`
  passes when EXPLAIN QUERY PLAN uses that index and scans no table. Take-home cases are consecutive exercises
  "Take-home case, <path> (n/N)" ending with a written answer (plain exercise, model answer).
- Auto-graded exercises: add `"type"` to an exercise (same in the French copy): choice, fill, order, match, groups,
  bug, scenario, logs, regex, cron, json, fixfile (fields in the js/drills.js header). regex / cron / json / fixfile keep
  the solution in `answer` (code, identical in both languages) and the explanation in `explain`. fixfile ("fix this
  file": Kubernetes / GitHub Actions YAML, Dockerfile) lists rule ids from js/filecheck.js; CI checks that the answer
  passes them all and the starting file fails at least one. Practice files go in content/logs/
  and content/data/ (fictional, small); compute answers from the file, never guess them. CI runs every answer.
  Append new exercises at the end (progress is stored by exercise index) and update `minutes` (course-times.ps1).
- Courses are static JSON in content/courses/ (index.json + one file per course): keep `lessonCount` and `minutes`
  in sync (minutes = courseTime() from js/coursetime.js; a smoke test fails when they drift) and use skill names that
  exist in js/ats.js so missing skills link to the course. Lessons have no hand-written duration. To extend a course,
  append lessons (progress is stored by lesson index).
- Portfolio projects are static JSON in content/projects/<path id>.json (+ fr/): 3 per path, real URLs checked with curl.
- AI engineer track in Tunisian ("Tunisian AI Teacher", js/aitrack.js): content/ai/index.json + content/ai/ar/ (Arabic
  letters, shown right to left) and content/ai/lat/ (3arbizi), same course format, same structure and identical code in
  both scripts (smoke test). Writer guide: Derja as a Tunisian trainer speaks, technical terms in English/French,
  3arbizi 3=ع 7=ح 9=ق 5=خ 8=غ ch=ش; Claude API facts only from the official reference. Times: course-times.ps1 -Catalog ai.
  Its portfolio projects: content/ai/ar/projects.json + content/ai/lat/projects.json (project format, ids "ai-…", same
  structure and links in both scripts, CV line in English), listed on #/ai and opened in #/project/<id> (smoke test).
- Never put API keys (RapidAPI, Adzuna, France Travail) or the service_role key in frontend code. The anon key is
  public by design; RLS protects the data.
- Every user-owned table needs RLS policies scoped to auth.uid(); add schema changes as a new migration file.
- Build DOM with the h() helper (textContent), never innerHTML with remote data (course text included).
- CV texts (every version, "hk.cvs" via js/cvs.js, and the CV maker draft "hk.cvmaker") stay in localStorage by default.
  They leave the browser in exactly two opt-in cases (owner decisions 2026-10-29 and 2026-11-06), never anywhere else:
  1. "Save my CVs to my account" (js/cvsync.js → the user's own RLS row in cv_sync), off by default, turned on by the
     signed-in user on the Account page after a notice; turning it off deletes the account copy;
  2. the AI rewrite / CV creation (js/tailor.js → cv-tailor function → Claude API), signed-in users only, after a notice
     shown before every send; the function stores and logs nothing.
- Anonymous statistics (js/insights.js → log_insight()) only after the user said yes ("hk.insights"): skill names,
  course ids and the path id, never CV or offer text, account ids or IPs. Do not add identifiers or free text to them.
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
- `#/project/<id>` → project → projects.js
- `#/ai` → ai → aitrack.js (AI engineer track in Tunisian; its courses open in `#/course/ai-…`)
- `#/cv` → cv → cvpage.js + cvs.js, ats.js, atsscore.js (tab CV check & ATS score); `#/cv/maker` → CV maker tab (cvmaker.js)
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
- js/cvs.js — CV versions (local; synced only if the user opted in): list, active version, version linked to a path
- js/cvsync.js — opt-in "Save my CVs to my account": merge per version between devices (cv_sync table)
- js/insights.js — opt-in anonymous statistics (asked once under a CV check; Account page switch)
- js/gaps.js — "Close the gaps": courses, roadmap steps and projects for the missing skills (#/cv, Tailor my CV)
- js/learnsync.js — learning progress synced for signed-in users (learning_sync; merge per key, lib.js onStore watcher)
- js/report.js — "⚑ Report a problem" on course and project pages (report_content(), e-mail fallback)
- scripts/check-content.mjs — content checks run by CI (structure, French copies, identical code, skills, AI track,
  every runnable SQL answer executed on its dataset and accepted by the grader, every auto-graded exercise checked)
- js/drills.js — auto-graded exercise formats in the Practice tab (predict the output, fill in, order, match, groups,
  spot the bug, scenarios, log analysis, regex, cron, jq); js/drillcheck.js — their checks, shared with CI (no DOM);
  js/regexrun.js + js/regexworker.js — the learner's regex runs in a Web Worker with a 2 s limit
- content/logs/, content/data/ — fictional log and JSON files for the log analysis and jq exercises
- js/filecheck.js — "fix this file" checks (Kubernetes manifests, GitHub Actions workflows, Dockerfiles), shared with CI;
  YAML read by js/vendor/js-yaml.esm.min.js (self-hosted, loaded on demand)
- js/sqlrun.js + js/sqlgrade.js — runnable SQL exercises: SQLite (sql.js, js/vendor) in a Web Worker with a 5 s limit on
  a fresh copy of content/sql/<db>.sql; the grader compares the learner's result with the course answer's result
- js/ats.js — skills dictionary, extraction, CV/offer matching, CV file reading
- js/atsscore.js — ATS score /100 (skills, job title, sections, contact, impact, length, layout) with fixes, EN + FR CVs
- js/cvmaker.js — CV maker: form, one layout model (cvModel) for the preview, the PDF and the ATS text (centered header;
  Summary, Skills, Experience…; bold title + dates on the right, bold company + place), live ATS score, CV version ("hk.cvmaker")
- js/cvpdf.js — "Download PDF": real text PDF built in the browser with pdf-lib (js/vendor/, self-hosted, loaded on
  demand), A4, Helvetica, no browser header/footer, controlled page breaks; print is only the fallback
- js/salary.js — salary of an offer (provider field or description, FR + EN wording), yearly amount, display
- js/offercheck.js — age of an offer, level (Junior…Lead) and trust warnings (scam signals, stale, no company)
- js/pulse.js — path market pulse on Home, from the offers seen on the Offers page (local only, "hk.pulse.<path>")
- js/tailor.js — "Tailor my CV" dialog: honest gap analysis, prompt to copy for the user's own AI, "Correct, tailor and
  create my CV" (one AI call: corrected + tailored CV opens in the CV maker with the changes and gaps) and "Rewrite
  only" (text) (cv-tailor function, signed-in users, after a notice)
- js/letters.js — letters pack: cover letter prompt to copy (offers, CV match), thank-you / follow-up emails from a
  tracker card (templates EN + FR, copy or open in the email app; nothing is sent by HelloKhedma)
- js/courses.js — course list and course page (tabs: lessons one at a time, quiz, flashcards, practice, interview, cheat sheet)
- js/practice.js — quiz (generated from the cheat sheet), flashcards, self-graded exercises, interview reveal
- js/activity.js — XP, study streak, 7-day strip, last course for "Resume" (local only, "hk.activity")
- js/interview.js — interview prep page
- sw.js, manifest.json, icons/ — installable app and offline cache
- fonts/ (Inter, Source Serif 4) and js/vendor/ (supabase-js, pdf-lib, sql.js, js-yaml): self-hosted, so a page load reaches no third party
  but Supabase; do not add CDN scripts, fonts or trackers without updating the privacy policy (both languages)
- js/coursetime.js — lesson and course durations computed from the content (reading + practice)
- js/projects.js — portfolio projects: Training panel, AI track projects (#/ai) and the project page (#/project/<id>)
- js/aitrack.js — AI engineer track in Tunisian: track page, Arabic / 3arbizi switch, content and RTL for its courses
- content/courses/, content/interview/, content/projects/ — course, interview and project content (JSON)
- supabase/migrations/ — schema and RLS
- supabase/seed.sql — paths, tracks, steps, tools, tips, keywords (idempotent)
- supabase/functions/job-search/, delete-account/, cv-tailor/ — Edge Functions (cv-tailor: AI CV rewrite with Claude)
- scripts/ — write-config.mjs (build config), check-links.mjs (link checker), preview-cdn.sh + serve.ps1 (preview without Node),
  gen-practice-2e.mjs (rebuilds the dwh / payments datasets and the payments log, fixed seed)
- .github/workflows/deploy.yml — build, smoke tests, publish to GitHub Pages (main only)
- .github/workflows/deploy-functions.yml — deploy one Edge Function on demand (Run workflow)
- tests/smoke.spec.mjs, playwright.config.mjs — smoke tests (guest flows; no sign-in, no job search)
- CHECKLIST.md — next-session note, owner tasks, done log; ROADMAP.md — roadmap + decisions log; README.md, GO-LIVE.md — setup guides

## Owner checklist
CHECKLIST.md tracks what is done and what the owner still has to do outside the code (Supabase, GitHub, providers).
At the start of a session and when finishing a feature, remind the owner briefly of the open items, add any new
owner task you create (e.g. a migration or function to deploy), and move items to "Done" when the owner confirms.
