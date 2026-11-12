-- Site activity (2026-11-12, owner: "the stats page is not showing correct numbers"). js/usage.js, js/admin.js.
-- - profiles.last_seen_at: when a signed-in account last used the site. touch_seen() (signed-in users, the app calls it
--   at most once a day) sets it to now() for the caller's own row only. "Active accounts" on the admin page now counts
--   the later of the last sign-in and last_seen_at, so people who stay signed in on their phone count as active.
-- - feature_daily: anonymous daily counters of feature use (day, kind, count; no account, no IP), for guests and
--   signed-in users alike, bumped by count_feature() from the browser at most once per feature per day per browser.
--   Only the kinds listed in count_feature() are counted (anything else is ignored). Anyone can call it, so a counter
--   can be inflated on purpose: these are indications, not billing figures (the server-side usage_daily stays separate).
-- - admin_stats(): as in 20261106000200, with the active accounts above and the feature counts of the last 30 days.
-- Safe to run more than once. Until it runs, the app works as before (the calls fail quietly).

alter table public.profiles add column if not exists last_seen_at timestamptz;

create or replace function public.touch_seen()
returns void language sql security definer set search_path = '' as $$
  insert into public.profiles (user_id, last_seen_at) values (auth.uid(), now())
  on conflict (user_id) do update set last_seen_at = now();
$$;
revoke all on function public.touch_seen() from public, anon;
grant execute on function public.touch_seen() to authenticated;

create table if not exists public.feature_daily (
  day  date not null default current_date,
  kind text not null,
  n    integer not null default 0,
  primary key (day, kind)
);
alter table public.feature_daily enable row level security; -- no policy on purpose: only the functions below

create or replace function public.count_feature(p_kind text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if p_kind not in ('visit', 'job_search_page', 'tailor_open', 'tailor_prompt', 'tailor_signin', 'cover_letter', 'cv_check',
                    'cv_pdf', 'tracker_add', 'lesson_done', 'quiz_done', 'review', 'interview', 'skillcheck') then
    return;
  end if;
  insert into public.feature_daily (day, kind, n) values (current_date, p_kind, 1)
  on conflict (day, kind) do update set n = public.feature_daily.n + 1;
end;
$$;
revoke all on function public.count_feature(text) from public;
grant execute on function public.count_feature(text) to anon, authenticated;

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
        'confirmed', count(*) filter (where u.email_confirmed_at is not null),
        'new_7d', count(*) filter (where u.created_at > now() - interval '7 days'),
        'new_30d', count(*) filter (where u.created_at > now() - interval '30 days'),
        -- active = signed in OR used the site while signed in (touch_seen), whichever is later
        'active_7d', count(*) filter (where greatest(u.last_sign_in_at, p.last_seen_at) > now() - interval '7 days'),
        'active_30d', count(*) filter (where greatest(u.last_sign_in_at, p.last_seen_at) > now() - interval '30 days'))
      from auth.users u left join public.profiles p on p.user_id = u.id),
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
    'features_daily', coalesce((select jsonb_agg(jsonb_build_object('day', day, 'kind', kind, 'n', n) order by day)
      from public.feature_daily where day > current_date - 30), '[]'::jsonb),
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
