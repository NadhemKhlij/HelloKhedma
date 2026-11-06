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
