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

## Charte graphique

- Visuels: `public/assets/` (`logo.png` arbre seul, `wordmark.png` arbre + MIDKARDS, `terre.png` disque arbre, `bandeau*.png`, `arene.jpg`, `deux-pour-un.webp` recolorés en rouge depuis la charte Shaks).
- Couleurs: `public/_moteur/tokens.css` (`--c-*`, `--n-*`) et variables `--sk-*` de `frame.css`.
- Textes, réseaux, ticker: `public/config.js`.
- Le `logo` du bandeau est en mode `static` (arbre dans le médaillon). Remettre `mode: "orbit"` pour le globe `terre.png`.

## Déploiement

Pas encore déployé (repo GitHub, Coolify, Postgres, R2 et domaine à créer avec go explicite de Xavier). Voir le skill `shaks-overlay-card-sourcing` pour le workflow preview puis prod.
