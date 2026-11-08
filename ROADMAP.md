# HelloKhedma roadmap

Goal: one place where a job hunter **finds the right offers, knows how well they fit, closes the skill gap, and
keeps every application moving**, without juggling five tools.

Effort: **S** ≈ under a day · **M** ≈ 1–3 days · **L** ≈ a week or more. Each phase ends with a deploy.

## Phase 0: done
| # | Item | Status |
|---|---|---|
| 0.1 | Light / dark theme toggle (remembers the choice, follows the system by default) | ✅ live |
| 0.2 | 17 HelloKhedma courses with lessons, printable cheat sheets, exercises, common mistakes and interview questions; missing skills link to them | ✅ live. Still missing: Spark, Kafka, Snowflake/BigQuery, cloud (AWS/Azure/GCP), CI/CD, Tableau, Looker, ServiceNow, Jira deep-dive, data storytelling (see 4.1) |

## Phase 1: ready for real users (trust, legal, reliability)
Done in code: 1.2 legal notice + privacy policy (contact email via the `CONTACT_EMAIL` variable), 1.3 Account & data page
(export JSON, delete account / device data), 1.4 source credits, 1.5 friendly error messages + optional Sentry (`SENTRY_DSN`),
1.6 SEO tags and favicon. IP addresses for rate limiting are now hashed and purged after 24 h.
Still to do by you: 1.1 SMTP, own domain, cookie-free analytics (optional). Next in code: 1.9 accessibility pass.
Done (2026-10-29): 1.8 installable app (manifest, icons, service worker; works offline for training, courses, interview
prep and the guest tracker; "Install the app" link in the footer).
Done (2026-10-29): 1.7 French / English interface (FR/EN button, browser language by default, French legal notice and
privacy policy).
Done (2026-10-29): 1.7b French content: 17 courses and the interview prep (content/…/fr/, translated by Claude,
not reviewed yet: CHECKLIST O11), career paths, tracks, steps, tools and tips (`_fr` columns, migration O14).

| # | Item | Why | Effort |
|---|---|---|---|
| 1.1 | Custom email (Resend/Brevo SMTP) + "Confirm email" back on | Sign-up emails reach real people | S |
| 1.2 | Privacy policy, *mentions légales*, cookie-free analytics (Plausible/Umami) | Required in the EU; know what is used | S |
| 1.3 | Account page: delete my account, export my data (JSON/CSV) | GDPR rights, user trust | M |
| 1.4 | Source attribution ("Jobs by Adzuna", JSearch) | Provider terms | S |
| 1.5 | Error monitoring (Sentry free tier) + friendly error states | Know when something breaks before users tell you | S |
| 1.6 | Custom domain (hellokhedma.com), social preview image, SEO meta | Credibility, shareable links | S |
| 1.7 | French / English interface | Main audience is French-speaking | M |
| 1.7b | French content: path names, tracks, tools and tips (seed: add `_fr` columns or a translations table), courses and interview questions (content/…/fr/ JSON) | The interface is French, the learning content is not yet | L |
| 1.8 | Installable app (PWA) with offline tracker and courses | Feels like an app on the phone | M |
| 1.9 | Accessibility pass (keyboard, contrast in both themes, screen reader labels) | Usable by everyone | S |

## Phase 2: a tracker that actually manages the hunt
Done (2026-10-29): 2.1 details (notes, salary, contact, next action), 2.2 follow-up dates with in-app reminders
(Home "Next actions", card badges; email reminders still to do), 2.3 interview dates + .ics, 2.4 timeline,
2.5 stats + weekly goal, 2.6 CSV export/import. Signed-in sync of the new fields needs migration O6 (CHECKLIST.md).
Done (2026-10-29): 2.7 CV version sent per application (recorded on Track / Add, editable in the details, card badge,
response rate per CV, CSV column; signed-in sync needs migration O13). Still to do: cover letter per application (2.7b).
Done (2026-11-08): 2.2 e-mail reminders, opt-in on the Account page (signed in): one e-mail on the days a follow-up is
due or an interview is within 36 h, in the interface language (follow-up-reminders function, Resend, scheduled daily by
.github/workflows/reminders.yml; "Send me a test e-mail now"). Needs CHECKLIST O33 + O34. 2.8 offer coach
(js/offercoach.js): offer-stage cards ("💼 Negotiate", details dialog, Home's Next actions for 14 days) compare the
offered salary with the path's market (Adzuna advertised salaries, else the offers seen here): range bar, verdict,
negotiation tips and a prompt to copy.

| # | Item | Why | Effort |
|---|---|---|---|
| 2.1 | Notes, salary, contact person, next action per application | Everything about an application in one card | M |
| 2.2 | Follow-up dates + reminders (email, daily digest) | The #1 reason applications die: no follow-up | M |
| 2.3 | Interview dates + "add to calendar" (.ics) | No missed interviews | S |
| 2.4 | Timeline per application (moved to Applied on…, Interview on…) | See how long things take | S |
| 2.5 | Dashboard: applications/week, response rate, interview rate, weekly goal | Motivation and honest feedback on the strategy | M |
| 2.6 | CSV export / import | Bring an existing spreadsheet in, take data out | S |
| 2.7 | Attach the CV version + cover letter used per application | Know what was sent to whom | M |
| 2.7b | Cover letter used per application (text kept locally like the CV, or a short note) | Know what was sent to whom | S |
| 2.8 | Offer coach: when a card reaches "Offer", compare the offered salary with the salaries already seen for that path and region (low / typical / high), negotiation tips and a prompt to copy | Negotiate with data, not guesses | M |

## Phase 3: find better offers faster
Done (2026-10-30): 3.1 date and level filters and 3.8 offer trust check (js/offercheck.js, in the browser): "Posted N
days ago" chip (orange after 45 days), date filter (offers without a date are left out), level from the title or the
years of experience asked (offers with no level stay in when filtering), "⚠ Check this offer" (WhatsApp / Telegram
contact, personal email address, fees or money transfers, easy-money wording) and "🕒 Worth checking" (no company,
older than 45 days) with the reasons, and a filter to hide them. Reposted offers are not detected yet (needs history
across searches).
Done (2026-10-30): 3.9 path market pulse (js/pulse.js): a "Your market" card on Home built from the offers the user
looked at for the path (last 60 days, up to 400, in this browser only): typical salary (middle half of the euro
salaries given by employers; estimates and other currencies left out), % remote / hybrid, % stating a salary, top 10
skills with CV gaps and course links, levels asked. Next: the same from France Travail "Marché du travail" (3.6) for
figures beyond the user's own searches.
Done (2026-10-29): 3.1 contract and remote filters (detected from the offer text),
3.3 hide / "not interested", seen marker, "Tracked ✓", 3.4 minimum CV-fit filter, saved searches (this browser; email alerts still to do).
Done (2026-10-29): "Companies I follow" (career pages on Greenhouse, Lever, Ashby, Workable, SmartRecruiters; full descriptions,
"New since last visit"). Done (2026-10-29): "Remote jobs" tab (Jobicy by category + Remotive; Himalayas blocks browser
calls and Arbeitnow has no search, so they are not used). Next sources to consider: Jooble / Careerjet
(key on request, France + Tunisia), La Bonne Alternance, Recruitee / Teamtailor career pages, syncing the watchlist to the account.
Done (2026-10-29): 3.7 several CV versions (named, one can be linked to each path and becomes active with it; switch
the scoring CV on the Offers page; the CV match compares every version). Local only, like the CV itself.

| # | Item | Why | Effort |
|---|---|---|---|
| 3.1 | Filters: contract type, remote, salary, date posted ("posted N days ago" chip + filter), seniority (junior / mid / senior / lead, detected from the title and text) | Cut noise | M |
| 3.2 | Saved searches + email alerts for new matching offers | The app works while you sleep | M |
| 3.3 | Hide / "not interested", mark as seen, no duplicates across sources | Never read the same offer twice | S |
| 3.4 | Minimum fit filter ("show offers ≥ 60% fit") | Focus on realistic applications | S |
| 3.5 | Spontaneous applications: companies likely to hire (France Travail "La Bonne Boite", available on your account) | Hidden job market | M |
| 3.6 | Salary and demand by job and region (France Travail "Marché du travail", available on your account) | Negotiate and target regions with data | M |
| 3.7 | Several CV versions (one per path) and pick which one scores offers | Different roles, different CVs | M |
| 3.8 | Offer trust check: "⚠ check this offer" when an offer is older than 45 days or reposted, asks to contact on WhatsApp / Telegram or a personal email, mentions fees or paid training, or has no company name (in the browser only) | Fake and stale offers waste applications | S–M |
| 3.9 | Path market pulse on Home, from your own search results: typical salary range, top 10 requested skills (with your CV gaps), % remote, % with a salary | Know the market for your path at a glance | M |
| 3.10 | Import from LinkedIn: guide to "Save to PDF" from your profile (the existing CV upload reads it), then read the LinkedIn data export (.zip: Positions, Skills, Education CSV) in the browser to prefill a CV version; nothing is sent | Start from what is already on LinkedIn without retyping | M |

## Phase 3b: job sources plan (owner request, 2026-11-08)
Goal: more offers, more relevant, for France first and then Tunisia / remote. Rules for every new source: read its terms
first (attribution, caching, reuse), keys only in Supabase secrets, credit shown under the results, privacy policy and
legal notice updated (FR + EN). Sources called from the browser receive the visitor's IP: prefer the server function.

| Priority | Source | What it adds | Access | Effort | Status |
|---|---|---|---|---|---|
| Done | Offers filters sent to the sources | Contract, remote, "posted within" applied by Adzuna / JSearch (and France Travail) themselves: 20 matching offers instead of 20 filtered down to a few; changing a filter searches again | — | S | **Done 2026-11-08** |
| Done | Smarter duplicates | The same offer from 2–3 sources shown once ("(H/F)", accents, "SAS"… ignored) | — | S | **Done 2026-11-08** |
| Done | Adzuna salary statistics | Home: median advertised salary, middle half, 12-month trend and distribution for the path's main title | Adzuna keys (have) | S | **Done 2026-11-08** |
| Done | Jooble | Large aggregator (many boards); key works on jooble.org | Free key (have) | S | **Done 2026-11-08** |
| 1 | La bonne alternance (French government) | Work-study offers (alternance, apprenticeship) and companies likely to take apprentices: juniors and career changers | Free token (account on api.apprentissage.beta.gouv.fr, to confirm) | M | Next: owner gets the token |
| 2 | Recruitee + Personio career pages | "Companies I follow" for many French / German start-ups and SMEs (public feeds, no key) | None | S | Planned |
| 3 | Adzuna "top companies" + "what's hot" for the path | Home: who hires most for the path, and the volume trend of offers | Adzuna keys (have) | S | Planned |
| 4 | Arbeitnow | Europe, English-speaking and remote tech jobs, visa-sponsorship flag | Free, no key (check terms) | S | Planned |
| 5 | Himalayas + Remote OK | "Remote jobs" tab: more remote offers, salary ranges, time zones (Remote OK asks for a link back) | Free (check terms) | S | Planned |
| 6 | Search quality | Synonyms per path ("data engineer" OR "ingénieur data", Adzuna what_or), several pages for "All sources", JSearch experience filter, "new since last visit" badge | — | M | Planned |
| 7 | France Travail Offres d'emploi v2 (+ La bonne boîte) | Best French coverage, full descriptions; companies that hire without posting | Closed to new users: request via francetravail.io/contact (draft given 2026-11-08); code ready, option hidden | — | Waiting for France Travail |
| 8 | Careerjet publisher API | Another aggregator, many countries incl. Tunisia | Publisher account (check terms) | S | Later |
| — | LinkedIn, Indeed, Welcome to the Jungle, APEC, Tanitjobs, Keejob | — | No public jobs API; scraping breaks their terms | — | Not planned (job-board links stay) |

## Phase 4: learning that leads to a job
Done (2026-10-30), after an honest review of the content: course and lesson times are now computed from the content
(js/coursetime.js: reading at 200 words/min + practice: examples, exercises, interview questions, quiz); the old
hand-written hours were 3 to 5 times too high (SQL said 14 h, the content is about 3 h). 4 new courses (Spark,
Kafka, cloud data warehouses, Tableau / Looker Studio / data storytelling) and deeper courses (SQL and Python 10
lessons, Power BI 9, Docker 8, Kubernetes 8, monitoring 7 with Prometheus and Grafana): 25 courses, every path keyword
has a course except Confluence. 4.5 portfolio projects: 3 per path (15, EN + FR) with steps, self-check, data links and
a CV line (Training page, #/project/<id>). Same day, second pass: the 15 remaining 4-lesson courses brought to 8
lessons (intermediate topics, more exercises, interview questions and cheat-sheet items): every course now has 7-10
lessons, about 2.5-3.5 h of reading and practice each. Done (2026-11-06, training step 1): learning progress synced to
the account (js/learnsync.js: lessons, quizzes, flashcards, exercises, projects, XP, interview prep), "Report a problem"
on courses and projects (content_reports), content checks in CI (scripts/check-content.mjs). Next (training plan):
runnable SQL exercises (done 2026-11-06: 7 SQL-course exercises on the "shop" dataset, SQLite in a Web Worker, result
compared with the course answer's, answers executed in CI), spaced repetition + placement test, AI "explain my
mistake" (Sonnet 5.5), runnable Python (Pyodide), project starter repos with automatic checks + public portfolio.
Earlier "still to do": sync lesson and project progress to the account (done 2026-11-06),
expert review (CHECKLIST O11), advanced level for the core courses if users ask for it.
Done (2026-10-29): 4.4 Interview prep page: 55 questions per path on average (14 behavioral, 8 role-specific, plus the
technical questions of the path's courses) with example answers, 2-minute timer, "got it / to review" decks; STAR story
builder linked to question themes; before/during/after checklist, questions to ask, salary tips; upcoming interviews from
the tracker and "Prepare" buttons. Still to do: sync stories and ratings to the account, AI feedback on answers (Phase 5.3).
Done (2026-10-29): 4.3 weekly study plan on the Training page (courses for CV gaps first, then track steps, packed by h/week).
| # | Item | Why | Effort |
|---|---|---|---|
| 4.1 | Courses for every path keyword (continue Phase 0.2) | Close every gap in-app | L |
| 4.2 | Quizzes per course + course progress synced to the account | Check understanding; keep progress across devices | M |
| 4.3 | Weekly study plan from your hours/week and your missing skills | Turns tracks into a schedule | M |
| 4.4 | Interview prep per path: question bank, STAR story builder, model answers | Interviews are where offers are won | M |
| 4.4b | Interview stages and take-home tasks per path (screen → technical → case → final), common take-home exercises, red flags on the employer side (EN + FR content) | Know what each round looks like before it happens | M |
| 4.5 | Portfolio project briefs per path with evaluation checklist | Proof beats certificates | M |
| 4.6 | Certifications tracker (planned, booked, passed) | Clear goals | S |
| 4.7 | Skill check per path: a short placement test built from the course quizzes; passed skills count as known and the study plan skips them | Learn only what you are missing | M |

## Phase 4b: training plan (owner-approved direction, 2026-11-06)
Steps 1, 2, 2b, 2c, 2d and 2e are done; continue in this order unless the owner chooses otherwise. Each step: branch → CI (content
check + smoke tests) → publish; migrations tested on a local PostgreSQL 16 with Supabase-like roles first; EN + FR.

| Step | What | How | Owner part | Status |
|---|---|---|---|---|
| 1 | Learning progress synced, "⚑ Report a problem", content checks in CI | learnsync.js, report.js, scripts/check-content.mjs | Migration (O23) | **Done 2026-11-06** |
| 2 | Runnable SQL exercises checked against the expected result | sqlrun.js (sql.js in a Worker), sqlgrade.js, content/sql/shop.sql | — | **Done 2026-11-06** (7 SQL-course exercises) |
| 2b | Generic exercise formats for every course (no engine): predict the output, fill in the blank (accepted answers / regex), put steps in order (drag & drop), match pairs, sort into groups, spot the bug, branching scenarios | New `practice` item types in course JSON + one renderer module; check-content validates them | — | **Done 2026-11-06** (js/drills.js; 53 auto-graded exercises, 2-3 in each of the 25 courses, EN + FR) |
| 2c | App Support / DevOps practice: log analysis on real log files ("top 5 errors", "when did the outage start"), regex extraction, cron expressions, JSON/API parsing | Plain JS checks (no engine), log files in content/ | — | **Done 2026-11-06** (12 of them: 3 log analysis on content/logs, 2 regex, 3 cron, 4 jq on content/data; plus bug hunts and an incident scenario) |
| 2d | DevOps validators: fix a Kubernetes manifest / GitHub Actions workflow (YAML parser + rule checks), Dockerfile review (lint rules in JS) | Self-hosted YAML parser (MIT) | — | **Done 2026-11-06** (js/filecheck.js + js-yaml 4.1.0; 24 rules; 7 "fix this file" exercises: 3 Dockerfiles, 2 Kubernetes manifests, 2 GitHub Actions workflows, EN + FR) |
| 2e | More SQL: star-schema dataset for data modeling, data-quality checks, "fix this query", EXPLAIN QUERY PLAN; take-home cases per path (DA sales analysis, Support incident from logs) | New content/sql datasets + run specs | — | **Done 2026-11-06** (datasets dwh + payments; 28 exercises EN + FR: 6 star schema / SCD2 / grain in Data modeling, 4 data tests in dbt, 3 "fix this query" + 2 query plans in SQL, take-home cases: Data Analyst (SQL, 5 steps), Data Engineer quality gate (Airflow, 4), Application Support incident (ITIL, 4: logs + SQL + summary). BA and DevOps cases later) |
| 3 | Learn smarter: spaced-repetition flashcards ("Review today" on Home), placement test per path (4.7) from the quizzes; passed skills skipped by the study plan and Close the gaps | Local + learnsync | — | **Done 2026-11-08** (js/srs.js, #/review, #/skillcheck: Leitner boxes 1-3-7-14-30-60 days, 4 questions per skill, 3 right = known) |
| 4 | AI help: "Explain my mistake" on exercises (Claude **Sonnet 5.5**, ~0.5 ct; keep Opus 5.5 for the CV rewrite), later "Ask about this lesson" | New cv-tailor mode or function, daily limit, notice | Deploy function (button) | **"Explain my mistake" done 2026-11-08** (explain-mistake function, 30 a day, notice; SQL, auto-graded and written exercises, answer in the course's language). "Ask about this lesson" later |
| 4c | Save "Explain my mistake" answers (owner request 2026-11-08): **a.** on the device: keep each explanation in localStorage keyed by exercise + attempt + language, shown at once on the same mistake, no AI call, not counted in the daily limit, no privacy change; **b.** shared on the server, only for fixed-choice formats (choice, order, match, groups, bug line): table keyed by course + exercise index + normalized attempt + language + content version, filled by explain-mistake, read before calling Claude, not counted in the limit. Free-text answers (SQL, regex, written) never stored on the server | js/explain.js, explain-mistake function, new migration (RLS: read by the function only), privacy policy FR + EN, smoke test | Run migration, redeploy explain-mistake | **Done 2026-11-08** (device + shared for fixed-choice formats, migration 20261109000100) |
| 5 | Runnable Python / pandas (Pyodide, ~15 MB first load, hidden tests); Excel formulas with formula.js (MIT; **not** HyperFormula: GPL) | Self-hosted, loaded on demand | — | Planned |
| 6 | Projects that prove something: starter GitHub repos per project with automatic checks (badge), opt-in public portfolio page `#/p/<name>`, optional AI project review | GitHub org + migration | Create GitHub org, run migration | Planned |
| 7 | Content from data: insights_skill_gaps → which courses to write; advanced levels; capstone per path; expert review (O11: volunteers via Report a problem, paid freelancers, or credited reviewers) | Ongoing | Find reviewers | Ongoing |

AI-feedback exercises (later, signed-in, daily limit, Sonnet 5.5): BA user stories + Given/When/Then (format checked
free, content by AI), App Support incident message / post-mortem, interview answers (5.3), AI-track prompts checked
against a JSON schema. Engagement add-ons: weekly study goal with .ics sessions, badges, streak freeze, push reminders
(needs a server part). Bigger formats: App Support incident simulator (timeline of alerts / logs / tickets), Git
branching playground. Things that cannot run in a browser (Docker, Kubernetes, Terraform, real shells) stay as
fill-in / scenario exercises.

## Phase 5: apply faster with AI (Claude API through an Edge Function)
| # | Item | Why | Effort |
|---|---|---|---|
| 5.1 | Letters pack: cover letter tailored to an offer + your CV, thank-you email when a card moves to Interview, follow-up email when a reminder is due (prompt to copy first, in-app AI later with the cv-tailor rules) | Hours saved per week | M |
| 5.2 | CV tailoring suggestions per offer (which skills to put forward, honest rewording) | Better match without lying | M |
| 5.3 | Mock interview chat for a given offer | Practice anytime | M |
| 5.4 | Smarter skill extraction (synonyms, seniority, must-have vs nice-to-have) | Better fit scores | M |
| 5.5 | Professional summary: prompt turning your CV + path into a 3–4 line summary (CV top or LinkedIn "About") | A strong first impression in seconds | S |
Note: these have a cost per use; add per-user limits (like the search rate limit) before launching them.
Done (2026-10-30): 5.1 letters pack, first stage (js/letters.js): "✉ Cover letter" on offers and the CV match (prompt
to copy with honesty rules, letter language EN/FR, default = offer language); "✉ Email" on applied / interview cards
and "Write the email" on Home follow-ups (thank-you and follow-up templates in EN/FR filled from the card, copy or open
in the email app). Still to do: "Write with AI" in the app (same rules as cv-tailor), keep the letter sent per
application (2.7b).
Done (2026-10-29): 5.2, "Tailor my CV" on offers and the CV match: gap analysis + a prompt to copy into your own AI (CV stays local), and "Rewrite with AI" in the app (cv-tailor function, Claude Opus 5.5 at medium effort, signed-in users only, 5 a day per account, notice before every send, nothing stored). Needs the owner's Anthropic API key and the function deployed (CHECKLIST O16, done 2026-11-06).
Done (2026-11-06): "Create my CV for this offer": the same function (mode "cv", structured output) writes the whole CV for
the offer in the CV maker's fields, with notes (gaps, [number?] to fill in); it opens in the CV maker to check, print
or save as a version named after the offer. Same notice and daily limit. Then the same day: one button "Correct, tailor
and create my CV" (also fixes spelling, grammar, tense, dates and wording, and lists the changes); "Rewrite only" keeps
the text answer.

## Tunisian AI Teacher (live on main since 2026-11-05)
A learning track to become an AI engineer (build apps with Claude and other AI tools, run them in production, maintain
and improve them), taught only in Tunisian Derja, in Arabic letters and in 3arbizi (switch, remembered). Page #/ai,
entry card on Training; courses use the normal player (right to left in Arabic letters, code left to right).
Plan, 9 courses: 1 the job and how LLMs work, 2 prompt engineering, 3 Claude API in Python, 4 tools/MCP/agents, 5 RAG
and embeddings, 6 AI coding tools, 7 evaluation and tests, 8 production (security, monitoring, cost), 9 maintenance and
continuous improvement. Done (2026-10-31, pilot): courses 1 and 3. Done (2026-11-05, at the owner's request before the
Derja review): the other 7 courses. All 9 have 8 lessons in both scripts (about 3-4 h of reading and practice each);
Claude API details checked against the official reference. Merged into main and published on 2026-11-05 (preview
branch removed from PREVIEW_BRANCHES). Done (2026-11-05): 3 AI portfolio projects in both scripts on #/ai (documentation
assistant with RAG and citations, document-to-JSON extraction, support agent with tools in production), opened in the
normal project page. Next: owner review of the Derja of the courses and projects (CHECKLIST O18).

## Phase 6: grow
| # | Item | Why | Effort |
|---|---|---|---|
| 6.1 | More paths (DevOps, Product Owner, Cybersecurity, QA, Cloud…) | More audience | M each |
| 6.2 | Admin page to edit paths, tracks and courses without SQL | Content updates without a developer | L |
| 6.3 | Premium plan (AI features, alerts) | Pays for APIs | L |
| 6.4 | Mentors / referrals / community | Network effects | L |
| 6.5 | **Pro version only (once HelloKhedma is a company, CHECKLIST O21):** opt-in "Visible to recruiters" profile. The candidate chooses what recruiters see (a CV version, skills, path, availability), can pause or delete it at any time, and is contacted through HelloKhedma first. Needs: terms of use for candidates and recruiters, explicit consent separate from CV sync, recruiter accounts and verification, a data processing agreement, possibly a DPIA (large-scale profiling), and a business model (recruiters pay). Never built on the CVs saved for sync or on the anonymous statistics without asking each user again | Business model; candidates found by recruiters | XL |

## Engineering hygiene (ongoing)
- Done (2026-10-30): smoke tests (Playwright, 15 tests, ~30 s) in the deploy workflow; a failure stops the deploy.
  They cover start-up, every page, the guest tracker, CV + letters, offer checks, a course, FR/EN and phone width.
  Not covered: signed-in flows (would need a test account in Supabase), the job search itself (paid quotas),
  the Edge Functions.
- Done (2026-10-29): js/app.js split into one module per page (state, router, home, offers, training, cvpage,
  applications, account); app.js keeps start-up, path selection and sign-in (~200 lines).
- Sync the data that is still local-only to the account: followed companies, saved searches, hidden/seen offers,
  lesson progress, interview ratings and STAR stories, weekly goal (needs a migration with RLS per table). CV versions stay local by design.
- Done (2026-11-06): fonts and supabase-js self-hosted (no Google Fonts, no esm.sh); a page load reaches only Supabase.
- Database backups (Supabase Pro) once real users rely on it.
- Watch API quotas (JSearch free plan, Adzuna) and the rate limits in the Supabase dashboard.
- supabase/setup-all.sql (one-shot setup for a new project) stops at the first three migrations: add the two
  20261029 migrations to it.

## Decisions log (so they are not reopened by accident)
- 2026-10-29: Courses and interview content are static JSON in content/ (deployed with the site), not database rows.
- 2026-10-29: The CV text never leaves the browser (localStorage only), even for signed-in users.
- 2026-11-06: Owner chose to add two opt-in options, both off by default: "Save my CVs to my account" (cv_sync, own RLS
  row, merge between devices, deleted when turned off) and "Help improve HelloKhedma" (anonymous statistics: skill
  names, course ids, path; no CV/offer text, no account id, no IP; day only; kept 2 years). Without opt-in, the
  2026-10-29 rule still holds. Reusing these data for any other purpose needs a new, explicit consent.
- 2026-10-29: France Travail "Offres d'emploi" API is supported in code but unused: the owner's francetravail.io
  account does not offer it. La Bonne Boite and Marché du travail are available on that account (see 3.5, 3.6).
- 2026-10-29: Owner declined a bookmarklet ("Analyze with HelloKhedma" from any job page). Do not propose it again.
- 2026-10-29: Remote boards: Himalayas blocks browser calls (no CORS) and Arbeitnow has no search; not used.
  Remotive's free feed is ~a dozen jobs; Jobicy by category is the useful one.
- 2026-10-29: Adzuna returns only ~500 characters per offer, so many Adzuna offers show "Fit: n/a" and few tags;
  JSearch and career pages give full descriptions.
- 2026-10-29: Interface translation: English is the source language and the key (js/i18n-fr.js maps English → French,
  missing keys fall back to English); no i18n library, no build step. Switching language reloads the page. The choice
  is kept in this browser only ("hk.lang"), not in the profile, to avoid a migration. CSV columns and .ics files stay English.
- 2026-10-29: Salary (3.1): read from the provider's field (France Travail, Adzuna, JSearch, Jobicy, Remotive) or from
  the description, in the browser (js/salary.js). Company figures, bonuses and benefits are ignored. Yearly amount =
  12 months, 218 days, 1,607 hours (French references). The "≥ N k€" filter compares euros only (no currency
  conversion); Adzuna estimates are marked "≈". Rights tip based on EU directive 2023/970 (France: expected 2027).
- 2026-10-29: CV tailoring (5.2): owner chose a copy-paste prompt first (the CV never leaves the browser through
  HelloKhedma). In-app AI comes later, for signed-in users only, with a per-account daily limit and an explicit notice
  each time before the CV and offer are sent to Claude.
- 2026-10-29: In-app AI rewrite (5.2): Claude Opus 5.5 (the recommended default; CV_TAILOR_MODEL can switch to
  claude-sonnet-5-5 at about half the cost), effort medium, server-side refusal fallback on. Plain-text answer in four
  sections rather than structured output. Daily limit counted before the call (failed calls count) to bound costs.
  Privacy policy (FR + EN) lists Anthropic as a processor; the CV leaves the browser only on that confirmed click.
- 2026-10-30: Review of jobicy.com added 2.8, 3.8–3.9, 4.4b, 4.7, 5.5 and widened 3.1 and 5.1. Not copied: talent
  profiles, company directory, cost-of-living guides, employer job posting and ads (outside a path coach that puts
  privacy first); browser autofill extension (too large for now).
- 2026-10-30: LinkedIn (3.10): no API connection. "Sign In with LinkedIn" (OpenID) only gives name, email and photo;
  positions and skills need LinkedIn partner programs, closed to small apps; scraping breaks LinkedIn's terms. Use the
  user's own "Save to PDF" or data export, read in the browser.
- 2026-11-08: Owner chose to make AI Engineer a 6th career path (id "ai") whose courses are the AI engineer track, and
  to offer the track in English and French as well as Derja: English or French follow the interface language by
  default, with a switch to Derja in Arabic letters or 3arbizi. The Derja (Arabic letters) files stay the reference.
