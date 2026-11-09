-- Offer alerts (ROADMAP 3.2, 2026-11-09): a signed-in user turns on "🔔 E-mail me new offers" on a saved search (Offers
-- page, js/alerts.js). Every morning the search-alerts Edge Function (called by .github/workflows/reminders.yml) runs
-- each alert through job-search and e-mails the offers not sent before (one e-mail per user, all their alerts).
--   label         what the user sees ("Data Engineer · Paris · FR")
--   params        the search: { query, alt, path, location, country } (no free text beyond these)
--   lang          language of the e-mail ('en' or 'fr', the interface language when the alert was made)
--   seen          ids of the offers already sent or already there on the first run (newest 400), so only new ones go out
--   last_run_on   last day the function ran this alert; last_sent_on: last day it e-mailed offers for it
-- At most 3 alerts per user (trigger). RLS: each user reads and changes only their own alerts; deleting the account
-- deletes them (on delete cascade). profiles.alerts_test_on: last day "Send me today's offers now" was used (one a day).
-- usage_daily gets two kinds for the admin page: 'alert_search' (alert searches run) and 'alert_email' (e-mails sent).
-- Safe to run more than once.
create table if not exists public.search_alerts (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users(id) on delete cascade,
  label        text not null check (char_length(label) between 1 and 200),
  params       jsonb not null check (jsonb_typeof(params) = 'object' and pg_column_size(params) < 2000),
  lang         text not null default 'en' check (lang in ('en', 'fr')),
  seen         text[] not null default '{}',
  last_run_on  date,
  last_sent_on date,
  created_at   timestamptz not null default now()
);
create index if not exists search_alerts_user on public.search_alerts (user_id);
create index if not exists search_alerts_run on public.search_alerts (last_run_on nulls first);

alter table public.search_alerts enable row level security;
drop policy if exists "own alerts" on public.search_alerts;
create policy "own alerts" on public.search_alerts for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create or replace function public.search_alerts_limit()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if (select count(*) from public.search_alerts where user_id = new.user_id) >= 3 then
    raise exception 'At most 3 offer alerts per account.' using errcode = 'P0001';
  end if;
  return new;
end $$;
drop trigger if exists search_alerts_limit on public.search_alerts;
create trigger search_alerts_limit before insert on public.search_alerts
  for each row execute function public.search_alerts_limit();

alter table public.profiles add column if not exists alerts_test_on date;

alter table public.usage_daily drop constraint if exists usage_daily_kind_check;
alter table public.usage_daily add constraint usage_daily_kind_check
  check (kind in ('job_search', 'cv_tailor', 'explain', 'explain_saved', 'ask_lesson', 'source_call', 'source_saved',
                  'alert_search', 'alert_email'));
