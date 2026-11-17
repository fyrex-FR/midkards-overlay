const GRAPHQL_URL = 'https://www.whatnot.com/services/graphql/';
const CLIENT_VERSION = '20260506-0505';
const LIVE_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const BREAKS_QUERY = `
query OverlayLive($id: ID!) {
  liveStream(id: $id) { id title status startTime user { username } }
  livestreamBreaks(liveStreamId: $id) {
    edges { node {
      id title description format status totalBreakSpots soldSpotCount
      listing { id title status }
    } }
  }
}`;

/* Break.spots s'arrete a 150 spots : un PYP en a plusieurs centaines.
   paginatedSpots les donne tous, par pages ; spots reste en secours. */
const PAGE_SPOTS = 200;
const MAX_PAGES = 10;
const PAGED_SPOTS_QUERY = `
query OverlayBreakPage($id: ID!, $after: String) {
  getListing(id: $id) { break {
    id
    paginatedSpots(first: ${PAGE_SPOTS}, after: $after) {
      pageInfo { hasNextPage endCursor }
      edges { node { id title description buyer { username } listing { status price { amount } } } }
    }
  } }
}`;

const SPOTS_QUERY = `
query OverlayBreak($id: ID!) {
  getListing(id: $id) { break {
    id title status totalBreakSpots soldSpotCount
    spots { id title description buyer { username } listing { id } }
  } }
}`;

const SELLER_QUERY = `
query OverlaySeller($username: String!) {
  getUser(username: $username) {
    username
    livestreams(first: 10) { edges { node { id title status startTime endTime } } }
  }
}`;

/* Statuts d'un live qui ne sont pas « en cours » : programme (CREATED) ou
   termine. Tout autre statut, sans heure de fin, est un live qui tourne. */
const PAS_EN_COURS = new Set(['CREATED', 'ENDED', 'CANCELLED', 'CANCELED', 'DELETED', 'EXPIRED']);

/* Le live a suivre pour un vendeur : celui en cours s'il y en a un, sinon le
   prochain programme. Un live programme dont l'heure est passee depuis plus
   de 12 h est considere comme abandonne. */
export function chooseLive(streams, now = Date.now()) {
  const clean = (streams || []).filter((item) => item && item.id && !item.endTime);
  const live = clean.find((item) => !PAS_EN_COURS.has(String(item.status || '').toUpperCase()));
  if (live) return live;
  return clean
    .filter((item) => String(item.status || '').toUpperCase() === 'CREATED')
    .filter((item) => !item.startTime || Number(item.startTime) > now - 12 * 3600 * 1000)
    .sort((left, right) => Number(left.startTime || 0) - Number(right.startTime || 0))[0] || null;
}

export function parseLiveId(value) {
  const raw = String(value || '').trim();
  if (LIVE_ID.test(raw)) return raw.toLowerCase();
  let url;
  try { url = new URL(raw); } catch { throw new Error('URL Whatnot invalide'); }
  if (!/(^|\.)whatnot\.com$/i.test(url.hostname)) throw new Error('URL Whatnot invalide');
  const queryLiveId = url.searchParams.get('livestreamId');
  if (queryLiveId && LIVE_ID.test(queryLiveId)) return queryLiveId.toLowerCase();
  const match = url.pathname.match(/\/(?:[a-z]{2}-[A-Z]{2}\/)?live\/([0-9a-f-]{36})(?:\/|$)/i);
  if (!match || !LIVE_ID.test(match[1])) {
    if (/\/s\//i.test(url.pathname)) throw new Error('Le lien court Whatnot doit être ouvert puis copié en URL /live/…');
    throw new Error('Identifiant de live Whatnot introuvable');
  }
  return match[1].toLowerCase();
}

export function normalizeSpot(value) {
  const normalized = String(value || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ').trim();
  return normalized
    .replace(/\blos angeles (clippers|lakers|rams|chargers)\b/g, 'la $1')
    .replace(/\bphiladelphia sixers\b/g, 'philadelphia 76ers')
    .replace(/\bportland trailblazers\b/g, 'portland trail blazers');
}

export function matchSpot(title, teams) {
  const haystack = ` ${normalizeSpot(title)} `;
  const candidates = (Array.isArray(teams) ? teams : [])
    .map((team) => ({
      sigle: String(team.sigle || '').toUpperCase(),
      name: normalizeSpot(team.nom),
    }))
    .filter((team) => team.sigle && team.name)
    .sort((left, right) => right.name.length - left.name.length);
  return candidates.find((team) => haystack.includes(` ${team.name} `))?.sigle
    || candidates.find((team) => team.sigle.length >= 3
      && haystack.includes(` ${normalizeSpot(team.sigle)} `))?.sigle
    || null;
}

export function soldSpotIds(spots) {
  return (spots || []).filter((spot) => spot.sold).map((spot) => String(spot.id)).sort();
}

export class WhatnotClient {
  constructor({ fetchImpl = fetch, timeoutMs = 10_000 } = {}) {
    this.fetchImpl = fetchImpl;
    this.timeoutMs = timeoutMs;
  }

  async resolveLiveId(value) {
    try { return parseLiveId(value); } catch (error) {
      const raw = String(value || '').trim();
      if (!/^https:\/\/(?:www\.)?whatnot\.com\/s\//i.test(raw)) throw error;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
      try {
        const response = await this.fetchImpl(raw, {
          redirect: 'manual',
          headers: { 'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/147 Safari/537.36' },
          signal: controller.signal,
        });
        const location = response.headers?.get?.('location');
        return parseLiveId(location ? new URL(location, raw).href : response.url);
      } catch (resolveError) {
        if (resolveError.name === 'AbortError') throw new Error('Le lien court Whatnot ne répond pas');
        throw error;
      } finally {
        clearTimeout(timeout);
      }
    }
  }

  async query(query, variables, operationName) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await this.fetchImpl(GRAPHQL_URL, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/147 Safari/537.36',
          origin: 'https://www.whatnot.com',
          referer: 'https://www.whatnot.com/',
          'x-client-version': CLIENT_VERSION,
        },
        body: JSON.stringify({ query, variables, operationName }),
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`Whatnot HTTP ${response.status}`);
      const payload = await response.json();
      if (payload.errors?.length && !payload.data) {
        throw new Error(`Whatnot GraphQL : ${payload.errors[0].message || 'erreur'}`);
      }
      return payload.data || {};
    } catch (error) {
      if (error.name === 'AbortError') throw new Error('Whatnot ne répond pas (timeout)');
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  async getLive(liveId) {
    const data = await this.query(BREAKS_QUERY, { id: liveId }, 'OverlayLive');
    if (!data.liveStream) throw new Error('Live Whatnot introuvable');
    const breaks = (data.livestreamBreaks?.edges || []).map(({ node }) => ({
      id: String(node.id),
      title: node.title || 'Break sans titre',
      status: node.status || null,
      total: Number(node.totalBreakSpots || 0),
      sold: Number(node.soldSpotCount || 0),
      listingId: node.listing?.id || null,
    })).filter((item) => item.listingId);
    return {
      live: {
        id: String(data.liveStream.id),
        title: data.liveStream.title || 'Live Whatnot',
        status: data.liveStream.status || null,
        startTime: data.liveStream.startTime ? Number(data.liveStream.startTime) : null,
        seller: data.liveStream.user?.username || null,
      },
      breaks,
    };
  }

  /* Le live en cours du vendeur, ou son prochain live programme. */
  async findCurrentLive(username) {
    const data = await this.query(SELLER_QUERY, { username }, 'OverlaySeller');
    if (!data.getUser) throw new Error(`Vendeur Whatnot introuvable : ${username}`);
    const streams = (data.getUser.livestreams?.edges || []).map(({ node }) => ({
      id: String(node.id),
      title: node.title || 'Live Whatnot',
      status: node.status || null,
      startTime: node.startTime ? Number(node.startTime) : null,
      endTime: node.endTime ? Number(node.endTime) : null,
    }));
    return chooseLive(streams);
  }

  async getSpots(listingId) {
    let nodes;
    try {
      nodes = await this.getPagedSpots(listingId);
    } catch (error) {
      // Champ refuse par Whatnot (400) : on retombe sur spots. Une panne
      // passagere remonte telle quelle, sans liste tronquee a 150.
      if (!/HTTP 400|GraphQL/.test(error.message)) throw error;
      nodes = null;
    }
    if (!nodes) {
      const data = await this.query(SPOTS_QUERY, { id: listingId }, 'OverlayBreak');
      const br = data.getListing?.break;
      if (!br) throw new Error('Break Whatnot introuvable');
      nodes = br.spots || [];
    }
    return nodes.map((spot) => ({
      id: String(spot.id),
      title: spot.title || spot.description || 'Spot sans titre',
      sold: Boolean(spot.buyer),
      buyer: spot.buyer?.username || null,
      /* Statut de l'enchere du spot, observe sur un PYP en direct : created
         (pas encore passe), running (en enchere : un seul a la fois),
         reserved (gagne, acheteur deja connu), processing_sale (vendu). */
      status: spot.listing?.status || null,
      // Prix de depart du spot, en centimes chez Whatnot.
      price: Number.isFinite(spot.listing?.price?.amount) ? spot.listing.price.amount / 100 : null,
    }));
  }

  /* Tous les spots, page par page. null si Whatnot ne connait pas le champ. */
  async getPagedSpots(listingId) {
    const nodes = [];
    let after = null;
    for (let page = 0; page < MAX_PAGES; page += 1) {
      const data = await this.query(PAGED_SPOTS_QUERY, { id: listingId, after }, 'OverlayBreakPage');
      if (!data.getListing?.break) throw new Error('Break Whatnot introuvable');
      const conn = data.getListing.break.paginatedSpots;
      if (!conn) return null;
      for (const edge of conn.edges || []) if (edge?.node) nodes.push(edge.node);
      if (!conn.pageInfo?.hasNextPage || !conn.pageInfo.endCursor) return nodes;
      after = conn.pageInfo.endCursor;
    }
    return nodes;
  }
}
