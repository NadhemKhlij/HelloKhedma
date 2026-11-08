# HelloKhedma

**A job hunting companion for tech careers.** Pick a career path and the whole app adapts to it: live job
offers, learning tracks and courses, CV tools with an ATS score, interview prep and a Kanban application tracker.

Live: **https://hellokhedma.io** · English and French · installable on phone and desktop (PWA)

Career paths: **Data Engineer · Business Analyst · Application Support · Data Analyst · DevOps Engineer · AI Engineer**.
The AI Engineer courses form the **AI engineer track**, in English, French or Tunisian Derja (Arabic letters or 3arbizi).

## What it does

| Page | Features |
|---|---|
| **Home** | Path cards, greeting and summary, "Your market" pulse (typical salary, % remote, top skills with your CV gaps, levels), study streak and "Resume" |
| **Offers** | Live search (France Travail, Adzuna, JSearch), "Companies I follow" (Greenhouse, Lever, Ashby, Workable, SmartRecruiters career pages) and "Remote jobs" (Jobicy, Remotive). CV fit score and skill highlights, salary chip / filter / sort, posted date, level (Junior…Lead), "⚠ Check this offer" scam and stale warnings, cover letter prompt, one-click add to the tracker |
| **Training** | Roadmap of tracks per path with progress, weekly study plan, 25 courses (7-10 lessons each) with quiz, flashcards, exercises, interview questions and cheat sheet, honest time estimates, 15 portfolio projects, XP and streak |
| **AI track** (`#/ai`) | 9 courses and 3 portfolio projects on building with LLMs and the Claude API (the AI Engineer path's courses), in English or French with the interface, or in Derja: right to left in Arabic letters or in 3arbizi |
| **CV** | Several CV versions (one per path), CV keyword check against an offer, **ATS score /100** with the fixes to make, **CV maker** (ATS-friendly one-column CV in EN or FR, print to PDF), "Tailor my CV" (honest gap analysis, prompt for your own AI, or for signed-in users "Correct, tailor and create my CV": one click corrects the CV, tailors it to the offer and opens it in the CV maker with the list of changes; or "Rewrite only") |
| **Interview** | Questions and model answers per path, STAR stories, checklist |
| **Applications** | Kanban tracker with details, notes, follow-up dates, contacts, salary, "CV sent", stats, CSV export, calendar files, thank-you / follow-up email templates |
| **Account** | Sign in (email / magic link), export or delete all data, legal notice and privacy policy |

### Privacy by design

- **Guests** need no account: everything is saved in the browser (localStorage).
- **Signed-in users** are saved in Supabase, with Row Level Security on every table; guest data is imported on first sign-in.
- **CV texts never leave the browser.** The only exception is "Rewrite with AI", signed-in only, after a notice shown
  before every send; the function stores and logs nothing.
- **API keys stay server-side** in Supabase Edge Functions; the frontend only holds the public anon key.

## Tech stack

- **Frontend:** HTML, Tailwind CSS 3, vanilla JavaScript ES modules (no framework, no bundler), PWA with offline cache.
- **Backend:** Supabase (PostgreSQL, Auth, RLS) and three Edge Functions: `job-search` (job APIs, cache, rate limit),
  `delete-account`, `cv-tailor` (Claude API).
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

Only providers whose secrets are set are used; you need at least one.

- **France Travail** (France, free, full descriptions): app on francetravail.io subscribed to "Offres d'emploi v2" →
  `FRANCE_TRAVAIL_CLIENT_ID`, `FRANCE_TRAVAIL_CLIENT_SECRET`.
- **Adzuna**: developer.adzuna.com → `ADZUNA_APP_ID`, `ADZUNA_APP_KEY`.
- **JSearch** (RapidAPI) → `RAPIDAPI_KEY`.
- **Claude** for "Rewrite with AI": `ANTHROPIC_API_KEY` (optional `CV_TAILOR_DAILY_LIMIT`, `CV_TAILOR_MODEL`).

```bash
npx supabase secrets set ADZUNA_APP_ID=xxx ADZUNA_APP_KEY=xxx RAPIDAPI_KEY=xxx
npx supabase functions deploy job-search --use-api
npx supabase functions deploy delete-account --use-api
npx supabase functions deploy cv-tailor --use-api
```

Or without a terminal: add a `SUPABASE_ACCESS_TOKEN` secret (supabase.com → Account → Access Tokens) in GitHub, then
**Actions → Deploy Supabase function → Run workflow** and pick the function.

`job-search` caches identical searches for 6 hours and rate-limits callers (20/hour per IP for guests, 60/hour per
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
- **Courses:** `content/courses/` (`index.json` + one file per course, French copy in `fr/`); append lessons to extend
  a course and recompute times with `scripts/course-times.ps1`.
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
- Cache and rate-limit tables have RLS on and no policies: only the functions (service role) use them.
- All remote text is rendered with `textContent`; offer links are limited to http(s).
- Course, interview and AI-track content was written with AI help and is pending expert review.
