-- Structured learning tracks: track (level) -> ordered steps (learn / practice / project / certification).
-- Replaces the flat 'training' rows in path_resources and the old training_progress table.

create type public.training_level as enum ('beginner', 'intermediate', 'advanced');
create type public.step_kind as enum ('learn', 'practice', 'project', 'certification');

create table public.training_tracks (
  id         text primary key,                       -- e.g. 'de-foundations'
  path_id    text not null references public.career_paths(id) on delete cascade,
  title      text not null,
  summary    text not null default '',
  outcome    text not null default '',               -- "You will be able to ..."
  level      public.training_level not null,
  sort_order int not null default 0
);
create index training_tracks_path on public.training_tracks (path_id, sort_order);

create table public.training_steps (
  id          uuid primary key default gen_random_uuid(),
  track_id    text not null references public.training_tracks(id) on delete cascade,
  title       text not null,
  description text not null default '',
  kind        public.step_kind not null default 'learn',
  provider    text not null default '',
  url         text,
  est_hours   numeric(5,1) not null default 1,       -- rough estimate
  is_free     boolean not null default true,
  sort_order  int not null default 0
);
create index training_steps_track on public.training_steps (track_id, sort_order);

create table public.step_progress (
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  step_id    uuid not null references public.training_steps(id) on delete cascade,
  done       boolean not null default true,
  updated_at timestamptz not null default now(),
  primary key (user_id, step_id)
);

alter table public.training_tracks enable row level security;
alter table public.training_steps  enable row level security;
alter table public.step_progress   enable row level security;

create policy "tracks are public" on public.training_tracks
  for select to anon, authenticated using (true);
create policy "steps are public" on public.training_steps
  for select to anon, authenticated using (true);
create policy "own step progress" on public.step_progress for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- Retire the old flat trainings
delete from public.path_resources where kind = 'training';
drop table public.training_progress;
