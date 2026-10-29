-- Which CV version was sent for each application (ROADMAP 2.7).
-- Only the version's name is stored (e.g. "CV Business Analyst"): the CV text itself never leaves the browser.
-- Safe to run more than once.

alter table public.applications
  add column if not exists cv_version text not null default '';
