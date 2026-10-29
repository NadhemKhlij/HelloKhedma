# HelloKhedma

## Project overview
A multi-path job hunting web app targeting Data Engineers, Business Analysts,
Application Support and Data Analysts. The selected path adapts the job search,
trainings, tools, tips and ATS keywords. Includes an interactive Kanban tracker.

## Tech stack
- Frontend: HTML5, Tailwind CSS 3 (compiled from css/input.css to css/app.css by `npm run build`),
  vanilla JavaScript (ES modules, no bundler). js/config.js is generated from env vars on the host.
- Backend / database: Supabase (PostgreSQL, Auth, Row Level Security, Edge Functions)
- Job data: Adzuna and RapidAPI JSearch, called ONLY from the `job-search` Edge Function

## Rules for Claude Code
- Keep the UI responsive and clean (HelloKhedma dark theme / modern aesthetic).
- When modifying code, keep persistence intact: guests use localStorage, signed-in users use Supabase,
  and guest data is imported into Supabase on first sign-in (see js/store.js).
- Never hardcode mock data permanently. Path content lives in the database
  (career_paths, path_resources, training_tracks, training_steps); edit supabase/seed.sql, not the JS.
- Skill courses and cheat sheets are static JSON in content/courses/ (index.json + one file per course), published
  with the site. Keep index.json lessonCount in sync, and use skill names that exist in js/ats.js so missing
  skills link to the course. Course text is rendered with h() (textContent), never as HTML.
- Never put API keys (RapidAPI, Adzuna) or the Supabase service_role key in frontend code.
  The anon key is public by design; RLS protects the data.
- Every user-owned table needs RLS policies scoped to auth.uid(). Add new tables via a new migration file.
- Build DOM with the h() helper (textContent), never innerHTML with remote data.

## Layout
- index.html            page shell: top bar + nav, one <section data-page="..."> per page
                        (home, offers, training, cv, applications), shown by the hash router in js/app.js
- css/input.css         Tailwind source + component classes (css/app.css is generated, gitignored)
- scripts/write-config.mjs  writes js/config.js from SUPABASE_URL / SUPABASE_ANON_KEY at build time
- .github/workflows/deploy.yml  builds and publishes index.html, css/, js/ to GitHub Pages on push to main
- js/app.js             wiring, state, hash routes (#/, #/offers, #/training, #/cv, #/applications),
                        rendering of home summary / paths / learn / search
- js/store.js           LocalStore + CloudStore (same interface) + guest import
- js/tracker.js         Kanban board (drag and drop + arrow buttons)
- js/jobs.js            calls the job-search function; fallback deep links
- js/ats.js             skills dictionary (EN + FR aliases) + extraction, CV ↔ offer matching, PDF/TXT CV reading (pdf.js from cdnjs).
                        The CV text is stored only in localStorage ("hk.cv.text"); never send it to Supabase.
- js/courses.js         course list (Training page) and course page (#/course/<id>), lesson progress in localStorage
- content/courses/      course content JSON (see the header of js/courses.js for the format)
- ROADMAP.md            product roadmap
- js/auth.js            auth dialog (password, sign up, magic link)
- supabase/migrations   schema + RLS
- supabase/seed.sql     paths, learning tracks + steps, tools, tips, keywords (idempotent)
- scripts/check-links.mjs   checks every URL in seed.sql (node 18+)
- supabase/functions/job-search   Edge Function proxy for Adzuna / JSearch
