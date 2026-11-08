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
   array['Data Analyst','Analyste de Données','BI Analyst','Reporting Analyst'],4),
 ('do','DevOps Engineer','CI/CD, containers, cloud, automation','#3b82f6',
   array['DevOps Engineer','Ingénieur DevOps','Site Reliability Engineer','Platform Engineer','Cloud Engineer'],5),
 ('ai','AI Engineer','LLM apps, agents, RAG, evals','#16a34a',
   array['AI Engineer','Ingénieur IA','LLM Engineer','Generative AI Engineer','Applied AI Engineer'],6)
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

-- DevOps Engineer ------------------------------------------------------------------------
select pg_temp.seed('do','tool','[
 ["GitHub Actions / GitLab CI","Build, test and deploy pipelines"],["Docker","Package apps as images"],
 ["Kubernetes + Helm","Run containers at scale"],["Terraform","Infrastructure as Code"],
 ["Prometheus + Grafana","Metrics, dashboards and alerts"]]'::jsonb);
select pg_temp.seed('do','tip','[
 "Build one project end to end: a small API in Docker, a CI/CD pipeline, infrastructure in Terraform and a dashboard. Link it on your CV.",
 "Talk about incidents you handled and what you automated afterwards; DevOps interviews test judgement as much as tools.",
 "Quantify your impact: deployment time cut, releases per week, incidents avoided, cloud costs saved."]'::jsonb);
select pg_temp.seed('do','keyword','["CI/CD","Docker","Kubernetes","Terraform","AWS","Azure","GCP","Linux","Bash","Python","Git","Ansible","Helm","Prometheus","Grafana","Monitoring"]'::jsonb);

-- AI Engineer ---------------------------------------------------------------------------
-- Its nine courses are the AI engineer track (content/ai: English, French, Derja in Arabic letters and 3arbizi).
select pg_temp.seed('ai','tool','[
 ["Claude API + Python SDK","Build features with Claude: messages, streaming, tools, structured outputs"],
 ["Claude Code","A coding agent for the terminal, the IDE and the desktop"],
 ["pgvector","Vector search inside PostgreSQL, for RAG"],
 ["FastAPI","A small backend that keeps the API key and calls the model"],
 ["MCP (Model Context Protocol)","Connect ready-made tools and data sources to an agent"]]'::jsonb);
select pg_temp.seed('ai','tip','[
 "Show numbers, not demos: an eval set, the score, the cost per task and the limits in every project README.",
 "Build one project with Derja, French and Arabic users in mind: few candidates in Europe can show that, and Tunisian clients need it.",
 "In interviews, tell the story of a mistake the model made, how you measured it and how you fixed it."]'::jsonb);
select pg_temp.seed('ai','keyword','["LLM","Prompt engineering","Claude API","OpenAI API","AI agents","RAG","Vector database","LLMOps","LangChain","AI coding tools","Python","REST API","Docker","Git","SQL"]'::jsonb);

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

-- DevOps Engineer -----------------------------------------------------------------------------
select pg_temp.track('do','do-foundations','Linux, Git, networking and scripting','beginner',
 'The everyday base of every DevOps and cloud role.',
 'Work comfortably on a Linux server, version everything with Git, understand how requests travel and automate small tasks.',1,'[
 ["Linux Journey","Beginner-friendly Linux lessons.","learn","linuxjourney.com","https://linuxjourney.com",8],
 ["OverTheWire: Bandit","Learn the shell by solving small challenges.","practice","OverTheWire","https://overthewire.org/wargames/bandit/",6],
 ["Pro Git book","Chapters 1 to 3: basics and branching.","learn","git-scm.com","https://git-scm.com/book/en/v2",5],
 ["Learn Git Branching","Interactive exercises on branches, merges and rebases.","practice","learngitbranching.js.org","https://learngitbranching.js.org",3],
 ["Cloudflare Learning Center","How DNS, HTTP, TLS, load balancing and CDNs work.","learn","Cloudflare","https://www.cloudflare.com/learning/",4]]'::jsonb);
select pg_temp.track('do','do-delivery','Containers, CI/CD and Kubernetes','intermediate',
 'Ship applications the way modern teams do: in containers, through a pipeline, onto a cluster.',
 'Containerise an app, build and test it in a pipeline and deploy it to Kubernetes.',2,'[
 ["Docker: get started","Images, containers, volumes and Compose.","learn","Docker docs","https://docs.docker.com/get-started/",6],
 ["GitHub Actions documentation","Workflows, jobs, secrets and environments.","learn","GitHub Docs","https://docs.github.com/en/actions",4],
 ["Kubernetes basics","Deploy, expose, scale and update an app on a cluster.","learn","Kubernetes docs","https://kubernetes.io/docs/tutorials/kubernetes-basics/",6],
 ["Project: ship a containerised API","Dockerise a small API, add a pipeline that tests and builds the image, and deploy it to a local kind cluster.","project","Your repo","",12]]'::jsonb);
select pg_temp.track('do','do-cloud','Cloud, Infrastructure as Code and reliability','advanced',
 'Run real infrastructure from code and keep it healthy.',
 'Create cloud infrastructure with Terraform from a pipeline, monitor it with SLOs and hold a recognised certification.',3,'[
 ["Terraform tutorials","Get started with Terraform on AWS, Azure or Google Cloud.","learn","HashiCorp","https://developer.hashicorp.com/terraform/tutorials",8],
 ["AWS Skill Builder","Free cloud fundamentals courses, including Cloud Practitioner Essentials.","learn","AWS","https://skillbuilder.aws",10],
 ["Prometheus: first steps","Metrics, targets and queries.","learn","Prometheus","https://prometheus.io/docs/introduction/first_steps/",2],
 ["SRE book: service level objectives","Define SLIs, SLOs and error budgets.","learn","Google SRE","https://sre.google/sre-book/service-level-objectives/",1.5],
 ["Project: infrastructure as code","Create the cloud resources of your API with Terraform from a pipeline, with remote state, a dashboard and one alert.","project","Your repo","",15],
 ["AWS Certified Cloud Practitioner or CKA","Pick one: cloud fundamentals (AWS) or Kubernetes administration (CNCF). Check current exam details.","certification","AWS / CNCF","https://aws.amazon.com/certification/",25,false]]'::jsonb);

-- AI Engineer ---------------------------------------------------------------------------------
-- The nine HelloKhedma AI courses show under these tracks (course list of the path); steps point to official material.
select pg_temp.track('ai','ai-foundations','LLM basics, prompting and the Claude API','beginner',
 'How LLMs work, how to write prompts for an app, and how to call Claude from Python safely.',
 'Explain tokens, cost and hallucinations, write a system prompt with examples, and build a small Python app that returns JSON you can trust.',1,'[
 ["Anthropic courses: API fundamentals","Free notebooks from Anthropic: first calls, messages, models and parameters.","learn","Anthropic","https://github.com/anthropics/courses",6],
 ["Prompt engineering interactive tutorial","Chapters of exercises on clear prompts, roles, examples and avoiding hallucinations.","practice","Anthropic","https://github.com/anthropics/prompt-eng-interactive-tutorial",8],
 ["Anthropic Python SDK","Read the README and run the examples: client, streaming, errors and retries.","learn","GitHub","https://github.com/anthropics/anthropic-sdk-python",3],
 ["Structured outputs","Get JSON that follows your schema, and know what the schema does not guarantee.","learn","Claude docs","https://platform.claude.com/docs/en/build-with-claude/structured-outputs",2],
 ["Project: a ticket classifier for Derja, French and Arabic","Classify 30 real-looking support messages into a JSON ticket, with a small test set and the cost per message in the README.","project","Your repo","",10]]'::jsonb);
select pg_temp.track('ai','ai-build','Tools, agents and RAG','intermediate',
 'Give the model your functions and your data: tool use, MCP, embeddings and answers with sources.',
 'Build an agent loop with budgets and a RAG assistant that cites its sources and says when it does not know.',2,'[
 ["Tool use overview","Define tools, run the loop, return results and errors.","learn","Claude docs","https://platform.claude.com/docs/en/agents-and-tools/tool-use/overview",3],
 ["MCP Python SDK","Write a small MCP server and connect it to a client.","practice","GitHub","https://github.com/modelcontextprotocol/python-sdk",4],
 ["Embeddings","What embeddings are and where to get them (Claude has no embeddings endpoint).","learn","Claude docs","https://platform.claude.com/docs/en/build-with-claude/embeddings",2],
 ["pgvector","Store embeddings in PostgreSQL, search them and index them.","learn","GitHub","https://github.com/pgvector/pgvector",3],
 ["Citations","Answers that quote the passages they come from.","learn","Claude docs","https://platform.claude.com/docs/en/build-with-claude/citations",2],
 ["Claude cookbooks","Worked notebooks on RAG, tool use, agents and evaluation to read and adapt.","practice","Anthropic","https://github.com/anthropics/claude-cookbooks",8],
 ["Project: a documentation assistant with citations","RAG over a public documentation, with sources, an I do not know path and an eval set (see the portfolio projects below).","project","Your repo","",16]]'::jsonb);
select pg_temp.track('ai','ai-production','Evaluation, production and maintenance','advanced',
 'Measure quality, run the feature safely in production and keep it working when models change.',
 'Ship an AI feature with an eval in CI, logs, budgets, a canary and a rollback, and migrate it to a new model without breaking it.',3,'[
 ["Prompt caching","Lower cost and latency on the fixed part of the prompt, and check that it works.","learn","Claude docs","https://platform.claude.com/docs/en/build-with-claude/prompt-caching",2],
 ["Rate limits","How limits work and what to do when you reach them.","learn","Claude docs","https://platform.claude.com/docs/en/api/rate-limits",1],
 ["Practice: an eval set for your project","Write 30 to 50 real cases with the expected answer, grade them in code or with a calibrated judge, and run them after every change.","practice","Your repo","",6],
 ["Project: a support agent ready for production","Tools, guardrails, logs, cost per ticket, an eval in GitHub Actions and Docker (see the portfolio projects below).","project","Your repo","",20],
 ["Project: a documented model migration","Move one of your projects to a newer model or SDK version with an eval, a canary and a CHANGELOG entry with the numbers.","project","Your repo","",6]]'::jsonb);

-- =====================================================================================
-- French texts (shown when the interface is French). Needs migration 20261029000200_content_fr.sql.
-- Rows are matched on their English title (the id key): when you rename an English title, update it here too.
-- Resources: [english title, french title, french description]; tips: [english, french].
-- Steps: [english title, french title, french description]. Use ’ for apostrophes (never a straight quote).
-- Skill keywords and job titles stay English (CV matching and offer search rely on them).
-- =====================================================================================
update public.career_paths p set name_fr = v.n, blurb_fr = v.b
from (values
  ('de', 'Data Engineer', 'Pipelines, entrepôts de données, cloud'),
  ('ba', 'Business Analyst', 'Besoins, processus, parties prenantes'),
  ('as', 'Support applicatif', 'Incidents, supervision, run'),
  ('da', 'Data Analyst', 'Analyses, tableaux de bord, storytelling'),
  ('do', 'DevOps Engineer', 'CI/CD, conteneurs, cloud, automatisation'),
  ('ai', 'AI Engineer', 'Applications LLM, agents, RAG, évaluations')
) as v(id, n, b)
where p.id = v.id;

create or replace function pg_temp.res_fr(p text, k public.resource_kind, items jsonb)
returns void language sql as $$
  update public.path_resources r
  set title_fr = x.e->>1, description_fr = nullif(coalesce(x.e->>2, ''), '')
  from jsonb_array_elements(items) as x(e)
  where r.id = md5(p || ':' || k::text || ':' || (x.e->>0))::uuid;
$$;

create or replace function pg_temp.track_fr(tid text, ttl text, summ text, outc text, steps jsonb)
returns void language sql as $$
  update public.training_tracks set title_fr = ttl, summary_fr = summ, outcome_fr = outc where id = tid;
  update public.training_steps s
  set title_fr = x.e->>1, description_fr = nullif(coalesce(x.e->>2, ''), '')
  from jsonb_array_elements(steps) as x(e)
  where s.id = md5(tid || ':' || (x.e->>0))::uuid;
$$;

-- Data Engineer ---------------------------------------------------------------
select pg_temp.res_fr('de','tool','[
 ["PostgreSQL / DuckDB","PostgreSQL / DuckDB","Pratiquer gratuitement en local"],["Airflow or Dagster","Airflow ou Dagster","Orchestration"],
 ["dbt Core","dbt Core","Transformations et tests"],["Docker","Docker","Environnements reproductibles"],
 ["GitHub","GitHub","Portfolio de projets de pipelines"]]'::jsonb);
select pg_temp.res_fr('de','tip','[
 ["Build one end-to-end project: API, storage, transform, dashboard. Document it in the README.","Réalisez un projet de bout en bout : API, stockage, transformation, tableau de bord. Documentez-le dans le README."],
 ["Show data quality checks and tests; recruiters look for reliability, not only tools.","Montrez vos contrôles de qualité et vos tests : les recruteurs cherchent de la fiabilité, pas seulement des outils."],
 ["Quantify results on your CV: rows per day, runtime cut, cost saved.","Chiffrez vos résultats sur le CV : lignes par jour, temps d’exécution réduit, coûts économisés."]]'::jsonb);

-- Business Analyst ---------------------------------------------------------------
select pg_temp.res_fr('ba','tool','[
 ["Jira + Confluence","Jira + Confluence","Backlog et documentation"],["Miro / draw.io","Miro / draw.io","Ateliers et schémas de flux"],
 ["Power BI","Power BI","Montrer l’impact avec des données"],["Excel","Excel","Analyse rapide et prototypage"],
 ["Figma","Figma","Lire et commenter des maquettes"]]'::jsonb);
select pg_temp.res_fr('ba','tip','[
 ["Prepare two STAR stories: a requirement conflict you solved and a process you improved.","Préparez deux histoires STAR : un conflit sur un besoin que vous avez résolu et un processus que vous avez amélioré."],
 ["Show you can talk to both business and tech: plain words first, then precise ones.","Montrez que vous savez parler au métier comme à la technique : des mots simples d’abord, puis des termes précis."],
 ["Bring a sample artifact: a BPMN diagram or a user story set from a personal project.","Apportez un exemple de livrable : un diagramme BPMN ou un lot de user stories issu d’un projet personnel."]]'::jsonb);

-- Application Support ------------------------------------------------------------
select pg_temp.res_fr('as','tool','[
 ["ServiceNow / Jira Service Management","ServiceNow / Jira Service Management","Gestion des tickets"],["Grafana / Kibana","Grafana / Kibana","Supervision et logs"],
 ["Postman","Postman","Tester des API pendant un diagnostic"],["Bash + SQL","Bash + SQL","La boîte à outils quotidienne d’investigation"],
 ["Splunk","Splunk","Courant dans les grandes entreprises"]]'::jsonb);
select pg_temp.res_fr('as','tip','[
 ["Describe an incident end to end: symptom, diagnosis, fix, prevention. That is the interview.","Racontez un incident de bout en bout : symptôme, diagnostic, correction, prévention. C’est tout l’entretien."],
 ["Mention calm under pressure and clear written updates; they matter as much as technical skill.","Parlez de votre calme sous pression et de communications écrites claires : elles comptent autant que la technique."],
 ["Automate one repetitive task with a script and put it on your CV.","Automatisez une tâche répétitive avec un script et mettez-la sur votre CV."]]'::jsonb);

-- Data Analyst ------------------------------------------------------------------------
select pg_temp.res_fr('da','tool','[
 ["Power BI / Tableau","Power BI / Tableau","Tableaux de bord"],["Excel / Google Sheets","Excel / Google Sheets","Analyse rapide"],
 ["Jupyter","Jupyter","Notebooks d’exploration"],["Metabase / Looker Studio","Metabase / Looker Studio","Reporting gratuit"],
 ["Kaggle / data.gouv.fr","Kaggle / data.gouv.fr","Jeux de données publics pour vos projets"]]'::jsonb);
select pg_temp.res_fr('da','tip','[
 ["Publish 2 or 3 dashboards on public data, each answering a clear business question.","Publiez 2 ou 3 tableaux de bord sur des données publiques, chacun répondant à une question métier claire."],
 ["Lead with the insight, then the method; recruiters skim.","Commencez par l’enseignement, puis la méthode : les recruteurs lisent en diagonale."],
 ["Practise explaining a metric definition out loud: it is a classic interview test.","Entraînez-vous à expliquer à voix haute la définition d’un indicateur : c’est un test classique en entretien."]]'::jsonb);

-- Learning tracks: Data Engineer ---------------------------------------------------
select pg_temp.track_fr('de-foundations','Fondamentaux : SQL, Python, Git',
 'La boîte à outils que chaque entretien de data engineer vérifie en premier.',
 'Interroger et transformer des données en SQL, écrire des scripts Python propres et tout versionner avec Git.','[
 ["SQL basics","Les bases du SQL","Sélectionner, filtrer, joindre et agréger avec des leçons interactives."],
 ["Advanced SQL: CTEs and window functions","SQL avancé : CTE et fonctions de fenêtrage","Fonctions analytiques, données imbriquées et structure des requêtes."],
 ["Python tutorial","Tutoriel Python","Le parcours officiel : structures de données, modules, erreurs, fichiers."],
 ["pandas getting started","Premiers pas avec pandas","Charger, nettoyer, remodeler et exporter des données tabulaires."],
 ["Git fundamentals","Les fondamentaux de Git","Commits, branches et pull requests."],
 ["Practice: clean a messy CSV and load it into PostgreSQL","Pratique : nettoyer un CSV désordonné et le charger dans PostgreSQL","Choisissez un jeu de données public, scriptez le nettoyage en Python, chargez-le dans Postgres et committez avec un README."]]'::jsonb);
select pg_temp.track_fr('de-pipelines','Pipelines et orchestration',
 'Passer des scripts à des pipelines planifiés, testés et reproductibles.',
 'Construire un pipeline ELT planifié avec un entrepôt de données, des modèles dbt et des tests.','[
 ["Docker: get started","Docker : premiers pas","Des conteneurs pour des pipelines locaux reproductibles."],
 ["Airflow tutorial","Tutoriel Airflow","Écrire votre premier DAG : tâches, planification et dépendances."],
 ["dbt Fundamentals","Les fondamentaux de dbt","Modèles, tests, documentation et déploiement."],
 ["BigQuery sandbox","Bac à sable BigQuery","Charger des données dans un entrepôt cloud sans carte bancaire."],
 ["Data Engineering Zoomcamp","Data Engineering Zoomcamp","Cours gratuit par projets : Docker, Postgres, orchestration, dbt, Spark et Kafka. À suivre en parallèle ou à la place des étapes ci-dessus."]]'::jsonb);
select pg_temp.track_fr('de-advanced','Passage à l’échelle, streaming et certification',
 'Ce qui sépare un portfolio junior d’un profil qu’on embauche.',
 'Concevoir des pipelines fiables, expliquer vos arbitrages et l’appuyer par un projet et une certification cloud.','[
 ["Spark quick start","Démarrage rapide Spark","DataFrames et SQL sur un moteur distribué."],
 ["Kafka quickstart","Démarrage rapide Kafka","Topics, producteurs et consommateurs."],
 ["Designing Data-Intensive Applications","Designing Data-Intensive Applications","Livre de référence sur le stockage, la réplication et le streaming. Lisez les chapitres dont vous avez besoin."],
 ["Portfolio project: end-to-end pipeline","Projet portfolio : pipeline de bout en bout","Ingérez une API publique chaque jour, orchestrez-la, transformez avec dbt, ajoutez des tests de données et un tableau de bord. Notez vos arbitrages."],
 ["Cloud data engineer certification","Certification data engineer cloud","Choisissez un cloud (Google Professional Data Engineer ici ; AWS et Azure ont des équivalents)."]]'::jsonb);

-- Learning tracks: Business Analyst ------------------------------------------------
select pg_temp.track_fr('ba-foundations','Les bases de l’analyse métier',
 'Les besoins, les user stories et le vocabulaire agile utilisés dans toutes les équipes.',
 'Recueillir des besoins et écrire des user stories claires avec leurs critères d’acceptation.','[
 ["User stories","User stories","Écrire des stories avec un qui, un quoi et un pourquoi clairs."],
 ["The Scrum Guide","Le Guide Scrum","La source de référence, courte, sur les rôles et les événements Scrum."],
 ["Jira and agile tutorials","Tutoriels Jira et agilité","Epics, stories, tableaux et workflows."],
 ["SQL practice","Pratique du SQL","Vérifier les besoins sur des données réelles."],
 ["Practice: write 10 user stories for an app you use","Pratique : écrire 10 user stories pour une application que vous utilisez","Avec des critères d’acceptation et un backlog priorisé."]]'::jsonb);
select pg_temp.track_fr('ba-process','Modélisation des processus et reporting',
 'Montrer comment le travail circule aujourd’hui, où il bloque et quels changements en valent la peine.',
 'Cartographier les processus actuels et cibles et chiffrer l’impact dans un rapport.','[
 ["BPMN overview","Introduction à BPMN","La notation des événements, tâches et passerelles."],
 ["Practice: model a process in draw.io","Pratique : modéliser un processus dans draw.io","Dessinez le flux actuel d’un processus que vous connaissez et repérez les points de friction."],
 ["Power BI documentation and training","Documentation et formation Power BI","Construire un rapport à partir de données Excel ou SQL."],
 ["Practice: as-is, to-be and gap list","Pratique : existant, cible et liste des écarts","Rédigez une proposition d’évolution de processus d’une page avec les KPI attendus."]]'::jsonb);
select pg_temp.track_fr('ba-advanced','Étude de cas et certification',
 'La preuve que vous savez mener un besoin de l’idée à la livraison.',
 'Présenter un dossier de besoins complet et détenir une certification reconnue.','[
 ["Case study: full requirements pack","Étude de cas : dossier de besoins complet","Cartographie des parties prenantes, flux BPMN, user stories, critères d’acceptation et KPI pour un projet réaliste."],
 ["IIBA entry-level certification (ECBA)","Certification IIBA de premier niveau (ECBA)","Vérifiez les conditions d’examen actuelles sur le site de l’IIBA."],
 ["Professional Scrum certification","Certification Professional Scrum","Facultative, sauf si les postes visés mentionnent Product Owner ou Scrum."],
 ["Practice: interview stories","Pratique : histoires pour l’entretien","Préparez deux histoires STAR et présentez votre étude de cas à voix haute."]]'::jsonb);

-- Learning tracks: Application Support ---------------------------------------------
select pg_temp.track_fr('as-foundations','Linux, SQL et bases des incidents',
 'La boîte à outils quotidienne d’un analyste support N1/N2.',
 'Naviguer sur un serveur Linux, lire des logs, interroger une base de données et suivre un processus d’incident.','[
 ["Linux Journey","Linux Journey","Des leçons Linux accessibles aux débutants."],
 ["OverTheWire: Bandit","OverTheWire : Bandit","Apprendre le shell en résolvant de petits défis."],
 ["SQL basics","Les bases du SQL","Sélectionner, filtrer, joindre et agréger."],
 ["Incident management guide","Guide de la gestion des incidents","Niveaux de gravité, rôles, communication et escalade."]]'::jsonb);
select pg_temp.track_fr('as-monitoring','Supervision, API et automatisation',
 'Repérer les problèmes avant les utilisateurs et arrêter de répéter le travail manuel.',
 'Lire des tableaux de bord et des logs, tester des API et automatiser une tâche récurrente.','[
 ["Prometheus: first steps","Prometheus : premiers pas","Métriques, cibles et requêtes."],
 ["Grafana tutorials","Tutoriels Grafana","Construire des tableaux de bord et des alertes."],
 ["Postman Learning Center","Postman Learning Center","Envoyer des requêtes, inspecter les réponses, écrire des tests simples."],
 ["Python tutorial","Tutoriel Python","Assez de Python pour automatiser des contrôles et analyser des logs."],
 ["Practice: log summary script","Pratique : script de synthèse de logs","Écrivez un script Bash ou Python qui parcourt un fichier de logs et compte les erreurs par type."]]'::jsonb);
select pg_temp.track_fr('as-advanced','Fiabilité et certification',
 'Passer de la correction des incidents à leur prévention.',
 'Piloter un incident, rédiger un post-mortem sans reproche et détenir une certification ITIL.','[
 ["SRE book: effective troubleshooting","Livre SRE : un diagnostic efficace","Une méthode systématique pour diagnostiquer les problèmes de production."],
 ["SRE book: postmortem culture","Livre SRE : la culture du post-mortem","Rédiger des post-mortems sans reproche qui mènent à des changements."],
 ["Project: runbook and post-mortem","Projet : runbook et post-mortem","Cassez volontairement une petite application Docker, supervisez-la avec Grafana, puis rédigez le runbook et un post-mortem."],
 ["ITIL 4 Foundation","ITIL 4 Foundation","Vérifiez les détails actuels de l’examen auprès de l’organisme de certification."]]'::jsonb);

-- Learning tracks: Data Analyst ------------------------------------------------------
select pg_temp.track_fr('da-foundations','SQL, statistiques et données propres',
 'Répondre correctement aux questions métier avant de les rendre jolies.',
 'Interroger des données en SQL, les nettoyer et utiliser des statistiques simples pour étayer une conclusion.','[
 ["Intro to SQL","Introduction au SQL","Sélectionner, filtrer, joindre et agréger."],
 ["Advanced SQL","SQL avancé","CTE et fonctions de fenêtrage pour l’analyse."],
 ["Statistics and probability","Statistiques et probabilités","Distributions, échantillonnage, intervalles de confiance et tests."],
 ["Data cleaning","Nettoyage de données","Valeurs manquantes, mise à l’échelle, dates à parser et textes incohérents."],
 ["Practice: analyse a public dataset in SQL","Pratique : analyser un jeu de données public en SQL","Choisissez un jeu de données, écrivez 5 questions métier et répondez-y avec des requêtes."]]'::jsonb);
select pg_temp.track_fr('da-viz','Python, BI et storytelling visuel',
 'Transformer une analyse en quelque chose sur quoi un manager peut agir.',
 'Construire des tableaux de bord qui mènent à une décision et les expliquer clairement.','[
 ["pandas","pandas","Manipuler et résumer des données en Python."],
 ["Data visualization","Visualisation de données","Des graphiques qui montrent la bonne comparaison."],
 ["Power BI","Power BI","Choisissez Power BI ou Tableau et tenez-vous-en à un seul. Documentation et formation Power BI."],
 ["Tableau free training","Formation gratuite Tableau","L’alternative si vos employeurs cibles utilisent Tableau."],
 ["Storytelling with Data","Storytelling with Data","Épurer les graphiques, guider l’attention, commencer par l’enseignement."]]'::jsonb);
select pg_temp.track_fr('da-advanced','Portfolio et certification',
 'Les preuves valent mieux que les promesses. Livrez trois petits projets terminés.',
 'Présenter des tableaux de bord sur des données publiques et détenir une certification reconnue.','[
 ["Portfolio: three dashboards on public data","Portfolio : trois tableaux de bord sur des données publiques","Chacun répond à une question métier claire et se termine par une recommandation."],
 ["Google Data Analytics Certificate","Google Data Analytics Certificate","Certificat professionnel accessible aux débutants. Les heures sont approximatives et dépendent de votre rythme."],
 ["Microsoft Power BI Data Analyst (PL-300)","Microsoft Power BI Data Analyst (PL-300)","Reconnue si vous avez choisi Power BI."],
 ["Practice: SQL and metric definition drills","Pratique : exercices de SQL et de définition d’indicateurs","Définissez à voix haute la conversion, la rétention et le churn, puis écrivez le SQL de chacun."]]'::jsonb);

-- DevOps Engineer ------------------------------------------------------------------------
select pg_temp.res_fr('do','tool','[
 ["GitHub Actions / GitLab CI","GitHub Actions / GitLab CI","Pipelines de build, de test et de déploiement"],["Docker","Docker","Empaqueter les applications en images"],
 ["Kubernetes + Helm","Kubernetes + Helm","Faire tourner des conteneurs à grande échelle"],["Terraform","Terraform","Infrastructure as Code"],
 ["Prometheus + Grafana","Prometheus + Grafana","Métriques, tableaux de bord et alertes"]]'::jsonb);
select pg_temp.res_fr('do','tip','[
 ["Build one project end to end: a small API in Docker, a CI/CD pipeline, infrastructure in Terraform and a dashboard. Link it on your CV.","Construisez un projet de bout en bout : une petite API dans Docker, un pipeline CI/CD, l’infrastructure en Terraform et un tableau de bord. Mettez le lien sur votre CV."],
 ["Talk about incidents you handled and what you automated afterwards; DevOps interviews test judgement as much as tools.","Parlez des incidents que vous avez gérés et de ce que vous avez automatisé ensuite : les entretiens DevOps testent le jugement autant que les outils."],
 ["Quantify your impact: deployment time cut, releases per week, incidents avoided, cloud costs saved.","Chiffrez votre impact : temps de déploiement réduit, livraisons par semaine, incidents évités, coûts cloud économisés."]]'::jsonb);

-- Learning tracks: DevOps Engineer --------------------------------------------------
select pg_temp.track_fr('do-foundations','Linux, Git, réseau et scripts',
 'La base quotidienne de tout poste DevOps et cloud.',
 'Travailler à l’aise sur un serveur Linux, tout versionner avec Git, comprendre le trajet des requêtes et automatiser de petites tâches.','[
 ["Linux Journey","Linux Journey","Des leçons Linux accessibles aux débutants."],
 ["OverTheWire: Bandit","OverTheWire : Bandit","Apprendre le shell en résolvant de petits défis."],
 ["Pro Git book","Le livre Pro Git","Chapitres 1 à 3 : les bases et les branches."],
 ["Learn Git Branching","Learn Git Branching","Exercices interactifs sur les branches, les fusions et les rebases."],
 ["Cloudflare Learning Center","Cloudflare Learning Center","Comment fonctionnent DNS, HTTP, TLS, la répartition de charge et les CDN."]]'::jsonb);
select pg_temp.track_fr('do-delivery','Conteneurs, CI/CD et Kubernetes',
 'Livrer des applications comme les équipes modernes : en conteneurs, via un pipeline, sur un cluster.',
 'Conteneuriser une application, la construire et la tester dans un pipeline et la déployer sur Kubernetes.','[
 ["Docker: get started","Docker : premiers pas","Images, conteneurs, volumes et Compose."],
 ["GitHub Actions documentation","Documentation GitHub Actions","Workflows, jobs, secrets et environnements."],
 ["Kubernetes basics","Les bases de Kubernetes","Déployer, exposer, faire évoluer et mettre à jour une application sur un cluster."],
 ["Project: ship a containerised API","Projet : livrer une API conteneurisée","Conteneurisez une petite API, ajoutez un pipeline qui teste et construit l’image, et déployez-la sur un cluster kind local."]]'::jsonb);
select pg_temp.track_fr('do-cloud','Cloud, Infrastructure as Code et fiabilité',
 'Gérer une vraie infrastructure depuis du code et la garder en bonne santé.',
 'Créer une infrastructure cloud avec Terraform depuis un pipeline, la superviser avec des SLO et détenir une certification reconnue.','[
 ["Terraform tutorials","Tutoriels Terraform","Bien démarrer avec Terraform sur AWS, Azure ou Google Cloud."],
 ["AWS Skill Builder","AWS Skill Builder","Des cours gratuits sur les fondamentaux du cloud, dont Cloud Practitioner Essentials."],
 ["Prometheus: first steps","Prometheus : premiers pas","Métriques, cibles et requêtes."],
 ["SRE book: service level objectives","Livre SRE : les objectifs de niveau de service","Définir SLI, SLO et budgets d’erreur."],
 ["Project: infrastructure as code","Projet : infrastructure as code","Créez les ressources cloud de votre API avec Terraform depuis un pipeline, avec un état distant, un tableau de bord et une alerte."],
 ["AWS Certified Cloud Practitioner or CKA","AWS Certified Cloud Practitioner ou CKA","Choisissez-en une : fondamentaux du cloud (AWS) ou administration Kubernetes (CNCF). Vérifiez les détails actuels de l’examen."]]'::jsonb);

-- AI Engineer ----------------------------------------------------------------------------
select pg_temp.res_fr('ai','tool','[
 ["Claude API + Python SDK","Claude API + SDK Python","Construire des fonctionnalités avec Claude : messages, streaming, outils, sorties structurées"],
 ["Claude Code","Claude Code","Un agent de code pour le terminal, l’IDE et le bureau"],
 ["pgvector","pgvector","La recherche vectorielle dans PostgreSQL, pour le RAG"],
 ["FastAPI","FastAPI","Un petit backend qui garde la clé API et appelle le modèle"],
 ["MCP (Model Context Protocol)","MCP (Model Context Protocol)","Brancher des outils et des sources de données prêts à l’emploi sur un agent"]]'::jsonb);
select pg_temp.res_fr('ai','tip','[
 ["Show numbers, not demos: an eval set, the score, the cost per task and the limits in every project README.","Montrez des chiffres, pas des démos : un jeu d’évaluation, le score, le coût par tâche et les limites dans le README de chaque projet."],
 ["Build one project with Derja, French and Arabic users in mind: few candidates in Europe can show that, and Tunisian clients need it.","Construisez un projet pensé pour des utilisateurs en derja, en français et en arabe : peu de candidats en Europe peuvent le montrer, et les clients tunisiens en ont besoin."],
 ["In interviews, tell the story of a mistake the model made, how you measured it and how you fixed it.","En entretien, racontez une erreur du modèle, comment vous l’avez mesurée et comment vous l’avez corrigée."]]'::jsonb);

-- Learning tracks: AI Engineer -----------------------------------------------------------
select pg_temp.track_fr('ai-foundations','Les bases des LLM, le prompting et l’API Claude',
 'Comment fonctionnent les LLM, comment écrire des prompts pour une application et comment appeler Claude en Python en toute sécurité.',
 'Expliquer les tokens, le coût et les hallucinations, écrire un system prompt avec des exemples et construire une petite application Python qui renvoie un JSON fiable.','[
 ["Anthropic courses: API fundamentals","Cours Anthropic : les fondamentaux de l’API","Des notebooks gratuits d’Anthropic : premiers appels, messages, modèles et paramètres."],
 ["Prompt engineering interactive tutorial","Tutoriel interactif de prompt engineering","Des chapitres d’exercices sur les prompts clairs, les rôles, les exemples et la prévention des hallucinations."],
 ["Anthropic Python SDK","Le SDK Python d’Anthropic","Lisez le README et lancez les exemples : client, streaming, erreurs et nouvelles tentatives."],
 ["Structured outputs","Les sorties structurées","Obtenir un JSON qui suit votre schéma, et savoir ce que le schéma ne garantit pas."],
 ["Project: a ticket classifier for Derja, French and Arabic","Projet : un classifieur de tickets en derja, français et arabe","Classez 30 messages de support réalistes en ticket JSON, avec un petit jeu de test et le coût par message dans le README."]]'::jsonb);
select pg_temp.track_fr('ai-build','Outils, agents et RAG',
 'Donner au modèle vos fonctions et vos données : tool use, MCP, embeddings et réponses sourcées.',
 'Construire une boucle d’agent avec des budgets et un assistant RAG qui cite ses sources et dit quand il ne sait pas.','[
 ["Tool use overview","Présentation du tool use","Définir des outils, faire tourner la boucle, renvoyer les résultats et les erreurs."],
 ["MCP Python SDK","Le SDK Python de MCP","Écrire un petit serveur MCP et le connecter à un client."],
 ["Embeddings","Les embeddings","Ce que sont les embeddings et où les obtenir (Claude n’a pas d’endpoint d’embeddings)."],
 ["pgvector","pgvector","Stocker des embeddings dans PostgreSQL, les rechercher et les indexer."],
 ["Citations","Les citations","Des réponses qui citent les passages dont elles viennent."],
 ["Claude cookbooks","Les Claude cookbooks","Des notebooks commentés sur le RAG, le tool use, les agents et l’évaluation, à lire et à adapter."],
 ["Project: a documentation assistant with citations","Projet : un assistant de documentation avec citations","Un RAG sur une documentation publique, avec les sources, une réponse « je ne sais pas » et un jeu d’évaluation (voir les projets de portfolio plus bas)."]]'::jsonb);
select pg_temp.track_fr('ai-production','Évaluation, production et maintenance',
 'Mesurer la qualité, faire tourner la fonctionnalité en production en toute sécurité et la garder fonctionnelle quand les modèles changent.',
 'Livrer une fonctionnalité IA avec une évaluation en CI, des logs, des budgets, un canary et un retour arrière, puis la migrer vers un nouveau modèle sans la casser.','[
 ["Prompt caching","Le prompt caching","Réduire le coût et la latence sur la partie fixe du prompt, et vérifier que cela fonctionne."],
 ["Rate limits","Les limites de débit","Comment fonctionnent les limites et que faire quand vous les atteignez."],
 ["Practice: an eval set for your project","Pratique : un jeu d’évaluation pour votre projet","Écrivez 30 à 50 cas réels avec la réponse attendue, notez-les en code ou avec un juge calibré, et relancez-les après chaque changement."],
 ["Project: a support agent ready for production","Projet : un agent de support prêt pour la production","Outils, garde-fous, logs, coût par ticket, une évaluation dans GitHub Actions et Docker (voir les projets de portfolio plus bas)."],
 ["Project: a documented model migration","Projet : une migration de modèle documentée","Passez l’un de vos projets à un modèle ou à une version de SDK plus récents avec une évaluation, un canary et une entrée de CHANGELOG avec les chiffres."]]'::jsonb);
