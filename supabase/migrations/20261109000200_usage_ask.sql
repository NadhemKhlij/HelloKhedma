-- "Ask about this lesson" (ROADMAP 4b step 4): the explain-mistake Edge Function (mode "ask") bumps the anonymous daily
-- counter usage_daily with kind 'ask_lesson' (day + count only), shown on the admin page. Until this migration runs, the
-- questions still work: the count_usage() call fails quietly. Keeps every earlier kind. Safe to run more than once.
alter table public.usage_daily drop constraint if exists usage_daily_kind_check;
alter table public.usage_daily add constraint usage_daily_kind_check
  check (kind in ('job_search', 'cv_tailor', 'explain', 'explain_saved', 'ask_lesson'));
