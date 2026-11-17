import test from 'node:test';
import assert from 'node:assert/strict';
import { WhatnotClient, matchSpot, parseLiveId, soldSpotIds } from '../src/whatnot.js';

const LIVE_ID = '1221167c-8822-4852-9186-7b91866a0010';

test('parse un live ID et une URL Whatnot', () => {
  assert.equal(parseLiveId(LIVE_ID), LIVE_ID);
  assert.equal(parseLiveId(`https://www.whatnot.com/fr-FR/live/${LIVE_ID}?app=ios`), LIVE_ID);
  assert.throws(() => parseLiveId('https://example.test/live/' + LIVE_ID), /invalide/);
  assert.throws(() => parseLiveId('https://www.whatnot.com/s/abc'), /lien court/);
});

test('associe un titre de spot au nom avant le sigle', () => {
  const teams = [
    { sigle: 'OKC', nom: 'Oklahoma City Thunder' },
    { sigle: 'PSG', nom: 'Paris Saint-Germain' },
  ];
  assert.equal(matchSpot('Oklahoma City Thunder — PYT', teams), 'OKC');
  assert.equal(matchSpot('PARIS SAINT GERMAIN', teams), 'PSG');
  assert.equal(matchSpot('Spot OKC', teams), 'OKC');
  assert.equal(matchSpot('Mystery', teams), null);
});

test('normalise les variantes NBA courantes', () => {
  assert.equal(matchSpot('Los Angeles Clippers', [{ sigle: 'LAC', nom: 'LA Clippers' }]), 'LAC');
  assert.equal(matchSpot('Philadelphia Sixers', [{ sigle: 'PHI', nom: 'Philadelphia 76ers' }]), 'PHI');
});

test('résout un lien court Whatnot redirigé vers un live', async () => {
  const client = new WhatnotClient({
    fetchImpl: async () => new Response(null, {
      status: 307,
      headers: { location: `https://www.whatnot.com/listing/abc?livestreamId=${LIVE_ID}` },
    }),
  });
  assert.equal(await client.resolveLiveId('https://www.whatnot.com/s/abc'), LIVE_ID);
});

test('normalise les identifiants vendus sans doublon implicite', () => {
  assert.deepEqual(soldSpotIds([{ id: 3, sold: true }, { id: 2, sold: false }]), ['3']);
});

test('normalise les breaks et les spots GraphQL', async () => {
  const replies = [
    { data: { liveStream: { id: LIVE_ID, title: 'Live', status: 'PLAYING', user: { username: 'shaks' } }, livestreamBreaks: { edges: [{ node: { id: '7', title: 'Break', totalBreakSpots: 2, soldSpotCount: 1, listing: { id: 'listing-7' } } }] } } },
    { data: { getListing: { break: { id: '7', paginatedSpots: { pageInfo: { hasNextPage: true, endCursor: 'c1' }, edges: [{ node: { id: 's1', title: 'Boston Celtics', buyer: { username: 'x' }, listing: { price: { amount: 150 } } } }] } } } } },
    { data: { getListing: { break: { id: '7', paginatedSpots: { pageInfo: { hasNextPage: false, endCursor: 'c2' }, edges: [{ node: { id: 's2', title: 'Miami Heat', buyer: null } }] } } } } },
  ];
  const client = new WhatnotClient({ fetchImpl: async () => Response.json(replies.shift()) });
  const live = await client.getLive(LIVE_ID);
  assert.equal(live.breaks[0].listingId, 'listing-7');
  const spots = await client.getSpots('listing-7');
  assert.deepEqual(spots.map((spot) => spot.sold), [true, false]);
  assert.deepEqual(spots.map((spot) => spot.price), [1.5, null]);
  assert.equal(JSON.stringify(spots).includes('username'), false);
});

test('sans paginatedSpots, les spots se lisent encore par Break.spots', async () => {
  const bodies = [];
  const replies = [
    { errors: [{ message: "Cannot query field 'paginatedSpots' on type 'Break'." }] },
    { data: { getListing: { break: { spots: [{ id: 's1', title: 'Boston Celtics', buyer: null }] } } } },
  ];
  const client = new WhatnotClient({
    fetchImpl: async (url, init) => { bodies.push(JSON.parse(init.body)); return Response.json(replies.shift(), { status: bodies.length === 1 ? 400 : 200 }); },
  });
  const spots = await client.getSpots('listing-7');
  assert.deepEqual(spots.map((spot) => spot.title), ['Boston Celtics']);
  assert.equal(bodies[0].variables.after, null);
});

test('le suivi automatique prend le live en cours, sinon le prochain programmé', async () => {
  const { chooseLive } = await import('../src/whatnot.js');
  const now = Date.parse('2026-10-12T12:00:00Z');
  const h = 3600 * 1000;
  const prochain = { id: 'b', status: 'CREATED', startTime: now + 8 * h };
  const apres = { id: 'c', status: 'CREATED', startTime: now + 50 * h };
  const enCours = { id: 'a', status: 'PLAYING', startTime: now - h };
  assert.equal(chooseLive([apres, prochain], now).id, 'b');
  assert.equal(chooseLive([apres, prochain, enCours], now).id, 'a');
  assert.equal(chooseLive([{ ...enCours, endTime: now }, prochain], now).id, 'b');
  assert.equal(chooseLive([{ id: 'vieux', status: 'CREATED', startTime: now - 20 * h }, apres], now).id, 'c');
  assert.equal(chooseLive([], now), null);
});
