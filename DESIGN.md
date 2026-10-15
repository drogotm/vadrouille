---
name: Vadrouille
description: On part où ? L'app qui trouve le week-end qui met tout le monde d'accord.
colors:
  sable: "#FFF4E6"
  sable-profond: "#FBE3C4"
  papier: "#FFFFFF"
  encre: "#231A3A"
  encre-douce: "#544A6B"
  encre-pale: "#8C84A0"
  filet: "#E9DCC8"
  coucher-de-soleil: "#FF5B3A"
  coucher-de-soleil-fonce: "#D9401F"
  coucher-de-soleil-pale: "#FFD9CF"
  soleil: "#FFC83D"
  soleil-pale: "#FFEDB8"
  menthe: "#7BE0B4"
  menthe-pale: "#D9F7EA"
  lagon: "#12A594"
  flamant: "#FF7AB6"
  flamant-pale: "#FFDDEC"
  ciel: "#8CCBFF"
  lavande: "#BBA9FF"
  danger: "#E5484D"
  succes: "#17975F"
typography:
  display:
    fontFamily: "Lilita One"
    fontSize: "40px"
    fontWeight: 400
    lineHeight: 1.1
  headline:
    fontFamily: "Lilita One"
    fontSize: "30px"
    fontWeight: 400
    lineHeight: 1.17
  title:
    fontFamily: "Lilita One"
    fontSize: "21px"
    fontWeight: 400
    lineHeight: 1.24
  body:
    fontFamily: "Nunito"
    fontSize: "16px"
    fontWeight: 600
    lineHeight: 1.44
  body-strong:
    fontFamily: "Nunito"
    fontSize: "16px"
    fontWeight: 800
    lineHeight: 1.44
  caption:
    fontFamily: "Nunito"
    fontSize: "13px"
    fontWeight: 700
    lineHeight: 1.38
  label:
    fontFamily: "Nunito"
    fontSize: "12px"
    fontWeight: 800
    lineHeight: 1.33
    letterSpacing: "1.2px"
rounded:
  sm: "10px"
  md: "16px"
  lg: "22px"
  xl: "30px"
  pill: "999px"
spacing:
  "1": "4px"
  "2": "8px"
  "3": "12px"
  "4": "16px"
  "5": "20px"
  "6": "24px"
  "8": "32px"
components:
  button-primary:
    backgroundColor: "{colors.coucher-de-soleil}"
    textColor: "{colors.papier}"
    typography: "{typography.title}"
    rounded: "{rounded.pill}"
    height: "60px"
    padding: "0 24px"
  button-secondary:
    backgroundColor: "{colors.papier}"
    textColor: "{colors.encre}"
    rounded: "{rounded.pill}"
    height: "50px"
    padding: "0 20px"
  button-dark:
    backgroundColor: "{colors.encre}"
    textColor: "{colors.sable}"
    rounded: "{rounded.pill}"
    height: "50px"
    padding: "0 20px"
  card:
    backgroundColor: "{colors.papier}"
    rounded: "{rounded.lg}"
    padding: "20px"
  tile:
    backgroundColor: "{colors.papier}"
    textColor: "{colors.encre}"
    rounded: "{rounded.lg}"
    padding: "16px"
  tile-selected:
    backgroundColor: "{colors.soleil}"
    textColor: "{colors.encre}"
    rounded: "{rounded.lg}"
  field:
    backgroundColor: "{colors.papier}"
    textColor: "{colors.encre}"
    rounded: "{rounded.md}"
    height: "56px"
    padding: "12px 16px"
  pill:
    textColor: "{colors.encre}"
    typography: "{typography.caption}"
    rounded: "{rounded.pill}"
    padding: "4px 12px"
  weekend-bar:
    backgroundColor: "{colors.papier}"
    textColor: "{colors.encre}"
    rounded: "{rounded.pill}"
    height: "40px"
  weekend-bar-dispo:
    backgroundColor: "{colors.menthe}"
  weekend-bar-peut-etre:
    backgroundColor: "{colors.soleil}"
---

# Design System: Vadrouille

## Overview

**Creative North Star: "La carte postale tamponnée"**

Vadrouille ressemble à une carte postale qu'on s'envoie entre amis : un papier sable chaud, des
contours tracés à l'encre violet nuit, et des aplats de couleurs d'été (soleil, coucher de
soleil, menthe, flamant). Chaque élément qu'on peut toucher est posé sur la page comme un
tampon : contour épais, ombre franche décalée, et quand on appuie, il s'enfonce exactement de la
hauteur de son ombre. C'est ce geste, physique et immédiat, qui rend l'app **ludique**.

L'ambiance est **chaleureuse** : aucun gris froid, aucun bleu d'entreprise. Même le texte
secondaire est une encre violacée, pas un gris neutre. La densité est faible : une question par
écran, de gros boutons, beaucoup d'air, pour un usage à une main sur téléphone, en moins de
2 minutes. La typo est « ronde et ludique » : Lilita One, grasse et arrondie comme un autocollant, porte
les titres ; Nunito, ronde et très lisible, porte tout le reste.

**Key Characteristics:**
- Fond sable, surfaces papier, contours encre de 2,5 px partout.
- Ombres « tampon » décalées sans flou, qui s'écrasent à l'appui.
- Couleurs d'été en aplat, chacune avec un rôle (choix, statut, option de résultat).
- Formes très arrondies : pilules pour les actions, coins de 22 px pour les surfaces.
- Une seule identité, en clair, sur iPhone comme sur le web mobile.

## Colors

Une palette d'été, chaude et saturée, tenue par une seule encre sombre qui dessine tout.

### Primary
- **Coucher de soleil** (#FF5B3A) : l'action principale de chaque écran (« Suivant », « Envoyer
  mes réponses ») et le texte des liens de réservation. Sa version foncée (#D9401F) sert aux
  messages d'alerte douce dans le texte ; sa version pâle (#FFD9CF) aux cartes d'alerte.

### Secondary
- **Soleil** (#FFC83D) : la sélection. Tuile choisie, week-end choisi à la création, carte
  « Best Match », pilules de dates (en version pâle #FFEDB8). C'est la couleur du « oui, ça ».
- **Menthe** (#7BE0B4) : le positif. Week-end « dispo », « dans ton budget », carte « Budget
  Match », décors. Pâle (#D9F7EA) pour les confirmations.

### Tertiary
- **Flamant** (#FF7AB6) : les envies et la carte « Wild Card ». Pâle (#FFDDEC) pour l'invitation
  à organiser.
- **Ciel** (#8CCBFF) : les transports. **Lavande** (#BBA9FF) : le confort.
- **Lagon** (#12A594) : la barre de progression « qui a répondu ».

### Neutral
- **Encre** (#231A3A) : texte principal, tous les contours, toutes les ombres, bouton sombre.
- **Encre douce** (#544A6B) : texte secondaire, légendes.
- **Encre pâle** (#8C84A0) : jours grisés du calendrier, textes indicatifs (placeholders).
- **Sable** (#FFF4E6) : fond de toutes les pages. **Sable profond** (#FBE3C4) : carte
  d'invitation.
- **Papier** (#FFFFFF) : surfaces au repos (cartes, tuiles, champs).
- **Filet** (#E9DCC8) : séparateurs fins et éléments inactifs.

### Named Rules
**La règle une couleur, un sens.** Chaque couleur d'été a un rôle fixe dans tout le parcours
(soleil = choisi, menthe = dispo / OK, flamant = envies et Wild Card). Ne jamais en prendre une
pour décorer : l'utilisateur apprend le code couleur dès la première question.

**La règle pas de gris.** Les textes secondaires et inactifs restent dans la famille de l'encre
violacée, jamais en gris neutre.

## Typography

**Display Font:** Lilita One (une seule graisse, 400, déjà très grasse)
**Body Font:** Nunito (600 pour le texte, 700 pour les légendes, 800 pour l'emphase)

**Character:** « ronde et ludique ». Des titres gras aux formes arrondies, comme un autocollant
collé sur une carte postale ; un texte rond et amical, monté d'un cran de graisse pour tenir face
aux titres. Choisie par Axelle sur rendu réel (15 oct. 2026), après l'essai de Fraunces jugé trop
proche d'un Times ; remplace Bricolage Grotesque + DM Sans.

### Hierarchy
- **Display** (Lilita One, 40 px, 44 px) : le grand titre d'un écran clé (« On part à Annecy ! »).
  Les gros chiffres (budget, taille du groupe) montent jusqu'à 64–88 px.
- **Headline** (Lilita One, 30 px, 35 px) : la question du questionnaire, le titre de chaque étape.
- **Title** (Lilita One, 21 px, 26 px) : titres de cartes, nom des mois du calendrier (20 px).
- **Body** (Nunito 600, 16 px, 23 px) : explications et consignes.
- **Caption** (Nunito 700, 13 px, 18 px) : légendes, mentions « estimation », rappels de confidentialité.
- **Label** (Nunito 800, 12 px, espacement 1,2 px, majuscules) : surtitres de contexte (« Tu organises »).

### Named Rules
**La règle du chiffre roi.** Un montant ou une quantité que l'utilisateur règle (budget, durée,
taille du groupe) s'affiche en Lilita One très grand, centré, au-dessus de son curseur.

## Layout

Mobile d'abord : une colonne, contenu limité à 520 px de large sur le web et la tablette,
marges de 20 px. Une question ou une étape par écran, avec le bouton d'action fixé en bas,
dans la zone du pouce et au-dessus de la barre système. L'espacement suit une échelle de 4 px
(4, 8, 12, 16, 20, 24, 32) : 12 px entre tuiles, 16–24 px entre blocs, 24 px entre les mois du
calendrier.

Les choix multiples se rangent en **grille de 2 colonnes** ; une tuile seule sur sa dernière
ligne garde une demi-largeur. Le calendrier est une grille de 7 colonnes de 46 px de haut,
lundi en premier.

## Elevation & Depth

La profondeur est **structurelle et physique**, pas d'ambiance : une ombre pleine couleur encre,
décalée vers le bas à droite, sans aucun flou, comme l'épaisseur d'un tampon. Elle signale ce
qu'on peut toucher ; la surface « au repos » d'une carte informative peut s'en passer.

### Shadow Vocabulary
- **Tampon léger** (`2px 2px 0 #231A3A`) : tuile ou week-end non choisi.
- **Tampon** (`3–4px 3–4px 0 #231A3A`) : boutons, cartes, tuile ou week-end choisi.
- **Tampon fort** (`5px 5px 0 #231A3A`) : bouton principal de grande taille.

### Named Rules
**La règle de l'enfoncement.** À l'appui, l'élément glisse exactement de la longueur de son
ombre et l'ombre disparaît : il « s'enfonce » dans la page. Jamais d'ombre floue ou colorée.

**La règle plus d'ombre = choisi.** Un élément sélectionné a une ombre plus marquée que ses
voisins non sélectionnés (4 px contre 2 px sur les tuiles).

## Shapes

Tout est franchement arrondi, rien n'est pointu. Pilules (999 px) pour les boutons, les pilules
d'info, les barres de week-end et la barre de progression ; 22 px pour les cartes et les tuiles ;
16 px pour les champs ; 10 px pour les petits éléments. Chaque forme interactive porte le même
contour encre de 2,5 px (2 px sur les pilules et les puces), qui unifie l'ensemble comme un
dessin au feutre.

## Components

### Buttons
- **Shape :** pilule (999 px), contour encre 2,5 px, ombre tampon.
- **Primary :** coucher de soleil, texte papier en Lilita One 18 px, 60 px de haut.
- **Secondary :** papier, texte encre. **Dark :** encre, texte sable. **Ghost :** transparent,
  sans contour ni ombre, pour les actions discrètes (« Modifier »).
- **Appui :** enfoncement de la longueur de l'ombre. **Désactivé :** opacité 45 %.
- **Tailles :** lg 60 px, md 50 px, sm 38 px.

### Chips
- **Pilules d'info :** fond coloré selon le rôle (soleil pâle pour une date, menthe pour « dans
  ton budget »), contour encre 2 px, Nunito 800 13 px.
- **Importance :** trois puces « Négociable / Souhaitable / Indispensable » sous une question ;
  la choisie prend un contour encre (fond encre et texte papier pour « Indispensable »).

### Cards / Containers
- **Corner Style :** 22 px.
- **Background :** papier par défaut ; couleur pâle du rôle pour un message (menthe pâle =
  confirmé, coucher de soleil pâle = blocage, soleil = à toi de jouer).
- **Shadow Strategy :** tampon de 4 px, ou aucune ombre pour une carte purement informative.
- **Border :** encre 2,5 px. **Internal Padding :** 20 px.

### Inputs / Fields
- **Style :** papier, contour encre 2,5 px, coins de 16 px, ombre tampon de 3 px, Nunito 700
  18 px (Lilita One 26 px pour la grande saisie du nom).
- **Error :** contour danger (#E5484D) et message sous le champ.

### Navigation
- **Barre du haut :** bouton retour rond de 44 px (papier, contour encre), titre centré en
  Lilita One 17 px (ex. « 3 / 9 » dans le questionnaire). Pas de barre d'onglets : le
  parcours est linéaire.

### Tuiles de choix (signature)
Le cœur du questionnaire. Grande tuile papier (coins 22 px, contour encre) avec émoji, libellé
en Lilita One et pastille de coche ronde en haut à droite. Choisie, elle prend la couleur de
sa question (soleil, menthe, flamant, ciel, lavande) et une ombre plus forte. Compacte en grille
de 2 colonnes (112 px de haut minimum), large en liste pour les choix avec description.

### Calendrier des week-ends (signature)
Chaque mois s'affiche en entier, du lundi au dimanche. Les jours ordinaires restent visibles mais
très pâles (encre pâle, 25–55 % d'opacité), pour se repérer sans distraire. Chaque week-end
proposé est une **barre pilule vendredi → dimanche** au contour encre, qu'on touche d'un seul
geste : papier si libre, menthe si dispo, soleil si peut-être (ou choisi à la création).
Inactive, elle passe au contour filet sans ombre. Une légende à pastilles explique les touchers.

## Do's and Don'ts

### Do:
- **Do** dessiner chaque élément touchable avec le contour encre (2,5 px) et une ombre tampon
  décalée sans flou.
- **Do** donner à chaque couleur d'été un seul rôle, le même du début à la fin du parcours.
- **Do** garder une question par écran, le bouton principal en bas, et des zones tactiles d'au
  moins 44 px.
- **Do** afficher les montants et durées réglables en Lilita One très grand.
- **Do** signaler chaque prix ou durée comme une estimation, en légende.

### Don't:
- **Don't** utiliser d'ombre floue, de dégradé de texte ou d'effet de verre : la profondeur vient
  uniquement du tampon.
- **Don't** introduire de gris neutre ou de couleur froide hors de la palette.
- **Don't** laisser une tuile seule s'étirer sur toute la largeur d'une grille.
- **Don't** utiliser une couleur d'été pour décorer : elle porte toujours un sens.
