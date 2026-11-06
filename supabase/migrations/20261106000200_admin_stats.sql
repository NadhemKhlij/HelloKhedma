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
