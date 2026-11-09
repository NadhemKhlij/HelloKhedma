-- French job titles per career path (owner request 2026-11-09): what French recruiters write in their offers. When the
-- search country is France, the Offers page lists them first and searches the French title together with the English
-- one (job-search function: Adzuna twice, JSearch with OR); see js/offers.js. Filled by supabase/seed.sql (run it after
-- this migration). Safe to run more than once.
alter table public.career_paths add column if not exists job_titles_fr text[] not null default '{}';
