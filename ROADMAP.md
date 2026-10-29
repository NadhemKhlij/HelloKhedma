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
| # | Item | Why | Effort |
|---|---|---|---|
| 1.1 | Custom email (Resend/Brevo SMTP) + "Confirm email" back on | Sign-up emails reach real people | S |
| 1.2 | Privacy policy, *mentions légales*, cookie-free analytics (Plausible/Umami) | Required in the EU; know what is used | S |
| 1.3 | Account page: delete my account, export my data (JSON/CSV) | GDPR rights, user trust | M |
| 1.4 | Source attribution ("Jobs by Adzuna", JSearch) | Provider terms | S |
| 1.5 | Error monitoring (Sentry free tier) + friendly error states | Know when something breaks before users tell you | S |
| 1.6 | Custom domain (hellokhedma.com), social preview image, SEO meta | Credibility, shareable links | S |
| 1.7 | French / English interface | Main audience is French-speaking | M |
| 1.8 | Installable app (PWA) with offline tracker and courses | Feels like an app on the phone | M |
| 1.9 | Accessibility pass (keyboard, contrast in both themes, screen reader labels) | Usable by everyone | S |

## Phase 2: a tracker that actually manages the hunt
| # | Item | Why | Effort |
|---|---|---|---|
| 2.1 | Notes, salary, contact person, next action per application | Everything about an application in one card | M |
| 2.2 | Follow-up dates + reminders (email, daily digest) | The #1 reason applications die: no follow-up | M |
| 2.3 | Interview dates + "add to calendar" (.ics) | No missed interviews | S |
| 2.4 | Timeline per application (moved to Applied on…, Interview on…) | See how long things take | S |
| 2.5 | Dashboard: applications/week, response rate, interview rate, weekly goal | Motivation and honest feedback on the strategy | M |
| 2.6 | CSV export / import | Bring an existing spreadsheet in, take data out | S |
| 2.7 | Attach the CV version + cover letter used per application | Know what was sent to whom | M |

## Phase 3: find better offers faster
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
- Split `js/app.js` into one module per page as it grows.
- Database backups (Supabase Pro) once real users rely on it.
- Watch API quotas and the rate limits in the Supabase dashboard.
