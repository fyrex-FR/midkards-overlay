import { readFileSync } from 'node:fs';
import { normalizeSpot, matchSpot } from './whatnot.js';

const builtin = JSON.parse(readFileSync(new URL('./data/builtin-wheels.json', import.meta.url), 'utf8'));
const SIGLE = /^[A-Z0-9]{2,20}$/;

/* Une roue, quel que soit son origine : { id, nom, custom, equipes:[{sigle, nom, logo}] }. */
export function listWheels(sportsCustom = {}) {
  const absolute = (logo) => (logo && !/^(\/|https?:)/.test(logo) ? `/${logo}` : logo || null);
  const wheels = Object.entries(builtin).map(([id, w]) => ({
    id, nom: w.nom, custom: false, equipes: w.equipes.map((t) => ({ ...t, logo: absolute(t.logo) })),
  }));
  for (const [id, sport] of Object.entries(sportsCustom || {})) {
    if (!sport || !Array.isArray(sport.equipes)) continue;
    wheels.push({
      id: String(id).toLowerCase(), nom: sport.nom || id, custom: true,
      equipes: sport.equipes.map(([sigle, nom, , , logo]) => ({ sigle: String(sigle), nom: String(nom), logo: logo || null })),
    });
  }
  return wheels;
}

/* Compare les titres de spots d'un break a UNE roue. "parfait" = regle des 100 % de Xavier :
   chaque spot reconnu, chaque equipe de la roue a un spot, aucun doublon. */
export function evaluateWheel(titles, wheel) {
  const teams = wheel.equipes.map((t) => ({ sigle: String(t.sigle).toUpperCase(), nom: t.nom }));
  const unique = [...new Set((titles || []).map((t) => String(t).trim()).filter(Boolean))];
  const bySigle = new Map();
  const inconnus = [];
  for (const titre of unique) {
    const sigle = matchSpot(titre, teams);
    if (!sigle) inconnus.push(titre);
    else bySigle.set(sigle, [...(bySigle.get(sigle) || []), titre]);
  }
  const sigles = new Set(teams.map((t) => t.sigle));
  const absentes = [...sigles].filter((s) => !bySigle.has(s)).sort();
  const doublons = [...bySigle].filter(([, list]) => list.length > 1).map(([s]) => s).sort();
  const reconnus = unique.length - inconnus.length;
  return {
    id: wheel.id, nom: wheel.nom, spots: unique.length, equipes: sigles.size, reconnus,
    inconnus, absentes, doublons,
    parfait: unique.length > 0 && !inconnus.length && !absentes.length && !doublons.length,
  };
}

/* Meilleure roue : parfaite d'abord, puis le plus de spots reconnus, puis l'ecart de taille le plus faible.
   Sans titres (break aleatoire : Whatnot n'expose rien avant le tirage), on se rabat sur le nombre. */
export function findBestWheel(titles, total, wheels) {
  const unique = [...new Set((titles || []).map((t) => String(t).trim()).filter(Boolean))];
  if (!unique.length) {
    const fits = wheels.filter((w) => new Set(w.equipes.map((t) => t.sigle)).size === Number(total));
    return fits.length
      ? { id: fits[0].id, nom: fits[0].nom, spots: Number(total), equipes: Number(total), reconnus: Number(total), inconnus: [], absentes: [], doublons: [], parfait: true, mode: 'nombre' }
      : null;
  }
  const scored = wheels.map((w) => evaluateWheel(unique, w));
  scored.sort((a, b) => (b.parfait - a.parfait) || (b.reconnus - a.reconnus)
    || (Math.abs(a.equipes - unique.length) - Math.abs(b.equipes - unique.length)));
  return scored[0] ? { ...scored[0], mode: 'spots' } : null;
}

/* Controle d'une definition de roue AVANT ecriture. Rend la liste des problemes. */
export function validateWheelDefinition(def) {
  const problems = [];
  if (!def || typeof def !== 'object') return ['definition absente'];
  if (!String(def.nom || '').trim()) problems.push('nom absent');
  if (!Array.isArray(def.equipes) || def.equipes.length < 2) return [...problems, 'au moins 2 equipes'];
  const sigles = new Map(); const noms = new Map();
  for (const team of def.equipes) {
    const sigle = String(team.sigle || '').toUpperCase();
    const nomNorm = normalizeSpot(team.nom);
    if (!SIGLE.test(sigle)) problems.push(`sigle invalide : ${team.sigle}`);
    if (!nomNorm) problems.push(`nom absent pour ${sigle}`);
    if (sigles.has(sigle)) problems.push(`sigle en double : ${sigle}`);
    if (nomNorm && noms.has(nomNorm)) problems.push(`nom en double : ${team.nom}`);
    sigles.set(sigle, true); noms.set(nomNorm, sigle);
  }
  // Un nom contenu dans un autre fausse la reconnaissance ("Utah" dans "Utah Jazz" est ok car le plus long gagne,
  // mais deux noms identiques une fois normalises sont indiscernables).
  return problems;
}

/* Reutilisation des logos : meme nom normalise => meme image, dans les roues livrees puis personnalisees. */
export function buildLogoIndex(wheels) {
  const index = new Map();
  for (const wheel of wheels) {
    for (const team of wheel.equipes) {
      const key = normalizeSpot(team.nom);
      if (key && team.logo && !index.has(key)) index.set(key, { logo: team.logo, source: wheel.id });
    }
  }
  return index;
}

export function resolveLogos(def, wheels) {
  const index = buildLogoIndex(wheels);
  return (def.equipes || []).map((team) => {
    const hit = team.logo ? { logo: team.logo, source: 'fourni' } : index.get(normalizeSpot(team.nom));
    return { sigle: String(team.sigle).toUpperCase(), nom: team.nom, logo: hit?.logo || null, source: hit?.source || null };
  });
}
