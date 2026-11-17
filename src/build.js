import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const CODE = /\.(html|js|css)$/;

/* Empreinte du code servi aux pages : HTML, scripts et styles, hors images.
   Elle change a chaque mise en ligne qui touche le code, et seulement la :
   un simple redemarrage du serveur garde la meme. Les sources OBS la
   comparent pour se recharger toutes seules apres un deploiement. */
export async function codeVersion(dir) {
  const hash = createHash('sha256');
  async function walk(current) {
    const entries = (await readdir(current, { withFileTypes: true }))
      .sort((left, right) => left.name.localeCompare(right.name));
    for (const entry of entries) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== 'assets') await walk(full);
      } else if (CODE.test(entry.name)) {
        hash.update(path.relative(dir, full));
        hash.update(await readFile(full));
      }
    }
  }
  await walk(dir);
  return hash.digest('hex').slice(0, 16);
}
