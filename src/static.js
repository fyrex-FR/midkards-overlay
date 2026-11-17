import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import path from 'node:path';

const CONTENT_TYPES = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
};

const ALIASES = new Map([
  ['/', '/index.html'],
  ['/cadre', '/cadre.html'],
  ['/fond', '/fond.html'],
  ['/reglages', '/reglages.html'],
  ['/regie', '/regie.html'],
  ['/dbtk', '/dbtk.html'],
  ['/cartes', '/cartes.html'],
  ['/sports', '/sports.html'],
  ['/apercu', '/apercu.html'],
]);

export async function serveStatic(request, response, publicDir, pathname) {
  const wanted = ALIASES.get(pathname) || pathname;
  const relative = path.posix.normalize(wanted).replace(/^\/+/, '');
  if (!relative || relative.startsWith('..')) return false;
  const filePath = path.resolve(publicDir, relative);
  if (!filePath.startsWith(`${path.resolve(publicDir)}${path.sep}`)) return false;
  let info;
  try {
    info = await stat(filePath);
  } catch {
    return false;
  }
  if (!info.isFile()) return false;
  /* Les pages HTML ne sont jamais gardees : ce sont elles qui pointent vers
     les versions des scripts (?v=…). Safari resservait une ancienne page
     malgre max-age=0, faute de date pour la revalider, et la page de
     reglages restait sans ses nouvelles sections. Les autres fichiers
     gardent la revalidation, avec leur date de modification. */
  const cache = path.extname(filePath) === '.html'
    ? 'no-store'
    : 'public, max-age=0, must-revalidate';
  response.writeHead(200, {
    'content-type': CONTENT_TYPES[path.extname(filePath)] || 'application/octet-stream',
    'content-length': info.size,
    'cache-control': cache,
    'last-modified': info.mtime.toUTCString(),
  });
  if (request.method === 'HEAD') response.end();
  else createReadStream(filePath).pipe(response);
  return true;
}

