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
