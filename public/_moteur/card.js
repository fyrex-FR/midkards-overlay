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
     Un palier par type de hit, du plus rare au plus courant. Chaque palier dit
     en une phrase ce que c'est, combien il y en a et chez qui. */
  const SVG = (paths) => `<svg viewBox="0 0 24 24" aria-hidden="true">${paths}</svg>`;
  const ICONS = {
    pen: SVG('<path d="M4 20l1.2-4.6L15.6 5a2 2 0 0 1 2.8 0l.6.6a2 2 0 0 1 0 2.8L8.6 18.8z" fill="currentColor"/><path d="M3 21.5h9" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>'),
    shirt: SVG('<path d="M8.5 3 4 5.5 2.5 10l3 1.3V21h13v-9.7l3-1.3L20 5.5 15.5 3c-.6 1.5-1.9 2.4-3.5 2.4S9.1 4.5 8.5 3z" fill="currentColor"/>'),
    both: SVG('<path d="M8.5 3 4 5.5 2.5 10l3 1.3V21h13v-9.7l3-1.3L20 5.5 15.5 3c-.6 1.5-1.9 2.4-3.5 2.4S9.1 4.5 8.5 3z" fill="currentColor"/><path d="M7.5 16.5c1.6-2.4 2.6-.3 4-1.6 1.2-1.1 1.5-2.6 2.6-2.2.9.3-.1 2.3.9 2.6.7.2 1-.6 1.6-1" fill="none" stroke="#fff" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>'),
    star: SVG('<path d="M12 2.5l2.9 6 6.6.8-4.9 4.6 1.3 6.6L12 17.2l-5.9 3.3 1.3-6.6L2.5 9.3l6.6-.8z" fill="currentColor"/>'),
    crown: SVG('<path d="M3 18.5 2 7l5.5 4.5L12 4l4.5 7.5L22 7l-1 11.5z" fill="currentColor"/><path d="M3 21h18" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>'),
  };
  const TIER_INFO = {
    logoman: { name: "Logoman", text: "Logo NBA du maillot", icon: "crown" },
    case: { name: "Case hit", text: "± 1 par carton entier", icon: "star" },
    autoMem: { name: "Auto patch", text: "Signée + maillot", icon: "both" },
    auto: { name: "Auto", text: "Signée par le joueur", icon: "pen" },
    mem: { name: "Patch", text: "Bout de maillot porté", icon: "shirt" },
  };
  const TIER_ORDER = Object.keys(TIER_INFO);

  // Une carte deja affichee avant la mise a jour n'a pas de paliers : on les deduit des stats.
  function tiersOf(data) {
    if (Array.isArray(data.tiers)) return data.tiers.filter((t) => TIER_INFO[t.key] && t.count > 0);
    const s = data.stats || {};
    const counts = { logoman: s.logoman, case: s.caseHit, autoMem: s.autoMem, auto: s.auto, mem: s.mem };
    return TIER_ORDER.filter((key) => counts[key] > 0).map((key) => ({ key, count: counts[key], players: [] }));
  }

  function tierRow(tier, max, index) {
    const info = TIER_INFO[tier.key];
    const row = el("div", `tier is-${tier.key}`);
    row.style.setProperty("--i", String(index));
    const icon = el("div", "tier__icon");
    icon.innerHTML = ICONS[info.icon];
    const label = el("div", "tier__label");
    label.append(el("div", "tier__name", info.name), el("div", "tier__text", info.text));
    const right = el("div", "tier__data");
    const meter = el("div", "tier__meter");
    const fill = el("i");
    fill.style.setProperty("--w", String(Math.max(0.04, tier.count / max)));
    meter.append(fill);
    const who = el("div", "tier__who");
    for (const p of tier.players || []) {
      const chip = el("span", "who");
      chip.append(document.createTextNode(p.short || p.name.split(" ").slice(-1)[0]));
      if (p.n > 1) chip.append(el("b", "", `×${p.n}`));
      who.append(chip);
    }
    right.append(meter, who);
    row.append(icon, label, right, el("div", "tier__count", String(tier.count)));
    return row;
  }

  function buildTeam(data) {
    const card = el("div", "card card--team");
    const stats = data.stats || {};

    const head = el("div", "tc__head");
    const titles = el("div", "tc__titles");
    const words = String(data.name || "").split(" ");
    const nick = words.length > 1 ? words.pop() : words[0];
    titles.append(el("div", "tc__city", words.length ? words.join(" ") : ""), el("div", "tc__name", nick), el("div", "tc__def", "Hit = carte signée ou avec un bout de maillot"));
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

    const top = (data.best || [])[0];
    if (top && top.player) {
      const chase = el("div", "tc__chase");
      chase.style.setProperty("--i", String(tiers.length));
      const what = el("div", "tc__chase-what");
      what.append(el("b", "", top.player), el("span", "", [top.box, top.numbering].filter(Boolean).join(" · ")));
      chase.append(el("div", "tc__tag", "À chasser"), what);
      if (TIER_INFO[top.tier]) chase.append(el("div", "tc__chase-tier", TIER_INFO[top.tier].name));
      card.append(chase);
    }
    return card;
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

  function show(active) {
    clearTimeout(hideTimer);
    shownId = active.id;
    layer.textContent = "";
    const card = build(active);
    layer.append(card);
    layer.hidden = false;
    document.body.classList.add("card-on");
    void card.offsetWidth;
    card.classList.add("is-in");
  }

  function hide() {
    if (shownId === null) return;
    shownId = null;
    const card = layer.firstElementChild;
    if (card) card.classList.remove("is-in");
    document.body.classList.remove("card-on");
    hideTimer = setTimeout(() => { layer.hidden = true; layer.textContent = ""; }, 420);
  }

  function sync() {
    const active = window.SHAKS_CONFIG && window.SHAKS_CONFIG.card && window.SHAKS_CONFIG.card.active;
    if (!active || !active.id || Date.now() - Number(active.at || 0) > MAX_AGE_MS) return hide();
    if (active.id !== shownId) show(active);
  }

  window.addEventListener("shaks:config", (event) => {
    if (((event.detail && event.detail.sections) || []).includes("card")) sync();
  });
  sync();
})();
