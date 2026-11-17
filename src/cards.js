import { readFileSync } from 'node:fs';

const IDS = JSON.parse(readFileSync(new URL('./data/nba-ids.json', import.meta.url), 'utf8'));

export const CHECKLIST_API = process.env.CHECKLIST_API_URL || 'https://checklist-api.cardvaults.app';
const ANALYSIS_TTL_MS = 10 * 60_000;
const LIST_TTL_MS = 60 * 60_000;
const FETCH_TIMEOUT_MS = 60_000;
const MAX_CHECKLISTS = 12;

export class CardError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

export function fold(value) {
  return String(value || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ').trim();
}

const SUFFIX = /\s(jr|sr|ii|iii|iv|v)$/;
const teamByFold = new Map(IDS.teams.map(([id, name, abbr, nickname]) => [fold(name), { id, name, abbr, nickname: fold(nickname) }]));
const playerByFold = new Map();
for (const [id, name] of IDS.players) {
  const key = fold(name);
  if (!playerByFold.has(key) || id > playerByFold.get(key).id) playerByFold.set(key, { id, name });
}
// "Wendell Carter Jr." se retrouve aussi en "Wendell Carter" : les checklists
// et Whatnot n'ecrivent pas toujours le suffixe. Le nom exact reste prioritaire.
const sansSuffixe = new Map();
for (const [key, player] of playerByFold) {
  const court = key.replace(SUFFIX, '');
  if (court !== key && !playerByFold.has(court)) sansSuffixe.set(court, player);
}
for (const [key, player] of sansSuffixe) playerByFold.set(key, player);

export function findTeam(name) {
  const key = fold(name);
  if (teamByFold.has(key)) return teamByFold.get(key);
  for (const team of teamByFold.values()) {
    if (key.endsWith(team.nickname)) return team;
  }
  return null;
}

export function findPlayer(name) {
  const key = fold(name);
  return playerByFold.get(key) || playerByFold.get(key.replace(SUFFIX, '')) || null;
}

export const teamLogo = (team) => `https://cdn.nba.com/logos/nba/${team.id}/global/L/logo.svg`;
export const playerPhoto = (player) => (player ? `https://cdn.nba.com/headshots/nba/latest/260x190/${player.id}.png` : null);

const teamsOf = (card) => String(card.Team || '').split('/').map((part) => part.trim()).filter(Boolean);
const isHit = (card) => !String(card.Category || '').includes('Base/Autre');

function shortProduct(name) {
  return String(name || '').replace(/\s+Basketball$/i, '').trim();
}

function summarize(cards, productNames) {
  const stats = { cards: cards.length, hits: 0, auto: 0, mem: 0, autoMem: 0, caseHit: 0, logoman: 0, numbered: 0, oneOfOne: 0 };
  const perProduct = new Map();
  for (const card of cards) {
    const hit = isHit(card);
    if (hit) stats.hits += 1;
    if (card['Hit Type'] === 'auto') stats.auto += 1;
    else if (card['Hit Type'] === 'mem') stats.mem += 1;
    else if (card['Hit Type'] === 'auto_mem') stats.autoMem += 1;
    if (String(card.Category).includes('Case Hit')) stats.caseHit += 1;
    if (String(card.Category).includes('Logoman')) stats.logoman += 1;
    if (card.Numbering) stats.numbered += 1;
    if (card.Numbering === '/1') stats.oneOfOne += 1;
    const id = card.checklist_id;
    const entry = perProduct.get(id) || { name: productNames.get(id) || shortProduct(card.Product), cards: 0, hits: 0 };
    entry.cards += 1;
    if (hit) entry.hits += 1;
    perProduct.set(id, entry);
  }
  return { stats, products: [...perProduct.values()].sort((a, b) => b.hits - a.hits) };
}

function bestCards(cards, limit) {
  const seen = new Set();
  const out = [];
  const ranked = cards.filter(isHit).sort((a, b) => (b.Score || 0) - (a.Score || 0) || String(a.Player).localeCompare(String(b.Player)));
  for (const card of ranked) {
    const key = `${card.Player}|${card['Box Type']}|${card.Numbering}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      player: card.Player,
      box: card['Box Type'],
      numbering: card.Numbering || '',
      case: String(card.Category).includes('Case Hit'),
    });
    if (out.length >= limit) break;
  }
  return out;
}

export function buildIndex(cards) {
  const teams = new Set();
  const players = new Set();
  for (const card of cards) {
    for (const name of teamsOf(card)) if (findTeam(name)) teams.add(findTeam(name).name);
    if (card.Player) players.add(card.Player);
  }
  return { teams: [...teams].sort(), players: [...players].sort((a, b) => a.localeCompare(b)) };
}

export function buildTeamCard(cards, teamName, productNames) {
  const team = findTeam(teamName);
  if (!team) throw new CardError(`equipe inconnue : ${teamName}`, 404);
  const mine = cards.filter((card) => teamsOf(card).some((name) => findTeam(name)?.id === team.id));
  if (!mine.length) throw new CardError(`aucune carte pour ${team.name} dans ces produits`, 404);
  const { stats, products } = summarize(mine, productNames);
  const perPlayer = new Map();
  for (const card of mine) {
    if (!isHit(card) || !card.Player) continue;
    perPlayer.set(card.Player, (perPlayer.get(card.Player) || 0) + 1);
  }
  const topPlayers = [...perPlayer.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 5)
    .map(([name, hits]) => ({ name, hits, photo: playerPhoto(findPlayer(name)) }));
  return {
    kind: 'team', name: team.name, abbr: team.abbr, logo: teamLogo(team),
    stats, products, topPlayers, best: bestCards(mine, 4),
  };
}

export function buildPlayerCard(cards, playerName, productNames) {
  const key = fold(playerName);
  const mine = cards.filter((card) => fold(card.Player) === key);
  if (!mine.length) throw new CardError(`aucune carte pour ${playerName} dans ces produits`, 404);
  const { stats, products } = summarize(mine, productNames);
  const teamCounts = new Map();
  for (const card of mine) for (const name of teamsOf(card)) teamCounts.set(name, (teamCounts.get(name) || 0) + 1);
  const teamName = [...teamCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  const team = findTeam(teamName);
  return {
    kind: 'player', name: mine[0].Player, team: team?.name || teamName || '', abbr: team?.abbr || '',
    logo: team ? teamLogo(team) : null, photo: playerPhoto(findPlayer(mine[0].Player)),
    stats, products, best: bestCards(mine, 6),
  };
}

export class CardsService {
  constructor({ fetchImpl = fetch, now = () => Date.now() } = {}) {
    this.fetch = fetchImpl;
    this.now = now;
    this.list = null;
    this.analyses = new Map();
  }

  async request(path, init) {
    let response;
    try {
      response = await this.fetch(`${CHECKLIST_API}${path}`, { ...init, signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
    } catch {
      throw new CardError('API checklist injoignable', 502);
    }
    if (!response.ok) throw new CardError(`API checklist : HTTP ${response.status}`, 502);
    return response.json();
  }

  async checklists() {
    if (this.list && this.now() - this.list.at < LIST_TTL_MS) return this.list;
    const data = await this.request('/api/sports/nba/checklists');
    this.list = {
      at: this.now(),
      masterKey: data.master_key || null,
      items: (data.checklists || []).map((item) => ({
        id: item.checklist_id, name: shortProduct(item.display_name || item.checklist_id), year: item.year || '',
      })),
    };
    return this.list;
  }

  async analysis(ids) {
    const clean = [...new Set((Array.isArray(ids) ? ids : []).map(String))].sort();
    if (!clean.length) throw new CardError('aucun produit selectionne');
    if (clean.length > MAX_CHECKLISTS) throw new CardError(`${MAX_CHECKLISTS} produits maximum`);
    const list = await this.checklists();
    const known = new Map(list.items.map((item) => [item.id, item.name]));
    if (clean.some((id) => !known.has(id))) throw new CardError('produit inconnu');
    const key = clean.join(',');
    const cached = this.analyses.get(key);
    if (cached && (cached.promise || this.now() - cached.at < ANALYSIS_TTL_MS)) return cached.promise ? cached.promise : cached.value;
    const promise = this.request('/api/analyze', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ sport_key: 'nba', checklist_ids: clean, master_key: list.masterKey }),
    }).then((data) => {
      const value = { cards: data.cards || [], names: known, index: buildIndex(data.cards || []) };
      this.analyses.set(key, { at: this.now(), value });
      return value;
    }).catch((error) => {
      this.analyses.delete(key);
      throw error;
    });
    this.analyses.set(key, { promise });
    for (const [k, entry] of this.analyses) if (!entry.promise && this.now() - entry.at > ANALYSIS_TTL_MS) this.analyses.delete(k);
    return promise;
  }

  async index(ids) {
    return (await this.analysis(ids)).index;
  }

  async build(ids, kind, name) {
    const { cards, names } = await this.analysis(ids);
    if (kind === 'team') return buildTeamCard(cards, name, names);
    if (kind === 'player') return buildPlayerCard(cards, name, names);
    throw new CardError('type de carte inconnu');
  }
}
