/* ==========================================================================
   MIDKARDS — Bandeau overlay
   Logique : ticker gauche, logo anime au centre, carrousel a droite.
   Les reglages vivent dans config.js — rien a toucher ici.
   ========================================================================== */
(() => {
  "use strict";

  /* --- 1. Config : on fusionne avec des valeurs par defaut, pour qu'une
         cle oubliee ou mal orthographiee dans config.js ne casse rien. --- */
  const DEFAULTS = {
    ticker: { messages: [], dwellSec: 5, fadeMs: 420, separator: "◆" },
    social: { items: [], dwellSec: 5, flipMs: 620 },
    logo:   { src: "assets/logo.png", mode: "orbit", scale: 1, sweepEverySec: 22,
              tiltEverySec: 46, pulse: true },
    planet: { orbitSec: 22, tiltDeg: 14, spinSec: 40, size: 0.46,
              image: "assets/terre.png", sheet: "assets/planete.png", frames: 36,
              wrap: "logo", arcDeg: 100, ringRadius: 0.33, slices: 28,
              ringText: "MIDKARDS", ringSep: " \u25C6 ",
              ringFontRatio: 0.095 },
    typo:   { ticker: { family: "Barlow Condensed", google: false, fontFile: "",
                        weight: 600, scale: 1, tracking: 0.085, uppercase: true },
              social: { family: "", google: false, fontFile: "",
                        weight: 700, scale: 1, tracking: 0.075, uppercase: true } },
    bar:    { heightPct: 62, sheenEverySec: 18, radiusPx: 0,
              image: "", imageBarTop: 0.3297, imageBarBottom: 0.6910,
              imageFieldCenter: 0.5364, imagePadFrac: 0.075, centerFrac: 0.30,
              imageMedallionFrac: 0.1507, style: "medaillon",
              imagePlain: "", centerFracPlain: 0.24, plein: {} },
  };

  const user = window.SHAKS_CONFIG || {};
  const cfg = {
    ticker: { ...DEFAULTS.ticker, ...(user.ticker || {}) },
    social: { ...DEFAULTS.social, ...(user.social || {}) },
    logo:   { ...DEFAULTS.logo,   ...(user.logo   || {}) },
    bar:    { ...DEFAULTS.bar,    ...(user.bar    || {}) },
    planet: { ...DEFAULTS.planet, ...(user.planet || {}) },
    typo:   {
      ticker: { ...DEFAULTS.typo.ticker, ...((user.typo || {}).ticker || {}) },
      social: { ...DEFAULTS.typo.social, ...((user.typo || {}).social || {}) },
    },
  };

  const $ = (id) => document.getElementById(id);

  /* Le porteur du bandeau : la page entiere en mode autonome, la bande
     centrale a l'interieur du cadre. Tous les jetons se posent sur LUI et
     non sur :root — voir le commentaire de .banner-scope dans banner.css. */
  const host = $("banner-host");

  const ICONS = new Set(["instagram", "tiktok", "web", "whatnot", "ebay", "mail"]);

  /* --- 1b. Style du bandeau -------------------------------------------------
     A resoudre AVANT d'appliquer les reglages globaux : ceux-ci lisent
     heightPct, que le style "plein" surcharge.

     Les deux images n'ont pas les memes proportions — barre plus fine, champ
     sombre plus bas et plus etroit, encadre de deux traits lumineux. Sans ce
     jeu de valeurs distinct, le texte tomberait sur un de ces traits et
     deviendrait illisible. */
  const barPlain = String(cfg.bar.style || "medaillon").toLowerCase() === "plein";
  if (barPlain && cfg.bar.plein && typeof cfg.bar.plein === "object") {
    Object.assign(cfg.bar, cfg.bar.plein);
  }

  /* --- 2. Application des reglages globaux --------------------------------- */
  host.style.setProperty("--bar-h", `calc(var(--u) * ${cfg.bar.heightPct / 100})`);
  host.style.setProperty("--bar-radius", `${cfg.bar.radiusPx}px`);
  host.style.setProperty("--logo-scale", String(cfg.logo.scale));
  host.style.setProperty("--flip-ms", `${cfg.social.flipMs}ms`);

  const barEl = $("bar");

  /* Style du bandeau. En "plein", on prend l'image sans diamant et on ne
     reserve aucun centre : les deux zones de texte se partagent toute la
     barre, ce qui est precisement l'interet de ce style. */
  const barImage = String(
    (barPlain ? cfg.bar.imagePlain : cfg.bar.image) || cfg.bar.image || ""
  );
  const centerFrac = barPlain
    ? Number(cfg.bar.centerFracPlain ?? 0)
    : Number(cfg.bar.centerFrac ?? 0.26);

  /* --u = hauteur de reference du bandeau.
     Autonome : la hauteur de la source. Dans le cadre : la hauteur reelle de
     la bande, en px, sinon les lueurs seraient calculees sur 1920 px.

     En mode bandeau-image, --u ne peut PAS etre la hauteur de la bande : la
     bande contient tout le visuel, glow compris, alors que le texte doit etre
     dimensionne sur la seule BARRE PLEINE. On derive donc --u de la fraction
     que la barre occupe dans l'image. */
  function syncUnit() {
    if (host.dataset.unit === "viewport" && !barImage) {
      host.style.setProperty("--u", "100vh");
      return;
    }
    const bandH = host.getBoundingClientRect().height;
    if (!barImage) {
      host.style.setProperty("--u", `${bandH}px`);
      return;
    }
    const top = Number(cfg.bar.imageBarTop);
    const bot = Number(cfg.bar.imageBarBottom);
    const solidH = bandH * (bot - top);
    host.style.setProperty("--u", `${solidH / (cfg.bar.heightPct / 100)}px`);

    // Recentre le contenu sur le CHAMP SOMBRE du visuel, pas sur la barre
    // entiere : les liseres neon en haut et en bas ne sont pas symetriques,
    // le champ utile n'est donc pas au milieu de la barre.
    const field = Number(cfg.bar.imageFieldCenter);
    host.style.setProperty("--bar-offset", `${(bandH * field - bandH / 2).toFixed(2)}px`);

    const bandW = host.getBoundingClientRect().width;

    // Marge horizontale : les panneaux se terminent en pointe de chevron, le
    // texte ne doit pas y entrer. Sans cette marge il courait jusqu'au bord.
    host.style.setProperty("--pad-x",
      `${(bandW * Number(cfg.bar.imagePadFrac)).toFixed(2)}px`);

    // La colonne centrale est calee sur le medaillon, elargie pour que le logo
    // enroule ne vienne pas mordre sur le texte des panneaux lateraux.
    const span = bandW * centerFrac;
    host.style.setProperty("--assembly", `${span.toFixed(2)}px`);

    // Borne du logo en mode statique. En medaillon c'est la largeur du
    // diamant, qui doit contenir le logo ; sans diamant il n'y a rien a
    // respecter, on se cale donc sur la colonne reservee.
    const med = barPlain
      ? bandW * centerFrac * 0.8
      : bandW * Number(cfg.bar.imageMedallionFrac || 0.15) * 1.04;
    host.style.setProperty("--logo-max-w", `${med.toFixed(2)}px`);
  }

  if (barImage) {
    host.classList.add("band--image");
    host.style.backgroundImage = `url("${barImage}")`;
    barEl.classList.add("bar--image");

    /* Repli si l'image du bandeau est introuvable : le mode image efface
       l'habillage dessine en CSS, donc sans ce garde-fou le bandeau devenait
       purement invisible et il ne restait que du texte flottant. */
    const probeBar = new Image();
    probeBar.addEventListener("error", () => {
      console.warn("[shaks] image de bandeau introuvable, retour au bandeau dessine :", barImage);
      host.classList.remove("band--image");
      host.style.backgroundImage = "";
      barEl.classList.remove("bar--image");
      host.style.removeProperty("--bar-offset");
      host.style.removeProperty("--pad-x");
      host.style.setProperty("--u", `${host.getBoundingClientRect().height}px`);
      layoutTicker();
    });
    probeBar.src = barImage;
  }
  syncUnit();

  if (new URLSearchParams(location.search).has("preview")) {
    document.body.classList.add("is-preview");
  }

  /* --- 2b. Typographie ------------------------------------------------------
     Trois facons de choisir une police, dans cet ordre de priorite :
       1. fontFile  -> un fichier depose dans le dossier (police achetee)
       2. google    -> telechargee chez Google Fonts par son nom
       3. family    -> une police deja installee sur la machine
     Dans tous les cas on garde la pile de repli derriere : si la police
     n'arrive pas, le texte reste lisible au lieu de tomber en Times. */
  const FALLBACK = '"Barlow Condensed","Oswald","Roboto Condensed",' +
                   '"Helvetica Neue",Arial,sans-serif';

  /* Feuilles de style de police en attente. Il faut les attendre AVANT
     d'appeler document.fonts.load : tant que la regle @font-face n'existe pas,
     fonts.load ne trouve aucune fonte correspondante et se resout aussitot
     sans rien attendre. On mesurerait alors le ticker avec la police de repli,
     et la vitesse comme la boucle seraient fausses. */
  const fontSheets = [];

  function fontStack(family) {
    const f = String(family || "").trim();
    return f ? `"${f.replace(/"/g, "")}",${FALLBACK}` : FALLBACK;
  }

  function injectFontFile(family, url) {
    const style = document.createElement("style");
    style.textContent =
      `@font-face{font-family:"${family}";src:url("${url}");font-display:swap}`;
    document.head.appendChild(style);
  }

  /* Graisses reellement disponibles pour les polices proposees dans la page de
     reglages. C'est indispensable, pas du confort : l'API Google Fonts REFUSE
     la requete entiere si on demande une graisse qui n'existe pas, et la police
     ne se charge alors pas du tout. Or la plupart des polices d'affichage
     n'existent qu'en 400 — c'est le cas d'Anton, Bebas Neue, Monoton... */
  const GOOGLE_WEIGHTS = {
    "Anton": [400], "Bebas Neue": [400], "Russo One": [400],
    "Audiowide": [400], "Michroma": [400], "Monoton": [400],
    "Archivo Black": [400],
    "Barlow Condensed": [300, 400, 500, 600, 700, 800, 900],
    "Oswald": [200, 300, 400, 500, 600, 700],
    "Teko": [300, 400, 500, 600, 700],
    "Saira Condensed": [300, 400, 500, 600, 700, 800, 900],
    "Rajdhani": [300, 400, 500, 600, 700],
    "Chakra Petch": [300, 400, 500, 600, 700],
    "Orbitron": [400, 500, 600, 700, 800, 900],
    "Montserrat": [300, 400, 500, 600, 700, 800, 900],
    "Poppins": [300, 400, 500, 600, 700, 800, 900],
  };

  /* Graisse a utiliser reellement : la plus proche de celle demandee parmi
     celles qui existent. Renvoie null si la police est inconnue de la table —
     dans ce cas on ne precise aucune graisse, ce qui ne peut pas echouer. */
  function resolveWeight(family, wanted) {
    const avail = GOOGLE_WEIGHTS[String(family).trim()];
    if (!avail) return null;
    const w = Number(wanted) || 400;
    return avail.reduce((best, cur) =>
      Math.abs(cur - w) < Math.abs(best - w) ? cur : best, avail[0]);
  }

  function injectGoogle(family, weight) {
    const name = String(family).trim().replace(/\s+/g, "+");
    const resolved = resolveWeight(family, weight);
    const link = document.createElement("link");
    link.rel = "stylesheet";
    // Sans graisse connue, on n'en demande aucune : la requete passe toujours.
    link.href = `https://fonts.googleapis.com/css2?family=${name}` +
                (resolved ? `:wght@${resolved}` : "") + "&display=swap";
    fontSheets.push(new Promise((done) => {
      link.addEventListener("load", done);
      link.addEventListener("error", done);   // hors ligne : on n'attend pas
    }));
    document.head.appendChild(link);
    return resolved;
  }

  /* Applique une des deux zones et renvoie la police a attendre. */
  function applyTypo(spec, prefix, fallbackFamily) {
    const family = String(spec.family || "").trim() || fallbackFamily || "";

    let weight = Number(spec.weight) || 600;

    if (spec.fontFile) {
      // Un nom de famille propre a nous : le fichier peut s'appeler n'importe
      // comment, on ne se fie pas a son nom interne.
      const local = `shaks-${prefix}-local`;
      injectFontFile(local, spec.fontFile);
      host.style.setProperty(`--${prefix}-family`, fontStack(local));
    } else {
      if (spec.google && family) {
        const resolved = injectGoogle(family, weight);
        // On aligne la graisse CSS sur celle reellement chargee, sinon le
        // navigateur fabrique un faux gras et deforme le dessin de la police.
        if (resolved) weight = resolved;
      }
      host.style.setProperty(`--${prefix}-family`, fontStack(family));
    }

    host.style.setProperty(`--${prefix}-weight`, String(weight));
    host.style.setProperty(`--${prefix}-scale`, String(spec.scale || 1));
    host.style.setProperty(`--${prefix}-track`, `${Number(spec.tracking || 0)}em`);
    host.style.setProperty(`--${prefix}-case`,
      spec.uppercase === false ? "none" : "uppercase");

    return { family: spec.fontFile ? `shaks-${prefix}-local` : family, weight };
  }

  const tickerFont = applyTypo(cfg.typo.ticker, "tk", "Barlow Condensed");
  // Zone droite : famille vide = on reprend celle du ticker, pour rester
  // coherent sans avoir a la ressaisir.
  const socialSpec = cfg.typo.social;
  const socialFont = applyTypo(
    socialSpec,
    "sc",
    String(socialSpec.family || "").trim() ? "" : (cfg.typo.ticker.family || "Barlow Condensed")
  );

  /* --- 3. Logo ------------------------------------------------------------- */
  const logoEl = $("logo");
  const logoImg = $("logo-img");
  const logoSweep = $("logo-sweep");

  /* Le logo n'est retire que si aucune colonne centrale n'est reservee.
     C'est ce qui distingue les deux usages du style "plein" : garder le globe
     avec une colonne plus serree que le diamant, ou tout donner aux textes. */
  const noCenter = centerFrac <= 0;
  if (noCenter) logoEl.remove();

  const orbitMode = !noCenter
    && String(cfg.logo.mode || "static").toLowerCase() === "orbit";

  /* Rapport largeur/hauteur du logo. Valeur de depart pour le fichier fourni,
     recalculee sur les dimensions reelles du PNG des qu'il est charge : un
     logo remplace par l'utilisateur ne doit pas etre deforme. */
  let LOGO_ASPECT = 1000 / 546;

  function showTextFallback(target) {
    // Chemin de logo invalide : on retombe sur un wordmark texte plutot que
    // de laisser un trou au milieu du bandeau.
    const fb = document.createElement("span");
    fb.className = "logo__fallback";
    fb.textContent = "MIDKARDS";
    target.appendChild(fb);
  }

  /* --- 3b. Mode orbite ------------------------------------------------------
     Construit ici plutot qu'en dur dans le HTML : le balisage vivrait sinon
     en double dans index.html et cadre.html, avec le risque classique de
     les voir diverger. */

  /* Mesure les avances reelles de chaque caractere.
     Une repartition uniforme (360/N) ferait respirer l'anneau de facon
     irreguliere : un I et un W n'occupent pas la meme place. On mesure donc,
     puis on repartit au prorata de l'avance cumulee. */
  function measureChars(text, fontSize) {
    const probe = document.createElement("span");
    probe.style.cssText =
      "position:absolute;visibility:hidden;white-space:pre;font-weight:700;" +
      `font-size:${fontSize}px;font-family:${getComputedStyle(document.body).fontFamily}`;
    document.body.appendChild(probe);
    const widths = [];
    for (const ch of text) {
      probe.textContent = ch;
      widths.push(probe.getBoundingClientRect().width);
    }
    probe.remove();
    return widths;
  }

  /* Decoupe le logo en lamelles verticales posees sur un arc.
     C'est ce qui donne l'enroulement 3D en preservant l'image telle quelle :
     chaque lamelle affiche une tranche du PNG, orientee et ecartee du centre.
     Sur un tour COMPLET l'image ne tiendrait pas (voir banner.css), d'ou l'arc
     partiel : a 100 degres le developpe fait 159px pour 87px de haut. */
  function buildLogoWrap(assembly, radius) {
    const p = cfg.planet;
    const arc = (Number(p.arcDeg) || 100) * Math.PI / 180;
    const n = Math.max(8, Number(p.slices) || 28);

    const devW = radius * arc;                 // largeur developpee du logo
    const devH = devW / LOGO_ASPECT;
    const sliceW = devW / n;
    const step = arc / n;

    const frag = document.createDocumentFragment();
    for (let i = 0; i < n; i += 1) {
      const angle = (-arc / 2 + (i + 0.5) * step) * 180 / Math.PI;
      const el = document.createElement("span");
      el.className = "wrap__slice";
      // +0.6px de recouvrement : sans lui l'antialiasing laisse des raies
      // claires entre les lamelles.
      el.style.width = `${sliceW + 0.6}px`;
      el.style.height = `${devH}px`;
      el.style.marginLeft = `${-sliceW / 2}px`;
      el.style.marginTop = `${-devH / 2}px`;
      el.style.backgroundImage = `url("${cfg.logo.src}")`;
      el.style.backgroundSize = `${devW}px ${devH}px`;
      el.style.backgroundPositionX = `${-i * sliceW}px`;
      el.style.transform =
        `rotateY(${angle.toFixed(3)}deg) translateZ(${radius.toFixed(2)}px)`;
      frag.appendChild(el);
    }
    return frag;
  }

  /* Variante texte : chaque caractere est une facette du cylindre. */
  function buildTextWrap(assembly, radius) {
    const p = cfg.planet;
    const fontSize = assembly * Number(p.ringFontRatio || 0.095);
    host.style.setProperty("--ring-fs", `${fontSize}px`);

    const unit = String(p.ringText || "") + String(p.ringSep || " ");
    const circumference = 2 * Math.PI * radius;
    const unitWidth = measureChars(unit, fontSize).reduce((a, b) => a + b, 0);
    const reps = Math.max(1, Math.round(circumference / unitWidth));
    const text = unit.repeat(reps);

    const widths = measureChars(text, fontSize);
    const total = widths.reduce((a, b) => a + b, 0);
    const kerning = (circumference - total) / widths.length;

    const frag = document.createDocumentFragment();
    let cursor = 0;
    text.split("").forEach((ch, i) => {
      const advance = widths[i] + kerning;
      const angle = ((cursor + advance / 2) / circumference) * 360;
      cursor += advance;
      if (ch === " ") return;
      const span = document.createElement("span");
      span.className = "ring3d__ch";
      span.textContent = ch;
      span.style.transform =
        `translate(-50%, -50%) rotateY(${angle.toFixed(3)}deg) translateZ(${radius.toFixed(2)}px)`;
      frag.appendChild(span);
    });
    return frag;
  }

  function buildOrbit() {
    logoImg.remove();
    logoSweep.remove();
    logoEl.classList.add("logo--orbit");
    logoEl.classList.remove("is-pulsing");

    const p = cfg.planet;
    // Taille reellement rendue : elle vient de --assembly, qui depend du
    // mode (derivee de --u, ou calee sur le medaillon du visuel).
    const assembly = logoEl.getBoundingClientRect().width;
    const radius = assembly * Number(p.ringRadius || 0.33);

    host.style.setProperty("--orbit-sec", `${p.orbitSec}s`);
    host.style.setProperty("--tilt", `${p.tiltDeg}deg`);
    host.style.setProperty("--spin-sec", `${p.spinSec}s`);

    const stage = document.createElement("div");
    stage.className = "orbit-stage";

    /* --- la planete : planche de sprites rendue --- */
    const glow = document.createElement("span");
    glow.className = "planet-glow" + (cfg.logo.pulse ? " is-pulsing" : "");

    const planet = document.createElement("div");
    planet.className = "planet";
    if (p.size) {
      const pct = `${Number(p.size) * 100}%`;
      const off = `${Number(p.size) * -50}%`;
      for (const el of [planet, glow]) {
        el.style.width = pct;
        el.style.height = pct;
        el.style.margin = `${off} 0 0 ${off}`;
      }
    }

    const frames = Math.max(2, Number(p.frames) || 36);
    if (p.image) {
      // Image fixe : prioritaire, et volontairement sans animation. Une vraie
      // photo de Terre ne peut pas tourner — il n'y a qu'une face. Un ballon
      // depose depuis la page de reglages arrive par ici.
      const still = document.createElement("span");
      still.className = "planet__still";
      still.style.backgroundImage = `url("${p.image}")`;
      planet.appendChild(still);

      /* Meme garde-fou que pour la planche : depuis que les globes s'envoient
         en ligne, cette adresse peut avoir ete supprimee entre deux directs.
         Sans cela, background-image echoue en silence et laisse un trou. */
      const probeStill = new Image();
      probeStill.addEventListener("error", () => {
        console.warn("[shaks] globe introuvable, retour au degrade :", p.image);
        still.remove();
        const fb = document.createElement("span");
        fb.className = "planet__fallback";
        planet.appendChild(fb);
      });
      probeStill.src = p.image;
    } else if (p.sheet) {
      const sheet = document.createElement("span");
      sheet.className = "planet__sheet";
      sheet.style.backgroundImage = `url("${p.sheet}")`;
      host.style.setProperty("--sheet-w", `${frames * 100}%`);
      // La position en % porte sur (largeur du fond - largeur de l'element).
      // Pour tomber pile sur l'image k il faut donc aller jusqu'a
      // 100 * N/(N-1), sinon les crans se decalent et la sphere sautille.
      host.style.setProperty("--sheet-end", `${(100 * frames / (frames - 1)).toFixed(4)}%`);
      sheet.style.animationTimingFunction = `steps(${frames})`;
      planet.appendChild(sheet);

      // Meme garde-fou que pour l'image du bandeau : sans lui, une planche
      // introuvable laissait un trou a la place du globe.
      const probeSheet = new Image();
      probeSheet.addEventListener("error", () => {
        console.warn("[shaks] planche de planete introuvable, globe en degrade :", p.sheet);
        sheet.remove();
        const fb = document.createElement("span");
        fb.className = "planet__fallback";
        planet.appendChild(fb);
      });
      probeSheet.src = p.sheet;
    } else {
      const fb = document.createElement("span");
      fb.className = "planet__fallback";
      planet.appendChild(fb);
    }

    /* --- la ligne d'orbite --- */
    const line = document.createElement("span");
    line.className = "orbit-ring";
    line.style.width = `${radius * 2}px`;
    line.style.height = `${radius * 2}px`;
    line.style.marginLeft = `${-radius}px`;
    line.style.marginTop = `${-radius}px`;

    /* --- le logo enroule --- */
    const ring = document.createElement("div");
    ring.className = "ring3d";
    ring.appendChild(
      String(p.wrap || "logo").toLowerCase() === "text"
        ? buildTextWrap(assembly, radius)
        : buildLogoWrap(assembly, radius)
    );

    stage.append(line, glow, planet, ring);
    logoEl.appendChild(stage);
  }

  if (orbitMode) {
    // On mesure le logo avant de le decouper, pour ne jamais le deformer.
    const probe = new Image();
    probe.onload = () => {
      if (probe.naturalHeight) LOGO_ASPECT = probe.naturalWidth / probe.naturalHeight;
      buildOrbit();
    };
    probe.onerror = () => buildOrbit();
    probe.src = cfg.logo.src;
  } else if (!noCenter) {
    logoImg.src = cfg.logo.src;
    // Le balayage est masque par la forme du logo : meme fichier en mask-image.
    host.style.setProperty("--logo-src", `url("${cfg.logo.src}")`);

    logoImg.addEventListener("error", () => {
      logoImg.remove();
      logoSweep.remove();
      showTextFallback(logoEl);
      logoEl.classList.remove("is-pulsing");
    });

    if (cfg.logo.pulse) logoEl.classList.add("is-pulsing");
  }

  /* Declenche une animation ponctuelle puis nettoie la classe pour qu'elle
     puisse etre rejouee au tour suivant.
     On retire-reflow-remet systematiquement au lieu d'abandonner si la classe
     est encore la : sinon un setTimeout retarde (source en arriere-plan,
     machine chargee) laisse la classe collee et l'animation ne repart jamais. */
  const pulseTimers = new WeakMap();

  function pulse(el, cls, ms) {
    if (!el) return;
    clearTimeout(pulseTimers.get(el));
    el.classList.remove(cls);
    void el.offsetWidth;              // reflow : autorise le rejeu de l'animation
    el.classList.add(cls);
    pulseTimers.set(el, setTimeout(() => el.classList.remove(cls), ms + 60));
  }

  function every(seconds, fn, offsetMs = 0) {
    const s = Number(seconds);
    if (!s || s <= 0) return;           // 0 ou absent = animation desactivee
    setTimeout(() => {
      fn();
      setInterval(fn, s * 1000);
    }, offsetMs + s * 1000);
  }

  /* Balayage et inclinaison n'existent que pour le logo statique : en mode
     orbite ils entreraient en conflit avec la rotation. Et en style "plein" il
     n'y a plus de logo du tout quand la colonne centrale est nulle — sans ce
     garde-fou, deux minuteries tourneraient sur des noeuds detaches. */
  if (!orbitMode && !noCenter) {
    every(cfg.logo.sweepEverySec, () => pulse(logoSweep, "is-running", 1550));
    // Decale d'un tiers d'intervalle pour ne pas jouer en meme temps que le balayage.
    every(cfg.logo.tiltEverySec, () => pulse(logoEl, "is-tilting", 2600),
          (Number(cfg.logo.tiltEverySec) || 0) * 333);
  }

  const sheenEl = $("sheen");
  sheenEl.style.setProperty("--sheen-ms", "1400ms");
  // Le reflet CSS traverse la barre dessinee ; en mode image il est masque.
  if (!barImage) every(cfg.bar.sheenEverySec, () => pulse(sheenEl, "is-running", 1400));

  /* --- 4. Ticker gauche ---------------------------------------------------- */
  const tickerBox = $("ticker");
  const tickerTrack = $("ticker-track");

  const tickerMessages = (cfg.ticker.messages || [])
    .map((message) => String(message).trim())
    .filter(Boolean);
  const tickerFadeMs = Math.max(0, Number(cfg.ticker.fadeMs) || 420);
  const tickerDwellMs = Math.max(1200, (Number(cfg.ticker.dwellSec) || 5) * 1000);
  let tickerIdx = 0;
  let currentTicker = null;

  function makeTicker(message) {
    const item = document.createElement("span");
    item.className = "ticker__item";
    item.textContent = message;
    return item;
  }

  function fitTicker(item) {
    item.style.removeProperty("font-size");
    item.classList.remove("is-multiline");
    const avail = tickerTrack.clientWidth;
    const needed = item.scrollWidth;
    if (!avail || needed <= avail) return;

    // Les messages longs passent d'abord sur deux lignes. On ne réduit la
    // police que si ces deux lignes dépassent encore la hauteur disponible.
    item.classList.add("is-multiline");
    const height = tickerTrack.clientHeight;
    let ratio = 1;
    for (let attempt = 0; attempt < 16; attempt += 1) {
      const styles = getComputedStyle(item);
      const fontSize = parseFloat(styles.fontSize) || 1;
      const lineHeight = parseFloat(styles.lineHeight) || fontSize;
      const lines = Math.ceil(item.scrollHeight / lineHeight - 0.05);
      if (lines <= 2 && (!height || item.scrollHeight <= height)) break;
      ratio *= 0.92;
      item.style.fontSize = `calc(var(--fs-main) * var(--tk-scale, 1) * ${ratio.toFixed(3)})`;
    }
  }

  function showNextTicker() {
    const next = makeTicker(tickerMessages[tickerIdx % tickerMessages.length]);
    tickerIdx += 1;
    next.classList.add("is-entering");
    tickerTrack.appendChild(next);
    fitTicker(next);
    void next.offsetWidth;
    next.classList.remove("is-entering");

    const leaving = currentTicker;
    if (leaving) {
      leaving.classList.add("is-leaving");
      setTimeout(() => leaving.remove(), tickerFadeMs + 80);
    }
    currentTicker = next;
  }

  function startTicker() {
    tickerTrack.style.setProperty("--ticker-fade-ms", `${tickerFadeMs}ms`);
    if (!tickerMessages.length) return;
    currentTicker = makeTicker(tickerMessages[0]);
    tickerTrack.appendChild(currentTicker);
    fitTicker(currentTicker);
    tickerIdx = 1;
    if (tickerMessages.length > 1) setInterval(showNextTicker, tickerDwellMs);
  }

  function layoutTicker() {
    if (currentTicker) fitTicker(currentTicker);
  }

  /* --- 5. Carrousel droite ------------------------------------------------- */
  const socialBox = $("social");
  const items = (cfg.social.items || []).filter((it) => it && it.label);
  let socialIdx = 0;
  let currentCell = null;

  function makeCell(item) {
    const cell = document.createElement("div");
    cell.className = "social__cell";

    const name = ICONS.has(item.icon) ? item.icon : "web";
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("class", "social__icon");
    svg.setAttribute("aria-hidden", "true");
    const use = document.createElementNS("http://www.w3.org/2000/svg", "use");
    use.setAttribute("href", `#ic-${name}`);
    svg.appendChild(use);

    const label = document.createElement("span");
    label.className = "social__label";
    label.textContent = item.label;

    cell.appendChild(svg);
    cell.appendChild(label);
    return cell;
  }

  /* Un libelle long (une URL, typiquement) deborderait de sa colonne et
     passerait sous le logo. On reduit alors la taille de cette entree la. */
  function fitCell(cell) {
    const avail = socialBox.clientWidth;
    if (!avail) return;
    const needed = cell.scrollWidth;
    if (needed <= avail) return;
    const ratio = Math.max(0.55, avail / needed);
    cell.style.setProperty("--fs-cell", `calc(var(--fs-main) * ${ratio.toFixed(3)})`);
  }

  function showNext() {
    const next = makeCell(items[socialIdx % items.length]);
    socialIdx += 1;

    next.classList.add("is-entering");
    socialBox.appendChild(next);
    fitCell(next);
    void next.offsetWidth;              // force le reflow avant de retirer la classe
    next.classList.remove("is-entering");

    const leaving = currentCell;
    if (leaving) {
      leaving.classList.add("is-leaving");
      setTimeout(() => leaving.remove(), cfg.social.flipMs + 80);
    }
    currentCell = next;
  }

  function startSocial() {
    if (!items.length) return;
    currentCell = makeCell(items[0]);
    socialBox.appendChild(currentCell);
    fitCell(currentCell);
    socialIdx = 1;

    if (items.length < 2) return;       // une seule entree : rien a faire tourner
    const dwell = Math.max(1.2, Number(cfg.social.dwellSec) || 5);
    setInterval(showNext, dwell * 1000);
  }

  /* --- 6. Demarrage -------------------------------------------------------- */
  /* On attend les polices : mesurer le ticker avant leur chargement donnerait
     une largeur fausse, et donc une vitesse et une boucle decalees. */
  function boot() {
    syncUnit();
    startSocial();
    startTicker();

    // La source OBS peut etre redimensionnee a la souris : on re-mesure.
    if (typeof ResizeObserver === "function") {
      let raf = 0;
      const onResize = () => {
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(() => { syncUnit(); layoutTicker(); });
      };
      new ResizeObserver(onResize).observe(tickerBox);
      new ResizeObserver(onResize).observe(host);
    }
  }

  /* Le ticker mesure la largeur de son texte pour decider s'il defile et a
     quelle vitesse. Cette mesure doit se faire avec la BONNE police, dans cet
     ordre strict :
       1. attendre les feuilles de style de police
       2. seulement ensuite demander le chargement des fontes
       3. et enfin mesurer
     Le filet de securite demarre quand meme au bout de 3 s : hors connexion,
     mieux vaut un rendu avec la police de repli que rien du tout. */
  const fonts = document.fonts;
  let booted = false;
  const bootOnce = () => { if (!booted) { booted = true; boot(); } };

  (async () => {
    try {
      await Promise.all(fontSheets);
      if (fonts && fonts.load) {
        await Promise.all(
          [tickerFont, socialFont]
            .filter((f) => f && f.family)
            .map((f) => fonts.load(`${f.weight} 40px "${f.family}"`).catch(() => null))
        );
      }
      if (fonts && fonts.ready) await fonts.ready;
    } catch (err) {
      console.warn("[shaks] chargement des polices incomplet", err);
    }
    bootOnce();
  })();

  setTimeout(bootOnce, 3000);
})();
