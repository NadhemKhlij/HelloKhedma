-- "Explain my mistake" (training step 4): the explain-mistake Edge Function bumps the anonymous daily counter
-- usage_daily with kind 'explain' (day + count only, like 'job_search' and 'cv_tailor'), shown on the admin page.
-- Until this migration runs, the function still works: its count_usage() call fails quietly. Safe to run more than once.
alter table public.usage_daily drop constraint if exists usage_daily_kind_check;
alter table public.usage_daily add constraint usage_daily_kind_check check (kind in ('job_search', 'cv_tailor', 'explain'));
