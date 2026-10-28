# HelloKhedma: architecture review and go-live plan

## 1. How the app works today

```
Browser (static HTML + vanilla JS)
  ├─ reads public content ──────────► Supabase Postgres (career_paths, path_resources,
  │                                    training_tracks, training_steps)  [RLS: read-only]
  ├─ reads/writes own data ─────────► applications, profiles, step_progress  [RLS: own rows]
  ├─ sign in / sign up / magic link ► Supabase Auth (sends emails)
  └─ job search ────────────────────► Edge Function "job-search" ──► Adzuna / JSearch
                                        (API keys stay server-side)
Guests: tracker + progress in localStorage, imported into the account on first sign-in.
```

**Verdict: this is the right shape for a first launch.** It needs no server of your own and runs on free tiers. Path content can be edited in SQL without changing code, and the security model (RLS plus keys kept in the Edge Function) is sound. I would not migrate to React or another framework before launch. Do that once the UI outgrows a single page.

## 2. What to fix or decide before going public

| # | Topic | Why it matters | Recommendation |
|---|---|---|---|
| 1 | **Auth emails** | By default, Supabase's built-in email service only delivers to your project's team members and is heavily rate-limited, so real users won't get confirmation or magic-link emails. | Set up custom SMTP (Resend or Brevo both have free tiers) under Auth → SMTP Settings, using your own domain. |
| 2 | **Job API quota** | Anyone with the URL can call `job-search`. Free API tiers are small (JSearch's especially). | ✅ Done: 6 h result cache + 20/h per IP (guests), 60/h per user. Tune with the `CACHE_TTL_HOURS`, `RATE_LIMIT_GUEST` and `RATE_LIMIT_USER` secrets. |
| 3 | **Job source for your market** | Adzuna covers FR but not Tunisia/Maghreb. JSearch is broad but expensive at scale. | For France, add the official **France Travail "Offres d'emploi" API** (free, francetravail.io). If you're targeting Tunisia, Adzuna/JSearch won't cover it well, so keep deep links (Tanitjobs, Keejob, LinkedIn) for that country. |
| 4 | **Attribution / terms** | Adzuna's terms require visible attribution, and every API has usage rules. | Show "Jobs by Adzuna" (or the relevant source) under results. Read each provider's terms before launching. |
| 5 | **Tailwind play CDN** | Not meant for production: slower and prints a console warning. | ✅ Done: `npm run build` compiles `css/input.css` to `css/app.css`. |
| 6 | **`js/config.js` is gitignored** | Static hosts build from Git, so the deployed site would show "Supabase isn't configured". | ✅ Done: the build writes `js/config.js` from the host's `SUPABASE_URL` / `SUPABASE_ANON_KEY` env vars. |
| 7 | **Legal (EU/France)** | You store emails and job applications, so GDPR applies. | Add a privacy policy page, *mentions légales*, and a "delete my account" option. Note that CV text never leaves the browser, which is a selling point. |
| 8 | **Free-plan pausing** | Supabase pauses free projects after about a week with no activity. | Fine for a beta. Move to Pro (~$25/month) once you have real users. |
| 9 | **Language** | The UI is in English. The name and audience suggest French/Tunisian users. | Decide the launch language. A FR/EN toggle is a moderate change. |

## 3. Step-by-step: get HelloKhedma online

### A. Accounts (one time, ~30 min)
1. **GitHub**: create a repo `hellokhedma` and push this folder.
2. **Supabase**: create a project (region: EU, e.g. Frankfurt/Paris). Note the Project URL and anon (publishable) key from Settings → API.
3. **Job APIs**: register at developer.adzuna.com (app id + key). Optional: RapidAPI JSearch, and francetravail.io if you add it.
4. **Domain**: buy `hellokhedma.com` (or similar) at Cloudflare, OVH or Namecheap.
5. **Email**: create a Resend or Brevo account and verify your domain (DNS records).

### B. Backend (Supabase CLI)
The Supabase CLI can't be installed with `npm install -g`. Run it through `npx`, as below (or install it with Scoop on Windows, Homebrew on macOS).
```bash
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push
```
Then open the SQL editor in the dashboard, paste `supabase/seed.sql` and run it.
```bash
npx supabase secrets set ADZUNA_APP_ID=xxx ADZUNA_APP_KEY=xxx
npx supabase secrets set DEFAULT_PROVIDER=adzuna
npx supabase functions deploy job-search --use-api
```
In the dashboard:
- **Auth → URL Configuration**: Site URL = `https://hellokhedma.com`. Redirect URLs = `https://hellokhedma.com`, `http://localhost:5173`.
- **Auth → SMTP Settings**: enter your Resend/Brevo SMTP credentials and set the sender to `no-reply@hellokhedma.com`.
- **Auth → Email Templates**: brand the confirmation and magic-link emails as HelloKhedma.

### C. Test locally
Install Node.js 18+ (nodejs.org) first.
```bash
cp js/config.example.js js/config.js   # fill in URL + anon key
npm install
npm run build
python -m http.server 5173
```
Check each of these: pick each path, run a live search, track a job, tick training steps, sign up, confirm the email, and check that the guest cards were imported. Run `node scripts/check-links.mjs` to find dead training links.

### D. Frontend hosting

**Option 1: GitHub Pages (free; repo must be public on a free account).** The workflow `.github/workflows/deploy.yml` is included.
1. Push the project to a GitHub repo on the `main` branch.
2. Settings → Pages → Source: **GitHub Actions**.
3. Settings → Secrets and variables → Actions → **Variables**: add `SUPABASE_URL` and `SUPABASE_ANON_KEY`.
4. Actions tab → "Deploy to GitHub Pages" → Run workflow (or just push). The site goes live at `https://<your-user>.github.io/hellokhedma/`.
5. Add that URL to Supabase Auth → Redirect URLs (and as Site URL until you have a domain).
6. Custom domain later: Settings → Pages → Custom domain, plus a CNAME record at your registrar.

**Option 2: Cloudflare Pages or Netlify (free, private repo OK).**
1. Connect the GitHub repo. Build command: `npm run build`. Output directory: `/`.
2. Add the environment variables `SUPABASE_URL` and `SUPABASE_ANON_KEY` (and optionally `DEFAULT_COUNTRY`).
3. Add the custom domain `hellokhedma.com`. HTTPS is automatic.
4. Every `git push` redeploys.

### E. Launch checklist
- [ ] Custom SMTP works (sign up with a non-team email)
- [ ] Search cache and rate limit work (repeat a search: the response has `cached: true`), and the attribution is visible
- [ ] Deployed site loads `css/app.css`, no console errors
- [ ] Privacy policy + mentions légales + account deletion
- [ ] Supabase Auth: "Confirm email" ON. Leaked password protection ON if your plan has it
- [ ] Database backups understood (daily backups on Pro)
- [ ] Simple analytics (Plausible, Umami or Cloudflare Web Analytics, which need no cookie banner)

## 4. Suggested roadmap after launch
1. Search cache + rate limit + France Travail source (protects cost, improves FR results)
2. FR/EN interface
3. Follow-up dates and notes on applications, plus email reminders (Supabase cron + Edge Function)
4. Saved CV per path for the keyword check
5. Stats dashboard (applications → interviews → offers)
