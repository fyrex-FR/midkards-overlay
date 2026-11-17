import test from 'node:test';
import assert from 'node:assert/strict';
import { buildFromSpots, buildList, memeListe, parseBoites, parseCartes, parseCsv, parseSpot } from '../src/pyp.js';
import { matchSpot } from '../src/whatnot.js';

const CSV = `Spot Name,Price,Description
PYP - Asa Newell - Atlanta Hawks - 1xAuto 1xBase,1,
PYP - Cooper Flagg - Dallas Mavericks - 2xAuto 2xRelic 2xCase Hit 3xInsert 2xBase 1xRC,1,
PYP - AJ Dybantsa RC - Washington Wizards - 6xAuto 4xRelic 5xCase Hit 7xInsert 1xBase,1,
PYP - Shai Gilgeous-Alexander - Oklahoma City Thunder - 1xAuto 3xRelic 3xCase Hit 5xInsert 2xBase,1,
PYP - Wendell Carter - Orlando Magic - 1xAuto 1xBase,1,
PYP - Jalen Williams - Oklahoma City Thunder - 2xAuto 1xRelic 1xInsert 1xBase,1,
PYP - Jalen Johnson - Atlanta Hawks - 3xAuto 2xRelic 4xInsert 2xBase,1,
"PYP - Ernest Udeh, Jr. - Orlando Magic - 1xBase",1,
Carte équipe - Atlanta Hawks,1,
Carte équipe - Los Angeles Clippers,1,
Pas un spot PYP,1,
`;

test('le CSV Whatnot gere les guillemets et les fins de ligne Windows', () => {
  const rows = parseCsv('a,"b, c",d\r\n"x ""y""",2,\r\n');
  assert.deepEqual(rows, [['a', 'b, c', 'd'], ['x "y"', '2', '']]);
});

test('les cartes a toucher se comptent par categorie, RC avec la base', () => {
  assert.deepEqual(parseCartes('2xAuto 2xRelic 2xCase Hit 3xInsert 2xBase 1xRC'), [2, 2, 2, 3, 3]);
  assert.deepEqual(parseCartes('1xBase'), [0, 0, 0, 0, 1]);
  // Nouveau format Whatnot : "Base" sans quantite.
  assert.deepEqual(parseCartes('2xAuto 1xCase Hit Base 1xRC'), [2, 0, 1, 0, null]);
  assert.deepEqual(parseCartes('Base'), [0, 0, 0, 0, null]);
});

test('un titre de spot donne le joueur, son equipe et le statut rookie', () => {
  assert.deepEqual(parseSpot('PYP - AJ Dybantsa RC - Washington Wizards - 6xAuto 1xBase'), {
    nom: 'AJ Dybantsa', equipe: 'Washington Wizards', rc: true, k: [6, 0, 0, 0, 1],
  });
  assert.equal(parseSpot('PYP - Shai Gilgeous-Alexander - Oklahoma City Thunder - 1xAuto').nom, 'Shai Gilgeous-Alexander');
  assert.equal(parseSpot('Pas un spot PYP'), null);
  assert.deepEqual(parseSpot('Cooper Flagg - Dallas Mavericks - 2xAuto 2xRelic 2xCase Hit 3xInsert Base 1xRC'), {
    nom: 'Cooper Flagg', equipe: 'Dallas Mavericks', rc: false, k: [2, 2, 2, 3, null],
  });
  assert.equal(parseSpot('Derek Harper - Dallas Mavericks - Base').nom, 'Derek Harper');
  assert.deepEqual(parseSpot('Carte équipe - Boston Celtics'), {
    nom: 'Carte équipe', equipe: 'Boston Celtics', rc: false, k: null, eq: true,
  });
});

test('la liste PYP retrouve photo et equipe, et ignore les lignes hors format', () => {
  const { liste, ignores } = buildList(CSV);
  assert.equal(liste.length, 10);
  assert.deepEqual(ignores, ['Pas un spot PYP']);
  const flagg = liste.find((j) => j.n === 'Cooper Flagg');
  assert.equal(flagg.s, 'P002');
  assert.equal(flagg.a, 'DAL');
  assert.equal(flagg.p, 1642843);
  assert.deepEqual(flagg.k, [2, 2, 2, 3, 3]);
  assert.equal(flagg.d, 1, 'prix de depart de la colonne Price');
  assert.equal(liste.find((j) => j.n === 'AJ Dybantsa').rc, true);
  assert.ok(liste.find((j) => j.n === 'Wendell Carter').p, 'un nom sans Jr. retrouve sa photo');
  const hawks = liste.find((j) => j.eq && j.e === 'Atlanta Hawks');
  assert.deepEqual([hawks.n, hawks.a, hawks.p, hawks.k, hawks.rc], ['Carte équipe', 'ATL', null, null, false]);
  assert.equal(liste.find((j) => j.eq && j.e === 'Los Angeles Clippers').a, 'LAC');
});

test('chaque titre Whatnot retombe sur son propre joueur dans la synchro', () => {
  const { liste } = buildList(CSV);
  const teams = liste.map((j) => ({ sigle: j.s, nom: j.t }));
  for (const j of liste) assert.equal(matchSpot(j.t, teams), j.s, j.t);
});

test('les boites du break se lisent dans les deux sens', () => {
  assert.deepEqual(parseBoites('3 Jumbo, 6 Hobby, 20 Value, 12 Hanger'), [
    { nom: 'Jumbo', n: 3 }, { nom: 'Hobby', n: 6 }, { nom: 'Value', n: 20 }, { nom: 'Hanger', n: 12 },
  ]);
  assert.deepEqual(parseBoites('Jumbo 3\nHobby x6'), [{ nom: 'Jumbo', n: 3 }, { nom: 'Hobby', n: 6 }]);
});

test('la liste se construit aussi depuis les spots du break Whatnot', () => {
  const spots = [
    { id: '1', title: 'Asa Newell - Atlanta Hawks - 1xAuto Base', price: 1 },
    { id: '2', title: 'Carte équipe - Atlanta Hawks', price: 1 },
    { id: '3', title: 'Asa Newell - Atlanta Hawks - 1xAuto Base', price: 1 },
    { id: '4', title: 'LeBron James - Los Angeles Lakers - 2xAuto 3xRelic 5xCase Hit 3xInsert Base', price: null },
  ];
  const { liste, ignores } = buildFromSpots(spots);
  assert.deepEqual(liste.map((j) => [j.s, j.n, j.d]), [['P001', 'Asa Newell', 1], ['P002', 'Carte équipe', 1], ['P003', 'LeBron James', null]]);
  assert.deepEqual(ignores, []);
  const csv = buildList('Spot Name,Price\nAsa Newell - Atlanta Hawks - 1xAuto Base,1\nCarte équipe - Atlanta Hawks,1\nLeBron James - Los Angeles Lakers - 2xAuto 3xRelic 5xCase Hit 3xInsert Base,1\n');
  assert.ok(memeListe(csv.liste, liste), 'CSV et break Whatnot donnent les memes sigles');
  assert.equal(memeListe(csv.liste, liste.slice(1)), false);
});
