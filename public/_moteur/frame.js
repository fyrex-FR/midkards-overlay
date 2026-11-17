/* ==========================================================================
   MIDKARDS — Couche de cadre
   Positionne les fenetres camera et la bande centrale d'apres config.js,
   puis pilote les effets ponctuels.

   Doit etre charge AVANT banner.js : celui-ci lit la hauteur reelle de la
   bande pour calculer son unite --u, donc la bande doit deja etre dimensionnee.
   ========================================================================== */
(() => {
  "use strict";

  const DEFAULTS = {
    camTop:   { top: 3, height: 20.7, width: 80, ratio: "" },
    banner:   { top: 18, height: 16.9, width: 80 },
    camBreak: { top: 30, height: 70, width: 80, ratio: "" },
    showCorners: false,
    stageTopPct: 4,
    stageBottomPct: 0,
    safeTopPct: 10,
    safeBottomPct: 30,
    safeSidePct: 10,
    ringSec: 9,
    scanEverySec: 34,
    showSafeZones: false,
  };

  const user = (window.SHAKS_CONFIG && window.SHAKS_CONFIG.layout) || {};
  const cfg = { ...DEFAULTS, ...user };
  cfg.camTop = { ...DEFAULTS.camTop, ...(user.camTop || {}) };
  cfg.banner = { ...DEFAULTS.banner, ...(user.banner || {}) };
  cfg.camBreak = { ...DEFAULTS.camBreak, ...(user.camBreak || {}) };

  const root = document.documentElement;
  const $ = (id) => document.getElementById(id);

  /* --- Zones sures ---------------------------------------------------------
     Le cadre exterieur s'arrete a ces limites pour ne pas dessiner derriere
     l'entete du vendeur en haut ni le fil de chat en bas. */
  root.style.setProperty("--stage-top", `${cfg.stageTopPct}%`);
  /* A zero, le cadre est prolonge SOUS le canvas : sinon son liseré et ses
     chevrons du bas se dessineraient au ras de l'image, donc par-dessus la
     camera — le cadre passe au-dessus des cameras. */
  const sb = Number(cfg.stageBottomPct);
  root.style.setProperty("--stage-bottom", `${sb <= 0 ? -2.5 : sb}%`);
  if (sb <= 0) {
    const stage = document.querySelector(".stage");
    if (stage) stage.classList.add("is-open-bottom");
  }
  root.style.setProperty("--safe-top", `${cfg.safeTopPct}%`);
  root.style.setProperty("--safe-bottom", `${cfg.safeBottomPct}%`);
  root.style.setProperty("--safe-side", `${cfg.safeSidePct ?? 10}%`);
  root.style.setProperty("--ring-sec", `${cfg.ringSec}s`);

  /* --- Placement -----------------------------------------------------------
     Les % portent sur la source elle-meme (aucun ancetre positionne), donc
     ils se lisent exactement comme des coordonnees sur le canvas OBS. */
  /* Accepte "16:9", "16/9" ou un nombre. Renvoie null si vide ou illisible. */
  function parseRatio(value) {
    if (value == null || value === "") return null;
    const txt = String(value).trim();
    const parts = txt.split(/[:/]/);
    if (parts.length === 2) {
      const a = parseFloat(parts[0]), b = parseFloat(parts[1]);
      if (a > 0 && b > 0) return a / b;
      return null;
    }
    const n = parseFloat(txt);
    return n > 0 ? n : null;
  }

  function place(el, spec) {
    if (!el || !spec) return;
    el.style.top = `${spec.top}%`;
    if (spec.width != null) el.style.width = `${spec.width}%`;

    /* Ratio verrouille : c'est le navigateur qui calcule la hauteur, via
       aspect-ratio. La fenetre epouse alors exactement le format de la camera,
       qui la remplit sans bande noire ni recadrage. */
    const ratio = parseRatio(spec.ratio);
    if (ratio) {
      el.style.aspectRatio = String(ratio);
      el.style.height = "auto";
      el.classList.remove("is-bleeding");
      return;
    }

    el.style.aspectRatio = "";

    /* Une fenetre qui arrive au ras du bas du canvas est prolongee hors champ.
       C'est necessaire, pas cosmetique : le cadre se dessine AU-DESSUS des
       cameras, donc son liseré, ses equerres et son ombre du bas apparaitraient
       en travers de l'image. En debordant, ces ornements tombent en dehors et
       l'image se termine franchement sur le bord, comme dans une vraie prod. */
    const bottom = Number(spec.top) + Number(spec.height);
    const overshoot = bottom >= 99.5 ? 2.5 : 0;
    el.style.height = `${Number(spec.height) + overshoot}%`;
    el.classList.toggle("is-bleeding", overshoot > 0);
  }

  if (cfg.showCorners === false) {
    document.querySelectorAll(".win").forEach((w) => w.classList.add("no-corners"));
  }

  /* Fenetre "nue" : ni lisere, ni halo, ni anneau, ni balayage — juste le trou
     transparent ou la camera apparait. Demande explicite pour la camera break :
     coller la camera au bord du cadre laisse moins de place pour ses propres
     ornements, autant les retirer plutot que les laisser mordre sur l'image. */
  if (cfg.camTop && cfg.camTop.bare) $("win-top")?.classList.add("is-bare");
  if (cfg.camBreak && cfg.camBreak.bare) $("win-break")?.classList.add("is-bare");

  place($("win-top"), cfg.camTop);
  place($("win-break"), cfg.camBreak);
  place($("banner-host"), cfg.banner);

  /* --- Effet de balayage sur la fenetre break ------------------------------ */
  const scan = $("scan-break");
  const sec = Number(cfg.scanEverySec);
  const breakEstNue = Boolean(cfg.camBreak && cfg.camBreak.bare);
  if (scan && sec > 0 && !breakEstNue) {
    const fire = () => {
      // retirer / reflow / remettre, sinon l'animation ne se rejoue pas
      scan.classList.remove("is-running");
      void scan.offsetWidth;
      scan.classList.add("is-running");
      setTimeout(() => scan.classList.remove("is-running"), 2500);
    };
    setTimeout(() => { fire(); setInterval(fire, sec * 1000); }, sec * 1000);
  }

  /* --- Reperes de reglage -------------------------------------------------- */
  const wantZones = cfg.showSafeZones
    || new URLSearchParams(location.search).has("zones");
  if (wantZones) document.body.classList.add("show-zones");
})();
