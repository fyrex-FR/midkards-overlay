import { timingSafeEqual } from 'node:crypto';

export function safeEqual(left, right) {
  const a = Buffer.from(String(left));
  const b = Buffer.from(String(right));
  return a.length === b.length && timingSafeEqual(a, b);
}

export function bearerToken(request) {
  return (request.headers.authorization || '').replace(/^Bearer\s+/i, '');
}

export function authorized(request, expected) {
  const given = bearerToken(request);
  return Boolean(expected && given && safeEqual(given, expected));
}

export function previewWhatnotOpen(value) {
  return String(value || '').toLowerCase() === 'true';
}

/* Jeton dedie aux roues : n'ouvre QUE les routes /api/wheels. EDIT_TOKEN reste accepte (editeur de MidKards). */
export function wheelsAuthorized(request, env = process.env) {
  return authorized(request, env.SHAKS_WHEELS_TOKEN) || authorized(request, env.EDIT_TOKEN);
}
