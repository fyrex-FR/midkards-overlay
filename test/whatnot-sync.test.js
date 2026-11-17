import test from 'node:test';
import assert from 'node:assert/strict';
import { displayState, WhatnotSync } from '../src/whatnot-sync.js';

const LIVE_ID = '1221167c-8822-4852-9186-7b91866a0010';
const teams = [
  { sigle: 'BOS', nom: 'Boston Celtics' },
  { sigle: 'MIA', nom: 'Miami Heat' },
];

class FakeStore {
  async getWhatnotState() { return this.state ? { state: this.state } : null; }
  async putWhatnotState(state) { this.state = structuredClone(state); return { state: this.state }; }
}

function makeSync(spotsRef, updates) {
  const store = new FakeStore();
  const client = {
    async getLive() {
      return { live: { id: LIVE_ID, title: 'Live' }, breaks: [{ id: 'b1', title: 'Break 1', listingId: 'l1', total: 2, sold: 0 }] };
    },
    async getSpots() { return structuredClone(spotsRef.value); },
  };
  const sync = new WhatnotSync({ store, client, intervalMs: 3_600_000, applyRandoms: async (...args) => updates.push(args.slice(0, 2)) });
  return { store, sync };
}

test('la sélection affiche les ventes sans modifier la roue par défaut', async (t) => {
  const spots = { value: [{ id: '1', title: 'Boston Celtics', sold: true }, { id: '2', title: 'Miami Heat', sold: false }] };
  const updates = [];
  const { sync } = makeSync(spots, updates);
  t.after(() => sync.close());
  await sync.connect(LIVE_ID);
  const state = await sync.select('b1', teams);
  assert.equal(state.enabled, true);
  assert.equal(state.wheelSyncEnabled, false);
  assert.deepEqual(updates, []);
});

test('utilise les compteurs du break quand Whatnot masque les spots pas encore listés', async (t) => {
  const store = new FakeStore();
  const client = {
    async getLive() {
      return { live: { id: LIVE_ID, title: 'Live' }, breaks: [{ id: 'b1', title: 'Break 1', listingId: 'l1', total: 30, sold: 7 }] };
    },
    async getSpots() {
      return Array.from({ length: 7 }, (_, index) => ({ id: String(index), title: 'Boston Celtics', sold: true }));
    },
  };
  const sync = new WhatnotSync({ store, client, intervalMs: 3_600_000, applyRandoms: async () => {} });
  t.after(() => sync.close());
  await sync.connect(LIVE_ID);
  const state = await sync.select('b1', teams);
  assert.deepEqual(state.totals, { total: 30, sold: 7, available: 23 });
  assert.deepEqual((await sync.display()).breaks[0], {
    id: 'b1', title: 'Break 1', status: undefined, total: 30, sold: 7,
  });
});

test('la roue ne suit les ventes qu’après activation explicite', async (t) => {
  const spots = { value: [{ id: '1', title: 'Boston Celtics', sold: true }, { id: '2', title: 'Miami Heat', sold: false }] };
  const updates = [];
  const { sync } = makeSync(spots, updates);
  t.after(() => sync.close());
  await sync.connect(LIVE_ID);
  await sync.select('b1', teams);
  await sync.setWheelSync(true);
  assert.equal((await sync.state()).wheelSyncEnabled, true);
  assert.deepEqual(updates, [[['BOS'], null]]);
});

test('changer de break garde la roue active et pousse la nouvelle grille', async (t) => {
  const store = new FakeStore();
  const spotsByListing = {
    l1: [{ id: '1', title: 'Boston Celtics', sold: true }, { id: '2', title: 'Miami Heat', sold: false }],
    l2: [{ id: '3', title: 'Boston Celtics', sold: false }, { id: '4', title: 'Miami Heat', sold: true }],
  };
  const client = {
    async getLive() {
      return { live: { id: LIVE_ID, title: 'Live' }, breaks: [
        { id: 'b1', title: 'Break 1', listingId: 'l1', total: 2, sold: 1 },
        { id: 'b2', title: 'Break 2', listingId: 'l2', total: 2, sold: 1 },
      ] };
    },
    async getSpots(listingId) { return structuredClone(spotsByListing[listingId]); },
  };
  const updates = [];
  const sync = new WhatnotSync({ store, client, intervalMs: 3_600_000, applyRandoms: async (...args) => updates.push(args.slice(0, 2)) });
  t.after(() => sync.close());
  await sync.connect(LIVE_ID);
  await sync.select('b1', teams);
  await sync.setWheelSync(true);
  const state = await sync.select('b2', teams);
  assert.equal(state.breakId, 'b2');
  assert.equal(state.wheelSyncEnabled, true);
  // La grille du nouveau break est poussee, sans animation pour les spots deja vendus.
  assert.deepEqual(updates, [[['BOS'], null], [['MIA'], null]]);
});

test('une synchro en cours n’écrase pas un choix fait pendant ses appels réseau', async (t) => {
  const store = new FakeStore();
  let pause = null;
  const client = {
    async getLive() {
      return { live: { id: LIVE_ID, title: 'Live' }, breaks: [
        { id: 'b1', title: 'Break 1', listingId: 'l1', total: 2, sold: 0 },
        { id: 'b2', title: 'Break 2', listingId: 'l2', total: 2, sold: 0 },
      ] };
    },
    async getSpots() {
      if (pause) await pause;
      return [{ id: '1', title: 'Boston Celtics', sold: false }, { id: '2', title: 'Miami Heat', sold: false }];
    },
  };
  const sync = new WhatnotSync({ store, client, intervalMs: 3_600_000, applyRandoms: async () => {} });
  t.after(() => sync.close());
  await sync.connect(LIVE_ID);
  await sync.select('b1', teams);

  // Une synchro demarre et reste bloquee sur Whatnot...
  let liberer;
  pause = new Promise((resolve) => { liberer = resolve; });
  const enCours = sync.tick();
  await new Promise((resolve) => setImmediate(resolve));
  // ... pendant que la regie active la roue (sa propre synchro est sautee : une tourne deja).
  await sync.setWheelSync(true);
  pause = null;
  liberer();
  await enCours;

  const state = await sync.state();
  assert.equal(state.breakId, 'b1');
  assert.equal(state.wheelSyncEnabled, true);
});

test('une transition disponible vers vendu ne produit qu’une animation', async (t) => {
  const spots = { value: [{ id: '1', title: 'Boston Celtics', sold: false }, { id: '2', title: 'Miami Heat', sold: false }] };
  const updates = [];
  const { sync } = makeSync(spots, updates);
  t.after(() => sync.close());
  await sync.connect(LIVE_ID);
  await sync.select('b1', teams);
  await sync.setWheelSync(true);
  spots.value[0].sold = true;
  await sync.tick();
  await sync.tick();
  assert.deepEqual(updates, [[[], null], [['BOS'], 'BOS']]);
});

test('une erreur Whatnot conserve le dernier état de grille', async (t) => {
  const store = new FakeStore();
  store.state = { enabled: true, liveId: LIVE_ID, breakId: 'b1', teams, breaks: [{ id: 'b1', listingId: 'l1' }], seenSold: [] };
  const updates = [];
  const sync = new WhatnotSync({
    store,
    intervalMs: 3_600_000,
    client: { async getLive() { throw new Error('Whatnot HTTP 502'); } },
    applyRandoms: async (...args) => updates.push(args.slice(0, 2)),
  });
  t.after(() => sync.close());
  await sync.tick();
  assert.equal(store.state.status, 'error');
  assert.equal(store.state.error, 'Whatnot HTTP 502');
  assert.deepEqual(updates, []);
});

test('l’état public du bandeau ne contient ni URL, ni équipes, ni erreur', () => {
  const display = displayState({ state: {
    liveId: LIVE_ID, enabled: true, live: { title: 'Live' }, breakId: 'b1',
    teams, error: 'secret diagnostic', totals: { total: 2, sold: 1, available: 1 },
    breaks: [{ id: 'b1', title: 'Break', total: 2, sold: 0, listingId: 'private' }],
  } });
  assert.deepEqual(display.breaks, [{ id: 'b1', title: 'Break', status: undefined, total: 2, sold: 1 }]);
  assert.equal(JSON.stringify(display).includes('private'), false);
  assert.equal(JSON.stringify(display).includes('secret diagnostic'), false);
});

test('un spot retiré à la main reste libre malgré les synchros suivantes', async (t) => {
  const spots = { value: [{ id: '1', title: 'Boston Celtics', sold: true }, { id: '2', title: 'Miami Heat', sold: false }] };
  const updates = [];
  const { sync } = makeSync(spots, updates);
  t.after(() => sync.close());
  await sync.connect(LIVE_ID);
  await sync.select('b1', teams);
  await sync.setWheelSync(true);
  updates.length = 0;
  await sync.release('BOS');
  assert.deepEqual(updates.at(-1), [[], null]);
  spots.value[1].sold = true;
  await sync.tick();
  assert.deepEqual(updates.at(-1), [['MIA'], 'MIA']);
  await assert.rejects(() => sync.release('LAL'), /inconnu/);
});

test('un spot forcé à la main reste pris et s\'anime', async (t) => {
  const spots = { value: [{ id: '1', title: 'Boston Celtics', sold: false }, { id: '2', title: 'Miami Heat', sold: false }] };
  const updates = [];
  const { sync } = makeSync(spots, updates);
  t.after(() => sync.close());
  await sync.connect(LIVE_ID);
  await sync.select('b1', teams);
  await sync.setWheelSync(true);
  updates.length = 0;
  await sync.force('MIA');
  assert.deepEqual(updates.at(-1), [['MIA'], 'MIA']);
  spots.value[0].sold = true;
  await sync.tick();
  assert.deepEqual(updates.at(-1), [['BOS', 'MIA'], 'BOS']);
  await sync.release('MIA');
  assert.deepEqual(updates.at(-1), [['BOS'], null]);
  await assert.rejects(() => sync.force('LAL'), /inconnu/);
});

test('le suivi automatique se connecte au live du vendeur et bascule au suivant', async (t) => {
  const store = new FakeStore();
  const LIVE_2 = '2221167c-8822-4852-9186-7b91866a0020';
  let courant = LIVE_ID;
  const client = {
    async findCurrentLive(seller) { assert.equal(seller, 'midkards'); return { id: courant }; },
    async getLive(id) {
      return { live: { id, title: `Live ${id.slice(0, 4)}` }, breaks: [{ id: 'b1', title: 'Break 1', listingId: 'l1', total: 2, sold: 0 }] };
    },
    async getSpots() { return [{ id: '1', title: 'Boston Celtics', sold: false }]; },
  };
  const sync = new WhatnotSync({ store, client, intervalMs: 3_600_000, applyRandoms: async () => {}, seller: 'midkards' });
  t.after(() => sync.close());

  await sync.tick();
  let state = await sync.state();
  assert.equal(state.liveId, LIVE_ID);
  assert.equal(state.auto, true);

  // Le break choisi est garde tant que c'est le meme live.
  await sync.select('b1', teams);
  sync.lastAutoCheck = 0;
  await sync.tick();
  assert.equal((await sync.state()).breakId, 'b1');

  // Le live se termine : bascule sur le suivant.
  courant = LIVE_2;
  sync.lastAutoCheck = 0;
  await sync.tick();
  state = await sync.state();
  assert.equal(state.liveId, LIVE_2);
  assert.equal(state.breakId, null);
});

test('coller un lien à la main coupe le suivi automatique', async (t) => {
  const store = new FakeStore();
  let appels = 0;
  const client = {
    async findCurrentLive() { appels += 1; return { id: '2221167c-8822-4852-9186-7b91866a0020' }; },
    async getLive(id) { return { live: { id, title: 'Live' }, breaks: [] }; },
    async getSpots() { return []; },
  };
  const sync = new WhatnotSync({ store, client, intervalMs: 3_600_000, applyRandoms: async () => {}, seller: 'midkards' });
  t.after(() => sync.close());
  await sync.connect(LIVE_ID);
  assert.equal((await sync.state()).auto, false);
  await sync.tick();
  assert.equal((await sync.state()).liveId, LIVE_ID);
  assert.equal(appels, 0);

  // Recocher le suivi le relance tout de suite.
  await sync.setAuto(true);
  assert.equal((await sync.state()).liveId, '2221167c-8822-4852-9186-7b91866a0020');
  assert.equal(appels, 1);
});

test('suivre un break avec wheelSync active la roue tout de suite', async (t) => {
  const spots = { value: [{ id: '1', title: 'Boston Celtics', sold: true }, { id: '2', title: 'Miami Heat', sold: false }] };
  const updates = [];
  const { sync } = makeSync(spots, updates);
  t.after(() => sync.close());
  await sync.connect(LIVE_ID);
  const state = await sync.select('b1', teams, { wheelSync: true });
  assert.equal(state.wheelSyncEnabled, true);
  assert.deepEqual(updates, [[['BOS'], null]]);
});

test('la détection classe les roues selon les spots reconnus', async (t) => {
  const spots = { value: [{ id: '1', title: 'Boston Celtics', sold: false }, { id: '2', title: 'Miami Heat', sold: false }] };
  const { sync } = makeSync(spots, []);
  t.after(() => sync.close());
  await sync.connect(LIVE_ID);
  const res = await sync.detect('b1', {
    nfl: [{ sigle: 'MIA', nom: 'Miami Dolphins' }],
    nba: [{ sigle: 'BOS', nom: 'Boston Celtics' }, { sigle: 'MIA', nom: 'Miami Heat' }],
    'nba-large': [{ sigle: 'BOS', nom: 'Boston Celtics' }, { sigle: 'MIA', nom: 'Miami Heat' }, { sigle: 'LAL', nom: 'LA Lakers' }],
  });
  assert.equal(res.spots, 2);
  assert.deepEqual(res.classement.map((r) => r.id), ['nba', 'nba-large', 'nfl']);
  assert.equal(res.classement[0].reconnus, 2);
});

test('la détection se rabat sur le nombre de spots quand le break n en expose aucun', async (t) => {
  const { sync } = makeSync({ value: [] }, []);
  t.after(() => sync.close());
  await sync.connect(LIVE_ID);
  const res = await sync.detect('b1', {
    nba: [{ sigle: 'BOS', nom: 'Boston Celtics' }, { sigle: 'MIA', nom: 'Miami Heat' }],
    nfl: [{ sigle: 'MIA', nom: 'Miami Dolphins' }],
  });
  assert.equal(res.spots, 2);
  assert.equal(res.classement[0].id, 'nba');
  assert.equal(res.classement[0].reconnus, 2);
  assert.equal(res.classement[1].reconnus, 0);
});

test('arrêter le break garde le live mais ne suit plus rien', async (t) => {
  const spots = { value: [{ id: '1', title: 'Boston Celtics', sold: true }] };
  const updates = [];
  const { sync } = makeSync(spots, updates);
  t.after(() => sync.close());
  await sync.connect(LIVE_ID);
  await sync.select('b1', teams, { wheelSync: true });
  const state = await sync.stop();
  assert.equal(state.connected, true);
  assert.equal(state.breakId, null);
  assert.equal(state.wheelSyncEnabled, false);
  assert.equal(state.enabled, false);
  // Plus aucune synchro : la grille ne bouge plus.
  spots.value = [{ id: '1', title: 'Boston Celtics', sold: true }, { id: '2', title: 'Miami Heat', sold: true }];
  const avant = updates.length;
  await sync.tick();
  assert.equal(updates.length, avant);
});

test('un break créé après la connexion apparaît sans rien suivre', async (t) => {
  const store = new FakeStore();
  let breaks = [];
  const client = {
    async getLive() { return { live: { id: LIVE_ID, title: 'Live' }, breaks: structuredClone(breaks) }; },
    async getSpots() { return []; },
  };
  const sync = new WhatnotSync({ store, client, intervalMs: 3_600_000, applyRandoms: async () => {} });
  t.after(() => sync.close());
  await sync.connect(LIVE_ID);
  assert.deepEqual((await sync.state()).breaks, []);
  breaks = [{ id: 'b9', title: 'Nouveau break', listingId: 'l9', total: 27, sold: 0 }];
  await sync.tick();
  const state = await sync.state();
  assert.equal(state.breaks.length, 1);
  assert.equal(state.breaks[0].id, 'b9');
  assert.equal(state.breakId, null);
});

test('la synchro transmet le pseudo Whatnot de chaque acheteur', async (t) => {
  const spots = { value: [{ id: '1', title: 'Boston Celtics', sold: true, buyer: 'cardking93' }, { id: '2', title: 'Miami Heat', sold: false, buyer: null }] };
  const calls = [];
  const store = new FakeStore();
  const client = {
    async getLive() {
      return { live: { id: LIVE_ID, title: 'Live' }, breaks: [{ id: 'b1', title: 'Break 1', listingId: 'l1', total: 2, sold: 1 }] };
    },
    async getSpots() { return structuredClone(spots.value); },
  };
  const sync = new WhatnotSync({ store, client, intervalMs: 3_600_000, applyRandoms: async (...args) => calls.push(args) });
  t.after(() => sync.close());
  await sync.connect(LIVE_ID);
  await sync.select('b1', teams, { wheelSync: true });
  assert.deepEqual(calls.at(-1), [['BOS'], null, { BOS: 'cardking93' }]);
});

test('DBTK : le spot en enchère sur Whatnot fait passer la fiche dessus, une fois par enchère', async (t) => {
  const spots = { value: [
    { id: '1', title: 'Boston Celtics', sold: false, status: 'running' },
    { id: '2', title: 'Miami Heat', sold: false, status: 'created' },
  ] };
  const store = new FakeStore();
  const enchere = [];
  const client = {
    async getLive() {
      return { live: { id: LIVE_ID, title: 'Live' }, breaks: [{ id: 'b1', title: 'Break 1', listingId: 'l1', total: 2, sold: 0 }] };
    },
    async getSpots() { return structuredClone(spots.value); },
  };
  const sync = new WhatnotSync({ store, client, intervalMs: 3_600_000, applyRandoms: async () => {}, applyEnchere: async (s) => enchere.push(s) });
  t.after(() => sync.close());
  await sync.connect(LIVE_ID);
  const state = await sync.select('b1', teams, { wheelSync: true, enchere: true });
  assert.equal(state.enchere, true);
  assert.deepEqual(enchere, ['BOS'], 'le spot deja en enchere s’applique tout de suite');
  assert.equal(sync.rapide, true, 'cadence de 5 s pendant un DBTK');

  await sync.tick();
  assert.deepEqual(enchere, ['BOS'], 'meme enchere : rien ne bouge (un choix a la main reste)');

  // Vendu, puis pause entre deux encheres : la fiche ne bouge pas.
  spots.value = [{ ...spots.value[0], sold: true, buyer: 'x', status: 'reserved' }, spots.value[1]];
  await sync.tick();
  assert.deepEqual(enchere, ['BOS']);

  spots.value = [spots.value[0], { ...spots.value[1], status: 'running' }];
  await sync.tick();
  assert.deepEqual(enchere, ['BOS', 'MIA']);
  assert.equal((await sync.state()).enchereSigle, 'MIA');
});

test('sans option DBTK, la synchro ne touche pas au joueur affiché', async (t) => {
  const spots = { value: [{ id: '1', title: 'Boston Celtics', sold: false, status: 'running' }] };
  const store = new FakeStore();
  const enchere = [];
  const client = {
    async getLive() { return { live: { id: LIVE_ID, title: 'Live' }, breaks: [{ id: 'b1', title: 'Break 1', listingId: 'l1', total: 1, sold: 0 }] }; },
    async getSpots() { return structuredClone(spots.value); },
  };
  const sync = new WhatnotSync({ store, client, intervalMs: 3_600_000, applyRandoms: async () => {}, applyEnchere: async (s) => enchere.push(s) });
  t.after(() => sync.close());
  await sync.connect(LIVE_ID);
  await sync.select('b1', teams, { wheelSync: true });
  await sync.tick();
  assert.deepEqual(enchere, []);
  assert.equal(sync.rapide, false);
});
