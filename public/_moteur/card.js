(() => {
  "use strict";

  const win = document.getElementById("win-break");
  if (!win) return;

  const layer = document.createElement("div");
  layer.className = "card-layer";
  layer.hidden = true;
  win.append(layer);

  const MAX_AGE_MS = 3 * 3600 * 1000;
  const IMG_HOST = "https://cdn.nba.com/";
  let shownId = null;
  let hideTimer = 0;

  const el = (tag, cls, text) => {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text != null) node.textContent = text;
    return node;
  };
  const img = (url, cls) => {
    const node = el("img", cls);
    if (typeof url === "string" && url.startsWith(IMG_HOST)) node.src = url;
    else node.hidden = true;
    node.alt = "";
    node.onerror = () => { node.hidden = true; };
    return node;
  };
  const AVATARS = ["🏀", "🤡", "🦄", "🐐", "🤖", "👽", "🦖", "🐸", "🥷", "🧙", "🦸", "😎"];
  const photo = (url, cls, name) => {
    const avatar = () => el("div", `${cls} avatar`.trim(), AVATARS[[...name].reduce((n, c) => n + c.charCodeAt(0), 0) % AVATARS.length]);
    if (typeof url !== "string" || !url.startsWith(IMG_HOST)) return avatar();
    const node = img(url, cls);
    node.onerror = () => node.replaceWith(avatar());
    return node;
  };
  const seg = (cls, value, total) => {
    const node = el("i", `seg ${cls}`);
    node.style.flexGrow = String(Math.max(value, 0));
    node.hidden = !value || !total;
    return node;
  };
  const legend = (cls, value, label) => {
    const node = el("span", `leg ${cls}`);
    node.hidden = !value;
    node.append(el("b", "", String(value)), document.createTextNode(` ${label}`));
    return node;
  };

  function hitsRow(stats) {
    const autos = stats.auto + stats.autoMem;
    const row = el("div", "card__hits");
    const big = el("div", "hits__big");
    big.append(el("b", "", String(stats.hits)), el("span", "", "hits"));
    const detail = el("div", "hits__detail");
    const bar = el("div", "hits__bar");
    bar.append(seg("is-auto", autos, stats.hits), seg("is-mem", stats.mem, stats.hits), seg("is-ssp", stats.caseHit, stats.hits));
    const keys = el("div", "hits__legend");
    keys.append(legend("is-auto", autos, "autos"), legend("is-mem", stats.mem, "mem"), legend("is-ssp", stats.caseHit, "SSP"));
    detail.append(bar, keys);
    row.append(big, detail);
    return row;
  }

  function productRows(items) {
    const list = el("div", "products");
    const max = Math.max(1, ...items.map((item) => item.hits));
    for (const item of items) {
      const row = el("div", "row");
      const bar = el("i", "row__bar");
      bar.style.width = `${Math.max(8, Math.round((item.hits / max) * 100))}%`;
      row.append(bar, el("span", "row__name", item.name.replace(/^\d{4}-\d{2}\s+/, "")), el("span", "row__val", `${item.hits} hits`));
      list.append(row);
    }
    return list;
  }

  /* ---- Carte equipe : l'echelle des hits ------------------------------------
     Un palier par type de hit, du plus rare au plus courant : combien il y en a
     et chez qui. */
  const SVG = (paths) => `<svg viewBox="0 0 24 24" aria-hidden="true">${paths}</svg>`;
  const ICONS = {
    pen: SVG('<path d="M4 20l1.2-4.6L15.6 5a2 2 0 0 1 2.8 0l.6.6a2 2 0 0 1 0 2.8L8.6 18.8z" fill="currentColor"/><path d="M3 21.5h9" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>'),
    shirt: SVG('<path d="M8.5 3 4 5.5 2.5 10l3 1.3V21h13v-9.7l3-1.3L20 5.5 15.5 3c-.6 1.5-1.9 2.4-3.5 2.4S9.1 4.5 8.5 3z" fill="currentColor"/>'),
    both: SVG('<path d="M8.5 3 4 5.5 2.5 10l3 1.3V21h13v-9.7l3-1.3L20 5.5 15.5 3c-.6 1.5-1.9 2.4-3.5 2.4S9.1 4.5 8.5 3z" fill="currentColor"/><path d="M7.5 16.5c1.6-2.4 2.6-.3 4-1.6 1.2-1.1 1.5-2.6 2.6-2.2.9.3-.1 2.3.9 2.6.7.2 1-.6 1.6-1" fill="none" stroke="#fff" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>'),
    star: SVG('<path d="M12 2.5l2.9 6 6.6.8-4.9 4.6 1.3 6.6L12 17.2l-5.9 3.3 1.3-6.6L2.5 9.3l6.6-.8z" fill="currentColor"/>'),
    crown: SVG('<path d="M3 18.5 2 7l5.5 4.5L12 4l4.5 7.5L22 7l-1 11.5z" fill="currentColor"/><path d="M3 21h18" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>'),
  };
  const TIER_INFO = {
    logoman: { name: "Logoman", icon: "crown" },
    case: { name: "Case hit", icon: "star" },
    autoMem: { name: "Auto patch", icon: "both" },
    auto: { name: "Auto", icon: "pen" },
    mem: { name: "Patch", icon: "shirt" },
  };
  const TIER_ORDER = Object.keys(TIER_INFO);

  // Une carte deja affichee avant la mise a jour n'a pas de paliers : on les deduit des stats.
  function tiersOf(data) {
    if (Array.isArray(data.tiers)) return data.tiers.filter((t) => TIER_INFO[t.key] && t.count > 0);
    const s = data.stats || {};
    const counts = { logoman: s.logoman, case: s.caseHit, autoMem: s.autoMem, auto: s.auto, mem: s.mem };
    return TIER_ORDER.filter((key) => counts[key] > 0).map((key) => ({ key, count: counts[key], players: [] }));
  }

  // Carte calculee avant la mise a jour (sans "short") : meme forme "J. Tatum".
  const initiale = (nom) => {
    const mots = String(nom || "").trim().split(/\s+/);
    const last = mots.pop() || "";
    return mots.length ? `${mots[0][0].toUpperCase()}. ${last}` : last;
  };

  function tierRow(tier, max, index) {
    const info = TIER_INFO[tier.key];
    const row = el("div", `tier is-${tier.key}`);
    row.style.setProperty("--i", String(index));
    const icon = el("div", "tier__icon");
    icon.innerHTML = ICONS[info.icon];
    const label = el("div", "tier__label");
    label.append(el("div", "tier__name", info.name));
    const right = el("div", "tier__data");
    // Noms sur deux lignes : s'il y en a plus, ils passent par pages (voir pageNames).
    const who = el("div", "tier__who");
    const track = el("div", "who-track");
    for (const p of tier.players || []) {
      const chip = el("span", "who");
      chip.append(document.createTextNode(p.short || initiale(p.name)));
      if (p.n > 1) chip.append(el("b", "", `×${p.n}`));
      track.append(chip);
    }
    who.append(track);
    right.append(who);
    // La part du palier : un trait au pied de la ligne.
    const meter = el("div", "tier__meter");
    const fill = el("i");
    fill.style.setProperty("--w", String(Math.max(0.04, tier.count / max)));
    meter.append(fill);
    const count = el("div", "tier__count");
    count.append(el("b", "", String(tier.count)), el("span", "tier__page"));
    row.append(icon, label, right, count, meter);
    return row;
  }

  function buildTeam(data) {
    const card = el("div", "card card--team");
    const stats = data.stats || {};

    const head = el("div", "tc__head");
    const titles = el("div", "tc__titles");
    const words = String(data.name || "").split(" ");
    const nick = words.length > 1 ? words.pop() : words[0];
    if (data.spot) {
      const badge = el("div", "tc__spot", "Spot restant ");
      badge.append(el("b", "", `${data.spot.pos}/${data.spot.total}`));
      if (data.spot.label) badge.append(el("span", "", data.spot.label));
      titles.append(badge);
    }
    titles.append(el("div", "tc__city", words.length ? words.join(" ") : ""), el("div", "tc__name", nick));
    const total = el("div", "tc__total");
    const n = el("div", "tc__n");
    n.append(el("b", "", String(stats.hits || 0)), el("span", "", "hits"));
    total.append(n, el("div", "tc__of", `sur ${stats.cards || 0} cartes`));
    head.append(img(data.logo, "tc__logo"), titles, total);

    const tiers = tiersOf(data);
    const max = Math.max(1, ...tiers.map((t) => t.count));
    const ladder = el("div", "tc__ladder");
    const scale = el("div", "tc__scale");
    scale.append(el("span", "", "+ rare"), el("i"), el("span", "", "+ courant"));
    const rows = el("div", "tc__rows");
    tiers.forEach((tier, i) => rows.append(tierRow(tier, max, i)));
    ladder.append(scale, rows);
    card.append(head, ladder);

    // Toutes les cartes du palier le plus rare defilent ; une carte affichee avant
    // la mise a jour n'a que "best" : on montre la premiere.
    const list = (Array.isArray(data.chase) && data.chase.length ? data.chase : (data.best || []).slice(0, 1))
      .filter((c) => c && c.player);
    if (list.length) {
      const chase = el("div", "tc__chase");
      chase.style.setProperty("--i", String(tiers.length));
      const roll = el("div", "tc__roll");
      list.forEach((c, i) => {
        const what = el("div", `tc__chase-what${i === 0 ? " is-on" : ""}`);
        what.append(el("b", "", c.player), el("span", "", [c.box, c.numbering].filter(Boolean).join(" · ")));
        roll.append(what);
      });
      const side = el("div", "tc__chase-tier");
      const tier = TIER_INFO[list[0].tier];
      side.append(document.createTextNode(tier ? tier.name : ""));
      if (list.length > 1) side.append(el("small", "tc__pos", `1/${list.length}`));
      chase.append(el("div", "tc__tag", "À chasser"), roll, side);
      card.append(chase);
    }
    return card;
  }

  /* Pages des noms : chaque palier montre deux lignes de joueurs. S'il y en a
     plus, la liste est decoupee en pages de deux lignes (sans couper un nom). */
  function pageNames(card) {
    for (const who of card.querySelectorAll(".tier__who")) {
      const track = who.firstElementChild;
      track.style.transform = "";
      const tops = [...new Set([...track.children].map((chip) => chip.offsetTop))].sort((a, b) => a - b);
      who._pages = tops.filter((_, i) => i % 2 === 0);
      who._at = 0;
      const page = who.closest(".tier").querySelector(".tier__page");
      page.textContent = who._pages.length > 1 ? `1/${who._pages.length}` : "";
    }
  }

  /* Un seul battement pour tout ce qui defile (cartes a chasser, pages de noms) :
     changements ponctuels, petites surfaces. */
  const ROLL_MS = 4000;
  let rollTimer = 0;
  function tick(card) {
    const items = [...card.querySelectorAll(".tc__chase-what")];
    if (items.length > 1) {
      const at = items.findIndex((item) => item.classList.contains("is-on"));
      const prev = items[at];
      const next = (at + 1) % items.length;
      prev.classList.remove("is-on");
      prev.classList.add("is-out");
      setTimeout(() => prev.classList.remove("is-out"), 500);
      items[next].classList.add("is-on");
      const pos = card.querySelector(".tc__pos");
      if (pos) pos.textContent = `${next + 1}/${items.length}`;
    }
    for (const who of card.querySelectorAll(".tier__who")) {
      if (!who._pages || who._pages.length < 2) continue;
      who._at = (who._at + 1) % who._pages.length;
      who.classList.add("is-swap");
      setTimeout(() => {
        who.firstElementChild.style.transform = `translateY(${-who._pages[who._at]}px)`;
        who.closest(".tier").querySelector(".tier__page").textContent = `${who._at + 1}/${who._pages.length}`;
        who.classList.remove("is-swap");
      }, 260);
    }
  }
  function startRoll(card) {
    clearInterval(rollTimer);
    rollTimer = setInterval(() => tick(card), ROLL_MS);
  }

  function build(data) {
    if (data.kind === "team") return buildTeam(data);
    const card = el("div", "card card--player");
    const titles = el("div", "card__titles");
    const main = el("div", "card__main");
    const side = el("div", "card__side");
    side.append(photo(data.photo, "card__photo", data.name), img(data.logo, "card__teamlogo"));
    const [first, ...rest] = data.name.split(" ");
    titles.append(el("div", "card__first", first), el("div", "card__title", rest.join(" ") || first), el("div", "card__sub", data.team || ""), el("div", "card__sub card__total", `${data.stats.cards} cartes possibles`));
    main.append(titles, hitsRow(data.stats), productRows((data.products || []).slice(0, 3)));
    card.append(side, main);
    return card;
  }

  function present(data) {
    clearTimeout(hideTimer);
    layer.textContent = "";
    const card = build(data);
    layer.append(card);
    layer.hidden = false;
    document.body.classList.add("card-on");
    void card.offsetWidth;
    card.classList.add("is-in");
    if (card.classList.contains("card--team")) {
      pageNames(card);
      // Les polices peuvent arriver apres : on remesure une fois chargees.
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { if (card.isConnected) pageNames(card); });
      startRoll(card);
    } else {
      clearInterval(rollTimer);
    }
  }

  function show(active) {
    stopRotation();
    shownId = active.id;
    present(active);
  }

  /* --- Rotation sur les spots restants d'un break ------------------------
     Le serveur envoie une carte par equipe encore a prendre et retire les
     spots vendus au fil du live : ici on fait juste defiler la liste. */
  let rot = null;
  let rotTimer = 0;
  let swapTimer = 0;

  function stopRotation() {
    clearInterval(rotTimer);
    clearTimeout(swapTimer);
    rot = null;
  }

  function rotationData(index) {
    const item = rot.items[index];
    const spots = (item.spots || []).map((spot) => spot.title).filter(Boolean);
    const plat = (t) => String(t || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
    // Le titre du spot n'apparait que s'il dit autre chose que le nom de l'equipe ("DEN/UW").
    const autre = spots.filter((t) => plat(t) !== plat(item.card.name) && plat(t) !== plat(item.card.abbr));
    return { ...item.card, kind: "team", spot: { pos: index + 1, total: rot.items.length, label: autre.join(" · ") } };
  }

  function presentRotation(swap) {
    if (!rot || !rot.items.length) return;
    const data = rotationData(rot.index);
    const current = layer.firstElementChild;
    if (swap && current) {
      current.classList.remove("is-in");
      clearTimeout(swapTimer);
      swapTimer = setTimeout(() => { if (rot) present(data); }, 400);
    } else present(data);
  }

  function showRotation(active) {
    const items = Array.isArray(active.items) ? active.items.filter((item) => item && item.card) : [];
    if (!items.length) return hide();
    if (!rot || rot.id !== active.id) {
      stopRotation();
      shownId = active.id;
      rot = { id: active.id, items, index: 0 };
      presentRotation(false);
      const ms = Math.min(60, Math.max(6, Number(active.interval) || 12)) * 1000;
      rotTimer = setInterval(() => {
        if (!rot || rot.items.length < 2) return;
        rot.index = (rot.index + 1) % rot.items.length;
        presentRotation(true);
      }, ms);
      return;
    }
    // Meme rotation, liste mise a jour (spots vendus) : on garde l'equipe affichee si elle reste.
    const affichee = rot.items[rot.index] && rot.items[rot.index].team;
    rot.items = items;
    const i = items.findIndex((item) => item.team === affichee);
    if (i >= 0) {
      rot.index = i;
      const pos = layer.querySelector(".tc__spot b");
      if (pos) pos.textContent = `${i + 1}/${items.length}`;
    } else {
      rot.index = rot.index % items.length;
      presentRotation(true);
    }
  }

  function hide() {
    stopRotation();
    if (shownId === null) return;
    shownId = null;
    clearInterval(rollTimer);
    const card = layer.firstElementChild;
    if (card) card.classList.remove("is-in");
    document.body.classList.remove("card-on");
    hideTimer = setTimeout(() => { layer.hidden = true; layer.textContent = ""; }, 420);
  }

  function sync() {
    const active = window.SHAKS_CONFIG && window.SHAKS_CONFIG.card && window.SHAKS_CONFIG.card.active;
    if (!active || !active.id || Date.now() - Number(active.at || 0) > MAX_AGE_MS) return hide();
    if (active.kind === "rotation") return showRotation(active);
    if (active.id !== shownId) show(active);
  }

  window.addEventListener("shaks:config", (event) => {
    if (((event.detail && event.detail.sections) || []).includes("card")) sync();
  });
  sync();
})();
