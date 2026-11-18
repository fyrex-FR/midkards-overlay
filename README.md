# MidKards Overlay

Overlay OBS vertical (1080x1920) pour les lives Whatnot/Voggt de MidKards. Copie de shaks-overlay (c918ae8) à la charte MidKards: noir, rouge cramoisi, arbre blanc.

## Architecture

- Node.js sert les assets, l'API REST et le flux SSE `/api/events`.
- PostgreSQL conserve la configuration JSON versionnée et les métadonnées médias.
- Cloudflare R2 conserve les médias immuables (bucket/préfixe dédiés MidKards).
- Pas de Worker Cloudflare: l'appli est exposée directement par Coolify.
- URLs OBS: `/cadre` (haut) et `/fond` (bas). Admin: `/reglages`, `/regie`, `/sports`, `/cartes`, `/dbtk`.

## Développement

```bash
cp .env.example .env
npm install
npm test
npm start
```

La base applique automatiquement `migrations/*.sql` au démarrage. Config vide en base = config embarquée `public/config.js`.

`WHATNOT_SELLER=midkards` active la synchro automatique des spots avec le live Whatnot du compte.

## Charte graphique Midkards Break Live

- Charte: « Charte graphique Midkards Break Live » de Mid (bordeaux #2F030E, rouge Midkards #A8112D, rouge lumineux #E21D45 en accent, blancs, champagne #D6AD79), Oswald + Montserrat. Jetons `--mk-*` dans `public/_moteur/slab.css`.
- Habillage: `slab.css` (coques de caméras, étiquette, grille, fiche du break, fiche PYP), `label.js` (étiquette: ligne tournante, compteur, jauge), `spot-anims.js/css` (carte de vente).
- Visuels: `public/assets/` (`arbre-blanc.png`, `arbre.png`, `wordmark.png`, `arene.jpg` fond bordeaux de la charte (arbre en filigrane, courbes rouges), `deux-pour-un.webp` fanion). Logo source: `source-logo-midkards.jpeg`.
- Textes et réseaux: `public/config.js` (`ticker.messages`, `social.items`). Placement: `layout` (étiquette à 24,5 %, caméras en 80 %).
- Les unités de `slab.css` sont en `--p` (1 px d'un canvas 1080 de large).

## Déploiement

Pas encore déployé (repo GitHub, Coolify, Postgres, R2 et domaine à créer avec go explicite de Xavier). Voir le skill `shaks-overlay-card-sourcing` pour le workflow preview puis prod.
