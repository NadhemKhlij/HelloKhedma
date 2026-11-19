-- Course review, batch 1 (2026-11-19): roadmap steps added or reworded on 8 tracks (data modelling, Python, Excel,
-- certifications by level). The part of supabase/seed.sql that changed, short enough to copy on a phone. Safe to run twice.

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

select pg_temp.track('de','de-pipelines','Pipelines and orchestration','intermediate',
 'Move from scripts to scheduled, tested, reproducible pipelines.',
 'Build a scheduled ELT pipeline with a warehouse, dbt models and tests.',2,'[
 ["Docker: get started","Containers for reproducible local pipelines.","learn","Docker docs","https://docs.docker.com/get-started/",3],
 ["Airflow tutorial","Write your first DAG, tasks, schedules and dependencies.","learn","Apache Airflow","https://airflow.apache.org/docs/apache-airflow/stable/tutorial/index.html",4],
 ["dbt Fundamentals","Models, tests, documentation and deployment.","learn","dbt Learn","https://learn.getdbt.com",6],
 ["Data modeling", "HelloKhedma course: star schemas, facts and dimensions, slowly changing dimensions and data vault: the warehouse design questions every data engineering interview asks.", "learn", "HelloKhedma", "", 4],
 ["BigQuery sandbox","Load data into a cloud warehouse without a credit card.","practice","Google Cloud","https://cloud.google.com/bigquery/docs/sandbox",3],
 ["Data Engineering Zoomcamp","Free, project-based course covering Docker, Postgres, orchestration, dbt, Spark and Kafka. Do it alongside or instead of the steps above.","learn","DataTalks.Club","https://github.com/DataTalksClub/data-engineering-zoomcamp",40]]'::jsonb);
select pg_temp.track('de','de-advanced','Scale, streaming and certification','advanced',
 'What separates a junior portfolio from a hireable one.',
 'Design reliable pipelines, explain trade-offs, and back it with a project and a cloud certification.',3,'[
 ["Spark quick start","DataFrames and SQL on a distributed engine.","learn","Apache Spark","https://spark.apache.org/docs/latest/quick-start.html",5],
 ["Kafka quickstart","Topics, producers and consumers.","learn","Apache Kafka","https://kafka.apache.org/quickstart",3],
 ["Designing Data-Intensive Applications","Reference book on storage, replication and streaming. Read the chapters you need.","learn","dataintensive.net","https://dataintensive.net",20,false],
 ["Portfolio project: end-to-end pipeline","Ingest a public API daily, orchestrate it, transform with dbt, add data tests and a dashboard. Write down your trade-offs.","project","Your repo","",25],
 ["Associate data engineer certification (Databricks or Microsoft Fabric)", "The first certification to aim for in France: Databricks Certified Data Engineer Associate, or Microsoft’s Fabric Data Engineer Associate (DP-700) for companies on Azure. Within reach after this roadmap.", "certification", "Databricks / Microsoft", "https://www.databricks.com/learn/certification/data-engineer-associate", 40, false],
 ["Cloud data engineer certification","For experienced engineers: Google Professional Data Engineer (Google recommends 3 or more years in data, including a year on Google Cloud); AWS Data Engineer Associate is the AWS equivalent. On a first data job, start with the associate certification above.","certification","Google Cloud","https://cloud.google.com/learn/certification/data-engineer",30,false]]'::jsonb);
select pg_temp.track('da','da-viz','Python, BI and visual storytelling','intermediate',
 'Turn analysis into something a manager can act on.',
 'Build dashboards that lead to a decision and explain them clearly.',2,'[
 ["Python essentials", "HelloKhedma course: variables, lists, functions, files and errors: the Python you need before pandas.", "learn", "HelloKhedma", "", 4],
 ["pandas","Manipulate and summarise data in Python.","learn","Kaggle Learn","https://www.kaggle.com/learn/pandas",4],
 ["Data visualization","Charts that show the right comparison.","learn","Kaggle Learn","https://www.kaggle.com/learn/data-visualization",4],
 ["Power BI","Pick Power BI or Tableau and stay with one. Power BI documentation and training.","learn","Microsoft Learn","https://learn.microsoft.com/power-bi/",8],
 ["DAX: measures, CALCULATE and time intelligence","The formulas behind every Power BI report: filter context, CALCULATE, year-over-year, ranking.","learn","HelloKhedma","",5],
 ["Tableau free training","The alternative if your target employers use Tableau.","learn","Tableau","https://www.tableau.com/learn/training",8],
 ["Storytelling with Data","Declutter charts, focus attention, lead with the insight.","learn","storytellingwithdata.com","https://www.storytellingwithdata.com",3]]'::jsonb);
select pg_temp.track('ba','ba-foundations','Core business analysis','beginner',
 'Requirements, stories and the agile vocabulary used in every team.',
 'Elicit requirements and write clear user stories with acceptance criteria.',1,'[
 ["User stories","Write stories with a clear who, what and why.","learn","Atlassian","https://www.atlassian.com/agile/project-management/user-stories",1],
 ["The Scrum Guide","The short source of truth for Scrum roles and events.","learn","scrumguides.org","https://scrumguides.org",1],
 ["Jira and agile tutorials","Epics, stories, boards and workflows.","learn","Atlassian","https://www.atlassian.com/agile/tutorials",2],
 ["SQL practice","Check requirements against real data.","learn","SQLZoo","https://sqlzoo.net",5],
 ["Excel for analysis", "HelloKhedma course: lookups, pivot tables and charts: the tool BAs use to check data and share requirements.", "learn", "HelloKhedma", "", 4],
 ["Practice: write 10 user stories for an app you use","Include acceptance criteria and a prioritised backlog.","practice","Your notes","",3]]'::jsonb);
select pg_temp.track('ba','ba-process','Process modeling and reporting','intermediate',
 'Show how work flows today, where it breaks, and what changes would be worth it.',
 'Map as-is and to-be processes and quantify the impact with a report.',2,'[
 ["BPMN overview","Notation for events, tasks and gateways.","learn","Camunda","https://camunda.com/bpmn/",2],
 ["Data modeling", "HelloKhedma course: entities, relationships and keys, to read a data model and talk with data teams about what a requirement needs.", "learn", "HelloKhedma", "", 3],
 ["Practice: model a process in draw.io","Draw the as-is flow of a process you know and mark the pain points.","practice","draw.io","https://www.drawio.com",3],
 ["Power BI documentation and training","Build a report from Excel or SQL data.","learn","Microsoft Learn","https://learn.microsoft.com/power-bi/",8],
 ["Practice: as-is, to-be and gap list","Produce a one-page process change proposal with expected KPIs.","practice","Your notes","",4]]'::jsonb);
select pg_temp.track('do','do-cloud','Cloud, Infrastructure as Code and reliability','advanced',
 'Run real infrastructure from code and keep it healthy.',
 'Create cloud infrastructure with Terraform from a pipeline, monitor it with SLOs and hold a recognised certification.',3,'[
 ["Terraform tutorials","Get started with Terraform on AWS, Azure or Google Cloud.","learn","HashiCorp","https://developer.hashicorp.com/terraform/tutorials",8],
 ["AWS Skill Builder","Free cloud fundamentals courses, including Cloud Practitioner Essentials.","learn","AWS","https://skillbuilder.aws",10],
 ["Prometheus: first steps","Metrics, targets and queries.","learn","Prometheus","https://prometheus.io/docs/introduction/first_steps/",2],
 ["SRE book: service level objectives","Define SLIs, SLOs and error budgets.","learn","Google SRE","https://sre.google/sre-book/service-level-objectives/",1.5],
 ["Project: infrastructure as code","Create the cloud resources of your API with Terraform from a pipeline, with remote state, a dashboard and one alert.","project","Your repo","",15],
 ["AWS Certified Cloud Practitioner or CKA","For a first job: AWS Cloud Practitioner covers the cloud fundamentals in one exam. The CKA (Kubernetes administration, CNCF) is harder and is worth it once you run clusters; see the next step.","certification","AWS / CNCF","https://aws.amazon.com/certification/",25,false],
 ["Associate cloud or Kubernetes certification (AZ-104, AWS Solutions Architect or CKA)", "With some experience, the certifications DevOps offers ask for most: Azure Administrator (AZ-104), AWS Solutions Architect Associate, or the CNCF’s Certified Kubernetes Administrator (a hands-on exam).", "certification", "Microsoft / AWS / CNCF", "https://www.cncf.io/training/certification/cka/", 60, false]]'::jsonb);
select pg_temp.track('grc','grc-foundations','GRC foundations: security basics, risks and controls','beginner',
 'What every GRC interview checks first: the basics of information security, how a risk is assessed and how a control reduces it.',
 'Explain confidentiality, integrity and availability, assess a risk (likelihood × impact), link it to controls and keep a risk register.',1,'[
 ["Security and GRC foundations", "HelloKhedma course: the CIA triad, controls, governance roles, NIST CSF 2.0, security policies and the GRC analyst’s week.", "learn", "HelloKhedma", "", 4],
 ["NIST Cybersecurity Framework 2.0","The free framework most GRC teams map to: Govern, Identify, Protect, Detect, Respond, Recover.","learn","NIST","https://www.nist.gov/cyberframework",4],
 ["SecNumacadémie","The free online course of the French national cybersecurity agency (ANSSI): the basics of security, with a certificate.","learn","ANSSI","https://secnumacademie.gouv.fr/",20],
 ["Incident management & ITIL","HelloKhedma course: incidents, problems, changes and SLAs: the IT processes that security controls rely on.","learn","HelloKhedma","",6],
 ["Excel for analysis","HelloKhedma course: lookups, conditional formatting and pivot tables, for risk registers and control matrices.","learn","HelloKhedma","",6],
 ["IT risk management", "HelloKhedma course: scoring risks, the risk register, treatment and residual risk, appetite, supplier risk and business continuity.", "learn", "HelloKhedma", "", 4],
 ["Practice: a risk register for a small company","For a small company you know (a shop, an agency): list 10 assets, 10 risks with likelihood and impact, and one control for each.","practice","Your register","",4],
 ["ISO/IEC 27001 Foundation", "The entry certification most asked for in French GRC offers: the vocabulary, clauses and Annex A of ISO 27001, one short exam, no experience needed.", "certification", "PECB", "https://pecb.com/", 15, false],
 ["CompTIA Security+","The best-known entry-level security certification internationally: threats, controls, risk and compliance. In France, ISO 27001 Foundation (above) is asked for more often.","certification","CompTIA","https://www.comptia.org/certifications/security",60,false],
 ["Microsoft Security, Compliance and Identity Fundamentals (SC-900)", "Free learning paths and a short exam on Microsoft 365 and Azure security and compliance (Entra ID, Purview, Defender), the tools most French companies use.", "certification", "Microsoft Learn", "https://learn.microsoft.com/en-us/credentials/certifications/security-compliance-and-identity-fundamentals/", 10, false]]'::jsonb);
select pg_temp.track('mk','mk-acquisition','Acquisition: SEO, paid search and paid social','intermediate',
 'The channels that bring visitors and leads, and how to work each one.',
 'Audit a site for SEO, plan a Google Ads campaign, set up paid social and read the results of each channel.',2,'[
 ["SEO Starter Guide","Google’s own guide: how search works, titles, content, links and what to avoid.","learn","Google Search Central","https://developers.google.com/search/docs/fundamentals/seo-starter-guide",3],
 ["Beginner’s Guide to SEO","Keyword research, on-page, technical SEO and links, step by step.","learn","Moz","https://moz.com/beginners-guide-to-seo",6],
 ["Search Console Help","Read the queries, pages and indexing reports of a site.","learn","Google","https://support.google.com/webmasters",2],
 ["Google Ads Help","Campaign types, keywords, bidding and conversion tracking.","learn","Google","https://support.google.com/google-ads",4],
 ["Google Ads certifications", "Free official courses and exams (Search, Display, Video, Measurement) on Skillshop: recruiters look for them on junior CVs.", "certification", "Google Skillshop", "https://skillshop.withgoogle.com/", 8],
 ["Meta Blueprint","Free courses on Facebook and Instagram advertising.","learn","Meta","https://www.facebook.com/business/learn",5],
 ["Practice: an SEO audit of a real site","Pick a small site (a local business, an association), list its technical, content and link problems and write a prioritised plan.","practice","Your document","",6]]'::jsonb);

create or replace function pg_temp.track_fr(tid text, ttl text, summ text, outc text, steps jsonb)
returns void language sql as $$
  update public.training_tracks set title_fr = ttl, summary_fr = summ, outcome_fr = outc where id = tid;
  update public.training_steps s
  set title_fr = x.e->>1, description_fr = nullif(coalesce(x.e->>2, ''), '')
  from jsonb_array_elements(steps) as x(e)
  where s.id = md5(tid || ':' || (x.e->>0))::uuid;
$$;

select pg_temp.track_fr('de-pipelines','Pipelines et orchestration',
 'Passer des scripts à des pipelines planifiés, testés et reproductibles.',
 'Construire un pipeline ELT planifié avec un entrepôt de données, des modèles dbt et des tests.','[
 ["Docker: get started","Docker : premiers pas","Des conteneurs pour des pipelines locaux reproductibles."],
 ["Airflow tutorial","Tutoriel Airflow","Écrire votre premier DAG : tâches, planification et dépendances."],
 ["dbt Fundamentals","Les fondamentaux de dbt","Modèles, tests, documentation et déploiement."],
 ["BigQuery sandbox","Bac à sable BigQuery","Charger des données dans un entrepôt cloud sans carte bancaire."],
 ["Data Engineering Zoomcamp","Data Engineering Zoomcamp","Cours gratuit par projets : Docker, Postgres, orchestration, dbt, Spark et Kafka. À suivre en parallèle ou à la place des étapes ci-dessus."],
 ["Data modeling", "Modélisation des données", "Cours HelloKhedma : schémas en étoile, faits et dimensions, dimensions à évolution lente et data vault : les questions de conception d’entrepôt de tout entretien data engineer."]]'::jsonb);
select pg_temp.track_fr('de-advanced','Passage à l’échelle, streaming et certification',
 'Ce qui sépare un portfolio junior d’un profil qu’on embauche.',
 'Concevoir des pipelines fiables, expliquer vos arbitrages et l’appuyer par un projet et une certification cloud.','[
 ["Spark quick start","Démarrage rapide Spark","DataFrames et SQL sur un moteur distribué."],
 ["Kafka quickstart","Démarrage rapide Kafka","Topics, producteurs et consommateurs."],
 ["Designing Data-Intensive Applications","Designing Data-Intensive Applications","Livre de référence sur le stockage, la réplication et le streaming. Lisez les chapitres dont vous avez besoin."],
 ["Portfolio project: end-to-end pipeline","Projet portfolio : pipeline de bout en bout","Ingérez une API publique chaque jour, orchestrez-la, transformez avec dbt, ajoutez des tests de données et un tableau de bord. Notez vos arbitrages."],
 ["Cloud data engineer certification","Certification data engineer cloud","Pour les profils expérimentés : Google Professional Data Engineer (Google conseille au moins 3 ans en data, dont un an sur Google Cloud) ; AWS Data Engineer Associate est l’équivalent AWS. Pour un premier poste data, commencez par la certification de niveau associé ci-dessus."],
 ["Associate data engineer certification (Databricks or Microsoft Fabric)", "Certification data engineer de niveau associé (Databricks ou Microsoft Fabric)", "La première certification à viser en France : Databricks Certified Data Engineer Associate, ou Fabric Data Engineer Associate (DP-700) de Microsoft pour les entreprises sur Azure. Accessible après cette feuille de route."]]'::jsonb);
select pg_temp.track_fr('da-viz','Python, BI et storytelling visuel',
 'Transformer une analyse en quelque chose sur quoi un manager peut agir.',
 'Construire des tableaux de bord qui mènent à une décision et les expliquer clairement.','[
 ["pandas","pandas","Manipuler et résumer des données en Python."],
 ["Data visualization","Visualisation de données","Des graphiques qui montrent la bonne comparaison."],
 ["Power BI","Power BI","Choisissez Power BI ou Tableau et tenez-vous-en à un seul. Documentation et formation Power BI."],
 ["DAX: measures, CALCULATE and time intelligence","DAX : mesures, CALCULATE et intelligence temporelle","Les formules derrière chaque rapport Power BI : contexte de filtre, CALCULATE, comparaison à l’année précédente, classement."],
 ["Tableau free training","Formation gratuite Tableau","L’alternative si vos employeurs cibles utilisent Tableau."],
 ["Storytelling with Data","Storytelling with Data","Épurer les graphiques, guider l’attention, commencer par l’enseignement."],
 ["Python essentials", "Les bases de Python", "Cours HelloKhedma : variables, listes, fonctions, fichiers et erreurs : le Python qu’il faut avant pandas."]]'::jsonb);
select pg_temp.track_fr('ba-foundations','Les bases de l’analyse métier',
 'Les besoins, les user stories et le vocabulaire agile utilisés dans toutes les équipes.',
 'Recueillir des besoins et écrire des user stories claires avec leurs critères d’acceptation.','[
 ["User stories","User stories","Écrire des stories avec un qui, un quoi et un pourquoi clairs."],
 ["The Scrum Guide","Le Guide Scrum","La source de référence, courte, sur les rôles et les événements Scrum."],
 ["Jira and agile tutorials","Tutoriels Jira et agilité","Epics, stories, tableaux et workflows."],
 ["SQL practice","Pratique du SQL","Vérifier les besoins sur des données réelles."],
 ["Practice: write 10 user stories for an app you use","Pratique : écrire 10 user stories pour une application que vous utilisez","Avec des critères d’acceptation et un backlog priorisé."],
 ["Excel for analysis", "Excel pour l’analyse", "Cours HelloKhedma : recherches, tableaux croisés dynamiques et graphiques : l’outil des BA pour vérifier les données et partager les besoins."]]'::jsonb);
select pg_temp.track_fr('ba-process','Modélisation des processus et reporting',
 'Montrer comment le travail circule aujourd’hui, où il bloque et quels changements en valent la peine.',
 'Cartographier les processus actuels et cibles et chiffrer l’impact dans un rapport.','[
 ["BPMN overview","Introduction à BPMN","La notation des événements, tâches et passerelles."],
 ["Practice: model a process in draw.io","Pratique : modéliser un processus dans draw.io","Dessinez le flux actuel d’un processus que vous connaissez et repérez les points de friction."],
 ["Power BI documentation and training","Documentation et formation Power BI","Construire un rapport à partir de données Excel ou SQL."],
 ["Practice: as-is, to-be and gap list","Pratique : existant, cible et liste des écarts","Rédigez une proposition d’évolution de processus d’une page avec les KPI attendus."],
 ["Data modeling", "Modélisation des données", "Cours HelloKhedma : entités, relations et clés, pour lire un modèle de données et discuter avec les équipes data de ce qu’un besoin demande."]]'::jsonb);
select pg_temp.track_fr('do-cloud','Cloud, Infrastructure as Code et fiabilité',
 'Gérer une vraie infrastructure depuis du code et la garder en bonne santé.',
 'Créer une infrastructure cloud avec Terraform depuis un pipeline, la superviser avec des SLO et détenir une certification reconnue.','[
 ["Terraform tutorials","Tutoriels Terraform","Bien démarrer avec Terraform sur AWS, Azure ou Google Cloud."],
 ["AWS Skill Builder","AWS Skill Builder","Des cours gratuits sur les fondamentaux du cloud, dont Cloud Practitioner Essentials."],
 ["Prometheus: first steps","Prometheus : premiers pas","Métriques, cibles et requêtes."],
 ["SRE book: service level objectives","Livre SRE : les objectifs de niveau de service","Définir SLI, SLO et budgets d’erreur."],
 ["Project: infrastructure as code","Projet : infrastructure as code","Créez les ressources cloud de votre API avec Terraform depuis un pipeline, avec un état distant, un tableau de bord et une alerte."],
 ["AWS Certified Cloud Practitioner or CKA","AWS Certified Cloud Practitioner ou CKA","Pour un premier poste : AWS Cloud Practitioner couvre les fondamentaux du cloud en un examen. La CKA (administration Kubernetes, CNCF) est plus difficile et vaut le coup une fois que vous gérez des clusters ; voir l’étape suivante."],
 ["Associate cloud or Kubernetes certification (AZ-104, AWS Solutions Architect or CKA)", "Certification cloud ou Kubernetes de niveau associé (AZ-104, AWS Solutions Architect ou CKA)", "Avec un peu d’expérience, les certifications que demandent le plus les offres DevOps : Azure Administrator (AZ-104), AWS Solutions Architect Associate, ou la Certified Kubernetes Administrator de la CNCF (un examen pratique)."]]'::jsonb);
select pg_temp.track_fr('grc-foundations','Les bases de la GRC : sécurité, risques et contrôles',
 'Ce que vérifie d’abord tout entretien GRC : les bases de la sécurité de l’information, comment on évalue un risque et comment un contrôle le réduit.',
 'Expliquer confidentialité, intégrité et disponibilité, évaluer un risque (probabilité × impact), le relier à des contrôles et tenir un registre des risques.','[
 ["NIST Cybersecurity Framework 2.0","Le NIST Cybersecurity Framework 2.0","Le référentiel gratuit sur lequel s’appuient la plupart des équipes GRC : Gouverner, Identifier, Protéger, Détecter, Répondre, Rétablir (en anglais)."],
 ["SecNumacadémie","SecNumacadémie","Le MOOC gratuit de l’ANSSI : les bases de la cybersécurité, en français, avec une attestation."],
 ["Incident management & ITIL","Gestion des incidents et ITIL","Cours HelloKhedma : incidents, problèmes, changements et SLA : les processus IT sur lesquels reposent les contrôles de sécurité."],
 ["Excel for analysis","Excel pour l’analyse","Cours HelloKhedma : recherches, mise en forme conditionnelle et tableaux croisés dynamiques, pour les registres des risques et les matrices de contrôles."],
 ["Practice: a risk register for a small company","Pratique : un registre des risques pour une petite entreprise","Pour une petite entreprise que vous connaissez (un commerce, une agence) : listez 10 actifs, 10 risques avec probabilité et impact, et un contrôle pour chacun."],
 ["CompTIA Security+","CompTIA Security+","La certification d’entrée en sécurité la plus connue à l’international : menaces, contrôles, risques et conformité (examen en anglais). En France, ISO 27001 Foundation (ci-dessus) est plus souvent demandée."],
 ["Security and GRC foundations", "Les bases de la sécurité et de la GRC", "Cours HelloKhedma : la triade CID, les mesures de sécurité, les rôles de gouvernance, le NIST CSF 2.0, les politiques de sécurité et la semaine d’un analyste GRC."],
 ["IT risk management", "La gestion des risques IT", "Cours HelloKhedma : coter les risques, le registre, le traitement et le risque résiduel, l’appétence, le risque fournisseurs et la continuité d’activité."],
 ["ISO/IEC 27001 Foundation", "ISO/IEC 27001 Foundation", "La certification d’entrée la plus demandée dans les offres GRC en France : le vocabulaire, les chapitres et l’annexe A de l’ISO 27001, un examen court, sans expérience requise."],
 ["Microsoft Security, Compliance and Identity Fundamentals (SC-900)", "Microsoft Security, Compliance and Identity Fundamentals (SC-900)", "Des parcours gratuits et un examen court sur la sécurité et la conformité de Microsoft 365 et Azure (Entra ID, Purview, Defender), les outils de la plupart des entreprises françaises."]]'::jsonb);
select pg_temp.track_fr('mk-acquisition','Acquisition : SEO, référencement payant et réseaux sociaux',
 'Les canaux qui apportent visiteurs et leads, et comment travailler chacun.',
 'Auditer le SEO d’un site, préparer une campagne Google Ads, mettre en place de la publicité sur les réseaux sociaux et lire les résultats de chaque canal.','[
 ["SEO Starter Guide","Le guide de démarrage SEO","Le guide de Google lui-même : le fonctionnement de la recherche, les titres, le contenu, les liens et ce qu’il faut éviter."],
 ["Beginner’s Guide to SEO","Le guide du SEO pour débutants","Recherche de mots-clés, optimisation des pages, SEO technique et liens, étape par étape."],
 ["Search Console Help","L’aide de Search Console","Lire les rapports de requêtes, de pages et d’indexation d’un site."],
 ["Google Ads Help","L’aide de Google Ads","Types de campagnes, mots-clés, enchères et suivi des conversions."],
 ["Meta Blueprint","Meta Blueprint","Des cours gratuits sur la publicité Facebook et Instagram."],
 ["Practice: an SEO audit of a real site","Pratique : l’audit SEO d’un vrai site","Choisissez un petit site (un commerce local, une association), listez ses problèmes techniques, de contenu et de liens, et écrivez un plan par priorité."],
 ["Google Ads certifications", "Les certifications Google Ads", "Cours et examens officiels gratuits (Search, Display, Vidéo, Mesure) sur Skillshop : les recruteurs les cherchent sur les CV juniors."]]'::jsonb);

update public.training_steps s set course_id = v.c from (values
  ('de-pipelines','Data modeling','data-modeling'),
  ('da-viz','Python essentials','python'),
  ('ba-foundations','Excel for analysis','excel'),
  ('ba-process','Data modeling','data-modeling')
) as v(tid, title, c)
where s.id = md5(v.tid || ':' || v.title)::uuid;

-- Check: should show 200 steps, 200 with French, 127 linked to a course.
select count(*) as steps, count(title_fr) as with_french, count(course_id) as linked from public.training_steps;

-- End of file. The lines below are padding: a phone copy sometimes loses the last lines of a page.
--
--
--
--
--
