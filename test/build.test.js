import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { codeVersion } from '../src/build.js';

test('l’empreinte suit le code servi, pas les images', async (t) => {
  const dir = await mkdtemp(path.join(tmpdir(), 'shaks-build-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  await mkdir(path.join(dir, '_moteur'));
  await mkdir(path.join(dir, 'assets'));
  await writeFile(path.join(dir, 'cadre.html'), '<p>cadre</p>');
  await writeFile(path.join(dir, '_moteur', 'randoms.js'), 'a();');
  await writeFile(path.join(dir, 'assets', 'logo.png'), 'image');

  const depart = await codeVersion(dir);
  assert.equal(await codeVersion(dir), depart);

  await writeFile(path.join(dir, 'assets', 'logo.png'), 'autre image');
  assert.equal(await codeVersion(dir), depart);

  await writeFile(path.join(dir, '_moteur', 'randoms.js'), 'b();');
  assert.notEqual(await codeVersion(dir), depart);
});
