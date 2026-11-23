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
- [ ] Vérifier source par source (Adzuna, JSearch, Jooble…) quel champ est utilisé pour le lieu. Le lieu affiché doit être celui renvoyé par la source pour l'offre, jamais le lieu de la recherche.
- [ ] Si la source ne renvoie pas de lieu fiable, afficher « Lieu non précisé » plutôt que le lieu recherché.
- [ ] Optionnel : signaler les offres dont l'intitulé ou la description mentionne une autre ville ou un autre pays que celui affiché.

## P1 — Textes de confidentialité contradictoires (page `#/privacy`, page CV)

**Avant de commiter cette section, montre-moi le diff.**

- [ ] Dans « En bref », remplacer « pas de mesure d'audience » par une formulation exacte. Cloudflare Web Analytics est bien chargé (`static.cloudflareinsights.com/beacon.min.js`) et il est décrit plus bas dans la même page.
- [ ] Corriger la phrase « Les polices et bibliothèques sont servies par HelloKhedma lui-même, sans service tiers » : pdf.js est chargé depuis cdnjs et le script de mesure depuis Cloudflare.
- [ ] Page CV : la phrase « Votre CV reste dans ce navigateur et n'est jamais envoyé » est trop absolue. Ajouter les exceptions : réécriture par IA à la demande, enregistrement dans le compte si l'option est activée.
- [ ] Page Compte en invité : « rien sur nos serveurs » doit rester cohérent avec les statistiques anonymes et les compteurs d'utilisation décrits dans la politique.
- [ ] **[À VÉRIFIER]** Statistiques anonymes : sur le navigateur audité, la page Compte affichait « Vous partagez des statistiques anonymes », alors que la politique les annonce désactivées par défaut. Tester sur un profil de navigateur vierge. Si l'option est activée sans action de l'utilisateur, corriger la valeur par défaut. Si l'utilisateur l'avait activée lui-même, ne rien changer.

## P1 — Session, déconnexion et mode invité (`js/auth.js`, `js/supabase.js`, `js/store.js`, `js/applications.js`)

Constats :
- L'utilisateur était connecté à 15 h 20 et le site était en mode invité à 17 h 20, sans déconnexion volontaire constatée.
- En invité, le Suivi affiche 0 candidature sans expliquer que les candidatures sont dans le compte.
- Après la déconnexion, les CV (avec téléphone et e-mail) restent dans le stockage local.

À faire :
- [ ] **[À VÉRIFIER]** Vérifier la configuration du client Supabase : `persistSession` et `autoRefreshToken` sont-ils actifs, et le refresh token est-il bien conservé ? Reproduire en laissant un onglet ouvert plus d'une heure. Si la session expire sans action, corriger.
- [ ] Si la session expire, afficher un message clair (« Vous avez été déconnecté, reconnectez-vous pour retrouver vos candidatures ») au lieu de basculer silencieusement en invité.
- [ ] Suivi en invité : si un compte a déjà été utilisé sur cet appareil, afficher « Vos candidatures sont dans votre compte » avec un bouton « Se connecter ».
- [ ] Lors d'une déconnexion volontaire, proposer d'effacer les CV et les données locales de cet appareil (case à cocher dans la confirmation), pour les ordinateurs partagés.

---

## P2 — Bugs

- [ ] **Compte › Vos CV** (`js/account.js`) : le texte « null » s'affiche sous le paragraphe d'explication. Trouver la valeur non initialisée et ne rien afficher, ou afficher la liste des CV, quand elle est vide.
- [ ] **Règle « commencer par un verbe »** (`js/atsscore.js` ou `js/ats.js`) : des lignes en anglais qui commencent par un verbe d'action (« Provided L2/L3 production application support… ») sont signalées à tort. Ajouter les verbes d'action anglais courants (provided, managed, led, built, designed, automated, monitored, coordinated, resolved, implemented, etc.) et les formes au passé. Ajouter des tests pour le français et l'anglais.
- [ ] **Formation : chiffres incohérents** (`js/training.js`, `js/coursetime.js`) :
  - l'en-tête annonce « environ 72 h restantes · environ 15 semaine(s) à 5 h/semaine », mais le planning dit « 12 semaines à 5 h/semaine » ;
  - « À suivre : Linux Journey · 8 h », mais la fiche Linux Journey indique 3,5 h ;
  - l'étape 1 annonce « 20 h », mais ses 4 ressources totalisent 16 h (3,5 + 3,5 + 5 + 4).
  - Il faut une seule source de vérité pour les durées, utilisée partout.
- [ ] **Formation : « Reprendre »** : le bloc affiche « Outils, MCP et agents · Leçon 7 · 0 % fait » pour le parcours Support applicatif. Il faut proposer en priorité un cours du parcours actif. Le pourcentage doit être cohérent avec la leçon en cours : être en leçon 7 implique plus de 0 %.
- [ ] **Formation : planning** : la semaine 1 commence « à partir du 30 nov. » alors que nous sommes le lundi 23. Faire démarrer la semaine 1 à la semaine en cours.
- [ ] **Offres en double** (`js/offers.js`) : dédupliquer en normalisant le nom de l'entreprise et l'intitulé. Exemples : « Collective » et « Collective.work », « Brink's » et « Brinks Careers », la même offre « Développeur C++ IT Quant » via Free-Work et via INGENIANCE.
- [ ] **Caractères cassés** : « au c?ur » au lieu de « au cœur » (offre INGENIANCE). Normaliser l'encodage des descriptions reçues (Unicode NFC, ligatures œ/æ) et repérer les « ? » isolés au milieu d'un mot.
- [ ] **Route inconnue** (`js/router.js`) : une adresse comme `#/page-qui-nexiste-pas` affiche l'accueil sans message, et l'URL reste fausse. Afficher un message « Page introuvable » avec un lien vers l'accueil, ou rediriger vers `#/` en corrigeant l'URL.
- [ ] **Console** : supprimer le `console.warn('Job sources', …)` laissé dans `js/offers.js` (vers la ligne 387), ou le passer derrière un mode debug.
- [ ] **Offres au premier passage** : la page restait vide tant qu'on ne cliquait pas sur « Rechercher ». Lancer automatiquement la dernière recherche, ou la recherche par défaut du parcours, à l'ouverture de la page.

## P2 — Contenus et textes (`js/i18n-fr.js`, `js/fr/*.js`)

- [ ] Traduire les compétences affichées dans l'interface en français (« Incident management » → « Gestion des incidents », « Requirements gathering » → « Recueil des besoins », « Account management » → « Gestion de comptes »…). L'identifiant interne reste en anglais pour le matching ; seul le libellé change.
- [ ] Remplacer les pluriels génériques « (s) » par un vrai accord selon le nombre : « semaine(s) », « sauvegardée(s), non envoyée(s) », « affichée(s) ». Créer un petit helper de pluriel s'il n'existe pas.
- [ ] Reformuler « 20 affichée(s) sur 59 · 20 avec salaire ». Ce libellé est ambigu, car seules 6 des 20 offres affichées montrent un salaire. Proposition : « 20 offres affichées sur 59 · 20 des 59 indiquent un salaire ».
- [ ] Noms des copies de CV : éviter « New (copy) (copy) ». Proposer « Nom du CV (2) », « (3) »…, ou demander un nom à la création de la copie.
- [ ] **Page Entretiens, négociation salariale** : la phrase sur la directive européenne 2023/970 doit être mise à jour, datée et sourcée. La date limite de transposition était le 7 juin 2026 et la France ne l'a pas tenue. La date de 2027 n'est pas confirmée par les sources consultées. Proposition : « Une directive européenne (2023/970) prévoit l'affichage de la fourchette de salaire et interdit de demander votre salaire passé. Sa transposition en France est en cours (situation au [date]). »

## P3 — Technique et performance (`index.html`, `js/app.js`)

- [ ] Chaque visite charge 70 fichiers JavaScript (environ 840 Ko décompressés), quelle que soit la page, y compris `admin.js`, `drills.js`, `practice.js`, `cvmaker.js`. Charger le code de chaque page à la demande (import dynamique au moment de la navigation). Garder au démarrage seulement le noyau : router, état, auth, i18n, accueil.
- [ ] Ne pas livrer `admin.js` aux utilisateurs non administrateurs (chargement à la demande après vérification du rôle).
- [ ] Accueil : la section « Parcours métier » reste vide pendant le chargement depuis Supabase (`career_paths`). Embarquer une copie statique des parcours dans le bundle (ils changent rarement), puis rafraîchir depuis Supabase en arrière-plan.
- [ ] **[À VÉRIFIER]** Toutes les pages sont rendues en même temps dans le DOM (10 h1, dont 9 masqués). Si c'est le cas, ne monter que la page active.

---

## Vérification finale

- [ ] Tester chaque correction en invité ET connecté.
- [ ] Tester sur un profil de navigateur vierge (valeurs par défaut, premier chargement).
- [ ] Tester à 390 px et 1280 px de large (le mobile n'a pas pu être testé pendant l'audit).
- [ ] Aucune erreur ni avertissement de debug dans la console.
- [ ] Lancer les tests existants et ajouter ceux demandés ci-dessus (score d'adéquation, verbes d'action).
