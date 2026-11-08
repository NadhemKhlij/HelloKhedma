# HelloKhedma: launch checklist

## 👉 Next session (written 2026-11-08)
- **Just finished (2026-11-08):** AI Engineer career path + the AI track in English and French (see Done), merged after
  Training step 3. O35 done (seed re-run). The owner also discussed adding more job APIs (ROADMAP Phase 3b, O32).
- **Parallel work (2026-11-08):** every session runs `sh scripts/whats-new.sh` at the start and before each merge into
  main (CLAUDE.md "Working in parallel").
- **Just finished (2026-11-08, later):** "Explain my mistake" (step 4). Owner: O36 (migration) and O37 (deploy the
  explain-mistake function from Actions), then try it signed in.
- **Just finished (2026-11-08, night):** ROADMAP 4b row "4c", saved "Explain my mistake" answers. Owner: O38.
- **Start here:** ROADMAP "Phase 4b: training plan". Steps 1 to 4 are done (see the Done log). Next: later in 4, "Ask about this lesson";
  5 (Python / Excel), 6 (project repos + public portfolio), 7 (content from data, expert review).
- **New exercise content is part of O11:** the 70 auto-graded exercises and the 28 step-2e exercises (EN + FR) were written by Claude; answers of the
  log / regex / cron / jq exercises are computed from the files and checked in CI, the "fix this file" answers pass
  their checks in CI; the wording and the rules (js/filecheck.js) are unreviewed.
- **Done on 2026-11-06 (all live on hellokhedma.io):** custom domain + Resend email sender + contact address; legal
  review (FR + EN, LCEN / GDPR) with fonts and supabase-js self-hosted, IPs hashed with HMAC; CV maker rebuilt
  (owner's layout, "Download PDF" built in the app with pdf-lib, 4 render rounds + independent review); PDF CV reading
  fixed; "Correct, tailor and create my CV" (one AI call, cv-tailor deployed via GitHub Actions); "Close the gaps"
  trainings under missing skills; opt-in "Save my CVs to my account" (cv_sync) and anonymous statistics (insights);
  learning progress synced (learning_sync) + "Report a problem" + content checks in CI; runnable SQL exercises.
- **How things are shipped now:** work on a branch, CI runs `node scripts/check-content.mjs` + smoke tests, then
  fast-forward main. Functions deploy from GitHub: Actions → "Deploy Supabase function" (or ask Claude to run it).
  Migrations: test on a local PostgreSQL 16 with anon/authenticated roles and a stub auth schema, then give the owner
  a commit-pinned raw link to run in the SQL editor.
- **Owner's data views (Supabase SQL editor):** `insights_skill_gaps`, `insights_offer_skills`, `insights_courses_done`
  (anonymous statistics), `content_reports_open` (problem reports).
- **Owner context:** personal project for now, wants to go pro (O21: company details, terms, DPA; ROADMAP 6.5 opt-in
  recruiter profile only then). Works from an iPhone (installed app) and Safari; no Node on the owner's machine.
- **Still open for the owner:** O12 (check the French), O18 (Tunisian AI track review), O11 (expert content review),
  O9 (double-check GitHub's phone number in the legal notice), O7 (Sentry, optional), delete merged test branches.
- **Just finished (2026-11-05, later):** CV maker and ATS score on the CV page (two tabs). CV maker (#/cv/maker,
  js/cvmaker.js): form → one-column ATS-friendly preview in EN or FR, print / save as PDF, download .txt, "Use as a CV
  version" (then it scores offers), live ATS score; draft kept in this browser ("hk.cvmaker"), privacy policy updated.
  ATS score (js/atsscore.js): /100 from skills and job title of the pasted offer (or path keywords), sections, contact,
  impact (numbers, action verbs), length and layout, with the fixes to make. New smoke test. Tested as a guest (EN/FR,
  light/dark, phone) in the local preview with sample data; not signed in (it uses local storage only, like CV versions).
- **Just finished (2026-11-05):** Tunisian AI track finished on main: 3 portfolio projects in Arabic letters and 3arbizi on
  #/ai (RAG documentation assistant, document-to-JSON extraction, support agent with tools in production), opened in the
  project page (right to left in Arabic letters, script switch, progress shared by both scripts), new smoke test.
  Preview branch `tunisian-ia-teacher` removed from PREVIEW_BRANCHES (the track is live on main). Project links checked:
  platform.claude.com docs, anthropic-sdk-python, claude-cookbooks, FastAPI docs. Derja written by Claude: part of O18.
- **Just finished (2026-10-30):** learning content (ROADMAP Phase 4): honest times computed from the content, 4 new
  courses (Spark, Kafka, cloud warehouses, Tableau/Looker + storytelling), SQL/Python/Power BI/Docker/Kubernetes/
  monitoring deepened, 15 portfolio projects (3 per path) on Training and #/project/<id>. Then the 15 other courses
  went from 4 to 8 lessons: all 25 courses have 7-10 lessons. EN + FR, French check clean, smoke tests passing.
  Written by Claude: part of O11 (expert review). Course times: scripts/course-times.ps1.
- **Before that:** path market pulse on Home (ROADMAP 3.9, js/pulse.js): typical salary, % remote,
  % with a salary, top skills with CV gaps, levels, from the offers seen for the path (this browser only). Tested in
  the preview (EN/FR, phone) and by a new smoke test (16 passing). Fills up as the owner runs searches.
- **Before that:** smoke tests in CI (tests/smoke.spec.mjs): every deploy now
  runs them first and stops if one fails. Push a non-main branch to test a change without publishing it.
- **Also 2026-10-30 (another session):** DevOps Engineer path (seed + interview questions) and fuller courses: 4 new DevOps
  courses (CI/CD, Kubernetes, Terraform, AWS) and one more lesson, exercise and interview question in each of the 17
  others, English and French. Seed and setup-all.sql tested on a local PostgreSQL 16 (run twice); app tested as a guest
  with sample data. **DevOps is live (O17 done and verified).** Earlier the same day: offer checks (ROADMAP 3.1 + 3.8, js/offercheck.js): "Posted N days ago" chip, date
  and level filters, "Most recent" sort by date, "⚠ Check this offer" warnings with reasons and a filter to hide them.
  Before that, the letters pack (5.1, js/letters.js). Both tested as a guest in the local preview with sample offers
  (not with live search results, not signed in). Roadmap gained items from a jobicy.com review.
- **Before that:** "Rewrite with AI" in Tailor my CV (ROADMAP 5.2): cv-tailor function (Claude Opus 5.5), signed-in
  only, 5 a day, notice before every send, privacy policy updated. It needs O16 (API key + deploy); the function code
  was not run by Claude (no Deno/key here), only the app side. Before that: "Tailor my CV" prompt, salary on offers,
  French content, app.js split, "CV sent", CV versions, FR/EN interface. O13–O15 done. Not tested signed in.
- **Owner, first:** O16 (Anthropic key + deploy cv-tailor), then test "Rewrite with AI" signed in (O12). "Confirm email" is ON
  again since 2026-11-06 (custom SMTP works).
- **Next in code (owner's choice):** accessibility pass (1.9),
  LinkedIn import (3.10), networking contacts, offer coach (2.8, can reuse the pulse salaries). 2026-10-30:
  ROADMAP gained items from a jobicy.com review (2.8, 3.8–3.10, 4.4b, 4.7, 5.5).
- **Source of truth:** github.com/NadhemKhlij/HelloKhedma (`main`). If the local folder is gone, clone it again;
  local preview without Node: scripts/preview-cdn.sh + scripts/serve.ps1.

What is done, and what still has to be done **by the owner** (outside the code: Supabase, GitHub, providers).
Update this file whenever an item changes. Last update: 2026-10-29.

## ⏳ Waiting for the owner

| # | Where | Task | Why it matters | Links / details |
|---|---|---|---|---|
| O38 | Supabase → SQL Editor, then GitHub → Actions | **1.** Run the migration `supabase/migrations/20261109000100_explain_cache.sql` (Claude gives a commit-pinned link); **2.** "Deploy Supabase function" → Run workflow → **explain-mistake** | Shared saved explanations for multiple-choice type exercises (no AI call, not counted in the limit). The device-saved answers already work without it | supabase/functions/explain-mistake |
| O34 | Resend, Supabase, GitHub | **1.** Resend → API Keys → create a key with "Sending access" for mail.hellokhedma.io; **2.** Supabase → Edge Functions → Secrets: `RESEND_API_KEY` = that key and `CRON_SECRET` = a long random text (e.g. 40 letters and digits); **3.** GitHub → Settings → Secrets → Actions: `REMINDERS_CRON_SECRET` = the same random text; **4.** Actions → "Deploy Supabase function" → follow-up-reminders (or ask Claude); **5.** sign in, Account → "E-mail me my follow-ups" → "Send me a test e-mail now" with a follow-up due today | Daily e-mail reminders (ROADMAP 2.2). Resend's free plan: 100 e-mails a day | .github/workflows/reminders.yml, supabase/functions/follow-up-reminders |
| O29 | Supabase → Authentication → URL Configuration, then the live site | Reset e-mail template pasted by the owner (2026-11-08). Still: check Site URL `https://hellokhedma.io` and `https://hellokhedma.io/**` in Redirect URLs, then try "Mot de passe oublié ?" once with your own address on hellokhedma.io | The reset link must come back to the site to open "Choose a new password" | supabase/templates/reset-password.html |
| O32 | api.apprentissage.beta.gouv.fr | Optional, for ROADMAP 3b priority 1: create an account and an API token for La bonne alternance, add it as Supabase secret `LBA_API_TOKEN`, tell Claude | Work-study offers in the search | ROADMAP Phase 3b |
| O24 | Live site: #/course/dax → Practice | Press one "▶ Run on DAX.do" button, paste (Ctrl/Cmd + V) and run on dax.do: say if it returns a table or an error. Claude could not reach dax.do (blocked by this environment's network) | The 6 DAX.do exercises (Power BI & DAX, DAX in depth) were written but not run | — |
| O7 | sentry.io (optional) | Create a project, add **`SENTRY_DSN`** as a GitHub variable | Error monitoring | — |
| O21 | When HelloKhedma becomes a business | Owner said (2026-11-06) it is personal for now and will become more professional. On the switch (micro-entreprise, SASU…): legal notice with the company name, legal form, address, SIREN / RCS, VAT number if any and a phone number; the company becomes the data controller in the privacy policy; terms of use (CGU), and sales terms (CGV) if anything is paid; sign the processors' data processing agreements (Supabase, Resend, Anthropic, Cloudflare) as the company; any analytics or ads would need a consent banner. Also the opt-in recruiter profile, ROADMAP 6.5. Tell Claude: it updates both languages | Required by LCEN / GDPR once it is a professional activity | index.html (#/legal, #/privacy) |
| O9 | Legal (before a big launch) | Claude reviewed both pages on 2026-11-06 (LCEN notice, GDPR art. 13 information, CNIL cookie rules, actual data flows in the code) and fixed them. Still for the owner: **1.** confirmed non-professional for now (2026-11-06; see O21 for the switch to a business); **2.** check GitHub's phone number in the notice (+1 877 448 4820, from a directory); **3.** optional: a lawyer's read before a big launch, and a retention rule for inactive accounts (e.g. delete after 3 years) | The texts are now accurate, but not legal advice | index.html (#/legal, #/privacy) |
| O12 | Live site | Sign in and use the app in French, then press **EN** and back: check nothing is left in the wrong language and the French reads naturally (report odd wording) | Translations were written by Claude and only tested as a guest | js/i18n-fr.js |
| O11 | Content (before promoting) | Have the 25 courses, 15 portfolio projects, the 9 AI-track courses and 3 AI projects, interview questions and model answers reviewed by people in each field, in English **and French** | Written and translated by Claude: realistic but unreviewed | content/courses/, content/interview/ (French in fr/ subfolders) |
| O18 | Live site: https://hellokhedma.io/#/ai | Read the 9 courses and the 3 portfolio projects of the AI track in Derja (switch to عربي and 3arbizi; start with courses 1 and 3) and say: is the Derja natural? Is the 3arbizi spelling the one you want (8 for غ or gh, 9 for ق)? Mix of French/English terms OK? Words flagged by the writers: mrigel, تتفاكتورا, kontrol, s8ar, ena model, t9ossa, ما يتكاشاش, valid'hom. Also the Tunisian facts: international technology card for API payments, INPDP / personal-data law. The English and French versions (2026-11-08) are translations of the Derja: report anything that reads oddly there too (part of O11 / O12) | Style fixes apply to every file, so list them and Claude applies them in all four languages | content/ai/ar/, content/ai/lat/, content/ai/en/, content/ai/fr/ |

## ✅ Done

| Date | What |
|---|---|
| 2026-11-08 | Saved "Explain my mistake" answers (ROADMAP 4b row 4c): every explanation kept on the device (same mistake → shown at once, no AI call, "Ask the AI again"); fixed-choice formats shared between learners in explain_cache (no account id, 180 days); admin tile "Saved explanations reused"; privacy policy FR + EN. Owner: O38 |
| 2026-11-08 | French interface texts split by area into js/fr/ (shell, offers, learning, exercises, cv, tracker, interview), merged by js/i18n-fr.js: the same 1,266 texts, checked identical. Fewer merge conflicts between sessions; scripts/check-i18n.pl now also reports a key found in two files and runs in CI ("Check translations"). No setup needed |
| 2026-11-08 | O37 done: explain-mistake deployed from GitHub Actions ("Deploy Supabase function", run 17, commit 8e90bbe). "Explain my mistake" is live for signed-in users |
| 2026-11-08 | O33 + O36 done: the e-mail reminders migration (20261108000100) and the explain usage migration (20261108000200) run by the owner in the SQL editor. Still: O34 (Resend key + secrets, then deploy follow-up-reminders) and O37 (deploy explain-mistake) |
| 2026-11-08 | "Explain my mistake" (ROADMAP 4b step 4): after a wrong answer on a course exercise (runnable SQL, the auto-graded formats, written answers after Reveal), signed-in learners can ask Claude Sonnet 5.5 why; answer in the course's language (Derja on the AI track), 30 a day, notice before the first send, nothing stored; admin tiles; privacy policy FR + EN. Owner: O36, O37 |
| 2026-11-08 | Cross-check after the AI Engineer path merge (another session): CI green (the AI path test ran once O35 was done), content and French checks clean, all 36 smoke tests pass locally with an "ai" path; skill check, reviews and study plan work with the AI courses. Fixed a French-only overflow on phones, older than today: Home was 50 px wider than the screen (a summary card title that never wraps, and the header with "Connexion"); the phone-width test now runs in English and French |
| 2026-11-08 | O35 done: seed.sql re-run by the owner, AI Engineer path live on hellokhedma.io. The "Become an AI engineer" card on Training removed (owner's choice): the AI courses are the AI Engineer path's courses and show under "Other courses" on the other paths; #/ai stays reachable by link |
| 2026-11-08 | AI Engineer career path (id "ai", 6th path) in code: seed.sql with French (job titles AI Engineer / Ingénieur IA / LLM Engineer…, tools, tips, CV keywords, 3 learning tracks pointing to official material), role interview questions (EN + FR), path card illustration, Home grid of 3. Its courses are the 9 AI-track courses (plus SQL, Python, Git, Docker) and its projects the 3 AI projects. The AI track is now in English and French too (content/ai/en, content/ai/fr): it follows the FR/EN button, with a switch to Derja (عربي / 3arbizi). Content checks and smoke tests cover the four languages; seed and setup-all.sql (regenerated with all 10 migrations) tested on a local PostgreSQL 16. Needs O35 |
| 2026-11-08 | E-mail reminders (ROADMAP 2.2) and offer coach (2.8). Reminders: opt-in on the Account page, one e-mail on the days a follow-up is due or an interview is within 36 h (EN/FR), test e-mail button; follow-up-reminders function tested locally with Deno against a fake Supabase and Resend; daily GitHub workflow; privacy policy updated. Needs O33 + O34. Offer coach: "💼 Negotiate" on offer cards, in the details dialog and Home's Next actions: salary vs the path's market (range bar, verdict), 6 negotiation tips, prompt to copy. No setup for the coach |
| 2026-11-08 | Training step 3, learn smarter: spaced-repetition reviews (every flashcard answer schedules the card: back in 1, 3, 7, 14, 30 then 60 days, or tomorrow when missed; "🔁 N flashcards to review today" in Home's Next actions, #/review session with "Again" once more at the end, a link in each course's Flashcards) and a skill check per path (#/skillcheck: pick the skills you think you know, CV skills ticked first, 4 questions each from the cheat sheet, 3 right = known; known courses get "🎯 Known" and leave the study plan and "Close the gaps", which reminds to put them on the CV). Synced for signed-in users (learning_sync; the latest review of a card wins). Privacy policy updated (FR + EN). No setup needed |
| 2026-11-08 | O31 done: job-search redeployed from GitHub Actions ("Deploy Supabase function", commit fc197ad): offer filters sent to the sources, smarter duplicates, Adzuna salary statistics on Home |
| 2026-11-08 | Offers filters (contract, remote, posted within) sent to Adzuna / JSearch / France Travail, a change searches again; smarter duplicates across sources; Adzuna salary statistics on Home (median, middle half, 12-month trend, distribution; cached 24 h; privacy policy FR + EN); ROADMAP Phase 3b: prioritised job sources plan. Needs O31 |
| 2026-11-08 | O30 done: JOOBLE_API_KEY set, job-search redeployed, Jooble returns offers on hellokhedma.io. JOOBLE_HOST must stay unset (fr.jooble.org answers 403 to this key) |
| 2026-11-08 | Jooble added as a job source (job-search function, Offers source list, credits, privacy policy + legal notice FR + EN): key in Supabase secrets, optional JOOBLE_HOST. Needs O30 |
| 2026-11-08 | France Travail hidden from the Offers source list: its Offres d'emploi API is closed to new users (access only on request via francetravail.io/contact). The code stays; the option comes back when FRANCE_TRAVAIL_CLIENT_ID / _SECRET are set. Saved searches that used it fall back to All sources |
| 2026-11-08 | Forgot password: "Forgot password?" in the sign-in dialog (reset e-mail, same answer whether or not the address has an account), the reset link opens "Choose a new password" (8+ characters, typed twice), "Change password" on the Account page, expired / used links explained; privacy policy (FR + EN) mentions reset e-mails. Bilingual e-mail template to paste: O29 |
| 2026-11-06 | O28 done: ai_usage migration run, job-search and cv-tailor redeployed from main (013f3f1), Claude top-up entered on #/admin. Admin page, Claude cost estimate and Cloudflare Web Analytics are live |
| 2026-11-06 | O25 (admin_stats migration + admin account) and O27 (Cloudflare Web Analytics token) done by the owner. Admin page gains "Claude API (estimated)": cost per day, cost per call, spent since the last top-up and estimated credit left, from the tokens cv-tailor records (ai_usage_daily) and Anthropic's prices; link to the exact balance in the Claude Console (no API exists for it). Needs O28 |
| 2026-11-06 | Admin page (#/admin, link on the Account page for admins only): accounts (total, new, active, sign-ups per week), applications by stage, chosen paths, CV sync and learning sync, job searches and AI CV calls per day, anonymous statistics (courses finished, skills missing / asked), open problem reports with Done / Ignore. Data from admin_stats() (totals only, refused to non-admins). Cloudflare Web Analytics for visitor counts (cookie-free, only when CF_ANALYTICS_TOKEN is set). Privacy policy updated (FR + EN). Needs O25, O26, O27 |
| 2026-11-06 | Training step 2e: 28 new exercises (EN + FR) on two new practice databases: a sales data warehouse (star schema, customer history, staging orders with planted problems) and a payments database. Data modeling: star schema, history (SCD2), grain. dbt: data tests in SQL (unique, not_null, relationships, rules). SQL: 3 "fix this query" (the editor opens on the broken query) and 2 query plans (must use an index). Take-home cases: Data Analyst (find why one store fell, 5 steps), Data Engineer (go / no-go quality gate, 4), Application Support (payment incident from logs + database + summary, 4). Every answer runs in CI. No setup needed |
| 2026-11-06 | Training step 2d: "fix this file" exercises in the Practice tab: edit a Dockerfile, a Kubernetes manifest or a GitHub Actions workflow until every check passes (24 rules: pinned images and actions, non-root, layer cache, apt hygiene, multi-stage, selectors, resources, probes, Services, secrets, token permissions, script injection, needs / main-only deploys). 7 exercises (Docker 3, Kubernetes 2, CI/CD 2), EN + FR. Checked in the browser with a self-hosted YAML parser (js-yaml, MIT), nothing sent anywhere; CI checks every answer. No setup needed |
| 2026-11-06 | Two in-depth courses (EN + FR): "DAX in depth" (8 lessons, 13 exercises, after Power BI & DAX) and "Snowflake in depth" (8 lessons, 10 exercises, after Cloud data warehouses; free-trial advice). "▶ Run on DAX.do" (course playground): copies a DAX query and opens SQLBI's free DAX.do; 3 runnable exercises in Power BI & DAX, 3 in DAX in depth. Header toggles show the current language / theme, Home cards in nav order (Offers first). No setup needed |
| 2026-11-06 | CV page reworked: the CV is scored as soon as it is saved (no offer needed), against the path's keywords and job titles; fixes sorted by the points they add ("+N pts"); "↑ +N points since your last save" after an edit; "unsaved changes" hint; three-step start when there is no CV; skills found folded under the score. "Match with a job offer" is now a separate, optional panel that runs when an offer is pasted (match %, versions, Tailor / Cover letter first, gaps, full ATS report for the offer folded). No setup needed |
| 2026-11-06 | Training steps 2b + 2c: auto-graded exercises in the Practice tab of every course (53, EN + FR): predict the output, fill in the blanks, put steps in order, match pairs, sort into groups, spot the bug, branching scenarios (incident on call, sprint, dashboard request); for App Support / DevOps: log analysis on real-looking logs (SSH attacks, checkout outage), regex on access logs, cron schedules (crontab, GitHub Actions, Airflow), jq on kubectl / AWS CLI / Prometheus JSON. Checked in the browser, nothing sent anywhere; CI checks every answer. No setup needed |
| 2026-11-06 | Training step 2: runnable SQL exercises (SQL course, 7 exercises): ▶ Run shows the result on a practice database, ✓ Check compares it with the expected result (same result written differently passes); SQLite in the browser, nothing sent anywhere; CI runs every answer. No setup needed |
| 2026-11-06 | O23 done: learning_sync / content_reports migration run by the owner (progress sync and problem reports live) |
| 2026-11-06 | Training step 1: learning progress synced between devices for signed-in users (merge, nothing lost), "⚑ Report a problem" on courses and projects, content checks in CI (a broken course stops the deploy). Needs O23 (run the migration) |
| 2026-11-06 | O22 done: cv_sync / insights migration run by the owner in the SQL editor ("Save my CVs to my account" and anonymous statistics are live) |
| 2026-11-06 | Opt-in "Save my CVs to my account" (synced, merged per version between devices) and opt-in anonymous statistics ("Help improve HelloKhedma"); privacy policy updated; recruiter profile planned for the pro version (ROADMAP 6.5). Needs O22 (run the migration) |
| 2026-11-06 | O10 done: app installed on the owner's iPhone (Safari → Add to Home Screen) and checked offline |
| 2026-11-06 | "Close the gaps" (js/gaps.js): after a CV check / offer match and in Tailor my CV, the missing skills come with the HelloKhedma courses that teach them (time left, progress), roadmap steps naming them and portfolio projects using them; no setup needed |
| 2026-11-06 | Legal review (O9, Claude): legal notice + privacy policy rewritten in FR + EN against LCEN / GDPR art. 13 / CNIL and checked against the code: added Resend, Cloudflare (domain, contact email), Google (Gmail), France Travail + Geo API, Supabase sign-in logs, rights (portability, post-mortem directives, 1-month answer), no automated decisions, minimum age, retention per data. Code fixed to match: IPs hashed with a secret key (HMAC) instead of a plain hash, rate-limit rows purged every call (24 h), Google Fonts and esm.sh removed (fonts and supabase-js self-hosted). job-search + cv-tailor redeployed |
| 2026-11-06 | O4 done: contact@hellokhedma.io via Cloudflare Email Routing (forwards to the owner's Gmail; MX on the root domain, Resend stays on mail.), CONTACT_EMAIL GitHub variable set, site redeployed. O20 done: "Correct, tailor and create my CV" + Download PDF tested by the owner |
| 2026-11-06 | CV maker: "Download PDF" builds the PDF in the app (pdf-lib, self-hosted): same file on phone and computer, no browser URL/date lines, exact margins and page breaks. Layout reworked over 4 render-and-review rounds + an independent recruiter/ATS review: Skills after Summary, Certifications before Education (years on the right), bold title + dates right, bold company + grey place, grouped skills, "Volunteering"/"Bénévolat" instead of "Involvement"; a mostly empty last page triggers a compact pass (body text never under 10 pt): the owner's CV fits on 1 page, the 5-job test CV on 2 full pages. ATS text checked with two PDF readers. cv-tailor writes dates as MM/YYYY (redeployed); no setup needed |
| 2026-11-06 | CV print fixed after the owner's 4-page test: entries may split across pages (no more blank half pages), tighter type (10 pt, smaller margins), contact items never broken; the AI CV now targets 2 pages at most (fewer bullets on older jobs, tools in the context line, grouped skills). Same 5-job CV: 4 pages → 2 |
| 2026-11-06 | "Correct, tailor and create my CV": one button, one AI call: the CV corrected (spelling, grammar, tense, dates, wording), tailored to the offer and opened in the CV maker in the new layout, with "What was corrected and tailored" and "Gaps and questions". "Rewrite only (text)" kept. cv-tailor redeployed from GitHub |
| 2026-11-06 | CV maker layout rebuilt on the owner's CV framework (centered header, uppercase titles over a rule, title / company + dates on the right, context line, grouped skills, new Involvement section), Arial, no icons; printed PDF checked: text reads back cleanly. "Print / save as PDF" no longer adds blank pages. cv-tailor fills the context line and Involvement once redeployed (Actions → Deploy Supabase function → cv-tailor) |
| 2026-11-06 | SUPABASE_ACCESS_TOKEN secret added (token scoped to HelloKhedma: Edge Functions read-write, project settings read). "Deploy Supabase function" workflow works: cv-tailor deployed from GitHub. Function updates no longer need copying code |
| 2026-11-06 | "Create my CV for this offer" (Tailor my CV → the whole CV for the offer, written by AI, opens in the CV maker with notes; saved as a version named after the offer). Needs O20 (cv-tailor redeploy). New workflow to deploy functions from GitHub |
| 2026-11-06 | PDF CV reading fixed: PDFs that split words into pieces ("L i nux") were read with spaces inside words, so most skills were missed (owner's CV: 1 skill found → 25). Re-upload a PDF CV saved before this fix. Also "REST APIs" now counts as REST API; no setup needed |
| 2026-11-06 | O16 done: ANTHROPIC_API_KEY set, `cv-tailor` deployed (dashboard editor, same code without the header comments); "Rewrite with AI" tested signed in on hellokhedma.io: full rewrite in French with gaps and questions. Fixed a stray "null" shown above the result |
| 2026-11-06 | "Confirm email" turned back on in Supabase by the owner (new sign-ups must confirm their address) |
| 2026-11-06 | O5b done: the Resend key pasted in the chat was deleted and replaced in Supabase SMTP; sign-in link received again |
| 2026-11-06 | O5 done: `mail.hellokhedma.io` verified in Resend, Supabase SMTP sends as "HelloKhedma" <no-reply@mail.hellokhedma.io>; a magic link reached the owner's Gmail inbox (not spam). Old Resend keys deleted. Next: "Confirm email" back on |
| 2026-11-06 | O19 done: Supabase Site URL / Redirect URLs set to https://hellokhedma.io, sign-in tested by the owner. Site added to Google Search Console with sitemap.xml |
| 2026-11-06 | O8 done: `hellokhedma.io` bought at Cloudflare (1 year; renews Nov 2027, keep auto-renew on), DNS to GitHub Pages ("DNS only"), custom domain + HTTPS, tested by the owner. robots.txt, sitemap.xml, canonical link added; docs point to the new address |
| 2026-11-05 | CV maker (ATS-friendly CV, PDF, saved as a CV version) and ATS score with fixes on the CV page; no setup needed |
| 2026-11-05 | Tunisian AI track: 3 portfolio projects (Arabic letters + 3arbizi), preview branch retired, docs updated |
| 2026-10-30 | Learning content: honest course times, 4 new courses, all 25 courses at 7-10 lessons, 15 portfolio projects (EN + FR); no setup needed |
| 2026-10-30 | O17 done: seed re-run by owner. Verified in the live database (DevOps path with French name, 3 tracks, 15 steps, 5 tools, 3 tips) and on the live site (path card, selection, tracks and courses on Training) |
| 2026-10-30 | Path market pulse on Home ("Your market": salary, remote, top skills, levels from the offers you looked at); no setup needed |
| 2026-10-30 | Smoke tests (Playwright) run before every deploy; a failing test stops it; no setup needed |
| 2026-10-30 | DevOps Engineer path in code (seed, interview questions, 4 new courses) and every course extended by one lesson, exercise and interview question; setup-all.sql regenerated |
| 2026-10-30 | Offer checks: posted date chip + filter, level (Junior…Lead) + filter, "⚠ Check this offer" warnings (scam signals, stale, no company) + filter; no setup needed |
| 2026-10-30 | Letters pack: cover letter prompt on offers and the CV match, thank-you / follow-up emails from tracker cards and Home (EN + FR); no setup needed |
| 2026-10-29 | Interactive learning: lesson-by-lesson course player, quiz and flashcards from every cheat sheet, self-graded exercises, roadmap of tracks, streak + XP; no setup needed |
| 2026-10-29 | New look (warm ivory / charcoal, serif titles, greeting + summary cards, illustrated path cards, segmented tabs, page fade-in); no setup needed |
| 2026-10-28 | App renamed HelloKhedma; Supabase project, tables and seed; GitHub Pages deploy; Adzuna search with cache + rate limit |
| 2026-10-28 | Multi-page app (Home, Offers, Training, CV check, Applications) |
| 2026-10-28 | CV skills extraction, offer skill highlights and CV fit score |
| 2026-10-29 | France Travail support in code (owner's account has no access to the offers API, so unused) |
| 2026-10-29 | JSearch key added by owner (the 404 was fixed later: see the O2 row) |
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
| 2026-10-29 | Salary on offers: chip, filter, sort, copied to the tracker, rights tip |
| 2026-10-29 | "Rewrite with AI" (cv-tailor + Claude) built; live once O16 is done |
| 2026-10-29 | "Tailor my CV": gap analysis + prompt to copy (no API, no setup); in-app AI button disabled for later |
| 2026-10-29 | O13 and O14 done by owner. Verified in the live database: cv_version column exists; French texts for 4 paths, 12 tracks, 56 steps, 20 tools, 12 tips (keywords stay English); the live Training and Home pages show them |
| 2026-10-29 | O15 done: job-search redeployed by owner. Verified: every result carries the salary field; an Adzuna salary (64–85 k€) shows on the offer |
| 2026-10-29 | French content: 17 courses + interview prep live in French; path content needs O14 |
| 2026-10-29 | js/app.js split into one module per page (no change for users) |
| 2026-10-29 | "CV sent" per application (2.7); signed-in sync needs O13 |
| 2026-10-29 | Several CV versions (3.7); no setup needed |
| 2026-10-29 | French / English interface (FR/EN button, French legal pages); no setup needed |
| 2026-10-29 | O2 done: latest `job-search` deployed. **JSearch works**: 10 full offers per search (~6,000 characters each), "All sources" = Adzuna + JSearch with no warnings. Tip: deploy from a commit-pinned raw link, the plain raw link is cached ~5 min |
