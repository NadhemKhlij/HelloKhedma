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
   array['AI Engineer','Ingénieur IA','LLM Engineer','Generative AI Engineer','Applied AI Engineer'],6),
 ('mk','Digital Marketing','SEO, ads, analytics, campaigns','#0891b2',
   array['Digital Marketing Specialist','Marketing Analyst','Growth Marketer','SEO Specialist','Performance Marketing Manager'],7),
 ('fa','Financial Analyst','Modelling, FP&A, reporting, valuation','#ca8a04',
   array['Financial Analyst','FP&A Analyst','Financial Planning Analyst','Finance Business Partner','Corporate Finance Analyst'],8),
 ('po','Product Owner','Backlog, discovery, roadmap, delivery','#e11d48',
   array['Product Owner','Product Manager','Associate Product Manager','Digital Product Owner','Technical Product Owner'],9),
 ('pm','Project Manager','Planning, risks, budget, stakeholders','#4f46e5',
   array['Project Manager','IT Project Manager','Project Coordinator','PMO Analyst','Program Manager'],10),
 ('grc','GRC Analyst','Cyber risk, ISO 27001, GDPR, audits','#9333ea',
   array['GRC Analyst','GRC Consultant','IT Risk Analyst','Compliance Analyst','IT Auditor'],11),
 ('sales','Sales','Prospecting, B2B deals, accounts, CRM','#65a30d',
   array['Sales Representative','Account Executive','Business Developer','Sales Development Representative','Key Account Manager'],12)
on conflict (id) do update set
  name = excluded.name, blurb = excluded.blurb, color = excluded.color,
  job_titles = excluded.job_titles, sort_order = excluded.sort_order;

-- French job titles (migration 20261109000300), paired with job_titles by position: job_titles_fr[i] is how French
-- recruiters write job_titles[i] (the same text when they use the English title). The Offers page shows each French
-- title once, with its English pair, when the country is France.
update public.career_paths set job_titles_fr = v.t from (values
  ('de', array['Ingénieur Data','Ingénieur Data','Analytics Engineer','Ingénieur Data Cloud']),
  ('ba', array['Business Analyst','Analyste Métier','Analyste Fonctionnel','Product Analyst']),
  ('as', array['Support Applicatif','Support Applicatif','Ingénieur Support N2','Ingénieur de Production']),
  ('da', array['Data Analyst','Analyste de Données','Analyste BI','Chargé de Reporting']),
  ('do', array['Ingénieur DevOps','Ingénieur DevOps','Ingénieur SRE','Ingénieur Plateforme','Ingénieur Cloud']),
  ('ai', array['Ingénieur IA','Ingénieur IA','Ingénieur LLM','Ingénieur IA Générative','Ingénieur IA Appliquée']),
  ('mk', array['Chargé de Marketing Digital','Chargé d’Études Marketing','Growth Marketer','Chargé de Référencement','Traffic Manager']),
  ('fa', array['Analyste Financier','Analyste FP&A','Contrôleur de Gestion','Business Partner Finance','Analyste Corporate Finance']),
  ('po', array['Product Owner','Chef de Produit Digital','Product Manager Junior','Product Owner Digital','Product Owner Technique']),
  ('pm', array['Chef de Projet','Chef de Projet IT','Coordinateur de Projet','Analyste PMO','Directeur de Programme']),
  ('grc', array['Analyste GRC','Consultant GRC','Analyste Risques IT','Chargé de Conformité','Auditeur IT']),
  ('sales', array['Commercial','Ingénieur Commercial','Business Developer','Chargé de Développement Commercial','Responsable Grands Comptes'])
) as v(id, t) where public.career_paths.id = v.id;

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
select pg_temp.seed('da','keyword','["SQL","Excel","Power BI","DAX","Tableau","Python","Pandas","A/B testing","Statistics","Data storytelling","KPI","Looker Studio","Data cleaning"]'::jsonb);

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

-- Digital Marketing ---------------------------------------------------------------------
-- Courses (content/courses, paths ["mk"]): marketing-foundations, seo, paid-ads, ga4, email-crm, marketing-analytics,
-- plus the shared Excel, statistics (A/B testing), BI tools and SQL courses.
select pg_temp.seed('mk','tool','[
 ["Google Analytics 4","Measure traffic, conversions and the funnel; a free demo account to practise"],
 ["Google Search Console","See how a site appears in Google: queries, pages, indexing"],
 ["Google Ads + Meta Ads Manager","Run and read paid search and paid social campaigns"],
 ["HubSpot or Brevo","CRM, e-mails and marketing automation, with free plans"],
 ["Looker Studio + Google Sheets","Free reporting: connect GA4 and a spreadsheet, build a dashboard"]]'::jsonb);
select pg_temp.seed('mk','tip','[
 "Build one public case study: a real website or campaign, the goal, what you changed and the numbers before and after.",
 "Learn to read the funnel: impressions, clicks, sessions, leads, sales. Interviews test whether you know which metric answers which question.",
 "Take the free Google Analytics and Google Ads certifications (Skillshop) and add them to your CV and LinkedIn."]'::jsonb);
select pg_temp.seed('mk','keyword','["SEO","Google Ads","Paid social","Social media marketing","Content marketing","Copywriting","Email marketing","Marketing automation","CRM","Google Analytics","Google Tag Manager","Marketing analytics","Conversion rate optimization","A/B testing","KPI","Excel","Looker","SQL"]'::jsonb);

-- Financial Analyst ---------------------------------------------------------------------
-- Courses: finance-foundations, financial-modeling, fpa, valuation, plus the Excel, SQL, Power BI, Python and statistics courses.
select pg_temp.seed('fa','tool','[
 ["Excel","Models, budgets and analysis: the analyst’s main tool (lookups, pivot tables, data tables, shortcuts)"],
 ["Power BI or Tableau","Finance dashboards: P&L by business unit, budget vs actual, KPIs"],
 ["SAP or Oracle ERP","Where the accounting data comes from: general ledger, cost centres, purchase orders"],
 ["Anaplan, Pigment or Adaptive Planning","EPM tools for budgets and forecasts in larger companies"],
 ["SEC EDGAR + annual reports","Free filings of listed companies, to practise analysis and valuation on real numbers"]]'::jsonb);
select pg_temp.seed('fa','tip','[
 "Build one public model: a listed company’s three statements and a DCF, with the source of each assumption written next to it.",
 "Interviews test the basics every time: walk through the three statements, say how a 10 rise in depreciation flows through them, and walk through a DCF.",
 "End every analysis with what the manager should do, not only the numbers: business partnering is what gets analysts promoted."]'::jsonb);
select pg_temp.seed('fa','keyword','["Financial modeling","Financial analysis","Financial statements","Accounting","FP&A","Budgeting","Forecasting","Variance analysis","Financial reporting","Management control","Valuation","Corporate finance","IFRS","EPM tools","Excel","Power BI","SQL","SAP","KPI"]'::jsonb);

-- Product Owner -----------------------------------------------------------------------
-- Courses: agile-scrum, requirements, sql, statistics, excel.
select pg_temp.seed('po','tool','[
 ["Jira","Backlog, sprints and boards: the tool most product teams plan in"],
 ["Confluence or Notion","Product pages: vision, specs, decisions and release notes in one place"],
 ["Figma","Look at and comment on the designers’ screens; sketch a flow yourself"],
 ["Miro","Story maps, workshops and discovery boards with the team"],
 ["Mixpanel, Amplitude or GA4","Product analytics: funnels, retention and the effect of a release"]]'::jsonb);
select pg_temp.seed('po','tip','[
 "Show one product case study: the problem, what users told you, what you chose not to build and why, and what changed after release.",
 "Interviews always ask how you say no: practise answering with a prioritisation method (RICE, MoSCoW) and a real example.",
 "Learn to read product data yourself (SQL, an analytics tool): a PO who checks the numbers earns the team’s trust."]'::jsonb);
select pg_temp.seed('po','keyword','["Product management","Product discovery","Product roadmap","Backlog management","Prioritization","User stories","Agile","Scrum","Kanban","Stakeholder management","OKR","Product analytics","A/B testing","KPI","UAT","PSPO","Jira","Confluence","Figma","SQL"]'::jsonb);

-- Project Manager ---------------------------------------------------------------------
-- Courses: agile-scrum, requirements, bpmn, excel, power-bi.
select pg_temp.seed('pm','tool','[
 ["MS Project or Smartsheet","Plans with tasks, dependencies, milestones and the critical path"],
 ["Jira","Agile projects: backlog, sprints, boards and reports"],
 ["Excel","Budgets, plans, risk and action logs: still the project manager’s everyday tool"],
 ["Power BI","A project portfolio dashboard: progress, budget and risks for the steering committee"],
 ["Trello, Asana or Monday.com","Light task boards for small teams and non-IT projects"]]'::jsonb);
select pg_temp.seed('pm','tip','[
 "Bring one real plan to interviews: a project you ran (studies, an event, an association) with its scope, Gantt chart, budget and risk log.",
 "Recruiters ask for a certification more and more: CAPM or PSM I are within reach without experience, PMP or PRINCE2 later.",
 "Talk about trade-offs, not tools: what you cut, delayed or escalated when time, budget or scope moved, and how you told the sponsor."]'::jsonb);
select pg_temp.seed('pm','keyword','["Project management","Project planning","Risk management","Stakeholder management","Change management","Budgeting","Agile","Scrum","Waterfall","PMP","PRINCE2","MS Project","Jira","Confluence","Excel","Power BI","KPI","Process mapping"]'::jsonb);

-- GRC Analyst (IT and cyber governance, risk and compliance) ------------------------------
-- Courses: itil-incidents, excel, bpmn, sql, cloud-aws, power-bi.
select pg_temp.seed('grc','tool','[
 ["Excel","Risk registers, control matrices and audit trackers: still where most GRC work starts"],
 ["ServiceNow GRC, Archer or OneTrust","GRC platforms: risks, controls, policies, audits and vendor assessments in one place"],
 ["Vanta or Drata","Compliance automation for start-ups: SOC 2 and ISO 27001 evidence collected from the cloud and HR tools"],
 ["Microsoft Purview","Data protection and compliance in Microsoft 365: data classification, retention, audit logs"],
 ["Power BI","Risk and compliance dashboards for the management committee"]]'::jsonb);
select pg_temp.seed('grc','tip','[
 "GRC hires people from many backgrounds (IT support, audit, law, project management): say what you bring and show one GRC deliverable, such as a risk register or an ISO 27001 gap assessment.",
 "Learn the vocabulary of one framework well (ISO 27001 and its Annex A, or NIST CSF) rather than a little of everything: interviews go into the details.",
 "European rules (GDPR, NIS2, DORA) create many offers in France and Europe: name the ones you know on your CV, with what you did with them."]'::jsonb);
select pg_temp.seed('grc','keyword','["GRC","Information security","ISO 27001","NIST CSF","IT risk management","Risk management","Compliance","GDPR","NIS2","DORA","SOC 2","Internal controls","IT audit","Security policies","Third-party risk","Business continuity","Vulnerability management","Security awareness","CISA","CRISC","Excel"]'::jsonb);

-- Sales (B2B: SDR / business developer, account executive, key account manager) -----------
-- Courses: marketing-foundations, email-crm, excel.
select pg_temp.seed('sales','tool','[
 ["Salesforce or HubSpot CRM","Where every lead, deal and call is logged: the pipeline and the forecast come from it"],
 ["LinkedIn Sales Navigator","Find the right accounts and people, follow their news, and reach them"],
 ["Lemlist, Apollo or La Growth Machine","Prospecting sequences: e-mails, calls and LinkedIn steps, with reply rates"],
 ["Gong or Modjo","Call recording and coaching: listen to your discovery calls and demos again"],
 ["Excel or Google Sheets","Account lists, territory plans and the pipeline report your manager asks for"]]'::jsonb);
select pg_temp.seed('sales','tip','[
 "Sales hires on proof of results: put numbers on your CV (quota reached, deals signed, meetings booked, revenue), even from an internship, a summer job or a student association.",
 "Many careers start as SDR or business developer: show you can prospect with a short outreach sequence you wrote and the reply rate it got.",
 "Learn one qualification method (BANT or MEDDIC) and one CRM well: interviews include a role play, and managers ask how you keep your pipeline clean."]'::jsonb);
select pg_temp.seed('sales','keyword','["Sales prospecting","Business development","B2B sales","Account management","Negotiation","Closing","Sales pipeline management","Sales targets","Solution selling","Sales methodologies","SaaS sales","Customer success","Social selling","CRM","Salesforce","Sales engagement tools","Stakeholder management","Excel","KPI"]'::jsonb);

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
 ["Excel for analysts","Lookups, pivot tables, conditional sums and clean data: still the daily tool of most analysts.","learn","HelloKhedma","",4],
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
 ["DAX: measures, CALCULATE and time intelligence","The formulas behind every Power BI report: filter context, CALCULATE, year-over-year, ranking.","learn","HelloKhedma","",5],
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

-- Digital Marketing ---------------------------------------------------------------------
select pg_temp.track('mk','mk-foundations','Marketing foundations: funnel, channels and analytics','beginner',
 'The base every digital marketing interview checks: how customers are found, converted and measured.',
 'Explain the funnel and the main channels, set up and read Google Analytics 4, and build a KPI sheet a manager can use.',1,'[
 ["HubSpot Academy courses","Free courses on inbound marketing, content, e-mail and social media, with certificates.","learn","HubSpot Academy","https://academy.hubspot.com/courses",6],
 ["Set up Google Analytics 4","Create a property, add the tag and check that data arrives.","learn","Google Analytics Help","https://support.google.com/analytics/answer/9304153",2],
 ["Google Analytics demo account","Explore real GA4 data from the Google Merchandise Store: channels, pages, conversions.","practice","Google Analytics Help","https://support.google.com/analytics/answer/6367342",3],
 ["Google Analytics certification","The free official course and exam.","learn","Google Skillshop","https://skillshop.withgoogle.com/",6],
 ["Practice: a marketing KPI sheet","In Google Sheets or Excel, track sessions, leads, cost, conversion rate, cost per lead and revenue per channel over 8 weeks of sample data, with one chart per KPI.","practice","Your sheet","",3]]'::jsonb);
select pg_temp.track('mk','mk-acquisition','Acquisition: SEO, paid search and paid social','intermediate',
 'The channels that bring visitors and leads, and how to work each one.',
 'Audit a site for SEO, plan a Google Ads campaign, set up paid social and read the results of each channel.',2,'[
 ["SEO Starter Guide","Google’s own guide: how search works, titles, content, links and what to avoid.","learn","Google Search Central","https://developers.google.com/search/docs/fundamentals/seo-starter-guide",3],
 ["Beginner’s Guide to SEO","Keyword research, on-page, technical SEO and links, step by step.","learn","Moz","https://moz.com/beginners-guide-to-seo",6],
 ["Search Console Help","Read the queries, pages and indexing reports of a site.","learn","Google","https://support.google.com/webmasters",2],
 ["Google Ads Help","Campaign types, keywords, bidding and conversion tracking.","learn","Google","https://support.google.com/google-ads",4],
 ["Meta Blueprint","Free courses on Facebook and Instagram advertising.","learn","Meta","https://www.facebook.com/business/learn",5],
 ["Practice: an SEO audit of a real site","Pick a small site (a local business, an association), list its technical, content and link problems and write a prioritised plan.","practice","Your document","",6]]'::jsonb);
select pg_temp.track('mk','mk-analytics','Measurement, experiments and reporting','advanced',
 'What separates a marketer who reports from one who decides: clean data, tests and clear dashboards.',
 'Query marketing data with SQL, size and read an A/B test, and publish a dashboard that answers a business question.',3,'[
 ["Intro to SQL","Select, filter, join and aggregate: enough to query marketing data.","learn","Kaggle Learn","https://www.kaggle.com/learn/intro-to-sql",4],
 ["GA4 e-commerce sample dataset","A real anonymised GA4 export of the Google Merchandise Store in BigQuery, free with the sandbox.","practice","Google Analytics","https://developers.google.com/analytics/bigquery/web-ecommerce-demo-dataset",5],
 ["A/B test sample size calculator","How many visitors a test needs before its result means anything.","practice","Evan Miller","https://www.evanmiller.org/ab-testing/sample-size.html",1],
 ["Looker Studio Help","Connect GA4 and Sheets, build charts and filters, share a report.","learn","Google","https://support.google.com/looker-studio",3],
 ["Project: a campaign performance dashboard","A Looker Studio report with the funnel, cost per lead and conversion by channel, and three written recommendations.","project","Your report","",10]]'::jsonb);

-- Financial Analyst ---------------------------------------------------------------------
select pg_temp.track('fa','fa-foundations','Finance foundations: accounting and the three statements','beginner',
 'The base every finance interview checks: how a company records its activity and how to read its accounts.',
 'Read an income statement, a balance sheet and a cash flow statement, explain how they link, and compute the ratios a manager asks for.',1,'[
 ["Principles of Financial Accounting","Free open textbook: the accounting cycle, the three statements, receivables, inventory and long-term assets.","learn","OpenStax","https://openstax.org/details/books/principles-financial-accounting",15],
 ["Finance and capital markets","Free video lessons on accounting, the financial statements, interest and valuation.","learn","Khan Academy","https://www.khanacademy.org/economics-finance-domain/core-finance",8],
 ["Excel essentials for analysts","Formulas, lookups, pivot tables and charts: the tool every finance team works in.","learn","Microsoft Support","https://support.microsoft.com/en-us/office/excel-video-training-9bc05390-e94c-46af-a5b3-d7c22f6990bb",4],
 ["Practice: read a real annual report","Download the latest annual report (a 10-K on EDGAR, or a European company’s universal registration document) of a company you know and write one page: growth, margins, cash flow and debt.","practice","SEC EDGAR","https://www.sec.gov/edgar/search/",3]]'::jsonb);
select pg_temp.track('fa','fa-modeling','Financial modelling and valuation','intermediate',
 'The technical core of analyst roles: models that forecast a business and the methods that value it.',
 'Build a linked three-statement model in Excel, value a company with a DCF and multiples, and defend your assumptions.',2,'[
 ["Free financial modelling courses","Introductory courses on Excel, accounting and modelling, with certificates.","learn","Corporate Finance Institute","https://corporatefinanceinstitute.com/collections/free-courses/",6],
 ["Principles of Finance","Free open textbook: time value of money, NPV and IRR, cost of capital and company valuation.","learn","OpenStax","https://openstax.org/details/books/principles-finance",15],
 ["Finance Theory I","MIT course with lecture videos and notes: present value, capital budgeting, CAPM and the cost of capital.","learn","MIT OpenCourseWare","https://ocw.mit.edu/courses/15-401-finance-theory-i-fall-2008/",20],
 ["Valuation data by industry","Cost of capital, betas and multiples by industry, updated every January, free.","practice","NYU Stern (Aswath Damodaran)","https://pages.stern.nyu.edu/~adamodar/New_Home_Page/datacurrent.html",2],
 ["Project: a three-statement model and DCF of a listed company","Five years of history from the annual reports, a five-year forecast, a DCF with a sensitivity table and a one-page recommendation (see the portfolio projects below).","project","Your model","",15]]'::jsonb);
select pg_temp.track('fa','fa-fpa','FP&A, reporting and business partnering','advanced',
 'What finance teams do every month: budgets, forecasts, variance analysis and reports that lead to decisions.',
 'Build a budget and a rolling forecast, explain budget vs actual with price, volume and mix, and publish a monthly finance dashboard.',3,'[
 ["Principles of Managerial Accounting","Free open textbook: cost behaviour, budgets, standard costs and variances, performance measurement.","learn","OpenStax","https://openstax.org/details/books/principles-managerial-accounting",12],
 ["Intro to SQL","Select, filter, join and aggregate: enough to pull finance data from a database yourself.","learn","Kaggle Learn","https://www.kaggle.com/learn/intro-to-sql",4],
 ["Power BI financial sample","A sample workbook of sales, costs and profit by segment and country, to build a finance dashboard.","practice","Microsoft Learn","https://learn.microsoft.com/en-us/power-bi/create-reports/sample-financial-download",3],
 ["FRED economic data","Interest rates, inflation and growth series, to ground the assumptions of a forecast.","practice","Federal Reserve Bank of St. Louis","https://fred.stlouisfed.org/",2],
 ["Project: a budget vs actual pack","A monthly pack in Power BI or Excel: P&L against budget and last year, a variance bridge, a rolling forecast and three written comments.","project","Your report","",10]]'::jsonb);

-- Product Owner -----------------------------------------------------------------------
select pg_temp.track('po','po-foundations','Product Owner foundations: Scrum, the backlog and user stories','beginner',
 'What every Product Owner interview checks first: how Scrum works and how a backlog turns needs into work.',
 'Explain the Product Owner’s accountabilities in Scrum, write user stories with acceptance criteria and order a backlog.',1,'[
 ["The Scrum Guide","The official guide (13 pages): roles, events, artifacts and what the Product Owner is accountable for.","learn","Scrum.org","https://scrumguides.org/scrum-guide.html",2],
 ["Agile & Scrum","HelloKhedma course: Scrum roles and events, estimation, Kanban and the metrics teams use, with exercises.","learn","HelloKhedma","",6],
 ["Requirements & user stories","HelloKhedma course: needs, user stories, acceptance criteria in Given / When / Then, and backlog refinement.","learn","HelloKhedma","",6],
 ["Practice: write the backlog of an app you use","Pick an app you use every day: write 3 epics and 12 user stories with acceptance criteria, then order them and say why.","practice","Your notes","",4],
 ["Professional Scrum Product Owner I (PSPO I)","The best-known Product Owner certification: an online exam, no course required.","certification","Scrum.org","https://www.scrum.org/assessments/professional-scrum-product-owner-i-certification",20,false]]'::jsonb);
select pg_temp.track('po','po-discovery','Product discovery, prioritisation and metrics','intermediate',
 'How good Product Owners decide what to build: talking to users, choosing with a method, and checking the result in the data.',
 'Run user interviews, prioritise with RICE or MoSCoW, define success metrics and read them yourself with SQL.',2,'[
 ["User interviews","How to prepare, run and analyse interviews with users without leading them.","learn","Nielsen Norman Group","https://www.nngroup.com/articles/user-interviews/",2],
 ["Intro to SQL","Select, filter, join and aggregate: enough to answer your own product questions in the database.","learn","Kaggle Learn","https://www.kaggle.com/learn/intro-to-sql",4],
 ["Statistics & A/B testing","HelloKhedma course: averages, variation, significance and how to read an A/B test without fooling yourself.","learn","HelloKhedma","",6],
 ["A/B test sample size calculator","How many users a test needs before its result means anything.","practice","Evan Miller","https://www.evanmiller.org/ab-testing/sample-size.html",1],
 ["Project: a product case study","Five user interviews, a prioritised backlog and a one-page roadmap for a real app (see the portfolio projects below).","project","Your case study","",15]]'::jsonb);
select pg_temp.track('po','po-delivery','Roadmaps, stakeholders and delivery','advanced',
 'The day-to-day of a senior Product Owner: a roadmap people trust, stakeholders who agree on priorities, and releases that move a metric.',
 'Build an outcome-based roadmap, run a sprint review that leads to decisions, and report the value delivered.',3,'[
 ["Evidence-Based Management guide","Scrum.org’s guide to measuring value: current value, time to market, ability to innovate.","learn","Scrum.org","https://www.scrum.org/resources/evidence-based-management-guide",2],
 ["Excel for analysis","HelloKhedma course: lookups, pivot tables and charts, for release reports and business cases.","learn","HelloKhedma","",6],
 ["Practice: turn a feature list into an outcome roadmap","Take 10 feature requests, group them under 3 outcomes with a metric each, and place them in Now / Next / Later.","practice","Your roadmap","",3],
 ["Project: a release plan and a stakeholder update","A release plan for one quarter, the risks and dependencies, and the one-page update you would send to sponsors.","project","Your plan","",10]]'::jsonb);

-- Project Manager ---------------------------------------------------------------------
select pg_temp.track('pm','pm-foundations','Project management foundations: scope, plan, budget and risks','beginner',
 'The base every project manager interview checks: how to frame a project and plan it so it can be followed.',
 'Write a project charter, break the work down, build a Gantt chart with the critical path, a budget and a risk log.',1,'[
 ["Project management guide","Free guides on project phases, charters, planning, risk and status reports.","learn","Atlassian","https://www.atlassian.com/work-management/project-management",4],
 ["Excel for analysis","HelloKhedma course: formulas, lookups, pivot tables and charts: the tool for plans, budgets and logs.","learn","HelloKhedma","",6],
 ["BPMN & process mapping","HelloKhedma course: map how work flows today and after the project, to agree on the scope.","learn","HelloKhedma","",5],
 ["Practice: plan a project you know","A move, an event or a small app: write the scope, a work breakdown, a Gantt chart in Excel, a budget and five risks with their responses.","practice","Your plan","",4],
 ["Certified Associate in Project Management (CAPM)","PMI’s entry-level certification: no project experience needed, 23 hours of training.","certification","PMI","https://www.pmi.org/certifications/certified-associate-capm",40,false]]'::jsonb);
select pg_temp.track('pm','pm-agile','Agile and hybrid delivery','intermediate',
 'Most IT projects mix a fixed plan with agile teams: how to run both and report on them.',
 'Run a project with Scrum or Kanban teams inside a milestone plan, and report progress with a dashboard.',2,'[
 ["Agile & Scrum","HelloKhedma course: Scrum roles and events, estimation, Kanban and the metrics teams use, with exercises.","learn","HelloKhedma","",6],
 ["The Kanban Guide","The short official guide to Kanban: visualise work, limit work in progress, measure flow.","learn","ProKanban.org","https://kanbanguides.org/english/",1],
 ["Requirements & user stories","HelloKhedma course: gather needs and turn them into user stories the team can deliver.","learn","HelloKhedma","",6],
 ["Power BI & DAX","HelloKhedma course: build the dashboard a steering committee reads: progress, budget, risks.","learn","HelloKhedma","",8],
 ["Project: a project status dashboard","A one-page Power BI or Excel dashboard for a real or sample project: milestones, budget used, top risks and decisions needed.","project","Your dashboard","",10]]'::jsonb);
select pg_temp.track('pm','pm-certification','Certifications and larger projects','advanced',
 'What senior project manager offers ask for: a recognised certification and experience with budgets, vendors and change.',
 'Prepare a PMP, PRINCE2 or PSM certification, and lead the people side of change on a larger project.',3,'[
 ["Professional Scrum Master I (PSM I)","An online exam on Scrum, no course required: proof that you can run agile teams.","certification","Scrum.org","https://www.scrum.org/assessments/professional-scrum-master-i-certification",15,false],
 ["Project Management Professional (PMP)","The global reference certification: 3 to 5 years of leading projects and 35 hours of training required.","certification","PMI","https://www.pmi.org/certifications/project-management-pmp",80,false],
 ["PRINCE2 Foundation","The process-based method common in the UK, Europe and public projects.","certification","PeopleCert","https://www.peoplecert.org/",30,false],
 ["Project: a full plan for a real initiative","A charter, plan, budget, risk log, RACI and communication plan for a real initiative of an association or company you know (see the portfolio projects below).","project","Your plan","",15]]'::jsonb);

-- GRC Analyst -------------------------------------------------------------------------
select pg_temp.track('grc','grc-foundations','GRC foundations: security basics, risks and controls','beginner',
 'What every GRC interview checks first: the basics of information security, how a risk is assessed and how a control reduces it.',
 'Explain confidentiality, integrity and availability, assess a risk (likelihood × impact), link it to controls and keep a risk register.',1,'[
 ["NIST Cybersecurity Framework 2.0","The free framework most GRC teams map to: Govern, Identify, Protect, Detect, Respond, Recover.","learn","NIST","https://www.nist.gov/cyberframework",4],
 ["SecNumacadémie","The free online course of the French national cybersecurity agency (ANSSI): the basics of security, with a certificate.","learn","ANSSI","https://secnumacademie.gouv.fr/",20],
 ["Incident management & ITIL","HelloKhedma course: incidents, problems, changes and SLAs: the IT processes that security controls rely on.","learn","HelloKhedma","",6],
 ["Excel for analysis","HelloKhedma course: lookups, conditional formatting and pivot tables, for risk registers and control matrices.","learn","HelloKhedma","",6],
 ["Practice: a risk register for a small company","For a small company you know (a shop, an agency): list 10 assets, 10 risks with likelihood and impact, and one control for each.","practice","Your register","",4],
 ["CompTIA Security+","The best-known entry-level security certification: threats, controls, risk and compliance.","certification","CompTIA","https://www.comptia.org/certifications/security",60,false]]'::jsonb);
select pg_temp.track('grc','grc-standards','Standards and regulations: ISO 27001, GDPR, NIS2 and DORA','intermediate',
 'The texts GRC offers name: the ISO 27001 management system, personal data protection and the new European rules for critical sectors and finance.',
 'Explain the ISO 27001 clauses and Annex A, keep a GDPR record of processing, and say which obligations NIS2 and DORA add.',2,'[
 ["ISO/IEC 27001","The official page of the standard: what an information security management system (ISMS) is and how certification works.","learn","ISO","https://www.iso.org/standard/27001",2],
 ["GDPR text, article by article","The regulation with its recitals, easy to search: principles, rights, records, data protection impact assessments.","learn","Intersoft Consulting","https://gdpr-info.eu/",4],
 ["NIS2 directive","The European Commission’s page on NIS2: which organisations it covers and what it requires.","learn","European Commission","https://digital-strategy.ec.europa.eu/en/policies/nis2-directive",2],
 ["BPMN & process mapping","HelloKhedma course: map a process to see where a control belongs and who performs it.","learn","HelloKhedma","",5],
 ["SQL for data jobs","HelloKhedma course: query user lists, access rights and logs yourself to gather audit evidence.","learn","HelloKhedma","",6],
 ["Project: an ISO 27001 gap assessment","Compare a real or sample organisation with the ISO 27001 controls and write the action plan (see the portfolio projects below).","project","Your assessment","",15]]'::jsonb);
select pg_temp.track('grc','grc-audit','Audits, third parties and certifications','advanced',
 'What senior GRC offers ask for: running audits, assessing suppliers and the cloud, reporting to management, and a recognised certification.',
 'Plan and run an IT audit, assess a supplier and a cloud service, report risks with a dashboard, and prepare CISA, CRISC or ISO 27001 Lead Implementer.',3,'[
 ["Cloud fundamentals with AWS","HelloKhedma course: shared responsibility, identities and access, logs: what an auditor checks in the cloud.","learn","HelloKhedma","",8],
 ["Power BI & DAX","HelloKhedma course: build the risk and compliance dashboard a management committee reads.","learn","HelloKhedma","",8],
 ["Practice: a supplier security questionnaire","Write 20 questions to assess a SaaS supplier (access, encryption, backups, incidents, certifications), then answer them for a service you use from its public trust page.","practice","Your questionnaire","",3],
 ["ISO/IEC 27001 Lead Implementer","The certification to run an ISO 27001 project: five days of training and an exam, common in GRC consulting offers.","certification","PECB","https://pecb.com/",40,false],
 ["Certified Information Systems Auditor (CISA)","The reference certification for IT auditors; experience is needed for the title, not for the exam.","certification","ISACA","https://www.isaca.org/credentialing/cisa",120,false],
 ["Certified in Risk and Information Systems Control (CRISC)","ISACA’s certification for IT risk managers.","certification","ISACA","https://www.isaca.org/credentialing/crisc",100,false]]'::jsonb);

-- Sales ---------------------------------------------------------------------------------
select pg_temp.track('sales','sales-foundations','Sales foundations: customers, prospecting and the CRM','beginner',
 'The base of every sales job: who buys, why, and how to start conversations with the right people.',
 'Describe an ideal customer and its buyers, build a list of target accounts, write a prospecting sequence and log it all in a CRM.',1,'[
 ["Digital marketing foundations","HelloKhedma course: the funnel, customers and positioning, where every sale starts.","learn","HelloKhedma","",2],
 ["HubSpot Academy sales courses","Free courses on inbound sales, prospecting and sales enablement, with certificates.","learn","HubSpot Academy","https://academy.hubspot.com/courses",6],
 ["E-mail marketing, CRM and automation","HelloKhedma course: the CRM, lifecycle stages and lead scoring that sales teams work with every day.","learn","HelloKhedma","",2],
 ["Practice: an ideal customer profile and 30 target accounts","Pick a product you know, write its ideal customer profile and buyer personas, then list 30 real target companies and why each one fits.","practice","Your sheet","",4]]'::jsonb);
select pg_temp.track('sales','sales-deals','Discovery, negotiation and closing','intermediate',
 'What turns a meeting into a signed deal: questions, a clear value story, objections and negotiation.',
 'Run a discovery call that qualifies a deal (BANT or MEDDIC), answer the classic objections and negotiate without giving the price away.',2,'[
 ["Successful Negotiation: Essential Strategies and Skills","Course from the University of Michigan, free to audit: preparation, anchoring, concessions and closing.","learn","Coursera","https://www.coursera.org/learn/negotiation-skills",10],
 ["Program on Negotiation: free articles","Articles from Harvard Law School’s negotiation programme on price, objections and agreements that last.","learn","Harvard PON","https://www.pon.harvard.edu/blog/",3],
 ["Practice: a recorded mock discovery call","Record a 20-minute discovery call with a friend playing the buyer: open questions, pain, impact, budget, decision process; then score yourself.","practice","Your recording","",3],
 ["Practice: answer the ten classic objections","Write your answer to too expensive, no time, we already have a supplier, send me an e-mail and six more, then rehearse them out loud.","practice","Your document","",2]]'::jsonb);
select pg_temp.track('sales','sales-pipeline','Pipeline, forecast and key accounts','advanced',
 'What account executives and key account managers are judged on: a clean pipeline, a reliable forecast and growing accounts.',
 'Manage a pipeline in a CRM, forecast the quarter from it, and write a plan to grow a key account.',3,'[
 ["Salesforce Trailhead","Free modules on Sales Cloud: leads, opportunities, pipeline and reports, with badges recruiters recognise.","learn","Salesforce Trailhead","https://trailhead.salesforce.com/",8],
 ["HubSpot free CRM","Run a real pipeline: deals, stages, tasks and sequences, for free.","practice","HubSpot","https://www.hubspot.com/products/crm",3],
 ["Excel for analysis","HelloKhedma course: pivot tables and lookups for pipeline reports and forecasts.","learn","HelloKhedma","",4],
 ["Project: a pipeline analysis and next-quarter forecast","Win rates, sales cycle and a forecast from a real CRM dataset (see the portfolio projects below).","project","Your report","",10],
 ["Project: a key account plan","Priorities, buying committee, MEDDIC and a 90-day plan for a real company (see the portfolio projects below).","project","Your plan","",8]]'::jsonb);

-- =====================================================================================
-- HelloKhedma courses on the roadmaps (needs migration 20261109000600_step_course.sql). A step with a course opens our
-- course first (its outside resource stays as an extra). Matched on (track id, English step title), like the step ids.
-- =====================================================================================
update public.training_steps s set course_id = v.c from (values
  ('de-foundations','SQL basics','sql'), ('de-foundations','Advanced SQL: CTEs and window functions','sql'),
  ('de-foundations','Python tutorial','python'), ('de-foundations','pandas getting started','pandas'),
  ('de-foundations','Git fundamentals','git'),
  ('de-pipelines','Docker: get started','docker'), ('de-pipelines','Airflow tutorial','airflow'),
  ('de-pipelines','dbt Fundamentals','dbt'), ('de-pipelines','BigQuery sandbox','cloud-warehouses'),
  ('de-advanced','Spark quick start','spark'), ('de-advanced','Kafka quickstart','kafka'),
  ('ba-foundations','User stories','requirements'), ('ba-foundations','The Scrum Guide','agile-scrum'),
  ('ba-foundations','Jira and agile tutorials','agile-scrum'), ('ba-foundations','SQL practice','sql'),
  ('ba-process','BPMN overview','bpmn'), ('ba-process','Power BI documentation and training','power-bi'),
  ('as-foundations','Linux Journey','linux-bash'), ('as-foundations','OverTheWire: Bandit','linux-bash'),
  ('as-foundations','SQL basics','sql'), ('as-foundations','Incident management guide','itil-incidents'),
  ('as-monitoring','Prometheus: first steps','logs-monitoring'), ('as-monitoring','Grafana tutorials','logs-monitoring'),
  ('as-monitoring','Python tutorial','python'),
  ('as-advanced','SRE book: effective troubleshooting','itil-incidents'), ('as-advanced','SRE book: postmortem culture','itil-incidents'),
  ('da-foundations','Excel for analysts','excel'), ('da-foundations','Intro to SQL','sql'), ('da-foundations','Advanced SQL','sql'),
  ('da-foundations','Statistics and probability','statistics'), ('da-foundations','Data cleaning','pandas'),
  ('da-viz','pandas','pandas'), ('da-viz','Data visualization','bi-tools'), ('da-viz','Power BI','power-bi'),
  ('da-viz','DAX: measures, CALCULATE and time intelligence','dax'), ('da-viz','Tableau free training','bi-tools'),
  ('da-viz','Storytelling with Data','bi-tools'),
  ('do-foundations','Linux Journey','linux-bash'), ('do-foundations','Pro Git book','git'), ('do-foundations','Learn Git Branching','git'),
  ('do-delivery','Docker: get started','docker'), ('do-delivery','GitHub Actions documentation','ci-cd'),
  ('do-delivery','Kubernetes basics','kubernetes'),
  ('do-cloud','Terraform tutorials','terraform'), ('do-cloud','AWS Skill Builder','cloud-aws'),
  ('do-cloud','Prometheus: first steps','logs-monitoring'), ('do-cloud','SRE book: service level objectives','logs-monitoring'),
  ('ai-foundations','Anthropic courses: API fundamentals','ai-claude-api'), ('ai-foundations','Prompt engineering interactive tutorial','ai-prompting'),
  ('ai-foundations','Anthropic Python SDK','ai-claude-api'), ('ai-foundations','Structured outputs','ai-claude-api'),
  ('ai-build','Tool use overview','ai-tools-agents'), ('ai-build','MCP Python SDK','ai-tools-agents'),
  ('ai-build','Embeddings','ai-rag'), ('ai-build','pgvector','ai-rag'), ('ai-build','Citations','ai-rag'),
  ('ai-production','Prompt caching','ai-production'), ('ai-production','Rate limits','ai-production'),
  ('ai-production','Practice: an eval set for your project','ai-evals'),
  ('mk-foundations','HubSpot Academy courses','marketing-foundations'), ('mk-foundations','Set up Google Analytics 4','ga4'),
  ('mk-foundations','Google Analytics demo account','ga4'), ('mk-foundations','Google Analytics certification','ga4'),
  ('mk-acquisition','SEO Starter Guide','seo'), ('mk-acquisition','Beginner’s Guide to SEO','seo'),
  ('mk-acquisition','Search Console Help','seo'), ('mk-acquisition','Google Ads Help','paid-ads'),
  ('mk-acquisition','Meta Blueprint','paid-ads'),
  ('mk-analytics','Intro to SQL','sql'), ('mk-analytics','A/B test sample size calculator','statistics'),
  ('mk-analytics','Looker Studio Help','marketing-analytics'),
  ('fa-foundations','Principles of Financial Accounting','finance-foundations'), ('fa-foundations','Finance and capital markets','finance-foundations'),
  ('fa-foundations','Excel essentials for analysts','excel'),
  ('fa-modeling','Free financial modelling courses','financial-modeling'), ('fa-modeling','Principles of Finance','valuation'),
  ('fa-modeling','Finance Theory I','valuation'),
  ('fa-fpa','Principles of Managerial Accounting','fpa'), ('fa-fpa','Intro to SQL','sql'), ('fa-fpa','Power BI financial sample','power-bi'),
  ('po-foundations','The Scrum Guide','agile-scrum'), ('po-foundations','Agile & Scrum','agile-scrum'),
  ('po-foundations','Requirements & user stories','requirements'),
  ('po-discovery','Intro to SQL','sql'), ('po-discovery','Statistics & A/B testing','statistics'),
  ('po-discovery','A/B test sample size calculator','statistics'), ('po-delivery','Excel for analysis','excel'),
  ('pm-foundations','Excel for analysis','excel'), ('pm-foundations','BPMN & process mapping','bpmn'),
  ('pm-agile','Agile & Scrum','agile-scrum'), ('pm-agile','The Kanban Guide','agile-scrum'),
  ('pm-agile','Requirements & user stories','requirements'), ('pm-agile','Power BI & DAX','power-bi'),
  ('pm-certification','Professional Scrum Master I (PSM I)','agile-scrum'),
  ('grc-foundations','Incident management & ITIL','itil-incidents'), ('grc-foundations','Excel for analysis','excel'),
  ('grc-standards','BPMN & process mapping','bpmn'), ('grc-standards','SQL for data jobs','sql'),
  ('grc-audit','Cloud fundamentals with AWS','cloud-aws'), ('grc-audit','Power BI & DAX','power-bi'),
  ('sales-foundations','Digital marketing foundations','marketing-foundations'),
  ('sales-foundations','E-mail marketing, CRM and automation','email-crm'), ('sales-pipeline','Excel for analysis','excel')
) as v(tid, title, c)
where s.id = md5(v.tid || ':' || v.title)::uuid;

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
  ('ai', 'AI Engineer', 'Applications LLM, agents, RAG, évaluations'),
  ('mk', 'Marketing digital', 'SEO, publicité, analytics, campagnes'),
  ('fa', 'Analyste financier', 'Modélisation, FP&A, reporting, valorisation'),
  ('po', 'Product Owner', 'Backlog, découverte, roadmap, livraison'),
  ('pm', 'Chef de projet', 'Planning, risques, budget, parties prenantes'),
  ('grc', 'Analyste GRC', 'Risques cyber, ISO 27001, RGPD, audits'),
  ('sales', 'Commercial', 'Prospection, ventes B2B, grands comptes, CRM')
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
 ["Excel for analysts","Excel pour l’analyste","Recherches, tableaux croisés dynamiques, sommes conditionnelles et données propres : encore l’outil quotidien de la plupart des analystes."],
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
 ["DAX: measures, CALCULATE and time intelligence","DAX : mesures, CALCULATE et intelligence temporelle","Les formules derrière chaque rapport Power BI : contexte de filtre, CALCULATE, comparaison à l’année précédente, classement."],
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

-- Digital Marketing ---------------------------------------------------------------------
select pg_temp.res_fr('mk','tool','[
 ["Google Analytics 4","Google Analytics 4","Mesurer le trafic, les conversions et le tunnel ; un compte de démonstration gratuit pour s’entraîner"],
 ["Google Search Console","Google Search Console","Voir comment un site apparaît dans Google : requêtes, pages, indexation"],
 ["Google Ads + Meta Ads Manager","Google Ads + Meta Ads Manager","Lancer et lire des campagnes de référencement payant et de publicité sur les réseaux sociaux"],
 ["HubSpot or Brevo","HubSpot ou Brevo","CRM, e-mails et marketing automation, avec des offres gratuites"],
 ["Looker Studio + Google Sheets","Looker Studio + Google Sheets","Un reporting gratuit : connecter GA4 et un tableur, construire un tableau de bord"]]'::jsonb);
select pg_temp.res_fr('mk','tip','[
 ["Build one public case study: a real website or campaign, the goal, what you changed and the numbers before and after.","Construisez une étude de cas publique : un vrai site ou une vraie campagne, l’objectif, ce que vous avez changé et les chiffres avant et après."],
 ["Learn to read the funnel: impressions, clicks, sessions, leads, sales. Interviews test whether you know which metric answers which question.","Apprenez à lire le tunnel : impressions, clics, sessions, leads, ventes. Les entretiens vérifient que vous savez quel indicateur répond à quelle question."],
 ["Take the free Google Analytics and Google Ads certifications (Skillshop) and add them to your CV and LinkedIn.","Passez les certifications gratuites Google Analytics et Google Ads (Skillshop) et ajoutez-les à votre CV et à LinkedIn."]]'::jsonb);

-- Learning tracks: Digital Marketing ----------------------------------------------------
select pg_temp.track_fr('mk-foundations','Les bases du marketing : tunnel, canaux et analytics',
 'La base que vérifie tout entretien en marketing digital : comment les clients sont trouvés, convertis et mesurés.',
 'Expliquer le tunnel et les principaux canaux, configurer et lire Google Analytics 4, et construire un tableau d’indicateurs utile à un manager.','[
 ["HubSpot Academy courses","Les cours HubSpot Academy","Des cours gratuits sur l’inbound marketing, le contenu, l’e-mail et les réseaux sociaux, avec certificats."],
 ["Set up Google Analytics 4","Configurer Google Analytics 4","Créer une propriété, ajouter la balise et vérifier que les données arrivent."],
 ["Google Analytics demo account","Le compte de démonstration Google Analytics","Explorer de vraies données GA4 du Google Merchandise Store : canaux, pages, conversions."],
 ["Google Analytics certification","La certification Google Analytics","Le cours et l’examen officiels, gratuits."],
 ["Practice: a marketing KPI sheet","Pratique : un tableau d’indicateurs marketing","Dans Google Sheets ou Excel, suivez sessions, leads, coût, taux de conversion, coût par lead et chiffre d’affaires par canal sur 8 semaines de données d’exemple, avec un graphique par indicateur."]]'::jsonb);
select pg_temp.track_fr('mk-acquisition','Acquisition : SEO, référencement payant et réseaux sociaux',
 'Les canaux qui apportent visiteurs et leads, et comment travailler chacun.',
 'Auditer le SEO d’un site, préparer une campagne Google Ads, mettre en place de la publicité sur les réseaux sociaux et lire les résultats de chaque canal.','[
 ["SEO Starter Guide","Le guide de démarrage SEO","Le guide de Google lui-même : le fonctionnement de la recherche, les titres, le contenu, les liens et ce qu’il faut éviter."],
 ["Beginner’s Guide to SEO","Le guide du SEO pour débutants","Recherche de mots-clés, optimisation des pages, SEO technique et liens, étape par étape."],
 ["Search Console Help","L’aide de Search Console","Lire les rapports de requêtes, de pages et d’indexation d’un site."],
 ["Google Ads Help","L’aide de Google Ads","Types de campagnes, mots-clés, enchères et suivi des conversions."],
 ["Meta Blueprint","Meta Blueprint","Des cours gratuits sur la publicité Facebook et Instagram."],
 ["Practice: an SEO audit of a real site","Pratique : l’audit SEO d’un vrai site","Choisissez un petit site (un commerce local, une association), listez ses problèmes techniques, de contenu et de liens, et écrivez un plan par priorité."]]'::jsonb);
select pg_temp.track_fr('mk-analytics','Mesure, tests et reporting',
 'Ce qui distingue le marketeur qui rapporte de celui qui décide : des données propres, des tests et des tableaux de bord clairs.',
 'Interroger des données marketing en SQL, dimensionner et lire un test A/B, et publier un tableau de bord qui répond à une question métier.','[
 ["Intro to SQL","Introduction au SQL","Sélectionner, filtrer, joindre et agréger : de quoi interroger des données marketing."],
 ["GA4 e-commerce sample dataset","Le jeu de données e-commerce GA4","Un vrai export GA4 anonymisé du Google Merchandise Store dans BigQuery, gratuit avec le bac à sable."],
 ["A/B test sample size calculator","Le calculateur de taille d’échantillon d’un test A/B","Combien de visiteurs il faut à un test avant que son résultat veuille dire quelque chose."],
 ["Looker Studio Help","L’aide de Looker Studio","Connecter GA4 et Sheets, construire graphiques et filtres, partager un rapport."],
 ["Project: a campaign performance dashboard","Projet : un tableau de bord de performance des campagnes","Un rapport Looker Studio avec le tunnel, le coût par lead et la conversion par canal, et trois recommandations écrites."]]'::jsonb);

-- Financial Analyst ---------------------------------------------------------------------
select pg_temp.res_fr('fa','tool','[
 ["Excel","Excel","Modèles, budgets et analyses : l’outil principal de l’analyste (recherches, tableaux croisés dynamiques, tables de données, raccourcis)"],
 ["Power BI or Tableau","Power BI ou Tableau","Tableaux de bord financiers : compte de résultat par activité, budget contre réel, indicateurs"],
 ["SAP or Oracle ERP","Un ERP SAP ou Oracle","D’où viennent les données comptables : grand livre, centres de coûts, commandes"],
 ["Anaplan, Pigment or Adaptive Planning","Anaplan, Pigment ou Adaptive Planning","Des outils EPM pour les budgets et les prévisions dans les grandes entreprises"],
 ["SEC EDGAR + annual reports","SEC EDGAR + rapports annuels","Les publications gratuites des sociétés cotées, pour s’entraîner à l’analyse et à la valorisation sur de vrais chiffres"]]'::jsonb);
select pg_temp.res_fr('fa','tip','[
 ["Build one public model: a listed company’s three statements and a DCF, with the source of each assumption written next to it.","Construisez un modèle public : les trois états financiers d’une société cotée et un DCF, avec la source de chaque hypothèse écrite à côté."],
 ["Interviews test the basics every time: walk through the three statements, say how a 10 rise in depreciation flows through them, and walk through a DCF.","Les entretiens vérifient toujours les bases : présenter les trois états financiers, dire comment une hausse de 10 des amortissements les traverse, et dérouler un DCF."],
 ["End every analysis with what the manager should do, not only the numbers: business partnering is what gets analysts promoted.","Terminez chaque analyse par ce que le manager doit faire, pas seulement par les chiffres : c’est le business partnering qui fait progresser un analyste."]]'::jsonb);

-- Learning tracks: Financial Analyst ----------------------------------------------------
select pg_temp.track_fr('fa-foundations','Les bases de la finance : la comptabilité et les trois états financiers',
 'La base que vérifie tout entretien en finance : comment une entreprise enregistre son activité et comment lire ses comptes.',
 'Lire un compte de résultat, un bilan et un tableau des flux de trésorerie, expliquer leurs liens, et calculer les ratios qu’un manager demande.','[
 ["Principles of Financial Accounting","Principles of Financial Accounting (OpenStax)","Un manuel ouvert et gratuit, en anglais : le cycle comptable, les trois états financiers, les créances, les stocks et les immobilisations."],
 ["Finance and capital markets","Finance et marchés de capitaux","Des leçons vidéo gratuites, en anglais, sur la comptabilité, les états financiers, les intérêts et la valorisation."],
 ["Excel essentials for analysts","Les bases d’Excel pour l’analyste","Formules, recherches, tableaux croisés dynamiques et graphiques : l’outil de toutes les équipes finance."],
 ["Practice: read a real annual report","Pratique : lire un vrai rapport annuel","Téléchargez le dernier rapport annuel (un 10-K sur EDGAR, ou le document d’enregistrement universel d’une société européenne) d’une entreprise que vous connaissez et écrivez une page : croissance, marges, trésorerie et dette."]]'::jsonb);
select pg_temp.track_fr('fa-modeling','Modélisation financière et valorisation',
 'Le cœur technique des postes d’analyste : des modèles qui projettent une activité et les méthodes qui la valorisent.',
 'Construire sous Excel un modèle à trois états liés, valoriser une entreprise par DCF et par multiples, et défendre ses hypothèses.','[
 ["Free financial modelling courses","Cours gratuits de modélisation financière","Des cours d’introduction, en anglais, à Excel, à la comptabilité et à la modélisation, avec certificats."],
 ["Principles of Finance","Principles of Finance (OpenStax)","Un manuel ouvert et gratuit, en anglais : valeur temps de l’argent, VAN et TRI, coût du capital et valorisation d’entreprise."],
 ["Finance Theory I","Finance Theory I (MIT)","Un cours du MIT avec vidéos et notes, en anglais : valeur actuelle, choix d’investissement, MEDAF et coût du capital."],
 ["Valuation data by industry","Données de valorisation par secteur","Coût du capital, bêtas et multiples par secteur, mis à jour chaque janvier, gratuits."],
 ["Project: a three-statement model and DCF of a listed company","Projet : un modèle à trois états et un DCF d’une société cotée","Cinq ans d’historique tirés des rapports annuels, cinq ans de prévisions, un DCF avec une table de sensibilité et une recommandation d’une page (voir les projets de portfolio plus bas)."]]'::jsonb);
select pg_temp.track_fr('fa-fpa','FP&A, reporting et business partnering',
 'Ce que font les équipes finance chaque mois : budgets, prévisions, analyse des écarts et reportings qui mènent à des décisions.',
 'Construire un budget et une prévision glissante, expliquer le budget contre le réel par les effets prix, volume et mix, et publier un tableau de bord financier mensuel.','[
 ["Principles of Managerial Accounting","Principles of Managerial Accounting (OpenStax)","Un manuel ouvert et gratuit, en anglais : comportement des coûts, budgets, coûts standards et écarts, mesure de la performance."],
 ["Intro to SQL","Introduction au SQL","Sélectionner, filtrer, joindre et agréger : de quoi extraire vous-même des données financières d’une base."],
 ["Power BI financial sample","L’exemple financier de Power BI","Un classeur d’exemple de ventes, coûts et marges par segment et par pays, pour construire un tableau de bord financier."],
 ["FRED economic data","Les données économiques FRED","Taux d’intérêt, inflation et croissance, pour appuyer les hypothèses d’une prévision."],
 ["Project: a budget vs actual pack","Projet : un reporting budget contre réel","Un reporting mensuel sous Power BI ou Excel : compte de résultat contre budget et année précédente, un pont des écarts, une prévision glissante et trois commentaires écrits."]]'::jsonb);

-- Product Owner -----------------------------------------------------------------------
select pg_temp.res_fr('po','tool','[
 ["Jira","Jira","Backlog, sprints et tableaux : l’outil où planifient la plupart des équipes produit"],
 ["Confluence or Notion","Confluence ou Notion","Les pages produit : vision, spécifications, décisions et notes de version au même endroit"],
 ["Figma","Figma","Consulter et commenter les écrans des designers ; esquisser un parcours vous-même"],
 ["Miro","Miro","Story maps, ateliers et tableaux de découverte avec l’équipe"],
 ["Mixpanel, Amplitude or GA4","Mixpanel, Amplitude ou GA4","L’analytics produit : tunnels, rétention et effet d’une mise en production"]]'::jsonb);
select pg_temp.res_fr('po','tip','[
 ["Show one product case study: the problem, what users told you, what you chose not to build and why, and what changed after release.","Montrez une étude de cas produit : le problème, ce que les utilisateurs vous ont dit, ce que vous avez choisi de ne pas faire et pourquoi, et ce qui a changé après la mise en production."],
 ["Interviews always ask how you say no: practise answering with a prioritisation method (RICE, MoSCoW) and a real example.","Les entretiens demandent toujours comment vous dites non : entraînez-vous à répondre avec une méthode de priorisation (RICE, MoSCoW) et un exemple réel."],
 ["Learn to read product data yourself (SQL, an analytics tool): a PO who checks the numbers earns the team’s trust.","Apprenez à lire vous-même les données produit (SQL, un outil d’analytics) : un PO qui vérifie les chiffres gagne la confiance de l’équipe."]]'::jsonb);

-- Project Manager ---------------------------------------------------------------------
select pg_temp.res_fr('pm','tool','[
 ["MS Project or Smartsheet","MS Project ou Smartsheet","Des plannings avec tâches, dépendances, jalons et chemin critique"],
 ["Jira","Jira","Les projets agiles : backlog, sprints, tableaux et rapports"],
 ["Excel","Excel","Budgets, plannings, registres des risques et des actions : toujours l’outil quotidien du chef de projet"],
 ["Power BI","Power BI","Un tableau de bord du portefeuille de projets : avancement, budget et risques pour le comité de pilotage"],
 ["Trello, Asana or Monday.com","Trello, Asana ou Monday.com","Des tableaux de tâches légers pour les petites équipes et les projets hors IT"]]'::jsonb);
select pg_temp.res_fr('pm','tip','[
 ["Bring one real plan to interviews: a project you ran (studies, an event, an association) with its scope, Gantt chart, budget and risk log.","Apportez un vrai planning en entretien : un projet que vous avez mené (études, événement, association) avec son périmètre, son Gantt, son budget et son registre des risques."],
 ["Recruiters ask for a certification more and more: CAPM or PSM I are within reach without experience, PMP or PRINCE2 later.","Les recruteurs demandent de plus en plus une certification : CAPM ou PSM I sont accessibles sans expérience, PMP ou PRINCE2 plus tard."],
 ["Talk about trade-offs, not tools: what you cut, delayed or escalated when time, budget or scope moved, and how you told the sponsor.","Parlez d’arbitrages, pas d’outils : ce que vous avez coupé, décalé ou remonté quand le délai, le budget ou le périmètre ont bougé, et comment vous l’avez dit au sponsor."]]'::jsonb);

-- Learning tracks: Product Owner --------------------------------------------------------
select pg_temp.track_fr('po-foundations','Les bases du Product Owner : Scrum, le backlog et les user stories',
 'Ce que vérifie d’abord tout entretien de Product Owner : comment fonctionne Scrum et comment un backlog transforme des besoins en travail.',
 'Expliquer les responsabilités du Product Owner dans Scrum, écrire des user stories avec critères d’acceptation et ordonner un backlog.','[
 ["The Scrum Guide","Le Guide Scrum","Le guide officiel (13 pages, aussi en français) : rôles, événements, artefacts et responsabilités du Product Owner."],
 ["Agile & Scrum","Agile et Scrum","Cours HelloKhedma : rôles et événements Scrum, estimation, Kanban et les indicateurs des équipes, avec exercices."],
 ["Requirements & user stories","Besoins et user stories","Cours HelloKhedma : besoins, user stories, critères d’acceptation en Étant donné / Quand / Alors, et affinage du backlog."],
 ["Practice: write the backlog of an app you use","Pratique : écrire le backlog d’une application que vous utilisez","Choisissez une application de votre quotidien : écrivez 3 epics et 12 user stories avec critères d’acceptation, puis ordonnez-les et justifiez."],
 ["Professional Scrum Product Owner I (PSPO I)","Professional Scrum Product Owner I (PSPO I)","La certification de Product Owner la plus connue : un examen en ligne, en anglais, sans formation obligatoire."]]'::jsonb);
select pg_temp.track_fr('po-discovery','Découverte produit, priorisation et indicateurs',
 'Comment les bons Product Owners décident quoi construire : parler aux utilisateurs, choisir avec une méthode, vérifier le résultat dans les données.',
 'Mener des entretiens utilisateurs, prioriser avec RICE ou MoSCoW, définir des indicateurs de succès et les lire vous-même en SQL.','[
 ["User interviews","Les entretiens utilisateurs","Comment préparer, mener et analyser des entretiens avec des utilisateurs sans les influencer (en anglais)."],
 ["Intro to SQL","Introduction au SQL","Sélectionner, filtrer, joindre et agréger : de quoi répondre vous-même à vos questions produit dans la base."],
 ["Statistics & A/B testing","Statistiques et tests A/B","Cours HelloKhedma : moyennes, variation, significativité et comment lire un test A/B sans se tromper."],
 ["A/B test sample size calculator","Le calculateur de taille d’échantillon d’un test A/B","Combien d’utilisateurs il faut à un test avant que son résultat veuille dire quelque chose."],
 ["Project: a product case study","Projet : une étude de cas produit","Cinq entretiens utilisateurs, un backlog priorisé et une roadmap d’une page pour une vraie application (voir les projets de portfolio plus bas)."]]'::jsonb);
select pg_temp.track_fr('po-delivery','Roadmaps, parties prenantes et livraison',
 'Le quotidien d’un Product Owner confirmé : une roadmap crédible, des parties prenantes d’accord sur les priorités, et des livraisons qui font bouger un indicateur.',
 'Construire une roadmap orientée résultats, animer une sprint review qui mène à des décisions, et rendre compte de la valeur livrée.','[
 ["Evidence-Based Management guide","Le guide Evidence-Based Management","Le guide de Scrum.org pour mesurer la valeur : valeur actuelle, délai de mise sur le marché, capacité à innover (en anglais)."],
 ["Excel for analysis","Excel pour l’analyse","Cours HelloKhedma : recherches, tableaux croisés dynamiques et graphiques, pour les bilans de livraison et les business cases."],
 ["Practice: turn a feature list into an outcome roadmap","Pratique : transformer une liste de fonctionnalités en roadmap orientée résultats","Prenez 10 demandes de fonctionnalités, regroupez-les sous 3 résultats avec un indicateur chacun, et placez-les en Maintenant / Ensuite / Plus tard."],
 ["Project: a release plan and a stakeholder update","Projet : un plan de livraison et un point aux parties prenantes","Un plan de livraison sur un trimestre, les risques et dépendances, et le point d’une page que vous enverriez aux sponsors."]]'::jsonb);

-- Learning tracks: Project Manager ------------------------------------------------------
select pg_temp.track_fr('pm-foundations','Les bases de la gestion de projet : périmètre, planning, budget et risques',
 'La base que vérifie tout entretien de chef de projet : comment cadrer un projet et le planifier pour qu’il puisse être suivi.',
 'Rédiger une charte projet, découper le travail, construire un Gantt avec le chemin critique, un budget et un registre des risques.','[
 ["Project management guide","Le guide de la gestion de projet","Des guides gratuits, en anglais, sur les phases d’un projet, la charte, le planning, les risques et les points d’avancement."],
 ["Excel for analysis","Excel pour l’analyse","Cours HelloKhedma : formules, recherches, tableaux croisés dynamiques et graphiques, l’outil des plannings, budgets et registres."],
 ["BPMN & process mapping","BPMN et cartographie des processus","Cours HelloKhedma : cartographier le travail avant et après le projet, pour s’accorder sur le périmètre."],
 ["Practice: plan a project you know","Pratique : planifier un projet que vous connaissez","Un déménagement, un événement ou une petite application : écrivez le périmètre, un découpage du travail, un Gantt sous Excel, un budget et cinq risques avec leurs réponses."],
 ["Certified Associate in Project Management (CAPM)","Certified Associate in Project Management (CAPM)","La certification d’entrée du PMI : aucune expérience de projet exigée, 23 heures de formation."]]'::jsonb);
select pg_temp.track_fr('pm-agile','Livraison agile et hybride',
 'La plupart des projets IT mélangent un planning fixe et des équipes agiles : comment piloter les deux et en rendre compte.',
 'Piloter un projet avec des équipes Scrum ou Kanban à l’intérieur d’un planning à jalons, et suivre l’avancement avec un tableau de bord.','[
 ["Agile & Scrum","Agile et Scrum","Cours HelloKhedma : rôles et événements Scrum, estimation, Kanban et les indicateurs des équipes, avec exercices."],
 ["The Kanban Guide","Le Guide Kanban","Le court guide officiel de Kanban : visualiser le travail, limiter le travail en cours, mesurer le flux."],
 ["Requirements & user stories","Besoins et user stories","Cours HelloKhedma : recueillir les besoins et les transformer en user stories que l’équipe peut livrer."],
 ["Power BI & DAX","Power BI et DAX","Cours HelloKhedma : construire le tableau de bord que lit un comité de pilotage : avancement, budget, risques."],
 ["Project: a project status dashboard","Projet : un tableau de bord d’avancement","Un tableau de bord d’une page sous Power BI ou Excel pour un projet réel ou d’exemple : jalons, budget consommé, risques principaux et décisions attendues."]]'::jsonb);
select pg_temp.track_fr('pm-certification','Certifications et projets plus importants',
 'Ce que demandent les offres de chef de projet confirmé : une certification reconnue et l’expérience des budgets, des fournisseurs et du changement.',
 'Préparer une certification PMP, PRINCE2 ou PSM, et piloter le volet humain du changement sur un projet plus important.','[
 ["Professional Scrum Master I (PSM I)","Professional Scrum Master I (PSM I)","Un examen en ligne sur Scrum, en anglais, sans formation obligatoire : la preuve que vous savez animer des équipes agiles."],
 ["Project Management Professional (PMP)","Project Management Professional (PMP)","La certification de référence mondiale : 3 à 5 ans de pilotage de projets et 35 heures de formation exigés."],
 ["PRINCE2 Foundation","PRINCE2 Foundation","La méthode par processus répandue au Royaume-Uni, en Europe et dans les projets publics."],
 ["Project: a full plan for a real initiative","Projet : un plan complet pour une initiative réelle","Une charte, un planning, un budget, un registre des risques, une matrice RACI et un plan de communication pour l’initiative réelle d’une association ou d’une entreprise que vous connaissez (voir les projets de portfolio plus bas)."]]'::jsonb);

-- GRC Analyst -------------------------------------------------------------------------
select pg_temp.res_fr('grc','tool','[
 ["Excel","Excel","Registres des risques, matrices de contrôles et suivis d’audit : c’est encore là que commence l’essentiel du travail GRC"],
 ["ServiceNow GRC, Archer or OneTrust","ServiceNow GRC, Archer ou OneTrust","Les plateformes GRC : risques, contrôles, politiques, audits et évaluations des fournisseurs au même endroit"],
 ["Vanta or Drata","Vanta ou Drata","L’automatisation de la conformité pour les start-ups : les preuves SOC 2 et ISO 27001 collectées dans le cloud et les outils RH"],
 ["Microsoft Purview","Microsoft Purview","Protection des données et conformité dans Microsoft 365 : classification, conservation, journaux d’audit"],
 ["Power BI","Power BI","Les tableaux de bord des risques et de la conformité pour le comité de direction"]]'::jsonb);
select pg_temp.res_fr('grc','tip','[
 ["GRC hires people from many backgrounds (IT support, audit, law, project management): say what you bring and show one GRC deliverable, such as a risk register or an ISO 27001 gap assessment.","La GRC recrute des profils très variés (support IT, audit, droit, gestion de projet) : dites ce que vous apportez et montrez un livrable GRC, par exemple un registre des risques ou un état des lieux ISO 27001."],
 ["Learn the vocabulary of one framework well (ISO 27001 and its Annex A, or NIST CSF) rather than a little of everything: interviews go into the details.","Maîtrisez bien le vocabulaire d’un référentiel (ISO 27001 et son annexe A, ou le NIST CSF) plutôt qu’un peu de tout : les entretiens entrent dans le détail."],
 ["European rules (GDPR, NIS2, DORA) create many offers in France and Europe: name the ones you know on your CV, with what you did with them.","Les règles européennes (RGPD, NIS2, DORA) créent beaucoup d’offres en France et en Europe : citez celles que vous connaissez sur votre CV, avec ce que vous en avez fait."]]'::jsonb);

-- Learning tracks: GRC Analyst ----------------------------------------------------------
select pg_temp.track_fr('grc-foundations','Les bases de la GRC : sécurité, risques et contrôles',
 'Ce que vérifie d’abord tout entretien GRC : les bases de la sécurité de l’information, comment on évalue un risque et comment un contrôle le réduit.',
 'Expliquer confidentialité, intégrité et disponibilité, évaluer un risque (probabilité × impact), le relier à des contrôles et tenir un registre des risques.','[
 ["NIST Cybersecurity Framework 2.0","Le NIST Cybersecurity Framework 2.0","Le référentiel gratuit sur lequel s’appuient la plupart des équipes GRC : Gouverner, Identifier, Protéger, Détecter, Répondre, Rétablir (en anglais)."],
 ["SecNumacadémie","SecNumacadémie","Le MOOC gratuit de l’ANSSI : les bases de la cybersécurité, en français, avec une attestation."],
 ["Incident management & ITIL","Gestion des incidents et ITIL","Cours HelloKhedma : incidents, problèmes, changements et SLA : les processus IT sur lesquels reposent les contrôles de sécurité."],
 ["Excel for analysis","Excel pour l’analyse","Cours HelloKhedma : recherches, mise en forme conditionnelle et tableaux croisés dynamiques, pour les registres des risques et les matrices de contrôles."],
 ["Practice: a risk register for a small company","Pratique : un registre des risques pour une petite entreprise","Pour une petite entreprise que vous connaissez (un commerce, une agence) : listez 10 actifs, 10 risques avec probabilité et impact, et un contrôle pour chacun."],
 ["CompTIA Security+","CompTIA Security+","La certification d’entrée en sécurité la plus connue : menaces, contrôles, risques et conformité (examen en anglais)."]]'::jsonb);
select pg_temp.track_fr('grc-standards','Normes et réglementations : ISO 27001, RGPD, NIS2 et DORA',
 'Les textes que citent les offres GRC : le système de management ISO 27001, la protection des données personnelles et les nouvelles règles européennes des secteurs critiques et de la finance.',
 'Expliquer les clauses et l’annexe A de l’ISO 27001, tenir un registre des traitements RGPD, et dire ce qu’ajoutent NIS2 et DORA.','[
 ["ISO/IEC 27001","ISO/IEC 27001","La page officielle de la norme : ce qu’est un système de management de la sécurité de l’information (SMSI) et comment se passe la certification."],
 ["GDPR text, article by article","Le texte du RGPD, article par article","Le règlement avec ses considérants, facile à parcourir : principes, droits, registre, analyses d’impact (en anglais ; le texte français est sur le site de la CNIL)."],
 ["NIS2 directive","La directive NIS2","La page de la Commission européenne sur NIS2 : quelles organisations sont concernées et ce qui est exigé."],
 ["BPMN & process mapping","BPMN et cartographie des processus","Cours HelloKhedma : cartographier un processus pour voir où placer un contrôle et qui l’exécute."],
 ["SQL for data jobs","SQL pour les métiers de la data","Cours HelloKhedma : interroger vous-même les listes d’utilisateurs, les droits d’accès et les journaux pour réunir des preuves d’audit."],
 ["Project: an ISO 27001 gap assessment","Projet : un état des lieux ISO 27001","Comparer une organisation réelle ou fictive aux contrôles de l’ISO 27001 et écrire le plan d’action (voir les projets de portfolio plus bas)."]]'::jsonb);
select pg_temp.track_fr('grc-audit','Audits, tiers et certifications',
 'Ce que demandent les offres GRC confirmées : mener des audits, évaluer les fournisseurs et le cloud, rendre compte à la direction, et une certification reconnue.',
 'Planifier et mener un audit IT, évaluer un fournisseur et un service cloud, présenter les risques dans un tableau de bord, et préparer CISA, CRISC ou ISO 27001 Lead Implementer.','[
 ["Cloud fundamentals with AWS","Les fondamentaux du cloud avec AWS","Cours HelloKhedma : responsabilité partagée, identités et accès, journaux : ce qu’un auditeur vérifie dans le cloud."],
 ["Power BI & DAX","Power BI et DAX","Cours HelloKhedma : construire le tableau de bord des risques et de la conformité que lit un comité de direction."],
 ["Practice: a supplier security questionnaire","Pratique : un questionnaire de sécurité fournisseur","Écrivez 20 questions pour évaluer un fournisseur SaaS (accès, chiffrement, sauvegardes, incidents, certifications), puis répondez-y pour un service que vous utilisez à partir de sa page de confiance publique."],
 ["ISO/IEC 27001 Lead Implementer","ISO/IEC 27001 Lead Implementer","La certification pour mener un projet ISO 27001 : cinq jours de formation et un examen, fréquente dans les offres de conseil GRC."],
 ["Certified Information Systems Auditor (CISA)","Certified Information Systems Auditor (CISA)","La certification de référence des auditeurs IT ; l’expérience est exigée pour le titre, pas pour l’examen."],
 ["Certified in Risk and Information Systems Control (CRISC)","Certified in Risk and Information Systems Control (CRISC)","La certification de l’ISACA pour les responsables des risques IT."]]'::jsonb);

-- Sales ---------------------------------------------------------------------------------
select pg_temp.res_fr('sales','tool','[
 ["Salesforce or HubSpot CRM","Salesforce ou le CRM HubSpot","Là où chaque lead, opportunité et appel est noté : le pipeline et les prévisions en sortent"],
 ["LinkedIn Sales Navigator","LinkedIn Sales Navigator","Trouver les bons comptes et les bonnes personnes, suivre leur actualité et les contacter"],
 ["Lemlist, Apollo or La Growth Machine","Lemlist, Apollo ou La Growth Machine","Des séquences de prospection : e-mails, appels et étapes LinkedIn, avec les taux de réponse"],
 ["Gong or Modjo","Gong ou Modjo","Enregistrement et coaching des appels : réécouter ses rendez-vous de découverte et ses démos"],
 ["Excel or Google Sheets","Excel ou Google Sheets","Listes de comptes, plans de territoire et le reporting de pipeline que demande votre manager"]]'::jsonb);
select pg_temp.res_fr('sales','tip','[
 ["Sales hires on proof of results: put numbers on your CV (quota reached, deals signed, meetings booked, revenue), even from an internship, a summer job or a student association.","La vente recrute sur des résultats : mettez des chiffres sur votre CV (objectifs atteints, contrats signés, rendez-vous obtenus, chiffre d’affaires), même d’un stage, d’un job d’été ou d’une association étudiante."],
 ["Many careers start as SDR or business developer: show you can prospect with a short outreach sequence you wrote and the reply rate it got.","Beaucoup de carrières commencent comme SDR ou business developer : montrez que vous savez prospecter avec une courte séquence que vous avez écrite et le taux de réponse obtenu."],
 ["Learn one qualification method (BANT or MEDDIC) and one CRM well: interviews include a role play, and managers ask how you keep your pipeline clean.","Maîtrisez une méthode de qualification (BANT ou MEDDIC) et un CRM : les entretiens comportent une mise en situation, et les managers demandent comment vous tenez votre pipeline à jour."]]'::jsonb);

-- Learning tracks: Sales -----------------------------------------------------------------
select pg_temp.track_fr('sales-foundations','Les bases de la vente : clients, prospection et CRM',
 'La base de tout métier commercial : qui achète, pourquoi, et comment engager la conversation avec les bonnes personnes.',
 'Décrire un client idéal et ses acheteurs, construire une liste de comptes cibles, écrire une séquence de prospection et tout suivre dans un CRM.','[
 ["Digital marketing foundations","Les bases du marketing digital","Cours HelloKhedma : le tunnel, les clients et le positionnement, là où commence toute vente."],
 ["HubSpot Academy sales courses","Les cours de vente de HubSpot Academy","Des cours gratuits, en anglais, sur la vente inbound, la prospection et l’enablement commercial, avec certificats."],
 ["E-mail marketing, CRM and automation","E-mailing, CRM et marketing automation","Cours HelloKhedma : le CRM, les étapes du cycle de vie et le lead scoring avec lesquels les équipes commerciales travaillent chaque jour."],
 ["Practice: an ideal customer profile and 30 target accounts","Pratique : un profil client idéal et 30 comptes cibles","Choisissez un produit que vous connaissez, écrivez son profil client idéal et ses personas acheteurs, puis listez 30 vraies entreprises cibles et pourquoi chacune correspond."]]'::jsonb);
select pg_temp.track_fr('sales-deals','Découverte, négociation et closing',
 'Ce qui transforme un rendez-vous en contrat signé : les questions, une proposition de valeur claire, les objections et la négociation.',
 'Mener un rendez-vous de découverte qui qualifie une affaire (BANT ou MEDDIC), répondre aux objections classiques et négocier sans brader le prix.','[
 ["Successful Negotiation: Essential Strategies and Skills","Successful Negotiation (Université du Michigan)","Un cours en anglais, gratuit en audit : préparation, ancrage, concessions et conclusion."],
 ["Program on Negotiation: free articles","Les articles gratuits du Program on Negotiation","Des articles du programme de négociation de la Harvard Law School, en anglais, sur le prix, les objections et les accords qui durent."],
 ["Practice: a recorded mock discovery call","Pratique : un rendez-vous de découverte enregistré","Enregistrez un rendez-vous de découverte de 20 minutes avec un proche dans le rôle de l’acheteur : questions ouvertes, problème, impact, budget, processus de décision ; puis notez-vous."],
 ["Practice: answer the ten classic objections","Pratique : répondre aux dix objections classiques","Écrivez votre réponse à « c’est trop cher », « pas le temps », « nous avons déjà un fournisseur », « envoyez-moi un e-mail » et six autres, puis entraînez-vous à voix haute."]]'::jsonb);
select pg_temp.track_fr('sales-pipeline','Pipeline, prévisions et grands comptes',
 'Ce sur quoi sont jugés les account executives et les responsables grands comptes : un pipeline propre, des prévisions fiables et des comptes qui grandissent.',
 'Gérer un pipeline dans un CRM, en tirer la prévision du trimestre, et écrire un plan de développement d’un grand compte.','[
 ["Salesforce Trailhead","Salesforce Trailhead","Des modules gratuits sur Sales Cloud : leads, opportunités, pipeline et rapports, avec des badges reconnus par les recruteurs."],
 ["HubSpot free CRM","Le CRM gratuit de HubSpot","Gérer un vrai pipeline : affaires, étapes, tâches et séquences, gratuitement."],
 ["Excel for analysis","Excel pour l’analyse","Cours HelloKhedma : tableaux croisés dynamiques et recherches pour les reportings de pipeline et les prévisions."],
 ["Project: a pipeline analysis and next-quarter forecast","Projet : une analyse de pipeline et la prévision du trimestre suivant","Taux de transformation, cycle de vente et prévision à partir d’un vrai jeu de données CRM (voir les projets de portfolio plus bas)."],
 ["Project: a key account plan","Projet : un plan de compte stratégique","Priorités, comité d’achat, MEDDIC et plan à 90 jours pour une vraie entreprise (voir les projets de portfolio plus bas)."]]'::jsonb);
