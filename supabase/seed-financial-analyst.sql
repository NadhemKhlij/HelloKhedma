-- Financial Analyst path only (2026-11-17): the part of supabase/seed.sql that adds it, short enough to copy on a phone.
-- Safe to run twice. The full seed.sql gives the same result.

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
   array['Financial Analyst','FP&A Analyst','Financial Planning Analyst','Finance Business Partner','Corporate Finance Analyst'],8)
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
  ('fa', array['Analyste Financier','Analyste FP&A','Contrôleur de Gestion','Business Partner Finance','Analyste Corporate Finance'])
) as v(id, t) where public.career_paths.id = v.id;

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

update public.training_steps s set course_id = v.c from (values
  ('fa-foundations','Principles of Financial Accounting','finance-foundations'), ('fa-foundations','Finance and capital markets','finance-foundations'),
  ('fa-foundations','Excel essentials for analysts','excel'),
  ('fa-modeling','Free financial modelling courses','financial-modeling'), ('fa-modeling','Principles of Finance','valuation'),
  ('fa-modeling','Finance Theory I','valuation'),
  ('fa-fpa','Principles of Managerial Accounting','fpa'), ('fa-fpa','Intro to SQL','sql'), ('fa-fpa','Power BI financial sample','power-bi')
) as v(tid, title, c)
where s.id = md5(v.tid || ':' || v.title)::uuid;

update public.career_paths p set name_fr = v.n, blurb_fr = v.b
from (values
  ('de', 'Data Engineer', 'Pipelines, entrepôts de données, cloud'),
  ('ba', 'Business Analyst', 'Besoins, processus, parties prenantes'),
  ('as', 'Support applicatif', 'Incidents, supervision, run'),
  ('da', 'Data Analyst', 'Analyses, tableaux de bord, storytelling'),
  ('do', 'DevOps Engineer', 'CI/CD, conteneurs, cloud, automatisation'),
  ('ai', 'AI Engineer', 'Applications LLM, agents, RAG, évaluations'),
  ('mk', 'Marketing digital', 'SEO, publicité, analytics, campagnes'),
  ('fa', 'Analyste financier', 'Modélisation, FP&A, reporting, valorisation')
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

-- Check: should list 8 paths with fa last, and 3 tracks for fa.
select string_agg(id, ', ' order by sort_order) as paths,
       (select count(*) from public.training_tracks where path_id = 'fa') as fa_tracks
from public.career_paths;

-- End of file. The lines below are padding: a phone copy sometimes loses the last lines of a page.
--
--
--
--
--
