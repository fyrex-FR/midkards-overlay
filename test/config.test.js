import test from 'node:test';
import assert from 'node:assert/strict';
import { MEDIA_ID, isObject, normalizeName } from '../src/config.js';
import { previewWhatnotOpen, safeEqual } from '../src/security.js';

test('validation des identifiants média', () => {
  assert.equal(MEDIA_ID.test('mtvmbcbpjl5w47'), true);
  assert.equal(MEDIA_ID.test('../secret'), false);
  assert.equal(MEDIA_ID.test('UPPERCASE'), false);
});

test('les configurations doivent être des objets simples', () => {
  assert.equal(isObject({ ticker: {} }), true);
  assert.equal(isObject([]), false);
  assert.equal(isObject(null), false);
});

test('les noms de médias sont nettoyés et bornés', () => {
  assert.equal(normalizeName('Fond\r\nFoot', 'fond'), 'Fond Foot');
  assert.equal(normalizeName('', 'fond'), 'fond');
  assert.equal(normalizeName('x'.repeat(80), 'fond').length, 60);
});

test('comparaison de jeton constante et exacte', () => {
  assert.equal(safeEqual('abc', 'abc'), true);
  assert.equal(safeEqual('abc', 'abd'), false);
  assert.equal(safeEqual('abc', 'abcd'), false);
});

test('le mode Whatnot public exige une activation explicite', () => {
  assert.equal(previewWhatnotOpen('true'), true);
  assert.equal(previewWhatnotOpen('TRUE'), true);
  assert.equal(previewWhatnotOpen('1'), false);
  assert.equal(previewWhatnotOpen(undefined), false);
});
