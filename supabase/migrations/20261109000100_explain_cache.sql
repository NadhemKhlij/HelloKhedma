-- Saved "Explain my mistake" answers shared between learners (ROADMAP 4b row 4c), for fixed-choice exercises only
-- (choice, order, match, groups, bug): the same wrong option on the same exercise gets the saved explanation at once,
-- without a Claude call and without counting in the daily limit.
-- A row holds no account id and no free text from a learner: the key is a SHA-256 hash of everything sent to Claude
-- (model, instructions, exercise, the option picked, the language), so a row only ever answers that exact request and
-- a course edit or prompt change makes new rows. Written and read only by the explain-mistake Edge Function
-- (service role): RLS on, no policy, so the anon and authenticated roles can neither read nor write it.
-- Rows unused for 180 days are deleted by the function. Also adds the usage kind 'explain_saved' (answers served from
-- this table, admin page). Safe to run more than once.
create table if not exists public.explain_cache (
  key        text primary key check (key ~ '^[0-9a-f]{64}$'),
  kind       text not null check (kind in ('choice', 'order', 'match', 'groups', 'bug')),
  lang       text not null check (lang in ('en', 'fr', 'ar', 'lat')),
  text       text not null check (length(text) <= 20000),
  model      text not null,
  created_at timestamptz not null default now(),
  used_at    timestamptz not null default now()
);
alter table public.explain_cache enable row level security;
revoke all on public.explain_cache from anon, authenticated;
create index if not exists explain_cache_used_at on public.explain_cache (used_at);

alter table public.usage_daily drop constraint if exists usage_daily_kind_check;
alter table public.usage_daily add constraint usage_daily_kind_check
  check (kind in ('job_search', 'cv_tailor', 'explain', 'explain_saved'));
