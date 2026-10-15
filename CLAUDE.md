# CLAUDE.md — Vadrouille

> **Vadrouille — On part où ?** L'app qui aide un groupe d'amis à **décider** où partir en week-end.
> Le cœur du produit est le **moteur de décision collective** (déterministe, explicable, équitable).

Ce fichier est la mémoire du projet pour Claude Code (et pour les humains). Il décrit
l'architecture, les règles non négociables et **toutes les décisions prises** (section
« Décisions & hypothèses »). Mets-le à jour à chaque décision structurante.

## Commandes

```bash
npm install              # installe les dépendances + active le hook pre-push (.githooks)
npm start                # serveur Expo (i = simulateur iOS, w = web)
npm run ios              # lance directement sur le simulateur iOS (Expo Go)
npm run web              # version web (parcours invité)
npm run typecheck        # tsc --noEmit
npm test                 # vitest : moteur, RLS (PGlite), parcours de bout en bout
npm run check:secrets    # vérifie qu'aucune clé n'est versionnée
npm run verify           # typecheck + tests + secrets (lancé automatiquement avant chaque push)
npm run check:functions  # type-check Deno des Edge Functions (télécharge Deno via npx)
npm run build:web        # export web statique dans dist/
```

## Règles du dépôt

- Travail sur `main`, **commit + push après chaque étape fonctionnelle**. Messages en français :
  `feat: …`, `fix: …`, `test: …`, `chore: …`, `docs: …`.
- **Aucun secret dans le dépôt** : `.env` est ignoré, `.env.example` documente les variables.
  Le hook `pre-push` lance `npm run verify` (typecheck + tests + scan de secrets).
- Expo SDK 57 : ne pas se fier à sa mémoire, lire la doc versionnée (voir `AGENTS.md`).
  Toujours `npx expo install <pkg>` pour les dépendances natives.

## Architecture

```
src/
  app/                 # écrans (Expo Router) — un fichier = une route
    index.tsx          #   accueil + mes Vadrouilles
    nouvelle.tsx       #   création (prénom → nom → week-ends → taille)
    i/[code].tsx       #   atterrissage du lien d'invitation (app ou web)
    v/[code]/index.tsx #   écran central : collecte → vote → plan, selon le statut
    v/[code]/questions.tsx  # questionnaire, une question par écran
    compte.tsx         #   prénom + sauvegarde par email (code à 6 chiffres)
  features/            # blocs d'écran : Collecting, Results, OptionCard, Plan
  components/          # UI kit maison (boutons, cartes, slider, tuiles…)
  lib/
    backend/           # interface Backend + implémentations Supabase et démo
    useVadrouille.ts   # état d'une Vadrouille (react-query, rafraîchi toutes les 4 s)
    session.tsx        # compte léger (prénom) partagé par toute l'app
  engine/              # ré-export du moteur partagé (voir supabase/functions/_shared)
supabase/
  config.toml          # config Supabase CLI (auth anonyme, OTP email…)
  migrations/          # schéma, RLS, fonctions RPC (source de vérité SQL)
  functions/
    _shared/engine/    # MOTEUR DE DÉCISION — TypeScript pur, partagé app + Edge Function
    _shared/data/      # données seed (destinations, villes, matrice trajets, coûts)
    compute-results/   # Edge Function : calcule les 3 options côté serveur
tests/                 # vitest : moteur, RLS/SQL (PGlite), e2e
```

Le moteur vit dans `supabase/functions/_shared/engine` (convention Supabase `_shared`) car
l'Edge Function doit pouvoir l'embarquer au déploiement ; l'app l'importe via `src/engine`.
Imports relatifs **avec extension `.ts`** (compatibilité Deno) — `allowImportingTsExtensions`
est activé dans `tsconfig.json`, Metro résout les extensions explicites.

## Confidentialité (non négociable)

- **Réponses brutes** (`responses`) : lisibles uniquement par leur auteur — politique RLS
  `user_id = auth.uid()`. L'organisateur n'a aucun passe-droit. Prouvé par `tests/db/rls.test.ts`.
- **Calcul côté serveur** : l'Edge Function `compute-results` lit les réponses avec la clé
  `service_role` (jamais dans l'app), exécute le moteur et n'enregistre que des agrégats
  (`results`, `result_options`) + le budget individuel de chacun (`result_member_details`,
  lisible uniquement par le membre concerné).
- **Suivi** : les co-membres voient QUI a répondu (`members.responded_at`), jamais QUOI.
- **Votes** : chacun ne lit que son vote ; seul le décompte par option est exposé (`vote_tally`).
- **Règle K anti-réidentification** (`engine/explain.ts`, `privacyThreshold = 4`) : sous 4
  membres présents, aucun agrégat issu des réponses n'est publié (ni « k/n », ni coût/trajet
  moyens, ni décompte des dispos) — avec 2 ou 3 personnes, un agrégat révèle une réponse
  individuelle. Chacun ne voit alors que ses propres chiffres et des données destination.
  Une ligne « k/n voulaient … » n'apparaît que si au moins 2 membres partagent l'envie.
- **Diagnostic de blocage** : nomme le critère qui bloque et quoi assouplir, jamais la personne.
- **LLM** : Claude ne reçoit que les données publiques déjà filtrées d'une option, uniquement
  pour rédiger l'accroche ; il ne voit aucune réponse et ne touche ni au score ni au classement.
- **Mode démo** : le backend local applique la même séparation public / privé (`getState`).

## Moteur de décision

Code : `supabase/functions/_shared/engine` (`decide.ts`, `evaluate.ts`, `explain.ts`,
`config.ts`). Déterministe : aucun aléa, aucun LLM, ordre des membres indifférent.

1. **Week-end** : celui qui maximise la présence (dispo = 1, peut-être = 0,5).
2. **Filtre dur** : une option (destination × confort × week-end) est éliminée si elle viole un
   critère « indispensable » d'au moins un membre présent.
3. **Score individuel** : satisfaction pondérée par critère (poids dans `config.ts` ; budget et
   envies pèsent le plus), × 1,5 si indispensable, × 0,4 si négociable. Budget calculé depuis
   la ville de chacun (transport A/R + logement + repas + activités).
4. **Match Score** = 100 × (0,7 × moyenne + 0,3 × satisfaction du moins bien servi). Le terme
   « minimum » empêche de sacrifier une personne pour gonfler la moyenne ; 0,3 suffit à
   départager sans laisser un seul membre dicter le résultat.
5. **Sélection** : 🥇 meilleur score ; 💸 la moins chère au-dessus de max(50, best − 15) ;
   🔥 la plus « rare » (popularité faible) au-dessus de max(40, best − 30). Trois destinations
   distinctes.
6. **Aucune option** : `summary.blocking` dit quel critère bloque et combien de destinations
   se débloquent si on l'assouplit.

## Décisions & hypothèses

_(liste tenue à jour au fil du développement — chaque entrée : décision + pourquoi)_

1. **Projet Supabase** : l'organisation Supabase « CITARI » (plan gratuit) a déjà ses 2 projets
   gratuits actifs ; je n'ai ni créé de projet payant ni réutilisé un projet existant sans
   accord. Tout le backend est versionné (migrations, Edge Function, config) et testé en local
   sur un vrai Postgres embarqué (PGlite). À faire par l'humain : créer/choisir le projet
   (voir README).
2. **Mode démo** : si les variables Supabase sont absentes (ou `EXPO_PUBLIC_DEMO_MODE=1`), l'app
   tourne sur un backend local simulé qui utilise **le même moteur** et la même forme de
   données publiques/privées. Permet de voir tout le parcours dans le simulateur sans backend,
   et sert de banc d'essai e2e. Un bandeau « Mode démo » l'indique toujours.
3. **Expo SDK 57**, Expo Router (routes dans `src/app`), TypeScript strict, React Compiler
   activé (défaut du template), `typedRoutes` désactivé (types générés seulement par
   `expo start`, ce qui rendait le typecheck instable).
4. **Thème clair uniquement** (`userInterfaceStyle: light`) : l'identité « carte postale
   ensoleillée » est pensée en clair ; un thème sombre est un chantier post-MVP.
5. **Identifiants** : bundle iOS / package Android `com.projetlicorne.vadrouille`
   (modifiable avant la première soumission App Store).
6. **Export web en `single`** (SPA) : le parcours invité est dynamique (`/i/<code>`), le rendu
   statique n'apporte rien et compliquerait l'accès au stockage de session côté build.
   L'hébergeur doit réécrire toutes les routes vers `index.html` (voir README).
7. **Fusion du 8 oct. 2026** : deux sessions ont construit le moteur en parallèle ; celui de
   Luigi a été conservé (commit `c8e9fae`). L'app (écrans, couche Backend) est écrite contre
   ce moteur-là uniquement.
8. **Compte léger = connexion anonyme Supabase + prénom.** C'est l'option la plus fluide pour
   l'invité web : un champ, zéro email, zéro mot de passe. L'email (code à 6 chiffres) est
   proposé ensuite dans « Mon compte » pour retrouver ses Vadrouilles sur un autre appareil.
   Tant qu'aucun email n'est rattaché, on ne propose pas de déconnexion (le compte serait perdu).
9. **Un seul écran central par Vadrouille** (`/v/<code>`) qui suit son statut plutôt que trois
   routes : un lien partagé reste valable du questionnaire jusqu'au plan du séjour.
10. **Pas de temps réel** : l'écran central se rafraîchit toutes les 4 s (react-query). Suffisant
    pour un groupe de 5–10 ; Supabase Realtime est une optimisation post-MVP.
11. **Qui lance le calcul** : l'organisateur à tout moment (« forcer »), n'importe quel membre
    quand tout le monde a répondu et que le groupe est au complet (`computePermission`).
12. **Importance** : trois pastilles discrètes sous la question, « souhaitable » présélectionné.
    Disponibilités et ville de départ n'ont pas d'importance réglable. Météo : choisir
    « Grand soleil obligé » la rend indispensable, les autres niveaux non.
13. **Vote** : anonyme, clos automatiquement quand tous les membres ont voté ; l'organisateur
    peut clore avant ou rouvrir les réponses. Égalité : meilleur Match Score, puis ordre d'affichage.
14. **Accroches Claude** : modèle `claude-opus-5-5` par défaut (surchargé par `CLAUDE_MODEL`),
    effort `low`. Sans clé `ANTHROPIC_API_KEY`, ou en cas d'erreur, l'accroche du seed est utilisée.
15. **Simulateur iOS** : non testé au 11 oct. 2026 — la machine d'Axelle n'a pas Xcode complet.
    L'app a été vérifiée de bout en bout sur la version web en format mobile (mode démo).
16. **Lint** : `expo lint` n'est pas configuré (il installerait ESLint) ; le garde-fou du dépôt
    est `npm run verify` (typecheck + tests + scan de secrets).
17. **Taille du groupe : 2 à 15 personnes** (15 oct. 2026, demande d'Axelle ; avant : 12). La base
    accepte jusqu'à 20 (`expected_size`), donc aucun changement SQL. La démo compte 14 potes
    fictifs pour remplir un groupe de 15 ; les 8 ajoutés n'ont aucun critère « indispensable »
    pour qu'un grand groupe ait encore des options (vérifié par `tests/engine/decide.test.ts`).
18. **Liens de réservation** (15 oct. 2026, `src/lib/booking.ts`) : le plan du séjour propose des
    liens de RECHERCHE pré-remplis plutôt que des adresses d'offres précises, qui mourraient vite
    et seraient impossibles à vérifier pour 40 destinations. Logement → Booking (dates + toute la
    bande, 2 par chambre) ; activités → GetYourGuide ; trajet → selon le mode retenu pour MOI
    (train → Trainline, bus → BlaBlaCar, avion → Google Vols, voiture → Google Maps). Aucune
    affiliation, aucune clé d'API, rien n'est réservé par l'app.
19. **Villes de départ : 12** (15 oct. 2026, demande d'Axelle) : + Montpellier, Nice, Rennes,
    Grenoble. Montpellier et Nice étaient déjà des destinations : `homeCity` les relie à leur
    ville. Leurs trajets ont été AJOUTÉS à `routes.ts` par `generate-routes.ts --ajouter=…`
    (nouvelle option) sans régénérer les 8 villes existantes. Temps de train connus ajoutés
    pour ces villes. Limite connue, héritée de l'heuristique : les trajets en voiture vers la
    montagne sont sous-estimés (ex. Lyon → Chamonix 2 h 10), pour les anciennes comme les
    nouvelles villes — à corriger à la main dans `routes.ts` si besoin.
20. **Retours d'Axelle sur la V2** (15 oct. 2026) :
    - **Parcours direct** : après la création, l'orga arrive directement sur le questionnaire
      (plus de page intermédiaire). Ses week-ends choisis valent dispos (« dispo » partout) :
      la question des dispos n'est posée qu'aux invités, en premier.
    - **Villes** : 5 tuiles (Paris, Lyon, Marseille, Bordeaux, Lille) + « Autre ». La ville tapée
      est reconnue parmi les 12 connues (suggestions à la frappe) ; sinon on demande la grande
      ville la plus proche, et le trajet est calculé depuis celle-ci. La ville tapée n'est pas
      enregistrée (seule `departureCity` l'est).
    - **Vélo** (`bike`) : proposé dans les transports seulement si l'envie Sport est cochée.
      Trajet calculé à la volée (`catalog.ts`) : vol d'oiseau × 1,2, 18 km/h, gratuit, au plus
      100 km de route. Le moteur ne l'envisage QUE pour qui l'a coché (sinon un trajet gratuit
      serait retenu pour des gens qui n'en veulent pas).
    - **4 envies en plus** : Concerts & spectacles, Sensations fortes (karting, accrobranche…),
      Insolite, Jeux & ludique (escape game, bowling…). Intensités estimées pour les 40
      destinations ; pas encore de suggestions d'activités dédiées dans le plan.
    - Ordre des questions : envies avant transports (pour savoir si on propose le vélo).
21. **Calendrier, décors, grilles** (15 oct. 2026, retours d'Axelle) :
    - Les dispos se choisissent dans un **calendrier mois par mois** (`WeekendCalendar`) : seuls
      les week-ends proposés se touchent, d'un seul geste vendredi → dimanche ; les autres jours
      sont grisés. À la création : 2 à 4 week-ends. Pour les invités : 1 toucher = dispo,
      2 = peut-être, 3 = pas dispo ; un week-end jamais touché est enregistré « pas dispo ».
    - **Décors : 2 minimum, ou « Peu importe »** (on ne peut plus en cocher un seul). Choix
      d'Axelle pour éviter qu'un décor unique, imposé à tout le groupe, bloque les options.
      Le moteur, lui, accepte toujours une liste d'un élément (anciennes réponses, démo).
    - Grilles de tuiles : une tuile seule sur sa ligne garde une demi-largeur (`TileGrid`).
    - Design : skill Impeccable installé sur le poste d'Axelle (hors dépôt) ; `PRODUCT.md`
      décrit le produit pour lui. Identité « carte postale » conservée.
