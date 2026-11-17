import { matchSpot, parseLiveId, soldSpotIds } from './whatnot.js';

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function publicState(row) {
  const state = row?.state || row || {};
  return {
    connected: Boolean(state.liveId),
    auto: state.auto !== false,
    seller: state.seller || null,
    enabled: Boolean(state.enabled),
    wheelSyncEnabled: Boolean(state.wheelSyncEnabled),
    liveId: state.liveId || null,
    live: state.live || null,
    breaks: state.breaks || [],
    breakId: state.breakId || null,
    totals: state.totals || null,
    unmatched: state.unmatched || [],
    enchere: Boolean(state.enchere),
    enchereSigle: state.enchereSigle || null,
    status: state.status || 'idle',
    error: state.error || null,
    lastSyncedAt: state.lastSyncedAt || null,
  };
}

function displayState(row) {
  const state = publicState(row);
  if (!state.connected) return { connected: false };
  return {
    connected: true,
    enabled: state.enabled,
    wheelSyncEnabled: state.wheelSyncEnabled,
    liveTitle: state.live?.title || null,
    breakId: state.breakId,
    breaks: state.breaks.map((item) => ({
      id: item.id,
      title: item.title,
      status: item.status,
      total: item.id === state.breakId && state.totals ? state.totals.total : item.total,
      sold: item.id === state.breakId && state.totals ? state.totals.sold : item.sold,
    })),
    lastSyncedAt: state.lastSyncedAt,
  };
}

function shownSigles(state, sold) {
  const retires = state.retires || [];
  return [...new Set([...(sold || []), ...(state.forces || [])])].filter((sigle) => !retires.includes(sigle)).sort();
}

/* Le suivi automatique ne relit la liste des lives du vendeur qu'une fois
   par minute : un nouveau live se programme rarement, inutile d'interroger
   Whatnot a chaque synchro de grille. */
const AUTO_INTERVAL_MS = 60_000;
/* Pendant un DBTK (pick your player), chaque spot passe une minute environ
   en enchere : on lit Whatnot toutes les 5 s pour que la fiche suive. */
const FAST_INTERVAL_MS = 5_000;

export class WhatnotSync {
  constructor({ store, client, applyRandoms, applyEnchere = null, intervalMs = 15_000, seller = null }) {
    this.store = store;
    this.client = client;
    this.applyRandoms = applyRandoms;
    this.applyEnchere = applyEnchere;
    /* Compte Whatnot suivi automatiquement : l'appli se connecte toute seule
       a son live en cours, ou a son prochain live, et bascule au suivant
       quand il se termine. Desactive des qu'on colle un lien a la main. */
    this.seller = seller;
    this.lastAutoCheck = 0;
    this.running = false;
    this.intervalMs = intervalMs;
    this.rapide = false;      // un break suivi en DBTK : cadence de 5 s
    this.lastTickAt = 0;
    this.timer = setInterval(() => this.cadence().catch((error) => console.error('[whatnot]', error)),
      Math.min(intervalMs, FAST_INTERVAL_MS));
    this.timer.unref();
  }

  /* Le minuteur bat toutes les 5 s, mais ne lit Whatnot a ce rythme que
     pendant un DBTK ; sinon une fois par intervalMs, comme avant. */
  async cadence() {
    if (!this.rapide && Date.now() - this.lastTickAt < this.intervalMs - 100) return;
    this.lastTickAt = Date.now();
    await this.tick();
  }

  async state() {
    return publicState(await this.store.getWhatnotState());
  }

  async display() {
    return displayState(await this.store.getWhatnotState());
  }

  /* Connexion a la main, par le lien d'un live : le suivi automatique
     s'arrete, sinon il ramenerait aussitot le live du vendeur. */
  async connect(value, { auto = false } = {}) {
    const liveId = this.client.resolveLiveId
      ? await this.client.resolveLiveId(value)
      : parseLiveId(value);
    const snapshot = await this.client.getLive(liveId);
    const state = {
      auto,
      seller: auto ? this.seller : null,
      liveId,
      live: snapshot.live,
      breaks: snapshot.breaks,
      breakId: null,
      teams: [],
      enabled: false,
      wheelSyncEnabled: false,
      enchere: false,
      enchereSigle: null,
      seenSold: [],
      status: 'ready',
      error: null,
      lastSyncedAt: new Date().toISOString(),
      failures: 0,
      nextAttemptAt: null,
    };
    await this.store.putWhatnotState(state);
    return publicState(state);
  }

  /* Les spots d'un break du live connecte (titres et prix). */
  async breakSpots(breakId) {
    const row = await this.store.getWhatnotState();
    const state = row?.state || {};
    const selected = (state.breaks || []).find((item) => String(item.id) === String(breakId));
    if (!selected) throw Object.assign(new Error('Break absent de ce live'), { status: 400 });
    return this.client.getSpots(selected.listingId);
  }

  /* Quelle roue correspond a ce break ? Compare les titres de ses spots
     Whatnot a chaque roue candidate ({ id: [{ sigle, nom }] }) et rend le
     classement : nombre de spots reconnus d'abord, puis l'ecart le plus
     faible entre le nombre de spots et le nombre d'equipes. */
  async detect(breakId, leagues) {
    const row = await this.store.getWhatnotState();
    const state = row?.state || {};
    const selected = (state.breaks || []).find((item) => String(item.id) === String(breakId));
    if (!selected) throw Object.assign(new Error('Break absent de ce live'), { status: 400 });
    const spots = await this.client.getSpots(selected.listingId);
    const titres = [...new Set(spots.map((spot) => spot.title))];
    const classement = Object.entries(leagues && typeof leagues === 'object' ? leagues : {})
      .map(([id, teams]) => {
        const liste = (Array.isArray(teams) ? teams : []).map((team) => ({
          sigle: String(team.sigle || '').toUpperCase().slice(0, 20),
          nom: String(team.nom || '').trim().slice(0, 120),
        })).filter((team) => team.sigle && team.nom);
        // Break aleatoire : Whatnot n'expose aucun spot avant le tirage, on se rabat sur le nombre.
        const reconnus = titres.length
          ? titres.filter((titre) => matchSpot(titre, liste)).length
          : (selected.total && liste.length === selected.total ? liste.length : 0);
        return { id: String(id), reconnus, equipes: liste.length };
      })
      .sort((a, b) => (b.reconnus - a.reconnus)
        || (Math.abs(a.equipes - (titres.length || selected.total || 0)) - Math.abs(b.equipes - (titres.length || selected.total || 0))));
    return { spots: titres.length || selected.total || 0, exposes: titres.length, titre: selected.title || '', classement };
  }

  async select(breakId, teams, { wheelSync = false, enchere = false } = {}) {
    const row = await this.store.getWhatnotState();
    const state = row?.state || {};
    const selected = (state.breaks || []).find((item) => String(item.id) === String(breakId));
    if (!selected) throw Object.assign(new Error('Break absent de ce live'), { status: 400 });
    const cleanTeams = (Array.isArray(teams) ? teams : []).map((team) => ({
      sigle: String(team.sigle || '').toUpperCase().slice(0, 20),
      nom: String(team.nom || '').trim().slice(0, 120),
    })).filter((team) => team.sigle && team.nom);
    if (!cleanTeams.length) throw Object.assign(new Error('Aucune équipe dans la grille choisie'), { status: 400 });
    const spots = await this.client.getSpots(selected.listingId);
    const mapped = this.map(spots, cleanTeams, selected);
    /* La roue ne suit Whatnot qu'apres activation explicite : la regie la
       demande (wheelSync) en meme temps que le break. Sans cette demande, un
       premier choix de break la laisse eteinte, et passer d'un break a
       l'autre en plein live ne la coupe pas en silence : on garde son etat. */
    const wheelSyncEnabled = wheelSync === true || Boolean(state.breakId && state.wheelSyncEnabled);
    const next = {
      ...state,
      breakId: String(selected.id),
      teams: cleanTeams,
      enabled: true,
      wheelSyncEnabled,
      /* DBTK : la fiche suit le spot en enchere sur Whatnot. enchereSigle a
         null : le spot deja en enchere s'applique a la prochaine synchro. */
      enchere: enchere === true,
      enchereSigle: null,
      seenSold: soldSpotIds(spots),
      // Roue active : null force la prochaine synchro a pousser la grille du
      // nouveau break, sans rejouer d'animation pour les spots deja vendus.
      lastSoldSigles: wheelSyncEnabled ? null : mapped.soldSigles,
      retires: [],
      forces: [],
      totals: mapped.totals,
      unmatched: mapped.unmatched,
      status: 'synced',
      error: null,
      lastSyncedAt: new Date().toISOString(),
      failures: 0,
      nextAttemptAt: null,
    };
    await this.store.putWhatnotState(next);
    if (wheelSyncEnabled) await this.tick();
    return this.state();
  }

  async setWheelSync(enabled) {
    const row = await this.store.getWhatnotState();
    const state = row?.state || {};
    if (!state.liveId || !state.breakId) {
      throw Object.assign(new Error('Choisis d’abord le break à suivre'), { status: 409 });
    }
    const wheelSyncEnabled = Boolean(enabled);
    const next = {
      ...state,
      wheelSyncEnabled,
      error: null,
      ...(wheelSyncEnabled ? { lastSoldSigles: null, nextAttemptAt: null, retires: [], forces: [] } : {}),
    };
    await this.store.putWhatnotState(next);
    if (wheelSyncEnabled) await this.tick();
    return this.state();
  }

  async override(sigle, taken) {
    const row = await this.store.getWhatnotState();
    const state = row?.state || {};
    if (!state.wheelSyncEnabled || !state.breakId) {
      throw Object.assign(new Error('Le mode automatique n’est pas activé'), { status: 409 });
    }
    const clean = String(sigle || '').toUpperCase();
    if (!(state.teams || []).some((team) => team.sigle === clean)) {
      throw Object.assign(new Error('Spot inconnu dans le preset'), { status: 400 });
    }
    const without = (list) => (list || []).filter((item) => item !== clean);
    const retires = taken ? without(state.retires) : [...without(state.retires), clean];
    const forces = taken ? [...without(state.forces), clean] : without(state.forces);
    const next = { ...state, retires, forces };
    await this.store.putWhatnotState(next);
    await this.applyRandoms(shownSigles(next, state.lastSoldSigles), taken ? clean : null);
    return this.state();
  }

  release(sigle) { return this.override(sigle, false); }

  force(sigle) { return this.override(sigle, true); }

  async setEnabled(enabled) {
    const row = await this.store.getWhatnotState();
    const state = row?.state || {};
    if (!state.liveId) throw Object.assign(new Error('Aucun live connecté'), { status: 409 });
    const next = {
      ...state,
      enabled: Boolean(enabled),
      status: enabled ? 'syncing' : 'paused',
      error: null,
      ...(enabled ? { lastSoldSigles: null, nextAttemptAt: null } : {}),
    };
    await this.store.putWhatnotState(next);
    if (enabled) queueMicrotask(() => this.tick().catch((error) => console.error('[whatnot]', error)));
    return publicState(next);
  }

  /* Arreter le break en cours : on ne suit plus aucun break, mais le live
     reste connecte (on en choisira un autre). La grille garde ce qui est
     coche ; elle ne bouge simplement plus avec Whatnot. */
  async stop() {
    const row = await this.store.getWhatnotState();
    const state = row?.state || {};
    const next = {
      ...state,
      breakId: null,
      teams: [],
      enabled: false,
      wheelSyncEnabled: false,
      seenSold: [],
      lastSoldSigles: null,
      retires: [],
      forces: [],
      totals: null,
      unmatched: [],
      status: state.liveId ? 'ready' : 'idle',
      error: null,
      nextAttemptAt: null,
    };
    await this.store.putWhatnotState(next);
    return publicState(next);
  }

  async disconnect() {
    const state = { auto: false, enabled: false, wheelSyncEnabled: false, status: 'idle', error: null };
    await this.store.putWhatnotState(state);
    return publicState(state);
  }

  /* Active ou coupe le suivi automatique du compte du vendeur. */
  async setAuto(enabled) {
    if (enabled && !this.seller) {
      throw Object.assign(new Error('Aucun compte Whatnot configuré pour le suivi automatique'), { status: 409 });
    }
    const row = await this.store.getWhatnotState();
    const state = row?.state || {};
    await this.store.putWhatnotState({ ...state, auto: Boolean(enabled), seller: enabled ? this.seller : null });
    if (enabled) {
      this.lastAutoCheck = 0;
      await this.autoConnect();
    }
    return this.state();
  }

  /* Relit le live (titre, statut, breaks) sans toucher au break suivi ni
     a la grille. L'etat est relu apres l'appel reseau : un choix fait entre-
     temps dans la regie n'est pas ecrase. */
  async refreshBreaks(liveId) {
    const snapshot = await this.client.getLive(liveId);
    const fresh = (await this.store.getWhatnotState())?.state || {};
    if (fresh.liveId !== liveId) return;
    await this.store.putWhatnotState({
      ...fresh,
      live: snapshot.live,
      breaks: snapshot.breaks,
      lastSyncedAt: new Date().toISOString(),
    });
  }

  /* Suivi automatique : se connecte au live en cours du vendeur, ou a son
     prochain live. Ne touche a rien tant que c'est deja le live suivi : le
     break choisi et le mode automatique de la roue sont conserves. */
  async autoConnect() {
    if (!this.seller) return;
    const row = await this.store.getWhatnotState();
    const state = row?.state || {};
    if (state.auto === false) return;
    if (Date.now() - this.lastAutoCheck < AUTO_INTERVAL_MS) return;
    this.lastAutoCheck = Date.now();
    const live = await this.client.findCurrentLive(this.seller);
    if (!live || String(live.id) === String(state.liveId)) return;
    await this.connect(live.id, { auto: true });
  }

  map(spots, teams, counters = null) {
    const soldSigles = [];
    const unmatched = [];
    const buyers = {};
    for (const spot of spots) {
      const sigle = matchSpot(spot.title, teams);
      if (!sigle) unmatched.push(spot.title);
      else if (spot.sold && !soldSigles.includes(sigle)) soldSigles.push(sigle);
      if (sigle && spot.sold && spot.buyer) buyers[sigle] = String(spot.buyer).slice(0, 40);
    }
    // Le spot en enchere ; deux a la fois (jamais vu) : on ne choisit pas.
    const enCours = [...new Set(spots.filter((spot) => spot.status === 'running' && !spot.sold)
      .map((spot) => matchSpot(spot.title, teams)).filter(Boolean))];
    const exposedSold = spots.filter((spot) => spot.sold).length;
    const total = Math.max(spots.length, Number(counters?.total || 0));
    const sold = Math.max(exposedSold, Number(counters?.sold || 0));
    return {
      soldSigles: soldSigles.sort(),
      buyers,
      enchere: enCours.length === 1 ? enCours[0] : null,
      unmatched: [...new Set(unmatched)].slice(0, 20),
      totals: {
        total,
        sold,
        available: Math.max(0, total - sold),
      },
    };
  }

  async tick() {
    if (this.running) return;
    this.running = true;
    try {
      try {
        await this.autoConnect();
      } catch (error) {
        // Whatnot indisponible : on garde le live en cours, on retentera.
        console.error('[whatnot] suivi automatique', error.message);
      }
      const row = await this.store.getWhatnotState();
      const state = row?.state || {};
      /* Aucun break suivi (ou suivi en pause) : on rafraichit quand meme la
         liste des breaks du live. Sans ca, un break cree apres la connexion
         n'apparaissait jamais dans la regie. */
      if (state.liveId && (!state.breakId || !state.enabled)) {
        await this.refreshBreaks(state.liveId);
        return;
      }
      this.rapide = Boolean(state.enabled && state.breakId && state.enchere);
      if (!state.enabled || !state.liveId || !state.breakId) return;
      if (state.nextAttemptAt && Date.now() < Date.parse(state.nextAttemptAt)) return;
      const liveSnapshot = await this.client.getLive(state.liveId);
      const selected = liveSnapshot.breaks.find((item) => String(item.id) === String(state.breakId));
      if (!selected) throw new Error('Le break sélectionné n’est plus exposé par Whatnot');
      const spots = await this.client.getSpots(selected.listingId);
      if (!spots.length && Number(selected.total || 0) > 0) throw new Error('Whatnot n’expose temporairement plus la grille');
      /* Relire l'etat APRES les appels reseau : pendant ces une ou deux
         secondes, la regie a pu choisir un autre break, couper la synchro ou
         activer la roue. Ecrire l'etat lu au depart ecraserait ce choix (le
         break revenait en arriere, la roue se recoupait). Si le break suivi a
         change, ces resultats ne valent plus rien : on les jette. */
      const fresh = (await this.store.getWhatnotState())?.state || {};
      if (!fresh.enabled || fresh.liveId !== state.liveId
        || String(fresh.breakId) !== String(state.breakId)) return;
      const mapped = this.map(spots, fresh.teams || [], selected);
      const seen = new Set((fresh.seenSold || []).map(String));
      const newlySold = spots.filter((spot) => spot.sold && !seen.has(String(spot.id)));
      const retires = fresh.retires || [];
      const shown = shownSigles(fresh, mapped.soldSigles);
      const animations = [...new Set(newlySold.map((spot) => matchSpot(spot.title, fresh.teams || [])).filter((sigle) => sigle && !retires.includes(sigle)))];
      const next = {
        ...fresh,
        live: liveSnapshot.live,
        breaks: liveSnapshot.breaks,
        seenSold: soldSpotIds(spots),
        lastSoldSigles: mapped.soldSigles,
        enchereSigle: mapped.enchere,
        totals: mapped.totals,
        unmatched: mapped.unmatched,
        status: 'synced',
        error: null,
        lastSyncedAt: new Date().toISOString(),
        failures: 0,
        nextAttemptAt: null,
      };
      await this.store.putWhatnotState(next);
      const soldChanged = fresh.lastSoldSigles === null
        || JSON.stringify(fresh.lastSoldSigles || []) !== JSON.stringify(mapped.soldSigles);
      const firstAnimation = animations.shift() || null;
      if (fresh.wheelSyncEnabled) {
        if (soldChanged || firstAnimation) await this.applyRandoms(shown, firstAnimation, mapped.buyers);
        for (const sigle of animations) {
          await delay(6500);   // la plus longue animation de spot dure ~6 s
          await this.applyRandoms(shown, sigle, mapped.buyers);
        }
      }
      /* DBTK : un nouveau spot en enchere fait passer la fiche dessus, apres
         les ventes (le tampon VENDU du precedent part d'abord). Seul le
         changement compte : un joueur choisi a la main dans la regie reste a
         l'ecran jusqu'a la prochaine enchere. */
      if (fresh.enchere && fresh.wheelSyncEnabled && mapped.enchere
        && mapped.enchere !== fresh.enchereSigle && this.applyEnchere) {
        await this.applyEnchere(mapped.enchere);
      }
    } catch (error) {
      const row = await this.store.getWhatnotState();
      const state = row?.state || {};
      const failures = Number(state.failures || 0) + 1;
      const backoffMs = Math.min(120_000, 15_000 * (2 ** Math.min(3, failures - 1)));
      await this.store.putWhatnotState({
        ...state,
        status: 'error',
        error: error.message,
        failures,
        nextAttemptAt: new Date(Date.now() + backoffMs).toISOString(),
      });
    } finally {
      this.running = false;
    }
  }

  close() {
    clearInterval(this.timer);
  }
}

export { displayState, publicState };
