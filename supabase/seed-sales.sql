-- Sales path only (2026-11-19): the part of supabase/seed.sql that adds it, short enough to copy on a phone.
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

update public.training_steps s set course_id = v.c from (values
  ('sales-foundations','Digital marketing foundations','marketing-foundations'),
  ('sales-foundations','E-mail marketing, CRM and automation','email-crm'), ('sales-pipeline','Excel for analysis','excel')
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

-- Check: should list 12 paths ending with sales, and 3 tracks for sales.
select string_agg(id, ', ' order by sort_order) as paths,
       (select count(*) from public.training_tracks where path_id = 'sales') as sales_tracks
from public.career_paths;

-- End of file. The lines below are padding: a phone copy sometimes loses the last lines of a page.
--
--
--
--
--
