# HelloKhedma — corrections issues de l'audit fonctionnel (23/11/2026)

## Consignes pour Claude Code

- Cette liste ne contient aucun changement visuel : ne modifie ni les couleurs, ni les polices, ni la mise en page.
- Commence par explorer le projet. Les fichiers cités (`js/offers.js`, `js/ats.js`, `js/training.js`, `js/account.js`, `js/router.js`, `js/i18n-fr.js`, `js/fr/*.js`, `js/jobs.js`…) sont des indices relevés dans le navigateur. Vérifie toujours où se trouve réellement le code concerné.
- Traite une section à la fois, avec un commit par section.
- Avant chaque correction, reproduis le problème si c'est possible. Après la correction, vérifie-la dans l'app lancée en local.
- Les points marqués **[À VÉRIFIER]** sont des hypothèses. Confirme-les avant de modifier le code, et s'ils ne se confirment pas, signale-le au lieu de « corriger ».
- Ne modifie pas les textes juridiques (confidentialité, mentions légales) sans me montrer le diff avant le commit.

---

## P1 — Score d'adéquation CV / offre (`js/offers.js`, `js/ats.js`, `js/offercheck.js`)

Constats :
- Une offre obtient « 100 % d'adéquation · 2/2 » à partir de seulement 2 compétences détectées, puis passe en tête du tri « Meilleure adéquation ».
- Pour le parcours Support applicatif, un « Développeur Java Fullstack Senior » est noté 100 % dans la liste du marché (page CV).
- 10 offres affichées sur 20 sont en « Adéquation : n.d. » : aucune compétence n'est détectée, surtout chez Adzuna, dont le résumé est tronqué.

À faire :
- [x] Fixer un seuil minimal de compétences détectées (par exemple 4). En dessous, afficher « Pas assez d'informations » au lieu d'un pourcentage, et ne pas trier ces offres comme des 100 %.
- [x] Pondérer le score par la pertinence de l'intitulé pour le parcours. Un poste de développeur ne doit pas atteindre 100 % pour Support applicatif.
- [x] Pour Adzuna (et toute source à résumé tronqué) : vérifier si la description complète est disponible via l'API ou la page de l'offre, et l'utiliser pour l'extraction des compétences.
- [x] Ajouter des tests unitaires : 2/2 ne donne pas 100 %, un intitulé hors parcours plafonne le score, et une offre sans compétence ne remonte pas en tête.

> **Fait le 23/11/2026 (Claude).** Reproduit avec le code du site : « SQL et Linux » → 100 % · 2/2 ; « Développeur Java
> Fullstack Senior / Oracle » → 100 % pour un CV de support. Cause : le score ne compte que les compétences que le
> dictionnaire reconnaît dans l'offre, et il ne connaissait ni le développement (dans l'offre Java, il ne voyait que
> Java et Oracle, pas « Fullstack » ni « forte dominante Backend ») ni le vocabulaire français du support (« incident »,
> « support applicatif / N2 / N3 », « MCO », « tickets », « mise en production », « diagnostic »…). Correction, sans
> regarder le métier choisi (un développeur peut faire du support s'il en a les compétences) :
> - `js/ats.js` : compétences de développement (backend, frontend, fullstack, Spring, Angular, React, microservices…) et
>   vocabulaire du support en français ;
> - `js/fit.js` (une seule règle pour la page Offres et « Choisir une offre ») : les compétences de l'intitulé pèsent 3
>   fois plus (le cœur du poste), et « Compétences clés de l'intitulé absentes de votre CV » s'affiche au survol ; moins de
>   4 compétences trouvées → « Pas assez d'informations », classé après les offres notées.
> Sur les 66 offres de la recherche de l'audit (en cache) : l'offre Java passe à 60 % pour un CV de support (100 % pour un
> CV de développeur), les offres sans aucune compétence reconnue passent de 26 à 12 et les offres notées de 7 à 16.
> Les autres sont des résumés Adzuna : l'API ne renvoie que 500 caractères (55 offres sur 66, de 495 à 500 caractères),
> souvent la présentation de l'entreprise sans les exigences ; un pourcentage y serait inventé. La description complète
> n'est que sur le site d'Adzuna (pas dans l'API). Test « fit score » ajouté, sur l'offre Java réelle de l'audit.

## P1 — Lieu des offres (`js/jobs.js`, fonction serveur `job-search`, `js/places.js`)

Constats :
- Une offre NEXTON dont la description dit « à Lille » est affichée « Paris, Ile-de-France ».
- « Technicien Support Applicatif… – Lisbonne, Portugal » est affichée « Paris, FR ».

À faire :
- [x] Vérifier source par source (Adzuna, JSearch, Jooble…) quel champ est utilisé pour le lieu. Le lieu affiché doit être celui renvoyé par la source pour l'offre, jamais le lieu de la recherche.
- [x] Si la source ne renvoie pas de lieu fiable, afficher « Lieu non précisé » plutôt que le lieu recherché.
- [x] Optionnel : signaler les offres dont l'intitulé ou la description mentionne une autre ville ou un autre pays que celui affiché.

> **Fait le 25/11/2026 (Claude).** Vérifié : l'app n'affichait jamais le lieu de la recherche, mais celui que la source
> renvoie pour l'offre (Adzuna `location.display_name`, JSearch `job_city / job_state / job_country`, etc.) ; ce sont les
> sources qui se trompaient (Adzuna : NEXTON « à Lille » classée « Paris, Ile-de-France » ; JSearch : « … – Lisbonne,
> Portugal » classée « Paris, FR »). Correction (`js/offerplace.js`) : le lieu écrit dans l'offre (ville ou pays de
> l'intitulé, sinon une seule ville introduite par « à », « sur », « basé à », « Lieu : »…, en ignorant les
> déplacements, sièges et agences) l'emporte quand la source indique une autre ville ou un autre pays, avec la note
> « 📍 Lieu tiré du texte de l'offre ; la source indique … » ; « Lieu non précisé » sans lieu ; badge « Hors du pays
> recherché ». Le Suivi reçoit le lieu corrigé. Sur les 65 offres de la recherche de l'audit en cache : seule NEXTON est
> signalée (Lille), aucune fausse alerte (« Déplacements à Nantes » est ignoré). Test « offer place » sur les offres réelles.

## P1 — Textes de confidentialité contradictoires (page `#/privacy`, page CV)

**Avant de commiter cette section, montre-moi le diff.**

- [x] Dans « En bref », remplacer « pas de mesure d'audience » par une formulation exacte. Cloudflare Web Analytics est bien chargé (`static.cloudflareinsights.com/beacon.min.js`) et il est décrit plus bas dans la même page.
- [x] Corriger la phrase « Les polices et bibliothèques sont servies par HelloKhedma lui-même, sans service tiers » : pdf.js est chargé depuis cdnjs et le script de mesure depuis Cloudflare.
- [x] Page CV : la phrase « Votre CV reste dans ce navigateur et n'est jamais envoyé » est trop absolue. Ajouter les exceptions : réécriture par IA à la demande, enregistrement dans le compte si l'option est activée.
- [x] Page Compte en invité : « rien sur nos serveurs » doit rester cohérent avec les statistiques anonymes et les compteurs d'utilisation décrits dans la politique.
- [x] **[À VÉRIFIER]** Statistiques anonymes : sur le navigateur audité, la page Compte affichait « Vous partagez des statistiques anonymes », alors que la politique les annonce désactivées par défaut. Tester sur un profil de navigateur vierge. Si l'option est activée sans action de l'utilisateur, corriger la valeur par défaut. Si l'utilisateur l'avait activée lui-même, ne rien changer.
  → Vérifié le 26/11 sur un profil vierge : « hk.insights » est vide, rien n'est envoyé et la page Compte propose « Partager ». L'option avait été activée sur le navigateur audité ; rien à corriger.

## P1 — Session, déconnexion et mode invité (`js/auth.js`, `js/supabase.js`, `js/store.js`, `js/applications.js`)

Constats :
- L'utilisateur était connecté à 15 h 20 et le site était en mode invité à 17 h 20, sans déconnexion volontaire constatée.
- En invité, le Suivi affiche 0 candidature sans expliquer que les candidatures sont dans le compte.
- Après la déconnexion, les CV (avec téléphone et e-mail) restent dans le stockage local.

À faire :
- [x] **[À VÉRIFIER]** Vérifier la configuration du client Supabase : `persistSession` et `autoRefreshToken` sont-ils actifs, et le refresh token est-il bien conservé ? Reproduire en laissant un onglet ouvert plus d'une heure. Si la session expire sans action, corriger.
- [x] Si la session expire, afficher un message clair (« Vous avez été déconnecté, reconnectez-vous pour retrouver vos candidatures ») au lieu de basculer silencieusement en invité.
- [x] Suivi en invité : si un compte a déjà été utilisé sur cet appareil, afficher « Vos candidatures sont dans votre compte » avec un bouton « Se connecter ».
- [x] Lors d'une déconnexion volontaire, proposer d'effacer les CV et les données locales de cet appareil (case à cocher dans la confirmation), pour les ordinateurs partagés.

---

> **Fait le 26/11/2026 (Claude).** Vérifié : le client Supabase garde les réglages par défaut (`persistSession` et
> `autoRefreshToken` actifs, session dans le stockage local), et le projet n'a ni durée maximale de session ni délai
> d'inactivité (`sessions_timebox = 0`, `sessions_inactivity_timeout = 0`, jetons d'une heure renouvelés avec rotation et
> 10 s de tolérance). La session du 23/11 n'existe plus côté serveur : elle a été fermée (déconnexion, données du
> navigateur effacées ou renouvellement refusé, par exemple onglet en veille hors ligne), pas expirée par un réglage.
> Non reproduit faute de compte de test : la correction rend toute déconnexion visible. `js/auth.js` : une déconnexion
> non demandée ouvre la fenêtre de connexion avec « Vous avez été déconnecté. Reconnectez-vous pour retrouver vos
> candidatures et votre progression. » ; « Se déconnecter » demande confirmation, avec « Effacer aussi mes CV et les
> données de l'application sur cet appareil » (tout sauf langue et thème, puis rechargement). Suivi en invité : « Vos
> candidatures sont dans votre compte » + « Se connecter » quand un compte a déjà servi sur l'appareil
> (`hk.accountUsed`, local). Test « session » ajouté (invité ; la partie connectée reste à vérifier à la main).

## P2 — Bugs

- [x] **Compte › Vos CV** (`js/account.js`) : le texte « null » s'affiche sous le paragraphe d'explication. Trouver la valeur non initialisée et ne rien afficher, ou afficher la liste des CV, quand elle est vide.
- [x] **Règle « commencer par un verbe »** (`js/atsscore.js` ou `js/ats.js`) : des lignes en anglais qui commencent par un verbe d'action (« Provided L2/L3 production application support… ») sont signalées à tort. Ajouter les verbes d'action anglais courants (provided, managed, led, built, designed, automated, monitored, coordinated, resolved, implemented, etc.) et les formes au passé. Ajouter des tests pour le français et l'anglais.
- [x] **Formation : chiffres incohérents** (`js/training.js`, `js/coursetime.js`) :
  - l'en-tête annonce « environ 72 h restantes · environ 15 semaine(s) à 5 h/semaine », mais le planning dit « 12 semaines à 5 h/semaine » ;
  - « À suivre : Linux Journey · 8 h », mais la fiche Linux Journey indique 3,5 h ;
  - l'étape 1 annonce « 20 h », mais ses 4 ressources totalisent 16 h (3,5 + 3,5 + 5 + 4).
  - Il faut une seule source de vérité pour les durées, utilisée partout.
- [x] **Formation : « Reprendre »** : le bloc affiche « Outils, MCP et agents · Leçon 7 · 0 % fait » pour le parcours Support applicatif. Il faut proposer en priorité un cours du parcours actif. Le pourcentage doit être cohérent avec la leçon en cours : être en leçon 7 implique plus de 0 %.
- [x] **Formation : planning** : la semaine 1 commence « à partir du 30 nov. » alors que nous sommes le lundi 23. Faire démarrer la semaine 1 à la semaine en cours.
- [x] **Offres en double** (`js/offers.js`) : dédupliquer en normalisant le nom de l'entreprise et l'intitulé. Exemples : « Collective » et « Collective.work », « Brink's » et « Brinks Careers », la même offre « Développeur C++ IT Quant » via Free-Work et via INGENIANCE.
- [x] **Caractères cassés** : « au c?ur » au lieu de « au cœur » (offre INGENIANCE). Normaliser l'encodage des descriptions reçues (Unicode NFC, ligatures œ/æ) et repérer les « ? » isolés au milieu d'un mot.
- [x] **Route inconnue** (`js/router.js`) : une adresse comme `#/page-qui-nexiste-pas` affiche l'accueil sans message, et l'URL reste fausse. Afficher un message « Page introuvable » avec un lien vers l'accueil, ou rediriger vers `#/` en corrigeant l'URL.
- [x] **Console** : supprimer le `console.warn('Job sources', …)` laissé dans `js/offers.js` (vers la ligne 387), ou le passer derrière un mode debug.
- [x] **Offres au premier passage** : la page restait vide tant qu'on ne cliquait pas sur « Rechercher ». Lancer automatiquement la dernière recherche, ou la recherche par défaut du parcours, à l'ouverture de la page.

> **Fait le 26/11/2026 (Claude), un commit par groupe, chaque bug reproduit puis testé :**
> - « null » : `replaceChildren(null)` pour un invité (page Compte) ; nouveau test qui cherche « null / undefined / NaN » sur
>   toutes les pages principales (il échouait sur l'ancien code).
> - Verbes : tout passé anglais régulier compte (sauf adjectifs comme « experienced »), verbes irréguliers et participes
>   français ajoutés, noms d'action français acceptés (« Mise en place… », « Gestion… ») ; tests EN / FR.
> - Formation : une seule fonction pour les heures (`stepHours`) ; l'en-tête prend les mêmes éléments et semaines que le
>   planning ; un cours compté une fois ; « À suivre » = heures de l'étape ; « Reprendre » : cours du parcours actif
>   seulement, « 2 leçons faites sur 9 · 22 % » ; semaine 1 = semaine en cours.
> - Doublons : fusion à l'affichage (`js/dedupe.js`) : domaine, apostrophe, « Careers », site d'emploi affiché comme
>   entreprise (même intitulé de 3 mots et plus, même ville) ; on garde l'entreprise réelle et le texte le plus long.
> - « c?ur » : venait de la source elle-même ; réparé (« œ » des mots courants, apostrophes perdues « l?équipe »,
>   10 offres sur 743 en cache), sans toucher aux vrais « ? » ni aux liens.
> - Route inconnue : « Page introuvable », adresse corrigée en `#/` (les liens de connexion Supabase restent intacts).
> - Console : « Job sources » seulement en mode debug (`hk.debug` ou serveur local).
> - Offres : la recherche se lance seule à la première ouverture de la page dans la visite (cache côté serveur).

## P2 — Contenus et textes (`js/i18n-fr.js`, `js/fr/*.js`)

- [x] Traduire les compétences affichées dans l'interface en français (« Incident management » → « Gestion des incidents », « Requirements gathering » → « Recueil des besoins », « Account management » → « Gestion de comptes »…). L'identifiant interne reste en anglais pour le matching ; seul le libellé change.
- [x] Remplacer les pluriels génériques « (s) » par un vrai accord selon le nombre : « semaine(s) », « sauvegardée(s), non envoyée(s) », « affichée(s) ». Créer un petit helper de pluriel s'il n'existe pas.
- [x] Reformuler « 20 affichée(s) sur 59 · 20 avec salaire ». Ce libellé est ambigu, car seules 6 des 20 offres affichées montrent un salaire. Proposition : « 20 offres affichées sur 59 · 20 des 59 indiquent un salaire ».
- [x] Noms des copies de CV : éviter « New (copy) (copy) ». Proposer « Nom du CV (2) », « (3) »…, ou demander un nom à la création de la copie.
- [x] **Page Entretiens, négociation salariale** : la phrase sur la directive européenne 2023/970 doit être mise à jour, datée et sourcée. La date limite de transposition était le 7 juin 2026 et la France ne l'a pas tenue. La date de 2027 n'est pas confirmée par les sources consultées. Proposition : « Une directive européenne (2023/970) prévoit l'affichage de la fourchette de salaire et interdit de demander votre salaire passé. Sa transposition en France est en cours (situation au [date]). »
> **Fait le 27/11/2026 (Claude) :**
> - Compétences : `js/fr/skills.js` (≈ 110 libellés : « Gestion des incidents », « Recueil des besoins », « Gestion de comptes »…),
>   affichés par `skillLabel()` (js/i18n.js) sur toutes les puces, listes et invites en français ; l'identifiant reste anglais.
>   Les libellés français servent aussi d'alias : un CV en français qui écrit « Gestion des incidents » est reconnu.
>   Noms de produits et termes que les offres françaises gardent en anglais (SQL, Power BI, Data lake, Scrum…) inchangés.
> - Pluriels : plus aucun « (s) » dans les textes français ; accord par `tn()` (semaines, sauvegardées, affichées, masquées,
>   envoyées, lignes, valeurs, réplicas, bonnes réponses).
> - Offres : « 20 offres affichées sur 59 · 20 des 59 indiquent un salaire » (compté sur toutes les offres trouvées).
> - Copies de CV : « Nom (2) », « (3) »… ; les anciens « (copy) (copy) » sont nettoyés à la copie suivante.
> - Directive 2023/970 (Entretiens + bulle d'aide des Offres, FR + EN) : « prévoit… Sa transposition en France est en cours :
>   date limite 7 juin 2026, projet de loi déposé au Sénat le 10 septembre 2026 (situation au 26 novembre 2026 ; source :
>   ministère du Travail) ». À revoir quand la loi sera adoptée.

## P3 — Technique et performance (`index.html`, `js/app.js`)

- [x] Chaque visite charge 70 fichiers JavaScript (environ 840 Ko décompressés), quelle que soit la page, y compris `admin.js`, `drills.js`, `practice.js`, `cvmaker.js`. Charger le code de chaque page à la demande (import dynamique au moment de la navigation). Garder au démarrage seulement le noyau : router, état, auth, i18n, accueil.
- [x] Ne pas livrer `admin.js` aux utilisateurs non administrateurs (chargement à la demande après vérification du rôle).
- [x] Accueil : la section « Parcours métier » reste vide pendant le chargement depuis Supabase (`career_paths`). Embarquer une copie statique des parcours dans le bundle (ils changent rarement), puis rafraîchir depuis Supabase en arrière-plan.
- [x] **[À VÉRIFIER]** Toutes les pages sont rendues en même temps dans le DOM (10 h1, dont 9 masqués). Si c'est le cas, ne monter que la page active.
> **Fait le 27/11/2026 (Claude), mesuré dans un navigateur (premier passage sur l'accueil) :**
> - Avant : 72 fichiers JS, 881 Ko. Après : **51 fichiers, 503 Ko en anglais** (642 Ko en français, qui charge ses textes).
> - Sous-pages chargées à leur première ouverture (`import()` dans js/router.js) : cours (lecteur, quiz, exercices,
>   drills, Python, SQL), révisions, test de positionnement, parcours IA, projet, entretiens, admin.
>   `js/catalog.js` (index des cours) séparé de `js/courses.js` : Formation, « Combler les écarts » et l'état partagé
>   n'emportent plus le lecteur de cours.
> - Textes français (≈ 140 Ko) chargés seulement en français. Créateur de CV (+ PDF, lecture de CV), lettres et coach
>   d'offre chargés au clic.
> - `admin.js` n'est plus livré aux visiteurs : le contrôle du rôle est dans account.js, admin.js ne se charge que sur
>   #/admin.
> - Parcours : `content/paths.json`, copie écrite au déploiement depuis supabase/seed.sql (scripts/gen-pages.mjs), affichée
>   tout de suite, puis remplacée par les lignes de Supabase. Testé avec Supabase retardé de 4 s : les 12 cartes et la
>   couleur du parcours sont là en 1,2 s.
> - [Vérifié] Les 10 pages sont bien dans le HTML, 9 avec l'attribut `hidden` : non affichées, non lues par les lecteurs
>   d'écran. Le vrai coût était le code chargé et exécuté au démarrage (traité ci-dessus) ; pas de refonte d'index.html.
> - Reste possible (étape suivante, non faite) : charger aussi à la demande les pages principales (Offres, CV, Suivi,
>   Formation, ≈ 230 Ko). Plus risqué : un changement de parcours redessine toutes ces pages.
> - Nouveau test « start-up » : l'accueil ne charge ni le lecteur de cours, ni admin, ni le créateur de CV, ni le français
>   en anglais ; les cartes s'affichent avant la réponse de la base. Les tests attendent `html[data-ready]`.

---

## Vérification finale

- [ ] Tester chaque correction en invité ET connecté. → Invité : fait sur le site en ligne (ci-dessous). Connecté : couvert
  par les tests automatiques (connexion simulée : alertes, « Demander sur la leçon », import des données invité), mais pas
  vérifié en vrai : Claude n'a pas de compte et n'en crée pas sur la base réelle. Tâche O60 pour le propriétaire.
- [x] Tester sur un profil de navigateur vierge (valeurs par défaut, premier chargement). → Un profil neuf par passage ;
  statistiques anonymes non activées (« hk.insights » vide), page d'accueil et guide de première visite affichés.
- [x] Tester à 390 px et 1280 px de large. → 16 adresses (toutes les pages, cours, révisions, test de positionnement,
  parcours IA, projet, confidentialité, mentions légales, adresse inconnue) × 2 largeurs × FR / EN : aucun défilement
  horizontal, aucun « null / undefined / NaN » ni « (s) » affiché, chaque page a du contenu.
- [x] Aucune erreur ni avertissement de debug dans la console. → Aucun, sauf le script Cloudflare Web Analytics bloqué par
  le réseau de l'environnement de test de Claude (il se charge dans un navigateur normal ; un bloqueur de publicité donne
  la même ligne, sans effet sur le site). Plus de « Job sources ».
- [x] Lancer les tests existants et ajouter ceux demandés ci-dessus. → 75 tests automatiques (CI, avant chaque mise en
  ligne), dont les nouveaux : score d'adéquation, lieu des offres, session, « null », verbes d'action, heures de formation,
  doublons, caractères cassés, adresse inconnue, textes français, démarrage.

> Vérifié le 27/11/2026 sur https://hellokhedma.io après la mise en ligne de P3 (Claude, navigateur automatisé, sans
> recherche d'offres ni compteurs d'usage). Premier passage sur l'accueil : 51 fichiers JS / 504 Ko en anglais,
> 59 / 644 Ko en français (avant l'audit : 72 / 881 Ko).
