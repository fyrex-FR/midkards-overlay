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

  function playerTiles(players) {
    const grid = el("div", "players");
    for (const player of players) {
      const tile = el("div", "player");
      const last = player.name.split(" ").slice(-1)[0];
      tile.append(photo(player.photo, "", player.name), el("span", "player__name", last), el("b", "player__hits", `${player.hits} hits`));
      grid.append(tile);
    }
    return grid;
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

  function build(data) {
    const card = el("div", "card");
    const head = el("div", "card__head");
    const titles = el("div", "card__titles");
    titles.append(el("div", "card__title", data.name));
    const body = el("div", "card__body");

    if (data.kind === "team") {
      head.append(img(data.logo, "card__logo"), titles);
      body.append(playerTiles((data.topPlayers || []).slice(0, 5)));
    } else {
      const main = el("div", "card__main");
      const side = el("div", "card__side");
      side.append(photo(data.photo, "card__photo", data.name), img(data.logo, "card__teamlogo"));
      const [first, ...rest] = data.name.split(" ");
      titles.textContent = "";
      titles.append(el("div", "card__first", first), el("div", "card__title", rest.join(" ") || first), el("div", "card__sub", data.team || ""), el("div", "card__sub card__total", `${data.stats.cards} cartes possibles`));
      main.append(titles, hitsRow(data.stats), productRows((data.products || []).slice(0, 3)));
      card.classList.add("card--player");
      card.append(side, main);
      return card;
    }
    card.append(head, hitsRow(data.stats), body);
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
