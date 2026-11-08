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
