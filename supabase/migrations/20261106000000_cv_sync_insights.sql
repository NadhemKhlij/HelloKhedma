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
