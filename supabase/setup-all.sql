-- HelloKhedma: one-shot setup for the Supabase SQL Editor on a NEW, empty project.
-- Same content as every migration in supabase/migrations + seed.sql, in order. Run it once; afterwards re-run only seed.sql.
-- (If you use the Supabase CLI, run 'supabase db push' + seed.sql instead of this file.)
-- Regenerate it after adding a migration or editing seed.sql: concatenate the files in the same order.

-- ================= supabase/migrations/20261028000000_init.sql =================

-- HelloKhedma: initial schema

create type public.resource_kind as enum ('training', 'tool', 'tip', 'keyword');
create type public.application_stage as enum ('saved', 'applied', 'interview', 'offer', 'rejected');

-- Public content (edit in seed.sql or the Supabase dashboard) ------------------
create table public.career_paths (
  id          text primary key,
  name        text not null,
  blurb       text not null default '',
  color       text not null default '#7c5cff',
  job_titles  text[] not null default '{}',
  sort_order  int not null default 0
);

create table public.path_resources (
  id          uuid primary key default gen_random_uuid(),
  path_id     text not null references public.career_paths(id) on delete cascade,
  kind        public.resource_kind not null,
  title       text not null,
  description text not null default '',
  url         text,
  sort_order  int not null default 0
);
create index path_resources_lookup on public.path_resources (path_id, kind, sort_order);

-- User-owned data ----------------------------------------------------------------
create table public.profiles (
  user_id       uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  selected_path text references public.career_paths(id) on delete set null,
  location      text not null default '',
  updated_at    timestamptz not null default now()
);

create table public.applications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  path_id     text references public.career_paths(id) on delete set null,
  title       text not null,
  company     text not null default '',
  location    text not null default '',
  url         text,
  source      text,
  external_id text,
  stage       public.application_stage not null default 'saved',
  notes       text not null default '',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index applications_user_stage on public.applications (user_id, stage);
-- one tracked card per job offer per user
create unique index applications_unique_offer
  on public.applications (user_id, source, external_id) where external_id is not null;

create table public.training_progress (
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  resource_id uuid not null references public.path_resources(id) on delete cascade,
  done        boolean not null default true,
  updated_at  timestamptz not null default now(),
  primary key (user_id, resource_id)
);

-- updated_at trigger -------------------------------------------------------------
create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
create trigger applications_touch before update on public.applications
  for each row execute function public.touch_updated_at();
create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();

-- Row Level Security -------------------------------------------------------------
alter table public.career_paths      enable row level security;
alter table public.path_resources    enable row level security;
alter table public.profiles          enable row level security;
alter table public.applications      enable row level security;
alter table public.training_progress enable row level security;

create policy "paths are public" on public.career_paths
  for select to anon, authenticated using (true);
create policy "resources are public" on public.path_resources
  for select to anon, authenticated using (true);

create policy "own profile" on public.profiles for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "own applications" on public.applications for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "own progress" on public.training_progress for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- ================= supabase/migrations/20261028000100_training_tracks.sql =================

-- Structured learning tracks: track (level) -> ordered steps (learn / practice / project / certification).
-- Replaces the flat 'training' rows in path_resources and the old training_progress table.

create type public.training_level as enum ('beginner', 'intermediate', 'advanced');
create type public.step_kind as enum ('learn', 'practice', 'project', 'certification');

create table public.training_tracks (
  id         text primary key,                       -- e.g. 'de-foundations'
  path_id    text not null references public.career_paths(id) on delete cascade,
  title      text not null,
  summary    text not null default '',
  outcome    text not null default '',               -- "You will be able to ..."
  level      public.training_level not null,
  sort_order int not null default 0
);
create index training_tracks_path on public.training_tracks (path_id, sort_order);

create table public.training_steps (
  id          uuid primary key default gen_random_uuid(),
  track_id    text not null references public.training_tracks(id) on delete cascade,
  title       text not null,
  description text not null default '',
  kind        public.step_kind not null default 'learn',
  provider    text not null default '',
  url         text,
  est_hours   numeric(5,1) not null default 1,       -- rough estimate
  is_free     boolean not null default true,
  sort_order  int not null default 0
);
create index training_steps_track on public.training_steps (track_id, sort_order);

create table public.step_progress (
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  step_id    uuid not null references public.training_steps(id) on delete cascade,
  done       boolean not null default true,
  updated_at timestamptz not null default now(),
  primary key (user_id, step_id)
);

alter table public.training_tracks enable row level security;
alter table public.training_steps  enable row level security;
alter table public.step_progress   enable row level security;

create policy "tracks are public" on public.training_tracks
  for select to anon, authenticated using (true);
create policy "steps are public" on public.training_steps
  for select to anon, authenticated using (true);
create policy "own step progress" on public.step_progress for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- Retire the old flat trainings
delete from public.path_resources where kind = 'training';
drop table public.training_progress;

-- ================= supabase/migrations/20261028000200_job_search_guard.sql =================

-- Protects the job API quotas: a result cache and a fixed-window rate limit for the job-search function.
-- Only the Edge Function (service_role) touches these tables; RLS is on with no policies, so the
-- anon and authenticated roles cannot read or write them.

create table public.job_search_cache (
  key        text primary key,                       -- provider|country|query|location|page
  results    jsonb not null,                         -- { jobs, warnings }
  created_at timestamptz not null default now()
);
create index job_search_cache_age on public.job_search_cache (created_at);

create table public.job_search_hits (
  bucket       text primary key,                     -- 'user:<uuid>' or 'ip:<address>'
  window_start timestamptz not null default now(),
  hits         int not null default 1
);

alter table public.job_search_cache enable row level security;
alter table public.job_search_hits  enable row level security;

-- Counts one search for a bucket and returns true while it is within the limit.
create or replace function public.job_search_hit(p_bucket text, p_limit int, p_window_seconds int)
returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  n int;
begin
  insert into public.job_search_hits as h (bucket, window_start, hits)
  values (p_bucket, now(), 1)
  on conflict (bucket) do update set
    hits = case when h.window_start < now() - make_interval(secs => p_window_seconds) then 1 else h.hits + 1 end,
    window_start = case when h.window_start < now() - make_interval(secs => p_window_seconds) then now() else h.window_start end
  returning hits into n;
  return n <= p_limit;
end;
$$;

revoke execute on function public.job_search_hit(text, int, int) from public, anon, authenticated;
grant execute on function public.job_search_hit(text, int, int) to service_role;

-- ================= supabase/migrations/20261029000000_application_details.sql =================

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

-- ================= supabase/migrations/20261029000100_application_cv.sql =================

-- Which CV version was sent for each application (ROADMAP 2.7).
-- Only the version's name is stored (e.g. "CV Business Analyst"): the CV text itself never leaves the browser.
-- Safe to run more than once.

alter table public.applications
  add column if not exists cv_version text not null default '';

-- ================= supabase/migrations/20261029000200_content_fr.sql =================

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

-- ================= supabase/migrations/20261106000000_cv_sync_insights.sql =================

-- Two opt-in features chosen by the owner on 2026-11-06 (privacy policy updated the same day, both languages).
--
-- 1. cv_sync: "Save my CVs to my account" (js/cvsync.js), off by default. One row per user who turned it on: the row's
--    existence is the switch. It holds the CV versions (localStorage "hk.cvs"), the active version id and the CV maker
--    draft ("hk.cvmaker"), merged per version between devices. RLS: a user reads and writes only their own row. The row is deleted when the user turns the
--    switch off, and with the account (on delete cascade).
--
-- 2. insights_events: "Help improve HelloKhedma" (js/insights.js), anonymous statistics sent only after the user said
--    yes. No user id, no IP address, the day only (no time). Written only through log_insight(), which validates,
--    trims and caps the input; RLS on with no policy, so the anon and user keys can neither read nor write the table.
--    The owner reads the insights_* views in the Supabase dashboard (SQL editor). Rows older than 2 years are deleted.

-- 1. CV sync ---------------------------------------------------------------------------------------------------------
create table public.cv_sync (
  user_id    uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  versions   jsonb not null default '[]'::jsonb,   -- [{ id, name, text, path_id, updated_at }]
  active_id  text,
  maker      jsonb,                                -- CV maker draft
  deleted_ids jsonb not null default '[]'::jsonb,  -- ids of versions deleted on a device (so a merge does not bring them back)
  updated_at timestamptz not null default now(),
  constraint cv_sync_versions_array check (jsonb_typeof(versions) = 'array'),
  constraint cv_sync_size check (pg_column_size(versions) + coalesce(pg_column_size(maker), 0) < 1000000)
);
alter table public.cv_sync enable row level security;
create policy "own cv sync" on public.cv_sync for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- 2. Anonymous insights -----------------------------------------------------------------------------------------------
create table public.insights_events (
  id      bigint generated always as identity primary key,
  day     date not null default current_date,
  kind    text not null check (kind in ('offer_skills', 'gaps', 'course_done')),
  path_id text check (path_id is null or char_length(path_id) <= 20),
  items   text[] not null default '{}' check (cardinality(items) <= 40)
);
create index insights_events_day on public.insights_events (day);
alter table public.insights_events enable row level security; -- no policy on purpose

-- kind: 'offer_skills' (skills an offer asks for), 'gaps' (those missing from the CV), 'course_done' (course id).
-- At most 20,000 events a day in total, to bound abuse of this anonymous endpoint.
create or replace function public.log_insight(p_kind text, p_path text, p_items text[])
returns void
language plpgsql security definer set search_path = '' as $$
begin
  if p_kind not in ('offer_skills', 'gaps', 'course_done') then return; end if;
  if (select count(*) from public.insights_events where day = current_date) >= 20000 then return; end if;
  insert into public.insights_events (kind, path_id, items)
  values (p_kind, left(nullif(p_path, ''), 20),
    coalesce((select array_agg(left(x, 60)) from unnest((p_items)[1:40]) as x where x is not null and x <> ''), '{}'));
  delete from public.insights_events where day < current_date - 730;
end;
$$;
revoke execute on function public.log_insight(text, text, text[]) from public;
grant execute on function public.log_insight(text, text, text[]) to anon, authenticated;

-- Owner's views (dashboard only): what offers ask for, what CVs lack, which courses get finished, last 90 days.
create view public.insights_offer_skills with (security_invoker = true) as
  select path_id, skill, count(*) as offers
  from public.insights_events, unnest(items) as skill
  where kind = 'offer_skills' and day > current_date - 90
  group by path_id, skill order by offers desc;
create view public.insights_skill_gaps with (security_invoker = true) as
  select path_id, skill, count(*) as times_missing
  from public.insights_events, unnest(items) as skill
  where kind = 'gaps' and day > current_date - 90
  group by path_id, skill order by times_missing desc;
create view public.insights_courses_done with (security_invoker = true) as
  select items[1] as course_id, path_id, count(*) as finished
  from public.insights_events
  where kind = 'course_done' and day > current_date - 90
  group by items[1], path_id order by finished desc;
revoke all on public.insights_offer_skills, public.insights_skill_gaps, public.insights_courses_done from anon, authenticated;

-- ================= supabase/migrations/20261106000100_learning_sync_reports.sql =================

-- Training step 1 (owner request 2026-11-06; privacy policy updated the same day, both languages).
--
-- 1. learning_sync: learning progress of signed-in users, synced between their devices (js/learnsync.js): lessons
--    done, quiz best scores, flashcards known, exercises solved, project steps, XP / streak days, last course,
--    interview ratings, STAR stories and checklist, study and application goals. One row per user: data holds the
--    stored values by key ({ "hk.lessons": "<json>", … }), stamps the time each key last changed. RLS: own row only.
--    Deleted with the account (on delete cascade). CVs are NOT here (opt-in cv_sync).
--
-- 2. content_reports: "Report a problem" on lessons, exercises, quizzes… (js/courses.js). The course, the part, its
--    position, the language and the user's message; no account id, no IP. Written only through report_content()
--    (validates, caps); RLS on with no policy, so nobody can read it with the anon or user keys. The owner reads the
--    content_reports_open view in the dashboard and marks rows done (update status). Reports are kept 1 year at most.

-- 1. Learning progress -------------------------------------------------------------------------------------------------
create table public.learning_sync (
  user_id    uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  data       jsonb not null default '{}'::jsonb,
  stamps     jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  constraint learning_sync_objects check (jsonb_typeof(data) = 'object' and jsonb_typeof(stamps) = 'object'),
  constraint learning_sync_size check (pg_column_size(data) < 2000000)
);
alter table public.learning_sync enable row level security;
create policy "own learning sync" on public.learning_sync for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- 2. Content reports ---------------------------------------------------------------------------------------------------
create table public.content_reports (
  id         bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  course_id  text not null check (char_length(course_id) between 1 and 80),
  part       text not null check (part in ('lesson', 'exercise', 'quiz', 'flashcard', 'interview', 'cheatsheet', 'project', 'other')),
  position   int check (position is null or position between 0 and 999),
  lang       text check (lang is null or char_length(lang) <= 5),
  message    text not null check (char_length(message) between 3 and 1000),
  status     text not null default 'new' check (status in ('new', 'done', 'ignored'))
);
create index content_reports_new on public.content_reports (status, created_at);
alter table public.content_reports enable row level security; -- no policy on purpose

-- At most 300 reports a day in total, to bound abuse of this anonymous endpoint.
create or replace function public.report_content(p_course text, p_part text, p_position int, p_lang text, p_message text)
returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  if p_part not in ('lesson', 'exercise', 'quiz', 'flashcard', 'interview', 'cheatsheet', 'project', 'other') then return false; end if;
  if char_length(coalesce(trim(p_message), '')) < 3 or char_length(coalesce(p_course, '')) = 0 then return false; end if;
  if (select count(*) from public.content_reports where created_at > now() - interval '1 day') >= 300 then return false; end if;
  insert into public.content_reports (course_id, part, position, lang, message)
  values (left(p_course, 80), p_part, case when p_position between 0 and 999 then p_position end, left(p_lang, 5), left(trim(p_message), 1000));
  delete from public.content_reports where created_at < now() - interval '365 days'; -- kept 1 year at most
  return true;
end;
$$;
revoke execute on function public.report_content(text, text, int, text, text) from public;
grant execute on function public.report_content(text, text, int, text, text) to anon, authenticated;

-- Owner's view (dashboard only): reports to look at, newest first.
create view public.content_reports_open with (security_invoker = true) as
  select id, created_at, course_id, part, position + 1 as number, lang, message
  from public.content_reports where status = 'new' order by created_at desc;
revoke all on public.content_reports_open from anon, authenticated;

-- ================= supabase/migrations/20261106000200_admin_stats.sql =================

-- Admin statistics page (#/admin, js/admin.js), 2026-11-06.
-- - admins: the accounts allowed to read the statistics (added by hand, see the end of this file). RLS on, no policy:
--   nobody reads or writes it through the API; only the security-definer functions below look at it.
-- - usage_daily: anonymous daily counters (day, kind, count; no account, no IP), bumped by the job-search and cv-tailor
--   Edge Functions through count_usage() (service role only).
-- - is_admin(): true for an admin (used by the app to show the Admin link and page).
-- - admin_stats(): one JSON object with totals only (no email, no name, no CV text), for admins; anyone else gets an
--   error 42501. admin_report_status(): an admin marks a problem report done or ignored.
-- Safe to run twice.

create table if not exists public.admins (
  user_id  uuid primary key references auth.users(id) on delete cascade,
  added_at timestamptz not null default now()
);
alter table public.admins enable row level security; -- no policy on purpose

create table if not exists public.usage_daily (
  day  date not null default current_date,
  kind text not null check (kind in ('job_search', 'cv_tailor')),
  n    integer not null default 0,
  primary key (day, kind)
);
alter table public.usage_daily enable row level security; -- no policy on purpose

create or replace function public.count_usage(p_kind text)
returns void language sql security definer set search_path = '' as $$
  insert into public.usage_daily (day, kind, n) values (current_date, p_kind, 1)
  on conflict (day, kind) do update set n = public.usage_daily.n + 1;
$$;
revoke all on function public.count_usage(text) from public, anon, authenticated;
grant execute on function public.count_usage(text) to service_role;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;
revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

create or replace function public.admin_stats()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  result jsonb;
begin
  if not public.is_admin() then
    raise exception 'admin only' using errcode = '42501';
  end if;
  select jsonb_build_object(
    'generated_at', now(),
    'accounts', (select jsonb_build_object(
        'total', count(*),
        'confirmed', count(*) filter (where email_confirmed_at is not null),
        'new_7d', count(*) filter (where created_at > now() - interval '7 days'),
        'new_30d', count(*) filter (where created_at > now() - interval '30 days'),
        'active_7d', count(*) filter (where last_sign_in_at > now() - interval '7 days'),
        'active_30d', count(*) filter (where last_sign_in_at > now() - interval '30 days'))
      from auth.users),
    'signups_weekly', coalesce((select jsonb_agg(jsonb_build_object('week', w.week, 'n', w.n) order by w.week)
      from (select date_trunc('week', created_at)::date as week, count(*) as n from auth.users
            where created_at > now() - interval '12 weeks' group by 1) w), '[]'::jsonb),
    'applications', (select jsonb_build_object(
        'total', count(*),
        'accounts', count(distinct user_id),
        'by_stage', coalesce((select jsonb_object_agg(stage, n) from
          (select stage::text as stage, count(*) as n from public.applications group by 1) s), '{}'::jsonb))
      from public.applications),
    'paths', coalesce((select jsonb_agg(jsonb_build_object('path_id', p.path_id, 'n', p.n) order by p.n desc)
      from (select selected_path as path_id, count(*) as n from public.profiles where selected_path is not null group by 1) p), '[]'::jsonb),
    'cv_sync_accounts', (select count(*) from public.cv_sync),
    'learning_sync_accounts', (select count(*) from public.learning_sync),
    'usage_daily', coalesce((select jsonb_agg(jsonb_build_object('day', day, 'kind', kind, 'n', n) order by day)
      from public.usage_daily where day > current_date - 30), '[]'::jsonb),
    'insights', jsonb_build_object(
      'events_90d', (select count(*) from public.insights_events where day > current_date - 90),
      'gaps', coalesce((select jsonb_agg(jsonb_build_object('skill', g.skill, 'n', g.n) order by g.n desc, g.skill)
        from (select skill, count(*) as n from public.insights_events, unnest(items) as skill
              where kind = 'gaps' and day > current_date - 90 group by skill order by count(*) desc, skill limit 10) g), '[]'::jsonb),
      'offer_skills', coalesce((select jsonb_agg(jsonb_build_object('skill', g.skill, 'n', g.n) order by g.n desc, g.skill)
        from (select skill, count(*) as n from public.insights_events, unnest(items) as skill
              where kind = 'offer_skills' and day > current_date - 90 group by skill order by count(*) desc, skill limit 10) g), '[]'::jsonb),
      'courses_done', coalesce((select jsonb_agg(jsonb_build_object('course_id', c.course_id, 'n', c.n) order by c.n desc, c.course_id)
        from (select items[1] as course_id, count(*) as n from public.insights_events
              where kind = 'course_done' and day > current_date - 90 group by 1 order by count(*) desc, 1 limit 10) c), '[]'::jsonb)),
    'reports', jsonb_build_object(
      'open', (select count(*) from public.content_reports where status = 'new'),
      'items', coalesce((select jsonb_agg(to_jsonb(r) order by r.created_at desc)
        from (select id, created_at, course_id, part, position, lang, message from public.content_reports
              where status = 'new' order by created_at desc limit 50) r), '[]'::jsonb))
  ) into result;
  return result;
end;
$$;
revoke all on function public.admin_stats() from public, anon;
grant execute on function public.admin_stats() to authenticated;

create or replace function public.admin_report_status(p_id bigint, p_status text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then
    raise exception 'admin only' using errcode = '42501';
  end if;
  if p_status not in ('new', 'done', 'ignored') then
    raise exception 'bad status' using errcode = '22023';
  end if;
  update public.content_reports set status = p_status where id = p_id;
end;
$$;
revoke all on function public.admin_report_status(bigint, text) from public, anon;
grant execute on function public.admin_report_status(bigint, text) to authenticated;

-- Make yourself admin (once, in the SQL editor, with the e-mail you sign in with):
--   insert into public.admins (user_id) select id from auth.users where email = 'you@example.com' on conflict do nothing;

-- ================= supabase/migrations/20261106000300_ai_usage.sql =================

-- Claude API usage on the admin page (#/admin, js/admin.js), 2026-11-06.
-- - ai_usage_daily: tokens used by the cv-tailor function per day and model (calls, input, output, cache read, cache
--   write). Numbers only: no account, no CV text. Filled by count_ai_tokens() (service role only) after every Claude
--   reply. The admin page turns them into an estimated cost with Anthropic's price list.
-- - admin_settings: small key → JSON settings for the admin page; "claude_credit" = { amount_usd, since } (the owner's
--   last top-up), used to estimate the remaining credit (Anthropic has no API for the real balance).
-- - admin_ai_usage(): admins only (error 42501 otherwise): the credit setting and the usage rows since the top-up or
--   the last 30 days, whichever is longer. admin_set_credit(amount, since): admins only.
-- RLS on both tables with no policy: no direct API access. Safe to run twice.

create table if not exists public.ai_usage_daily (
  day          date not null default current_date,
  model        text not null check (char_length(model) between 1 and 80),
  calls        integer not null default 0,
  input_tokens bigint not null default 0,
  output_tokens bigint not null default 0,
  cache_read_tokens bigint not null default 0,
  cache_write_tokens bigint not null default 0,
  primary key (day, model)
);
alter table public.ai_usage_daily enable row level security; -- no policy on purpose

create table if not exists public.admin_settings (
  key        text primary key,
  value      jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.admin_settings enable row level security; -- no policy on purpose

create or replace function public.count_ai_tokens(p_model text, p_input bigint, p_output bigint, p_cache_read bigint, p_cache_write bigint)
returns void language sql security definer set search_path = '' as $$
  insert into public.ai_usage_daily as u (day, model, calls, input_tokens, output_tokens, cache_read_tokens, cache_write_tokens)
  values (current_date, left(coalesce(nullif(p_model, ''), 'unknown'), 80), 1,
          greatest(coalesce(p_input, 0), 0), greatest(coalesce(p_output, 0), 0),
          greatest(coalesce(p_cache_read, 0), 0), greatest(coalesce(p_cache_write, 0), 0))
  on conflict (day, model) do update set
    calls = u.calls + 1,
    input_tokens = u.input_tokens + excluded.input_tokens,
    output_tokens = u.output_tokens + excluded.output_tokens,
    cache_read_tokens = u.cache_read_tokens + excluded.cache_read_tokens,
    cache_write_tokens = u.cache_write_tokens + excluded.cache_write_tokens;
$$;
revoke all on function public.count_ai_tokens(text, bigint, bigint, bigint, bigint) from public, anon, authenticated;
grant execute on function public.count_ai_tokens(text, bigint, bigint, bigint, bigint) to service_role;

create or replace function public.admin_ai_usage()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  credit jsonb;
  since date;
begin
  if not public.is_admin() then
    raise exception 'admin only' using errcode = '42501';
  end if;
  select value into credit from public.admin_settings where key = 'claude_credit';
  since := least(current_date - 30, coalesce((credit->>'since')::date, current_date - 30));
  return jsonb_build_object(
    'credit', credit,
    'rows', coalesce((select jsonb_agg(to_jsonb(u) order by u.day, u.model)
      from public.ai_usage_daily u where u.day >= since), '[]'::jsonb));
end;
$$;
revoke all on function public.admin_ai_usage() from public, anon;
grant execute on function public.admin_ai_usage() to authenticated;

create or replace function public.admin_set_credit(p_amount numeric, p_since date)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then
    raise exception 'admin only' using errcode = '42501';
  end if;
  if p_amount is null or p_amount < 0 or p_amount > 100000 or p_since is null or p_since > current_date then
    raise exception 'bad credit' using errcode = '22023';
  end if;
  insert into public.admin_settings (key, value, updated_at)
  values ('claude_credit', jsonb_build_object('amount_usd', p_amount, 'since', p_since), now())
  on conflict (key) do update set value = excluded.value, updated_at = now();
end;
$$;
revoke all on function public.admin_set_credit(numeric, date) from public, anon;
grant execute on function public.admin_set_credit(numeric, date) to authenticated;

-- ================= supabase/migrations/20261108000100_email_reminders.sql =================

-- Opt-in e-mail reminders (ROADMAP 2.2): a daily e-mail with the follow-ups due and the interviews coming up, sent by
-- the follow-up-reminders Edge Function (scheduled by .github/workflows/reminders.yml). Off by default; the signed-in
-- user turns it on or off on the Account page. Safe to run more than once.
--   email_reminders    the user's choice
--   reminders_lang     language of the e-mail ('en' or 'fr', the interface language when it was turned on)
--   reminders_sent_on  last day a digest was sent (at most one a day)
--   reminders_test_on  last day "Send me a test e-mail now" was used (at most one a day)
-- The "own profile" RLS policy (init migration) already limits every row to its owner.
alter table public.profiles
  add column if not exists email_reminders   boolean not null default false,
  add column if not exists reminders_lang    text not null default 'en',
  add column if not exists reminders_sent_on date,
  add column if not exists reminders_test_on date;

do $$ begin
  alter table public.profiles add constraint profiles_reminders_lang check (reminders_lang in ('en', 'fr'));
exception when duplicate_object then null; end $$;

create index if not exists profiles_email_reminders on public.profiles (email_reminders) where email_reminders;

-- ================= supabase/migrations/20261108000200_usage_explain.sql =================

-- "Explain my mistake" (training step 4): the explain-mistake Edge Function bumps the anonymous daily counter
-- usage_daily with kind 'explain' (day + count only, like 'job_search' and 'cv_tailor'), shown on the admin page.
-- Until this migration runs, the function still works: its count_usage() call fails quietly. Safe to run more than once.
alter table public.usage_daily drop constraint if exists usage_daily_kind_check;
alter table public.usage_daily add constraint usage_daily_kind_check check (kind in ('job_search', 'cv_tailor', 'explain'));

-- ================= supabase/migrations/20261109000100_explain_cache.sql =================

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

-- ================= supabase/migrations/20261109000200_usage_ask.sql =================

-- "Ask about this lesson" (ROADMAP 4b step 4): the explain-mistake Edge Function (mode "ask") bumps the anonymous daily
-- counter usage_daily with kind 'ask_lesson' (day + count only), shown on the admin page. Until this migration runs, the
-- questions still work: the count_usage() call fails quietly. Keeps every earlier kind. Safe to run more than once.
alter table public.usage_daily drop constraint if exists usage_daily_kind_check;
alter table public.usage_daily add constraint usage_daily_kind_check
  check (kind in ('job_search', 'cv_tailor', 'explain', 'explain_saved', 'ask_lesson'));

-- ================= supabase/migrations/20261109000300_job_titles_fr.sql =================

-- French job titles per career path (owner request 2026-11-09): what French recruiters write in their offers. When the
-- search country is France, the Offers page lists them first and searches the French title together with the English
-- one (job-search function: Adzuna twice, JSearch with OR); see js/offers.js. Filled by supabase/seed.sql (run it after
-- this migration). Safe to run more than once.
alter table public.career_paths add column if not exists job_titles_fr text[] not null default '{}';

-- ================= supabase/migrations/20261109000400_usage_sources.sql =================

-- Job search savings (2026-11-09): the job-search Edge Function now saves each source's answer separately and counts,
-- per day, the source answers it took from the database ('source_saved') and the calls it made to a source
-- ('source_call'), shown on the admin page. count_usage_n() adds n at once (service role only). Until this migration
-- runs, searches still work: the counting fails quietly. Keeps every earlier kind. Safe to run more than once.
alter table public.usage_daily drop constraint if exists usage_daily_kind_check;
alter table public.usage_daily add constraint usage_daily_kind_check
  check (kind in ('job_search', 'cv_tailor', 'explain', 'explain_saved', 'ask_lesson', 'source_call', 'source_saved'));

create or replace function public.count_usage_n(p_kind text, p_n integer)
returns void language sql security definer set search_path = '' as $$
  insert into public.usage_daily (day, kind, n) values (current_date, p_kind, greatest(p_n, 0))
  on conflict (day, kind) do update set n = public.usage_daily.n + greatest(p_n, 0);
$$;
revoke all on function public.count_usage_n(text, integer) from public, anon, authenticated;
grant execute on function public.count_usage_n(text, integer) to service_role;

-- ================= supabase/seed.sql =================

-- Idempotent seed: safe to re-run. Resource ids are derived from (path, kind, title),
-- so user progress is kept when you edit descriptions, urls or ordering.
-- Tools: [title, description]
-- Tips and keywords: plain strings.  Avoid apostrophes inside the JSON strings.

create or replace function pg_temp.seed(p text, k public.resource_kind, items jsonb)
returns void language sql as $$
  insert into public.path_resources (id, path_id, kind, title, description, url, sort_order)
  select
    md5(p || ':' || k::text || ':' || coalesce(x.e->>0, x.e #>> '{}'))::uuid,
    p, k,
    coalesce(x.e->>0, x.e #>> '{}'),
    coalesce(x.e->>1, ''),
    case when x.e->>2 is not null
         then 'https://www.google.com/search?q=' || replace(x.e->>2, ' ', '+') end,
    x.ord::int
  from jsonb_array_elements(items) with ordinality as x(e, ord)
  on conflict (id) do update
    set description = excluded.description, url = excluded.url, sort_order = excluded.sort_order;
$$;

insert into public.career_paths (id, name, blurb, color, job_titles, sort_order) values
 ('de','Data Engineer','Pipelines, warehouses, cloud','#7c5cff',
   array['Data Engineer','Ingénieur Data','Analytics Engineer','Cloud Data Engineer'],1),
 ('ba','Business Analyst','Requirements, process, stakeholders','#18a999',
   array['Business Analyst','Analyste Métier','Functional Analyst','Product Analyst'],2),
 ('as','Application Support','Incidents, monitoring, run','#f08a24',
   array['Application Support Analyst','Support Applicatif','L2 Support Engineer','Production Support Engineer'],3),
 ('da','Data Analyst','Insights, dashboards, storytelling','#e0508b',
   array['Data Analyst','Analyste de Données','BI Analyst','Reporting Analyst'],4),
 ('do','DevOps Engineer','CI/CD, containers, cloud, automation','#3b82f6',
   array['DevOps Engineer','Ingénieur DevOps','Site Reliability Engineer','Platform Engineer','Cloud Engineer'],5),
 ('ai','AI Engineer','LLM apps, agents, RAG, evals','#16a34a',
   array['AI Engineer','Ingénieur IA','LLM Engineer','Generative AI Engineer','Applied AI Engineer'],6)
on conflict (id) do update set
  name = excluded.name, blurb = excluded.blurb, color = excluded.color,
  job_titles = excluded.job_titles, sort_order = excluded.sort_order;

-- French job titles (migration 20261109000300), paired with job_titles by position: job_titles_fr[i] is how French
-- recruiters write job_titles[i] (the same text when they use the English title). The Offers page shows each French
-- title once, with its English pair, when the country is France.
update public.career_paths set job_titles_fr = v.t from (values
  ('de', array['Ingénieur Data','Ingénieur Data','Analytics Engineer','Ingénieur Data Cloud']),
  ('ba', array['Business Analyst','Analyste Métier','Analyste Fonctionnel','Product Analyst']),
  ('as', array['Support Applicatif','Support Applicatif','Ingénieur Support N2','Ingénieur de Production']),
  ('da', array['Data Analyst','Analyste de Données','Analyste BI','Chargé de Reporting']),
  ('do', array['Ingénieur DevOps','Ingénieur DevOps','Ingénieur SRE','Ingénieur Plateforme','Ingénieur Cloud']),
  ('ai', array['Ingénieur IA','Ingénieur IA','Ingénieur LLM','Ingénieur IA Générative','Ingénieur IA Appliquée'])
) as v(id, t) where public.career_paths.id = v.id;

-- Data Engineer ---------------------------------------------------------------
select pg_temp.seed('de','tool','[
 ["PostgreSQL / DuckDB","Practice locally for free"],["Airflow or Dagster","Orchestration"],
 ["dbt Core","Transformations and tests"],["Docker","Reproducible environments"],
 ["GitHub","Portfolio of pipeline projects"]]'::jsonb);
select pg_temp.seed('de','tip','[
 "Build one end-to-end project: API, storage, transform, dashboard. Document it in the README.",
 "Show data quality checks and tests; recruiters look for reliability, not only tools.",
 "Quantify results on your CV: rows per day, runtime cut, cost saved."]'::jsonb);
select pg_temp.seed('de','keyword','["SQL","Python","ETL","ELT","Airflow","dbt","Spark","Snowflake","BigQuery","Kafka","Docker","Git","CI/CD","Data modeling","AWS","GCP","Azure"]'::jsonb);

-- Business Analyst ---------------------------------------------------------------
select pg_temp.seed('ba','tool','[
 ["Jira + Confluence","Backlog and documentation"],["Miro / draw.io","Workshops and flow diagrams"],
 ["Power BI","Show impact with data"],["Excel","Fast analysis and prototyping"],
 ["Figma","Read and comment wireframes"]]'::jsonb);
select pg_temp.seed('ba','tip','[
 "Prepare two STAR stories: a requirement conflict you solved and a process you improved.",
 "Show you can talk to both business and tech: plain words first, then precise ones.",
 "Bring a sample artifact: a BPMN diagram or a user story set from a personal project."]'::jsonb);
select pg_temp.seed('ba','keyword','["Requirements gathering","User stories","BPMN","Stakeholder management","SQL","Jira","Confluence","UAT","Agile","Scrum","Process mapping","Power BI","Gap analysis"]'::jsonb);

-- Application Support ------------------------------------------------------------
select pg_temp.seed('as','tool','[
 ["ServiceNow / Jira Service Management","Ticketing"],["Grafana / Kibana","Monitoring and logs"],
 ["Postman","Test APIs when diagnosing"],["Bash + SQL","Daily investigation toolkit"],
 ["Splunk","Common in large companies"]]'::jsonb);
select pg_temp.seed('as','tip','[
 "Describe an incident end to end: symptom, diagnosis, fix, prevention. That is the interview.",
 "Mention calm under pressure and clear written updates; they matter as much as technical skill.",
 "Automate one repetitive task with a script and put it on your CV."]'::jsonb);
select pg_temp.seed('as','keyword','["Incident management","ITIL","ServiceNow","SQL","Linux","Log analysis","Monitoring","Root cause analysis","Bash","SLA","Python","On-call"]'::jsonb);

-- Data Analyst ------------------------------------------------------------------------
select pg_temp.seed('da','tool','[
 ["Power BI / Tableau","Dashboards"],["Excel / Google Sheets","Quick analysis"],
 ["Jupyter","Exploration notebooks"],["Metabase / Looker Studio","Free reporting"],
 ["Kaggle / data.gouv.fr","Public datasets for projects"]]'::jsonb);
select pg_temp.seed('da','tip','[
 "Publish 2 or 3 dashboards on public data, each answering a clear business question.",
 "Lead with the insight, then the method; recruiters skim.",
 "Practise explaining a metric definition out loud: it is a classic interview test."]'::jsonb);
select pg_temp.seed('da','keyword','["SQL","Excel","Power BI","Tableau","Python","Pandas","A/B testing","Statistics","Data storytelling","KPI","Looker Studio","Data cleaning"]'::jsonb);

-- DevOps Engineer ------------------------------------------------------------------------
select pg_temp.seed('do','tool','[
 ["GitHub Actions / GitLab CI","Build, test and deploy pipelines"],["Docker","Package apps as images"],
 ["Kubernetes + Helm","Run containers at scale"],["Terraform","Infrastructure as Code"],
 ["Prometheus + Grafana","Metrics, dashboards and alerts"]]'::jsonb);
select pg_temp.seed('do','tip','[
 "Build one project end to end: a small API in Docker, a CI/CD pipeline, infrastructure in Terraform and a dashboard. Link it on your CV.",
 "Talk about incidents you handled and what you automated afterwards; DevOps interviews test judgement as much as tools.",
 "Quantify your impact: deployment time cut, releases per week, incidents avoided, cloud costs saved."]'::jsonb);
select pg_temp.seed('do','keyword','["CI/CD","Docker","Kubernetes","Terraform","AWS","Azure","GCP","Linux","Bash","Python","Git","Ansible","Helm","Prometheus","Grafana","Monitoring"]'::jsonb);

-- AI Engineer ---------------------------------------------------------------------------
-- Its nine courses are the AI engineer track (content/ai: English, French, Derja in Arabic letters and 3arbizi).
select pg_temp.seed('ai','tool','[
 ["Claude API + Python SDK","Build features with Claude: messages, streaming, tools, structured outputs"],
 ["Claude Code","A coding agent for the terminal, the IDE and the desktop"],
 ["pgvector","Vector search inside PostgreSQL, for RAG"],
 ["FastAPI","A small backend that keeps the API key and calls the model"],
 ["MCP (Model Context Protocol)","Connect ready-made tools and data sources to an agent"]]'::jsonb);
select pg_temp.seed('ai','tip','[
 "Show numbers, not demos: an eval set, the score, the cost per task and the limits in every project README.",
 "Build one project with Derja, French and Arabic users in mind: few candidates in Europe can show that, and Tunisian clients need it.",
 "In interviews, tell the story of a mistake the model made, how you measured it and how you fixed it."]'::jsonb);
select pg_temp.seed('ai','keyword','["LLM","Prompt engineering","Claude API","OpenAI API","AI agents","RAG","Vector database","LLMOps","LangChain","AI coding tools","Python","REST API","Docker","Git","SQL"]'::jsonb);

-- =====================================================================================
-- Learning tracks. Step = [title, description, kind, provider, url, est_hours, is_free?]
-- kind: learn | practice | project | certification.  Hours are rough estimates.
-- Step ids are derived from (track id, title): renaming a step resets its progress.
-- =====================================================================================
create or replace function pg_temp.track(
  p text, tid text, ttl text, lvl public.training_level, summ text, outc text, ord int, steps jsonb)
returns void language plpgsql as $$
begin
  insert into public.training_tracks (id, path_id, title, summary, outcome, level, sort_order)
  values (tid, p, ttl, summ, outc, lvl, ord)
  on conflict (id) do update set title = excluded.title, summary = excluded.summary,
    outcome = excluded.outcome, level = excluded.level, sort_order = excluded.sort_order;

  insert into public.training_steps (id, track_id, title, description, kind, provider, url, est_hours, is_free, sort_order)
  select md5(tid || ':' || (s.e->>0))::uuid, tid, s.e->>0, coalesce(s.e->>1, ''),
         (s.e->>2)::public.step_kind, coalesce(s.e->>3, ''), nullif(s.e->>4, ''),
         (s.e->>5)::numeric, coalesce((s.e->>6)::boolean, true), s.ord::int
  from jsonb_array_elements(steps) with ordinality as s(e, ord)
  on conflict (id) do update set description = excluded.description, kind = excluded.kind,
    provider = excluded.provider, url = excluded.url, est_hours = excluded.est_hours,
    is_free = excluded.is_free, sort_order = excluded.sort_order;
end;
$$;

-- Data Engineer -------------------------------------------------------------------------
select pg_temp.track('de','de-foundations','Foundations: SQL, Python, Git','beginner',
 'The core toolkit every data engineering interview checks first.',
 'Query and transform data with SQL, write clean Python scripts, and keep everything in Git.',1,'[
 ["SQL basics","Select, filter, join and aggregate with interactive lessons.","learn","Kaggle Learn","https://www.kaggle.com/learn/intro-to-sql",4],
 ["Advanced SQL: CTEs and window functions","Analytic functions, nested data and query structure.","learn","Kaggle Learn","https://www.kaggle.com/learn/advanced-sql",5],
 ["Python tutorial","The official walkthrough: data structures, modules, errors, files.","learn","Python docs","https://docs.python.org/3/tutorial/",8],
 ["pandas getting started","Load, clean, reshape and export tabular data.","learn","pandas docs","https://pandas.pydata.org/docs/getting_started/index.html",5],
 ["Git fundamentals","Commits, branches and pull requests.","learn","Pro Git book","https://git-scm.com/book/en/v2",4],
 ["Practice: clean a messy CSV and load it into PostgreSQL","Pick a public dataset, script the cleaning in Python, load it into Postgres, commit with a README.","practice","Your repo","",4]]'::jsonb);
select pg_temp.track('de','de-pipelines','Pipelines and orchestration','intermediate',
 'Move from scripts to scheduled, tested, reproducible pipelines.',
 'Build a scheduled ELT pipeline with a warehouse, dbt models and tests.',2,'[
 ["Docker: get started","Containers for reproducible local pipelines.","learn","Docker docs","https://docs.docker.com/get-started/",3],
 ["Airflow tutorial","Write your first DAG, tasks, schedules and dependencies.","learn","Apache Airflow","https://airflow.apache.org/docs/apache-airflow/stable/tutorial/index.html",4],
 ["dbt Fundamentals","Models, tests, documentation and deployment.","learn","dbt Learn","https://learn.getdbt.com",6],
 ["BigQuery sandbox","Load data into a cloud warehouse without a credit card.","practice","Google Cloud","https://cloud.google.com/bigquery/docs/sandbox",3],
 ["Data Engineering Zoomcamp","Free, project-based course covering Docker, Postgres, orchestration, dbt, Spark and Kafka. Do it alongside or instead of the steps above.","learn","DataTalks.Club","https://github.com/DataTalksClub/data-engineering-zoomcamp",40]]'::jsonb);
select pg_temp.track('de','de-advanced','Scale, streaming and certification','advanced',
 'What separates a junior portfolio from a hireable one.',
 'Design reliable pipelines, explain trade-offs, and back it with a project and a cloud certification.',3,'[
 ["Spark quick start","DataFrames and SQL on a distributed engine.","learn","Apache Spark","https://spark.apache.org/docs/latest/quick-start.html",5],
 ["Kafka quickstart","Topics, producers and consumers.","learn","Apache Kafka","https://kafka.apache.org/quickstart",3],
 ["Designing Data-Intensive Applications","Reference book on storage, replication and streaming. Read the chapters you need.","learn","dataintensive.net","https://dataintensive.net",20,false],
 ["Portfolio project: end-to-end pipeline","Ingest a public API daily, orchestrate it, transform with dbt, add data tests and a dashboard. Write down your trade-offs.","project","Your repo","",25],
 ["Cloud data engineer certification","Pick one cloud (Google Professional Data Engineer shown; AWS and Azure have equivalents).","certification","Google Cloud","https://cloud.google.com/learn/certification/data-engineer",30,false]]'::jsonb);

-- Business Analyst ------------------------------------------------------------------------
select pg_temp.track('ba','ba-foundations','Core business analysis','beginner',
 'Requirements, stories and the agile vocabulary used in every team.',
 'Elicit requirements and write clear user stories with acceptance criteria.',1,'[
 ["User stories","Write stories with a clear who, what and why.","learn","Atlassian","https://www.atlassian.com/agile/project-management/user-stories",1],
 ["The Scrum Guide","The short source of truth for Scrum roles and events.","learn","scrumguides.org","https://scrumguides.org",1],
 ["Jira and agile tutorials","Epics, stories, boards and workflows.","learn","Atlassian","https://www.atlassian.com/agile/tutorials",2],
 ["SQL practice","Check requirements against real data.","learn","SQLZoo","https://sqlzoo.net",5],
 ["Practice: write 10 user stories for an app you use","Include acceptance criteria and a prioritised backlog.","practice","Your notes","",3]]'::jsonb);
select pg_temp.track('ba','ba-process','Process modeling and reporting','intermediate',
 'Show how work flows today, where it breaks, and what changes would be worth it.',
 'Map as-is and to-be processes and quantify the impact with a report.',2,'[
 ["BPMN overview","Notation for events, tasks and gateways.","learn","Camunda","https://camunda.com/bpmn/",2],
 ["Practice: model a process in draw.io","Draw the as-is flow of a process you know and mark the pain points.","practice","draw.io","https://www.drawio.com",3],
 ["Power BI documentation and training","Build a report from Excel or SQL data.","learn","Microsoft Learn","https://learn.microsoft.com/power-bi/",8],
 ["Practice: as-is, to-be and gap list","Produce a one-page process change proposal with expected KPIs.","practice","Your notes","",4]]'::jsonb);
select pg_temp.track('ba','ba-advanced','Case study and certification','advanced',
 'Proof that you can run a requirement from idea to delivery.',
 'Present a complete requirements pack and hold a recognised credential.',3,'[
 ["Case study: full requirements pack","Stakeholder map, BPMN flows, user stories, acceptance criteria and KPIs for one realistic project.","project","Your repo","",15],
 ["IIBA entry-level certification (ECBA)","Check the current exam requirements on the IIBA site.","certification","IIBA","https://www.iiba.org/",30,false],
 ["Professional Scrum certification","Optional if the target roles mention Product Owner or Scrum.","certification","Scrum.org","https://www.scrum.org",15,false],
 ["Practice: interview stories","Prepare two STAR stories and walk through your case study out loud.","practice","Your notes","",3]]'::jsonb);

-- Application Support -------------------------------------------------------------------------
select pg_temp.track('as','as-foundations','Linux, SQL and incident basics','beginner',
 'The daily toolkit of an L1/L2 support analyst.',
 'Navigate a Linux server, read logs, query a database and follow an incident process.',1,'[
 ["Linux Journey","Beginner-friendly Linux lessons.","learn","linuxjourney.com","https://linuxjourney.com",8],
 ["OverTheWire: Bandit","Learn the shell by solving small challenges.","practice","OverTheWire","https://overthewire.org/wargames/bandit/",6],
 ["SQL basics","Select, filter, join and aggregate.","learn","Kaggle Learn","https://www.kaggle.com/learn/intro-to-sql",4],
 ["Incident management guide","Severity levels, roles, communication and escalation.","learn","Atlassian","https://www.atlassian.com/incident-management",2]]'::jsonb);
select pg_temp.track('as','as-monitoring','Monitoring, APIs and automation','intermediate',
 'Spot problems before users do, and stop repeating manual work.',
 'Read dashboards and logs, test APIs and automate a recurring task.',2,'[
 ["Prometheus: first steps","Metrics, targets and queries.","learn","Prometheus","https://prometheus.io/docs/introduction/first_steps/",2],
 ["Grafana tutorials","Build dashboards and alerts.","learn","Grafana Labs","https://grafana.com/tutorials/",4],
 ["Postman Learning Center","Send requests, inspect responses, write simple tests.","learn","Postman","https://learning.postman.com",3],
 ["Python tutorial","Enough Python to automate checks and parse logs.","learn","Python docs","https://docs.python.org/3/tutorial/",6],
 ["Practice: log summary script","Write a Bash or Python script that scans a log file and reports error counts by type.","practice","Your repo","",4]]'::jsonb);
select pg_temp.track('as','as-advanced','Reliability and certification','advanced',
 'Move from fixing incidents to preventing them.',
 'Run an incident, write a blameless post-mortem and hold an ITIL credential.',3,'[
 ["SRE book: effective troubleshooting","A systematic method for diagnosing production problems.","learn","Google SRE","https://sre.google/sre-book/effective-troubleshooting/",1.5],
 ["SRE book: postmortem culture","How to write blameless post-mortems that lead to change.","learn","Google SRE","https://sre.google/sre-book/postmortem-culture/",1],
 ["Project: runbook and post-mortem","Break a small Dockerised app on purpose, monitor it with Grafana, then write the runbook and a post-mortem.","project","Your repo","",10],
 ["ITIL 4 Foundation","Check current exam details with the certification body.","certification","PeopleCert","https://www.peoplecert.org",20,false]]'::jsonb);

-- Data Analyst --------------------------------------------------------------------------------
select pg_temp.track('da','da-foundations','SQL, statistics and clean data','beginner',
 'Answer business questions correctly before making them pretty.',
 'Query data with SQL, clean it, and use basic statistics to support a conclusion.',1,'[
 ["Intro to SQL","Select, filter, join and aggregate.","learn","Kaggle Learn","https://www.kaggle.com/learn/intro-to-sql",4],
 ["Advanced SQL","CTEs and window functions for analysis.","learn","Kaggle Learn","https://www.kaggle.com/learn/advanced-sql",5],
 ["Statistics and probability","Distributions, sampling, confidence and tests.","learn","Khan Academy","https://www.khanacademy.org/math/statistics-probability",10],
 ["Data cleaning","Missing values, scaling, parsing dates and inconsistent text.","learn","Kaggle Learn","https://www.kaggle.com/learn/data-cleaning",4],
 ["Practice: analyse a public dataset in SQL","Choose a dataset, write 5 business questions and answer them with queries.","practice","data.gouv.fr","https://www.data.gouv.fr",5]]'::jsonb);
select pg_temp.track('da','da-viz','Python, BI and visual storytelling','intermediate',
 'Turn analysis into something a manager can act on.',
 'Build dashboards that lead to a decision and explain them clearly.',2,'[
 ["pandas","Manipulate and summarise data in Python.","learn","Kaggle Learn","https://www.kaggle.com/learn/pandas",4],
 ["Data visualization","Charts that show the right comparison.","learn","Kaggle Learn","https://www.kaggle.com/learn/data-visualization",4],
 ["Power BI","Pick Power BI or Tableau and stay with one. Power BI documentation and training.","learn","Microsoft Learn","https://learn.microsoft.com/power-bi/",8],
 ["Tableau free training","The alternative if your target employers use Tableau.","learn","Tableau","https://www.tableau.com/learn/training",8],
 ["Storytelling with Data","Declutter charts, focus attention, lead with the insight.","learn","storytellingwithdata.com","https://www.storytellingwithdata.com",3]]'::jsonb);
select pg_temp.track('da','da-advanced','Portfolio and certification','advanced',
 'Evidence beats claims. Ship three small, finished projects.',
 'Show dashboards on public data and hold a recognised credential.',3,'[
 ["Portfolio: three dashboards on public data","Each answers one clear business question and ends with a recommendation.","project","Your portfolio","",20],
 ["Google Data Analytics Certificate","Beginner-friendly professional certificate. Hours are approximate and vary by pace.","certification","Coursera","https://www.coursera.org/professional-certificates/google-data-analytics",150,false],
 ["Microsoft Power BI Data Analyst (PL-300)","Recognised if you chose Power BI.","certification","Microsoft Learn","https://learn.microsoft.com/credentials/certifications/data-analyst-associate/",30,false],
 ["Practice: SQL and metric definition drills","Define conversion, retention and churn out loud, then write the SQL for each.","practice","Your notes","",4]]'::jsonb);

-- DevOps Engineer -----------------------------------------------------------------------------
select pg_temp.track('do','do-foundations','Linux, Git, networking and scripting','beginner',
 'The everyday base of every DevOps and cloud role.',
 'Work comfortably on a Linux server, version everything with Git, understand how requests travel and automate small tasks.',1,'[
 ["Linux Journey","Beginner-friendly Linux lessons.","learn","linuxjourney.com","https://linuxjourney.com",8],
 ["OverTheWire: Bandit","Learn the shell by solving small challenges.","practice","OverTheWire","https://overthewire.org/wargames/bandit/",6],
 ["Pro Git book","Chapters 1 to 3: basics and branching.","learn","git-scm.com","https://git-scm.com/book/en/v2",5],
 ["Learn Git Branching","Interactive exercises on branches, merges and rebases.","practice","learngitbranching.js.org","https://learngitbranching.js.org",3],
 ["Cloudflare Learning Center","How DNS, HTTP, TLS, load balancing and CDNs work.","learn","Cloudflare","https://www.cloudflare.com/learning/",4]]'::jsonb);
select pg_temp.track('do','do-delivery','Containers, CI/CD and Kubernetes','intermediate',
 'Ship applications the way modern teams do: in containers, through a pipeline, onto a cluster.',
 'Containerise an app, build and test it in a pipeline and deploy it to Kubernetes.',2,'[
 ["Docker: get started","Images, containers, volumes and Compose.","learn","Docker docs","https://docs.docker.com/get-started/",6],
 ["GitHub Actions documentation","Workflows, jobs, secrets and environments.","learn","GitHub Docs","https://docs.github.com/en/actions",4],
 ["Kubernetes basics","Deploy, expose, scale and update an app on a cluster.","learn","Kubernetes docs","https://kubernetes.io/docs/tutorials/kubernetes-basics/",6],
 ["Project: ship a containerised API","Dockerise a small API, add a pipeline that tests and builds the image, and deploy it to a local kind cluster.","project","Your repo","",12]]'::jsonb);
select pg_temp.track('do','do-cloud','Cloud, Infrastructure as Code and reliability','advanced',
 'Run real infrastructure from code and keep it healthy.',
 'Create cloud infrastructure with Terraform from a pipeline, monitor it with SLOs and hold a recognised certification.',3,'[
 ["Terraform tutorials","Get started with Terraform on AWS, Azure or Google Cloud.","learn","HashiCorp","https://developer.hashicorp.com/terraform/tutorials",8],
 ["AWS Skill Builder","Free cloud fundamentals courses, including Cloud Practitioner Essentials.","learn","AWS","https://skillbuilder.aws",10],
 ["Prometheus: first steps","Metrics, targets and queries.","learn","Prometheus","https://prometheus.io/docs/introduction/first_steps/",2],
 ["SRE book: service level objectives","Define SLIs, SLOs and error budgets.","learn","Google SRE","https://sre.google/sre-book/service-level-objectives/",1.5],
 ["Project: infrastructure as code","Create the cloud resources of your API with Terraform from a pipeline, with remote state, a dashboard and one alert.","project","Your repo","",15],
 ["AWS Certified Cloud Practitioner or CKA","Pick one: cloud fundamentals (AWS) or Kubernetes administration (CNCF). Check current exam details.","certification","AWS / CNCF","https://aws.amazon.com/certification/",25,false]]'::jsonb);

-- AI Engineer ---------------------------------------------------------------------------------
-- The nine HelloKhedma AI courses show under these tracks (course list of the path); steps point to official material.
select pg_temp.track('ai','ai-foundations','LLM basics, prompting and the Claude API','beginner',
 'How LLMs work, how to write prompts for an app, and how to call Claude from Python safely.',
 'Explain tokens, cost and hallucinations, write a system prompt with examples, and build a small Python app that returns JSON you can trust.',1,'[
 ["Anthropic courses: API fundamentals","Free notebooks from Anthropic: first calls, messages, models and parameters.","learn","Anthropic","https://github.com/anthropics/courses",6],
 ["Prompt engineering interactive tutorial","Chapters of exercises on clear prompts, roles, examples and avoiding hallucinations.","practice","Anthropic","https://github.com/anthropics/prompt-eng-interactive-tutorial",8],
 ["Anthropic Python SDK","Read the README and run the examples: client, streaming, errors and retries.","learn","GitHub","https://github.com/anthropics/anthropic-sdk-python",3],
 ["Structured outputs","Get JSON that follows your schema, and know what the schema does not guarantee.","learn","Claude docs","https://platform.claude.com/docs/en/build-with-claude/structured-outputs",2],
 ["Project: a ticket classifier for Derja, French and Arabic","Classify 30 real-looking support messages into a JSON ticket, with a small test set and the cost per message in the README.","project","Your repo","",10]]'::jsonb);
select pg_temp.track('ai','ai-build','Tools, agents and RAG','intermediate',
 'Give the model your functions and your data: tool use, MCP, embeddings and answers with sources.',
 'Build an agent loop with budgets and a RAG assistant that cites its sources and says when it does not know.',2,'[
 ["Tool use overview","Define tools, run the loop, return results and errors.","learn","Claude docs","https://platform.claude.com/docs/en/agents-and-tools/tool-use/overview",3],
 ["MCP Python SDK","Write a small MCP server and connect it to a client.","practice","GitHub","https://github.com/modelcontextprotocol/python-sdk",4],
 ["Embeddings","What embeddings are and where to get them (Claude has no embeddings endpoint).","learn","Claude docs","https://platform.claude.com/docs/en/build-with-claude/embeddings",2],
 ["pgvector","Store embeddings in PostgreSQL, search them and index them.","learn","GitHub","https://github.com/pgvector/pgvector",3],
 ["Citations","Answers that quote the passages they come from.","learn","Claude docs","https://platform.claude.com/docs/en/build-with-claude/citations",2],
 ["Claude cookbooks","Worked notebooks on RAG, tool use, agents and evaluation to read and adapt.","practice","Anthropic","https://github.com/anthropics/claude-cookbooks",8],
 ["Project: a documentation assistant with citations","RAG over a public documentation, with sources, an I do not know path and an eval set (see the portfolio projects below).","project","Your repo","",16]]'::jsonb);
select pg_temp.track('ai','ai-production','Evaluation, production and maintenance','advanced',
 'Measure quality, run the feature safely in production and keep it working when models change.',
 'Ship an AI feature with an eval in CI, logs, budgets, a canary and a rollback, and migrate it to a new model without breaking it.',3,'[
 ["Prompt caching","Lower cost and latency on the fixed part of the prompt, and check that it works.","learn","Claude docs","https://platform.claude.com/docs/en/build-with-claude/prompt-caching",2],
 ["Rate limits","How limits work and what to do when you reach them.","learn","Claude docs","https://platform.claude.com/docs/en/api/rate-limits",1],
 ["Practice: an eval set for your project","Write 30 to 50 real cases with the expected answer, grade them in code or with a calibrated judge, and run them after every change.","practice","Your repo","",6],
 ["Project: a support agent ready for production","Tools, guardrails, logs, cost per ticket, an eval in GitHub Actions and Docker (see the portfolio projects below).","project","Your repo","",20],
 ["Project: a documented model migration","Move one of your projects to a newer model or SDK version with an eval, a canary and a CHANGELOG entry with the numbers.","project","Your repo","",6]]'::jsonb);

-- =====================================================================================
-- French texts (shown when the interface is French). Needs migration 20261029000200_content_fr.sql.
-- Rows are matched on their English title (the id key): when you rename an English title, update it here too.
-- Resources: [english title, french title, french description]; tips: [english, french].
-- Steps: [english title, french title, french description]. Use ’ for apostrophes (never a straight quote).
-- Skill keywords and job titles stay English (CV matching and offer search rely on them).
-- =====================================================================================
update public.career_paths p set name_fr = v.n, blurb_fr = v.b
from (values
  ('de', 'Data Engineer', 'Pipelines, entrepôts de données, cloud'),
  ('ba', 'Business Analyst', 'Besoins, processus, parties prenantes'),
  ('as', 'Support applicatif', 'Incidents, supervision, run'),
  ('da', 'Data Analyst', 'Analyses, tableaux de bord, storytelling'),
  ('do', 'DevOps Engineer', 'CI/CD, conteneurs, cloud, automatisation'),
  ('ai', 'AI Engineer', 'Applications LLM, agents, RAG, évaluations')
) as v(id, n, b)
where p.id = v.id;

create or replace function pg_temp.res_fr(p text, k public.resource_kind, items jsonb)
returns void language sql as $$
  update public.path_resources r
  set title_fr = x.e->>1, description_fr = nullif(coalesce(x.e->>2, ''), '')
  from jsonb_array_elements(items) as x(e)
  where r.id = md5(p || ':' || k::text || ':' || (x.e->>0))::uuid;
$$;

create or replace function pg_temp.track_fr(tid text, ttl text, summ text, outc text, steps jsonb)
returns void language sql as $$
  update public.training_tracks set title_fr = ttl, summary_fr = summ, outcome_fr = outc where id = tid;
  update public.training_steps s
  set title_fr = x.e->>1, description_fr = nullif(coalesce(x.e->>2, ''), '')
  from jsonb_array_elements(steps) as x(e)
  where s.id = md5(tid || ':' || (x.e->>0))::uuid;
$$;

-- Data Engineer ---------------------------------------------------------------
select pg_temp.res_fr('de','tool','[
 ["PostgreSQL / DuckDB","PostgreSQL / DuckDB","Pratiquer gratuitement en local"],["Airflow or Dagster","Airflow ou Dagster","Orchestration"],
 ["dbt Core","dbt Core","Transformations et tests"],["Docker","Docker","Environnements reproductibles"],
 ["GitHub","GitHub","Portfolio de projets de pipelines"]]'::jsonb);
select pg_temp.res_fr('de','tip','[
 ["Build one end-to-end project: API, storage, transform, dashboard. Document it in the README.","Réalisez un projet de bout en bout : API, stockage, transformation, tableau de bord. Documentez-le dans le README."],
 ["Show data quality checks and tests; recruiters look for reliability, not only tools.","Montrez vos contrôles de qualité et vos tests : les recruteurs cherchent de la fiabilité, pas seulement des outils."],
 ["Quantify results on your CV: rows per day, runtime cut, cost saved.","Chiffrez vos résultats sur le CV : lignes par jour, temps d’exécution réduit, coûts économisés."]]'::jsonb);

-- Business Analyst ---------------------------------------------------------------
select pg_temp.res_fr('ba','tool','[
 ["Jira + Confluence","Jira + Confluence","Backlog et documentation"],["Miro / draw.io","Miro / draw.io","Ateliers et schémas de flux"],
 ["Power BI","Power BI","Montrer l’impact avec des données"],["Excel","Excel","Analyse rapide et prototypage"],
 ["Figma","Figma","Lire et commenter des maquettes"]]'::jsonb);
select pg_temp.res_fr('ba','tip','[
 ["Prepare two STAR stories: a requirement conflict you solved and a process you improved.","Préparez deux histoires STAR : un conflit sur un besoin que vous avez résolu et un processus que vous avez amélioré."],
 ["Show you can talk to both business and tech: plain words first, then precise ones.","Montrez que vous savez parler au métier comme à la technique : des mots simples d’abord, puis des termes précis."],
 ["Bring a sample artifact: a BPMN diagram or a user story set from a personal project.","Apportez un exemple de livrable : un diagramme BPMN ou un lot de user stories issu d’un projet personnel."]]'::jsonb);

-- Application Support ------------------------------------------------------------
select pg_temp.res_fr('as','tool','[
 ["ServiceNow / Jira Service Management","ServiceNow / Jira Service Management","Gestion des tickets"],["Grafana / Kibana","Grafana / Kibana","Supervision et logs"],
 ["Postman","Postman","Tester des API pendant un diagnostic"],["Bash + SQL","Bash + SQL","La boîte à outils quotidienne d’investigation"],
 ["Splunk","Splunk","Courant dans les grandes entreprises"]]'::jsonb);
select pg_temp.res_fr('as','tip','[
 ["Describe an incident end to end: symptom, diagnosis, fix, prevention. That is the interview.","Racontez un incident de bout en bout : symptôme, diagnostic, correction, prévention. C’est tout l’entretien."],
 ["Mention calm under pressure and clear written updates; they matter as much as technical skill.","Parlez de votre calme sous pression et de communications écrites claires : elles comptent autant que la technique."],
 ["Automate one repetitive task with a script and put it on your CV.","Automatisez une tâche répétitive avec un script et mettez-la sur votre CV."]]'::jsonb);

-- Data Analyst ------------------------------------------------------------------------
select pg_temp.res_fr('da','tool','[
 ["Power BI / Tableau","Power BI / Tableau","Tableaux de bord"],["Excel / Google Sheets","Excel / Google Sheets","Analyse rapide"],
 ["Jupyter","Jupyter","Notebooks d’exploration"],["Metabase / Looker Studio","Metabase / Looker Studio","Reporting gratuit"],
 ["Kaggle / data.gouv.fr","Kaggle / data.gouv.fr","Jeux de données publics pour vos projets"]]'::jsonb);
select pg_temp.res_fr('da','tip','[
 ["Publish 2 or 3 dashboards on public data, each answering a clear business question.","Publiez 2 ou 3 tableaux de bord sur des données publiques, chacun répondant à une question métier claire."],
 ["Lead with the insight, then the method; recruiters skim.","Commencez par l’enseignement, puis la méthode : les recruteurs lisent en diagonale."],
 ["Practise explaining a metric definition out loud: it is a classic interview test.","Entraînez-vous à expliquer à voix haute la définition d’un indicateur : c’est un test classique en entretien."]]'::jsonb);

-- Learning tracks: Data Engineer ---------------------------------------------------
select pg_temp.track_fr('de-foundations','Fondamentaux : SQL, Python, Git',
 'La boîte à outils que chaque entretien de data engineer vérifie en premier.',
 'Interroger et transformer des données en SQL, écrire des scripts Python propres et tout versionner avec Git.','[
 ["SQL basics","Les bases du SQL","Sélectionner, filtrer, joindre et agréger avec des leçons interactives."],
 ["Advanced SQL: CTEs and window functions","SQL avancé : CTE et fonctions de fenêtrage","Fonctions analytiques, données imbriquées et structure des requêtes."],
 ["Python tutorial","Tutoriel Python","Le parcours officiel : structures de données, modules, erreurs, fichiers."],
 ["pandas getting started","Premiers pas avec pandas","Charger, nettoyer, remodeler et exporter des données tabulaires."],
 ["Git fundamentals","Les fondamentaux de Git","Commits, branches et pull requests."],
 ["Practice: clean a messy CSV and load it into PostgreSQL","Pratique : nettoyer un CSV désordonné et le charger dans PostgreSQL","Choisissez un jeu de données public, scriptez le nettoyage en Python, chargez-le dans Postgres et committez avec un README."]]'::jsonb);
select pg_temp.track_fr('de-pipelines','Pipelines et orchestration',
 'Passer des scripts à des pipelines planifiés, testés et reproductibles.',
 'Construire un pipeline ELT planifié avec un entrepôt de données, des modèles dbt et des tests.','[
 ["Docker: get started","Docker : premiers pas","Des conteneurs pour des pipelines locaux reproductibles."],
 ["Airflow tutorial","Tutoriel Airflow","Écrire votre premier DAG : tâches, planification et dépendances."],
 ["dbt Fundamentals","Les fondamentaux de dbt","Modèles, tests, documentation et déploiement."],
 ["BigQuery sandbox","Bac à sable BigQuery","Charger des données dans un entrepôt cloud sans carte bancaire."],
 ["Data Engineering Zoomcamp","Data Engineering Zoomcamp","Cours gratuit par projets : Docker, Postgres, orchestration, dbt, Spark et Kafka. À suivre en parallèle ou à la place des étapes ci-dessus."]]'::jsonb);
select pg_temp.track_fr('de-advanced','Passage à l’échelle, streaming et certification',
 'Ce qui sépare un portfolio junior d’un profil qu’on embauche.',
 'Concevoir des pipelines fiables, expliquer vos arbitrages et l’appuyer par un projet et une certification cloud.','[
 ["Spark quick start","Démarrage rapide Spark","DataFrames et SQL sur un moteur distribué."],
 ["Kafka quickstart","Démarrage rapide Kafka","Topics, producteurs et consommateurs."],
 ["Designing Data-Intensive Applications","Designing Data-Intensive Applications","Livre de référence sur le stockage, la réplication et le streaming. Lisez les chapitres dont vous avez besoin."],
 ["Portfolio project: end-to-end pipeline","Projet portfolio : pipeline de bout en bout","Ingérez une API publique chaque jour, orchestrez-la, transformez avec dbt, ajoutez des tests de données et un tableau de bord. Notez vos arbitrages."],
 ["Cloud data engineer certification","Certification data engineer cloud","Choisissez un cloud (Google Professional Data Engineer ici ; AWS et Azure ont des équivalents)."]]'::jsonb);

-- Learning tracks: Business Analyst ------------------------------------------------
select pg_temp.track_fr('ba-foundations','Les bases de l’analyse métier',
 'Les besoins, les user stories et le vocabulaire agile utilisés dans toutes les équipes.',
 'Recueillir des besoins et écrire des user stories claires avec leurs critères d’acceptation.','[
 ["User stories","User stories","Écrire des stories avec un qui, un quoi et un pourquoi clairs."],
 ["The Scrum Guide","Le Guide Scrum","La source de référence, courte, sur les rôles et les événements Scrum."],
 ["Jira and agile tutorials","Tutoriels Jira et agilité","Epics, stories, tableaux et workflows."],
 ["SQL practice","Pratique du SQL","Vérifier les besoins sur des données réelles."],
 ["Practice: write 10 user stories for an app you use","Pratique : écrire 10 user stories pour une application que vous utilisez","Avec des critères d’acceptation et un backlog priorisé."]]'::jsonb);
select pg_temp.track_fr('ba-process','Modélisation des processus et reporting',
 'Montrer comment le travail circule aujourd’hui, où il bloque et quels changements en valent la peine.',
 'Cartographier les processus actuels et cibles et chiffrer l’impact dans un rapport.','[
 ["BPMN overview","Introduction à BPMN","La notation des événements, tâches et passerelles."],
 ["Practice: model a process in draw.io","Pratique : modéliser un processus dans draw.io","Dessinez le flux actuel d’un processus que vous connaissez et repérez les points de friction."],
 ["Power BI documentation and training","Documentation et formation Power BI","Construire un rapport à partir de données Excel ou SQL."],
 ["Practice: as-is, to-be and gap list","Pratique : existant, cible et liste des écarts","Rédigez une proposition d’évolution de processus d’une page avec les KPI attendus."]]'::jsonb);
select pg_temp.track_fr('ba-advanced','Étude de cas et certification',
 'La preuve que vous savez mener un besoin de l’idée à la livraison.',
 'Présenter un dossier de besoins complet et détenir une certification reconnue.','[
 ["Case study: full requirements pack","Étude de cas : dossier de besoins complet","Cartographie des parties prenantes, flux BPMN, user stories, critères d’acceptation et KPI pour un projet réaliste."],
 ["IIBA entry-level certification (ECBA)","Certification IIBA de premier niveau (ECBA)","Vérifiez les conditions d’examen actuelles sur le site de l’IIBA."],
 ["Professional Scrum certification","Certification Professional Scrum","Facultative, sauf si les postes visés mentionnent Product Owner ou Scrum."],
 ["Practice: interview stories","Pratique : histoires pour l’entretien","Préparez deux histoires STAR et présentez votre étude de cas à voix haute."]]'::jsonb);

-- Learning tracks: Application Support ---------------------------------------------
select pg_temp.track_fr('as-foundations','Linux, SQL et bases des incidents',
 'La boîte à outils quotidienne d’un analyste support N1/N2.',
 'Naviguer sur un serveur Linux, lire des logs, interroger une base de données et suivre un processus d’incident.','[
 ["Linux Journey","Linux Journey","Des leçons Linux accessibles aux débutants."],
 ["OverTheWire: Bandit","OverTheWire : Bandit","Apprendre le shell en résolvant de petits défis."],
 ["SQL basics","Les bases du SQL","Sélectionner, filtrer, joindre et agréger."],
 ["Incident management guide","Guide de la gestion des incidents","Niveaux de gravité, rôles, communication et escalade."]]'::jsonb);
select pg_temp.track_fr('as-monitoring','Supervision, API et automatisation',
 'Repérer les problèmes avant les utilisateurs et arrêter de répéter le travail manuel.',
 'Lire des tableaux de bord et des logs, tester des API et automatiser une tâche récurrente.','[
 ["Prometheus: first steps","Prometheus : premiers pas","Métriques, cibles et requêtes."],
 ["Grafana tutorials","Tutoriels Grafana","Construire des tableaux de bord et des alertes."],
 ["Postman Learning Center","Postman Learning Center","Envoyer des requêtes, inspecter les réponses, écrire des tests simples."],
 ["Python tutorial","Tutoriel Python","Assez de Python pour automatiser des contrôles et analyser des logs."],
 ["Practice: log summary script","Pratique : script de synthèse de logs","Écrivez un script Bash ou Python qui parcourt un fichier de logs et compte les erreurs par type."]]'::jsonb);
select pg_temp.track_fr('as-advanced','Fiabilité et certification',
 'Passer de la correction des incidents à leur prévention.',
 'Piloter un incident, rédiger un post-mortem sans reproche et détenir une certification ITIL.','[
 ["SRE book: effective troubleshooting","Livre SRE : un diagnostic efficace","Une méthode systématique pour diagnostiquer les problèmes de production."],
 ["SRE book: postmortem culture","Livre SRE : la culture du post-mortem","Rédiger des post-mortems sans reproche qui mènent à des changements."],
 ["Project: runbook and post-mortem","Projet : runbook et post-mortem","Cassez volontairement une petite application Docker, supervisez-la avec Grafana, puis rédigez le runbook et un post-mortem."],
 ["ITIL 4 Foundation","ITIL 4 Foundation","Vérifiez les détails actuels de l’examen auprès de l’organisme de certification."]]'::jsonb);

-- Learning tracks: Data Analyst ------------------------------------------------------
select pg_temp.track_fr('da-foundations','SQL, statistiques et données propres',
 'Répondre correctement aux questions métier avant de les rendre jolies.',
 'Interroger des données en SQL, les nettoyer et utiliser des statistiques simples pour étayer une conclusion.','[
 ["Intro to SQL","Introduction au SQL","Sélectionner, filtrer, joindre et agréger."],
 ["Advanced SQL","SQL avancé","CTE et fonctions de fenêtrage pour l’analyse."],
 ["Statistics and probability","Statistiques et probabilités","Distributions, échantillonnage, intervalles de confiance et tests."],
 ["Data cleaning","Nettoyage de données","Valeurs manquantes, mise à l’échelle, dates à parser et textes incohérents."],
 ["Practice: analyse a public dataset in SQL","Pratique : analyser un jeu de données public en SQL","Choisissez un jeu de données, écrivez 5 questions métier et répondez-y avec des requêtes."]]'::jsonb);
select pg_temp.track_fr('da-viz','Python, BI et storytelling visuel',
 'Transformer une analyse en quelque chose sur quoi un manager peut agir.',
 'Construire des tableaux de bord qui mènent à une décision et les expliquer clairement.','[
 ["pandas","pandas","Manipuler et résumer des données en Python."],
 ["Data visualization","Visualisation de données","Des graphiques qui montrent la bonne comparaison."],
 ["Power BI","Power BI","Choisissez Power BI ou Tableau et tenez-vous-en à un seul. Documentation et formation Power BI."],
 ["Tableau free training","Formation gratuite Tableau","L’alternative si vos employeurs cibles utilisent Tableau."],
 ["Storytelling with Data","Storytelling with Data","Épurer les graphiques, guider l’attention, commencer par l’enseignement."]]'::jsonb);
select pg_temp.track_fr('da-advanced','Portfolio et certification',
 'Les preuves valent mieux que les promesses. Livrez trois petits projets terminés.',
 'Présenter des tableaux de bord sur des données publiques et détenir une certification reconnue.','[
 ["Portfolio: three dashboards on public data","Portfolio : trois tableaux de bord sur des données publiques","Chacun répond à une question métier claire et se termine par une recommandation."],
 ["Google Data Analytics Certificate","Google Data Analytics Certificate","Certificat professionnel accessible aux débutants. Les heures sont approximatives et dépendent de votre rythme."],
 ["Microsoft Power BI Data Analyst (PL-300)","Microsoft Power BI Data Analyst (PL-300)","Reconnue si vous avez choisi Power BI."],
 ["Practice: SQL and metric definition drills","Pratique : exercices de SQL et de définition d’indicateurs","Définissez à voix haute la conversion, la rétention et le churn, puis écrivez le SQL de chacun."]]'::jsonb);

-- DevOps Engineer ------------------------------------------------------------------------
select pg_temp.res_fr('do','tool','[
 ["GitHub Actions / GitLab CI","GitHub Actions / GitLab CI","Pipelines de build, de test et de déploiement"],["Docker","Docker","Empaqueter les applications en images"],
 ["Kubernetes + Helm","Kubernetes + Helm","Faire tourner des conteneurs à grande échelle"],["Terraform","Terraform","Infrastructure as Code"],
 ["Prometheus + Grafana","Prometheus + Grafana","Métriques, tableaux de bord et alertes"]]'::jsonb);
select pg_temp.res_fr('do','tip','[
 ["Build one project end to end: a small API in Docker, a CI/CD pipeline, infrastructure in Terraform and a dashboard. Link it on your CV.","Construisez un projet de bout en bout : une petite API dans Docker, un pipeline CI/CD, l’infrastructure en Terraform et un tableau de bord. Mettez le lien sur votre CV."],
 ["Talk about incidents you handled and what you automated afterwards; DevOps interviews test judgement as much as tools.","Parlez des incidents que vous avez gérés et de ce que vous avez automatisé ensuite : les entretiens DevOps testent le jugement autant que les outils."],
 ["Quantify your impact: deployment time cut, releases per week, incidents avoided, cloud costs saved.","Chiffrez votre impact : temps de déploiement réduit, livraisons par semaine, incidents évités, coûts cloud économisés."]]'::jsonb);

-- Learning tracks: DevOps Engineer --------------------------------------------------
select pg_temp.track_fr('do-foundations','Linux, Git, réseau et scripts',
 'La base quotidienne de tout poste DevOps et cloud.',
 'Travailler à l’aise sur un serveur Linux, tout versionner avec Git, comprendre le trajet des requêtes et automatiser de petites tâches.','[
 ["Linux Journey","Linux Journey","Des leçons Linux accessibles aux débutants."],
 ["OverTheWire: Bandit","OverTheWire : Bandit","Apprendre le shell en résolvant de petits défis."],
 ["Pro Git book","Le livre Pro Git","Chapitres 1 à 3 : les bases et les branches."],
 ["Learn Git Branching","Learn Git Branching","Exercices interactifs sur les branches, les fusions et les rebases."],
 ["Cloudflare Learning Center","Cloudflare Learning Center","Comment fonctionnent DNS, HTTP, TLS, la répartition de charge et les CDN."]]'::jsonb);
select pg_temp.track_fr('do-delivery','Conteneurs, CI/CD et Kubernetes',
 'Livrer des applications comme les équipes modernes : en conteneurs, via un pipeline, sur un cluster.',
 'Conteneuriser une application, la construire et la tester dans un pipeline et la déployer sur Kubernetes.','[
 ["Docker: get started","Docker : premiers pas","Images, conteneurs, volumes et Compose."],
 ["GitHub Actions documentation","Documentation GitHub Actions","Workflows, jobs, secrets et environnements."],
 ["Kubernetes basics","Les bases de Kubernetes","Déployer, exposer, faire évoluer et mettre à jour une application sur un cluster."],
 ["Project: ship a containerised API","Projet : livrer une API conteneurisée","Conteneurisez une petite API, ajoutez un pipeline qui teste et construit l’image, et déployez-la sur un cluster kind local."]]'::jsonb);
select pg_temp.track_fr('do-cloud','Cloud, Infrastructure as Code et fiabilité',
 'Gérer une vraie infrastructure depuis du code et la garder en bonne santé.',
 'Créer une infrastructure cloud avec Terraform depuis un pipeline, la superviser avec des SLO et détenir une certification reconnue.','[
 ["Terraform tutorials","Tutoriels Terraform","Bien démarrer avec Terraform sur AWS, Azure ou Google Cloud."],
 ["AWS Skill Builder","AWS Skill Builder","Des cours gratuits sur les fondamentaux du cloud, dont Cloud Practitioner Essentials."],
 ["Prometheus: first steps","Prometheus : premiers pas","Métriques, cibles et requêtes."],
 ["SRE book: service level objectives","Livre SRE : les objectifs de niveau de service","Définir SLI, SLO et budgets d’erreur."],
 ["Project: infrastructure as code","Projet : infrastructure as code","Créez les ressources cloud de votre API avec Terraform depuis un pipeline, avec un état distant, un tableau de bord et une alerte."],
 ["AWS Certified Cloud Practitioner or CKA","AWS Certified Cloud Practitioner ou CKA","Choisissez-en une : fondamentaux du cloud (AWS) ou administration Kubernetes (CNCF). Vérifiez les détails actuels de l’examen."]]'::jsonb);

-- AI Engineer ----------------------------------------------------------------------------
select pg_temp.res_fr('ai','tool','[
 ["Claude API + Python SDK","Claude API + SDK Python","Construire des fonctionnalités avec Claude : messages, streaming, outils, sorties structurées"],
 ["Claude Code","Claude Code","Un agent de code pour le terminal, l’IDE et le bureau"],
 ["pgvector","pgvector","La recherche vectorielle dans PostgreSQL, pour le RAG"],
 ["FastAPI","FastAPI","Un petit backend qui garde la clé API et appelle le modèle"],
 ["MCP (Model Context Protocol)","MCP (Model Context Protocol)","Brancher des outils et des sources de données prêts à l’emploi sur un agent"]]'::jsonb);
select pg_temp.res_fr('ai','tip','[
 ["Show numbers, not demos: an eval set, the score, the cost per task and the limits in every project README.","Montrez des chiffres, pas des démos : un jeu d’évaluation, le score, le coût par tâche et les limites dans le README de chaque projet."],
 ["Build one project with Derja, French and Arabic users in mind: few candidates in Europe can show that, and Tunisian clients need it.","Construisez un projet pensé pour des utilisateurs en derja, en français et en arabe : peu de candidats en Europe peuvent le montrer, et les clients tunisiens en ont besoin."],
 ["In interviews, tell the story of a mistake the model made, how you measured it and how you fixed it.","En entretien, racontez une erreur du modèle, comment vous l’avez mesurée et comment vous l’avez corrigée."]]'::jsonb);

-- Learning tracks: AI Engineer -----------------------------------------------------------
select pg_temp.track_fr('ai-foundations','Les bases des LLM, le prompting et l’API Claude',
 'Comment fonctionnent les LLM, comment écrire des prompts pour une application et comment appeler Claude en Python en toute sécurité.',
 'Expliquer les tokens, le coût et les hallucinations, écrire un system prompt avec des exemples et construire une petite application Python qui renvoie un JSON fiable.','[
 ["Anthropic courses: API fundamentals","Cours Anthropic : les fondamentaux de l’API","Des notebooks gratuits d’Anthropic : premiers appels, messages, modèles et paramètres."],
 ["Prompt engineering interactive tutorial","Tutoriel interactif de prompt engineering","Des chapitres d’exercices sur les prompts clairs, les rôles, les exemples et la prévention des hallucinations."],
 ["Anthropic Python SDK","Le SDK Python d’Anthropic","Lisez le README et lancez les exemples : client, streaming, erreurs et nouvelles tentatives."],
 ["Structured outputs","Les sorties structurées","Obtenir un JSON qui suit votre schéma, et savoir ce que le schéma ne garantit pas."],
 ["Project: a ticket classifier for Derja, French and Arabic","Projet : un classifieur de tickets en derja, français et arabe","Classez 30 messages de support réalistes en ticket JSON, avec un petit jeu de test et le coût par message dans le README."]]'::jsonb);
select pg_temp.track_fr('ai-build','Outils, agents et RAG',
 'Donner au modèle vos fonctions et vos données : tool use, MCP, embeddings et réponses sourcées.',
 'Construire une boucle d’agent avec des budgets et un assistant RAG qui cite ses sources et dit quand il ne sait pas.','[
 ["Tool use overview","Présentation du tool use","Définir des outils, faire tourner la boucle, renvoyer les résultats et les erreurs."],
 ["MCP Python SDK","Le SDK Python de MCP","Écrire un petit serveur MCP et le connecter à un client."],
 ["Embeddings","Les embeddings","Ce que sont les embeddings et où les obtenir (Claude n’a pas d’endpoint d’embeddings)."],
 ["pgvector","pgvector","Stocker des embeddings dans PostgreSQL, les rechercher et les indexer."],
 ["Citations","Les citations","Des réponses qui citent les passages dont elles viennent."],
 ["Claude cookbooks","Les Claude cookbooks","Des notebooks commentés sur le RAG, le tool use, les agents et l’évaluation, à lire et à adapter."],
 ["Project: a documentation assistant with citations","Projet : un assistant de documentation avec citations","Un RAG sur une documentation publique, avec les sources, une réponse « je ne sais pas » et un jeu d’évaluation (voir les projets de portfolio plus bas)."]]'::jsonb);
select pg_temp.track_fr('ai-production','Évaluation, production et maintenance',
 'Mesurer la qualité, faire tourner la fonctionnalité en production en toute sécurité et la garder fonctionnelle quand les modèles changent.',
 'Livrer une fonctionnalité IA avec une évaluation en CI, des logs, des budgets, un canary et un retour arrière, puis la migrer vers un nouveau modèle sans la casser.','[
 ["Prompt caching","Le prompt caching","Réduire le coût et la latence sur la partie fixe du prompt, et vérifier que cela fonctionne."],
 ["Rate limits","Les limites de débit","Comment fonctionnent les limites et que faire quand vous les atteignez."],
 ["Practice: an eval set for your project","Pratique : un jeu d’évaluation pour votre projet","Écrivez 30 à 50 cas réels avec la réponse attendue, notez-les en code ou avec un juge calibré, et relancez-les après chaque changement."],
 ["Project: a support agent ready for production","Projet : un agent de support prêt pour la production","Outils, garde-fous, logs, coût par ticket, une évaluation dans GitHub Actions et Docker (voir les projets de portfolio plus bas)."],
 ["Project: a documented model migration","Projet : une migration de modèle documentée","Passez l’un de vos projets à un modèle ou à une version de SDK plus récents avec une évaluation, un canary et une entrée de CHANGELOG avec les chiffres."]]'::jsonb);
