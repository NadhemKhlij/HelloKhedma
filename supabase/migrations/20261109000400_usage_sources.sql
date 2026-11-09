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
