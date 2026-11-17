export const SECTIONS = new Set([
  'ticker', 'social', 'typo', 'logo', 'planet', 'bar', 'layout',
  'arena', 'themes', 'randoms', 'sportsCustom', 'card', 'punchlines', 'animations', 'pyp',
]);

export const MEDIA_SLOTS = {
  fond: { types: new Set(['image/jpeg', 'image/webp']), max: 6 * 1024 * 1024 },
  globe: { types: new Set(['image/webp', 'image/png']), max: 4 * 1024 * 1024 },
  logo: { types: new Set(['image/webp', 'image/png']), max: 3 * 1024 * 1024 },
};

export const MEDIA_ID = /^[a-z0-9]{1,40}$/;

export function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function normalizeName(value, fallback) {
  return String(value || '').replace(/[\r\n]+/g, ' ').trim().slice(0, 60) || fallback;
}

