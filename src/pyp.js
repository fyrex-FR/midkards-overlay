/* Pick Your Player : la liste des joueurs d'un break PYP, lue depuis le CSV
   des spots Whatnot (colonne "Spot Name"), par exemple :

     PYP - Cooper Flagg - Dallas Mavericks - 2xAuto 2xRelic 2xCase Hit 3xInsert 2xBase 1xRC

   Chaque joueur devient un spot de la roue "pyp" : le titre complet sert a la
   synchro Whatnot (matchSpot), le reste a la fiche affichee dans l'overlay. */
import { findPlayer, findTeam } from './cards.js';

export const MAX_JOUEURS = 600;

const CATEGORIES = { auto: 0, relic: 1, 'case hit': 2, insert: 3, base: 4, rc: 4 };
// "2xAuto", "1x Case Hit", ou la categorie seule ("Base") : quantite non precisee.
const CARTE = /(?:(\d+)\s*x\s*)?(case hit|auto|relic|insert|base|rc)\b/gi;
// Spot equipe : "Carte équipe - Atlanta Hawks", sans liste de cartes.
const EQUIPE = /^(?:pyp\s+-\s+)?carte\s+[ée]quipe\s+-\s+(.+)$/i;
const queDesCartes = (part) => /(case hit|auto|relic|insert|base|rc)\b/i.test(part)
  && !part.replace(CARTE, '').replace(/[\s,+&]+/g, '').length;

/* CSV minimal : virgules, guillemets doubles, "" pour un guillemet. */
export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  const src = String(text || '').replace(/^﻿/, '');
  for (let i = 0; i < src.length; i += 1) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') { field += '"'; i += 1; }
      else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { row.push(field); field = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i += 1;
      row.push(field); rows.push(row); row = []; field = '';
    } else field += ch;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((cell) => cell.trim()));
}

/* "2xAuto 1xRelic …" -> [auto, relic, case hit, insert, base]. Les cartes RC
   comptent avec la base : cinq cases restent lisibles sur un telephone.
   Une categorie citee sans quantite ("Base") vaut null : presente, nombre
   non annonce. */
export function parseCartes(text) {
  const k = [0, 0, 0, 0, 0];
  for (const [, n, cat] of String(text || '').matchAll(CARTE)) {
    const i = CATEGORIES[cat.toLowerCase()];
    if (n === undefined) k[i] = null;
    else if (k[i] !== null) k[i] += Number(n);
  }
  return k;
}

/* Un titre de spot -> { nom, equipe, rc, k }, ou null s'il ne suit pas le
   format "PREFIXE - Joueur - Equipe - cartes". Un spot equipe ("Carte
   équipe - Equipe") donne eq: true et k: null. */
export function parseSpot(titre) {
  const spotEquipe = String(titre || '').trim().match(EQUIPE);
  if (spotEquipe) return { nom: 'Carte équipe', equipe: spotEquipe[1].trim(), rc: false, k: null, eq: true };
  const parts = String(titre || '').split(/\s+-\s+/).map((p) => p.trim()).filter(Boolean);
  if (parts.length < 3) return null;
  const iCartes = parts.findLastIndex(queDesCartes);
  if (iCartes < 2) return null;
  const equipe = parts[iCartes - 1];
  const debut = /^pyp$/i.test(parts[0]) ? 1 : 0;
  const brut = parts.slice(debut, iCartes - 1).join(' - ');
  if (!brut || !equipe) return null;
  const rc = /\sRC$/i.test(brut);
  return { nom: brut.replace(/\s+RC$/i, '').trim(), equipe, rc, k: parseCartes(parts[iCartes]) };
}

/* "3 Jumbo, 6 Hobby" ou "Jumbo 3" -> [{ nom, n }] */
export function parseBoites(text) {
  return String(text || '').split(/[,;\n]+/).map((part) => {
    const t = part.trim();
    const m = t.match(/^(\d+)\s*x?\s+(.+)$/i) || t.match(/^(.+?)\s*:?\s+x?(\d+)$/i);
    if (!m) return null;
    const [n, nom] = /^\d+$/.test(m[1]) ? [m[1], m[2]] : [m[2], m[1]];
    return { nom: nom.trim().slice(0, 24), n: Math.min(9999, Number(n)) };
  }).filter((b) => b && b.nom && b.n > 0).slice(0, 8);
}

/* Des spots { title, price } -> la liste des joueurs de la roue pyp. Les
   spots viennent du CSV ou, directement, du break Whatnot : ce sont les
   memes titres. */
export function buildFromSpots(spots) {
  const liste = [];
  const ignores = [];
  const vus = new Set();
  for (const item of Array.isArray(spots) ? spots : []) {
    const titre = String(item?.title || '').trim();
    if (!titre || vus.has(titre)) continue;
    const spot = parseSpot(titre);
    if (!spot) { ignores.push(titre); continue; }
    vus.add(titre);
    const joueur = spot.eq ? null : findPlayer(spot.nom);
    const team = findTeam(spot.equipe);
    const prix = item.price === '' || item.price == null ? NaN : Number(item.price);
    liste.push({
      ...(spot.eq ? { eq: true } : {}),
      s: `P${String(liste.length + 1).padStart(3, '0')}`,
      t: titre.slice(0, 160),
      n: spot.nom.slice(0, 60),
      e: spot.equipe.slice(0, 40),
      a: team ? team.abbr : null,
      rc: spot.rc,
      p: joueur ? joueur.id : null,
      k: spot.k,
      d: Number.isFinite(prix) ? prix : null,
    });
    if (liste.length >= MAX_JOUEURS) break;
  }
  return { liste, ignores: ignores.slice(0, 20) };
}

/* Le CSV complet -> la liste des joueurs de la roue pyp. */
export function buildList(csvText) {
  const rows = parseCsv(csvText);
  if (!rows.length) return { liste: [], ignores: [] };
  const entete = rows[0].map((c) => c.trim().toLowerCase());
  const col = Math.max(0, entete.indexOf('spot name'));
  const colPrix = entete.indexOf('price');
  const corps = entete.includes('spot name') ? rows.slice(1) : rows;
  return buildFromSpots(corps.map((row) => ({ title: row[col], price: colPrix >= 0 ? row[colPrix] : null })));
}

/* Meme liste, memes joueurs aux memes sigles : les ventes deja cochees
   restent valables. */
export function memeListe(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
  return a.every((j, i) => j.s === b[i].s && j.t === b[i].t);
}
