-- HelloKhedma: initial schema

create type public.resource_kind as enum ('training', 'tool', 'tip', 'keyword');
create type public.application_stage as enum ('saved', 'applied', 'interview', 'offer', 'rejected');

-- Public content (edit in seed.sql or the Supabase dashboard) ------------------
create table public.career_paths (
  id          text primary key,
  name        text not null,
  blurb       text not null default '',
  color       text not null default '#7c5cff',
  job_titles  text[] not null default '{}',
  sort_order  int not null default 0
);

create table public.path_resources (
  id          uuid primary key default gen_random_uuid(),
  path_id     text not null references public.career_paths(id) on delete cascade,
  kind        public.resource_kind not null,
  title       text not null,
  description text not null default '',
  url         text,
  sort_order  int not null default 0
);
create index path_resources_lookup on public.path_resources (path_id, kind, sort_order);

-- User-owned data ----------------------------------------------------------------
create table public.profiles (
  user_id       uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  selected_path text references public.career_paths(id) on delete set null,
  location      text not null default '',
  updated_at    timestamptz not null default now()
);

create table public.applications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  path_id     text references public.career_paths(id) on delete set null,
  title       text not null,
  company     text not null default '',
  location    text not null default '',
  url         text,
  source      text,
  external_id text,
  stage       public.application_stage not null default 'saved',
  notes       text not null default '',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index applications_user_stage on public.applications (user_id, stage);
-- one tracked card per job offer per user
create unique index applications_unique_offer
  on public.applications (user_id, source, external_id) where external_id is not null;

create table public.training_progress (
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  resource_id uuid not null references public.path_resources(id) on delete cascade,
  done        boolean not null default true,
  updated_at  timestamptz not null default now(),
  primary key (user_id, resource_id)
);

-- updated_at trigger -------------------------------------------------------------
create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
create trigger applications_touch before update on public.applications
  for each row execute function public.touch_updated_at();
create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();

-- Row Level Security -------------------------------------------------------------
alter table public.career_paths      enable row level security;
alter table public.path_resources    enable row level security;
alter table public.profiles          enable row level security;
alter table public.applications      enable row level security;
alter table public.training_progress enable row level security;

create policy "paths are public" on public.career_paths
  for select to anon, authenticated using (true);
create policy "resources are public" on public.path_resources
  for select to anon, authenticated using (true);

create policy "own profile" on public.profiles for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "own applications" on public.applications for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "own progress" on public.training_progress for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
