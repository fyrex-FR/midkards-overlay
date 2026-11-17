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
      "MIDKARDS — BREAKS EN LIVE",
      "TCG  •  SPORT CARDS  •  COLLECTOR'S ITEMS",
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
     LES POLICES
     Trois facons de choisir, dans cet ordre de priorite :

     1. UN FICHIER que tu deposes toi-meme (police achetee, .woff2 / .ttf / .otf)
          fontFile: "assets/fonts/MaPolice.woff2"
        Pose le fichier dans assets/fonts/ et donne son chemin.

     2. UNE POLICE GOOGLE FONTS, par son nom exact
          family: "Anton", google: true
        Quelques-unes qui vont bien avec l'habillage :
          Anton, Bebas Neue, Oswald, Teko, Archivo Black, Saira Condensed,
          Russo One, Rajdhani, Chakra Petch, Orbitron, Audiowide, Michroma
        (les quatre dernieres ont un cote plus techno / retro)

     3. UNE POLICE DEJA INSTALLEE sur ta machine, par son nom
          family: "Impact", google: false

     Dans tous les cas, si la police n'arrive pas, le texte reste lisible
     avec la police de repli. Rien ne casse.
     ------------------------------------------------------------------ */
  typo: {

    // Le texte defilant, a gauche
    ticker: {
      family: "Barlow Condensed",
      google: false,       // true = va la chercher chez Google Fonts
      fontFile: "",        // prioritaire sur family s'il est renseigne
      weight: 600,         // 400 normal, 600 semi-gras, 700 gras, 900 tres gras
      scale: 1,            // 1 = taille par defaut, 1.15 = 15% plus gros
      tracking: 0.085,     // espacement entre les lettres, en em
      uppercase: true,     // false pour garder ta casse d'origine
    },

    // Les reseaux, a droite. Laisse family vide pour reprendre celle du ticker.
    social: {
      family: "",
      google: false,
      fontFile: "",
      weight: 700,
      scale: 1,
      tracking: 0.075,
      uppercase: true,
    },
  },

  /* ------------------------------------------------------------------
     LOGO CENTRAL
     Les animations sont PONCTUELLES : elles se declenchent toutes les
     X secondes, pas en continu. Mets 0 pour desactiver une animation.
     ------------------------------------------------------------------ */
  logo: {
    src: "assets/logo.png",

    // "orbit"  = la planete au centre, le logo qui tourne autour
    // "static" = le logo pose au centre, avec balayage lumineux
    mode: "static",

    scale: 1.0,          // mode static seulement : 1.15 = 15% plus gros
    sweepEverySec: 22,   // mode static seulement : balayage lumineux
    tiltEverySec: 46,    // mode static seulement : petite rotation 3D
    pulse: true,         // respiration tres lente de la lueur
  },

  /* ------------------------------------------------------------------
     LA PLANETE ET LE LOGO ENROULE AUTOUR  (si logo.mode vaut "orbit")
     ------------------------------------------------------------------ */
  planet: {
    // --- le globe ---
    // Image fixe. Elle ne tourne pas : une photo de Terre n'a qu'une face,
    // la faire pivoter donnerait un glissement de texture, pas une rotation.
    image: "assets/terre.png",

    size: 0.46,          // taille du globe dans l'assemblage

    // Repli si tu vides "image" : un globe CALCULE, lui, tourne vraiment
    // (36 images rendues, defilees cran par cran).
    //   cd assets/source && python3 rendu-planete.py ../planete.png neon 36 200
    // Variantes : neon, violet, terre
    sheet: "assets/planete.png",
    frames: 36,          // doit correspondre au nombre d'images de la planche
    spinSec: 40,         // vitesse de rotation, planche uniquement

    // --- le logo qui s'enroule autour ---
    wrap: "logo",        // "logo" = ton logo enroule | "text" = le nom en toutes lettres
    orbitSec: 22,        // duree d'un tour complet autour du globe
    tiltDeg: 14,         // inclinaison. Reste petit : c'est un enroulement
                         // autour de l'equateur, pas un plan d'orbite. Au-dela
                         // de ~30 le logo se couche a plat.
    ringRadius: 0.33,    // ecartement du logo par rapport au centre
    arcDeg: 100,         // portion du tour occupee par le logo.
                         // Plus grand = logo plus gros et plus courbe, mais
                         // plus haut aussi. Au-dela de ~150 il devient trop
                         // haut pour la bande.
    slices: 28,          // finesse de la courbure. Monter si on voit des angles

    // Utilises seulement si wrap vaut "text"
    ringText: "MIDKARDS",
    ringSep: " \u25C6 ",
    ringFontRatio: 0.095,
  },

  /* ------------------------------------------------------------------
     LE BANDEAU LUI-MEME
     ------------------------------------------------------------------ */
  bar: {
    // Le bandeau est une IMAGE. Les fractions ci-dessous disent au code ou se
    // trouve la barre pleine dans cette image : il en a besoin pour centrer le
    // texte dessus, parce que l'image contient aussi du glow au-dessus et en
    // dessous, et un medaillon qui descend plus bas que la barre.
    // "medaillon" = avec le diamant central et le globe dedans
    // "plein"      = barre continue, sans diamant : les textes lateraux
    //                gagnent toute la place du medaillon
    style: "medaillon",

    image: "assets/bandeau.png",           // version avec medaillon
    imagePlain: "assets/bandeau-plein.png", // version sans
    imageBarTop: 0.3297,     // haut de la barre pleine dans l'image
    imageBarBottom: 0.6910,  // bas de la barre pleine
    imageFieldCenter: 0.5364, // centre du champ sombre ou vit le texte.
                             // Pas 0.5 : les liseres du haut et du bas de
                             // l'image ne sont pas symetriques.
    imagePadFrac: 0.075,     // marge laterale. Les panneaux finissent en
                             // pointe de chevron : sans marge, le texte y entre
    centerFrac: 0.30,        // largeur reservee au medaillon + logo enroule
    centerFracPlain: 0.24,   // en style "plein" : largeur reservee au globe.
                             // Sans le diamant, la colonne peut etre plus
                             // serree qu'en medaillon (0.30), d'ou la place
                             // gagnee pour les textes.
                             // Mets 0 pour retirer le globe completement et
                             // donner toute la barre aux deux textes.

    /* Calage propre au style "plein". Cette image a ses propres proportions :
       sa barre est plus fine, et deux traits lumineux encadrent un champ
       sombre de seulement 16% de la hauteur de l'image. Ces valeurs
       remplacent celles du dessus quand le style vaut "plein". */
    plein: {
      imageBarTop: 0.3379,
      imageBarBottom: 0.6634,
      imageFieldCenter: 0.4876,
      imagePadFrac: 0.055,
      heightPct: 77,         // texte plus petit : le champ sombre est plus bas
    },
    imageMedallionFrac: 0.1507, // largeur du medaillon seul dans l'image.
                             // Borne le logo en mode "static" pour qu'il
                             // tienne dedans et non a cheval dessus.

    heightPct: 62,       // hauteur du texte par rapport a la barre
    sheenEverySec: 18,   // reflet CSS. Sans effet en mode image
    radiusPx: 14,        // sans effet en mode image
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

    // Le bandeau central, entre les deux cameras
    // La bande contient TOUTE l'image du bandeau, glow compris, d'ou sa
    // hauteur. La barre pleine, elle, tombe de 27,4% a 33,5%, donc pile entre
    // les deux cameras.
    banner:   { top: 18, height: 16.9, width: 80 },

    // Fenetre de la camera break : 2.5x plus haute que celle de l'animateur,
    // 3x en surface, en format quasi carre — le bon format pour des cartes
    // tenues a la main. Elle descend a 89%, donc SOUS le chat de la
    // plateforme, et c'est voulu : le chat est une surcouche que le viewer
    // peut masquer, la video doit donc exister dessous. Elle descend jusqu'au
    // bord bas du canvas : les ornements de la fenetre passent hors champ.
    // Pas de ratio ici : recadrer une camera 16:9 en portrait est justement
    // ce qu'on veut pour la table, on garde le centre et on coupe les cotes.
    camBreak: { top: 30, height: 70, width: 80, ratio: "", bare: false, decoupeFond: false },

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

    intensity: 0.35,     // halos de lumiere qui derivent sur le decor.
                         // Ils balayent 88 % de la surface, donc ils coutent
                         // aussi. 0 = decor totalement fixe, le plus econome.
                         // 1 = normal, 1.4 = appuye

    vignette: 1.0,       // assombrissement des bords. Gratuit, il ne bouge pas.
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
    width: 78,           // % du canvas, au plus. La grille reste dans la
                         // partie visible au telephone (layout.safeSidePct)
                         // et a l'ecart des icones Whatnot (margeIcones)
    margeIcones: 11,     // % du canvas laisse aux icones Whatnot (Plus,
                         // Mises en avant, Clip…), des deux cotes pour que
                         // la grille reste centree. 0 = pleine largeur
    hauteurCases: 1.1,   // hauteur d'une case / sa largeur. Au-dessus de 1,
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
    catcheur: true,      // le logo tombe, s'ecrase, tampon VENDU
    shooteur: true,      // un bonhomme baton shoote, SWISH, le logo sort du panier
    pince: true,         // la pince de fete foraine attrape la carte
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
