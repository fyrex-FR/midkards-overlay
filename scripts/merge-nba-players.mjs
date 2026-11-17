/* Ajoute les joueurs d'une nouvelle saison a src/data/nba-ids.json, qui sert
   a trouver la photo nba.com d'un joueur (src/cards.js).

   nba.com refuse les requetes hors navigateur. La liste se recupere donc
   depuis un navigateur ouvert sur https://www.nba.com/players, dans la
   console :

     copy(JSON.stringify(JSON.parse(document.getElementById('__NEXT_DATA__')
       .textContent).props.pageProps.players
       .map(p => [p.PERSON_ID, `${p.PLAYER_FIRST_NAME} ${p.PLAYER_LAST_NAME}`.trim()])))

   puis, le resultat colle dans un fichier :

     node scripts/merge-nba-players.mjs joueurs.json

   Les anciens joueurs restent (legendes, retraites) : on ajoute seulement
   les couples (id, nom) absents. Un joueur qui change d'orthographe garde
   les deux noms, et les deux menent a la meme photo. */
import { readFileSync, writeFileSync } from 'node:fs';

const source = process.argv[2];
if (!source) {
  console.error('usage : node scripts/merge-nba-players.mjs <joueurs.json>');
  process.exit(1);
}

const cible = new URL('../src/data/nba-ids.json', import.meta.url);
const data = JSON.parse(readFileSync(cible, 'utf8'));
const nouveaux = JSON.parse(readFileSync(source, 'utf8'));

const connus = new Set(data.players.map(([id, nom]) => `${id}|${nom}`));
let ajoutes = 0;
for (const entree of nouveaux) {
  const [id, nom] = entree;
  if (!Number.isInteger(id) || typeof nom !== 'string' || !nom.trim()) continue;
  const cle = `${id}|${nom.trim()}`;
  if (connus.has(cle)) continue;
  connus.add(cle);
  data.players.push([id, nom.trim()]);
  ajoutes += 1;
}

writeFileSync(cible, JSON.stringify(data));
console.log(`${ajoutes} joueurs ajoutes, ${data.players.length} au total`);
