/* ==========================================================================
   MIDKARDS — Amorçage de la config

   Charge la configuration, PUIS les scripts de l'habillage. Cet ordre est
   impose : banner.js et frame.js lisent window.SHAKS_CONFIG des leur premiere
   ligne, ils ne peuvent donc pas demarrer avant qu'elle soit connue.

   Quatre sources, par ordre de priorite :
     1. le hash #cfg=   apercu pilote par la page de reglages
     2. /api/config     la config enregistree en ligne
     3. localStorage    la derniere config chargee avec succes
     4. config.js       celle embarquee dans le deploiement

   Les niveaux 3 et 4 ne sont pas du luxe : sans eux, une coupure reseau au
   demarrage d'OBS donnerait un overlay vide en pleine soiree. La, elle donne
   au pire la derniere config connue.

   Usage :
     <script src="_moteur/boot.js"
             data-then="_moteur/frame.js,_moteur/banner.js"
             data-poll="60"></script>
   ========================================================================== */
(() => {
  "use strict";

  const self = document.currentScript;
  const THEN = (self.dataset.then || "").split(",").map((s) => s.trim()).filter(Boolean);
  const POLL_S = 60;

  /* Canal rapide : les sections nommees dans data-hot sont interrogees a part,
     bien plus souvent, sur leur propre adresse.

     Pourquoi ne pas simplement accelerer le sondage general : la configuration
     complete fait 2 Ko et son changement demande un rechargement de page. La
     section chaude, elle, fait 150 octets et s'applique a chaud. Les deux
     n'ont ni le meme rythme ni le meme cout. */
  const HOT = (self.dataset.hot || "").split(",").map((s) => s.trim()).filter(Boolean);
  const API = "/api/config";
  const CACHE_KEY = "shaks:config";

  const isPlain = (v) => v && typeof v === "object" && !Array.isArray(v);

  /* Fusion recursive. Les tableaux sont remplaces en entier : retirer un
     message du ticker doit vraiment le retirer. */
  function merge(base, patch) {
    for (const key of Object.keys(patch)) {
      const val = patch[key];
      if (isPlain(val) && isPlain(base[key])) merge(base[key], val);
      else base[key] = val;
    }
    return base;
  }

  function apply(patch) {
    if (!isPlain(patch)) return false;
    window.SHAKS_CONFIG = merge(window.SHAKS_CONFIG || {}, patch);
    return true;
  }

  function readCache() {
    try {
      const txt = localStorage.getItem(CACHE_KEY);
      return txt ? JSON.parse(txt) : null;
    } catch {
      return null;
    }
  }

  function writeCache(text) {
    try { localStorage.setItem(CACHE_KEY, text); } catch { /* quota, mode prive */ }
  }

  /* Texte exact de la config chargee, pour detecter un changement en ligne
     sans avoir a comparer des objets. */
  let loadedText = null;

  async function fetchRemote() {
    const res = await fetch(API, { cache: "no-store" });
    if (!res.ok) throw new Error(`API ${res.status}`);
    const text = await res.text();
    const data = JSON.parse(text);
    if (!isPlain(data) || data.empty) throw new Error("config vide");
    return { data, text };
  }

  async function loadConfig() {
    // 1. Apercu pilote par la page de reglages : prioritaire sur tout.
    const hash = location.hash || "";
    if (hash.startsWith("#cfg=")) {
      try {
        if (apply(JSON.parse(decodeURIComponent(hash.slice(5))))) return "apercu";
      } catch (err) {
        console.warn("[shaks] config d'apercu illisible", err);
      }
    }

    // 2. En ligne.
    try {
      const { data, text } = await fetchRemote();
      apply(data);
      loadedText = text;
      writeCache(text);
      return "en ligne";
    } catch (err) {
      console.warn("[shaks] config en ligne indisponible :", err.message);
    }

    // 3. Dernière config chargée avec succès.
    const cached = readCache();
    if (cached && apply(cached)) return "cache local";

    // 4. Celle embarquée dans le déploiement.
    return "embarquee";
  }

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const el = document.createElement("script");
      el.src = src;
      el.onload = resolve;
      el.onerror = () => reject(new Error(`script introuvable : ${src}`));
      document.head.appendChild(el);
    });
  }

  /* Sections applicables A CHAUD, sans rechargement. Tout le reste — une
     police, une geometrie, une image — demande de reconstruire l'habillage,
     et un rechargement est alors equivalent et bien plus sur.

     La grille des randoms, elle, se touche en pleine vente : la recharger a
     chaque equipe vendue ferait sauter le ticker et relancerait l'orbite du
     logo au plus mauvais moment. */
  const CHAUD = new Set(["randoms", "card", "punchlines", "animations", "pyp"]);

  function sectionsModifiees(avant, apres) {
    const cles = new Set([...Object.keys(avant), ...Object.keys(apres)]);
    const bougees = [];
    for (const cle of cles) {
      if (JSON.stringify(avant[cle]) !== JSON.stringify(apres[cle])) bougees.push(cle);
    }
    return bougees;
  }

  let sseConnected = false;

  /* --- rechargement apres un deploiement --------------------------------
     Une source OBS garde la page chargee pendant des heures : sans cela, une
     nouvelle version du code n'y arrivait qu'en actualisant la source a la
     main. Le serveur annonce l'empreinte de son code ; si elle change, la
     page se recharge. Reserve aux pages marquees data-recharge (les sources
     OBS) : la page de reglages, elle, perdrait un travail en cours.
     L'animation d'un spot attribue n'est jamais coupee : on attend la fin. */
  const RECHARGE = self.dataset.recharge !== undefined;
  let buildVu = null;

  function verifierBuild(build) {
    if (!RECHARGE || !build) return;
    if (buildVu === null) { buildVu = build; return; }
    if (build === buildVu) return;
    console.info("[shaks] nouvelle version en ligne, rechargement");
    const recharger = () => {
      if (document.querySelector(".spot-focus, .spot-anim")) { setTimeout(recharger, 1000); return; }
      location.reload();
    };
    recharger();
  }

  function applyRemoteText(text) {
    if (text === loadedText) return;
    let bougees = null;
    try {
      bougees = sectionsModifiees(JSON.parse(loadedText), JSON.parse(text));
    } catch { /* illisible : on retombe sur le rechargement */ }

    if (bougees && bougees.length && bougees.every((cle) => CHAUD.has(cle))) {
      apply(JSON.parse(text));
      loadedText = text;
      writeCache(text);
      window.dispatchEvent(new CustomEvent("shaks:config", { detail: { sections: bougees } }));
      return;
    }

    writeCache(text);
    location.reload();
  }

  /* SSE pousse les changements sans lecture répétée. Le polling lent ne sert
     qu'en secours pendant une déconnexion du flux. */
  function watch() {
    if (!POLL_S || !loadedText) return;
    const stream = new EventSource("/api/events");
    stream.addEventListener("open", () => { sseConnected = true; });
    stream.addEventListener("error", () => { sseConnected = false; });
    stream.addEventListener("build", (event) => {
      try { verifierBuild(JSON.parse(event.data)); } catch { /* ignore */ }
    });
    stream.addEventListener("config", (event) => {
      try {
        const update = JSON.parse(event.data);
        if (isPlain(update.config)) applyRemoteText(JSON.stringify(update.config));
      } catch (err) {
        console.warn("[shaks] mise a jour SSE illisible", err);
      }
    });

    setInterval(async () => {
      if (sseConnected) return;
      if (RECHARGE) {
        try {
          const res = await fetch("/api/build", { cache: "no-store" });
          if (res.ok) verifierBuild((await res.json()).build);
        } catch { /* hors ligne */ }
      }
      try {
        const res = await fetch(API, { cache: "no-store" });
        if (!res.ok) return;
        const text = await res.text();
        applyRemoteText(text);
      } catch { /* hors ligne : on garde ce qui tourne */ }
    }, POLL_S * 1000);
  }

  (async () => {
    const source = await loadConfig();
    window.SHAKS_CONFIG_SOURCE = source;
    console.info(`[shaks] config : ${source}`);
    try {
      for (const src of THEN) await loadScript(src);
    } catch (err) {
      console.error("[shaks]", err.message);
    }
    watch();
  })();
})();
