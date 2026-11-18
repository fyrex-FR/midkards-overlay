import assert from 'node:assert/strict';
import test from 'node:test';
import { CardError, CardsService, buildIndex, buildPlayerCard, buildTeamCard, findPlayer, findTeam } from '../src/cards.js';

const card = (over) => ({
  Player: 'Cooper Flagg', Team: 'Dallas Mavericks', 'Box Type': 'Base', Numbering: '', Hits: 1,
  Product: 'Panini-Prizm-Basketball', checklist_id: 'prizm', Category: '📄 Base/Autre', 'Hit Type': 'none', Score: 1, ...over,
});
const CARDS = [
  card({}),
  card({ 'Box Type': 'Signatures', Category: '✍️ Auto', 'Hit Type': 'auto', Numbering: '/99', Score: 40 }),
  card({ Player: 'Anthony Davis', 'Box Type': 'Leviathans', Category: '✨ Case Hit', Score: 500 }),
  card({ Player: 'Trae Young', Team: 'Atlanta Hawks/Dallas Mavericks', Category: '🧵 Memo', 'Hit Type': 'mem', Score: 20, checklist_id: 'court' }),
  card({ Player: 'Someone', Team: 'UCLA', Category: '✍️ Auto', 'Hit Type': 'auto' }),
];
const NAMES = new Map([['prizm', '2025-26 Panini Prizm'], ['court', '2025-26 Panini Court Kings']]);

test('findTeam accepte le nom complet et un alias par surnom', () => {
  assert.equal(findTeam('Dallas Mavericks').abbr, 'DAL');
  assert.equal(findTeam('Los Angeles Clippers').abbr, 'LAC');
  assert.equal(findTeam('UCLA'), null);
});

test('findPlayer ignore accents et suffixes', () => {
  assert.equal(findPlayer('Cooper Flagg').id, 1642843);
  assert.ok(findPlayer('Nikola Jokić'));
  assert.equal(findPlayer('Inconnu Total'), null);
});

test('buildIndex ne garde que les equipes NBA', () => {
  const index = buildIndex(CARDS);
  assert.deepEqual(index.teams, ['Atlanta Hawks', 'Dallas Mavericks']);
  assert.ok(index.players.includes('Trae Young'));
});

test('carte equipe : compte les hits, cartes doubles equipes incluses', () => {
  const data = buildTeamCard(CARDS, 'Dallas Mavericks', NAMES);
  assert.equal(data.stats.cards, 4);
  assert.equal(data.stats.hits, 3);
  assert.equal(data.stats.auto, 1);
  assert.equal(data.stats.mem, 1);
  assert.equal(data.stats.caseHit, 1);
  assert.equal(data.stats.numbered, 1);
  assert.equal(data.best[0].box, 'Leviathans');
  assert.equal(data.best[0].case, true);
  assert.equal(data.products.find((p) => p.name === '2025-26 Panini Court Kings').cards, 1);
  assert.match(data.logo, /logos\/nba\/1610612742\//);
  assert.match(data.topPlayers[0].photo, /headshots\/nba\/latest\/260x190\/\d+\.png/);
});

test('carte equipe : paliers de hits du plus rare au plus courant, carte a chasser', () => {
  const cards = [
    card({ Category: '✍️ Auto', 'Hit Type': 'auto', Numbering: 'nan', Score: 20 }),
    card({ Player: 'Luka Doncic', Category: '✍️ Auto', 'Hit Type': 'auto', Numbering: 'RC', Score: 20 }),
    card({ Category: '✍️ Auto', 'Hit Type': 'auto', Score: 20 }),
    card({ Player: 'Kyrie Irving', Category: '🧵 Memo', 'Hit Type': 'mem', Score: 8 }),
    card({ Player: 'Dirk Nowitzki', 'Box Type': 'Treasured Tag Logoman', Category: '🔥 Logoman', 'Hit Type': 'auto_mem', Numbering: '/1', Score: 1000 }),
    card({ Player: 'Luka Doncic', 'Box Type': 'Colossal Logoman', Category: '🔥 Logoman', 'Hit Type': 'mem', Numbering: '/5', Score: 1000 }),
    card({ Player: 'Luka Doncic', Category: '💎 Auto/Mem', 'Hit Type': 'auto_mem', Score: 30 }),
  ];
  const data = buildTeamCard(cards, 'Dallas Mavericks', NAMES);
  assert.deepEqual(data.tiers.map((t) => [t.key, t.count]), [['logoman', 2], ['autoMem', 1], ['auto', 3], ['mem', 1]]);
  assert.equal(data.tiers.reduce((n, t) => n + t.count, 0), data.stats.hits);
  assert.deepEqual(data.tiers[2].players[0], { name: 'Cooper Flagg', short: 'Flagg', n: 2 });
  // "nan" et "RC" ne sont pas des numerotations.
  assert.equal(data.stats.numbered, 2);
  // A score egal, le /1 passe devant le /5.
  assert.equal(data.best[0].player, 'Dirk Nowitzki');
  assert.equal(data.best[0].numbering, '/1');
  assert.equal(data.best[0].tier, 'logoman');
});

test('carte joueur : equipe principale et photo', () => {
  const data = buildPlayerCard(CARDS, 'cooper flagg', NAMES);
  assert.equal(data.team, 'Dallas Mavericks');
  assert.equal(data.stats.cards, 2);
  assert.match(data.photo, /1642843\.png$/);
});

test('erreurs explicites sur equipe ou joueur absents', () => {
  assert.throws(() => buildTeamCard(CARDS, 'Boston Celtics', NAMES), CardError);
  assert.throws(() => buildTeamCard(CARDS, 'UCLA', NAMES), CardError);
  assert.throws(() => buildPlayerCard(CARDS, 'Nobody', NAMES), CardError);
});

test('service : cache l analyse et rejette les produits inconnus', async () => {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push(String(url));
    const body = String(url).endsWith('/checklists')
      ? { master_key: 'm', checklists: [{ checklist_id: 'prizm', display_name: '2025-26 Panini Prizm Basketball' }] }
      : { cards: CARDS };
    return { ok: true, json: async () => body };
  };
  const service = new CardsService({ fetchImpl });
  const [a, b] = await Promise.all([service.build(['prizm'], 'team', 'Dallas Mavericks'), service.build(['prizm'], 'player', 'Cooper Flagg')]);
  assert.equal(a.kind, 'team');
  assert.equal(b.kind, 'player');
  assert.equal(calls.filter((url) => url.endsWith('/api/analyze')).length, 1);
  await assert.rejects(service.build(['nope'], 'team', 'Dallas Mavericks'), /produit inconnu/);
  await assert.rejects(service.build([], 'team', 'Dallas Mavericks'), /aucun produit/);
});

test('service : API checklist en erreur -> 502', async () => {
  const service = new CardsService({ fetchImpl: async () => ({ ok: false, status: 500 }) });
  await assert.rejects(service.index(['x']), (error) => error.status === 502);
});
