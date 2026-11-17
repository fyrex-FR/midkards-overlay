import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { handleWheelsRoute } from '../src/wheels-api.js';
import { memoryStore } from './helpers-pg.js';

const env = { SHAKS_WHEELS_TOKEN: 'roues', EDIT_TOKEN: 'edit' };
const demo = { nom: 'Demo', equipes: [['AAA', 'Alpha Team', '#000000', '#ffffff', '/api/media/logo/x1'], ['BBB', 'Beta Team', '#000000', '#ffffff', '/api/media/logo/x2']] };

async function withApi(fn, config = { sportsCustom: { demo } }) {
  const store = await memoryStore(config);
  const published = [];
  const server = createServer(async (req, res) => {
    const url = new URL(req.url, 'http://x');
    try {
      if (!(await handleWheelsRoute(req, res, url, { store, env, publish: (s, sections) => published.push(sections) }))) { res.statusCode = 404; res.end(); }
    } catch (error) { res.statusCode = error.status || 500; res.end(JSON.stringify({ error: error.message })); }
  });
  await new Promise((r) => server.listen(0, r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const call = (method, path, body, { token = 'roues', version } = {}) => fetch(`${base}${path}`, {
    method,
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}), ...(version != null ? { 'if-match': `"${version}"` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const version = async () => (await (await fetch(`${base}/api/wheels`)).json()).version;
  try { await fn({ call, store, version, published }); } finally { server.close(); }
}

const nouvelle = { nom: 'Prepare', equipes: [{ sigle: 'ATL', nom: 'Atlanta Hawks' }, { sigle: 'BOS', nom: 'Boston Celtics' }] };

test('GET /api/wheels : livrees et perso, avec version, sans jeton', () => withApi(async ({ call }) => {
  const r = await call('GET', '/api/wheels', undefined, { token: null });
  const body = await r.json();
  assert.ok(body.version >= 1);
  assert.ok(body.wheels.find((w) => w.id === 'nba' && !w.custom));
  assert.ok(body.wheels.find((w) => w.id === 'demo' && w.custom));
}));

test('jetons : validate et ecriture refusent sans jeton ou mauvais jeton', () => withApi(async ({ call, version }) => {
  assert.equal((await call('POST', '/api/wheels/validate', {}, { token: null })).status, 401);
  assert.equal((await call('POST', '/api/wheels/validate', {}, { token: 'nope' })).status, 401);
  assert.equal((await call('PUT', '/api/wheels/nouvelle', { wheel: nouvelle }, { token: 'nope', version: await version() })).status, 401);
  assert.equal((await call('POST', '/api/wheels/validate', {}, { token: 'edit' })).status, 200);
}));

test('validate : logos reutilises, manquants, 100 %', () => withApi(async ({ call }) => {
  const wheel = { nom: 'P', equipes: [{ sigle: 'ATL', nom: 'Atlanta Hawks' }, { sigle: 'XXX', nom: 'Nouvelle Equipe' }] };
  const ok = await (await call('POST', '/api/wheels/validate', { wheel, spots: ['Atlanta Hawks', 'Nouvelle Equipe'] })).json();
  assert.equal(ok.evaluation.parfait, true);
  assert.deepEqual(ok.logosManquants, ['Nouvelle Equipe']);
  assert.match(ok.logos[0].logo, /^\/assets\/logos\/nba\/ATL/);
  const ko = await (await call('POST', '/api/wheels/validate', { wheel, spots: ['Atlanta Hawks', 'Univ Men'] })).json();
  assert.deepEqual(ko.evaluation.inconnus, ['Univ Men']);
}));

test('ecriture : exige If-Match, cree la roue avec logos reutilises, publie, historise', () => withApi(async ({ call, version, published, store }) => {
  assert.equal((await call('PUT', '/api/wheels/prepare', { wheel: nouvelle })).status, 428);
  const v = await version();
  const r = await call('PUT', '/api/wheels/prepare', { wheel: nouvelle, spots: ['Atlanta Hawks', 'Boston Celtics'] }, { version: v });
  assert.equal(r.status, 200);
  const stored = (await store.getState()).config.sportsCustom.prepare;
  assert.equal(stored.nom, 'Prepare');
  assert.match(stored.equipes[0][4], /^\/assets\/logos\/nba\/ATL/);
  assert.deepEqual(published.at(-1), ['sportsCustom']);
  assert.equal((await store.wheelHistory('prepare')).length, 1);
  assert.ok((await store.getState()).config.sportsCustom.demo, 'les autres roues ne sont pas touchees');
}));

test('conflit de version : 412 et rien d\'ecrase', () => withApi(async ({ call, version, store }) => {
  const v = await version();
  assert.equal((await call('PUT', '/api/wheels/prepare', { wheel: nouvelle }, { version: v })).status, 200);
  const stale = await call('PUT', '/api/wheels/autre', { wheel: nouvelle }, { version: v });
  assert.equal(stale.status, 412);
  assert.equal((await store.getState()).config.sportsCustom.autre, undefined);
}));

test('refus : roue livree, logo manquant, 100 % non atteint, definition invalide', () => withApi(async ({ call, version }) => {
  assert.equal((await call('PUT', '/api/wheels/nba', { wheel: nouvelle }, { version: await version() })).status, 409);
  const inconnue = { nom: 'X', equipes: [{ sigle: 'ZZ', nom: 'Equipe Zero' }, { sigle: 'YY', nom: 'Equipe Un' }] };
  const manque = await call('PUT', '/api/wheels/x1', { wheel: inconnue }, { version: await version() });
  assert.equal(manque.status, 422);
  assert.deepEqual((await manque.json()).logosManquants, ['Equipe Zero', 'Equipe Un']);
  assert.equal((await call('PUT', '/api/wheels/x1', { wheel: inconnue, allowMissingLogos: true }, { version: await version() })).status, 200);
  const partiel = await call('PUT', '/api/wheels/p1', { wheel: nouvelle, spots: ['Atlanta Hawks', 'Univ Men'] }, { version: await version() });
  assert.equal(partiel.status, 422);
  assert.equal((await call('PUT', '/api/wheels/p2', { wheel: { nom: '', equipes: [] } }, { version: await version() })).status, 422);
}));

test('suppression et retour arriere via l\'historique', () => withApi(async ({ call, version, store }) => {
  assert.equal((await call('DELETE', '/api/wheels/demo', undefined, { version: await version() })).status, 200);
  assert.equal((await store.getState()).config.sportsCustom.demo, undefined);
  const hist = await (await call('GET', '/api/wheels/demo/history')).json();
  assert.equal(hist.historique[0].action, 'delete');
  const back = await call('POST', '/api/wheels/demo/restore', { historyId: hist.historique[0].id }, { version: await version() });
  assert.equal(back.status, 200);
  assert.equal((await store.getState()).config.sportsCustom.demo.nom, 'Demo');
}));
