-- Product Owner, Project Manager and GRC courses on their roadmaps (2026-11-19): the part of supabase/seed.sql that adds
-- a step per new HelloKhedma course (with its French text) and links it to the course. Short enough to copy on a phone.
-- Safe to run twice. The full seed.sql gives the same result.

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

select pg_temp.track('po','po-foundations','Product Owner foundations: Scrum, the backlog and user stories','beginner',
 'What every Product Owner interview checks first: how Scrum works and how a backlog turns needs into work.',
 'Explain the Product Owner’s accountabilities in Scrum, write user stories with acceptance criteria and order a backlog.',1,'[
 ["The Scrum Guide","The official guide (13 pages): roles, events, artifacts and what the Product Owner is accountable for.","learn","Scrum.org","https://scrumguides.org/scrum-guide.html",2],
 ["Agile & Scrum","HelloKhedma course: Scrum roles and events, estimation, Kanban and the metrics teams use, with exercises.","learn","HelloKhedma","",6],
 ["Requirements & user stories","HelloKhedma course: needs, user stories, acceptance criteria in Given / When / Then, and backlog refinement.","learn","HelloKhedma","",6],
 ["Backlog, user stories and prioritisation", "HelloKhedma course: a healthy backlog, slicing stories, acceptance criteria, refinement, and prioritising with RICE, MoSCoW and Kano.", "learn", "HelloKhedma", "", 4],
 ["Practice: write the backlog of an app you use","Pick an app you use every day: write 3 epics and 12 user stories with acceptance criteria, then order them and say why.","practice","Your notes","",4],
 ["Professional Scrum Product Owner I (PSPO I)","The best-known Product Owner certification: an online exam, no course required.","certification","Scrum.org","https://www.scrum.org/assessments/professional-scrum-product-owner-i-certification",20,false]]'::jsonb);
select pg_temp.track('po','po-discovery','Product discovery, prioritisation and metrics','intermediate',
 'How good Product Owners decide what to build: talking to users, choosing with a method, and checking the result in the data.',
 'Run user interviews, prioritise with RICE or MoSCoW, define success metrics and read them yourself with SQL.',2,'[
 ["Product discovery and user research", "HelloKhedma course: interviews that do not lead, jobs to be done, opportunity trees and testing assumptions before building.", "learn", "HelloKhedma", "", 4],
 ["User interviews","How to prepare, run and analyse interviews with users without leading them.","learn","Nielsen Norman Group","https://www.nngroup.com/articles/user-interviews/",2],
 ["Intro to SQL","Select, filter, join and aggregate: enough to answer your own product questions in the database.","learn","Kaggle Learn","https://www.kaggle.com/learn/intro-to-sql",4],
 ["Statistics & A/B testing","HelloKhedma course: averages, variation, significance and how to read an A/B test without fooling yourself.","learn","HelloKhedma","",6],
 ["Product metrics and experiments", "HelloKhedma course: North Star and input metrics, funnels, retention cohorts, OKRs and A/B tests in practice.", "learn", "HelloKhedma", "", 4],
 ["A/B test sample size calculator","How many users a test needs before its result means anything.","practice","Evan Miller","https://www.evanmiller.org/ab-testing/sample-size.html",1],
 ["Project: a product case study","Five user interviews, a prioritised backlog and a one-page roadmap for a real app (see the portfolio projects below).","project","Your case study","",15]]'::jsonb);
select pg_temp.track('po','po-delivery','Roadmaps, stakeholders and delivery','advanced',
 'The day-to-day of a senior Product Owner: a roadmap people trust, stakeholders who agree on priorities, and releases that move a metric.',
 'Build an outcome-based roadmap, run a sprint review that leads to decisions, and report the value delivered.',3,'[
 ["Roadmaps, stakeholders and delivery", "HelloKhedma course: vision, outcome roadmaps, saying no, the Product Owner in Scrum events and release forecasts.", "learn", "HelloKhedma", "", 4],
 ["Evidence-Based Management guide","Scrum.org’s guide to measuring value: current value, time to market, ability to innovate.","learn","Scrum.org","https://www.scrum.org/resources/evidence-based-management-guide",2],
 ["Excel for analysis","HelloKhedma course: lookups, pivot tables and charts, for release reports and business cases.","learn","HelloKhedma","",6],
 ["Practice: turn a feature list into an outcome roadmap","Take 10 feature requests, group them under 3 outcomes with a metric each, and place them in Now / Next / Later.","practice","Your roadmap","",3],
 ["Project: a release plan and a stakeholder update","A release plan for one quarter, the risks and dependencies, and the one-page update you would send to sponsors.","project","Your plan","",10]]'::jsonb);
select pg_temp.track('pm','pm-foundations','Project management foundations: scope, plan, budget and risks','beginner',
 'The base every project manager interview checks: how to frame a project and plan it so it can be followed.',
 'Write a project charter, break the work down, build a Gantt chart with the critical path, a budget and a risk log.',1,'[
 ["Project management guide","Free guides on project phases, charters, planning, risk and status reports.","learn","Atlassian","https://www.atlassian.com/work-management/project-management",4],
 ["Project planning: scope, schedule and critical path", "HelloKhedma course: charter, WBS, estimates, dependencies, the critical path, the Gantt chart and the baseline.", "learn", "HelloKhedma", "", 4],
 ["Project budget, cost control and earned value", "HelloKhedma course: cost estimates, contingency, tracking actuals and earned value (CPI, SPI, EAC).", "learn", "HelloKhedma", "", 4],
 ["Risks, issues and change control", "HelloKhedma course: the risk register, scoring and responses, issues and escalation, change requests and the people side of change.", "learn", "HelloKhedma", "", 4],
 ["Excel for analysis","HelloKhedma course: formulas, lookups, pivot tables and charts: the tool for plans, budgets and logs.","learn","HelloKhedma","",6],
 ["BPMN & process mapping","HelloKhedma course: map how work flows today and after the project, to agree on the scope.","learn","HelloKhedma","",5],
 ["Practice: plan a project you know","A move, an event or a small app: write the scope, a work breakdown, a Gantt chart in Excel, a budget and five risks with their responses.","practice","Your plan","",4],
 ["Certified Associate in Project Management (CAPM)","PMI’s entry-level certification: no project experience needed, 23 hours of training.","certification","PMI","https://www.pmi.org/certifications/certified-associate-capm",40,false]]'::jsonb);
select pg_temp.track('pm','pm-certification','Certifications and larger projects','advanced',
 'What senior project manager offers ask for: a recognised certification and experience with budgets, vendors and change.',
 'Prepare a PMP, PRINCE2 or PSM certification, and lead the people side of change on a larger project.',3,'[
 ["Stakeholders, communication and steering", "HelloKhedma course: RACI, the communication plan, honest status reports, steering committees, closing a project, and PMP / PRINCE2 in short.", "learn", "HelloKhedma", "", 4],
 ["Professional Scrum Master I (PSM I)","An online exam on Scrum, no course required: proof that you can run agile teams.","certification","Scrum.org","https://www.scrum.org/assessments/professional-scrum-master-i-certification",15,false],
 ["Project Management Professional (PMP)","The global reference certification: 3 to 5 years of leading projects and 35 hours of training required.","certification","PMI","https://www.pmi.org/certifications/project-management-pmp",80,false],
 ["PRINCE2 Foundation","The process-based method common in the UK, Europe and public projects.","certification","PeopleCert","https://www.peoplecert.org/",30,false],
 ["Project: a full plan for a real initiative","A charter, plan, budget, risk log, RACI and communication plan for a real initiative of an association or company you know (see the portfolio projects below).","project","Your plan","",15]]'::jsonb);
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
 ["CompTIA Security+","The best-known entry-level security certification: threats, controls, risk and compliance.","certification","CompTIA","https://www.comptia.org/certifications/security",60,false]]'::jsonb);
select pg_temp.track('grc','grc-standards','Standards and regulations: ISO 27001, GDPR, NIS2 and DORA','intermediate',
 'The texts GRC offers name: the ISO 27001 management system, personal data protection and the new European rules for critical sectors and finance.',
 'Explain the ISO 27001 clauses and Annex A, keep a GDPR record of processing, and say which obligations NIS2 and DORA add.',2,'[
 ["ISO/IEC 27001","The official page of the standard: what an information security management system (ISMS) is and how certification works.","learn","ISO","https://www.iso.org/standard/27001",2],
 ["ISO 27001 and audits in practice", "HelloKhedma course: the ISMS clauses, Annex A, the statement of applicability, evidence, internal and certification audits, and SOC 2.", "learn", "HelloKhedma", "", 4],
 ["GDPR text, article by article","The regulation with its recitals, easy to search: principles, rights, records, data protection impact assessments.","learn","Intersoft Consulting","https://gdpr-info.eu/",4],
 ["NIS2 directive","The European Commission’s page on NIS2: which organisations it covers and what it requires.","learn","European Commission","https://digital-strategy.ec.europa.eu/en/policies/nis2-directive",2],
 ["GDPR, NIS2 and DORA for analysts", "HelloKhedma course: GDPR in operations, DPIAs and breaches, NIS2 duties, DORA for financial entities, and turning rules into controls and evidence.", "learn", "HelloKhedma", "", 4],
 ["BPMN & process mapping","HelloKhedma course: map a process to see where a control belongs and who performs it.","learn","HelloKhedma","",5],
 ["SQL for data jobs","HelloKhedma course: query user lists, access rights and logs yourself to gather audit evidence.","learn","HelloKhedma","",6],
 ["Project: an ISO 27001 gap assessment","Compare a real or sample organisation with the ISO 27001 controls and write the action plan (see the portfolio projects below).","project","Your assessment","",15]]'::jsonb);

create or replace function pg_temp.track_fr(tid text, ttl text, summ text, outc text, steps jsonb)
returns void language sql as $$
  update public.training_tracks set title_fr = ttl, summary_fr = summ, outcome_fr = outc where id = tid;
  update public.training_steps s
  set title_fr = x.e->>1, description_fr = nullif(coalesce(x.e->>2, ''), '')
  from jsonb_array_elements(steps) as x(e)
  where s.id = md5(tid || ':' || (x.e->>0))::uuid;
$$;

select pg_temp.track_fr('po-foundations','Les bases du Product Owner : Scrum, le backlog et les user stories',
 'Ce que vérifie d’abord tout entretien de Product Owner : comment fonctionne Scrum et comment un backlog transforme des besoins en travail.',
 'Expliquer les responsabilités du Product Owner dans Scrum, écrire des user stories avec critères d’acceptation et ordonner un backlog.','[
 ["The Scrum Guide","Le Guide Scrum","Le guide officiel (13 pages, aussi en français) : rôles, événements, artefacts et responsabilités du Product Owner."],
 ["Agile & Scrum","Agile et Scrum","Cours HelloKhedma : rôles et événements Scrum, estimation, Kanban et les indicateurs des équipes, avec exercices."],
 ["Requirements & user stories","Besoins et user stories","Cours HelloKhedma : besoins, user stories, critères d’acceptation en Étant donné / Quand / Alors, et affinage du backlog."],
 ["Practice: write the backlog of an app you use","Pratique : écrire le backlog d’une application que vous utilisez","Choisissez une application de votre quotidien : écrivez 3 epics et 12 user stories avec critères d’acceptation, puis ordonnez-les et justifiez."],
 ["Professional Scrum Product Owner I (PSPO I)","Professional Scrum Product Owner I (PSPO I)","La certification de Product Owner la plus connue : un examen en ligne, en anglais, sans formation obligatoire."],
 ["Backlog, user stories and prioritisation", "Backlog, user stories et priorisation", "Cours HelloKhedma : un backlog sain, découper les stories, critères d’acceptation, affinage, et prioriser avec RICE, MoSCoW et Kano."]]'::jsonb);
select pg_temp.track_fr('po-discovery','Découverte produit, priorisation et indicateurs',
 'Comment les bons Product Owners décident quoi construire : parler aux utilisateurs, choisir avec une méthode, vérifier le résultat dans les données.',
 'Mener des entretiens utilisateurs, prioriser avec RICE ou MoSCoW, définir des indicateurs de succès et les lire vous-même en SQL.','[
 ["User interviews","Les entretiens utilisateurs","Comment préparer, mener et analyser des entretiens avec des utilisateurs sans les influencer (en anglais)."],
 ["Intro to SQL","Introduction au SQL","Sélectionner, filtrer, joindre et agréger : de quoi répondre vous-même à vos questions produit dans la base."],
 ["Statistics & A/B testing","Statistiques et tests A/B","Cours HelloKhedma : moyennes, variation, significativité et comment lire un test A/B sans se tromper."],
 ["A/B test sample size calculator","Le calculateur de taille d’échantillon d’un test A/B","Combien d’utilisateurs il faut à un test avant que son résultat veuille dire quelque chose."],
 ["Project: a product case study","Projet : une étude de cas produit","Cinq entretiens utilisateurs, un backlog priorisé et une roadmap d’une page pour une vraie application (voir les projets de portfolio plus bas)."],
 ["Product discovery and user research", "Découverte produit et recherche utilisateur", "Cours HelloKhedma : des entretiens qui n’orientent pas, les jobs to be done, les arbres d’opportunités et tester ses hypothèses avant de construire."],
 ["Product metrics and experiments", "Indicateurs produit et expérimentation", "Cours HelloKhedma : North Star et leviers, entonnoirs, cohortes de rétention, OKR et tests A/B en pratique."]]'::jsonb);
select pg_temp.track_fr('po-delivery','Roadmaps, parties prenantes et livraison',
 'Le quotidien d’un Product Owner confirmé : une roadmap crédible, des parties prenantes d’accord sur les priorités, et des livraisons qui font bouger un indicateur.',
 'Construire une roadmap orientée résultats, animer une sprint review qui mène à des décisions, et rendre compte de la valeur livrée.','[
 ["Evidence-Based Management guide","Le guide Evidence-Based Management","Le guide de Scrum.org pour mesurer la valeur : valeur actuelle, délai de mise sur le marché, capacité à innover (en anglais)."],
 ["Excel for analysis","Excel pour l’analyse","Cours HelloKhedma : recherches, tableaux croisés dynamiques et graphiques, pour les bilans de livraison et les business cases."],
 ["Practice: turn a feature list into an outcome roadmap","Pratique : transformer une liste de fonctionnalités en roadmap orientée résultats","Prenez 10 demandes de fonctionnalités, regroupez-les sous 3 résultats avec un indicateur chacun, et placez-les en Maintenant / Ensuite / Plus tard."],
 ["Project: a release plan and a stakeholder update","Projet : un plan de livraison et un point aux parties prenantes","Un plan de livraison sur un trimestre, les risques et dépendances, et le point d’une page que vous enverriez aux sponsors."],
 ["Roadmaps, stakeholders and delivery", "Roadmaps, parties prenantes et livraison", "Cours HelloKhedma : vision, roadmaps par résultats, savoir dire non, le Product Owner dans les événements Scrum et les prévisions de release."]]'::jsonb);
select pg_temp.track_fr('pm-foundations','Les bases de la gestion de projet : périmètre, planning, budget et risques',
 'La base que vérifie tout entretien de chef de projet : comment cadrer un projet et le planifier pour qu’il puisse être suivi.',
 'Rédiger une charte projet, découper le travail, construire un Gantt avec le chemin critique, un budget et un registre des risques.','[
 ["Project management guide","Le guide de la gestion de projet","Des guides gratuits, en anglais, sur les phases d’un projet, la charte, le planning, les risques et les points d’avancement."],
 ["Excel for analysis","Excel pour l’analyse","Cours HelloKhedma : formules, recherches, tableaux croisés dynamiques et graphiques, l’outil des plannings, budgets et registres."],
 ["BPMN & process mapping","BPMN et cartographie des processus","Cours HelloKhedma : cartographier le travail avant et après le projet, pour s’accorder sur le périmètre."],
 ["Practice: plan a project you know","Pratique : planifier un projet que vous connaissez","Un déménagement, un événement ou une petite application : écrivez le périmètre, un découpage du travail, un Gantt sous Excel, un budget et cinq risques avec leurs réponses."],
 ["Certified Associate in Project Management (CAPM)","Certified Associate in Project Management (CAPM)","La certification d’entrée du PMI : aucune expérience de projet exigée, 23 heures de formation."],
 ["Project planning: scope, schedule and critical path", "Planifier un projet : périmètre, planning et chemin critique", "Cours HelloKhedma : charte, WBS, estimations, dépendances, chemin critique, diagramme de Gantt et référence de base."],
 ["Project budget, cost control and earned value", "Budget projet, maîtrise des coûts et valeur acquise", "Cours HelloKhedma : estimation des coûts, provisions, suivi du réel et valeur acquise (IPC, IPD, EAC)."],
 ["Risks, issues and change control", "Risques, problèmes et maîtrise des changements", "Cours HelloKhedma : le registre des risques, cotation et réponses, problèmes et escalade, demandes de changement et accompagnement du changement."]]'::jsonb);
select pg_temp.track_fr('pm-certification','Certifications et projets plus importants',
 'Ce que demandent les offres de chef de projet confirmé : une certification reconnue et l’expérience des budgets, des fournisseurs et du changement.',
 'Préparer une certification PMP, PRINCE2 ou PSM, et piloter le volet humain du changement sur un projet plus important.','[
 ["Professional Scrum Master I (PSM I)","Professional Scrum Master I (PSM I)","Un examen en ligne sur Scrum, en anglais, sans formation obligatoire : la preuve que vous savez animer des équipes agiles."],
 ["Project Management Professional (PMP)","Project Management Professional (PMP)","La certification de référence mondiale : 3 à 5 ans de pilotage de projets et 35 heures de formation exigés."],
 ["PRINCE2 Foundation","PRINCE2 Foundation","La méthode par processus répandue au Royaume-Uni, en Europe et dans les projets publics."],
 ["Project: a full plan for a real initiative","Projet : un plan complet pour une initiative réelle","Une charte, un planning, un budget, un registre des risques, une matrice RACI et un plan de communication pour l’initiative réelle d’une association ou d’une entreprise que vous connaissez (voir les projets de portfolio plus bas)."],
 ["Stakeholders, communication and steering", "Parties prenantes, communication et pilotage", "Cours HelloKhedma : RACI, plan de communication, rapports d’avancement honnêtes, comités de pilotage, clôture de projet, et PMP / PRINCE2 en bref."]]'::jsonb);
select pg_temp.track_fr('grc-foundations','Les bases de la GRC : sécurité, risques et contrôles',
 'Ce que vérifie d’abord tout entretien GRC : les bases de la sécurité de l’information, comment on évalue un risque et comment un contrôle le réduit.',
 'Expliquer confidentialité, intégrité et disponibilité, évaluer un risque (probabilité × impact), le relier à des contrôles et tenir un registre des risques.','[
 ["NIST Cybersecurity Framework 2.0","Le NIST Cybersecurity Framework 2.0","Le référentiel gratuit sur lequel s’appuient la plupart des équipes GRC : Gouverner, Identifier, Protéger, Détecter, Répondre, Rétablir (en anglais)."],
 ["SecNumacadémie","SecNumacadémie","Le MOOC gratuit de l’ANSSI : les bases de la cybersécurité, en français, avec une attestation."],
 ["Incident management & ITIL","Gestion des incidents et ITIL","Cours HelloKhedma : incidents, problèmes, changements et SLA : les processus IT sur lesquels reposent les contrôles de sécurité."],
 ["Excel for analysis","Excel pour l’analyse","Cours HelloKhedma : recherches, mise en forme conditionnelle et tableaux croisés dynamiques, pour les registres des risques et les matrices de contrôles."],
 ["Practice: a risk register for a small company","Pratique : un registre des risques pour une petite entreprise","Pour une petite entreprise que vous connaissez (un commerce, une agence) : listez 10 actifs, 10 risques avec probabilité et impact, et un contrôle pour chacun."],
 ["CompTIA Security+","CompTIA Security+","La certification d’entrée en sécurité la plus connue : menaces, contrôles, risques et conformité (examen en anglais)."],
 ["Security and GRC foundations", "Les bases de la sécurité et de la GRC", "Cours HelloKhedma : la triade CID, les mesures de sécurité, les rôles de gouvernance, le NIST CSF 2.0, les politiques de sécurité et la semaine d’un analyste GRC."],
 ["IT risk management", "La gestion des risques IT", "Cours HelloKhedma : coter les risques, le registre, le traitement et le risque résiduel, l’appétence, le risque fournisseurs et la continuité d’activité."]]'::jsonb);
select pg_temp.track_fr('grc-standards','Normes et réglementations : ISO 27001, RGPD, NIS2 et DORA',
 'Les textes que citent les offres GRC : le système de management ISO 27001, la protection des données personnelles et les nouvelles règles européennes des secteurs critiques et de la finance.',
 'Expliquer les clauses et l’annexe A de l’ISO 27001, tenir un registre des traitements RGPD, et dire ce qu’ajoutent NIS2 et DORA.','[
 ["ISO/IEC 27001","ISO/IEC 27001","La page officielle de la norme : ce qu’est un système de management de la sécurité de l’information (SMSI) et comment se passe la certification."],
 ["GDPR text, article by article","Le texte du RGPD, article par article","Le règlement avec ses considérants, facile à parcourir : principes, droits, registre, analyses d’impact (en anglais ; le texte français est sur le site de la CNIL)."],
 ["NIS2 directive","La directive NIS2","La page de la Commission européenne sur NIS2 : quelles organisations sont concernées et ce qui est exigé."],
 ["BPMN & process mapping","BPMN et cartographie des processus","Cours HelloKhedma : cartographier un processus pour voir où placer un contrôle et qui l’exécute."],
 ["SQL for data jobs","SQL pour les métiers de la data","Cours HelloKhedma : interroger vous-même les listes d’utilisateurs, les droits d’accès et les journaux pour réunir des preuves d’audit."],
 ["Project: an ISO 27001 gap assessment","Projet : un état des lieux ISO 27001","Comparer une organisation réelle ou fictive aux contrôles de l’ISO 27001 et écrire le plan d’action (voir les projets de portfolio plus bas)."],
 ["ISO 27001 and audits in practice", "ISO 27001 et les audits en pratique", "Cours HelloKhedma : les chapitres du SMSI, l’annexe A, la déclaration d’applicabilité, les preuves, les audits internes et de certification, et SOC 2."],
 ["GDPR, NIS2 and DORA for analysts", "RGPD, NIS2 et DORA pour les analystes", "Cours HelloKhedma : le RGPD au quotidien, AIPD et violations, obligations NIS2, DORA pour les entités financières, et traduire les règles en mesures et en preuves."]]'::jsonb);

update public.training_steps s set course_id = v.c from (values
  ('po-foundations','Backlog, user stories and prioritisation','po-backlog'),
  ('po-discovery','Product discovery and user research','po-discovery'),
  ('po-discovery','Product metrics and experiments','po-metrics'),
  ('po-delivery','Roadmaps, stakeholders and delivery','po-roadmap'),
  ('pm-foundations','Project planning: scope, schedule and critical path','pm-planning'),
  ('pm-foundations','Project budget, cost control and earned value','pm-budget'),
  ('pm-foundations','Risks, issues and change control','pm-risks'),
  ('pm-certification','Stakeholders, communication and steering','pm-stakeholders'),
  ('grc-foundations','Security and GRC foundations','grc-basics'),
  ('grc-foundations','IT risk management','grc-risk'),
  ('grc-standards','ISO 27001 and audits in practice','grc-iso27001'),
  ('grc-standards','GDPR, NIS2 and DORA for analysts','grc-regulations')
) as v(tid, title, c)
where s.id = md5(v.tid || ':' || v.title)::uuid;

-- Check: should show 12 HelloKhedma course steps on these three paths, all 12 linked to a course.
select count(*) as new_steps, count(s.course_id) as linked
from public.training_steps s join public.training_tracks t on t.id = s.track_id
where t.path_id in ('po', 'pm', 'grc') and s.course_id in ('po-backlog', 'po-discovery', 'po-metrics', 'po-roadmap', 'pm-planning', 'pm-budget', 'pm-risks', 'pm-stakeholders', 'grc-basics', 'grc-risk', 'grc-iso27001', 'grc-regulations');

-- End of file. The lines below are padding: a phone copy sometimes loses the last lines of a page.
--
--
--
--
--
