/* ==========================================================================
   MIDKARDS — Page de reglages
   Edite la config, montre le resultat en direct, et regenere config.js.

   Pourquoi regenerer un fichier plutot que d'enregistrer tout seul : une page
   web ne peut pas ecrire sur le disque. Et le localStorage ne peut pas servir
   de pont, parce que cette page tourne dans le navigateur de l'utilisateur
   alors que l'overlay tourne dans le navigateur embarque d'OBS — deux
   stockages separes. Le seul pont possible est le fichier lui-meme.
   ========================================================================== */
(() => {
  "use strict";

  const CANVAS_H = 1920;
  const CANVAS_W = 1080;
  const ICONS = ["instagram", "tiktok", "web", "whatnot", "ebay", "mail"];

  /* Polices proposees dans la liste. Toutes disponibles sur Google Fonts, donc
     choisir l'une d'elles suffit : le code coche "google" tout seul. Le champ
     reste libre, on peut y taper n'importe quel autre nom — une autre police
     Google, ou une police installee sur la machine. */
  const GOOGLE_FONTS = [
    "Barlow Condensed", "Anton", "Bebas Neue", "Oswald", "Teko",
    "Archivo Black", "Saira Condensed", "Russo One", "Rajdhani",
    "Chakra Petch", "Orbitron", "Audiowide", "Michroma", "Monoton",
    "Montserrat", "Poppins",
  ];

  const ORIGINAL = structuredClone(window.SHAKS_CONFIG);
  let cfg = structuredClone(window.SHAKS_CONFIG);


  const $ = (id) => document.getElementById(id);

  /* --- acces par chemin ("layout.camTop.top") ------------------------------ */
  const get = (path) => path.split(".").reduce((o, k) => (o == null ? o : o[k]), cfg);
  function set(path, value) {
    const keys = path.split(".");
    const last = keys.pop();
    let o = cfg;
    for (const k of keys) {
      if (!o[k] || typeof o[k] !== "object") o[k] = {};
      o = o[k];
    }
    o[last] = value;
  }

  /* --- schema : chaque reglage decrit une seule fois ----------------------
     L'ordre compte. Le premier groupe porte "essential" : il reste ouvert en
     permanence et ne contient que ce qui change d'un direct a l'autre. Tout le
     reste est repliable et ferme au depart. Afficher les 62 reglages d'un coup
     revenait a noyer les quatre qui servent vraiment chaque soir.
     ---------------------------------------------------------------------- */
  const SCHEMA = [
    { title: "L'essentiel", essential: true,
      note: "Ce qui change d'un direct à l'autre. Le reste est rangé en dessous.",
      fields: [
      { path: "themes", type: "themes", label: "Thèmes",
        help: "Un thème apparie un décor et un globe : un clic bascule tout l'habillage. Il ne porte que ces deux images, pour qu'appliquer un thème ne défasse jamais un réglage ajusté ailleurs." },
      { path: "ticker.messages", type: "list", label: "Messages",
        help: "Ils défilent en boucle si le texte dépasse la place disponible, sinon ils restent fixes." },
      { path: "social.items", type: "social", label: "Entrées du carrousel",
        help: "Elles s'affichent une par une. Un libellé trop long se réduit tout seul." },
      { path: "bar.style", type: "select", label: "Style du bandeau",
        options: [["medaillon", "Avec le médaillon central"],
                  ["plein", "Barre continue, sans médaillon"]],
        help: "Sans médaillon, le losange disparaît et les textes de gauche et de droite récupèrent sa place. Le globe et le logo qui tourne autour restent." },
      { path: "arena.image", type: "media", slot: "fond", label: "Décor de fond",
        help: "Réduit à 1920 px et stocké en ligne : rien à poser dans le dossier, et ça suit dans OBS tout seul." },
      { path: "planet.image", type: "media", slot: "globe", label: "Globe central",
        help: "Un ballon de basket pour un break NBA, un ballon de foot, une balle de baseball… Le logo continue de tourner autour. À l'envoi, le fond uni est détouré, l'image découpée en rond, et un ombrage est cuit dedans pour que ça lise comme une sphère et pas comme un autocollant." },
    ]},

    { title: "Punchlines du spot attribué", fields: [
      { path: "punchlines.actif", type: "check", label: "Afficher une punchline",
        help: "La phrase sous le logo quand un spot tombe. Décoché, seul le nom de l'équipe s'affiche." },
      { path: "punchlines.phrases", type: "list", label: "Phrases",
        ajout: "+ Ajouter une phrase", nouveau: "Nouvelle phrase",
        help: "Une phrase tirée au hasard à chaque spot, la même dans la régie et dans OBS. S'applique en direct, sans recharger l'overlay. Courtes de préférence : au-delà d'une quarantaine de caractères, elle passe sur deux lignes." },
    ]},

    { title: "Animations du spot attribué", fields: [
      { path: "animations.catcheur", type: "check", label: "Le catcheur",
        help: "Le logo tombe du haut, s'écrase et rebondit, le tampon VENDU s'abat." },
      { path: "animations.shooteur", type: "check", label: "Le shooteur",
        help: "Un bonhomme bâton arrive en dribblant et shoote : SWISH, le logo jaillit du panier." },
      { path: "animations.pince", type: "check", label: "La pince",
        help: "La pince de fête foraine attrape une carte mystère, manque de la lâcher, et la carte se retourne sur le logo. À chaque vente, une animation cochée est tirée au hasard, jamais deux fois la même d'affilée. Tout décoché, le catcheur reste." },
    ]},

    { title: "Textes et réseaux", fields: [
      { path: "ticker.separator", type: "text", label: "Séparateur",
        help: "Le symbole entre deux messages." },
      { path: "ticker.dwellSec", type: "range", label: "Texte de gauche : durée d'affichage", min: 2, max: 15, step: 0.5, unit: " s" },
      { path: "ticker.fadeMs", type: "range", label: "Texte de gauche : durée du fondu", min: 100, max: 1500, step: 20, unit: " ms" },
      { path: "typo.ticker.scale", type: "range", label: "Texte de gauche : taille de police", min: 0.5, max: 2, step: 0.05 },
      { path: "social.dwellSec", type: "range", label: "Réseaux (droite) : durée d'affichage", min: 2, max: 15, step: 0.5, unit: " s" },
      { path: "social.flipMs", type: "range", label: "Réseaux (droite) : durée de la bascule", min: 200, max: 1200, step: 20, unit: " ms" },
      { path: "typo.social.scale", type: "range", label: "Réseaux (droite) : taille de police", min: 0.5, max: 2, step: 0.05 },
      { path: "bar.heightPct", type: "range", label: "Taille de base de la barre", min: 40, max: 90, step: 1, unit: " %",
        help: "En style barre continue, l'image a son propre calage et ce curseur reste sans effet." },
    ]},

    { title: "Polices", fields: [
      { path: "typo.ticker.family", type: "font", label: "Police du texte défilant",
        googlePath: "typo.ticker.google",
        help: "Choisis dans la liste, ou tape le nom de n'importe quelle police — une autre police Google Fonts, ou une police installée sur ta machine." },
      { path: "typo.ticker.google", type: "check", label: "Aller la chercher chez Google Fonts",
        help: "À décocher seulement si la police est déjà installée sur ta machine." },
      { path: "typo.ticker.fontFile", type: "text", label: "…ou un fichier de police",
        help: "Pour une police que tu as achetée : pose le fichier dans assets/fonts/ et mets son chemin ici, par exemple assets/fonts/MaPolice.woff2. Il est prioritaire sur le nom au-dessus." },
      { path: "typo.ticker.weight", type: "range", label: "Graisse", min: 300, max: 900, step: 100,
        help: "Toutes les polices n'ont pas toutes les graisses. Si rien ne change, elle n'a que la sienne." },
      { path: "typo.ticker.tracking", type: "range", label: "Espacement des lettres", min: -0.02, max: 0.25, step: 0.005 },
      { path: "typo.ticker.uppercase", type: "check", label: "Tout en capitales" },

      { path: "typo.social.family", type: "font", label: "Police des réseaux",
        googlePath: "typo.social.google",
        help: "Laisse vide pour reprendre la même que le texte défilant." },
      { path: "typo.social.google", type: "check", label: "Aller la chercher chez Google Fonts" },
      { path: "typo.social.weight", type: "range", label: "Graisse des réseaux", min: 300, max: 900, step: 100 },
      { path: "typo.social.tracking", type: "range", label: "Espacement des réseaux", min: -0.02, max: 0.25, step: 0.005 },
      { path: "typo.social.uppercase", type: "check", label: "Réseaux en capitales" },
    ]},

    { title: "Logo et planète", fields: [
      { path: "logo.mode", type: "select", label: "Mode",
        options: [["orbit", "Planète + logo enroulé autour"], ["static", "Logo posé au centre"]] },
      { path: "planet.orbitSec", type: "range", label: "Tour du logo", min: 8, max: 60, step: 1, unit: " s",
        help: "Plus c'est court, plus le logo revient vite — mais plus ça s'agite." },
      { path: "planet.arcDeg", type: "range", label: "Taille du logo", min: 60, max: 150, step: 5, unit: "°",
        help: "Portion du tour occupée par le logo. Plus grand = logo plus gros ET plus haut." },
      { path: "planet.tiltDeg", type: "range", label: "Inclinaison", min: 0, max: 40, step: 1, unit: "°",
        help: "Reste petit : au-delà de 30 le logo se couche à plat et devient illisible." },
      { path: "planet.ringRadius", type: "range", label: "Écartement du logo", min: 0.2, max: 0.45, step: 0.01 },
      { path: "planet.size", type: "range", label: "Taille du globe", min: 0.25, max: 0.7, step: 0.01 },
      { path: "planet.slices", type: "range", label: "Finesse de la courbure", min: 12, max: 48, step: 2,
        help: "À monter seulement si on voit des angles dans le logo enroulé." },
      { path: "logo.pulse", type: "check", label: "Respiration de la lueur" },
    ]},

    { title: "Caméras et bandeau — placement", fields: [
      { path: "layout.camTop.ratio", type: "ratio", label: "Caméra animateur — format",
        help: "Verrouille la fenêtre sur le format de ta caméra : elle la remplit alors exactement, sans bande noire ni recadrage. Vide le champ pour régler la hauteur à la main." },
      { path: "layout.camTop.top", type: "range", label: "Caméra animateur — position", min: 2, max: 30, step: 0.5, unit: " %" },
      { path: "layout.camTop.height", type: "range", label: "Caméra animateur — hauteur", min: 10, max: 32, step: 0.2, unit: " %" },
      { path: "layout.camTop.width", type: "range", label: "Caméra animateur — largeur", min: 50, max: 98, step: 1, unit: " %" },
      { path: "layout.banner.top", type: "range", label: "Bandeau — position", min: 15, max: 55, step: 0.1, unit: " %" },
      { path: "layout.banner.height", type: "range", label: "Bandeau — hauteur", min: 8, max: 26, step: 0.1, unit: " %" },
      { path: "layout.banner.width", type: "range", label: "Bandeau — largeur", min: 60, max: 100, step: 1, unit: " %" },
      { path: "layout.camBreak.ratio", type: "ratio", label: "Caméra break — format",
        help: "Laisse vide pour la table : recadrer une caméra 16:9 en portrait est justement ce qu'on veut, on garde le centre et on coupe les côtés." },
      { path: "layout.camBreak.top", type: "range", label: "Caméra break — position", min: 30, max: 60, step: 0.5, unit: " %" },
      { path: "layout.camBreak.height", type: "range", label: "Caméra break — hauteur", min: 15, max: 70, step: 0.5, unit: " %",
        help: "Au ras du bas du canvas, la fenêtre est prolongée hors champ : ses ornements passent en dehors de l'image au lieu de se dessiner en travers." },
      { path: "layout.camBreak.width", type: "range", label: "Caméra break — largeur", min: 50, max: 98, step: 1, unit: " %" },
      { path: "layout.camBreak.bare", type: "check", label: "Caméra break — cadre nu",
        help: "Retire liseré, halo, anneau et balayage : juste la caméra, sans aucun ornement dessus. Utile quand la fenêtre est collée au bord et qu'il ne reste plus de marge pour eux." },
      { path: "layout.camBreak.decoupeFond", type: "check", label: "Caméra break — trou dans le fond",
        help: "Découpe un vrai vide dans le fond d'arène à l'emplacement de cette fenêtre. Sans caméra active, ça montre du vide plutôt que le fond qui remplit la case à sa place — pratique pour voir tout de suite si la caméra pousse une image." },
      { path: "randoms.actif", type: "check", label: "Afficher la grille des équipes",
        help: "Se pilote aussi depuis la roue spot, en direct." },
      { path: "randoms.ecart", type: "range", label: "Grille des équipes — écart sous le bandeau", min: -3, max: 20, step: 0.2, unit: " %",
        help: "Compté depuis la barre du bandeau, pas depuis le haut du canvas : la grille suit toute seule si tu déplaces le bandeau." },
      { path: "randoms.width", type: "range", label: "Grille des équipes — largeur", min: 50, max: 100, step: 1, unit: " %",
        help: "Largeur maximale. La grille reste de toute façon dans la partie visible au téléphone et à l'écart des icônes Whatnot : elle peut donc être plus étroite que ce réglage." },
      { path: "randoms.margeIcones", type: "range", label: "Grille des équipes — place pour les icônes Whatnot", min: 0, max: 25, step: 0.5, unit: " %",
        help: "La colonne d'icônes à droite de l'écran Whatnot (Plus, Mises en avant, Clip…). La grille reste centrée et se rétrécit des deux côtés pour s'arrêter avant. 0 = pleine largeur." },
      { path: "randoms.hauteurCases", type: "range", label: "Grille des équipes — hauteur des cases", min: 0.7, max: 1.5, step: 0.05,
        help: "Hauteur d'une case par rapport à sa largeur. Plus haut = logos plus grands, mais la grille descend : elle doit rester au-dessus du chat Whatnot." },
      { path: "randoms.opacite", type: "range", label: "Grille des équipes — opacité", min: 0.3, max: 1, step: 0.05,
        help: "La caméra du bas doit rester lisible dessous." },
      { path: "randoms.voile", type: "range", label: "Grille des équipes — voile de fond", min: 0, max: 0.6, step: 0.05,
        help: "0 = transparent, c'est le réglage voulu : les logos flottent sur la caméra. À monter seulement si la caméra du bas devient claire au point de manger les logos sombres." },
      { path: "randoms.parLigne", type: "range", label: "Grille des équipes — équipes par ligne", min: 6, max: 15, step: 1,
        help: "30 équipes (NBA) ou 32 (NFL) à ce nombre par ligne : une ligue de plus se rajoute en une ligne de reste centrée, sans redistribuer les cases existantes." },
      { path: "randoms.logoUrl", type: "text", label: "Logos des équipes — modèle d'adresse",
        help: "Facultatif. Par défaut assets/logos/{ligue}/{ABBR}.png — {ligue} devient nba ou nfl, {ABBR} devient LAL, {abbr} devient lal. Vide, ce sont les sigles sur la couleur de l'équipe. Une image qui ne charge pas laisse le sigle en place." },
      { type: "budget" },
      { type: "obs" },
    ]},

    { title: "Cadre et repères", fields: [
      { path: "layout.stageTopPct", type: "range", label: "Cadre décoratif — haut", min: 0, max: 20, step: 0.5, unit: " %" },
      { path: "layout.stageBottomPct", type: "range", label: "Cadre décoratif — bas", min: 0, max: 25, step: 0.5, unit: " %" },
      { path: "layout.safeTopPct", type: "range", label: "Repère interface — haut", min: 0, max: 20, step: 0.5, unit: " %",
        help: "Simple repère, pas une limite : les caméras peuvent passer dessous." },
      { path: "layout.safeBottomPct", type: "range", label: "Repère interface — bas", min: 5, max: 35, step: 0.5, unit: " %",
        help: "Là où le chat de la plateforme se superpose. Les caméras ont le droit d'aller dessous — le chat est masquable par le viewer." },
      { path: "layout.safeSidePct", type: "range", label: "Repère rognage — côtés", min: 0, max: 15, step: 0.5, unit: " %",
        help: "Sur téléphone, la plupart des plateformes remplissent tout l'écran sans bande noire : comme un téléphone est plus haut que notre image, elles rognent les côtés, pas le haut ni le bas. Ce que tu veux vraiment voir (visage, cartes) doit rester en dehors de cette bande — contrairement au haut/bas, ici c'est une vraie perte, pas juste un recouvrement." },
      { path: "layout.showCorners", type: "check", label: "Bras d'angle sur les caméras",
        help: "Décoche pour un cadrage au liseré seul, plus sobre." },
      { path: "layout.showSafeZones", type: "check", label: "Afficher les repères d'interface" },
    ]},

    { title: "Décor et effets", fields: [
      { path: "arena.intensity", type: "range", label: "Halos de lumière", min: 0, max: 1.6, step: 0.05,
        help: "COÛTE DU DÉBIT : les halos balayent 88 % de l'image, donc chaque image doit être ré-encodée en entier. À 3500 kbps ce débit est pris à tes cartes. Mets 0 pour un décor totalement fixe." },
      { path: "arena.vignette", type: "range", label: "Assombrissement des bords", min: 0, max: 2, step: 0.05,
        help: "À garder bas : c'est lui qui écrase les gradins." },
      { path: "arena.imageBreathe", type: "check", label: "Respiration lumineuse du décor",
        help: "L'EFFET LE PLUS COÛTEUX : il fait changer 100 % des pixels à chaque image. Déconseillé au débit demandé par Whatnot." },
      { path: "layout.ringSec", type: "range", label: "Lumière autour des fenêtres", min: 3, max: 30, step: 1, unit: " s" },
      { path: "layout.scanEverySec", type: "range", label: "Balayage sur la fenêtre break", min: 0, max: 90, step: 1, unit: " s",
        help: "0 = jamais." },
      { path: "bar.sheenEverySec", type: "range", label: "Reflet du bandeau", min: 0, max: 60, step: 1, unit: " s",
        help: "Sans effet quand le bandeau est une image." },
    ]},

    { title: "Images et calage (avancé)", fields: [
      { path: "logo.src", type: "text", label: "Logo" },
      { path: "bar.image", type: "text", label: "Image du bandeau" },
      { path: "bar.imageBarTop", type: "range", label: "Haut de la barre dans l'image", min: 0, max: 0.6, step: 0.005 },
      { path: "bar.imageBarBottom", type: "range", label: "Bas de la barre dans l'image", min: 0.4, max: 1, step: 0.005 },
      { path: "bar.imageFieldCenter", type: "range", label: "Centre du champ de texte", min: 0.3, max: 0.7, step: 0.005,
        help: "Pas forcément 0.5 : les liserés du haut et du bas ne sont pas symétriques." },
      { path: "bar.imagePadFrac", type: "range", label: "Marge latérale", min: 0, max: 0.2, step: 0.005 },
      { path: "bar.centerFrac", type: "range", label: "Largeur réservée au médaillon", min: 0.15, max: 0.45, step: 0.01 },
      { path: "bar.centerFracPlain", type: "range", label: "Largeur du globe (barre continue)", min: 0, max: 0.40, step: 0.01,
        help: "Place réservée au globe en style barre continue. À 0, le globe disparaît et les deux textes prennent toute la barre." },
    ]},
  ];

  /* --- construction du formulaire ---------------------------------------- */
  const form = $("form");

  /* Relie l'intitule d'un champ a son controle : un clic sur l'intitule
     donne le focus, et un lecteur d'ecran annonce le bon nom. Les cases a
     cocher l'ont deja (le label les enveloppe). */
  let numeroChamp = 0;
  function lier(wrap) {
    const label = wrap.querySelector(":scope > label");
    if (!label || label.control) return wrap;
    const champ = wrap.querySelector("input, select, textarea");
    if (!champ) return wrap;
    if (!champ.id) champ.id = `reglage-${(numeroChamp += 1)}`;
    label.htmlFor = champ.id;
    return wrap;
  }

  function labelRow(text, valueEl) {
    const l = document.createElement("label");
    const s = document.createElement("span");
    s.textContent = text;
    l.append(s);
    if (valueEl) l.append(valueEl);
    return l;
  }

  function addHelp(wrap, help) {
    if (!help) return;
    const p = document.createElement("p");
    p.className = "help";
    p.textContent = help;
    wrap.append(p);
  }

  function buildRange(f) {
    const wrap = document.createElement("div");
    wrap.className = "field";
    const val = document.createElement("span");
    val.className = "val";
    const input = document.createElement("input");
    input.type = "range";
    input.dataset.path = f.path;
    input.min = f.min; input.max = f.max; input.step = f.step;
    input.value = Number(get(f.path));

    const show = () => {
      const n = Number(input.value);
      val.textContent = (f.step < 1 ? n.toFixed(String(f.step).split(".")[1].length) : n)
        + (f.unit || "");
    };
    show();
    // Permet a un bouton de preset de remettre ce champ a jour sans recharger.
    input.addEventListener("shaks:sync", () => {
      input.value = Number(get(f.path));
      show();
    });
    input.addEventListener("input", () => {
      set(f.path, Number(input.value));
      show();
      onChange();
    });
    wrap.append(labelRow(f.label, val), input);
    addHelp(wrap, f.help);
    return wrap;
  }

  /* Champ police : une saisie libre, avec la liste en suggestions.
     Un simple menu deroulant enfermerait dans ma liste ; un simple champ
     texte n'aiderait pas. Le datalist donne les deux. */
  function buildFont(f) {
    const wrap = document.createElement("div");
    wrap.className = "field";
    const input = document.createElement("input");
    input.type = "text";
    input.setAttribute("list", "shaks-fonts");
    input.placeholder = "Barlow Condensed";
    input.value = get(f.path) ?? "";

    input.addEventListener("input", () => {
      set(f.path, input.value);
      /* Si le nom saisi est une police Google connue, on active la recuperation
         automatiquement. Sinon il choisirait une police et rien ne se passerait
         — c'est le piege d'usage le plus previsible ici. */
      if (f.googlePath && GOOGLE_FONTS.includes(input.value.trim())) {
        set(f.googlePath, true);
        const cb = document.querySelector(`input[data-path="${f.googlePath}"]`);
        if (cb) cb.checked = true;
      }
      onChange();
    });
    wrap.append(labelRow(f.label), input);
    addHelp(wrap, f.help);
    return wrap;
  }

  const RATIOS = ["16:9", "16:10", "3:2", "4:3", "5:4", "1:1", "9:16"];

  /* Champ format : saisie libre avec les formats courants en suggestions.
     Accepte "16:9", "16/9" ou un nombre. */
  function buildRatio(f) {
    const wrap = document.createElement("div");
    wrap.className = "field";
    const input = document.createElement("input");
    input.type = "text";
    input.dataset.path = f.path;
    input.setAttribute("list", "shaks-ratios");
    input.placeholder = "vide = hauteur réglée à la main";
    input.value = get(f.path) ?? "";
    input.addEventListener("input", () => { set(f.path, input.value.trim()); onChange(); });
    input.addEventListener("shaks:sync", () => { input.value = get(f.path) ?? ""; });
    wrap.append(labelRow(f.label), input);
    addHelp(wrap, f.help);
    return wrap;
  }

  function buildText(f) {
    const wrap = document.createElement("div");
    wrap.className = "field";
    const input = document.createElement("input");
    input.type = "text";
    input.value = get(f.path) ?? "";
    input.addEventListener("input", () => { set(f.path, input.value); onChange(); });
    wrap.append(labelRow(f.label), input);
    addHelp(wrap, f.help);
    return wrap;
  }

  function buildSelect(f) {
    const wrap = document.createElement("div");
    wrap.className = "field";
    const sel = document.createElement("select");
    for (const [v, t] of f.options) {
      const o = document.createElement("option");
      o.value = v; o.textContent = t;
      sel.append(o);
    }
    sel.value = String(get(f.path));
    sel.addEventListener("change", () => { set(f.path, sel.value); onChange(); });
    wrap.append(labelRow(f.label), sel);
    addHelp(wrap, f.help);
    return wrap;
  }

  function buildCheck(f) {
    const wrap = document.createElement("div");
    wrap.className = "field field--check";
    const l = document.createElement("label");
    const input = document.createElement("input");
    input.type = "checkbox";
    input.dataset.path = f.path;
    input.checked = Boolean(get(f.path));
    input.addEventListener("change", () => { set(f.path, input.checked); onChange(); });
    const s = document.createElement("span");
    s.textContent = f.label;
    l.append(input, s);
    wrap.append(l);
    addHelp(wrap, f.help);
    return wrap;
  }

  /* Liste de textes simples (les messages du ticker, les punchlines). */
  function buildList(f) {
    const wrap = document.createElement("div");
    wrap.className = "field";
    const box = document.createElement("div");
    box.className = "list";

    const render = () => {
      box.textContent = "";
      const items = get(f.path) || [];
      items.forEach((txt, i) => {
        const row = document.createElement("div");
        row.className = "row";
        const input = document.createElement("input");
        input.type = "text";
        input.value = txt;
        input.setAttribute("aria-label", `${f.label} ${i + 1}`);
        input.addEventListener("input", () => {
          const next = [...(get(f.path) || [])];
          next[i] = input.value;
          set(f.path, next);
          onChange();
        });
        const del = document.createElement("button");
        del.className = "btn btn--icon";
        del.type = "button";
        del.textContent = "✕";
        del.title = "Supprimer";
        del.setAttribute("aria-label", `Supprimer : ${f.label} ${i + 1}`);
        del.addEventListener("click", () => {
          const next = (get(f.path) || []).filter((_, k) => k !== i);
          set(f.path, next);
          render(); onChange();
        });
        row.append(input, del);
        box.append(row);
      });
      const add = document.createElement("button");
      add.className = "btn btn--add";
      add.type = "button";
      add.textContent = f.ajout || "+ Ajouter un message";
      add.addEventListener("click", () => {
        set(f.path, [...(get(f.path) || []), f.nouveau || "NOUVEAU MESSAGE"]);
        render(); onChange();
      });
      box.append(add);
    };
    render();
    wrap.append(labelRow(f.label), box);
    addHelp(wrap, f.help);
    return wrap;
  }

  /* Liste des reseaux : icone + libelle. */
  function buildSocial(f) {
    const wrap = document.createElement("div");
    wrap.className = "field";
    const box = document.createElement("div");
    box.className = "list";

    const render = () => {
      box.textContent = "";
      const items = get(f.path) || [];
      items.forEach((item, i) => {
        const row = document.createElement("div");
        row.className = "row";

        const sel = document.createElement("select");
        for (const ic of ICONS) {
          const o = document.createElement("option");
          o.value = ic; o.textContent = ic;
          sel.append(o);
        }
        sel.value = ICONS.includes(item.icon) ? item.icon : "web";
        sel.setAttribute("aria-label", `Réseau de l'entrée ${i + 1}`);

        const input = document.createElement("input");
        input.type = "text";
        input.setAttribute("aria-label", `Libellé de l'entrée ${i + 1}`);
        input.value = item.label || "";

        const commit = () => {
          const next = (get(f.path) || []).map((it, k) =>
            k === i ? { icon: sel.value, label: input.value } : it);
          set(f.path, next);
          onChange();
        };
        sel.addEventListener("change", commit);
        input.addEventListener("input", commit);

        const del = document.createElement("button");
        del.className = "btn btn--icon";
        del.type = "button";
        del.textContent = "✕";
        del.title = "Supprimer";
        del.setAttribute("aria-label", `Supprimer l'entrée ${i + 1}`);
        del.addEventListener("click", () => {
          set(f.path, (get(f.path) || []).filter((_, k) => k !== i));
          render(); onChange();
        });

        row.append(sel, input, del);
        box.append(row);
      });
      const add = document.createElement("button");
      add.className = "btn btn--add";
      add.type = "button";
      add.textContent = "+ Ajouter un réseau";
      add.addEventListener("click", () => {
        set(f.path, [...(get(f.path) || []), { icon: "web", label: "mon-site.com" }]);
        render(); onChange();
      });
      box.append(add);
    };
    render();
    wrap.append(labelRow(f.label), box);
    addHelp(wrap, f.help);
    return wrap;
  }

  /* --- budget vertical + diagnostics --------------------------------------
     C'est ce qui fait la valeur de cette page : les reglages de mise en page
     sont lies entre eux, et une valeur seule ne dit rien. Ici on recalcule le
     budget complet et on signale les collisions. */
  let budgetEl = null;

  /* --------------------------------------------------------------------------
     Bibliotheques d'images
     Deux emplacements, deux contraintes qui n'ont rien a voir :

       fond   le decor. Opaque et plein cadre, donc JPEG et 1920 px.
       globe  la sphere autour de laquelle le logo tourne. Il lui faut de la
              TRANSPARENCE, sinon un ballon de basket depose en JPEG carre
              poserait un carre blanc au milieu du bandeau. D'ou le WebP a
              canal alpha, et le decoupage en rond fait ici, avant l'envoi.

     La liste demande le jeton, et celui-ci n'est connu qu'apres la
     construction du formulaire : la galerie pose sa coquille, et un
     rafraichissement differe la remplit.
     -------------------------------------------------------------------------- */
  const MEDIAS = {
    fond: {
      livre: "assets/arene.jpg",
      livreNom: "Livré avec l'overlay",
      livreInfo: "l'arène d'origine",
      ajout: "＋ Ajouter des fonds",
      maxCote: 1920, sortie: "image/jpeg", qualite: 0.82, rond: false,
    },
    globe: {
      livre: "assets/terre.png",
      livreNom: "La Terre livrée",
      livreInfo: "la planète d'origine",
      ajout: "＋ Ajouter des globes",
      maxCote: 1024, sortie: "image/webp", qualite: 0.9, rond: true,
    },
  };

  const poidsLisible = (n) => (n >= 1048576 ? (n / 1048576).toFixed(1) + " Mo"
                                            : Math.round(n / 1024) + " Ko");

  /* Detourage du fond uni.

     Le masque circulaire ne suffit pas. Il retire bien les coins, mais il garde
     tout l'anneau de fond compris entre le sujet et le cercle inscrit : une
     photo de ballon sur fond blanc de studio donnait un ballon cercle d'un halo
     blanc, tres voyant sur le bandeau sombre.

     Le remplissage part donc des BORDS et ne progresse que sur des pixels
     proches de la couleur echantillonnee. Un reflet blanc a l'interieur du
     ballon n'est pas relie au bord : il survit. C'est tout l'interet de
     propager de proche en proche plutot que de retirer une couleur partout.

     Renvoie false et ne touche a rien si le pourtour n'est pas uni : mieux vaut
     laisser le fond que mordre dans le sujet. */
  function detourerFondUni(ctx, w, h, tolerance = 62) {
    const img = ctx.getImageData(0, 0, w, h);
    const d = img.data;

    // Echantillons sur le pourtour : 4 coins et 4 milieux d'arete.
    const pts = [[0, 0], [w - 1, 0], [0, h - 1], [w - 1, h - 1],
                 [w >> 1, 0], [w >> 1, h - 1], [0, h >> 1], [w - 1, h >> 1]];
    const ech = pts.map(([x, y]) => { const k = (y * w + x) * 4; return [d[k], d[k + 1], d[k + 2]]; });
    const moy = [0, 1, 2].map((i) => ech.reduce((t, c) => t + c[i], 0) / ech.length);
    const ecart = Math.max(...ech.map((c) => Math.hypot(c[0] - moy[0], c[1] - moy[1], c[2] - moy[2])));
    if (ecart > 34) return false;

    // Distances au carre : la boucle passe sur quelques millions de pixels.
    const [mr, mg, mb] = moy;
    const seuil = tolerance * tolerance;
    const proche = (i) => {
      const k = i * 4;
      const dr = d[k] - mr, dg = d[k + 1] - mg, db = d[k + 2] - mb;
      return dr * dr + dg * dg + db * db < seuil;
    };

    const vu = new Uint8Array(w * h);
    const file = new Int32Array(w * h);
    let tete = 0, queue = 0;
    const pousser = (i) => { if (!vu[i] && proche(i)) { vu[i] = 1; file[queue++] = i; } };
    for (let x = 0; x < w; x += 1) { pousser(x); pousser((h - 1) * w + x); }
    for (let y = 0; y < h; y += 1) { pousser(y * w); pousser(y * w + w - 1); }
    while (tete < queue) {
      const i = file[tete++];
      const x = i % w;
      d[i * 4 + 3] = 0;
      if (x > 0) pousser(i - 1);
      if (x < w - 1) pousser(i + 1);
      if (i >= w) pousser(i - w);
      if (i < w * (h - 1)) pousser(i + w);
    }

    /* Une passe de moyenne 3x3 sur le seul canal alpha. Sans elle, la limite du
       detourage est un escalier de pixels bien visible a cette taille. */
    const alpha = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i += 1) alpha[i] = d[i * 4 + 3];
    for (let y = 1; y < h - 1; y += 1) {
      for (let x = 1; x < w - 1; x += 1) {
        const i = y * w + x;
        let t = 0;
        for (let dy = -1; dy <= 1; dy += 1) {
          for (let dx = -1; dx <= 1; dx += 1) t += alpha[i + dy * w + dx];
        }
        d[i * 4 + 3] = t / 9;
      }
    }

    ctx.putImageData(img, 0, 0);
    return true;
  }

  /* Reencodage avant envoi. Une image arrive souvent en 4000 px, d'une capture
     ou d'un generateur : la stocker telle quelle couterait du stockage et du
     temps de chargement dans OBS pour des pixels qu'on n'affichera jamais. */
  function reencoder(fichier, reglesEmplacement, enRond) {
    const { maxCote, sortie, qualite } = reglesEmplacement;
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(fichier);
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        const c = document.createElement("canvas");
        const ctx = c.getContext("2d");

        if (enRond) {
          /* Cadrage carre centre, puis masque circulaire. C'est ce qui permet
             de deposer n'importe quelle photo de ballon : ce qui l'entoure
             disparait, au lieu de poser un carre au milieu du bandeau. */
          const cote = Math.min(img.naturalWidth, img.naturalHeight);
          const t = Math.min(maxCote, cote);
          c.width = t;
          c.height = t;
          ctx.drawImage(img,
            (img.naturalWidth - cote) / 2, (img.naturalHeight - cote) / 2, cote, cote,
            0, 0, t, t);

          // D'abord le fond uni, puis le cercle : le detourage laisse parfois
          // des restes dans les angles, le masque les emporte.
          detourerFondUni(ctx, t, t);

          /* Bord adouci sur le dernier pour-cent du rayon. Un disque aux bords
             nets laisse un escalier de pixels tres visible a cette taille. */
          const r = t / 2;
          const masque = ctx.createRadialGradient(r, r, 0, r, r, r);
          masque.addColorStop(0.97, "rgba(255,255,255,1)");
          masque.addColorStop(1, "rgba(255,255,255,0)");
          ctx.globalCompositeOperation = "destination-in";
          ctx.fillStyle = masque;
          ctx.fillRect(0, 0, t, t);

          /* Ombrage cuit dans l'image.

             Une image plate detouree lit comme un autocollant, pas comme une
             sphere : la Terre livree ne le montrait pas parce que son ombrage
             etait deja rendu dedans. On le pose donc ici plutot qu'en CSS —
             sinon il s'ajouterait a celui de la Terre.

             source-atop est la cle : le degrade n'est peint que la ou l'image
             est deja opaque, donc il epouse le ballon sans deborder sur la
             transparence. */
          ctx.globalCompositeOperation = "source-atop";

          const ombre = ctx.createRadialGradient(t * 0.36, t * 0.32, t * 0.05,
                                                 t * 0.5, t * 0.5, t * 0.62);
          ombre.addColorStop(0, "rgba(0,0,0,0)");
          ombre.addColorStop(0.62, "rgba(0,0,0,0.10)");
          ombre.addColorStop(1, "rgba(0,0,0,0.55)");
          ctx.fillStyle = ombre;
          ctx.fillRect(0, 0, t, t);

          const reflet = ctx.createRadialGradient(t * 0.34, t * 0.30, 0,
                                                  t * 0.34, t * 0.30, t * 0.30);
          reflet.addColorStop(0, "rgba(255,255,255,0.30)");
          reflet.addColorStop(1, "rgba(255,255,255,0)");
          ctx.fillStyle = reflet;
          ctx.fillRect(0, 0, t, t);

          ctx.globalCompositeOperation = "source-over";
        } else {
          const k = Math.min(1, maxCote / Math.max(img.naturalWidth, img.naturalHeight));
          c.width = Math.max(1, Math.round(img.naturalWidth * k));
          c.height = Math.max(1, Math.round(img.naturalHeight * k));
          ctx.drawImage(img, 0, 0, c.width, c.height);
        }

        /* On declare le type que le navigateur a REELLEMENT produit : certains
           ignorent le format demande et rendent du PNG. Annoncer un WebP en
           envoyant du PNG ferait stocker des octets mal etiquetes. */
        const rendre = (b, secours) => {
          if (b) return resolve({ blob: b, type: b.type || sortie, w: c.width, h: c.height });
          if (secours) return reject(new Error("réencodage impossible"));
          c.toBlob((b2) => rendre(b2, true), "image/png");
        };
        c.toBlob((b) => rendre(b, false), sortie, qualite);
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("image illisible")); };
      img.src = url;
    });
  }

  const rafraichisseursMedia = [];
  const resynchroniseursMedia = [];
  const RONDS_KEY = "shaks:decoupe-ronde";

  function buildMedia(f) {
    const regles = MEDIAS[f.slot];
    const wrap = document.createElement("div");
    wrap.className = "field";
    wrap.append(labelRow(f.label));

    const galerie = document.createElement("div");
    galerie.className = "galerie";
    const retour = document.createElement("p");
    retour.className = "help galerie__retour";

    /* Chemin libre : une image posee dans assets/, ou une adresse quelconque.
       C'est aussi la seule voie en version dossier, ou rien ne s'envoie. */
    const manuel = document.createElement("input");
    manuel.type = "text";
    manuel.className = "galerie__manuel";
    manuel.placeholder = "…ou un chemin à la main";
    manuel.value = get(f.path) ?? "";
    manuel.addEventListener("input", () => { set(f.path, manuel.value); onChange(); });

    wrap.append(galerie, retour, manuel);

    /* Case du decoupage en rond : elle ne vaut que pour l'emplacement du
       globe, et elle porte sur l'ENVOI, pas sur la configuration — d'ou le
       rangement local plutot que dans config.js. */
    let caseRonde = null;
    if (regles.rond) {
      const l = document.createElement("label");
      l.className = "galerie__option";
      caseRonde = document.createElement("input");
      caseRonde.type = "checkbox";
      let garde = true;
      try { garde = localStorage.getItem(RONDS_KEY) !== "non"; } catch { /* mode prive */ }
      caseRonde.checked = garde;
      caseRonde.addEventListener("change", () => {
        try { localStorage.setItem(RONDS_KEY, caseRonde.checked ? "oui" : "non"); } catch { /* */ }
      });
      l.append(caseRonde, document.createTextNode(
        "Détourer le fond et découper en rond (décoche pour un PNG déjà détouré)"));
      wrap.append(l);
    }

    addHelp(wrap, f.help);

    const choisir = (src) => {
      set(f.path, src);
      manuel.value = src;
      onChange();
      for (const el of galerie.querySelectorAll(".galerie__item")) {
        el.classList.toggle("is-actif", el.dataset.src === src);
      }
      /* Prevenir la rangee de themes. Le theme actif est deduit des deux
         images : sans cet appel, choisir une image a la main laissait la puce
         precedente marquee active — le marqueur mentait, ce que la deduction
         devait justement empecher. */
      for (const r of resynchroniseursMedia) r();
    };

    function tuile({ src, nom, info, id }) {
      const t = document.createElement("div");
      t.className = "galerie__item" + (get(f.path) === src ? " is-actif" : "");
      t.dataset.src = src;

      const choix = document.createElement("button");
      choix.type = "button";
      choix.className = "galerie__choix";
      const vue = document.createElement("span");
      vue.className = "galerie__vue" + (regles.rond ? " galerie__vue--rond" : "");
      vue.style.backgroundImage = `url("${src}")`;
      const leg = document.createElement("span");
      leg.className = "galerie__nom";
      leg.textContent = nom;
      const inf = document.createElement("span");
      inf.className = "galerie__info";
      inf.textContent = info;
      choix.append(vue, leg, inf);
      choix.addEventListener("click", () => choisir(src));
      t.append(choix);

      if (id) {
        const x = document.createElement("button");
        x.type = "button";
        x.className = "galerie__x";
        x.textContent = "✕";
        x.title = "Retirer cette image";
        x.addEventListener("click", async () => {
          x.disabled = true;
          try {
            const res = await fetch(`/api/bibliotheque/${f.slot}/${encodeURIComponent(id)}`, {
              method: "DELETE",
              headers: { authorization: `Bearer ${token}` },
            });
            if (!res.ok) throw new Error(`erreur ${res.status}`);
            const k = recents.findIndex((r) => r.id === id);
            if (k >= 0) recents.splice(k, 1);
            // Retirer l'image affichee laisserait l'overlay sur une adresse morte.
            if (get(f.path) === src) choisir(regles.livre);
            await charger();
          } catch (err) {
            retour.textContent = `Suppression impossible : ${err.message}`;
            x.disabled = false;
          }
        });
        t.append(x);
      }
      return t;
    }

    async function envoyer(fichier) {
      const enRond = Boolean(caseRonde && caseRonde.checked);
      const { blob, type, w, h } = await reencoder(fichier, regles, enRond);
      const res = await fetch(`/api/bibliotheque/${f.slot}`, {
        method: "PUT",
        headers: {
          "content-type": type,
          authorization: `Bearer ${token}`,
          "x-nom": encodeURIComponent(fichier.name.replace(/\.[^.]+$/, "").slice(0, 60)),
        },
        body: blob,
      });
      const corps = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(corps.error || `erreur ${res.status}`);
      return { ...corps, w, h };
    }

    /* Ceinture et bretelles : meme avec l'index tenu a la main cote Worker, on
       ne veut pas qu'un aleas de propagation fasse disparaitre de l'ecran une
       image qu'on vient d'envoyer. Les envois de la session sont donc
       fusionnes dans la liste. */
    const recents = [];

    async function charger() {
      galerie.textContent = "";
      galerie.append(tuile({ src: regles.livre, nom: regles.livreNom, info: regles.livreInfo }));

      if (!(await estEnLigne())) {
        retour.textContent = "Version dossier : pose ton image dans assets/ et indique "
          + "son chemin ci-dessous. L'envoi demande le déploiement en ligne.";
        return;
      }
      if (!token) {
        retour.textContent = "Débloque la page avec ton lien de réglages pour envoyer "
          + "tes propres images.";
        return;
      }

      let medias = [];
      try {
        const res = await fetch(`/api/bibliotheque/${f.slot}`, {
          headers: { authorization: `Bearer ${token}` },
          cache: "no-store",
        });
        if (!res.ok) throw new Error(`erreur ${res.status}`);
        medias = (await res.json()).medias || [];
      } catch (err) {
        retour.textContent = `Bibliothèque indisponible : ${err.message}`;
        return;
      }

      for (const r of recents) {
        if (!medias.some((m) => m.id === r.id)) medias.push(r);
      }
      medias.sort((a, b) => String(b.cree || "").localeCompare(String(a.cree || "")));
      for (const m of medias) {
        galerie.append(tuile({
          src: `/api/media/${f.slot}/${m.id}`,
          nom: m.nom || f.slot,
          info: m.octets ? poidsLisible(m.octets) : "",
          id: m.id,
        }));
      }

      /* L'image en service peut avoir ete retiree d'une autre session : sans ce
         reperage, la galerie n'aurait aucune tuile active et l'overlay
         afficherait un trou sans qu'on comprenne pourquoi. */
      const actuel = get(f.path);
      const connu = actuel === regles.livre
        || medias.some((m) => `/api/media/${f.slot}/${m.id}` === actuel);
      if (!connu && actuel) {
        retour.textContent = `L'image en service (${actuel}) n'est pas dans la bibliothèque.`;
      } else {
        retour.textContent = medias.length
          ? `${medias.length} image${medias.length > 1 ? "s" : ""} envoyée${medias.length > 1 ? "s" : ""}. Clique pour changer.`
          : "Aucune image envoyée pour l'instant.";
      }

      const ajout = document.createElement("label");
      ajout.className = "galerie__item galerie__ajout";
      ajout.append(document.createTextNode(regles.ajout));
      const champ = document.createElement("input");
      champ.type = "file";
      champ.accept = "image/*";
      champ.multiple = true;
      champ.hidden = true;
      ajout.append(champ);
      champ.addEventListener("change", async () => {
        const fichiers = [...champ.files];
        champ.value = "";
        if (!fichiers.length) return;
        let premier = "";
        for (let i = 0; i < fichiers.length; i += 1) {
          retour.textContent = `Envoi ${i + 1} / ${fichiers.length}…`;
          try {
            const ok = await envoyer(fichiers[i]);
            recents.push(ok);
            if (!premier) premier = ok.url;
          } catch (err) {
            retour.textContent = `${fichiers[i].name} : ${err.message}`;
            return;
          }
        }
        // Une image qu'on vient d'envoyer, c'est une image qu'on veut voir.
        if (premier) choisir(premier);
        await charger();
      });
      galerie.append(ajout);
    }

    /* Resynchronisation legere : quand un theme change les deux images d'un
       coup, les galeries doivent suivre sans refaire d'appel reseau. */
    resynchroniseursMedia.push(() => {
      const actuel = get(f.path) ?? "";
      manuel.value = actuel;
      for (const el of galerie.querySelectorAll(".galerie__item")) {
        el.classList.toggle("is-actif", el.dataset.src === actuel);
      }
    });

    rafraichisseursMedia.push(charger);
    return wrap;
  }

  /* --------------------------------------------------------------------------
     Themes
     Un theme apparie un decor et un globe. Il ne porte que ces deux images :
     appliquer un theme ne doit jamais defaire un reglage ajuste ailleurs.

     Le theme actif est DEDUIT de la configuration, jamais stocke. Sinon,
     changer le globe a la main laisserait un theme faussement marque actif.
     -------------------------------------------------------------------------- */
  function buildThemes(f) {
    const wrap = document.createElement("div");
    wrap.className = "field";
    wrap.append(labelRow(f.label));

    const rangee = document.createElement("div");
    rangee.className = "themes";
    wrap.append(rangee);
    addHelp(wrap, f.help);

    const liste = () => (Array.isArray(get("themes")) ? get("themes") : []);
    const actif = (t) => get("arena.image") === t.fond && get("planet.image") === t.globe;

    function appliquer(t) {
      set("arena.image", t.fond);
      set("planet.image", t.globe);
      onChange();
      for (const r of resynchroniseursMedia) r();
      rendre();
    }

    function enregistrer(nom) {
      const propre = String(nom || "").trim().slice(0, 28);
      if (!propre) return;
      const suivants = [...liste()];
      const t = {
        id: Date.now().toString(36),
        nom: propre,
        fond: get("arena.image"),
        globe: get("planet.image"),
      };
      // Meme paire d'images : on remplace au lieu d'empiler des doublons.
      const jumeau = suivants.findIndex((x) => x.fond === t.fond && x.globe === t.globe);
      if (jumeau >= 0) suivants[jumeau] = { ...suivants[jumeau], nom: propre };
      else suivants.push(t);
      set("themes", suivants);
      onChange();
      rendre();
    }

    function puce(t) {
      const el = document.createElement("div");
      el.className = "theme" + (actif(t) ? " is-actif" : "");

      const bouton = document.createElement("button");
      bouton.type = "button";
      bouton.className = "theme__choix";
      bouton.title = `${t.nom} — décor et globe`;

      const vue = document.createElement("span");
      vue.className = "theme__vue";
      vue.style.backgroundImage = `url("${t.fond}")`;
      const bille = document.createElement("span");
      bille.className = "theme__globe";
      bille.style.backgroundImage = `url("${t.globe}")`;
      vue.append(bille);

      const nom = document.createElement("span");
      nom.className = "theme__nom";
      nom.textContent = t.nom;

      bouton.append(vue, nom);
      bouton.addEventListener("click", () => appliquer(t));
      el.append(bouton);

      const x = document.createElement("button");
      x.type = "button";
      x.className = "theme__x";
      x.textContent = "✕";
      x.title = "Supprimer ce thème";
      x.addEventListener("click", () => {
        set("themes", liste().filter((y) => y.id !== t.id));
        onChange();
        rendre();
      });
      el.append(x);
      return el;
    }

    /* L'ajout se replie en une puce : une zone de saisie permanente pour un
       geste rare encombrerait le seul bloc qu'on voulait garder court. */
    function puceAjout() {
      const el = document.createElement("div");
      el.className = "theme theme--ajout";
      const b = document.createElement("button");
      b.type = "button";
      b.className = "theme__choix";
      b.textContent = "＋ Enregistrer l'habillage actuel";
      b.addEventListener("click", () => {
        el.textContent = "";
        el.classList.add("is-saisie");
        const champ = document.createElement("input");
        champ.type = "text";
        champ.placeholder = "NBA, Foot, Baseball…";
        champ.maxLength = 28;
        const ok = document.createElement("button");
        ok.type = "button";
        ok.textContent = "✓";
        ok.title = "Enregistrer";
        ok.addEventListener("click", () => enregistrer(champ.value));
        champ.addEventListener("keydown", (ev) => {
          if (ev.key === "Enter") { ev.preventDefault(); enregistrer(champ.value); }
          if (ev.key === "Escape") rendre();
        });
        el.append(champ, ok);
        champ.focus();
      });
      el.append(b);
      return el;
    }

    function rendre() {
      rangee.textContent = "";
      for (const t of liste()) rangee.append(puce(t));
      rangee.append(puceAjout());
    }

    rendre();
    resynchroniseursMedia.push(rendre);
    return wrap;
  }

  function buildBudget() {
    budgetEl = document.createElement("div");
    budgetEl.className = "budget";
    refreshBudget();
    return budgetEl;
  }

  function refreshBudget() {
    if (!budgetEl) return;
    const L = cfg.layout || {};
    const B = cfg.bar || {};
    const ct = L.camTop || {}, cb = L.camBreak || {}, bn = L.banner || {};
    const px = (p) => Math.round((p / 100) * CANVAS_H);
    const pw = (p) => Math.round((p / 100) * CANVAS_W);

    const boxT = windowBox(ct), boxB = windowBox(cb);
    const ctH = (boxT.h / (Number(L.canvasH) || 1920)) * 100;   // % reels
    const cbH = (boxB.h / (Number(L.canvasH) || 1920)) * 100;
    const barTop = bn.top + Number(B.imageBarTop || 0) * bn.height;
    const barBot = bn.top + Number(B.imageBarBottom || 1) * bn.height;
    const ctEnd = ct.top + ctH;
    const cbEnd = cb.top + cbH;
    const safeBot = 100 - Number(L.safeBottomPct || 0);

    const ctA = boxT.w * boxT.h;
    const cbA = boxB.w * boxB.h;

    const rows = [
      ["Caméra animateur", `${boxT.w} × ${boxT.h} px · format ${boxT.ratio.toFixed(2)}`],
      ["Caméra break", `${boxB.w} × ${boxB.h} px · format ${boxB.ratio.toFixed(2)}`],
      ["Break / animateur", `${(boxB.h / boxT.h).toFixed(2)}× haut · ${(cbA / ctA).toFixed(2)}× surface`],
      ["Barre pleine du bandeau", `${barTop.toFixed(1)} % → ${barBot.toFixed(1)} %`],
      ["Sous le chat", cbEnd > safeBot
        ? `${Math.round(((cbEnd - safeBot) / cbH) * 100)} % du bas de la caméra break`
        : "rien"],
    ];
    const table = rows.map(([k, v]) =>
      `<tr><td class="k">${k}</td><td>${v}</td></tr>`).join("");

    const diag = [];
    const push = (cls, msg) => diag.push(`<div class="${cls}">${cls === "ok" ? "✓" : "!"} <span>${msg}</span></div>`);

    /* La superposition a l'interface de la plateforme n'est PAS une erreur :
       le chat est une surcouche que le viewer peut masquer, la video doit
       exister dessous. On informe seulement de ce qui sera recouvert. */
    const stageBot = 100 - Number(L.stageBottomPct || 0);

    if (cbEnd > safeBot) {
      const masque = Math.round(((cbEnd - safeBot) / cbH) * 100);
      push("ok", `Caméra break sous le chat sur ses ${masque} % du bas — c'est voulu : ceux qui masquent le chat voient tout.`);
    }
    if (ct.top < L.safeTopPct)
      push("warn", `La caméra animateur démarre à ${ct.top} %, sous l'entête de la plateforme : ton visage peut passer derrière ton nom et le compteur.`);

    /* Rognage lateral : contrairement au haut/bas, ce n'est pas une surcouche
       qu'on peut masquer — la plateforme remplit l'ecran du telephone sans
       bande noire, et un telephone etant plus haut que notre image, c'est les
       COTES qui sautent. Une camera trop pres du bord perd vraiment ce
       morceau, pour de bon. */
    const safeSide = Number(L.safeSidePct ?? 10);
    const margeCote = (spec) => (100 - Number(spec.width || 0)) / 2;
    if (safeSide > 0) {
      const margeT = margeCote(ct), margeB = margeCote(cb);
      if (margeT < safeSide)
        push("warn", `Caméra animateur : ${margeT.toFixed(1)} % de marge de chaque côté, sous les ${safeSide} % attendus — un téléphone peut en rogner un peu.`);
      if (margeB < safeSide)
        push("warn", `Caméra break : ${margeB.toFixed(1)} % de marge de chaque côté, sous les ${safeSide} % attendus — un téléphone peut couper le bord des cartes.`);
    }

    /* Au ras du bord, le cadre s'ouvre en bas et ses ornements passent hors
       champ : la notion de depassement n'a plus de sens. La tolerance evite
       aussi un faux positif : 39,9 + 60,1 vaut 100,00000000000001 en flottant. */
    const bleeding = cbEnd >= 99.5;
    if (bleeding) {
      push("ok", "Caméra break jusqu'au bord bas : le cadre s'ouvre et ses ornements passent hors champ.");
    } else if (cbEnd > stageBot + 0.01) {
      push("bad", `La caméra break (${cbEnd.toFixed(1)} %) dépasse le bas du cadre (${stageBot} %).`);
    } else if (stageBot - cbEnd < 1.2) {
      push("warn", `Seulement ${(stageBot - cbEnd).toFixed(1)} % avant le bas du cadre : les équerres et les chevrons vont se superposer. Vise 1,5 %.`);
    }

    if (barTop < ctEnd)
      push("bad", `La barre du bandeau (${barTop.toFixed(1)} %) passe sur la caméra animateur (finit à ${ctEnd.toFixed(1)} %).`);
    if (barBot > cb.top)
      push("bad", `La barre du bandeau (${barBot.toFixed(1)} %) passe sur la caméra break (commence à ${cb.top} %).`);

    const ratio = px(cb.height) / px(ct.height);
    if (ratio < 1.35)
      push("warn", `Break seulement ${ratio.toFixed(2)}× plus haute : en dessous de 1,4 ça se lit comme du 50/50.`);

    if (!diag.length) push("ok", "Rien à signaler : pas de collision, zones plateforme respectées.");

    budgetEl.innerHTML =
      `<table>${table}</table><div class="diag">${diag.join("")}</div>`;
  }

  /* Liste de suggestions partagee par les champs police. */
  (() => {
    const dl = document.createElement("datalist");
    dl.id = "shaks-fonts";
    for (const name of GOOGLE_FONTS) {
      const o = document.createElement("option");
      o.value = name;
      dl.append(o);
    }
    document.body.append(dl);

    const dr = document.createElement("datalist");
    dr.id = "shaks-ratios";
    for (const r of RATIOS) {
      const o = document.createElement("option");
      o.value = r;
      dr.append(o);
    }
    document.body.append(dr);
  })();

  /* --------------------------------------------------------------------------
     Panneau OBS : les valeurs exactes a recopier dans OBS.
     C'est la vraie raison d'etre de ce bloc : placer une source a la souris
     dans OBS est approximatif, alors que sa fenetre Transformation accepte des
     chiffres. Autant les lui donner.
     -------------------------------------------------------------------------- */
  let obsEl = null;

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

  /* Geometrie reelle d'une fenetre, en pixels du canvas. Le ratio, s'il est
     defini, impose la hauteur — c'est le meme calcul que dans frame.js. */
  function windowBox(spec) {
    const cw = Number((cfg.layout || {}).canvasW) || 1080;
    const ch = Number((cfg.layout || {}).canvasH) || 1920;
    const w = (Number(spec.width) / 100) * cw;
    const ratio = parseRatio(spec.ratio);
    const h = ratio ? w / ratio : (Number(spec.height) / 100) * ch;
    return {
      x: Math.round((cw - w) / 2),
      y: Math.round((Number(spec.top) / 100) * ch),
      w: Math.round(w),
      h: Math.round(h),
      ratio: w / h,
      cw, ch,
    };
  }

  function buildObs() {
    obsEl = document.createElement("div");
    obsEl.className = "budget";
    refreshObs();
    return obsEl;
  }

  function refreshObs() {
    if (!obsEl) return;
    const L = cfg.layout || {};
    const rows = [
      ["Caméra animateur", windowBox(L.camTop || {})],
      ["Caméra break", windowBox(L.camBreak || {})],
    ];
    /* La fenetre du cadre deborde hors champ quand la camera arrive au bord,
       mais la SOURCE, elle, s'arrete au canvas. Ce sont ces chiffres-la qu'il
       faut saisir dans OBS, pas ceux de la fenetre decorative. */
    const html = rows.map(([name, b]) => `
      <tr><td class="k">${name}</td>
          <td><b>${b.w} × ${b.h}</b> &nbsp; pos ${b.x}, ${b.y}
              <button class="btn btn--icon" data-obs="${b.x} ${b.y} ${b.w} ${b.h}"
                      title="Copier">⧉</button></td></tr>`).join("");
    obsEl.innerHTML =
      `<p style="margin:0 0 8px;color:var(--dim);font-size:12.5px">
         À recopier dans OBS : sélectionne ta source, <b>Édition → Transformer →
         Modifier la transformation</b>, puis entre la position et la taille.
         Bien plus précis qu'à la souris.</p>
       <table>${html}</table>`;
  }

  document.addEventListener("click", (e) => {
    const b = e.target.closest("button[data-obs]");
    if (!b) return;
    const [x, y, w, h] = b.dataset.obs.split(" ");
    navigator.clipboard.writeText(`Position ${x}, ${y} — Taille ${w} x ${h}`)
      .then(() => setStatus(`Copié : position ${x}, ${y} — taille ${w} × ${h}`, true))
      .catch(() => setStatus("Copie refusée par le navigateur.", "bad"));
  });

  /* --- assemblage --------------------------------------------------------- */
  const BUILDERS = { range: buildRange, text: buildText, select: buildSelect,
                     check: buildCheck, list: buildList, social: buildSocial,
                     font: buildFont, ratio: buildRatio, media: buildMedia,
                     themes: buildThemes };

  /* Etat des sections. Le retenir evite de devoir redeplier a chaque visite
     celle sur laquelle on travaille. La cle est le titre : il n'y a pas
     d'identifiant plus stable, et un titre renomme rouvre juste ferme. */
  const FOLDS_KEY = "shaks:sections";

  function readFolds() {
    try { return JSON.parse(localStorage.getItem(FOLDS_KEY)) || {}; } catch { return {}; }
  }

  const folds = readFolds();

  function writeFolds() {
    try { localStorage.setItem(FOLDS_KEY, JSON.stringify(folds)); } catch { /* mode prive */ }
  }

  const replis = [];

  for (const section of SCHEMA) {
    const body = document.createElement("div");
    body.className = section.essential ? "body body--essentiel" : "body";

    // Compte les vrais reglages : le budget et le pave OBS n'en sont pas.
    let compte = 0;
    for (const f of section.fields) {
      if (f.type === "budget") { body.append(buildBudget()); continue; }
      if (f.type === "obs") { body.append(buildObs()); continue; }
      const build = BUILDERS[f.type];
      if (build && get(f.path) !== undefined) { body.append(lier(build(f))); compte += 1; }
    }

    if (section.essential) {
      const bloc = document.createElement("section");
      bloc.className = "essentiel";
      const titre = document.createElement("h2");
      titre.textContent = section.title;
      bloc.append(titre);
      if (section.note) {
        const note = document.createElement("p");
        note.className = "essentiel__note";
        note.textContent = section.note;
        bloc.append(note);
      }
      bloc.append(body);
      form.append(bloc);
      continue;
    }

    const d = document.createElement("details");
    d.open = folds[section.title] === true;
    const som = document.createElement("summary");
    som.append(document.createTextNode(section.title));
    const badge = document.createElement("span");
    badge.className = "count";
    badge.textContent = String(compte);
    som.append(badge);
    d.addEventListener("toggle", () => {
      folds[section.title] = d.open;
      writeFolds();
      majTout();
    });
    d.append(som, body);
    form.append(d);
    replis.push(d);
  }

  /* Un seul bouton pour ouvrir ou fermer tout le bas de la page. */
  const barreReplis = document.createElement("div");
  barreReplis.className = "replis";
  const btnTout = document.createElement("button");
  btnTout.type = "button";
  btnTout.className = "replis__lien";
  barreReplis.append(btnTout);

  function majTout() {
    const ouverts = replis.filter((d) => d.open).length;
    btnTout.textContent = ouverts === replis.length ? "Tout replier" : "Tout déplier";
  }

  btnTout.addEventListener("click", () => {
    // Si au moins une est fermee, le geste attendu est d'ouvrir.
    const ouvrir = replis.some((d) => !d.open);
    for (const d of replis) d.open = ouvrir;  // chaque toggle enregistre l'etat
  });

  majTout();
  if (replis.length) form.insertBefore(barreReplis, replis[0]);

  /* --- apercu live -------------------------------------------------------- */
  const frame = $("preview");
  let timer = 0;
  let version = 0;

  function paint() {
    // Le "?v=" qui change a chaque fois est indispensable : modifier SEULEMENT
    // le hash d'une URL est une navigation dans le meme document. Le navigateur
    // ne recharge rien et les scripts ne sont pas rejoues — l'apercu restait
    // donc fige sur la premiere config. Changer la partie requete en fait une
    // URL differente, donc un vrai rechargement.
    version += 1;
    frame.src = `apercu.html?v=${version}#cfg=` +
      encodeURIComponent(JSON.stringify(cfg));
  }

  function onChange() {
    refreshBudget();
    refreshObs();
    clearTimeout(timer);
    timer = setTimeout(paint, 220);   // anti-rebond : sinon un slider recharge 60x/s
    setStatus("");
  }
  paint();

  /* --- generation du fichier --------------------------------------------- */
  const J = (v) => JSON.stringify(v, null, 2)
    .split("\n").map((l, i) => (i === 0 ? l : "  " + l)).join("\n");

  function generate() {
    const c = cfg;
    return `/* ==========================================================================
   MIDKARDS — Reglages de l'habillage

   CE FICHIER A ETE GENERE PAR reglages.html
   Le plus simple est de continuer a passer par cette page : ouvre
   reglages.html dans ton navigateur, regle, et enregistre a nouveau.
   Tu peux aussi editer a la main, en gardant les guillemets et les virgules.

   Genere le ${new Date().toLocaleString("fr-FR")}
   ========================================================================== */

window.SHAKS_CONFIG = {

  // Textes defilants, a gauche du bandeau
  ticker: ${J(c.ticker)},

  // Reseaux qui tournent, a droite
  social: ${J(c.social)},

  // Polices. fontFile est prioritaire sur family. google: true va chercher la
  // police chez Google Fonts par son nom.
  typo: ${J(c.typo)},

  // Logo. mode: "orbit" = enroule autour du globe | "static" = pose au centre
  logo: ${J(c.logo)},

  // Le globe et l'enroulement du logo autour
  planet: ${J(c.planet)},

  // Le bandeau. Les fractions image* disent au code ou se trouvent la barre
  // pleine et le champ de texte DANS l'image : a reprendre si tu changes
  // l'image du bandeau.
  bar: ${J(c.bar)},

  // Mise en page, en % du canvas OBS. safeTopPct et safeBottomPct sont les
  // zones recouvertes par l'interface de la plateforme.
  layout: ${J(c.layout)},

  // Le decor de la salle
  arena: ${J(c.arena)},

  // La grille des equipes du random. "pris" = les sigles deja vendus.
  // Seule section appliquee a chaud : la marquer ne recharge pas l'overlay.
  randoms: ${J(c.randoms)},

  // Phrases sous le logo quand un spot est attribue, tirees au hasard.
  punchlines: ${J(c.punchlines)},

  // Animations du spot attribue qui tournent (false = retiree).
  animations: ${J(c.animations)},

  // Themes : chacun apparie un decor et un globe, et se pose d'un seul clic.
  // Le theme actif n'est pas stocke, il est deduit des deux images en cours.
  themes: ${J(c.themes || [])},

};
`;
  }

  /* etat : true = reussi (vert), "bad" = echec (rouge), sinon neutre. */
  function setStatus(msg, etat) {
    const el = $("status");
    el.textContent = msg;
    el.className = "status" + (etat === true ? " is-ok" : etat === "bad" ? " is-bad" : "");
  }

  /* --------------------------------------------------------------------------
     Enregistrement en ligne
     Disponible uniquement si un jeton d'ecriture est fourni dans l'adresse,
     sous la forme #k=<jeton>. On le range aussitot et on nettoie l'adresse :
     il ne doit pas rester affiche dans la barre du navigateur ni partir dans
     un historique.

     localStorage et non sessionStorage. C'est le correctif d'un piege : le
     replaceState ci-dessous efface le #k= de l'adresse, donc l'adresse qu'on
     recharge, qu'on met en marque-page ou qu'on rouvre demain n'a plus de
     jeton. Avec sessionStorage, fermer l'onglet suffisait a perdre le droit
     d'ecrire, le bouton « Enregistrer en ligne » disparaissait sans un mot, et
     il ne restait que le telechargement d'un config.js que personne n'installe
     sur un deploiement en ligne. On croyait enregistrer, rien ne partait.
     -------------------------------------------------------------------------- */
  const TOKEN_KEY = "shaks:token";

  function readToken() {
    const m = (location.hash || "").match(/^#k=(.+)$/);
    if (m) {
      const t = decodeURIComponent(m[1]);
      try { localStorage.setItem(TOKEN_KEY, t); } catch { /* mode prive */ }
      history.replaceState(null, "", location.pathname);
      return t;
    }
    try {
      // sessionStorage : jetons ranges par les versions precedentes.
      return localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY) || "";
    } catch { return ""; }
  }

  /* Dit a l'ecran ou vont les reglages. Sans cela, la page se comporte de deux
     facons opposees derriere une interface identique. */
  function annoncerMode(enLigne, peutEcrire) {
    const el = $("mode");
    if (!el) return;
    el.hidden = false;
    if (!enLigne) {
      el.className = "mode mode--fichier";
      el.innerHTML = "<b>Mode fichier.</b> Clique sur « Enregistrer config.js », remplace le "
        + "<code>config.js</code> du dossier, puis dans OBS : clic droit sur chaque source "
        + "&rarr; Actualiser le cache.";
    } else if (peutEcrire) {
      el.className = "mode mode--enligne";
      el.innerHTML = "<b>Mode en ligne.</b> « Enregistrer en ligne » envoie les réglages sur "
        + "Cloudflare et l'overlay se met à jour tout seul dans OBS, sans rien recharger.";
    } else {
      el.className = "mode mode--averti";
      el.innerHTML = "<b>Lecture seule — rien ne partira en ligne.</b> Pour débloquer "
        + "l'enregistrement, colle ci-dessous ton lien de réglages complet, celui qui "
        + "contient <code>#k=…</code>."
        + '<form class="mode__deblocage" id="deblocage">'
        + '<input type="password" id="jeton-colle" autocomplete="off" spellcheck="false"'
        + ' placeholder="https://midkards.cardvaults.app/reglages#k=…">'
        + '<button type="submit">Débloquer</button>'
        + '</form>'
        + '<span class="mode__retour" id="deblocage-retour"></span>';
      brancherDeblocage();
    }
  }

  /* --------------------------------------------------------------------------
     Deblocage par collage
     Le jeton n'arrive normalement que par le #k= du lien, et la page l'efface
     aussitot de l'adresse. Quiconque perd le lien se retrouve donc devant une
     page muette qui lui parle d'une URL qu'il n'a plus. Ce champ accepte le
     lien entier — ou le jeton seul — et verifie avant d'annoncer quoi que ce
     soit : un jeton faux qui passerait pour bon ne se decouvrirait qu'au
     premier enregistrement perdu.
     -------------------------------------------------------------------------- */
  function extraireJeton(saisie) {
    const brut = String(saisie || "").trim();
    if (!brut) return "";
    const m = brut.match(/#k=([^\s&]+)/);
    // Sinon on prend la saisie telle quelle : c'est le jeton colle seul.
    return m ? decodeURIComponent(m[1]) : brut;
  }

  function brancherDeblocage() {
    const form = $("deblocage");
    const champ = $("jeton-colle");
    const retour = $("deblocage-retour");
    if (!form || !champ || !retour) return;

    form.addEventListener("submit", async (ev) => {
      ev.preventDefault();
      const jeton = extraireJeton(champ.value);
      if (!jeton) {
        retour.textContent = "Colle d'abord ton lien.";
        return;
      }
      retour.textContent = "Vérification…";
      try {
        const res = await fetch("/api/jeton", {
          headers: { authorization: `Bearer ${jeton}` },
          cache: "no-store",
        });
        if (res.status === 204) {
          try { localStorage.setItem(TOKEN_KEY, jeton); } catch { /* mode prive */ }
          retour.textContent = "C'est bon, la page se recharge.";
          location.reload();
          return;
        }
        retour.textContent = res.status === 401
          ? "Ce lien n'est pas le bon. Reprends-le en entier, jusqu'au dernier caractère."
          : `Vérification impossible (${res.status}).`;
      } catch (err) {
        retour.textContent = `Réseau indisponible : ${err.message}`;
      }
    });
  }

  /* Memoise : la bande de mode et la galerie de fonds ont toutes deux besoin
     de savoir ou l'on tourne, et une seule requete suffit. */
  let promesseEnLigne = null;
  function estEnLigne() {
    if (!promesseEnLigne) promesseEnLigne = detecterEnLigne();
    return promesseEnLigne;
  }

  /* L'API repond en JSON, un serveur de fichiers repond du HTML : c'est ce qui
     distingue le deploiement en ligne d'un simple dossier ouvert localement. */
  async function detecterEnLigne() {
    try {
      const res = await fetch("/api/config", { cache: "no-store" });
      const type = res.headers.get("content-type") || "";
      // 404 = API presente mais rien d'enregistre encore : en ligne quand meme.
      return type.includes("application/json") && (res.ok || res.status === 404);
    } catch {
      return false;
    }
  }

  const token = readToken();
  const publishBtn = $("publish");

  estEnLigne().then((enLigne) => annoncerMode(enLigne, Boolean(token)));

  /* Les galeries ont ete construites avant que le jeton soit lu : c'est
     maintenant qu'elles peuvent interroger le serveur. */
  for (const rafraichir of rafraichisseursMedia) rafraichir();

  if (token && publishBtn) {
    publishBtn.hidden = false;
    // En ligne, c'est le bouton principal : le fichier devient un export.
    $("save").classList.remove("btn--main");
    $("save").textContent = "Exporter config.js";

    publishBtn.addEventListener("click", async () => {
      publishBtn.disabled = true;
      setStatus("Enregistrement…");
      try {
        const res = await fetch("/api/config", {
          method: "PUT",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(cfg),
        });
        if (res.status === 401) {
          setStatus("Jeton refusé. Rouvre la page depuis ton lien de réglages.", "bad");
        } else if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          setStatus(`Refusé : ${body.error || res.status}`, "bad");
        } else {
          setStatus("Enregistré. L'overlay se met à jour dans quelques secondes.", true);
        }
      } catch (err) {
        setStatus(`Réseau indisponible : ${err.message}`, "bad");
      } finally {
        publishBtn.disabled = false;
      }
    });
  }

  $("save").addEventListener("click", async () => {
    const text = generate();
    // showSaveFilePicker permet d'ecraser config.js directement quand le
    // navigateur le propose ; sinon on retombe sur un telechargement.
    if (window.showSaveFilePicker) {
      try {
        const handle = await window.showSaveFilePicker({
          suggestedName: "config.js",
          types: [{ description: "JavaScript", accept: { "text/javascript": [".js"] } }],
        });
        const w = await handle.createWritable();
        await w.write(text);
        await w.close();
        setStatus("Enregistré. Actualise les sources dans OBS.", true);
        return;
      } catch (err) {
        if (err && err.name === "AbortError") return;   // annule par l'utilisateur
      }
    }
    const url = URL.createObjectURL(new Blob([text], { type: "text/javascript" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "config.js";
    a.click();
    URL.revokeObjectURL(url);
    setStatus("Téléchargé. Remplace config.js dans le dossier.", true);
  });

  /* Applique les valeurs les plus economes en debit video. Les effets coupes
     ici sont ceux qui font bouger de grandes surfaces du decor : a 0,056 bit
     par pixel, c'est du debit pris aux cartes. Les animations qui restent
     (logo, ticker, liseres) ne touchent que 2 a 5 % de l'image. */
  /* Remet a jour le widget correspondant a un chemin, sans recharger la page :
     un rechargement effacerait le message de confirmation. */
  function syncWidget(path) {
    const el = document.querySelector(`[data-path="${path}"]`);
    if (!el) return;
    if (el.type === "checkbox") el.checked = Boolean(get(path));
    else el.dispatchEvent(new CustomEvent("shaks:sync"));
  }

  $("thrifty").addEventListener("click", () => {
    const light = {
      "arena.imageBreathe": false,
      "arena.intensity": 0,
      "layout.scanEverySec": 0,
    };
    for (const [path, value] of Object.entries(light)) {
      set(path, value);
      syncWidget(path);
    }
    onChange();          // remet le statut a vide, on le repose juste apres
    setStatus("Décor figé : tout le débit part dans les caméras. " +
              "Enregistre config.js pour appliquer.", true);
  });

  $("copy").addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(generate());
      setStatus("Copié. Colle-le dans config.js.", true);
    } catch {
      setStatus("Copie refusée par le navigateur — utilise Enregistrer.", "bad");
    }
  });

  $("reset").addEventListener("click", () => {
    cfg = structuredClone(ORIGINAL);
    form.textContent = "";
    location.reload();
  });
})();
