-- Course review, batch 3 (2026-11-27): a roadmap step for the new courses Ansible (DevOps), Azure data engineering
-- (Data Engineer) and Market research (Digital Marketing). The part of supabase/seed.sql that changed. Safe to run twice.

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

select pg_temp.track('do','do-cloud','Cloud, Infrastructure as Code and reliability','advanced',
 'Run real infrastructure from code and keep it healthy.',
 'Create cloud infrastructure with Terraform from a pipeline, monitor it with SLOs and hold a recognised certification.',3,'[
 ["Terraform tutorials","Get started with Terraform on AWS, Azure or Google Cloud.","learn","HashiCorp","https://developer.hashicorp.com/terraform/tutorials",8],
 ["Ansible and configuration management", "HelloKhedma course: inventories, playbooks, roles, Vault and safe runs: the configuration tool most French DevOps offers ask for next to Terraform.", "learn", "HelloKhedma", "", 8],
 ["AWS Skill Builder","Free cloud fundamentals courses, including Cloud Practitioner Essentials.","learn","AWS","https://skillbuilder.aws",10],
 ["Prometheus: first steps","Metrics, targets and queries.","learn","Prometheus","https://prometheus.io/docs/introduction/first_steps/",2],
 ["SRE book: service level objectives","Define SLIs, SLOs and error budgets.","learn","Google SRE","https://sre.google/sre-book/service-level-objectives/",1.5],
 ["Project: infrastructure as code","Create the cloud resources of your API with Terraform from a pipeline, with remote state, a dashboard and one alert.","project","Your repo","",15],
 ["AWS Certified Cloud Practitioner or CKA","For a first job: AWS Cloud Practitioner covers the cloud fundamentals in one exam. The CKA (Kubernetes administration, CNCF) is harder and is worth it once you run clusters; see the next step.","certification","AWS / CNCF","https://aws.amazon.com/certification/",25,false],
 ["Associate cloud or Kubernetes certification (AZ-104, AWS Solutions Architect or CKA)", "With some experience, the certifications DevOps offers ask for most: Azure Administrator (AZ-104), AWS Solutions Architect Associate, or the CNCF’s Certified Kubernetes Administrator (a hands-on exam).", "certification", "Microsoft / AWS / CNCF", "https://www.cncf.io/training/certification/cka/", 60, false]]'::jsonb);
select pg_temp.track('de','de-advanced','Scale, streaming and certification','advanced',
 'What separates a junior portfolio from a hireable one.',
 'Design reliable pipelines, explain trade-offs, and back it with a project and a cloud certification.',3,'[
 ["Spark quick start","DataFrames and SQL on a distributed engine.","learn","Apache Spark","https://spark.apache.org/docs/latest/quick-start.html",5],
 ["Kafka quickstart","Topics, producers and consumers.","learn","Apache Kafka","https://kafka.apache.org/quickstart",3],
 ["Designing Data-Intensive Applications","Reference book on storage, replication and streaming. Read the chapters you need.","learn","dataintensive.net","https://dataintensive.net",20,false],
 ["Portfolio project: end-to-end pipeline","Ingest a public API daily, orchestrate it, transform with dbt, add data tests and a dashboard. Write down your trade-offs.","project","Your repo","",25],
 ["Azure data engineering: Data Factory, Databricks and Fabric", "HelloKhedma course: ADLS, Data Factory pipelines, Databricks and Delta, Microsoft Fabric, identities and cost: the cloud most French data offers ask for.", "learn", "HelloKhedma", "", 8],
 ["Associate data engineer certification (Databricks or Microsoft Fabric)", "The first certification to aim for in France: Databricks Certified Data Engineer Associate, or Microsoft’s Fabric Data Engineer Associate (DP-700) for companies on Azure. Within reach after this roadmap.", "certification", "Databricks / Microsoft", "https://www.databricks.com/learn/certification/data-engineer-associate", 40, false],
 ["Cloud data engineer certification","For experienced engineers: Google Professional Data Engineer (Google recommends 3 or more years in data, including a year on Google Cloud); AWS Data Engineer Associate is the AWS equivalent. On a first data job, start with the associate certification above.","certification","Google Cloud","https://cloud.google.com/learn/certification/data-engineer",30,false]]'::jsonb);
select pg_temp.track('mk','mk-analytics','Measurement, experiments and reporting','advanced',
 'What separates a marketer who reports from one who decides: clean data, tests and clear dashboards.',
 'Query marketing data with SQL, size and read an A/B test, and publish a dashboard that answers a business question.',3,'[
 ["Market research for marketers", "HelloKhedma course: study design, interviews, questionnaires, sampling and margin of error, cross-tabs and a report that leads to a decision, for chargé d’études roles.", "learn", "HelloKhedma", "", 8],
 ["Intro to SQL","Select, filter, join and aggregate: enough to query marketing data.","learn","Kaggle Learn","https://www.kaggle.com/learn/intro-to-sql",4],
 ["GA4 e-commerce sample dataset","A real anonymised GA4 export of the Google Merchandise Store in BigQuery, free with the sandbox.","practice","Google Analytics","https://developers.google.com/analytics/bigquery/web-ecommerce-demo-dataset",5],
 ["A/B test sample size calculator","How many visitors a test needs before its result means anything.","practice","Evan Miller","https://www.evanmiller.org/ab-testing/sample-size.html",1],
 ["Looker Studio Help","Connect GA4 and Sheets, build charts and filters, share a report.","learn","Google","https://support.google.com/looker-studio",3],
 ["Project: a campaign performance dashboard","A Looker Studio report with the funnel, cost per lead and conversion by channel, and three written recommendations.","project","Your report","",10]]'::jsonb);

create or replace function pg_temp.track_fr(tid text, ttl text, summ text, outc text, steps jsonb)
returns void language sql as $$
  update public.training_tracks set title_fr = ttl, summary_fr = summ, outcome_fr = outc where id = tid;
  update public.training_steps s
  set title_fr = x.e->>1, description_fr = nullif(coalesce(x.e->>2, ''), '')
  from jsonb_array_elements(steps) as x(e)
  where s.id = md5(tid || ':' || (x.e->>0))::uuid;
$$;

select pg_temp.track_fr('do-cloud','Cloud, Infrastructure as Code et fiabilité',
 'Gérer une vraie infrastructure depuis du code et la garder en bonne santé.',
 'Créer une infrastructure cloud avec Terraform depuis un pipeline, la superviser avec des SLO et détenir une certification reconnue.','[
 ["Terraform tutorials","Tutoriels Terraform","Bien démarrer avec Terraform sur AWS, Azure ou Google Cloud."],
 ["AWS Skill Builder","AWS Skill Builder","Des cours gratuits sur les fondamentaux du cloud, dont Cloud Practitioner Essentials."],
 ["Prometheus: first steps","Prometheus : premiers pas","Métriques, cibles et requêtes."],
 ["SRE book: service level objectives","Livre SRE : les objectifs de niveau de service","Définir SLI, SLO et budgets d’erreur."],
 ["Project: infrastructure as code","Projet : infrastructure as code","Créez les ressources cloud de votre API avec Terraform depuis un pipeline, avec un état distant, un tableau de bord et une alerte."],
 ["AWS Certified Cloud Practitioner or CKA","AWS Certified Cloud Practitioner ou CKA","Pour un premier poste : AWS Cloud Practitioner couvre les fondamentaux du cloud en un examen. La CKA (administration Kubernetes, CNCF) est plus difficile et vaut le coup une fois que vous gérez des clusters ; voir l’étape suivante."],
 ["Associate cloud or Kubernetes certification (AZ-104, AWS Solutions Architect or CKA)", "Certification cloud ou Kubernetes de niveau associé (AZ-104, AWS Solutions Architect ou CKA)", "Avec un peu d’expérience, les certifications que demandent le plus les offres DevOps : Azure Administrator (AZ-104), AWS Solutions Architect Associate, ou la Certified Kubernetes Administrator de la CNCF (un examen pratique)."],
 ["Ansible and configuration management", "Ansible et la gestion de configuration", "Cours HelloKhedma : inventaires, playbooks, rôles, Vault et exécutions sûres : l’outil de configuration que demandent la plupart des offres DevOps en France, à côté de Terraform."]]'::jsonb);
select pg_temp.track_fr('de-advanced','Passage à l’échelle, streaming et certification',
 'Ce qui sépare un portfolio junior d’un profil qu’on embauche.',
 'Concevoir des pipelines fiables, expliquer vos arbitrages et l’appuyer par un projet et une certification cloud.','[
 ["Spark quick start","Démarrage rapide Spark","DataFrames et SQL sur un moteur distribué."],
 ["Kafka quickstart","Démarrage rapide Kafka","Topics, producteurs et consommateurs."],
 ["Designing Data-Intensive Applications","Designing Data-Intensive Applications","Livre de référence sur le stockage, la réplication et le streaming. Lisez les chapitres dont vous avez besoin."],
 ["Portfolio project: end-to-end pipeline","Projet portfolio : pipeline de bout en bout","Ingérez une API publique chaque jour, orchestrez-la, transformez avec dbt, ajoutez des tests de données et un tableau de bord. Notez vos arbitrages."],
 ["Cloud data engineer certification","Certification data engineer cloud","Pour les profils expérimentés : Google Professional Data Engineer (Google conseille au moins 3 ans en data, dont un an sur Google Cloud) ; AWS Data Engineer Associate est l’équivalent AWS. Pour un premier poste data, commencez par la certification de niveau associé ci-dessus."],
 ["Associate data engineer certification (Databricks or Microsoft Fabric)", "Certification data engineer de niveau associé (Databricks ou Microsoft Fabric)", "La première certification à viser en France : Databricks Certified Data Engineer Associate, ou Fabric Data Engineer Associate (DP-700) de Microsoft pour les entreprises sur Azure. Accessible après cette feuille de route."],
 ["Azure data engineering: Data Factory, Databricks and Fabric", "Data engineering sur Azure : Data Factory, Databricks et Fabric", "Cours HelloKhedma : ADLS, pipelines Data Factory, Databricks et Delta, Microsoft Fabric, identités et coûts : le cloud que demandent la plupart des offres data en France."]]'::jsonb);
select pg_temp.track_fr('mk-analytics','Mesure, tests et reporting',
 'Ce qui distingue le marketeur qui rapporte de celui qui décide : des données propres, des tests et des tableaux de bord clairs.',
 'Interroger des données marketing en SQL, dimensionner et lire un test A/B, et publier un tableau de bord qui répond à une question métier.','[
 ["Intro to SQL","Introduction au SQL","Sélectionner, filtrer, joindre et agréger : de quoi interroger des données marketing."],
 ["GA4 e-commerce sample dataset","Le jeu de données e-commerce GA4","Un vrai export GA4 anonymisé du Google Merchandise Store dans BigQuery, gratuit avec le bac à sable."],
 ["A/B test sample size calculator","Le calculateur de taille d’échantillon d’un test A/B","Combien de visiteurs il faut à un test avant que son résultat veuille dire quelque chose."],
 ["Looker Studio Help","L’aide de Looker Studio","Connecter GA4 et Sheets, construire graphiques et filtres, partager un rapport."],
 ["Project: a campaign performance dashboard","Projet : un tableau de bord de performance des campagnes","Un rapport Looker Studio avec le tunnel, le coût par lead et la conversion par canal, et trois recommandations écrites."],
 ["Market research for marketers", "Les études de marché pour le marketing", "Cours HelloKhedma : conception d’une étude, entretiens, questionnaires, échantillonnage et marge d’erreur, tris croisés et un rapport qui mène à une décision, pour les postes de chargé d’études."]]'::jsonb);

update public.training_steps s set course_id = v.c from (values
  ('do-cloud','Ansible and configuration management','ansible'),
  ('de-advanced','Azure data engineering: Data Factory, Databricks and Fabric','azure-data'),
  ('mk-analytics','Market research for marketers','market-research')
) as v(tid, title, c)
where s.id = md5(v.tid || ':' || v.title)::uuid;

-- Check: should show 3 steps, all linked, all with French.
select count(*) as new_steps, count(course_id) as linked, count(title_fr) as with_french
from public.training_steps where course_id in ('ansible', 'azure-data', 'market-research');

-- End of file. The lines below are padding: a phone copy sometimes loses the last lines of a page.
--
--
--
--
--
