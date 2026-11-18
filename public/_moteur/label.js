/* ==========================================================================
   MIDKARDS — L'etiquette (remplace le bandeau de Shaks)

   Une etiquette de carte gradee : sceau a gauche, nom au centre avec une
   ligne qui tourne (messages, reseaux, break en cours), compteur de spots a
   droite, et dessous une jauge d'un cran par spot.

   Donnees :
   - pas de grille (regie : « Afficher la grille » coupe) ou carte affichee : bandeau fin, pas de compteur ni de jauge ;
   - le compteur et la jauge viennent de la roue choisie (randoms.ligue) et
     des spots vendus (randoms.pris), donc exactement ce que montre la grille ;
   - pour un break sans roue (PYP), ils reprennent les compteurs officiels du
     break Whatnot suivi (/api/whatnot/display) ;
   - la ligne tournante reprend ticker.messages et social.items de config.js.

   Charge APRES randoms.js : il lit window.SHAKS_LIGUES.
   ========================================================================== */
(() => {
  "use strict";

  const host = document.getElementById("bar");
  if (!host) return;

  const cfg = window.SHAKS_CONFIG || {};
  const ICONS = new Set(["instagram", "tiktok", "web", "whatnot", "ebay", "mail"]);
  const el = (tag, classe, texte) => {
    const n = document.createElement(tag);
    if (classe) n.className = classe;
    if (texte !== undefined) n.textContent = texte;
    return n;
  };

  /* --- squelette ----------------------------------------------------------- */
  const logo = cfg.logo || {};
  /* Meme raison que le fond (arena.js) : version sur les images de assets/. */
  const ASSETS_V = "20261118-logos";
  const versionne = (u) => (/^assets\//.test(u) ? `${u}${u.includes("?") ? "&" : "?"}v=${ASSETS_V}` : u);
  const sceau = el("div", "label__seal");
  const arbre = el("img");
  arbre.alt = "";
  arbre.src = versionne(logo.src || "assets/arbre-blanc.png");
  sceau.append(arbre);

  const milieu = el("div", "label__mid");
  const mot = el("img", "label__word");
  mot.alt = "MidKards";
  mot.src = versionne(logo.wordmark || "assets/wordmark.png");
  const ligne = el("div", "label__line");
  const piste = el("div", "label__track");
  ligne.append(piste);
  milieu.append(mot, ligne);

  const compteur = el("div", "label__count");
  const nombre = el("div", "label__n");
  const nRestants = el("span", "label__n-main", "—");
  const nTotal = el("small", "label__n-total", "");
  nombre.append(nRestants, nTotal);
  const legende = el("div", "label__cap", "SPOTS RESTANTS");
  compteur.append(nombre, legende);

  const jauge = el("div", "label__gauge");
  host.append(sceau, milieu, compteur, jauge);

  /* --- ligne tournante ------------------------------------------------------ */
  const messages = ((cfg.ticker && cfg.ticker.messages) || [])
    .map((t) => String(t).trim()).filter(Boolean)
    .map((texte) => ({ texte }));
  const reseaux = ((cfg.social && cfg.social.items) || [])
    .filter((it) => it && it.label)
    .map((it) => ({ texte: it.label, icone: ICONS.has(it.icon) ? it.icon : "web" }));
  const dwell = Math.max(2, Number((cfg.ticker && cfg.ticker.dwellSec) ?? 5)) * 1000;
  const fondu = Math.max(100, Number((cfg.ticker && cfg.ticker.fadeMs) ?? 420));
  host.style.setProperty("--label-fade", `${fondu}ms`);

  // Break suivi sur Whatnot : son titre ouvre la rotation, c'est ce que le chat veut lire.
  let breakTitre = "";
  const rotation = () => {
    const base = [...messages, ...reseaux];
    return breakTitre ? [{ texte: breakTitre, break: true }, ...base] : base;
  };

  function construire(item) {
    const ligneItem = el("div", "label__item" + (item.break ? " is-break" : ""));
    if (item.icone) {
      const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      svg.setAttribute("class", "label__icon");
      svg.setAttribute("aria-hidden", "true");
      const use = document.createElementNS("http://www.w3.org/2000/svg", "use");
      use.setAttribute("href", `#ic-${item.icone}`);
      svg.append(use);
      ligneItem.append(svg);
    }
    if (item.break) ligneItem.append(el("span", "label__tag", "EN COURS"));
    ligneItem.append(el("span", "label__txt", item.texte));
    return ligneItem;
  }

  /* Un texte trop long se reduit (jusqu'a 60 %) plutot que d'etre coupe. */
  function ajuster(node) {
    const dispo = ligne.clientWidth;
    const txt = node.querySelector(".label__txt");
    if (!dispo || !txt) return;
    node.style.setProperty("--fit", "1");
    const besoin = node.scrollWidth;
    if (besoin > dispo) node.style.setProperty("--fit", String(Math.max(0.6, dispo / besoin).toFixed(3)));
  }

  let courant = null;
  let idx = 0;
  function suivant() {
    const liste = rotation();
    if (!liste.length) return;
    const item = liste[idx % liste.length];
    idx += 1;
    const nouveau = construire(item);
    nouveau.classList.add("is-in");
    piste.append(nouveau);
    ajuster(nouveau);
    void nouveau.offsetWidth;
    nouveau.classList.remove("is-in");
    const ancien = courant;
    if (ancien) {
      ancien.classList.add("is-out");
      setTimeout(() => ancien.remove(), fondu + 80);
    }
    courant = nouveau;
  }
  suivant();
  setInterval(() => { if (rotation().length > 1) suivant(); }, dwell);

  /* --- compteur et jauge ---------------------------------------------------- */
  let officiel = null;   // { total, sold } du break Whatnot suivi

  function etat() {
    const rnd = (window.SHAKS_CONFIG && window.SHAKS_CONFIG.randoms) || {};
    // Grille coupee dans la regie = aucun break en vente : ni compteur ni jauge.
    if (rnd.actif === false) return null;
    const ligue = (window.SHAKS_LIGUES || {})[String(rnd.ligue || "nba").toLowerCase()];
    if (ligue && !ligue.pyp && Array.isArray(ligue.equipes) && ligue.equipes.length) {
      const sigles = new Set(ligue.equipes.map(([s]) => String(s).toUpperCase()));
      const pris = new Set((Array.isArray(rnd.pris) ? rnd.pris : []).map((s) => String(s).toUpperCase()));
      let vendus = 0;
      for (const s of pris) if (sigles.has(s)) vendus += 1;
      return { total: sigles.size, vendus };
    }
    if (officiel && officiel.total > 0) return { total: officiel.total, vendus: Math.min(officiel.total, officiel.sold) };
    return null;
  }

  /* Design sans grille : la regie a coupe la grille, l'etiquette se reduit en
     bandeau fin (slab.css, body.mode-libre) et la camera est degagee. */
  function modeLibre() {
    const rnd = (window.SHAKS_CONFIG && window.SHAKS_CONFIG.randoms) || {};
    // Une carte equipe/joueur (card.js) s'affiche dans la camera du bas, sous
    // l'etiquette : en etiquette complete elle serait rognee, donc bandeau fin.
    const veut = rnd.actif === false || document.body.classList.contains("card-on");
    if (document.body.classList.contains("mode-libre") !== veut) document.body.classList.toggle("mode-libre", veut);
  }
  new MutationObserver(modeLibre).observe(document.body, { attributes: true, attributeFilter: ["class"] });

  let dernier = "";
  function dessiner() {
    modeLibre();
    const e = etat();
    if (!e) {
      compteur.hidden = true;
      jauge.hidden = true;
      host.classList.add("is-sans-compteur");
      dernier = "";
      return;
    }
    host.classList.remove("is-sans-compteur");
    compteur.hidden = false;
    jauge.hidden = false;
    const cle = `${e.total}:${e.vendus}`;
    if (cle === dernier) return;
    const avant = dernier;
    dernier = cle;
    const restants = e.total - e.vendus;
    nRestants.textContent = String(restants);
    nTotal.textContent = `/${e.total}`;
    legende.textContent = restants === 0 ? "BREAK COMPLET" : restants === 1 ? "SPOT RESTANT" : "SPOTS RESTANTS";
    host.classList.toggle("is-complet", restants === 0);

    // Un cran par spot ; au-dela de 60 spots, la jauge devient une simple barre.
    jauge.textContent = "";
    jauge.classList.toggle("is-barre", e.total > 60);
    if (e.total > 60) {
      const barre = el("i", "label__fill");
      barre.style.width = `${(e.vendus / e.total) * 100}%`;
      jauge.append(barre);
    } else {
      for (let i = 0; i < e.total; i += 1) {
        jauge.append(el("i", i < e.vendus ? "is-vendu" : ""));
      }
    }
    // Petit battement sur le compteur quand un spot part.
    if (avant) {
      compteur.classList.remove("is-tic");
      void compteur.offsetWidth;
      compteur.classList.add("is-tic");
    }
  }

  async function lireBreak() {
    try {
      const r = await fetch("/api/whatnot/display", { cache: "no-store" });
      if (!r.ok) return;
      const d = await r.json();
      if (!d || !d.connected) { breakTitre = ""; officiel = null; dessiner(); return; }
      const choisi = (d.breaks || []).find((b) => String(b.id) === String(d.breakId));
      breakTitre = choisi && choisi.title ? String(choisi.title) : (d.liveTitle || "");
      const t = d.totals || (choisi ? { total: choisi.total, sold: choisi.sold } : null);
      officiel = t ? { total: Number(t.total || 0), sold: Number(t.sold || 0) } : null;
      dessiner();
    } catch { /* on garde l'affichage courant pendant une coupure */ }
  }

  dessiner();
  lireBreak();
  setInterval(lireBreak, 5000);
  window.addEventListener("shaks:config", (ev) => {
    const s = (ev.detail && ev.detail.sections) || [];
    if (s.includes("randoms") || s.includes("pyp")) dessiner();
  });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => courant && ajuster(courant));
})();
