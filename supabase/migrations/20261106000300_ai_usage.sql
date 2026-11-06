-- Claude API usage on the admin page (#/admin, js/admin.js), 2026-11-06.
-- - ai_usage_daily: tokens used by the cv-tailor function per day and model (calls, input, output, cache read, cache
--   write). Numbers only: no account, no CV text. Filled by count_ai_tokens() (service role only) after every Claude
--   reply. The admin page turns them into an estimated cost with Anthropic's price list.
-- - admin_settings: small key → JSON settings for the admin page; "claude_credit" = { amount_usd, since } (the owner's
--   last top-up), used to estimate the remaining credit (Anthropic has no API for the real balance).
-- - admin_ai_usage(): admins only (error 42501 otherwise): the credit setting and the usage rows since the top-up or
--   the last 30 days, whichever is longer. admin_set_credit(amount, since): admins only.
-- RLS on both tables with no policy: no direct API access. Safe to run twice.

create table if not exists public.ai_usage_daily (
  day          date not null default current_date,
  model        text not null check (char_length(model) between 1 and 80),
  calls        integer not null default 0,
  input_tokens bigint not null default 0,
  output_tokens bigint not null default 0,
  cache_read_tokens bigint not null default 0,
  cache_write_tokens bigint not null default 0,
  primary key (day, model)
);
alter table public.ai_usage_daily enable row level security; -- no policy on purpose

create table if not exists public.admin_settings (
  key        text primary key,
  value      jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.admin_settings enable row level security; -- no policy on purpose

create or replace function public.count_ai_tokens(p_model text, p_input bigint, p_output bigint, p_cache_read bigint, p_cache_write bigint)
returns void language sql security definer set search_path = '' as $$
  insert into public.ai_usage_daily as u (day, model, calls, input_tokens, output_tokens, cache_read_tokens, cache_write_tokens)
  values (current_date, left(coalesce(nullif(p_model, ''), 'unknown'), 80), 1,
          greatest(coalesce(p_input, 0), 0), greatest(coalesce(p_output, 0), 0),
          greatest(coalesce(p_cache_read, 0), 0), greatest(coalesce(p_cache_write, 0), 0))
  on conflict (day, model) do update set
    calls = u.calls + 1,
    input_tokens = u.input_tokens + excluded.input_tokens,
    output_tokens = u.output_tokens + excluded.output_tokens,
    cache_read_tokens = u.cache_read_tokens + excluded.cache_read_tokens,
    cache_write_tokens = u.cache_write_tokens + excluded.cache_write_tokens;
$$;
revoke all on function public.count_ai_tokens(text, bigint, bigint, bigint, bigint) from public, anon, authenticated;
grant execute on function public.count_ai_tokens(text, bigint, bigint, bigint, bigint) to service_role;

create or replace function public.admin_ai_usage()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  credit jsonb;
  since date;
begin
  if not public.is_admin() then
    raise exception 'admin only' using errcode = '42501';
  end if;
  select value into credit from public.admin_settings where key = 'claude_credit';
  since := least(current_date - 30, coalesce((credit->>'since')::date, current_date - 30));
  return jsonb_build_object(
    'credit', credit,
    'rows', coalesce((select jsonb_agg(to_jsonb(u) order by u.day, u.model)
      from public.ai_usage_daily u where u.day >= since), '[]'::jsonb));
end;
$$;
revoke all on function public.admin_ai_usage() from public, anon;
grant execute on function public.admin_ai_usage() to authenticated;

create or replace function public.admin_set_credit(p_amount numeric, p_since date)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then
    raise exception 'admin only' using errcode = '42501';
  end if;
  if p_amount is null or p_amount < 0 or p_amount > 100000 or p_since is null or p_since > current_date then
    raise exception 'bad credit' using errcode = '22023';
  end if;
  insert into public.admin_settings (key, value, updated_at)
  values ('claude_credit', jsonb_build_object('amount_usd', p_amount, 'since', p_since), now())
  on conflict (key) do update set value = excluded.value, updated_at = now();
end;
$$;
revoke all on function public.admin_set_credit(numeric, date) from public, anon;
grant execute on function public.admin_set_credit(numeric, date) to authenticated;
