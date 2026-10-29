-- French texts for the career-path content (ROADMAP 1.7b). The English columns stay the source and the key
-- (resource and step ids are derived from the English titles), so progress is never reset by a translation.
-- Filled by the French block at the end of seed.sql; the app falls back to English when a value is null.
-- Skill keywords and job titles have no French column: CV matching and the offer search rely on them.
-- Safe to run more than once.

alter table public.career_paths
  add column if not exists name_fr  text,
  add column if not exists blurb_fr text;

alter table public.path_resources
  add column if not exists title_fr       text,
  add column if not exists description_fr text;

alter table public.training_tracks
  add column if not exists title_fr   text,
  add column if not exists summary_fr text,
  add column if not exists outcome_fr text;

alter table public.training_steps
  add column if not exists title_fr       text,
  add column if not exists description_fr text;
