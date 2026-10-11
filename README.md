# Vadrouille — On part où ?

L'app qui trouve le week-end qui met tout le monde d'accord. Un organisateur crée une
Vadrouille, invite sa bande par lien, chacun répond **en privé** à un questionnaire de
2 minutes, et le moteur de décision propose 3 options réellement faisables (🥇 Best Match,
💸 Budget Match, 🔥 Wild Card) sur lesquelles le groupe vote.

## Lancer en local

Prérequis : Node 22+ (`brew install node`).

```bash
npm install
npm run web
```

Sans fichier `.env`, l'app démarre en **mode démo** : tout est stocké sur l'appareil, les amis
sont simulés (bouton « Démo : simuler la bande »), et le calcul utilise le vrai moteur. C'est le
moyen le plus rapide de parcourir tout le produit.

## Tester sur le simulateur iOS

1. Installer **Xcode** depuis le Mac App Store, l'ouvrir une fois pour installer la plateforme iOS.
2. Pointer les outils en ligne de commande dessus :
   ```bash
   sudo xcode-select -s /Applications/Xcode.app/Contents/Developer
   ```
3. Lancer :
   ```bash
   npm run ios
   ```
   Expo ouvre le simulateur et installe Expo Go. Le projet n'utilise que des modules inclus
   dans Expo Go : aucun build natif n'est nécessaire pour tester.

> ⚠️ Le chemin du projet contient des espaces (`Claude Code/Mon 1er site web`). Expo Go s'en
> accommode, mais un build natif (`npx expo run:ios`) peut échouer : déplace alors le dossier.

## Variables d'environnement

`cp .env.example .env`, puis :

| Variable | Rôle |
|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | URL du projet Supabase |
| `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Clé **publique** (jamais la `service_role`) |
| `EXPO_PUBLIC_WEB_URL` | Domaine de la version web : liens d'invitation `https://…/i/<code>` et universal links |
| `EXPO_PUBLIC_APP_STORE_URL` | Lien App Store proposé aux invités web (vide = masqué) |
| `EXPO_PUBLIC_DEMO_MODE` | `1` force le mode démo |

Secrets serveur (jamais dans `.env`, jamais dans le dépôt) :

```bash
npx supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
```

`ANTHROPIC_API_KEY` est optionnelle : sans elle, les accroches viennent du seed.

## Brancher le vrai backend (Supabase)

```bash
npx supabase login
npx supabase link --project-ref <ref>
npx supabase db push
npx supabase functions deploy compute-results
```

Dans le dashboard : **Authentication → Sign In / Providers → activer « Anonymous sign-ins »**,
et régler les modèles d'email sur ceux de `supabase/templates/` (code à 6 chiffres).

## Version web (parcours invité)

```bash
npm run build:web
```

Produit un site statique dans `dist/` (SPA). L'hébergeur doit réécrire toutes les routes vers
`index.html` (Vercel, Netlify, Cloudflare Pages savent le faire).

## Tests

```bash
npm run verify
```

Typecheck + 68 tests + scan de secrets (lancé aussi avant chaque `git push`) :

- `tests/engine` — moteur : groupes fictifs, équité, filtres durs, cas limites, confidentialité des agrégats, intégrité du seed ;
- `tests/db` — RLS sur un vrai Postgres embarqué (PGlite) : personne, organisateur compris, ne lit les réponses d'un autre ;
- `tests/e2e` — parcours complet d'un groupe de 5 : création → invitation → réponses → calcul → vote → plan.

`npm run check:functions` type-check l'Edge Function avec Deno.

## Où modifier quoi

| Je veux… | Fichier |
|---|---|
| Ajouter / corriger une destination | `supabase/functions/_shared/data/destinations.ts` |
| Ajuster trajets, coûts, climat | `data/routes.ts`, `data/costs.ts` (même dossier) |
| Régler le moteur (poids, seuils) | `supabase/functions/_shared/engine/config.ts` |
| Changer couleurs et typo | `src/theme/tokens.ts` |
| Modifier un écran | `src/app/` et `src/features/` |

Toutes les valeurs chiffrées sont des **estimations**, signalées comme telles dans l'app.

## Décisions prises

Détaillées et justifiées dans [CLAUDE.md](CLAUDE.md). Les principales :

- **Mode démo** intégré, pour voir tout le parcours sans backend.
- **Compte léger** : connexion anonyme + prénom ; email optionnel ensuite. Un invité répond depuis le lien sans rien installer.
- **Confidentialité** : RLS stricte, calcul côté serveur, aucun agrégat publié sous 4 membres présents.
- **Match Score** = 0,7 × moyenne + 0,3 × membre le moins bien servi.
- **Claude** ne rédige que l'accroche, à partir d'agrégats déjà filtrés ; jamais de score.
- **Pas de temps réel** au MVP : rafraîchissement toutes les 4 s.

## Reste à faire

Bloqué tant qu'un humain ne l'a pas fait :

- [ ] Installer Xcode et tester sur le simulateur iOS (jamais fait à ce jour — seule la version web a été vérifiée).
- [ ] Créer / choisir le projet Supabase, pousser les migrations, déployer la fonction, activer la connexion anonyme. **Le backend réel n'a jamais tourné contre l'app** : il est couvert par les tests PGlite et le type-check Deno, pas par un essai réel.
- [ ] Fournir la clé `ANTHROPIC_API_KEY` (l'appel Claude est type-checké, jamais exécuté).
- [ ] Héberger la version web et renseigner `EXPO_PUBLIC_WEB_URL`.

Ensuite :

- [ ] Universal links iOS : servir `/.well-known/apple-app-site-association` sur le domaine web.
- [ ] Icône, splash et captures d'écran définitifs ; build EAS et soumission App Store.
- [ ] Notifications (« les 3 options sont prêtes », relances).
- [ ] Remplacer les estimations par des sources réelles (l'interface `Catalog` est prévue pour).
- [ ] Hors périmètre MVP, non commencé : réservation, paiement, Vadrouille Pass, partage des dépenses.
