import { randomBytes } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MEDIA_ID, MEDIA_SLOTS, SECTIONS, isObject, normalizeName } from './config.js';
import { CardError, CardsService } from './cards.js';
import { EventHub } from './events.js';
import { buildFromSpots, buildList, memeListe, parseBoites } from './pyp.js';
import { readBody, readJson, sendJson } from './http.js';
import { MediaStorage } from './media.js';
import { authorized, previewWhatnotOpen, wheelsAuthorized } from './security.js';
import { handleWheelsRoute } from './wheels-api.js';
import { codeVersion } from './build.js';
import { serveStatic } from './static.js';
import { Store } from './store.js';
import { WhatnotClient } from './whatnot.js';
import { WhatnotSync } from './whatnot-sync.js';

const required = [
  'DATABASE_URL', 'EDIT_TOKEN', 'R2_ENDPOINT', 'R2_ACCESS_KEY_ID',
  'R2_SECRET_ACCESS_KEY', 'R2_BUCKET',
];
for (const name of required) {
  if (!process.env[name]) throw new Error(`Variable requise absente : ${name}`);
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const publicDir = path.join(root, 'public');
const store = new Store(process.env.DATABASE_URL);
const mediaStorage = new MediaStorage({
  endpoint: process.env.R2_ENDPOINT,
  accessKeyId: process.env.R2_ACCESS_KEY_ID,
  secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  bucket: process.env.R2_BUCKET,
  prefix: process.env.R2_PREFIX || 'media',
});
const build = await codeVersion(publicDir);
const events = new EventHub(build);
const cards = new CardsService();
const migrationsDir = path.join(root, 'migrations');
for (const filename of (await readdir(migrationsDir)).filter((name) => name.endsWith('.sql')).sort()) {
  await store.migrate(await readFile(path.join(migrationsDir, filename), 'utf8'));
}

const whatnotSync = new WhatnotSync({
  store,
  client: new WhatnotClient(),
  // Compte suivi automatiquement. Vide (WHATNOT_SELLER=) = suivi desactive.
  seller: (process.env.WHATNOT_SELLER ?? 'midkards').trim() || null,
  applyRandoms: async (soldSigles, selectionSigle, buyers = null) => {
    const current = await store.getState();
    if (!current) return;
    const randoms = { ...(current.config.randoms || {}), pris: soldSigles };
    // Pseudo Whatnot de l'acheteur de chaque spot : la fiche PYP l'affiche.
    if (buyers) randoms.acheteurs = buyers;
    if (selectionSigle) {
      randoms.selection = {
        sigle: selectionSigle,
        id: `whatnot-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
        at: Date.now(),
      };
    }
    const state = await store.replaceSection('randoms', randoms);
    events.publish(state, ['randoms']);
  },
  /* DBTK : le spot passe en enchere sur Whatnot devient le joueur affiche.
     Seulement si l'overlay est sur le DBTK et que la regie n'a pas coupe
     le suivi (randoms.pypAuto === false). */
  applyEnchere: async (sigle) => {
    const current = await store.getState();
    const randoms = current?.config?.randoms;
    if (!randoms || String(randoms.ligue || '').toLowerCase() !== 'pyp') return;
    if (randoms.pypAuto === false || randoms.pyp?.courant === sigle) return;
    const state = await store.replaceSection('randoms', { ...randoms, pyp: { courant: sigle, at: Date.now(), auto: true } });
    events.publish(state, ['randoms']);
  },
});

function methodNotAllowed(response, allow) {
  sendJson(response, 405, { error: 'methode non autorisee' }, { allow });
}

/* Le break PYP : la liste des joueurs et les boites ouvertes. La liste vient
   du break Whatnot (breakId : ses spots, lus en direct) ou du CSV des spots
   (csv). Sans l'un ni l'autre, seules les boites et le nom changent.
   inchange : meme liste qu'avant, les ventes deja cochees restent bonnes. */
async function handlePyp(request, response) {
  return importPyp(await readJson(request, 2 * 1024 * 1024), response);
}

/* Aussi joignable par PUT /api/whatnot { action: 'pyp', … } : le Worker
   Cloudflare (edge/) ne transmet le jeton qu'aux routes qu'il protege, et
   /api/whatnot en fait partie depuis le debut. */
async function importPyp(body, response) {
  const current = await store.getState();
  if (!current) return sendJson(response, 409, { error: 'aucune configuration enregistree' });
  const before = current.config.pyp || {};
  const next = { ...before };
  let ignores = [];
  let built = null;
  if (body.breakId != null && body.breakId !== '') {
    let spots;
    try {
      spots = await whatnotSync.breakSpots(body.breakId);
    } catch (error) {
      return sendJson(response, error.status || 502, { error: error.message });
    }
    built = buildFromSpots(spots);
    if (!built.liste.length) return sendJson(response, 400, { error: 'aucun spot joueur reconnu dans ce break Whatnot' });
  } else if (typeof body.csv === 'string') {
    built = buildList(body.csv);
    if (!built.liste.length) return sendJson(response, 400, { error: 'aucun spot PYP reconnu dans ce fichier' });
  }
  if (built) {
    next.liste = built.liste;
    ignores = built.ignores;
  }
  if (typeof body.boites === 'string') next.boites = parseBoites(body.boites);
  if (typeof body.nom === 'string') next.nom = body.nom.trim().slice(0, 60);
  if (!Array.isArray(next.liste) || !next.liste.length) return sendJson(response, 400, { error: 'choisis d’abord le break Whatnot du DBTK' });
  const state = await store.replaceSection('pyp', next);
  events.publish(state, ['pyp']);
  return sendJson(response, 200, {
    ok: true,
    joueurs: next.liste.length,
    sansPhoto: next.liste.filter((j) => !j.p && !j.eq).map((j) => j.n),
    equipes: next.liste.filter((j) => j.eq).length,
    ignores,
    inchange: memeListe(before.liste, next.liste),
    boites: next.boites || [],
  }, { 'cache-control': 'no-store' });
}

async function handleCards(request, response, url) {
  const noStore = { 'cache-control': 'no-store' };
  if (url.pathname === '/api/cards/checklists') {
    if (!['GET', 'POST'].includes(request.method)) return methodNotAllowed(response, 'GET, POST');
    const list = await cards.checklists();
    return sendJson(response, 200, { checklists: list.items }, noStore);
  }
  if (request.method !== 'POST') return methodNotAllowed(response, 'POST');
  const body = await readJson(request);
  const current = (await store.getState())?.config?.card || {};
  if (url.pathname === '/api/cards/index') {
    const result = await cards.index(body.ids);
    await store.replaceSection('card', { ...current, ids: [...new Set(body.ids)] });
    return sendJson(response, 200, result, noStore);
  }
  if (url.pathname === '/api/cards/show') {
    const data = await cards.build(body.ids, body.kind, String(body.name || ''));
    const active = { ...data, id: `${Date.now().toString(36)}${randomBytes(3).toString('hex')}`, at: Date.now() };
    const state = await store.replaceSection('card', { ...current, ids: [...new Set(body.ids)], active });
    if (!state) return sendJson(response, 409, { error: 'aucune configuration enregistree' });
    events.publish(state, ['card']);
    return sendJson(response, 200, { ok: true, kind: data.kind, name: data.name }, noStore);
  }
  if (url.pathname === '/api/cards/hide') {
    const state = await store.replaceSection('card', { ...current, active: null });
    if (!state) return sendJson(response, 409, { error: 'aucune configuration enregistree' });
    events.publish(state, ['card']);
    return sendJson(response, 200, { ok: true }, noStore);
  }
  if (url.pathname === '/api/cards/presets') {
    const list = Array.isArray(body.presets) ? body.presets.slice(0, 50) : null;
    if (!list) return sendJson(response, 400, { error: 'presets invalides' });
    const presets = list.map((p) => ({
      id: String(p.id || '').slice(0, 40),
      name: String(p.name || '').trim().slice(0, 60),
      ids: [...new Set((Array.isArray(p.ids) ? p.ids : []).map(String))].slice(0, 100),
    })).filter((p) => p.id && p.name);
    const state = await store.replaceSection('card', { ...current, presets });
    if (!state) return sendJson(response, 409, { error: 'aucune configuration enregistree' });
    return sendJson(response, 200, { ok: true, presets }, noStore);
  }
  return sendJson(response, 404, { error: 'introuvable' });
}

async function handleApi(request, response, url) {
  if (url.pathname === '/health') {
    await store.health();
    return sendJson(response, 200, { status: 'ok' }, { 'cache-control': 'no-store' });
  }

  if (url.pathname === '/api/build') {
    if (!['GET', 'HEAD'].includes(request.method)) return methodNotAllowed(response, 'GET, HEAD');
    return sendJson(response, 200, { build }, { 'cache-control': 'no-store' });
  }

  if (url.pathname === '/api/events') {
    if (request.method !== 'GET') return methodNotAllowed(response, 'GET');
    events.add(request, response, await store.getState());
    return;
  }

  if (url.pathname === '/api/whatnot/display') {
    if (!['GET', 'HEAD'].includes(request.method)) return methodNotAllowed(response, 'GET, HEAD');
    return sendJson(response, 200, await whatnotSync.display(), { 'cache-control': 'no-store' });
  }

  if (url.pathname === '/api/pyp') {
    if (request.method !== 'POST') return methodNotAllowed(response, 'POST');
    if (!authorized(request, process.env.EDIT_TOKEN)) return sendJson(response, 401, { error: 'jeton invalide' });
    return handlePyp(request, response);
  }

  const alias = /^\/api\/config\/cards(list|index|show|hide|presets)$/.exec(url.pathname);
  if (alias) url = new URL(`/api/cards/${alias[1] === 'list' ? 'checklists' : alias[1]}`, url);
  if (url.pathname.startsWith('/api/cards/')) {
    if (!authorized(request, process.env.EDIT_TOKEN)) return sendJson(response, 401, { error: 'jeton invalide' });
    try {
      return await handleCards(request, response, url);
    } catch (error) {
      if (error instanceof CardError) return sendJson(response, error.status, { error: error.message });
      throw error;
    }
  }

  if (url.pathname.startsWith('/api/wheels')) {
    const handled = await handleWheelsRoute(request, response, url, { store, publish: (state, sections) => events.publish(state, sections) });
    if (handled) return;
  }

  if (url.pathname === '/api/jeton') {
    if (request.method !== 'GET') return methodNotAllowed(response, 'GET');
    if (!authorized(request, process.env.EDIT_TOKEN)) {
      return sendJson(response, 401, { error: 'jeton invalide' }, { 'cache-control': 'no-store' });
    }
    response.writeHead(204, { 'cache-control': 'no-store' });
    return response.end();
  }

  if (url.pathname === '/api/whatnot') {
    const previewOpen = previewWhatnotOpen(process.env.WHATNOT_PREVIEW_OPEN);
    if (!previewOpen && !authorized(request, process.env.EDIT_TOKEN)) {
      return sendJson(response, 401, { error: 'jeton invalide' }, { 'cache-control': 'no-store' });
    }
    if (request.method === 'GET') {
      return sendJson(response, 200, { ...await whatnotSync.state(), previewOpen }, { 'cache-control': 'no-store' });
    }
    if (request.method !== 'PUT') return methodNotAllowed(response, 'GET, PUT');
    const command = await readJson(request, 2 * 1024 * 1024);
    let result;
    if (command.action === 'connect') result = await whatnotSync.connect(command.url);
    else if (command.action === 'select') result = await whatnotSync.select(command.breakId, command.teams, { wheelSync: command.wheelSync === true, enchere: command.enchere === true });
    else if (command.action === 'detect') result = await whatnotSync.detect(command.breakId, command.leagues);
    else if (command.action === 'force') result = await whatnotSync.force(command.sigle);
    else if (command.action === 'release') result = await whatnotSync.release(command.sigle);
    else if (command.action === 'pause') result = await whatnotSync.setEnabled(false);
    else if (command.action === 'resume') result = await whatnotSync.setEnabled(true);
    else if (command.action === 'wheel-sync') result = await whatnotSync.setWheelSync(command.enabled);
    else if (command.action === 'disconnect') result = await whatnotSync.disconnect();
    else if (command.action === 'stop') result = await whatnotSync.stop();
    else if (command.action === 'auto') result = await whatnotSync.setAuto(command.enabled);
    else if (command.action === 'pyp') return importPyp(command, response);
    else return sendJson(response, 400, { error: 'action Whatnot inconnue' });
    return sendJson(response, 200, { ...result, previewOpen }, { 'cache-control': 'no-store' });
  }

  const sectionRead = url.pathname.match(/^\/api\/([a-zA-Z]+)$/);
  if (sectionRead && SECTIONS.has(sectionRead[1])) {
    if (!['GET', 'HEAD'].includes(request.method)) return methodNotAllowed(response, 'GET, HEAD');
    const state = await store.getState();
    if (!state) return sendJson(response, 404, { empty: true }, { 'cache-control': 'no-store' });
    return sendJson(response, 200, state.config[sectionRead[1]] ?? null, {
      'cache-control': 'no-store',
      'x-overlay-version': String(state.version),
    });
  }

  const sectionWrite = url.pathname.match(/^\/api\/config\/([a-zA-Z]+)$/);
  if (sectionWrite) {
    const section = sectionWrite[1];
    if (!SECTIONS.has(section)) return sendJson(response, 404, { error: `section inconnue : ${section}` });
    if (request.method !== 'PUT') return methodNotAllowed(response, 'PUT');
    const previewRandomsOpen = section === 'randoms'
      && previewWhatnotOpen(process.env.WHATNOT_PREVIEW_OPEN);
    if (!previewRandomsOpen && !authorized(request, process.env.EDIT_TOKEN)) {
      return sendJson(response, 401, { error: 'jeton invalide' });
    }
    const value = await readJson(request);
    if (!isObject(value) && !Array.isArray(value)) {
      return sendJson(response, 400, { error: 'la section doit etre un objet ou un tableau' });
    }
    /* Les acheteurs viennent de la synchro Whatnot, pas de la regie : une
       regie qui renvoie sa copie (perimee) ne doit pas les effacer. Ils
       repartent a zero seulement quand la roue change. */
    if (section === 'randoms' && !('acheteurs' in value)) {
      const before = (await store.getState())?.config?.randoms;
      if (before?.acheteurs && String(before.ligue || '') === String(value.ligue || '')) value.acheteurs = before.acheteurs;
    }
    // Le reglage « suivre l'enchere Whatnot » vient de la page DBTK : la roue
    // spot, qui ne le connait pas, ne doit pas l'effacer en renvoyant sa copie.
    if (section === 'randoms' && isObject(value) && !('pypAuto' in value)) {
      const before = (await store.getState())?.config?.randoms;
      if (before && 'pypAuto' in before) value.pypAuto = before.pypAuto;
    }
    const state = await store.replaceSection(section, value);
    if (!state) return sendJson(response, 409, { error: 'aucune configuration enregistree' });
    events.publish(state, [section]);
    return sendJson(response, 200, { ok: true, section, savedAt: state.updated_at });
  }

  if (url.pathname === '/api/config') {
    if (['GET', 'HEAD'].includes(request.method)) {
      const state = await store.getState();
      if (!state) return sendJson(response, 404, { empty: true }, { 'cache-control': 'no-store' });
      return sendJson(response, 200, state.config, {
        'cache-control': 'no-store',
        etag: `"${state.version}"`,
        'x-overlay-version': String(state.version),
      });
    }
    if (request.method !== 'PUT') return methodNotAllowed(response, 'GET, HEAD, PUT');
    if (!authorized(request, process.env.EDIT_TOKEN)) return sendJson(response, 401, { error: 'jeton invalide' });
    const config = await readJson(request);
    if (!isObject(config) || ![...SECTIONS].some((key) => key in config)) {
      return sendJson(response, 400, { error: 'aucune section reconnue' });
    }
    const previous = await store.getState();
    if (previous?.config?.card) config.card = previous.config.card;
    // La liste PYP ne se change que par /api/pyp : les reglages n'y touchent pas.
    if (previous?.config?.pyp) config.pyp = previous.config.pyp;
    const state = await store.replaceConfig(config);
    const sections = previous
      ? [...new Set([...Object.keys(previous.config), ...Object.keys(config)])]
        .filter((key) => JSON.stringify(previous.config[key]) !== JSON.stringify(config[key]))
      : Object.keys(config);
    events.publish(state, sections);
    return sendJson(response, 200, { ok: true, savedAt: state.updated_at });
  }

  const library = url.pathname.match(/^\/api\/bibliotheque\/([a-z]+)(?:\/([a-z0-9]+))?$/);
  if (library) {
    const [, slot, id] = library;
    const rules = MEDIA_SLOTS[slot];
    if (!rules) return sendJson(response, 404, { error: `emplacement inconnu : ${slot}` });
    // Le jeton roues peut lister et envoyer des LOGOS, rien d'autre (ni fond, ni globe, ni suppression).
    const wheelsLogoCall = slot === 'logo' && !id && ['GET', 'PUT'].includes(request.method);
    if (!(wheelsLogoCall ? wheelsAuthorized(request) : authorized(request, process.env.EDIT_TOKEN))) {
      return sendJson(response, 401, { error: 'jeton invalide' });
    }
    if (id) {
      if (request.method !== 'DELETE') return methodNotAllowed(response, 'DELETE');
      const deleted = await store.getMedia(slot, id);
      if (deleted) {
        await mediaStorage.delete(deleted.object_key);
        await store.deleteMedia(slot, id);
      }
      return sendJson(response, 200, { ok: true });
    }
    if (request.method === 'GET') {
      return sendJson(response, 200, { medias: await store.listMedia(slot) }, { 'cache-control': 'no-store' });
    }
    if (request.method !== 'PUT') return methodNotAllowed(response, 'GET, PUT');
    const contentType = (request.headers['content-type'] || '').split(';')[0].trim();
    if (!rules.types.has(contentType)) {
      return sendJson(response, 415, { error: `type refuse pour ${slot} : ${contentType || 'inconnu'}` });
    }
    const body = await readBody(request, rules.max);
    if (!body.length) return sendJson(response, 400, { error: 'image vide' });
    const generatedId = `${Date.now().toString(36)}${randomBytes(4).toString('hex')}`.slice(0, 40);
    return saveMedia(response, { slot, id: generatedId, body, contentType, request });
  }

  const migrationMedia = url.pathname.match(/^\/api\/migration\/media\/([a-z]+)\/([a-z0-9]+)$/);
  if (migrationMedia) {
    if (request.method !== 'PUT') return methodNotAllowed(response, 'PUT');
    if (!authorized(request, process.env.MIGRATION_TOKEN)) return sendJson(response, 401, { error: 'jeton invalide' });
    const [, slot, id] = migrationMedia;
    const rules = MEDIA_SLOTS[slot];
    if (!rules || !MEDIA_ID.test(id)) return sendJson(response, 400, { error: 'media invalide' });
    const contentType = (request.headers['content-type'] || '').split(';')[0].trim();
    if (!rules.types.has(contentType)) return sendJson(response, 415, { error: 'type refuse' });
    const body = await readBody(request, rules.max);
    if (!body.length) return sendJson(response, 400, { error: 'image vide' });
    return saveMedia(response, { slot, id, body, contentType, request });
  }

  const media = url.pathname.match(/^\/api\/media\/([a-z]+)\/([a-z0-9]+)$/);
  if (media) {
    if (!['GET', 'HEAD'].includes(request.method)) return methodNotAllowed(response, 'GET, HEAD');
    const [, slot, id] = media;
    if (!MEDIA_SLOTS[slot] || !MEDIA_ID.test(id)) return sendJson(response, 404, { error: 'introuvable' });
    const record = await store.getMedia(slot, id);
    if (!record) return sendJson(response, 404, { error: 'introuvable' });
    const headers = {
      'content-type': record.content_type,
      'content-length': record.byte_size,
      'cache-control': 'public, max-age=31536000, immutable',
      'x-content-sha256': record.sha256,
    };
    if (request.method === 'HEAD') {
      response.writeHead(200, headers);
      return response.end();
    }
    const object = await mediaStorage.get(record.object_key);
    response.writeHead(200, headers);
    return object.Body.pipe(response);
  }

  return false;
}

async function saveMedia(response, { slot, id, body, contentType, request }) {
  let requestedName = '';
  try { requestedName = decodeURIComponent(request.headers['x-nom'] || ''); } catch { requestedName = ''; }
  const name = normalizeName(requestedName, slot);
  const createdAt = request.headers['x-created-at'] || new Date().toISOString();
  const stored = await mediaStorage.put(slot, id, body, contentType);
  const entry = {
    slot, id, name, contentType, byteSize: body.length,
    sha256: stored.sha256, objectKey: stored.objectKey, createdAt,
  };
  await store.putMedia(entry);
  return sendJson(response, 200, {
    ok: true, id, nom: name, type: contentType, octets: body.length,
    cree: createdAt, sha256: stored.sha256, url: `/api/media/${slot}/${id}`,
  });
}

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url, `http://${request.headers.host || 'localhost'}`);
    if (url.pathname.startsWith('/api/') || url.pathname === '/health') {
      const handled = await handleApi(request, response, url);
      if (handled !== false) return;
    }
    if (!['GET', 'HEAD'].includes(request.method)) return methodNotAllowed(response, 'GET, HEAD');
    if (await serveStatic(request, response, publicDir, url.pathname)) return;
    sendJson(response, 404, { error: 'introuvable' });
  } catch (error) {
    console.error(error);
    if (!response.headersSent) sendJson(response, error.status || 500, { error: error.status ? error.message : 'erreur interne' });
    else response.destroy();
  }
});

const port = Number(process.env.PORT || 3000);
server.listen(port, '0.0.0.0', () => console.log(`midkards-overlay listening on ${port}`));

async function shutdown() {
  server.close();
  whatnotSync.close();
  await store.close();
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
