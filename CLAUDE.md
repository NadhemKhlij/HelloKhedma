# HelloKhedma

## Project overview
A multi-path job hunting web app targeting Data Engineers, Business Analysts, Application Support, Data Analysts, DevOps Engineers,
AI Engineers and Digital Marketing (path id "mk", 2026-11-09: seed, skills, interview, projects and six courses: marketing-foundations, seo, paid-ads, ga4,
  email-crm, marketing-analytics).
The selected path adapts the job search, trainings, tools, tips and ATS keywords. Includes an interactive Kanban tracker.

## Commands
- `npm install` then `npm run build`: writes js/config.js from env vars (scripts/write-config.mjs) and compiles Tailwind.
- Local dev: `npm run watch:css` + a static server, e.g. `npx serve -l 5173 .` (ES modules need http, not file://).
- No Node on the machine: `sh scripts/preview-cdn.sh`, then `scripts/serve.ps1` (or the "hellokhedma" entry of
  .claude/launch.json) and open /preview-test.html. Never commit preview-test.html. The real build runs in CI.
- `npm run check-links`: checks every URL in supabase/seed.sql (Node 18+).
- `npm run check-content`: checks every content JSON (structure, French copies, identical code, skills known to
  js/ats.js, projects, AI track scripts). CI runs it before the smoke tests; a problem stops the deploy.
- Translations: `perl scripts/check-i18n.pl js` (every t() text has French, no French key in two js/fr/ files; CI runs it) and
  `powershell -File scripts/check-fr-content.ps1 -Root .` (French course / interview files match the English structure).
- Course times: `powershell -File scripts/course-times.ps1 -Root .` writes `minutes` and `lessonCount` into
  content/courses/index.json (same formula as js/coursetime.js). Run it after adding or extending a course.
- Windows: deep checkout paths need `git config core.longpaths true`.
- When the owner deploys a function or runs SQL from the dashboard, give commit-pinned raw links
  (raw.githubusercontent.com/<owner>/<repo>/<commit>/…): the branch link is cached for ~5 minutes.
- Supabase CLI (or the dashboard equivalents):
  - `npx supabase link --project-ref <ref>`, then `npx supabase db push` (migrations); seed: run supabase/seed.sql.
  - `npx supabase functions deploy <name> --use-api` for job-search, delete-account, cv-tailor and explain-mistake; or, from a phone:
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

## Working in parallel (several Claude sessions, the owner's and a friend's)
- Never commit on main directly: one branch per feature, pushed so CI tests it, then fast-forwarded into main.
- At the start of a session and before every merge into main: `sh scripts/whats-new.sh`. It fetches GitHub, lists what
  was deployed on main since your branch started, the files changed on both sides and the other branches in progress.
  When main moved: `git rebase origin/main`, run the checks again, then merge; tell the owner what the others shipped.
  CI repeats the warning on every branch push ("Up to date with main?", summary of the run).
- French texts are split by area in js/fr/ (shell, offers, learning, exercises, cv, tracker, interview): add a text to
  its page's file, so sessions on different pages do not touch the same file. A branch started before 2026-11-08 that
  added French to js/i18n-fr.js: move its block into the right js/fr/ file when rebasing.
- Conflict-prone files: js/fr/*.js (keep both blocks when rebasing), CHECKLIST.md / ROADMAP.md (keep both
  rows), sw.js (VERSION: take the higher number + 1, keep every SHELL file), js/router.js ROUTES, index.html.
- The **AI Engineer** career path ("ai") was merged on 2026-11-08: its courses and projects are the AI track
  (content/ai/, four languages); a change to an AI course goes into all four languages (see "Rules for Claude Code").

## Tech stack
- Frontend: HTML, Tailwind CSS 3 (css/input.css → css/app.css), vanilla JS ES modules, no bundler; installable PWA.
- Backend: Supabase (PostgreSQL, Auth, Row Level Security, Edge Functions `job-search`, `delete-account`, `cv-tailor`,
  `explain-mistake`, `follow-up-reminders`, `search-alerts`).
- Job data: France Travail, Adzuna, JSearch and Jooble through the `job-search` function (only providers with secrets set
  run; France Travail's API is closed to new users, its option is hidden until keys exist), plus Himalayas (remote, no
  CORS) and Arbeitnow (Europe, 2 MB pages, read hourly into the cache) there, key-less, always in "All sources";
  company career pages (Greenhouse, Lever, Ashby, Workable, SmartRecruiters, Recruitee, Personio) and remote boards
  (Jobicy, Remotive, Remote OK) are called directly from the browser (public, key-less, CORS checked from GitHub's
  servers 2026-11-09). Credits: offers.js CREDITS (Remote OK: name, never the logo, link keeps the referrer; Himalayas:
  apply via its applicationLink). New source = check its terms + CORS, CREDITS, privacy policy (FR + EN).
  Free quotas (2026-11-09): Adzuna 250 calls/day (asks 50 offers a call), JSearch 200/month (page 1 only), Jooble 500 for
  the key's life (backup only: when the others found < 10 offers). Country France: French titles (career_paths.
  job_titles_fr, paired by position with job_titles) are searched with their English pair (`alt`).
  With the owner's keys: La bonne alternance (work-study, France; ROME codes per path LBA_ROMES, the app sends `path`)
  and Careerjet (~90 country sites, no Tunisia; the visitor's IP + user agent go with each call, privacy policy).

## Environment variables (names only, never values)
| Name | Where |
|---|---|
| SUPABASE_URL, SUPABASE_ANON_KEY | GitHub → Actions → Variables (build writes js/config.js); local js/config.js |
| SUPABASE_ACCESS_TOKEN | GitHub → Actions → Secrets (deploy-functions.yml only); never in code |
| DEFAULT_COUNTRY, CONTACT_EMAIL, SENTRY_DSN, CF_ANALYTICS_TOKEN (optional) | GitHub → Actions → Variables; local js/config.js |
| ADZUNA_APP_ID, ADZUNA_APP_KEY, RAPIDAPI_KEY, JOOBLE_API_KEY (+ optional JOOBLE_HOST), FRANCE_TRAVAIL_CLIENT_ID, FRANCE_TRAVAIL_CLIENT_SECRET | Supabase → Edge Functions → Secrets |
| DEFAULT_PROVIDER, CACHE_TTL_HOURS, RATE_LIMIT_GUEST, RATE_LIMIT_USER (optional) | Supabase → Edge Functions → Secrets |
| LBA_API_TOKEN (La bonne alternance), CAREERJET_API_KEY (Careerjet publisher key, hellokhedma.io) | Supabase → Edge Functions → Secrets (job-search) |
| ANTHROPIC_API_KEY; CV_TAILOR_DAILY_LIMIT, CV_TAILOR_MODEL (optional) | Supabase → Edge Functions → Secrets (cv-tailor) |
| EXPLAIN_DAILY_LIMIT, EXPLAIN_MODEL, ASK_DAILY_LIMIT (optional; uses ANTHROPIC_API_KEY) | Supabase → Edge Functions → Secrets (explain-mistake) |
| RESEND_API_KEY, CRON_SECRET; REMINDERS_FROM, SITE_URL (optional) | Supabase → Edge Functions → Secrets (follow-up-reminders, search-alerts; CRON_SECRET also lets search-alerts call job-search) |
| ALERTS_DAILY_MAX (optional, default 120 alert searches a day) | Supabase → Edge Functions → Secrets (search-alerts) |
| REMINDERS_CRON_SECRET (same value as CRON_SECRET) | GitHub → Actions → Secrets (reminders.yml only) |
| SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (functions) | Provided automatically by Supabase; never in frontend |

## Rules for Claude Code
- Keep the UI responsive and clean, in both the dark and light themes: warm ivory / charcoal surfaces, serif page
  titles (Source Serif 4, `.serif` / `.page-title`), Inter text, soft `.panel` cards, ink `.btn`, filled `.chip` pills;
  the path color (--accent) is for highlights. Use the tokens in css/input.css rather than new colors.
- Accessibility (WCAG 2.1 AA, smoke tests run axe-core on the main pages in both themes): text in the path colour uses
  `var(--accent-ink)`, white text sits on `var(--accent-fill)`, --accent only for fills / bars / borders; status texts use
  `var(--ok)` / `var(--warn)` / `var(--bad)` (never the raw hex), `--ok-fill` / `--bad-fill` behind white text. Buttons
  for actions (never clickable divs), labels on inputs, role="tablist" tab bars get ←/→ from app.js, scrollable code
  blocks get tabindex="0"; a new page or dialog goes into the axe smoke test.
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
  "Take-home case, <path> (n/N)" (French "Cas pratique, …") ending with a written answer (plain exercise, model answer):
  Data Analyst (sql), Data Engineer (airflow), Application Support (itil-incidents), Business Analyst (requirements),
  DevOps (ci-cd; log content/logs/checkout-deploy.log).
- Runnable Python exercises (step 5): `"code": "python"` + `"run": { "python": "<hidden tests: asserts with an English
  message>" }` (same in the French copy; optional `"start"` code that must fail). The learner's code runs in Pyodide
  (Python 3.14, standard library + pandas / numpy) in a Web Worker, then the tests in the same namespace and a fresh
  temporary folder (tests may write the files they need). CI (check-content) runs every answer with the same Pyodide and
  checks that the tests fail without code. Pyodide is a devDependency copied into js/vendor/pyodide/ by `npm run build`
  (scripts/copy-pyodide.mjs; gitignored, 13 MB, loaded on the first ▶ Run); the same script downloads pandas and its
  dependencies from jsDelivr at build time, checked against the SHA-256 of pyodide-lock.json (CI stops on a failure),
  so the site serves them itself; a pandas import loads them (about 8 MB more) before the run.
- Excel formula exercises (type "sheet", code "excel"): `rows` (the sheet from A1, text or numbers), `cell` (where the
  formula goes), `answer` (a formula using cells), same in French. js/excelcheck.js evaluates with fast-formula-parser
  (MIT, js/vendor/formula.esm.min.js) + our own Excel-rule functions (COUNTIFS, SUMIFS, XLOOKUP, MATCH, MAX…); a
  formula passes when it gives the answer's value on the sheet and on a changed copy. No array maths, FILTER / SORT /
  UNIQUE, or Table[Column] references. CI evaluates every answer.
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
- Roadmap steps point to our own courses first: training_steps.course_id (migration 20261109000600), set in the seed block
  "HelloKhedma courses on the roadmaps" (matched on track id + English step title). The step opens #/course/<id> with its
  progress, the outside resource becomes "also: …", a finished course ticks the step (training.js stepDone), and the study
  plan lists each course once. A new course that covers a step: add its row there.
- Portfolio projects are static JSON in content/projects/<path id>.json (+ fr/): 3 per path, real URLs checked with curl.
- AI engineer track (first "Tunisian AI Teacher", js/aitrack.js), also the courses of the AI Engineer path (id "ai"):
  content/ai/index.json (name and summary in en, fr, ar, lat) + content/ai/en/, content/ai/fr/, content/ai/ar/ (Derja in
  Arabic letters, shown right to left) and content/ai/lat/ (Derja in 3arbizi), same course format, same structure and
  identical code in all four (check-content + smoke test). English or French follow the interface language; "hk.aiScript"
  ("ar" | "lat") switches to Derja. The Arabic-letter file is the reference (times, structure): a change goes into all
  four languages. Derja writer guide: Derja as a Tunisian trainer speaks, technical terms in English/French,
  3arbizi 3=ع 7=ح 9=ق 5=خ 8=غ ch=ش; Claude API facts only from the official reference. Times: course-times.ps1 -Catalog ai.
  Its portfolio projects: content/ai/<en|fr|ar|lat>/projects.json (project format, ids "ai-…", same structure and links
  in every language, CV line in English, French in fr/), listed on #/ai and on Training for the ai path, opened in
  #/project/<id> (smoke test). The ai path has no content/projects/ai.json and no course in content/courses/ of its own.
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
- Admin statistics (js/admin.js): totals only, through security-definer functions that check the admins table; never
  list e-mails, names or CV text there. usage_daily holds day + kind + count only (bumped by job-search, cv-tailor and
  explain-mistake); ai_usage_daily holds day + model + token counts (cv-tailor, explain-mistake, migration 20261106000300), priced in js/admin.js PRICES
  (update it when Anthropic's prices change). Anthropic has no API for the credit balance: the owner enters the top-up.
  Visitor counts: Cloudflare Web Analytics (cookie-free beacon, CF_ANALYTICS_TOKEN, never on preview builds).
- Anonymous statistics (js/insights.js → log_insight()) only after the user said yes ("hk.insights"): skill names,
  course ids and the path id, never CV or offer text, account ids or IPs. Do not add identifiers or free text to them.
- Keep the privacy policy (index.html, #/privacy) in sync when adding a provider or any new personal data.
- Every user-facing text is written in English and goes through t() / tn() (js/i18n.js); add its French to
  js/fr/<area>.js (merged by js/i18n-fr.js). Static text in index.html is translated automatically if its English is a key there. The legal notice
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
- New texts translated in js/fr/<area>.js and checked in French (FR/EN button).
- Privacy policy updated if a provider or personal data was added.
- Seed / content JSON / migrations updated instead of hardcoded data.
- CHECKLIST.md updated with any new owner task (migration to run, function to deploy, secret to set).

## Routes (`#/<route>[/<param>]`, router in js/router.js)
- `#/` → home → home.js (path cards: app.js; first-visit guide: guide.js)
- `#/offers` → offers → offers.js + jobs.js, companies.js, remote.js (three tabs)
- `#/training` → training → training.js (My learning, roadmap of tracks, study plan) + courses.js (course list)
- `#/course/<id>` → course → courses.js
- `#/project/<id>` → project → projects.js
- `#/review[/<course id>]` → review → review.js (flashcards due today, spaced repetition, srs.js)
- `#/skillcheck` → skillcheck → skillcheck.js (placement test for the path; passed courses are skipped)
- `#/ai` → ai → aitrack.js (AI engineer track in English, French or Derja; its courses open in `#/course/ai-…`)
- `#/cv` → cv → cvpage.js + cvs.js, ats.js, atsscore.js, offerpick.js (tab CV check & ATS score); `#/cv/maker` → CV maker tab (cvmaker.js)
- `#/interview` → interview → interview.js
- `#/applications` → applications → applications.js + tracker.js, store.js
- `#/account` → account → account.js
- `#/admin` → admin → admin.js (site statistics; admins only: admins table + admin_stats(), migration 20261106000200)
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
- js/guide.js — guided first visit for a newcomer (nothing saved yet; "hk.guide" on | done | skip): 3 steps on Home (role,
  CV, first search) that tick themselves off, a reminder line on #/cv and #/offers (#guideBar), skipped by existing users
- js/i18n.js — interface language (t, tn, FR/EN switch, static page translation); js/i18n-fr.js — merges the French texts of js/fr/*.js (one file per area)
- js/supabase.js — Supabase client and runtime CONFIG
- js/config.example.js — template for js/config.js (generated in production, gitignored)
- js/auth.js — sign-in dialog, "Forgot password?" (reset e-mail) and the new-password dialog (reset link or Account →
  Change password); the reset e-mail text is supabase/templates/reset-password.html (pasted in Supabase by the owner)
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
- js/admin.js — admin page: admin_stats() totals (accounts, usage counters, applications, anonymous statistics, open
  reports with Done / Ignore), link to Cloudflare Web Analytics for visitors; Admin link on the Account page via is_admin()
- js/report.js — "⚑ Report a problem" on course and project pages (report_content(), e-mail fallback)
- scripts/check-content.mjs — content checks run by CI (structure, French copies, identical code, skills, AI track,
  every runnable SQL answer executed on its dataset and accepted by the grader, every auto-graded exercise checked)
- js/drills.js — auto-graded exercise formats in the Practice tab (predict the output, fill in, order, match, groups,
  spot the bug, scenarios, log analysis, regex, cron, jq); js/drillcheck.js — their checks, shared with CI (no DOM);
  js/regexrun.js + js/regexworker.js — the learner's regex runs in a Web Worker with a 2 s limit; drill(e, onSolved,
  onWrong) reports a wrong check (attempt + verdict) for "Explain my mistake"
- js/explain.js — "🤖 Explain my mistake" under a course exercise after a wrong answer (runnable SQL, auto-graded formats,
  written answers after Reveal): explain-mistake function → Claude Sonnet 5.5, signed-in users, notice before the first
  send, answer in the course's language (AI track: its own language, Derja included); the function stores nothing linked
  to a learner. Saved answers: on the device ("hk.explainSaved", newest 150) and, for fixed-choice formats only (choice,
  order, match, groups, bug), shared in explain_cache (SHA-256 of the full request, no account id, 180 days unused; never
  free-text answers; usage kind "explain_saved", not counted in the daily limit)
- js/asklesson.js — "💬 Ask about this lesson" under each lesson: explain-mistake function, mode "ask" (lesson text +
  question → Claude Sonnet 5.5, ASK_DAILY_LIMIT default 20, usage kind "ask_lesson"), signed-in users, notice before the first
  question ("hk.askOk"), answer in the course's language; answers kept on the device only ("hk.askSaved", newest 100)
- content/logs/, content/data/ — fictional log and JSON files for the log analysis and jq exercises
- js/filecheck.js — "fix this file" checks (Kubernetes manifests, GitHub Actions workflows, Dockerfiles), shared with CI;
  YAML read by js/vendor/js-yaml.esm.min.js (self-hosted, loaded on demand)
- js/excelcheck.js — Excel formula exercises: parser + missing functions + grader, shared with CI (no DOM)
- js/pyrun.js + js/pyworker.js — runnable Python exercises (Pyodide from js/vendor/pyodide/, 5 s limit per run, hidden
  tests), pyRunner in js/practice.js
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
- js/pulse.js — path market pulse on Home, from the offers seen on the Offers page (local only, "hk.pulse.<path>"), and
  Adzuna's statistics for the path's main title (advertised salaries; who's hiring: top companies, regions, offers of the
  last 7 days; job-search kind "salary", cached 24 h); marketSkills() also feeds "The market" on #/cv
- js/places.js — location suggestions on the Offers search (<datalist>): main cities per country of the Offers menu (local
  spelling, cities only: the Geo API knows towns, not regions) + places searched before in that country ("hk.places");
  built in, nothing sent while typing
- js/offerpick.js — "Choose an offer" on #/cv (match without pasting): offers seen on the Offers page ("hk.recentOffers.<path>",
  newest 60, 30 days) and the text of tracked offers ("hk.trackedOffers"), this browser only
- js/tailor.js — "Tailor my CV" dialog: honest gap analysis, prompt to copy for the user's own AI, "Correct, tailor and
  create my CV" (one AI call: corrected + tailored CV opens in the CV maker with the changes and gaps) and "Rewrite
  only" (text) (cv-tailor function, signed-in users, after a notice)
- js/offercoach.js — offer coach: offered salary vs the path's market (pulse.js marketPay), verdict, tips, prompt
- js/reminders.js — "E-mail reminders" switch on the Account page (profiles.email_reminders) and the test e-mail; the account's
  offer alerts and "Send me today's offers now"
- js/alerts.js — offer alerts: 🔔 on a saved search (Offers page), signed-in users, table search_alerts (migration
  20261109000500, 3 per account, RLS), notice once ("hk.alertsOk"); the search-alerts function e-mails the new offers each
  morning (reminders.yml, after follow-up-reminders), through job-search in alert mode (x-cron-secret: no rate limit, no
  JSearch / Jooble / Careerjet)
- js/letters.js — letters pack: cover letter prompt to copy (offers, CV match), thank-you / follow-up emails from a
  tracker card (templates EN + FR, copy or open in the email app; nothing is sent by HelloKhedma)
- js/courses.js — course list and course page (tabs: lessons, quiz, flashcards, practice, interview, cheat sheet). A lesson
  is read step by step (each paragraph, the example, the key points, a "⚡ Quick check"; "Show the whole lesson" =
  "hk.lessonView"), the lesson list is a path map, "✓ Complete lesson" shows a small celebration and what is next
- js/highlight.js — coloured code (lesson examples, code answers) and code words in lesson text, built from the course's
  own code; pure tokens() checked by CI (the pieces always give back the exact code). Colours: .tok-* in css/input.css
- js/practice.js — quiz (generated from the cheat sheet), flashcards, self-graded exercises, interview reveal, the lesson
  quick check (lessonChecks: cheat sheet items matched to each lesson's code and text; answers feed the reviews)
- js/srs.js — spaced-repetition schedule of flashcards ("hk.srs") and skill check results ("hk.placement"), no DOM;
  js/review.js — "Review today" page; js/skillcheck.js — placement test (passed courses leave the study plan and gaps)
- js/activity.js — XP, study streak, 7-day strip, last course for "Resume" (local only, "hk.activity")
- js/interview.js — interview prep page
- sw.js, manifest.json, icons/ — installable app and offline cache; logo: lowercase h + dot (owner's choice 2026-11-09).
  Every icon (favicon.svg / favicon-32, PWA any + maskable, Apple touch) comes from scripts/gen-icons.mjs (one definition,
  fixed charcoal / ivory / purple); the top bar draws the same mark inline with .logo-* (css/input.css: ink square like
  .btn, dot in the path colour). Change the mark in both places. The browser bar colour (theme-color) follows the theme
- fonts/ (Inter, Source Serif 4) and js/vendor/ (supabase-js, pdf-lib, sql.js, js-yaml): self-hosted, so a page load reaches no third party
  but Supabase; do not add CDN scripts, fonts or trackers without updating the privacy policy (both languages)
- js/coursetime.js — lesson and course durations computed from the content (reading + practice)
- js/projects.js — portfolio projects: Training panel, AI track projects (#/ai) and the project page (#/project/<id>)
- js/aitrack.js — AI engineer track: track page, language switch (interface language / عربي / 3arbizi), content and RTL for its courses
- content/courses/, content/interview/, content/projects/ — course, interview and project content (JSON)
- supabase/migrations/ — schema and RLS
- supabase/seed.sql — paths, tracks, steps, tools, tips, keywords (idempotent)
- supabase/functions/job-search/, delete-account/, cv-tailor/, explain-mistake/, follow-up-reminders/, search-alerts/ — Edge Functions
  (cv-tailor: AI CV rewrite with Claude; explain-mistake: why a course answer is wrong and "Ask about this lesson" (mode "ask"), Claude Sonnet 5.5; follow-up-reminders: the opt-in daily e-mail, called by .github/workflows/reminders.yml; search-alerts: the opt-in offer
  alerts e-mail, called by the same workflow until nothing remains)
- scripts/whats-new.sh — before a deploy: what main got since your branch started, shared files, other branches
- scripts/ — write-config.mjs (build config), copy-pyodide.mjs (build: Python engine into js/vendor/pyodide/), check-links.mjs (link checker), preview-cdn.sh + serve.ps1 (preview without Node),
  gen-practice-2e.mjs (rebuilds the dwh / payments datasets and the payments log, fixed seed)
- .github/workflows/deploy.yml — build, smoke tests, publish to GitHub Pages (main only)
- .github/workflows/deploy-functions.yml — deploy one Edge Function on demand (Run workflow)
- .github/workflows/reminders.yml — every morning, calls follow-up-reminders then search-alerts (needs REMINDERS_CRON_SECRET)
- tests/smoke.spec.mjs, playwright.config.mjs — smoke tests (guest flows; no sign-in, no job search)
- CHECKLIST.md — next-session note, owner tasks, done log; ROADMAP.md — roadmap + decisions log; README.md, GO-LIVE.md — setup guides

## Owner checklist
CHECKLIST.md tracks what is done and what the owner still has to do outside the code (Supabase, GitHub, providers).
At the start of a session and when finishing a feature, remind the owner briefly of the open items, add any new
owner task you create (e.g. a migration or function to deploy), and move items to "Done" when the owner confirms.
