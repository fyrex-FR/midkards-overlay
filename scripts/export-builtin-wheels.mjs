// Extrait les roues livrees de public/_moteur/randoms.js vers src/data/builtin-wheels.json
// (le navigateur lit randoms.js, le serveur lit le JSON : un test verifie qu'ils restent alignes).
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export function readBuiltinWheels() {
  const src = readFileSync(path.join(root, 'public/_moteur/randoms.js'), 'utf8');
  const win = { SHAKS_CONFIG: {} };
  const doc = { addEventListener() {}, querySelector: () => null, querySelectorAll: () => [], getElementById: () => null, readyState: 'loading', createElement: () => ({ style: {}, classList: { add() {} }, setAttribute() {} }) };
  new Function('window', 'document', src)(win, doc);
  const out = {};
  for (const [id, ligue] of Object.entries(win.SHAKS_LIGUES || {})) {
    if (ligue.custom) continue;
    const dir = path.join(root, 'public/assets/logos', id);
    const files = existsSync(dir) ? readdirSync(dir) : [];
    out[id] = {
      nom: ligue.nom,
      equipes: ligue.equipes.map(([sigle, nom, , , logo]) => {
        const file = files.find((f) => f.replace(/\.[a-z0-9]+$/i, '') === sigle);
        return { sigle, nom, logo: logo || (file ? `assets/logos/${id}/${file}` : null) };
      }),
    };
  }
  return out;
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  writeFileSync(path.join(root, 'src/data/builtin-wheels.json'), `${JSON.stringify(readBuiltinWheels(), null, 1)}\n`);
  console.log('src/data/builtin-wheels.json ecrit');
}
