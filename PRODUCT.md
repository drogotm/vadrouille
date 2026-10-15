# Product

<!-- impeccable:product-schema 1 -->

## Platform

ios

## Users

Des bandes d'amis de 18 à 35 ans qui veulent partir ensemble un week-end et s'organisent
aujourd'hui sur WhatsApp. Deux rôles :

- **L'organisateur** : il crée la Vadrouille (nom, 2 à 4 week-ends candidats, taille du groupe),
  partage le lien, suit qui a répondu, relance, lance le calcul. Il utilise l'app iPhone.
- **Les invités** : ils ouvrent le lien reçu dans le groupe, souvent depuis WhatsApp, et
  répondent depuis la version web sur leur téléphone, sans installer l'app ni créer de mot de
  passe (un prénom suffit). C'est le point de friction n° 1 : un groupe où 2 personnes sur 7
  ne répondent pas est un groupe bloqué.

## Product Purpose

Aider un groupe à **décider** où partir en week-end, à partir des contraintes et envies privées
de chacun. Organiser un week-end entre potes, c'est 150 messages, des budgets que personne
n'ose dire, trois destinations proposées, deux personnes qui ne répondent pas et personne qui
réserve. Vadrouille remplace ce chaos par un questionnaire individuel de 2 minutes, puis 3
options réellement faisables sur lesquelles le groupe vote.

Le succès : tout le groupe répond, une destination est votée, et chacun sait combien le
week-end lui coûtera depuis sa ville.

## Positioning

Vadrouille n'est pas un comparateur de voyages : Booking aide à réserver, Airbnb à se loger,
Google Maps à chercher ; **Vadrouille aide un groupe à décider**. Son cœur est un moteur de
décision collective déterministe, explicable et équitable (Match Score = 0,7 × satisfaction
moyenne + 0,3 × satisfaction du moins bien servi), qui sort 3 options — 🥇 Best Match,
💸 Budget Match, 🔥 Wild Card — à partir de réponses que personne d'autre ne voit.

## Operating Context

- Le lien d'invitation circule dans un groupe WhatsApp ou iMessage ; on répond dans le métro,
  au bureau, d'une main, en moins de 2 minutes.
- Parcours : création → invitation par lien → questionnaire (une question par écran) → suivi
  de qui a répondu → 3 options → vote anonyme → plan du séjour (budget individuel, liens de
  réservation, suggestions d'activités et de restos).
- Les réponses sont privées : l'organisateur voit qui a répondu, jamais quoi. Le calcul se fait
  côté serveur ; seuls des agrégats sont publiés, et aucun sous 4 membres.

## Capabilities and Constraints

- App Expo (React Native) pour iPhone, la même app exportée en web pour les invités ; Android
  plus tard. Une seule identité visuelle, pensée pour le téléphone.
- Questionnaire : dispos par week-end, ville de départ, budget max, temps de trajet max,
  transports, cadre (mer, montagne, campagne, ville), envies, confort, météo, ambiance ; chaque
  critère peut être réglé négociable / souhaitable / indispensable sans alourdir le parcours.
- Groupes de 2 à 15 personnes ; 40 destinations et 12 villes de départ, avec des prix et
  durées **estimés** (toujours présentés comme des estimations).
- Le score ne vient jamais d'un LLM ; Claude rédige seulement l'accroche d'une option à partir
  de données publiques.
- L'app ne réserve rien elle-même : elle renvoie vers des sites de réservation.
- Un mode démo local (amis fictifs) tourne sans backend.

## Brand Commitments

- Nom : **Vadrouille**, signature « On part où ? ».
- Voix : tutoiement, complice mais **un peu plus posée** que la V1 — moins d'émojis et
  d'argot (« la bande », « les potes » avec parcimonie). Clair et rassurant sur l'argent et la
  confidentialité.

## Evidence on Hand

- Aucun témoignage, utilisateur réel, chiffre d'usage ni partenariat : ne pas en inventer.
- Données de destinations et de trajets : estimations éditables
  (`supabase/functions/_shared/data/`).
- Les accroches et suggestions d'activités sont indicatives, à vérifier avant d'y aller.

## Product Principles

1. **Décider, pas chercher** : chaque écran sert la décision du groupe ; le reste est secondaire.
2. **Zéro friction pour l'invité** : répondre doit prendre moins de 2 minutes, depuis un lien,
   sans compte.
3. **Le privé reste privé** : personne ne voit le budget ou les contraintes d'un autre, et
   l'interface le rappelle là où on hésiterait à répondre honnêtement.
4. **Équitable et explicable** : on montre pourquoi une option est proposée, et on ne sacrifie
   jamais une personne pour la moyenne.
5. **Honnête sur les chiffres** : tout prix ou durée est une estimation affichée comme telle.

## Accessibility & Inclusion

Aucune exigence spécifique établie. Usage à une main sur téléphone ; libellés d'accessibilité
présents sur les contrôles du questionnaire.
