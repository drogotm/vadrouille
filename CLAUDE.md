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
  components/          # UI kit maison (boutons, cartes, slider, chips…)
  lib/
    backend/           # interface Backend + implémentations Supabase et démo
    ...
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

Voir la section dédiée plus bas : réponses brutes lisibles uniquement par leur auteur (RLS),
calcul côté serveur, le client ne reçoit que des agrégats filtrés par des seuils.

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
