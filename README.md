# HelloKhedma

Pick a career path (Data Engineer, Business Analyst, Application Support, Data Analyst, DevOps Engineer) and the app adapts:
live job offers, learning tracks with progress and a time estimate, tools, tips, a CV keyword check, and a Kanban application tracker.

- **Guests** are saved in the browser (localStorage).
- **Signed-in users** are saved in Supabase, and guest data is imported on first sign-in.
- **Path content** (trainings, tools, tips, keywords) lives in the database, not in the JS.
- **Job APIs** (Adzuna, JSearch) are called from a Supabase Edge Function, so keys never reach the browser.

## 1. Supabase project

Install the [Supabase CLI](https://supabase.com/docs/guides/cli), then from this folder:

```bash
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase db push                      # creates tables + RLS (supabase/migrations)
```

Load the seed content: open the SQL editor in the Supabase dashboard, paste `supabase/seed.sql`, run it.
(It is idempotent; re-run it whenever you edit paths, trainings, tools, tips or keywords.)

Auth settings (Dashboard → Authentication → URL Configuration): add your local and deployed URLs
(for example `http://localhost:5173`) to **Redirect URLs**. For quick testing you can turn off
"Confirm email" under Providers → Email.

## 2. Job APIs

- France Travail (recommended for France: free, full descriptions + structured skills, which makes the
  CV fit score much more accurate): on https://francetravail.io create an account and an application,
  subscribe it to the API "Offres d'emploi v2", then set `FRANCE_TRAVAIL_CLIENT_ID` and
  `FRANCE_TRAVAIL_CLIENT_SECRET` as secrets. It only covers France.
- Adzuna: create an app at https://developer.adzuna.com to get an app id and key.
- JSearch: subscribe to the JSearch API on RapidAPI to get a key.
  You only need one of the two; the free tiers have quotas, so check each provider's current limits.

```bash
supabase secrets set ADZUNA_APP_ID=xxx ADZUNA_APP_KEY=xxx RAPIDAPI_KEY=xxx
supabase secrets set DEFAULT_PROVIDER=adzuna      # optional: adzuna | jsearch | both
supabase functions deploy job-search
```

The function caches identical searches for 6 hours and rate-limits callers (20 searches/hour per IP
for guests, 60/hour per signed-in user). Tune with `CACHE_TTL_HOURS`, `RATE_LIMIT_GUEST` and
`RATE_LIMIT_USER` secrets. Both rely on the `20261028000200_job_search_guard.sql` migration.

If the function is not deployed, the app still shows direct search links to LinkedIn, Indeed,
Welcome to the Jungle, France Travail and Google Jobs.

## 3. Run the frontend

Needs Node 18+.

```bash
cp js/config.example.js js/config.js     # fill in SUPABASE_URL and SUPABASE_ANON_KEY
npm install
npm run build                            # writes css/app.css (Tailwind, minified)
python3 -m http.server 5173              # or: npx serve -l 5173 .
```

Open http://localhost:5173. ES modules need http, so don't open index.html as a file.
While editing classes, run `npm run watch:css` in a second terminal.

### Deploy on GitHub Pages

`.github/workflows/deploy.yml` builds and publishes the site on every push to `main`. One-time setup:

1. Repo **Settings → Pages → Source: GitHub Actions**.
2. Repo **Settings → Secrets and variables → Actions → Variables**: add `SUPABASE_URL` and
   `SUPABASE_ANON_KEY` (optional `DEFAULT_COUNTRY`).
3. Push to `main` (or run the workflow from the Actions tab). The site is at
   `https://<your-user>.github.io/<repo>/`; add that URL to Supabase **Auth → Redirect URLs**.

On a free GitHub account, Pages needs a public repo. No secrets are in the code, so that is fine.

### Deploy (Cloudflare Pages, Netlify or Vercel)

- Build command: `npm run build`. Output directory: `/` (the repo root).
- Environment variables: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, optional `DEFAULT_COUNTRY`.
  The build writes `js/config.js` from them (`scripts/write-config.mjs`), so neither `js/config.js`
  nor `css/app.css` is committed. The anon key is public by design; never use the service_role key here.

## Security notes

- Row Level Security is on for every table. Users can only read and write their own applications,
  progress and profile. Career content is read-only for everyone.
- The `job-search` function requires a valid Supabase JWT (the anon key counts), so guests can call it.
  Results are cached and calls are rate-limited per IP / per user to protect your API quotas.
  The cache and rate-limit tables have RLS on and no policies: only the function (service role) uses them.
- All remote text is rendered with `textContent`, and offer links are limited to http(s).

## Customising

- Add or edit a path, track or step: change `supabase/seed.sql` and re-run it. No code changes needed.
  A track has a level (beginner, intermediate, advanced), a summary and an outcome. A step has a kind
  (learn, practice, project, certification), a provider, a link, estimated hours and a free/paid flag.
  Step ids come from the track id plus the step title, so renaming a step resets its progress.
- Check the training links: `node scripts/check-links.mjs` (some sites block scripts; open those by hand).
- Add a column to the tracker (notes, salary, contact): new migration file, then extend `FIELDS` in `js/store.js`.
- Styles: component classes (`panel`, `btn`, `chip`…) live in `css/input.css`; rebuild with `npm run build:css`.

## Ideas for next steps

Notes and reminders per application, follow-up dates, CSV export, a weekly study plan built from the
training list, saving CV text per path for the keyword check, and a dashboard of stage conversion.

## Working with Claude Code

`CLAUDE.md` contains the project rules and file map, so Claude Code follows them automatically.
