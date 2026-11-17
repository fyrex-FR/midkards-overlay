import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { listWheels, evaluateWheel, findBestWheel, validateWheelDefinition, resolveLogos } from '../src/wheels.js';
import { readBuiltinWheels } from '../scripts/export-builtin-wheels.mjs';

const wheels = listWheels({ demo: { nom: 'Demo', equipes: [['AAA', 'Alpha Team', '#000', '#fff', '/api/media/logo/x1'], ['BBB', 'Beta Team', '#000', '#fff', '/api/media/logo/x2']] } });
const nba = wheels.find((w) => w.id === 'nba');

test('le JSON des roues livrees reste aligne sur randoms.js', () => {
  const file = JSON.parse(readFileSync(new URL('../src/data/builtin-wheels.json', import.meta.url), 'utf8'));
  assert.deepEqual(file, readBuiltinWheels());
});

test('une roue NBA complete est parfaite', () => {
  const titres = nba.equipes.map((t) => t.nom);
  assert.equal(evaluateWheel(titres, nba).parfait, true);
});

test('regle des 100 % : equipe manquante, spot inconnu et doublon refuses', () => {
  const titres = nba.equipes.map((t) => t.nom);
  assert.deepEqual(evaluateWheel(titres.slice(1), nba).absentes, [nba.equipes[0].sigle]);
  assert.equal(evaluateWheel([...titres.slice(1), 'Univ Men'], nba).parfait, false);
  assert.deepEqual(evaluateWheel([...titres, 'Atlanta Hawks PYT'], nba).doublons, ['ATL']);
});

test('break aleatoire sans spots : comparaison par nombre', () => {
  assert.equal(findBestWheel([], 30, wheels).parfait, true);
  assert.equal(findBestWheel([], 7, wheels), null);
});

test('findBestWheel prefere la roue parfaite', () => {
  const best = findBestWheel(nba.equipes.map((t) => t.nom), 30, wheels);
  assert.equal(best.id, 'nba');
  assert.equal(best.parfait, true);
});

test('validation : sigles et noms en double, sigle invalide', () => {
  const p = validateWheelDefinition({ nom: 'X', equipes: [{ sigle: 'AA', nom: 'Un' }, { sigle: 'aa', nom: 'Deux' }, { sigle: 'B', nom: 'un' }] });
  assert.ok(p.some((m) => m.includes('sigle en double')));
  assert.ok(p.some((m) => m.includes('sigle invalide')));
  assert.ok(p.some((m) => m.includes('nom en double')));
  assert.deepEqual(validateWheelDefinition({ nom: 'Ok', equipes: [{ sigle: 'AA', nom: 'Un' }, { sigle: 'BB', nom: 'Deux' }] }), []);
});

test('les logos existants sont reutilises par nom, sinon marques manquants', () => {
  const res = resolveLogos({ equipes: [{ sigle: 'LAL', nom: 'Los Angeles Lakers' }, { sigle: 'ZZZ', nom: 'Equipe Inconnue' }, { sigle: 'AAA', nom: 'Alpha Team' }] }, wheels);
  assert.ok(res[0].logo && res[0].source);
  assert.equal(res[1].logo, null);
  assert.equal(res[2].logo, '/api/media/logo/x1');
});

import { wheelsAuthorized } from '../src/security.js';
test('jeton roues et jeton editeur acceptes, autre refuse', () => {
  const req = (t) => ({ headers: { authorization: `Bearer ${t}` } });
  const env = { SHAKS_WHEELS_TOKEN: 'roues', EDIT_TOKEN: 'edit' };
  assert.equal(wheelsAuthorized(req('roues'), env), true);
  assert.equal(wheelsAuthorized(req('edit'), env), true);
  assert.equal(wheelsAuthorized(req('nope'), env), false);
  assert.equal(wheelsAuthorized({ headers: {} }, env), false);
  assert.equal(wheelsAuthorized(req('x'), {}), false);
});
