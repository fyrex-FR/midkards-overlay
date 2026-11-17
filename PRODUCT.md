# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Le breaker** : ouvre les cartes en direct sur Whatnot. Selon les lives, il pilote aussi la régie lui-même, souvent d'une main, entre deux packs.
- **Le régisseur** : sur certains lives, une deuxième personne pilote la régie, les réglages et les cartes pendant que le breaker est à l'écran.
- **Les spectateurs** : acheteurs et curieux qui regardent le live Whatnot, surtout sur téléphone, avec l'interface Whatnot (chat, icônes, fiche du break) par-dessus l'image. Ils ne touchent jamais l'appli : ils voient seulement l'overlay dans le flux.

## Product Purpose

Habillage live de **MidKards**, une chaîne de breaks de cartes à collectionner (NBA, TCG, sport cards, collector's items) sur Whatnot et Voggt. L'appli fournit :

- l'overlay diffusé dans OBS : cadre, bandeau, grille des spots (« la roue »), bandeau des breaks Whatnot, fanion 2 POUR 1, infographie des cartes, animation du spot attribué ;
- les pages de pilotage : Roue spot (régie), Réglages, Cartes, Éditeur de roue.

Le live réussit quand l'overlay tient sans incident, que les spectateurs comprennent d'un coup d'œil sur leur téléphone quels spots restent et qui vient d'en avoir un, que chaque vente fait réagir le chat, et que la régie ne ralentit jamais le breaker.

## Positioning

Un habillage fait sur mesure pour un break Whatnot en vertical : la grille des spots suit automatiquement les ventes du live Whatnot du compte @midkards, et chaque spot attribué devient un moment de show, avec le ton drôle propre à la chaîne.

## Operating Context

- **Diffusion** : Whatnot uniquement, canvas OBS vertical 1080 × 1920. Le téléphone du spectateur rogne les côtés, et l'interface Whatnot couvre le haut, le bas (chat, fiche du break) et une colonne d'icônes à droite.
- **Rendu** : les pages `cadre` et `fond` sont des sources navigateur OBS, un Chromium embarqué (CEF) plus capricieux que Chrome. Les filtres sur éléments animés, la 3D et le texte en dégradé y ont déjà produit des artefacts. Ces sources se rechargent seules après une mise en ligne.
- **Pilotage** : Roue spot (régie), Réglages, Cartes et Éditeur de roue, ouverts dans un navigateur de bureau, Chrome ou Safari, pendant le live. Les changements arrivent dans OBS en direct, sans rechargement.
- **Rituel d'un break** : choisir la roue (la ligue), suivre le break Whatnot en cours, laisser la synchro cocher les spots vendus (ou les cocher à la main), activer le « 2 pour 1 » jusqu'à un seuil de spots restants, ouvrir les packs.
- **Hébergement** : application Node sur Coolify (PostgreSQL, médias sur Cloudflare R2), DNS Cloudflare proxifié (pas de Worker), sur midkards.cardvaults.app.

## Capabilities and Constraints

- **Roues** livrées : NBA, NBA Whatnot (30 spots, dont UNIV MEN, DEN/UW, MIL/COACH), MLB Allen & Ginter (32), MLB Allen & Ginter Blaster (31, spot combiné CELEB/INS), NFL, plus des sports personnalisés créés dans l'éditeur. Les noms des spots doivent correspondre exactement aux titres des spots Whatnot pour que la synchro les reconnaisse.
- **Logos** : un seul jeu de logos par sport (la roue NBA est la référence de tous les logos NBA). Aucun logo n'est repris d'une autre source quand la référence existe.
- **Synchro Whatnot** : suivi automatique du live en cours, ou du prochain live programmé, du compte @midkards. Pour un break donné, mode automatique (les ventes cochent les spots) ou manuel.
- **Configuration** par sections appliquées à chaud (`randoms`, `punchlines`, `animations`, `card`) ; les autres demandent un rechargement de l'overlay.
- **Contrainte d'encodage** : le flux a très peu de débit par pixel. Aucune animation permanente sur la grille, seulement des animations ponctuelles ou de petite surface.
- **Vocabulaire** : break, spot, roue, régie, spot attribué, « 2 pour 1 », PYT, hit, pull, preset.

## Origine

Copie de shaks-overlay (fyrex-FR/shaks-overlay @ c918ae8) adaptée à la charte MidKards. Les identifiants internes (`window.SHAKS_*`, clés `shaks:` du localStorage, préfixes CSS) sont gardés tels quels pour pouvoir reporter les correctifs de l'overlay Shaks sans conflit; seuls les textes, couleurs et visuels sont MidKards. Les roues livrées (nba-whatnot, mlb-ag, marvel…) viennent de Shaks: à remplacer par les breaks de MidKards au fil des lives.

## Brand Commitments

- **Nom** : MidKards (Instagram @midkards, Whatnot @midkards, Voggt MidKards, liens sur taplink.cc/midkards).
- **Ton** : à définir avec le breaker (les punchlines livrées viennent de Shaks). Punchlines à chaque spot, animations qui font réagir le chat.
- **Couleurs** : bordeaux #984552, encre #1C1A0F, blanc, relevés sur le logo officiel. Rien d'autre : pas de néon, pas de lueurs, pas de dégradés.
- **Direction artistique « carte gradée »** : chaque caméra est une coque blanche à fine bordure d'encre; le bandeau est une étiquette de carte (sceau bordeaux avec l'arbre, wordmark, ligne qui tourne, compteur géant, jauge d'un cran par spot); la grille est faite de cartes blanches qui virent au bordeaux une fois vendues; le spot attribué arrive sur une carte avec tampon VENDU. Typo : Big Shoulders Display (titres, chiffres) et Archivo Narrow (texte). Volontairement différente de l'overlay Shaks.
- **Visuels fournis** : le bandeau « 2 pour 1 » vient du breaker (`public/assets/deux-pour-un.webp`). Les logos UNIV MEN, DEN/UW et MIL/COACH ont aussi été fournis.

## Evidence on Hand

- **Logos des équipes** : `public/assets/logos/` (nba, nba-whatnot, mlb-ag, mlb-ag-blaster, nfl).
- **Visuels** : logo et bandeau dans `public/assets/`, bandeau 2 pour 1 dans `public/assets/deux-pour-un.webp`.
- **Punchlines** : modifiables dans Réglages, stockées dans la section `punchlines`.
- **Absent** : aucun témoignage, chiffre d'audience ni donnée de vente n'est disponible. Ne pas en inventer.

## Product Principles

1. **Le direct d'abord.** Rien ne doit planter, clignoter ou laisser d'artefact pendant un live. En cas de doute, un effet plus sobre qui marche dans OBS vaut mieux qu'un effet plus riche qui risque de casser.
2. **Lisible sur un téléphone, à côté de Whatnot.** Tout ce qui compte se lit en petit, hors des zones couvertes par l'interface Whatnot et des bords rognés.
3. **Chaque vente est un moment.** Le spot attribué doit faire réagir le chat, avec le ton drôle de la chaîne, sans surcharger l'image.
4. **Piloter en une seconde.** La régie se manipule sans réfléchir, d'une main, en plein live, que ce soit le breaker ou un régisseur.
5. **Le breaker décide.** Les nouveautés risquées arrivent désactivables, et rien n'est poussé en ligne sans son accord.

## Origine

Moteur copié de shaks-overlay (c918ae8): API, synchro Whatnot, régie, roues, base. L'habillage est refait pour MidKards (`slab.css`, `label.js`, `spot-anims.*`). Les identifiants internes (`window.SHAKS_*`, clés `shaks:` du localStorage) sont gardés pour pouvoir reporter les correctifs du moteur sans conflit. Les roues livrées (nba-whatnot, mlb-ag, marvel…) viennent de Shaks: à remplacer par les breaks de MidKards.
