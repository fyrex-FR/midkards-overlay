/* ==========================================================================
   MIDKARDS — Couche de fond : mise en place
   Sorti du HTML pour pouvoir etre charge APRES la configuration. En ligne,
   celle-ci arrive de facon asynchrone : un script en ligne dans la page
   s'executerait avant, et lirait donc la config embarquee au lieu de la
   config enregistree.
   ========================================================================== */
(() => {
  "use strict";
  const cfg = (window.SHAKS_CONFIG && window.SHAKS_CONFIG.arena) || {};

  /* Intensite des halos. Passe par --fx, lue a l'interieur des keyframes :
     poser opacity en inline ne servirait a rien puisque les animations
     pilotent deja cette propriete. */
  if (cfg.intensity != null) {
    const k = Math.max(0, Math.min(1.6, Number(cfg.intensity)));
    document.documentElement.style.setProperty("--fx", String(k));

    /* A zero, on RETIRE les halos au lieu de les rendre invisibles.
       Leur opacite tomberait bien a 0, mais leurs animations de transform
       continueraient de tourner : du travail de composition pour un
       resultat identique a l'ecran. */
    if (k === 0) {
      document.querySelectorAll(".bloom").forEach((el) => el.remove());
    }
  }

  /* Force du vignettage. A garder bas avec une image riche sur les bords :
     c'est lui qui ecraserait les gradins. */
  if (cfg.vignette != null) {
    const v = Math.max(0, Math.min(2, Number(cfg.vignette)));
    document.documentElement.style.setProperty("--vig", String(v));
  }

  const photo = document.getElementById("photo");
  /* Cloudflare impose aux navigateurs (OBS compris) de garder les images 4 h :
     une image livree changee sous le meme nom resterait l'ancienne. On ajoute
     donc une version aux fichiers de assets/, a monter a chaque nouvelle image. */
  const ASSETS_V = "20261118-logos";
  const versionne = (u) => (/^assets\//.test(u) ? `${u}${u.includes("?") ? "&" : "?"}v=${ASSETS_V}` : u);
  const src = versionne(cfg.image || cfg.backgroundImage || "");   // ancien nom tolere
  const LIVREE = versionne("assets/arene.jpg");

  /* background-image echoue en silence : une adresse morte ne laisse que le
     degrade sombre, sans rien dans la console. Depuis que les fonds sont
     envoyes en ligne, une adresse peut tres bien avoir ete supprimee entre
     deux directs — on verifie donc l'image avant de la poser, et on retombe
     sur celle livree avec l'overlay. */
  function poser(adresse) {
    photo.style.backgroundImage = `url("${adresse}")`;
    photo.style.opacity = String(cfg.imageOpacity ?? 1);
    if (cfg.imageBreathe !== false) photo.classList.add("is-alive");
  }

  if (src) {
    const sonde = new Image();
    sonde.onload = () => poser(src);
    sonde.onerror = () => {
      if (src === LIVREE) return;   // meme l'image livree manque : degrade seul
      console.warn(`[shaks] fond introuvable (${src}), retour sur ${LIVREE}`);
      const secours = new Image();
      secours.onload = () => poser(LIVREE);
      secours.src = LIVREE;
    };
    sonde.src = src;
  }

  /* --------------------------------------------------------------------------
     Decoupe une fenetre dans le fond
     Le fond d'arene est une image PLEINE, qui remplit tout le canvas. Tant que
     la camera de cette fenetre pousse une vraie image, ca ne se voit jamais :
     la camera est une source a part, posee AU-DESSUS du fond dans OBS, et son
     image opaque cache le fond dessous.

     Mais si la camera est mal branchee, pas encore choisie, ou coupee un
     instant, la source camera ne peint rien du tout — et sans ce decoupage,
     le fond d'arene REMPLIT la case a sa place. Le resultat trompe : a l'oeil,
     "il y a quelque chose" dans la fenetre, alors qu'il n'y a pas de camera.
     Avec le decoupage, une camera absente laisse un vrai vide, qui ne peut pas
     se confondre avec un decor.

     Le meme calcul de position que frame.js (ratio verrouille ou non), pour
     que le trou tombe pile sous le cadre de la fenetre — sinon un ecart d'un
     cote laisserait un liseré de fond visible juste a l'interieur du cadre.
     -------------------------------------------------------------------------- */
  function parseRatio(value) {
    if (value == null || value === "") return null;
    const txt = String(value).trim();
    const parts = txt.split(/[:/]/);
    if (parts.length === 2) {
      const a = parseFloat(parts[0]), b = parseFloat(parts[1]);
      return a > 0 && b > 0 ? a / b : null;
    }
    const n = parseFloat(txt);
    return n > 0 ? n : null;
  }

  function decouperFond() {
    const layout = (window.SHAKS_CONFIG && window.SHAKS_CONFIG.layout) || {};
    const scene = document.querySelector(".arena");
    if (!scene) return;

    const W = window.innerWidth, H = window.innerHeight;
    const trous = [];
    for (const cle of ["camTop", "camBreak"]) {
      const spec = layout[cle];
      if (!spec || !spec.decoupeFond) continue;
      const w = (Number(spec.width) / 100) * W;
      const ratio = parseRatio(spec.ratio);
      const h = ratio ? w / ratio : (Number(spec.height) / 100) * H;
      trous.push({ x: (W - w) / 2, y: (Number(spec.top) / 100) * H, w, h });
    }

    if (!trous.length) { scene.style.clipPath = ""; return; }

    // Rectangle plein, puis un rectangle par trou : le fill-rule "evenodd"
    // fait de chaque rectangle imbrique un vide plutot qu'une forme pleine.
    let d = `M0,0 H${W} V${H} H0 Z`;
    for (const t of trous) d += ` M${t.x},${t.y} H${t.x + t.w} V${t.y + t.h} H${t.x} Z`;
    scene.style.clipPath = `path(evenodd, "${d}")`;
  }

  decouperFond();
  // La fenetre OBS a une taille fixe, mais l'apercu du navigateur peut changer :
  // sans ca, un trou calcule au premier chargement resterait a l'ancienne taille.
  window.addEventListener("resize", decouperFond);
  })();
