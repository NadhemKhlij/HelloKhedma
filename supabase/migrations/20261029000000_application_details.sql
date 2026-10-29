-- Tracker 2.0: details per application, follow-ups, interviews and a stage history.
-- Safe to run more than once. Existing rows get an empty history.

alter table public.applications
  add column if not exists salary        text not null default '',
  add column if not exists contact       text not null default '',   -- recruiter / referral: name, email, LinkedIn
  add column if not exists next_action   text not null default '',   -- e.g. "Send follow-up email"
  add column if not exists follow_up_on  date,                       -- reminder date for next_action
  add column if not exists interview_at  timestamptz,
  add column if not exists history       jsonb not null default '[]'::jsonb;  -- [{ "stage": "applied", "at": "2026-10-29T..." }]

create index if not exists applications_follow_up on public.applications (user_id, follow_up_on);
