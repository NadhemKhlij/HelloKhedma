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
response rate per CV, CSV column; signed-in sync needs migration O13). Still to do: 2.2 email reminders, cover letter per
application (2.7b).

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

## Phase 3: find better offers faster
Done (2026-10-29): 3.1 contract and remote filters (detected from the offer text; salary/date filters still to do),
3.3 hide / "not interested", seen marker, "Tracked ✓", 3.4 minimum CV-fit filter, saved searches (this browser; email alerts still to do).
Done (2026-10-29): "Companies I follow" (career pages on Greenhouse, Lever, Ashby, Workable, SmartRecruiters; full descriptions,
"New since last visit"). Done (2026-10-29): "Remote jobs" tab (Jobicy by category + Remotive; Himalayas blocks browser
calls and Arbeitnow has no search, so they are not used). Next sources to consider: Jooble / Careerjet
(key on request, France + Tunisia), La Bonne Alternance, Recruitee / Teamtailor career pages, syncing the watchlist to the account.
Done (2026-10-29): 3.7 several CV versions (named, one can be linked to each path and becomes active with it; switch
the scoring CV on the Offers page; the CV match compares every version). Local only, like the CV itself.

| # | Item | Why | Effort |
|---|---|---|---|
| 3.1 | Filters: contract type, remote, salary, date posted, seniority | Cut noise | M |
| 3.2 | Saved searches + email alerts for new matching offers | The app works while you sleep | M |
| 3.3 | Hide / "not interested", mark as seen, no duplicates across sources | Never read the same offer twice | S |
| 3.4 | Minimum fit filter ("show offers ≥ 60% fit") | Focus on realistic applications | S |
| 3.5 | Spontaneous applications: companies likely to hire (France Travail "La Bonne Boite", available on your account) | Hidden job market | M |
| 3.6 | Salary and demand by job and region (France Travail "Marché du travail", available on your account) | Negotiate and target regions with data | M |
| 3.7 | Several CV versions (one per path) and pick which one scores offers | Different roles, different CVs | M |

## Phase 4: learning that leads to a job
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
| 4.5 | Portfolio project briefs per path with evaluation checklist | Proof beats certificates | M |
| 4.6 | Certifications tracker (planned, booked, passed) | Clear goals | S |

## Phase 5: apply faster with AI (Claude API through an Edge Function)
| # | Item | Why | Effort |
|---|---|---|---|
| 5.1 | Cover letter draft tailored to an offer + your CV | Hours saved per week | M |
| 5.2 | CV tailoring suggestions per offer (which skills to put forward, honest rewording) | Better match without lying | M |
| 5.3 | Mock interview chat for a given offer | Practice anytime | M |
| 5.4 | Smarter skill extraction (synonyms, seniority, must-have vs nice-to-have) | Better fit scores | M |
Note: these have a cost per use; add per-user limits (like the search rate limit) before launching them.

## Phase 6: grow
| # | Item | Why | Effort |
|---|---|---|---|
| 6.1 | More paths (DevOps, Product Owner, Cybersecurity, QA, Cloud…) | More audience | M each |
| 6.2 | Admin page to edit paths, tracks and courses without SQL | Content updates without a developer | L |
| 6.3 | Premium plan (AI features, alerts) | Pays for APIs | L |
| 6.4 | Mentors / referrals / community | Network effects | L |

## Engineering hygiene (ongoing)
- Smoke tests (Playwright) in the GitHub workflow before each deploy.
- Done (2026-10-29): js/app.js split into one module per page (state, router, home, offers, training, cvpage,
  applications, account); app.js keeps start-up, path selection and sign-in (~200 lines).
- Sync the data that is still local-only to the account: followed companies, saved searches, hidden/seen offers,
  lesson progress, interview ratings and STAR stories, weekly goal (needs a migration with RLS per table). CV versions stay local by design.
- Self-host the Bricolage Grotesque font instead of Google Fonts (removes a third party from the privacy policy).
- Database backups (Supabase Pro) once real users rely on it.
- Watch API quotas (JSearch free plan, Adzuna) and the rate limits in the Supabase dashboard.
- supabase/setup-all.sql (one-shot setup for a new project) stops at the first three migrations: add the two
  20261029 migrations to it.

## Decisions log (so they are not reopened by accident)
- 2026-10-29: Courses and interview content are static JSON in content/ (deployed with the site), not database rows.
- 2026-10-29: The CV text never leaves the browser (localStorage only), even for signed-in users.
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
