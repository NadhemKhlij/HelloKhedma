# HelloKhedma: launch checklist

## 👉 Next session (written 2026-11-06)
- **Just finished (2026-11-06):** the site is live at **https://hellokhedma.io** (O8 done). Next for the owner: the
  O5 done too (emails sent as no-reply@mail.hellokhedma.io) and "Confirm email" is back on.
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
| O4 | GitHub → Settings → Secrets and variables → Actions → Variables | Add **`CONTACT_EMAIL`** (dedicated address), then re-run the deploy | Legal pages show "contact address coming soon" | — |
| O7 | sentry.io (optional) | Create a project, add **`SENTRY_DSN`** as a GitHub variable | Error monitoring | — |
| O20 | Live site, signed in | Test **Tailor my CV → 📄 Create my CV for this offer**: the CV maker should open with the CV for the offer and the AI notes | Confirms the new cv-tailor end to end (deployed 2026-11-06 by the GitHub workflow) | — |
| O9 | Legal (before a big launch) | Have the legal notice and privacy policy reviewed | Templates, not legal advice | — |
| O10 | Your phone | Install the app (Android: "Install the app" link in the footer; iPhone: Safari → Share → Add to Home Screen) and check it opens offline | PWA install was only tested in a desktop browser | — |
| O12 | Live site | Sign in and use the app in French, then press **EN** and back: check nothing is left in the wrong language and the French reads naturally (report odd wording) | Translations were written by Claude and only tested as a guest | js/i18n-fr.js |
| O11 | Content (before promoting) | Have the 25 courses, 15 portfolio projects, interview questions and model answers reviewed by people in each field, in English **and French** | Written and translated by Claude: realistic but unreviewed | content/courses/, content/interview/ (French in fr/ subfolders) |
| O18 | Live site: https://hellokhedma.io/#/ai (merged into main on 2026-11-05; the preview address is gone) | Read the 9 courses and the 3 portfolio projects of the Tunisian AI track (#/ai, start with courses 1 and 3) in both scripts and say: is the Derja natural? Is the 3arbizi spelling the one you want (8 for غ or gh, 9 for ق)? Mix of French/English terms OK? Words flagged by the writers: mrigel, تتفاكتورا, kontrol, s8ar, ena model, t9ossa, ما يتكاشاش, valid'hom. Also the Tunisian facts: international technology card for API payments, INPDP / personal-data law | All 9 courses are written (owner asked to continue before the review): style fixes now apply to every file, so list them and Claude applies them everywhere | content/ai/ar/, content/ai/lat/ |

## ✅ Done

| Date | What |
|---|---|
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
