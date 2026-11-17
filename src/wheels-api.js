import { readJson, sendJson } from './http.js';
import { wheelsAuthorized } from './security.js';
import { evaluateWheel, findBestWheel, listWheels, resolveLogos, validateWheelDefinition } from './wheels.js';

const noStore = { 'cache-control': 'no-store' };
const WHEEL_ID = /^[a-z0-9][a-z0-9-]{1,39}$/;
const COLORS = ['#172554', '#38bdf8'];

function fail(response, status, error, extra = {}) {
  sendJson(response, status, { error, ...extra }, noStore);
  return true;
}

function ifMatch(request) {
  const raw = String(request.headers['if-match'] || '').replace(/^W\//, '').replace(/"/g, '').trim();
  return /^\d+$/.test(raw) ? Number(raw) : null;
}

const toStored = (team, logo) => [
  String(team.sigle).toUpperCase(), String(team.nom).trim(),
  /^#[0-9a-f]{6}$/i.test(team.c1 || '') ? team.c1 : COLORS[0],
  /^#[0-9a-f]{6}$/i.test(team.c2 || '') ? team.c2 : COLORS[1],
  logo,
];

/* Routes /api/wheels*. Rend true si la requete est traitee.
   deps : { store, publish(state, sections), env }. Les ecritures exigent If-Match (version de la config). */
export async function handleWheelsRoute(request, response, url, { store, publish = () => {}, env = process.env }) {
  const path = url.pathname;
  if (!path.startsWith('/api/wheels')) return false;
  const state = async () => (await store.getState()) || { config: {}, version: 0 };

  if (path === '/api/wheels') {
    if (!['GET', 'HEAD'].includes(request.method)) return fail(response, 405, 'methode non autorisee');
    const current = await state();
    return sendJson(response, 200, { version: current.version, wheels: listWheels(current.config.sportsCustom) },
      { ...noStore, etag: `"${current.version}"` }) || true;
  }

  if (path === '/api/wheels/validate') {
    if (request.method !== 'POST') return fail(response, 405, 'methode non autorisee');
    if (!wheelsAuthorized(request, env)) return fail(response, 401, 'jeton invalide');
    const body = await readJson(request);
    const wheels = listWheels((await state()).config.sportsCustom);
    const spots = Array.isArray(body.spots) ? body.spots.map(String).slice(0, 500) : [];
    const result = { spots: spots.length };
    if (body.wheel) {
      result.problemes = validateWheelDefinition(body.wheel);
      if (!result.problemes.length) {
        result.logos = resolveLogos(body.wheel, wheels);
        result.logosManquants = result.logos.filter((l) => !l.logo).map((l) => l.nom);
        if (spots.length) result.evaluation = evaluateWheel(spots, asWheel('proposition', body.wheel));
      }
    } else {
      result.meilleure = findBestWheel(spots, Number(body.total) || 0, wheels);
    }
    return sendJson(response, 200, result, noStore) || true;
  }

  const match = /^\/api\/wheels\/([a-z0-9-]+)(?:\/(history|restore))?$/.exec(path);
  if (!match) return false;
  const [, id, sub] = match;
  if (!wheelsAuthorized(request, env)) return fail(response, 401, 'jeton invalide');
  if (!WHEEL_ID.test(id)) return fail(response, 400, 'identifiant invalide (2 a 40 caracteres : a-z, 0-9, tiret)');
  const all = listWheels((await state()).config.sportsCustom);
  const existing = all.find((w) => w.id === id);
  if (existing && !existing.custom) return fail(response, 409, 'roue livree avec l\'overlay : lecture seule');

  if (sub === 'history') {
    if (request.method !== 'GET') return fail(response, 405, 'methode non autorisee');
    return sendJson(response, 200, { historique: await store.wheelHistory(id) }, noStore) || true;
  }

  if (!['PUT', 'DELETE', 'POST'].includes(request.method) || (sub === 'restore') !== (request.method === 'POST')) {
    return fail(response, 405, 'methode non autorisee');
  }
  const version = ifMatch(request);
  if (version === null) return fail(response, 428, 'If-Match requis : version lue sur GET /api/wheels');

  let mutate; let action = 'put';
  if (request.method === 'DELETE') {
    if (!existing) return fail(response, 404, 'roue inconnue');
    mutate = () => null; action = 'delete';
  } else if (request.method === 'POST') {
    const body = await readJson(request);
    const entry = await store.wheelHistoryEntry(id, Number(body.historyId));
    if (!entry) return fail(response, 404, 'entree d\'historique inconnue');
    mutate = () => entry.before; action = 'restore';
  } else {
    const body = await readJson(request);
    const def = body.wheel;
    const problemes = validateWheelDefinition(def);
    if (problemes.length) return fail(response, 422, 'roue invalide', { problemes });
    const logos = resolveLogos(def, all.filter((w) => w.id !== id));
    const manquants = logos.filter((l) => !l.logo).map((l) => l.nom);
    if (manquants.length && !body.allowMissingLogos) return fail(response, 422, 'logos manquants', { logosManquants: manquants });
    if (Array.isArray(body.spots) && body.spots.length) {
      const evaluation = evaluateWheel(body.spots.map(String), asWheel(id, def));
      if (!evaluation.parfait) return fail(response, 422, 'la roue ne couvre pas les spots a 100 %', { evaluation });
    }
    mutate = () => ({ nom: String(def.nom).trim().slice(0, 60), equipes: def.equipes.map((t, i) => toStored(t, logos[i].logo || '')) });
  }

  const result = await store.mutateWheel(id, mutate, { expectedVersion: version, action });
  if (result.error === 'conflict') return fail(response, 412, 'la configuration a change depuis ta lecture : relis GET /api/wheels', { version: result.version });
  if (result.error === 'empty') return fail(response, 409, 'aucune configuration enregistree');
  publish(result.state, ['sportsCustom']);
  return sendJson(response, 200, { ok: true, action, id, version: result.state.version }, noStore) || true;
}

function asWheel(id, def) {
  return { id, nom: String(def.nom || ''), equipes: def.equipes.map((t) => ({ sigle: String(t.sigle).toUpperCase(), nom: t.nom })) };
}
