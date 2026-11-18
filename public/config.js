/* ==========================================================================
   MIDKARDS — Reglages du bandeau
   --------------------------------------------------------------------------
   C'est LE SEUL FICHIER a modifier. Ouvre-le avec TextEdit (ou Notepad),
   change ce que tu veux entre les guillemets, enregistre.
   Puis dans OBS : clic droit sur la source -> "Actualiser le cache de la page".

   Attention : garde bien les guillemets " " et les virgules a la fin des lignes.
   ========================================================================== */

window.SHAKS_CONFIG = {

  /* ------------------------------------------------------------------
     ZONE GAUCHE — le bandeau defilant
     Tes infos libres sur la soiree / les breaks en cours.
     Ajoute ou enleve autant de lignes que tu veux.
     Si le texte est plus long que la place dispo, il defile
     automatiquement. Sinon il reste fixe.
     ------------------------------------------------------------------ */
  ticker: {
    messages: [
      "BREAKS EN LIVE",
      "TCG, SPORT CARDS ET COLLECTOR'S ITEMS",
      "MERCI POUR VOTRE SUPPORT !",
    ],
    dwellSec: 5,         // duree d'affichage de chaque message
    fadeMs: 420,         // duree du fondu entre deux messages
    separator: "◆",      // le petit symbole entre deux messages
  },

  /* ------------------------------------------------------------------
     ZONE DROITE — le carrousel qui tourne
     Les entrees s'affichent une par une, avec l'effet horloge.
     icon : "instagram" | "tiktok" | "web" | "whatnot" | "ebay" | "mail"
     ------------------------------------------------------------------ */
  social: {
    items: [
      { icon: "instagram", label: "midkards" },
      { icon: "web",       label: "taplink.cc/midkards" },
      { icon: "whatnot",   label: "midkards" },
    ],
    dwellSec: 5,     // duree d'affichage de chaque entree
    flipMs: 620,     // duree de la bascule
  },

  /* ------------------------------------------------------------------
     LES VISUELS DE L'ETIQUETTE
     src      : l'arbre blanc, pose sur le sceau bordeaux a gauche
     wordmark : le nom MidKards en couleurs, pose sur le blanc de l'etiquette
     ------------------------------------------------------------------ */
  logo: {
    src: "assets/arbre-blanc.png",
    wordmark: "assets/wordmark.png",
  },

  /* ------------------------------------------------------------------
     LE CADRE  (fichier cadre.html)
     Les valeurs sont en % du canvas OBS, exactement comme des
     coordonnees dans OBS : "top" = distance depuis le haut,
     "height" = hauteur, "width" = largeur (la fenetre reste centree).
     Tu peux tout regler ici sans toucher au code.
     ------------------------------------------------------------------ */
  layout: {
    // Taille de ton canvas OBS. Sert aux calculs affiches dans la page de
    // reglages, pour que tu puisses recopier les valeurs dans OBS.
    canvasW: 1080,
    canvasH: 1920,

    // Fenetre de la camera animateur. Elle garde exactement le rapport
    // d'image d'origine (2.02) : il n'y a donc rien a recadrer dans OBS,
    // juste a redimensionner la source.
    // "ratio" verrouille le format de la fenetre sur celui de ta camera :
    // sa hauteur est alors calculee, et ta camera la remplit exactement,
    // sans bande noire ni recadrage. Formats courants : "16:9", "4:3", "1:1".
    // Vide le champ pour reprendre la main sur la hauteur.
    // decoupeFond : decoupe un trou dans le fond d'arene a cet endroit precis.
    // Sans camera active, cette fenetre montre un vrai vide plutot que le fond
    // qui la remplit a sa place — utile en reglage, pour voir tout de suite si
    // la camera pousse une image ou non, au lieu d'un fond qui laisse croire
    // que tout va bien.
    // Depuis novembre 2026 : plus basse (397 px au lieu de 486) et remontee,
    // meme largeur. Plus du 16:9 : la camera se recadre dans OBS. La place
    // gagnee va a la camera break.
    camTop:   { top: 3, height: 20.7, width: 80, ratio: "", decoupeFond: false },

    // L'etiquette centrale (carte gradee), a cheval entre les deux cameras :
    // elle commence sous la camera du haut et mord sur le haut de la camera
    // break. Un peu plus large que les cameras pour couvrir leurs coques.
    banner:   { top: 24.5, height: 8.5, width: 83 },

    // Fenetre de la camera break : 2.5x plus haute que celle de l'animateur,
    // 3x en surface, en format quasi carre — le bon format pour des cartes
    // tenues a la main. Elle descend a 89%, donc SOUS le chat de la
    // plateforme, et c'est voulu : le chat est une surcouche que le viewer
    // peut masquer, la video doit donc exister dessous. Elle descend jusqu'au
    // bord bas du canvas : les ornements de la fenetre passent hors champ.
    // Pas de ratio ici : recadrer une camera 16:9 en portrait est justement
    // ce qu'on veut pour la table, on garde le centre et on coupe les cotes.
    camBreak: { top: 30, height: 70, width: 80, ratio: "", bare: false, decoupeFond: true },

    // Bras d'angle sur les fenetres camera. false par defaut : sur une camera
    // a fond clair ils perdent tout contraste, et on ne percoit alors plus les
    // traits mais les rectangles qu'ils delimitent. Le liseré cadre tres bien
    // tout seul. Passe a true si ton image est sombre.
    showCorners: false,

    // Bornes du CADRE decoratif exterieur. A 0 en bas, le cadre est prolonge
    // hors champ : la camera break descend jusqu'au bord et l'image se termine
    // franchement, sans liseré en travers.
    stageTopPct: 4,
    stageBottomPct: 0,

    // Zones recouvertes par l'interface de la plateforme (nom du vendeur en
    // haut, chat et emojis en bas). Ce ne sont que des REPERES, affichables
    // avec showSafeZones : rien n'y est interdit. Le chat est une surcouche
    // que le viewer peut masquer, donc la video doit exister dessous. Seul le
    // bandeau reste degage, parce que lui porte du texte a lire.
    //
    // Revu a la hausse (8/22 -> 10/30) apres un test en direct sur telephone :
    // la vue mobile de Whatnot montre un bandeau d'app au-dessus de la camera
    // ET, en bas, un bloc persistant propre au format "Spot" (note du live,
    // choix du spot, frais de port, bouton "Voir les places") qui — lui,
    // contrairement au chat — ne se masque pas. Reperes encore approximatifs :
    // a recaler avec showSafeZones face a une vraie capture telephone.
    safeTopPct: 10,
    safeBottomPct: 30,

    // Zone rognee sur telephone. La plupart des plateformes (Whatnot compris,
    // verifie en direct) remplissent tout l'ecran du telephone sans bande
    // noire ; un telephone etant plus HAUT que notre image 1080x1920, pour
    // remplir sans bande le lecteur rogne les COTES, pas le haut ni le bas.
    // Constate en direct : les rails neon des bords avaient completement
    // disparu sur la capture telephone. Contrairement au haut/bas, ce n'est
    // pas une surcouche masquable : ce qui tombe dedans est vraiment perdu.
    safeSidePct: 10,

    ringSec: 9,          // duree d'un tour de la lumiere autour des fenetres
    scanEverySec: 34,    // balayage sur la fenetre break. 0 = jamais

    // Mets true (ou ajoute ?zones=1 a l'URL) pour afficher les reperes des
    // zones plateforme pendant que tu regles ta scene. A remettre a false.
    showSafeZones: false,
  },

  /* ------------------------------------------------------------------
     LE FOND D'ARENE  (fichier fond.html)
     ------------------------------------------------------------------ */
  arena: {
    // >>> METS ICI TON IMAGE DE SALLE <<<
    // Le decor est une IMAGE, pas du code : une arene credible demande des
    // gradins, de la profondeur et une vraie lumiere. Voir le LISEZ-MOI pour
    // savoir quoi demander a un generateur d'images.
    // Pose ton fichier dans assets/ puis mets son chemin ici.
    image: "assets/arene.jpg",

    imageOpacity: 1,

    /* CES DEUX REGLAGES COUTENT DU DEBIT VIDEO.
       Whatnot demande 1080x1920 a 30 fps pour 2500-3500 kbps, soit 0,056 bit
       par pixel : c'est tres serre. Tout pixel du decor qui bouge est du debit
       en moins pour tes cartes. Voir la section debit du LISEZ-MOI. */

    imageBreathe: false, // respiration du decor. Fait changer 100 % des pixels
                         // a chaque image : c'est le plus couteux de tous les
                         // effets. Laisse false si ton image est deja belle.

    intensity: 0,     // halos de lumiere qui derivent sur le decor.
                         // Ils balayent 88 % de la surface, donc ils coutent
                         // aussi. 0 = decor totalement fixe, le plus econome.
                         // 1 = normal, 1.4 = appuye

    vignette: 0.5,       // assombrissement des bords. Gratuit, il ne bouge pas.
                         // Monte-le si le decor distrait, baisse-le pour voir
                         // plus de gradins
  },

  /* ------------------------------------------------------------------------
     SPORTS PERSONNALISES
     Crees depuis l'editeur de sports (sports.html). Chaque entree
     rejoint la meme table que les ligues livrees (NBA, NFL) : le reste du
     code — regie, apercu, overlay — n'a pas a savoir qu'un sport est "maison"
     ou personnalise.

     Une equipe est un tableau [sigle, nom, couleur1, couleur2, logo?]. Le
     logo est facultatif et, s'il est present, une adresse complete vers un
     logo uploade (contrairement aux ligues livrees, qui passent par un
     modele de chemin — il n'y a pas de dossier assets/ pour un sport cree en
     ligne).
     ------------------------------------------------------------------------ */
  sportsCustom: {
    // exemple :
    // mlb: { nom: "MLB", equipes: [
    //   ["NYY", "New York Yankees", "#432b2e", "#FFFFFF", "/api/media/logo/xxxx"],
    // ] },
  },

  /* ------------------------------------------------------------------------
     RANDOMS
     La grille des equipes du break, sous le bandeau, par-dessus la camera du
     bas. "pris" contient les sigles des equipes deja vendues : elles partent
     en gris et se font barrer.

     C'est la seule section applicable A CHAUD : la marquer ne recharge pas
     l'overlay, sinon chaque vente ferait sauter le ticker et relancerait
     l'orbite du logo en pleine vente.
     ------------------------------------------------------------------------ */
  randoms: {
    actif: true,
    ligue: "nba",        // "nba" ou "nfl" — se choisit depuis la regie
    parLigne: 10,        // equipes par ligne, pas nombre de lignes : une
                         // ligue de plus (32 au lieu de 30) ajoute une ligne
                         // de reste plus courte et centree, sans redistribuer
                         // les cases existantes ni changer leur largeur
    pris: [],            // sigles vendus, ex. ["LAL", "BOS"]
    deuxPourUn: { actif: false, seuil: 10 },
                         // pastille "2 POUR 1" : visible si actif ET si les
                         // spots restants sont >= seuil (possible jusqu.a ce seuil). Se pilote depuis la regie
    ecart: 1.4,          // % du canvas SOUS LA BARRE du bandeau. La grille
                         // se recale toute seule si tu bouges le bandeau :
                         // on mesure la barre, on ne devine pas un pourcentage
    width: 75.5,           // % du canvas, au plus. La grille reste dans la
                         // partie visible au telephone (layout.safeSidePct)
                         // et a l'ecart des icones Whatnot (margeIcones)
    margeIcones: 2,      // % du canvas laisse aux icones Whatnot (Plus,
                         // Mises en avant, Clip…), des deux cotes pour que
                         // la grille reste centree. 0 = pleine largeur
    hauteurCases: 1.2,   // hauteur d'une case / sa largeur. Au-dessus de 1,
                         // les cases sont plus hautes que larges
    opacite: 0.95,       // 1 = opaque. La camera doit rester lisible dessous
    voile: 0,            // fond sombre derriere les logos. 0 = transparent,
                         // c'est voulu : un aplat se battait avec les logos.
                         // A monter (0,2 a 0,4) seulement si la camera du bas
                         // devient claire au point de manger les logos sombres
    logoUrl: "assets/logos/{ligue}/{ABBR}.png",
                         // {ligue} = nba ou nfl, {ABBR} = LAL, {abbr} = lal.
                         // Vide = sigles seuls sur la couleur de l'equipe.
                         // Une image absente laisse le sigle en place, jamais
                         // de case vide
  },

  /* ------------------------------------------------------------------------
     PUNCHLINES
     La phrase sous le logo quand un spot est attribue. Section a part, et
     non dans randoms : la regie et la synchro Whatnot reecrivent randoms a
     chaque vente, elles ne doivent pas ecraser une liste qu'on vient de
     modifier dans les reglages. Se regle depuis reglages.html.
     ------------------------------------------------------------------------ */
  punchlines: {
    actif: true,
    phrases: [
      "Le portefeuille pleure",
      "Il a craqué !",
      "Encore un !",
      "Le banquier est au courant ?",
      "Pas de remboursement, pas de regrets",
      "Ça sent le hit",
      "Coup de génie ou coup de folie ?",
      "Mamie n'en saura rien",
      "Le chat est jaloux",
      "Signé, tamponné, encaissé",
      "On prie pour un auto",
      "Croisez les doigts pour le numéroté",
      "Il fallait oser",
      "Direct dans la collection",
      "On ne juge pas… un peu quand même",
      "Spot de champion",
      "Le reste du chat est en PLS",
      "Le compte en banque a quitté le live",
    ],
  },

  /* ------------------------------------------------------------------------
     ANIMATIONS DU SPOT ATTRIBUE
     Celles qui tournent a chaque vente (une au hasard, jamais deux fois la
     meme d'affilee). false = retiree de la rotation. Toutes coupees, le
     catcheur reste. Section a part, pour la meme raison que punchlines.
     ------------------------------------------------------------------------ */
  animations: {
    carte: true,          // la carte blanche monte, tampon VENDU
  },

  /* ------------------------------------------------------------------------
     THEMES
     Un theme apparie un decor et un globe, et se pose d'un seul clic. C'est
     ce qui permet de basculer tout l'habillage entre un break NBA et un
     break foot sans toucher a deux reglages separes.

     Un theme ne porte QUE ces deux images, volontairement : appliquer un
     theme ne doit jamais defaire un reglage qu'on vient d'ajuster ailleurs.

     Le theme actif n'est pas stocke — il est deduit : c'est celui dont les
     deux images correspondent a la configuration en cours. Ainsi, changer le
     globe a la main ne laisse pas un theme faussement marque actif.
     ------------------------------------------------------------------------ */
  themes: [
    { id: "classique", nom: "Classique",
      fond: "assets/arene.jpg", globe: "assets/terre.png" },
  ],

};
