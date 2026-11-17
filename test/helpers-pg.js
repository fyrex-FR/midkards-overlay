import { readFileSync, readdirSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { Store } from '../src/store.js';

/* Vrai moteur Postgres (WASM) en memoire : le SQL du Store est execute pour de vrai, sans serveur. */
export async function memoryStore(config = { sportsCustom: {} }) {
  const db = new PGlite();
  const pool = { query: (sql, params) => db.query(sql, params), connect: async () => ({ query: (sql, params) => db.query(sql, params), release() {} }) };
  const store = new Store('memory', { pool });
  const dir = new URL('../migrations/', import.meta.url);
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()) await db.exec(readFileSync(new URL(file, dir), 'utf8'));
  if (config) await store.replaceConfig(config);
  return store;
}
