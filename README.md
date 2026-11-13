# HelloKhedma

**A job hunting companion for tech careers.** Pick a career path and the whole app adapts to it: live job
offers, learning tracks and courses, CV tools with an ATS score, interview prep and a Kanban application tracker.

Live: **https://hellokhedma.io** · English and French · installable on phone and desktop (PWA)

Career paths: **Data Engineer · Business Analyst · Application Support · Data Analyst · DevOps Engineer · AI Engineer ·
Digital Marketing**.
The AI Engineer courses form the **AI engineer track**, in English, French or Tunisian Derja (Arabic letters or 3arbizi).

## What it does

| Page | Features |
|---|---|
| **Home** | Path cards, a guided first visit, "Your market" pulse (typical salary, % remote, top skills with your CV gaps, levels; Adzuna's advertised salaries and "Who's hiring": top companies, regions, offers this week), study streak and "Resume" |
| **Offers** | Live search (Adzuna, JSearch, Jooble, Himalayas, Arbeitnow, La bonne alternance for work-study in France, Careerjet; France Travail when keys exist) with city suggestions, "Companies I follow" (Greenhouse, Lever, Ashby, Workable, SmartRecruiters, Recruitee, Personio career pages) and "Remote jobs" (Jobicy, Remotive, Remote OK). CV fit score and skill highlights, salary chip / filter / sort, posted date and "New" badge, level (Junior…Lead), "⚠ Check this offer" scam and stale warnings, saved searches with **e-mail offer alerts**, offer coach (salary vs the market), cover letter prompt, one-click add to the tracker |
| **Training** | Roadmap of tracks per path (steps open our own courses first), weekly study plan, **33 courses** (7-10 lessons each) read **step by step** with coloured code, a quick check per lesson and a small celebration; quiz, flashcards, practice (auto-graded formats, **runnable SQL, Python / pandas and Excel formulas** in the browser, log / regex / cron / jq / "fix this file" drills), interview questions and cheat sheet; "Review today" (spaced repetition), skill check (placement test), "Explain my mistake" and "Ask about this lesson" (AI, signed-in users), 18 portfolio projects, XP and streak |
| **AI track** (`#/ai`) | 9 courses and 3 portfolio projects on building with LLMs and the Claude API (the AI Engineer path's courses), in English or French with the interface, or in Derja: right to left in Arabic letters or in 3arbizi |
| **CV** | Several CV versions (one per path), CV keyword check against an offer (or one seen on the Offers page), **ATS score /100** with the fixes to make, **CV maker** (ATS-friendly one-column CV in EN or FR, real PDF download), "Tailor my CV" (honest gap analysis, a prompt for your own AI, or for signed-in users "Correct, tailor and create my CV": one AI call corrects the CV, tailors it to the offer and opens it in the CV maker with the list of changes; or "Rewrite only"), "Close the gaps" (courses and projects for missing skills) |
| **Interview** | Questions and model answers per path and per course, STAR stories, checklist |
| **Applications** | Kanban tracker with details, notes, follow-up dates, contacts, salary, "CV sent", stats, CSV export, calendar files, thank-you / follow-up email templates |
| **Account** | Sign in (password, magic link, "Forgot password?"), opt-in e-mail reminders and offer alerts, opt-in "Save my CVs to my account", export or delete all data, legal notice and privacy policy; **Admin** statistics page for the owner (totals only) |

### Privacy by design

- **Guests** need no account: everything is saved in the browser (localStorage).
- **Signed-in users** are saved in Supabase, with Row Level Security on every table; guest data is imported on first sign-in.
- **CV texts stay in the browser by default.** They leave it only in two opt-in cases: "Save my CVs to my account"
  (off by default) and the AI rewrite (signed-in only, after a notice shown before every send; the function stores
  and logs nothing). "Explain my mistake" and "Ask about this lesson" send only the exercise or lesson and the
  learner's answer or question, after a notice.
- **Statistics are numbers only:** anonymous daily counters (day + feature + count, no account, no IP), anonymous
  skill / course statistics only for visitors who said yes, and cookie-free Cloudflare Web Analytics.
- **API keys stay server-side** in Supabase Edge Functions; the frontend only holds the public anon key.

## Tech stack

- **Frontend:** HTML, Tailwind CSS 3, vanilla JavaScript ES modules (no framework, no bundler), PWA with offline cache.
- **Backend:** Supabase (PostgreSQL, Auth, RLS) and six Edge Functions: `job-search` (job APIs, per-source cache, rate
  limit, one retry on server errors), `delete-account`, `cv-tailor` and `explain-mistake` (Claude API),
  `follow-up-reminders` and `search-alerts` (e-mails through Resend, called each morning by `.github/workflows/reminders.yml`).
- **In-browser engines (self-hosted, loaded on demand):** SQLite (sql.js), Python (Pyodide + pandas), an Excel formula
  parser, a YAML parser and pdf-lib; no CDN script, so a page load reaches no third party but Supabase.
- **Content:** path content (tracks, steps, tools, tips, ATS keywords) in the database (`supabase/seed.sql`, with French
  columns); courses, interview questions and projects as static JSON in `content/` (English + `fr/`).
- **CI/CD:** GitHub Actions builds, runs the Playwright smoke tests and publishes to GitHub Pages; a failing test stops the deploy.

## Run it locally

Needs Node 18+.

```bash
cp js/config.example.js js/config.js     # fill in SUPABASE_URL and SUPABASE_ANON_KEY
npm install
npm run build                            # writes js/config.js from env vars (if set) and css/app.css
npx serve -l 5173 .                      # ES modules need http, not file://
```

While editing classes, run `npm run watch:css` in a second terminal. Without Node: `sh scripts/preview-cdn.sh`,
then `scripts/serve.ps1`, and open `/preview-test.html` (never commit that file).

Useful checks:

```bash
npm test                                        # Playwright smoke tests (guest flows)
npm run check-content                           # every course / exercise / project JSON; runs every SQL, Python and Excel answer
npm run check-links                             # every URL in supabase/seed.sql
perl scripts/check-i18n.pl js                   # every t() text has French, no key in two js/fr/ files
powershell -File scripts/check-fr-content.ps1 -Root .   # French content matches the English structure
powershell -File scripts/course-times.ps1 -Root .       # recompute course minutes / lesson counts
```

## Set up your own instance

### 1. Supabase

```bash
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push                     # tables + RLS (supabase/migrations)
```

Then run `supabase/seed.sql` in the SQL editor (idempotent: re-run it after editing path content).
In Authentication → URL Configuration, add your local and deployed URLs to **Redirect URLs**.
Real users need custom SMTP for confirmation emails (see GO-LIVE.md).

### 2. Job APIs and AI (Edge Functions)

Only providers whose secrets are set are used; Himalayas and Arbeitnow need no key.

- **Adzuna**: developer.adzuna.com → `ADZUNA_APP_ID`, `ADZUNA_APP_KEY` (250 calls a day free).
- **JSearch** (RapidAPI) → `RAPIDAPI_KEY` (200 a month free).
- **Jooble** → `JOOBLE_API_KEY` (optional `JOOBLE_HOST`), used as a backup when the others find few offers.
- **La bonne alternance** (work-study, France) → `LBA_API_TOKEN`.
- **Careerjet** (publisher API key, not the affiliate ID) → `CAREERJET_API_KEY`.
- **France Travail** (closed to new users in 2026) → `FRANCE_TRAVAIL_CLIENT_ID`, `FRANCE_TRAVAIL_CLIENT_SECRET`.
- **Claude** for the AI features: `ANTHROPIC_API_KEY`; optional `CV_TAILOR_DAILY_LIMIT` (default 5), `CV_TAILOR_MODEL`,
  `EXPLAIN_DAILY_LIMIT` (30), `ASK_DAILY_LIMIT` (20), `EXPLAIN_MODEL`.
- **E-mails** (reminders, offer alerts): `RESEND_API_KEY`, `CRON_SECRET` (optional `REMINDERS_FROM`, `SITE_URL`,
  `ALERTS_DAILY_MAX`), and the same value as `REMINDERS_CRON_SECRET` in GitHub Actions secrets.

```bash
npx supabase secrets set ADZUNA_APP_ID=xxx ADZUNA_APP_KEY=xxx RAPIDAPI_KEY=xxx
npx supabase functions deploy job-search --use-api
npx supabase functions deploy delete-account --use-api
npx supabase functions deploy cv-tailor --use-api
npx supabase functions deploy explain-mistake --use-api
npx supabase functions deploy follow-up-reminders --use-api
npx supabase functions deploy search-alerts --use-api
```

Or without a terminal: add a `SUPABASE_ACCESS_TOKEN` secret (supabase.com → Account → Access Tokens) in GitHub, then
**Actions → Deploy Supabase function → Run workflow** and pick the function.

`job-search` keeps each source's answer for a few hours (6 by default, 24 for the small quotas) and rate-limits callers (20/hour per IP for guests, 60/hour per
user); tune with `CACHE_TTL_HOURS`, `RATE_LIMIT_GUEST`, `RATE_LIMIT_USER`. Without it, the app still shows direct
search links to LinkedIn, Indeed, Welcome to the Jungle, France Travail and Google Jobs. Company career pages and
remote boards are called from the browser and need no setup.

### 3. Deploy on GitHub Pages

`.github/workflows/deploy.yml` builds, tests and publishes on every push to `main` (other branches: build + tests only).

1. **Settings → Pages → Source: GitHub Actions.**
2. **Settings → Secrets and variables → Actions → Variables:** `SUPABASE_URL`, `SUPABASE_ANON_KEY`; optional
   `DEFAULT_COUNTRY`, `CONTACT_EMAIL`, `SENTRY_DSN`, `CF_ANALYTICS_TOKEN` (Cloudflare Web Analytics site token).
3. Push to `main`, then add the site URL to Supabase **Auth → Redirect URLs**.

The live site uses a custom domain: DNS at Cloudflare (4 `A` records to GitHub Pages, `www` CNAME to
`<user>.github.io`, all "DNS only"), then **Settings → Pages → Custom domain** + **Enforce HTTPS**.

Branches listed in `PREVIEW_BRANCHES` (deploy.yml) are also published under `preview/<branch>/`.
Other static hosts work too: build command `npm run build`, output directory `/`, same environment variables.

## Customising

- **Paths, tracks, steps, tools, tips, keywords:** edit `supabase/seed.sql` (and its French block at the end), re-run it.
- **Courses:** `content/courses/` (`index.json` + one file per course, French copy in `fr/`); append lessons and
  exercises to extend a course (progress is stored by position) and recompute times with `scripts/course-times.ps1`.
  Exercise formats (auto-graded, runnable SQL / Python / Excel) are described in CLAUDE.md; CI checks every answer.
- **Interview questions and portfolio projects:** `content/interview/`, `content/projects/`.
- **Interface texts:** written in English through `t()`, French in `js/fr/<area>.js` (merged by `js/i18n-fr.js`).
- **Styles:** theme tokens and components (`panel`, `btn`, `chip`…) in `css/input.css`.

## Project docs

- [CLAUDE.md](CLAUDE.md): project rules and file map (read automatically by Claude Code).
- [ROADMAP.md](ROADMAP.md): roadmap and decisions log.
- [CHECKLIST.md](CHECKLIST.md): owner tasks (Supabase, GitHub, providers) and what is done.
- [GO-LIVE.md](GO-LIVE.md): architecture review and go-live plan.

## Security

- Row Level Security on every table: users only read and write their own rows; career content is read-only.
- Cache, rate-limit and counter tables have RLS on and no policies: only the functions (service role) or
  security-definer functions use them; the admin statistics check an `admins` table and return totals only.
- All remote text is rendered with `textContent`; offer links are limited to http(s); job sources' error details stay
  in the console and the function logs.
- Course, interview and AI-track content was written with AI help and is pending expert review.
