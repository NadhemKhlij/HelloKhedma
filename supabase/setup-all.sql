-- HelloKhedma: one-shot setup for the Supabase SQL Editor on a NEW, empty project.
-- Same content as the three migrations + seed.sql, in order. Run it once; afterwards re-run only seed.sql.
-- (If you use the Supabase CLI, run 'supabase db push' + seed.sql instead of this file.)

-- ================= supabase/migrations/20261028000000_init.sql =================

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

-- ================= supabase/migrations/20261028000100_training_tracks.sql =================

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

-- ================= supabase/migrations/20261028000200_job_search_guard.sql =================

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

-- ================= supabase/seed.sql =================

-- Idempotent seed: safe to re-run. Resource ids are derived from (path, kind, title),
-- so user progress is kept when you edit descriptions, urls or ordering.
-- Tools: [title, description]
-- Tips and keywords: plain strings.  Avoid apostrophes inside the JSON strings.

create or replace function pg_temp.seed(p text, k public.resource_kind, items jsonb)
returns void language sql as $$
  insert into public.path_resources (id, path_id, kind, title, description, url, sort_order)
  select
    md5(p || ':' || k::text || ':' || coalesce(x.e->>0, x.e #>> '{}'))::uuid,
    p, k,
    coalesce(x.e->>0, x.e #>> '{}'),
    coalesce(x.e->>1, ''),
    case when x.e->>2 is not null
         then 'https://www.google.com/search?q=' || replace(x.e->>2, ' ', '+') end,
    x.ord::int
  from jsonb_array_elements(items) with ordinality as x(e, ord)
  on conflict (id) do update
    set description = excluded.description, url = excluded.url, sort_order = excluded.sort_order;
$$;

insert into public.career_paths (id, name, blurb, color, job_titles, sort_order) values
 ('de','Data Engineer','Pipelines, warehouses, cloud','#7c5cff',
   array['Data Engineer','Ingénieur Data','Analytics Engineer','Cloud Data Engineer'],1),
 ('ba','Business Analyst','Requirements, process, stakeholders','#18a999',
   array['Business Analyst','Analyste Métier','Functional Analyst','Product Analyst'],2),
 ('as','Application Support','Incidents, monitoring, run','#f08a24',
   array['Application Support Analyst','Support Applicatif','L2 Support Engineer','Production Support Engineer'],3),
 ('da','Data Analyst','Insights, dashboards, storytelling','#e0508b',
   array['Data Analyst','Analyste de Données','BI Analyst','Reporting Analyst'],4)
on conflict (id) do update set
  name = excluded.name, blurb = excluded.blurb, color = excluded.color,
  job_titles = excluded.job_titles, sort_order = excluded.sort_order;

-- Data Engineer ---------------------------------------------------------------
select pg_temp.seed('de','tool','[
 ["PostgreSQL / DuckDB","Practice locally for free"],["Airflow or Dagster","Orchestration"],
 ["dbt Core","Transformations and tests"],["Docker","Reproducible environments"],
 ["GitHub","Portfolio of pipeline projects"]]'::jsonb);
select pg_temp.seed('de','tip','[
 "Build one end-to-end project: API, storage, transform, dashboard. Document it in the README.",
 "Show data quality checks and tests; recruiters look for reliability, not only tools.",
 "Quantify results on your CV: rows per day, runtime cut, cost saved."]'::jsonb);
select pg_temp.seed('de','keyword','["SQL","Python","ETL","ELT","Airflow","dbt","Spark","Snowflake","BigQuery","Kafka","Docker","Git","CI/CD","Data modeling","AWS","GCP","Azure"]'::jsonb);

-- Business Analyst ---------------------------------------------------------------
select pg_temp.seed('ba','tool','[
 ["Jira + Confluence","Backlog and documentation"],["Miro / draw.io","Workshops and flow diagrams"],
 ["Power BI","Show impact with data"],["Excel","Fast analysis and prototyping"],
 ["Figma","Read and comment wireframes"]]'::jsonb);
select pg_temp.seed('ba','tip','[
 "Prepare two STAR stories: a requirement conflict you solved and a process you improved.",
 "Show you can talk to both business and tech: plain words first, then precise ones.",
 "Bring a sample artifact: a BPMN diagram or a user story set from a personal project."]'::jsonb);
select pg_temp.seed('ba','keyword','["Requirements gathering","User stories","BPMN","Stakeholder management","SQL","Jira","Confluence","UAT","Agile","Scrum","Process mapping","Power BI","Gap analysis"]'::jsonb);

-- Application Support ------------------------------------------------------------
select pg_temp.seed('as','tool','[
 ["ServiceNow / Jira Service Management","Ticketing"],["Grafana / Kibana","Monitoring and logs"],
 ["Postman","Test APIs when diagnosing"],["Bash + SQL","Daily investigation toolkit"],
 ["Splunk","Common in large companies"]]'::jsonb);
select pg_temp.seed('as','tip','[
 "Describe an incident end to end: symptom, diagnosis, fix, prevention. That is the interview.",
 "Mention calm under pressure and clear written updates; they matter as much as technical skill.",
 "Automate one repetitive task with a script and put it on your CV."]'::jsonb);
select pg_temp.seed('as','keyword','["Incident management","ITIL","ServiceNow","SQL","Linux","Log analysis","Monitoring","Root cause analysis","Bash","SLA","Python","On-call"]'::jsonb);

-- Data Analyst ------------------------------------------------------------------------
select pg_temp.seed('da','tool','[
 ["Power BI / Tableau","Dashboards"],["Excel / Google Sheets","Quick analysis"],
 ["Jupyter","Exploration notebooks"],["Metabase / Looker Studio","Free reporting"],
 ["Kaggle / data.gouv.fr","Public datasets for projects"]]'::jsonb);
select pg_temp.seed('da','tip','[
 "Publish 2 or 3 dashboards on public data, each answering a clear business question.",
 "Lead with the insight, then the method; recruiters skim.",
 "Practise explaining a metric definition out loud: it is a classic interview test."]'::jsonb);
select pg_temp.seed('da','keyword','["SQL","Excel","Power BI","Tableau","Python","Pandas","A/B testing","Statistics","Data storytelling","KPI","Looker Studio","Data cleaning"]'::jsonb);

-- =====================================================================================
-- Learning tracks. Step = [title, description, kind, provider, url, est_hours, is_free?]
-- kind: learn | practice | project | certification.  Hours are rough estimates.
-- Step ids are derived from (track id, title): renaming a step resets its progress.
-- =====================================================================================
create or replace function pg_temp.track(
  p text, tid text, ttl text, lvl public.training_level, summ text, outc text, ord int, steps jsonb)
returns void language plpgsql as $$
begin
  insert into public.training_tracks (id, path_id, title, summary, outcome, level, sort_order)
  values (tid, p, ttl, summ, outc, lvl, ord)
  on conflict (id) do update set title = excluded.title, summary = excluded.summary,
    outcome = excluded.outcome, level = excluded.level, sort_order = excluded.sort_order;

  insert into public.training_steps (id, track_id, title, description, kind, provider, url, est_hours, is_free, sort_order)
  select md5(tid || ':' || (s.e->>0))::uuid, tid, s.e->>0, coalesce(s.e->>1, ''),
         (s.e->>2)::public.step_kind, coalesce(s.e->>3, ''), nullif(s.e->>4, ''),
         (s.e->>5)::numeric, coalesce((s.e->>6)::boolean, true), s.ord::int
  from jsonb_array_elements(steps) with ordinality as s(e, ord)
  on conflict (id) do update set description = excluded.description, kind = excluded.kind,
    provider = excluded.provider, url = excluded.url, est_hours = excluded.est_hours,
    is_free = excluded.is_free, sort_order = excluded.sort_order;
end;
$$;

-- Data Engineer -------------------------------------------------------------------------
select pg_temp.track('de','de-foundations','Foundations: SQL, Python, Git','beginner',
 'The core toolkit every data engineering interview checks first.',
 'Query and transform data with SQL, write clean Python scripts, and keep everything in Git.',1,'[
 ["SQL basics","Select, filter, join and aggregate with interactive lessons.","learn","Kaggle Learn","https://www.kaggle.com/learn/intro-to-sql",4],
 ["Advanced SQL: CTEs and window functions","Analytic functions, nested data and query structure.","learn","Kaggle Learn","https://www.kaggle.com/learn/advanced-sql",5],
 ["Python tutorial","The official walkthrough: data structures, modules, errors, files.","learn","Python docs","https://docs.python.org/3/tutorial/",8],
 ["pandas getting started","Load, clean, reshape and export tabular data.","learn","pandas docs","https://pandas.pydata.org/docs/getting_started/index.html",5],
 ["Git fundamentals","Commits, branches and pull requests.","learn","Pro Git book","https://git-scm.com/book/en/v2",4],
 ["Practice: clean a messy CSV and load it into PostgreSQL","Pick a public dataset, script the cleaning in Python, load it into Postgres, commit with a README.","practice","Your repo","",4]]'::jsonb);
select pg_temp.track('de','de-pipelines','Pipelines and orchestration','intermediate',
 'Move from scripts to scheduled, tested, reproducible pipelines.',
 'Build a scheduled ELT pipeline with a warehouse, dbt models and tests.',2,'[
 ["Docker: get started","Containers for reproducible local pipelines.","learn","Docker docs","https://docs.docker.com/get-started/",3],
 ["Airflow tutorial","Write your first DAG, tasks, schedules and dependencies.","learn","Apache Airflow","https://airflow.apache.org/docs/apache-airflow/stable/tutorial/index.html",4],
 ["dbt Fundamentals","Models, tests, documentation and deployment.","learn","dbt Learn","https://learn.getdbt.com",6],
 ["BigQuery sandbox","Load data into a cloud warehouse without a credit card.","practice","Google Cloud","https://cloud.google.com/bigquery/docs/sandbox",3],
 ["Data Engineering Zoomcamp","Free, project-based course covering Docker, Postgres, orchestration, dbt, Spark and Kafka. Do it alongside or instead of the steps above.","learn","DataTalks.Club","https://github.com/DataTalksClub/data-engineering-zoomcamp",40]]'::jsonb);
select pg_temp.track('de','de-advanced','Scale, streaming and certification','advanced',
 'What separates a junior portfolio from a hireable one.',
 'Design reliable pipelines, explain trade-offs, and back it with a project and a cloud certification.',3,'[
 ["Spark quick start","DataFrames and SQL on a distributed engine.","learn","Apache Spark","https://spark.apache.org/docs/latest/quick-start.html",5],
 ["Kafka quickstart","Topics, producers and consumers.","learn","Apache Kafka","https://kafka.apache.org/quickstart",3],
 ["Designing Data-Intensive Applications","Reference book on storage, replication and streaming. Read the chapters you need.","learn","dataintensive.net","https://dataintensive.net",20,false],
 ["Portfolio project: end-to-end pipeline","Ingest a public API daily, orchestrate it, transform with dbt, add data tests and a dashboard. Write down your trade-offs.","project","Your repo","",25],
 ["Cloud data engineer certification","Pick one cloud (Google Professional Data Engineer shown; AWS and Azure have equivalents).","certification","Google Cloud","https://cloud.google.com/learn/certification/data-engineer",30,false]]'::jsonb);

-- Business Analyst ------------------------------------------------------------------------
select pg_temp.track('ba','ba-foundations','Core business analysis','beginner',
 'Requirements, stories and the agile vocabulary used in every team.',
 'Elicit requirements and write clear user stories with acceptance criteria.',1,'[
 ["User stories","Write stories with a clear who, what and why.","learn","Atlassian","https://www.atlassian.com/agile/project-management/user-stories",1],
 ["The Scrum Guide","The short source of truth for Scrum roles and events.","learn","scrumguides.org","https://scrumguides.org",1],
 ["Jira and agile tutorials","Epics, stories, boards and workflows.","learn","Atlassian","https://www.atlassian.com/agile/tutorials",2],
 ["SQL practice","Check requirements against real data.","learn","SQLZoo","https://sqlzoo.net",5],
 ["Practice: write 10 user stories for an app you use","Include acceptance criteria and a prioritised backlog.","practice","Your notes","",3]]'::jsonb);
select pg_temp.track('ba','ba-process','Process modeling and reporting','intermediate',
 'Show how work flows today, where it breaks, and what changes would be worth it.',
 'Map as-is and to-be processes and quantify the impact with a report.',2,'[
 ["BPMN overview","Notation for events, tasks and gateways.","learn","Camunda","https://camunda.com/bpmn/",2],
 ["Practice: model a process in draw.io","Draw the as-is flow of a process you know and mark the pain points.","practice","draw.io","https://www.drawio.com",3],
 ["Power BI documentation and training","Build a report from Excel or SQL data.","learn","Microsoft Learn","https://learn.microsoft.com/power-bi/",8],
 ["Practice: as-is, to-be and gap list","Produce a one-page process change proposal with expected KPIs.","practice","Your notes","",4]]'::jsonb);
select pg_temp.track('ba','ba-advanced','Case study and certification','advanced',
 'Proof that you can run a requirement from idea to delivery.',
 'Present a complete requirements pack and hold a recognised credential.',3,'[
 ["Case study: full requirements pack","Stakeholder map, BPMN flows, user stories, acceptance criteria and KPIs for one realistic project.","project","Your repo","",15],
 ["IIBA entry-level certification (ECBA)","Check the current exam requirements on the IIBA site.","certification","IIBA","https://www.iiba.org/",30,false],
 ["Professional Scrum certification","Optional if the target roles mention Product Owner or Scrum.","certification","Scrum.org","https://www.scrum.org",15,false],
 ["Practice: interview stories","Prepare two STAR stories and walk through your case study out loud.","practice","Your notes","",3]]'::jsonb);

-- Application Support -------------------------------------------------------------------------
select pg_temp.track('as','as-foundations','Linux, SQL and incident basics','beginner',
 'The daily toolkit of an L1/L2 support analyst.',
 'Navigate a Linux server, read logs, query a database and follow an incident process.',1,'[
 ["Linux Journey","Beginner-friendly Linux lessons.","learn","linuxjourney.com","https://linuxjourney.com",8],
 ["OverTheWire: Bandit","Learn the shell by solving small challenges.","practice","OverTheWire","https://overthewire.org/wargames/bandit/",6],
 ["SQL basics","Select, filter, join and aggregate.","learn","Kaggle Learn","https://www.kaggle.com/learn/intro-to-sql",4],
 ["Incident management guide","Severity levels, roles, communication and escalation.","learn","Atlassian","https://www.atlassian.com/incident-management",2]]'::jsonb);
select pg_temp.track('as','as-monitoring','Monitoring, APIs and automation','intermediate',
 'Spot problems before users do, and stop repeating manual work.',
 'Read dashboards and logs, test APIs and automate a recurring task.',2,'[
 ["Prometheus: first steps","Metrics, targets and queries.","learn","Prometheus","https://prometheus.io/docs/introduction/first_steps/",2],
 ["Grafana tutorials","Build dashboards and alerts.","learn","Grafana Labs","https://grafana.com/tutorials/",4],
 ["Postman Learning Center","Send requests, inspect responses, write simple tests.","learn","Postman","https://learning.postman.com",3],
 ["Python tutorial","Enough Python to automate checks and parse logs.","learn","Python docs","https://docs.python.org/3/tutorial/",6],
 ["Practice: log summary script","Write a Bash or Python script that scans a log file and reports error counts by type.","practice","Your repo","",4]]'::jsonb);
select pg_temp.track('as','as-advanced','Reliability and certification','advanced',
 'Move from fixing incidents to preventing them.',
 'Run an incident, write a blameless post-mortem and hold an ITIL credential.',3,'[
 ["SRE book: effective troubleshooting","A systematic method for diagnosing production problems.","learn","Google SRE","https://sre.google/sre-book/effective-troubleshooting/",1.5],
 ["SRE book: postmortem culture","How to write blameless post-mortems that lead to change.","learn","Google SRE","https://sre.google/sre-book/postmortem-culture/",1],
 ["Project: runbook and post-mortem","Break a small Dockerised app on purpose, monitor it with Grafana, then write the runbook and a post-mortem.","project","Your repo","",10],
 ["ITIL 4 Foundation","Check current exam details with the certification body.","certification","PeopleCert","https://www.peoplecert.org",20,false]]'::jsonb);

-- Data Analyst --------------------------------------------------------------------------------
select pg_temp.track('da','da-foundations','SQL, statistics and clean data','beginner',
 'Answer business questions correctly before making them pretty.',
 'Query data with SQL, clean it, and use basic statistics to support a conclusion.',1,'[
 ["Intro to SQL","Select, filter, join and aggregate.","learn","Kaggle Learn","https://www.kaggle.com/learn/intro-to-sql",4],
 ["Advanced SQL","CTEs and window functions for analysis.","learn","Kaggle Learn","https://www.kaggle.com/learn/advanced-sql",5],
 ["Statistics and probability","Distributions, sampling, confidence and tests.","learn","Khan Academy","https://www.khanacademy.org/math/statistics-probability",10],
 ["Data cleaning","Missing values, scaling, parsing dates and inconsistent text.","learn","Kaggle Learn","https://www.kaggle.com/learn/data-cleaning",4],
 ["Practice: analyse a public dataset in SQL","Choose a dataset, write 5 business questions and answer them with queries.","practice","data.gouv.fr","https://www.data.gouv.fr",5]]'::jsonb);
select pg_temp.track('da','da-viz','Python, BI and visual storytelling','intermediate',
 'Turn analysis into something a manager can act on.',
 'Build dashboards that lead to a decision and explain them clearly.',2,'[
 ["pandas","Manipulate and summarise data in Python.","learn","Kaggle Learn","https://www.kaggle.com/learn/pandas",4],
 ["Data visualization","Charts that show the right comparison.","learn","Kaggle Learn","https://www.kaggle.com/learn/data-visualization",4],
 ["Power BI","Pick Power BI or Tableau and stay with one. Power BI documentation and training.","learn","Microsoft Learn","https://learn.microsoft.com/power-bi/",8],
 ["Tableau free training","The alternative if your target employers use Tableau.","learn","Tableau","https://www.tableau.com/learn/training",8],
 ["Storytelling with Data","Declutter charts, focus attention, lead with the insight.","learn","storytellingwithdata.com","https://www.storytellingwithdata.com",3]]'::jsonb);
select pg_temp.track('da','da-advanced','Portfolio and certification','advanced',
 'Evidence beats claims. Ship three small, finished projects.',
 'Show dashboards on public data and hold a recognised credential.',3,'[
 ["Portfolio: three dashboards on public data","Each answers one clear business question and ends with a recommendation.","project","Your portfolio","",20],
 ["Google Data Analytics Certificate","Beginner-friendly professional certificate. Hours are approximate and vary by pace.","certification","Coursera","https://www.coursera.org/professional-certificates/google-data-analytics",150,false],
 ["Microsoft Power BI Data Analyst (PL-300)","Recognised if you chose Power BI.","certification","Microsoft Learn","https://learn.microsoft.com/credentials/certifications/data-analyst-associate/",30,false],
 ["Practice: SQL and metric definition drills","Define conversion, retention and churn out loud, then write the SQL for each.","practice","Your notes","",4]]'::jsonb);
