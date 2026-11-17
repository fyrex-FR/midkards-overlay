/* ==========================================================================
   MIDKARDS — Grille des randoms

   Les equipes du break, en trois lignes sous le bandeau, posees en semi
   transparence par-dessus la camera du bas. Une equipe vendue est barree.

   Sorti du HTML pour la meme raison que arena.js : en ligne, la configuration
   arrive de facon asynchrone, un script en ligne dans la page lirait donc la
   config embarquee au lieu de celle enregistree.

   Deux partis pris qui comptent :

   1. AUCUNE ANIMATION PERMANENTE. La grille couvre 8 % de l'image. Animee, elle
      empecherait l'encodeur de reutiliser cette zone d'une image sur l'autre,
      et a 0,056 bit par pixel ce debit est pris aux cartes. Fixe, elle ne
      coute qu'une fois. Seule la selection ponctuelle d'un spot s'anime.

   2. Pas de backdrop-filter pour le flou derriere la grille. Cette couche est
      une source de navigateur composee AU-DESSUS de la camera : le flou ne
      verrait que le vide transparent de la page, pas la camera. Seule une
      couleur en alpha fonctionne ici.
   ========================================================================== */
(() => {
  "use strict";

  /* --- les ligues -------------------------------------------------------
     Nom, couleur principale et secondaire officielles. L'ordre est
     alphabetique : dans un random, le tirage se fait ailleurs, ce qu'on
     demande a cette grille c'est de retrouver une equipe du regard.
     -------------------------------------------------------------------- */
  const LIGUES = {
    nba: {
      nom: "NBA",
      equipes: [
        ["ATL", "Atlanta Hawks",          "#E03A3E", "#C1D32F"],
        ["BKN", "Brooklyn Nets",          "#1A1A1A", "#FFFFFF"],
        ["BOS", "Boston Celtics",         "#007A33", "#BA9653"],
        ["CHA", "Charlotte Hornets",      "#1D1160", "#00788C"],
        ["CHI", "Chicago Bulls",          "#CE1141", "#1A1A1A"],
        ["CLE", "Cleveland Cavaliers",    "#860038", "#041E42"],
        ["DAL", "Dallas Mavericks",       "#00538C", "#002B5E"],
        ["DEN", "Denver Nuggets",         "#0E2240", "#FEC524"],
        ["DET", "Detroit Pistons",        "#C8102E", "#1D42BA"],
        ["GSW", "Golden State Warriors",  "#1D428A", "#FFC72C"],
        ["HOU", "Houston Rockets",        "#CE1141", "#1A1A1A"],
        ["IND", "Indiana Pacers",         "#002D62", "#FDBB30"],
        ["LAC", "LA Clippers",            "#C8102E", "#1D428A"],
        ["LAL", "Los Angeles Lakers",     "#552583", "#FDB927"],
        ["MEM", "Memphis Grizzlies",      "#5D76A9", "#12173F"],
        ["MIA", "Miami Heat",             "#98002E", "#F9A01B"],
        ["MIL", "Milwaukee Bucks",        "#00471B", "#EEE1C6"],
        ["MIN", "Minnesota Timberwolves", "#0C2340", "#236192"],
        ["NOP", "New Orleans Pelicans",   "#0C2340", "#C8102E"],
        ["NYK", "New York Knicks",        "#006BB6", "#F58426"],
        ["OKC", "Oklahoma City Thunder",  "#007AC1", "#EF3B24"],
        ["ORL", "Orlando Magic",          "#0077C0", "#C4CED4"],
        ["PHI", "Philadelphia 76ers",     "#006BB6", "#ED174C"],
        ["PHX", "Phoenix Suns",           "#1D1160", "#E56020"],
        ["POR", "Portland Trail Blazers", "#E03A3E", "#1A1A1A"],
        ["SAC", "Sacramento Kings",       "#5A2D81", "#63727A"],
        ["SAS", "San Antonio Spurs",      "#C4CED4", "#1A1A1A"],
        ["TOR", "Toronto Raptors",        "#CE1141", "#1A1A1A"],
        ["UTA", "Utah Jazz",              "#002B5C", "#00471B"],
        ["WAS", "Washington Wizards",     "#002B5C", "#E31837"],
      ],
    },

    /* Les 30 spots du break Whatnot Shaks (heritage) : noms identiques a ceux de Whatnot
       (la synchro compare le titre du spot au nom ci-dessous), dans l'ordre
       de la fiche du live. Les equipes prennent les logos de la roue NBA
       (dossierLogos) : un seul jeu de logos NBA pour tout l'habillage. Seuls
       les spots propres a ce break (UNIV MEN, DEN/UW, MIL/COACH) ont le leur,
       dans assets/logos/nba-whatnot/. */
    "nba-whatnot": {
      nom: "NBA Whatnot (UM, DEN+UW, MIL+CO)",
      dossierLogos: "nba",
      equipes: [
        ["ATL",    "Atlanta Hawks", "#E03A3E", "#C1D32F"],
        ["BOS",    "Boston Celtics", "#007A33", "#BA9653"],
        ["UNIV\u00a0M", "UNIV MEN", "#35D6FF", "#0A0D18", "assets/logos/nba-whatnot/UNIVM.webp?v=4"],
        ["CHA",    "Charlotte Hornets", "#1D1160", "#00788C"],
        ["CHI",    "Chicago Bulls", "#CE1141", "#1A1A1A"],
        ["CLE",    "Cleveland Cavaliers", "#860038", "#041E42"],
        ["DAL",    "Dallas Mavericks", "#00538C", "#002B5E"],
        ["DEN/UW", "Denver Nuggets/UNIV WOMEN", "#E040FB", "#0A0D18", "assets/logos/nba-whatnot/DENUW.webp?v=4"],
        ["DET",    "Detroit Pistons", "#C8102E", "#1D42BA"],
        ["GSW",    "Golden State Warriors", "#1D428A", "#FFC72C"],
        ["HOU",    "Houston Rockets", "#CE1141", "#1A1A1A"],
        ["IND",    "Indiana Pacers", "#002D62", "#FDBB30"],
        ["LAC",    "LA Clippers", "#C8102E", "#1D428A"],
        ["LAL",    "LA Lakers", "#552583", "#FDB927"],
        ["MEM",    "Memphis Grizzlies", "#5D76A9", "#12173F"],
        ["MIA",    "Miami Heat", "#98002E", "#F9A01B"],
        ["MIL/CO", "Milwaukee Bucks/COACH", "#A6E22E", "#0A0D18", "assets/logos/nba-whatnot/MILCO.webp?v=4"],
        ["MIN",    "Minnesota Timberwolves", "#0C2340", "#236192"],
        ["NOP",    "New Orleans Pelicans", "#0C2340", "#C8102E"],
        ["NYK",    "New York Knicks", "#006BB6", "#F58426"],
        ["OKC",    "Oklahoma City Thunder", "#007AC1", "#EF3B24"],
        ["ORL",    "Orlando Magic", "#0077C0", "#C4CED4"],
        ["PHI",    "Philadelphia Sixers", "#006BB6", "#ED174C"],
        ["PHX",    "Phoenix Suns", "#1D1160", "#E56020"],
        ["POR",    "Portland Trail Blazers", "#E03A3E", "#1A1A1A"],
        ["SAC",    "Sacramento Kings", "#5A2D81", "#63727A"],
        ["SAS",    "San Antonio Spurs", "#C4CED4", "#1A1A1A"],
        ["TOR",    "Toronto Raptors", "#CE1141", "#1A1A1A"],
        ["UTA",    "Utah Jazz", "#002B5C", "#00471B"],
        ["WAS",    "Washington Wizards", "#002B5C", "#E31837"],
      ],
    },

    /* Variante du break NBA Whatnot : UNIV MEN va avec les Nets et UNIV
       WOMEN avec les Pacers. Noms identiques a ceux de Whatnot, dans l'ordre
       de la fiche du live. Logos de la roue NBA ; les deux spots combines ont
       un logo compose (equipe + badge UNIV) dans assets/logos/nba-whatnot/. */
    "nba-whatnot-2": {
      nom: "NBA Whatnot (BKN+UM, IND+UW)",
      dossierLogos: "nba",
      equipes: [
        ["ATL", "Atlanta Hawks", "#E03A3E", "#C1D32F"],
        ["BOS", "Boston Celtics", "#007A33", "#BA9653"],
        ["BKN/UM", "Brooklyn Nets+Univ Men", "#35D6FF", "#0A0D18", "assets/logos/nba-whatnot/BKNUM.webp?v=4"],
        ["CHA", "Charlotte Hornets", "#1D1160", "#00788C"],
        ["CHI", "Chicago Bulls", "#CE1141", "#1A1A1A"],
        ["CLE", "Cleveland Cavaliers", "#860038", "#041E42"],
        ["DAL", "Dallas Mavericks", "#00538C", "#002B5E"],
        ["DEN", "Denver Nuggets", "#0E2240", "#FEC524"],
        ["DET", "Detroit Pistons", "#C8102E", "#1D42BA"],
        ["GSW", "Golden State Warriors", "#1D428A", "#FFC72C"],
        ["HOU", "Houston Rockets", "#CE1141", "#1A1A1A"],
        ["IND/UW", "Indiana Pacers/univ Women", "#E040FB", "#0A0D18", "assets/logos/nba-whatnot/INDUW.webp?v=4"],
        ["LAC", "LA Clippers", "#C8102E", "#1D428A"],
        ["LAL", "LA Lakers", "#552583", "#FDB927"],
        ["MEM", "Memphis Grizzlies", "#5D76A9", "#12173F"],
        ["MIA", "Miami Heat", "#98002E", "#F9A01B"],
        ["MIL", "Milwaukee Bucks", "#00471B", "#EEE1C6"],
        ["MIN", "Minnesota Timberwolves", "#0C2340", "#236192"],
        ["NOP", "New Orleans Pelicans", "#0C2340", "#C8102E"],
        ["NYK", "New York Knicks", "#006BB6", "#F58426"],
        ["OKC", "Oklahoma City Thunder", "#007AC1", "#EF3B24"],
        ["ORL", "Orlando Magic", "#0077C0", "#C4CED4"],
        ["PHI", "Philadelphia Sixers", "#006BB6", "#ED174C"],
        ["PHX", "Phoenix Suns", "#1D1160", "#E56020"],
        ["POR", "Portland Trail Blazers", "#E03A3E", "#1A1A1A"],
        ["SAC", "Sacramento Kings", "#5A2D81", "#63727A"],
        ["SAS", "San Antonio Spurs", "#C4CED4", "#1A1A1A"],
        ["TOR", "Toronto Raptors", "#CE1141", "#1A1A1A"],
        ["UTA", "Utah Jazz", "#002B5C", "#00471B"],
        ["WAS", "Washington Wizards", "#002B5C", "#E31837"],
      ],
    },

    /* Break Whatnot Shaks Allen & Ginter : 32 spots, noms identiques a ceux de
       Whatnot (la synchro compare le titre du spot au nom ci-dessous). */
    "mlb-ag": {
      nom: "MLB Allen & Ginter",
      parLigne: 11,   // 32 spots : 11+11+10 tiennent sur 3 lignes, au lieu de 10+10+10+2
      equipes: [
        ["ARI", "Arizona Diamondbacks", "#A71930", "#E3D4AD", "assets/logos/mlb-ag/ARI.webp?v=4"],
        ["ATL", "Atlanta Braves", "#CE1141", "#13274F", "assets/logos/mlb-ag/ATL.webp?v=4"],
        ["BAL", "Baltimore Orioles", "#DF4601", "#1A1A1A", "assets/logos/mlb-ag/BAL.webp?v=4"],
        ["BOS", "Boston Red Sox", "#BD3039", "#0C2340", "assets/logos/mlb-ag/BOS.webp?v=4"],
        ["CHC", "Chicago Cubs", "#0E3386", "#CC3433", "assets/logos/mlb-ag/CHC.webp?v=4"],
        ["CWS", "Chicago White Sox", "#27251F", "#C4CED4", "assets/logos/mlb-ag/CWS.webp?v=4"],
        ["CIN", "Cincinnati Reds", "#C6011F", "#1A1A1A", "assets/logos/mlb-ag/CIN.webp?v=4"],
        ["CLE", "Cleveland Guardians", "#00385D", "#E50022", "assets/logos/mlb-ag/CLE.webp?v=4"],
        ["COL", "Colorado Rockies", "#33006F", "#C4CED4", "assets/logos/mlb-ag/COL.webp?v=4"],
        ["DET", "Detroit Tigers", "#0C2340", "#FA4616", "assets/logos/mlb-ag/DET.webp?v=4"],
        ["HOU", "Houston Astros", "#002D62", "#EB6E1F", "assets/logos/mlb-ag/HOU.webp?v=4"],
        ["KC", "Kansas City Royals", "#004687", "#BD9B60", "assets/logos/mlb-ag/KC.webp?v=4"],
        ["LAA", "Los Angeles Angels", "#BA0021", "#003263", "assets/logos/mlb-ag/LAA.webp?v=4"],
        ["LAD", "Los Angeles Dodgers", "#005A9C", "#EF3E42", "assets/logos/mlb-ag/LAD.webp?v=4"],
        ["MIA", "Miami Marlins", "#00A3E0", "#EF3340", "assets/logos/mlb-ag/MIA.webp?v=4"],
        ["MIL", "Milwaukee Brewers", "#12284B", "#FFC52F", "assets/logos/mlb-ag/MIL.webp?v=4"],
        ["MIN", "Minnesota Twins", "#002B5C", "#D31145", "assets/logos/mlb-ag/MIN.webp?v=4"],
        ["NYM", "New York Mets", "#002D72", "#FF5910", "assets/logos/mlb-ag/NYM.webp?v=4"],
        ["NYY", "New York Yankees", "#0C2340", "#C4CED3", "assets/logos/mlb-ag/NYY.webp?v=4"],
        ["OAK", "Oakland Athletics", "#003831", "#EFB21E", "assets/logos/mlb-ag/OAK.webp?v=4"],
        ["PHI", "Philadelphia Phillies", "#E81828", "#002D72", "assets/logos/mlb-ag/PHI.webp?v=4"],
        ["PIT", "Pittsburgh Pirates", "#27251F", "#FDB827", "assets/logos/mlb-ag/PIT.webp?v=4"],
        ["SD", "San Diego Padres", "#2F241D", "#FFC425", "assets/logos/mlb-ag/SD.webp?v=4"],
        ["SF", "San Francisco Giants", "#FD5A1E", "#27251F", "assets/logos/mlb-ag/SF.webp?v=4"],
        ["SEA", "Seattle Mariners", "#0C2C56", "#005C5C", "assets/logos/mlb-ag/SEA.webp?v=4"],
        ["STL", "St. Louis Cardinals", "#C41E3A", "#0C2340", "assets/logos/mlb-ag/STL.webp?v=4"],
        ["TB", "Tampa Bay Rays", "#092C5C", "#8FBCE6", "assets/logos/mlb-ag/TB.webp?v=4"],
        ["TEX", "Texas Rangers", "#003278", "#C0111F", "assets/logos/mlb-ag/TEX.webp?v=4"],
        ["TOR", "Toronto Blue Jays", "#134A8E", "#1D2D5C", "assets/logos/mlb-ag/TOR.webp?v=4"],
        ["WSH", "Washington Nationals", "#AB0003", "#14225A", "assets/logos/mlb-ag/WSH.webp?v=4"],
        ["CELEB", "NON Baseball Celebrity", "#7A3FF2", "#0A0D18", "assets/logos/mlb-ag/CELEB.svg?v=1"],
        ["INSERTS", "ALL OTHERS INSERTS", "#F2B31A", "#0A0D18", "assets/logos/mlb-ag/INSERTS.svg?v=1"],
      ],
    },

    /* Break Whatnot Shaks Allen & Ginter en blaster : les 30 equipes de la
       roue MLB Allen & Ginter (memes logos, dossierLogos), et un seul spot
       pour la celebrity et les autres inserts. 31 spots : 11+11+9. */
    "mlb-ag-blaster": {
      nom: "MLB Allen & Ginter Blaster",
      parLigne: 11,
      equipes: [
        ["ARI", "Arizona Diamondbacks", "#A71930", "#E3D4AD", "assets/logos/mlb-ag/ARI.webp?v=4"],
        ["ATL", "Atlanta Braves", "#CE1141", "#13274F", "assets/logos/mlb-ag/ATL.webp?v=4"],
        ["BAL", "Baltimore Orioles", "#DF4601", "#1A1A1A", "assets/logos/mlb-ag/BAL.webp?v=4"],
        ["BOS", "Boston Red Sox", "#BD3039", "#0C2340", "assets/logos/mlb-ag/BOS.webp?v=4"],
        ["CHC", "Chicago Cubs", "#0E3386", "#CC3433", "assets/logos/mlb-ag/CHC.webp?v=4"],
        ["CWS", "Chicago White Sox", "#27251F", "#C4CED4", "assets/logos/mlb-ag/CWS.webp?v=4"],
        ["CIN", "Cincinnati Reds", "#C6011F", "#1A1A1A", "assets/logos/mlb-ag/CIN.webp?v=4"],
        ["CLE", "Cleveland Guardians", "#00385D", "#E50022", "assets/logos/mlb-ag/CLE.webp?v=4"],
        ["COL", "Colorado Rockies", "#33006F", "#C4CED4", "assets/logos/mlb-ag/COL.webp?v=4"],
        ["DET", "Detroit Tigers", "#0C2340", "#FA4616", "assets/logos/mlb-ag/DET.webp?v=4"],
        ["HOU", "Houston Astros", "#002D62", "#EB6E1F", "assets/logos/mlb-ag/HOU.webp?v=4"],
        ["KC", "Kansas City Royals", "#004687", "#BD9B60", "assets/logos/mlb-ag/KC.webp?v=4"],
        ["LAA", "Los Angeles Angels", "#BA0021", "#003263", "assets/logos/mlb-ag/LAA.webp?v=4"],
        ["LAD", "Los Angeles Dodgers", "#005A9C", "#EF3E42", "assets/logos/mlb-ag/LAD.webp?v=4"],
        ["MIA", "Miami Marlins", "#00A3E0", "#EF3340", "assets/logos/mlb-ag/MIA.webp?v=4"],
        ["MIL", "Milwaukee Brewers", "#12284B", "#FFC52F", "assets/logos/mlb-ag/MIL.webp?v=4"],
        ["MIN", "Minnesota Twins", "#002B5C", "#D31145", "assets/logos/mlb-ag/MIN.webp?v=4"],
        ["NYM", "New York Mets", "#002D72", "#FF5910", "assets/logos/mlb-ag/NYM.webp?v=4"],
        ["NYY", "New York Yankees", "#0C2340", "#C4CED3", "assets/logos/mlb-ag/NYY.webp?v=4"],
        ["OAK", "Oakland Athletics", "#003831", "#EFB21E", "assets/logos/mlb-ag/OAK.webp?v=4"],
        ["PHI", "Philadelphia Phillies", "#E81828", "#002D72", "assets/logos/mlb-ag/PHI.webp?v=4"],
        ["PIT", "Pittsburgh Pirates", "#27251F", "#FDB827", "assets/logos/mlb-ag/PIT.webp?v=4"],
        ["SD", "San Diego Padres", "#2F241D", "#FFC425", "assets/logos/mlb-ag/SD.webp?v=4"],
        ["SF", "San Francisco Giants", "#FD5A1E", "#27251F", "assets/logos/mlb-ag/SF.webp?v=4"],
        ["SEA", "Seattle Mariners", "#0C2C56", "#005C5C", "assets/logos/mlb-ag/SEA.webp?v=4"],
        ["STL", "St. Louis Cardinals", "#C41E3A", "#0C2340", "assets/logos/mlb-ag/STL.webp?v=4"],
        ["TB", "Tampa Bay Rays", "#092C5C", "#8FBCE6", "assets/logos/mlb-ag/TB.webp?v=4"],
        ["TEX", "Texas Rangers", "#003278", "#C0111F", "assets/logos/mlb-ag/TEX.webp?v=4"],
        ["TOR", "Toronto Blue Jays", "#134A8E", "#1D2D5C", "assets/logos/mlb-ag/TOR.webp?v=4"],
        ["WSH", "Washington Nationals", "#AB0003", "#14225A", "assets/logos/mlb-ag/WSH.webp?v=4"],
        ["CELEB/INS", "Others Inserts+celebrity", "#CE00FF", "#0A0D18", "assets/logos/mlb-ag-blaster/CELEBINS.svg?v=1"],
      ],
    },

    /* Break Topps Marvel Neon : les noms reprennent les titres des spots
       Whatnot, dans leur ordre. Pas de logos ici mais des portraits, qui
       remplissent la case (portraits: true) ; les spots "Others" portent leur
       plage de lettres. Images dans assets/logos/marvel-neon/. */
    "marvel-neon": {
      nom: "Marvel Neon",
      parLigne: 9,   // 27 spots : 9+9+9
      portraits: true,
      equipes: [
        ["OAB", "A-B Others", "#4A00FF", "#CE00FF", "assets/logos/marvel-neon/OAB.webp?v=1"],
        ["BCAT", "Black Cat", "#1A1A1A", "#E8E8F0", "assets/logos/marvel-neon/BCAT.webp?v=1"],
        ["CYC", "Cyclops /Havok", "#1F4FBF", "#FFD23D", "assets/logos/marvel-neon/CYC.webp?v=1"],
        ["CAP", "Captain America", "#1F3C8F", "#C8102E", "assets/logos/marvel-neon/CAP.webp?v=1"],
        ["DRS", "Doctor Strange/clea", "#2B1A6B", "#D64B1F", "assets/logos/marvel-neon/DRS.webp?v=1"],
        ["OCD", "C-D Others", "#4A00FF", "#CE00FF", "assets/logos/marvel-neon/OCD.webp?v=1"],
        ["OEFG", "E-F-G Others", "#4A00FF", "#CE00FF", "assets/logos/marvel-neon/OEFG.webp?v=1"],
        ["HLK", "Hulk", "#3F8F2A", "#5B2A86", "assets/logos/marvel-neon/HLK.webp?v=1"],
        ["HTT", "Human Torch/The thing", "#FF6A00", "#FFB000", "assets/logos/marvel-neon/HTT.webp?v=1"],
        ["OHI", "H-I Others", "#4A00FF", "#CE00FF", "assets/logos/marvel-neon/OHI.webp?v=1"],
        ["IRM", "Iron Man", "#B3121B", "#F2C14E", "assets/logos/marvel-neon/IRM.webp?v=1"],
        ["JGP", "Jean Grey/Phoenix/Dark Phoenix", "#E0341F", "#FFCC33", "assets/logos/marvel-neon/JGP.webp?v=1"],
        ["OJKL", "J-K-L Others", "#4A00FF", "#CE00FF", "assets/logos/marvel-neon/OJKL.webp?v=1"],
        ["LOK", "Loki/Lady Loki/ Aligator Loki", "#1E6B3A", "#D4AF37", "assets/logos/marvel-neon/LOK.webp?v=1"],
        ["MJ", "Mary Jane", "#C8102E", "#1A1A1A", "assets/logos/marvel-neon/MJ.webp?v=1"],
        ["OM", "M Others", "#4A00FF", "#CE00FF", "assets/logos/marvel-neon/OM.webp?v=1"],
        ["ONPQ", "N-O-P-Q Others", "#4A00FF", "#CE00FF", "assets/logos/marvel-neon/ONPQ.webp?v=1"],
        ["SCW", "Scarlet Witch/Wiccan", "#C2185B", "#7B1FA2", "assets/logos/marvel-neon/SCW.webp?v=1"],
        ["SHK", "She-Hulk", "#4CAF50", "#FFFFFF", "assets/logos/marvel-neon/SHK.webp?v=1"],
        ["SLK", "Silk", "#C8102E", "#F4F4F4", "assets/logos/marvel-neon/SLK.webp?v=1"],
        ["ORS", "R-S Others", "#4A00FF", "#CE00FF", "assets/logos/marvel-neon/ORS.webp?v=1"],
        ["SPM", "Spider Man", "#D0021B", "#1F4FBF", "assets/logos/marvel-neon/SPM.webp?v=1"],
        ["VEN", "Venom/Carnage", "#111111", "#F4F4F4", "assets/logos/marvel-neon/VEN.webp?v=1"],
        ["THR", "Thor/Mighty Thor", "#1F4FBF", "#C8102E", "assets/logos/marvel-neon/THR.webp?v=1"],
        ["OTUY", "T-U-V-W-Y Others", "#4A00FF", "#CE00FF", "assets/logos/marvel-neon/OTUY.webp?v=1"],
        ["WOL", "Wolverine/Old Man Logan", "#FFCC00", "#1F4FBF", "assets/logos/marvel-neon/WOL.webp?v=1"],
        ["X23", "X-23", "#2B2B2B", "#8A1F2B", "assets/logos/marvel-neon/X23.webp?v=1"],
      ],
    },

    /* Break "Random Hobby+ Mega+Value" Marvel Neon (35 spots, format random) :
       titres identiques aux spots Whatnot. Portraits de marvel-neon/ quand le
       personnage existe deja, le reste dans marvel-neon-random/. */
    "marvel-neon-random": {
      nom: "Random Hobby+ Mega+Value",
      breaks: ["random hobby"],   // mots du titre Whatnot, utilises quand le break n'expose aucun spot
      parLigne: 12,   // 35 spots : 12+12+11
      portraits: true,
      equipes: [
        ["OA", "A-Others", "#4A00FF", "#CE00FF", "assets/logos/marvel-neon-random/OA.webp?v=1"],
        ["OB", "B-Others", "#4A00FF", "#CE00FF", "assets/logos/marvel-neon-random/OB.webp?v=1"],
        ["BP", "Black Panther", "#2B1A4F", "#9B6BFF", "assets/logos/marvel-neon-random/BP.webp?v=1"],
        ["OC", "C-Others", "#4A00FF", "#CE00FF", "assets/logos/marvel-neon-random/OC.webp?v=1"],
        ["CAP", "Captain America", "#1F3C8F", "#C8102E", "assets/logos/marvel-neon/CAP.webp?v=1"],
        ["CRN", "Carnage", "#8A0F1F", "#111111", "assets/logos/marvel-neon-random/CRN.webp?v=1"],
        ["OD", "D-Others", "#4A00FF", "#CE00FF", "assets/logos/marvel-neon-random/OD.webp?v=1"],
        ["DD", "Daredevil", "#B3121B", "#1A1A1A", "assets/logos/marvel-neon-random/DD.webp?v=1"],
        ["DOOM", "Doctor Doom", "#1E6B3A", "#2B2B2B", "assets/logos/marvel-neon-random/DOOM.webp?v=1"],
        ["DRS", "Doctor Strange", "#2B1A6B", "#D64B1F", "assets/logos/marvel-neon/DRS.webp?v=1"],
        ["OEF", "E/F-Others", "#4A00FF", "#CE00FF", "assets/logos/marvel-neon-random/OEF.webp?v=1"],
        ["OG", "G-Others", "#4A00FF", "#CE00FF", "assets/logos/marvel-neon-random/OG.webp?v=1"],
        ["GAL", "Galactus", "#5B2A86", "#D4AF37", "assets/logos/marvel-neon-random/GAL.webp?v=1"],
        ["GHS", "Ghost Spider", "#F4F4F4", "#E0349B", "assets/logos/marvel-neon-random/GHS.webp?v=1"],
        ["OH", "H-Others", "#4A00FF", "#CE00FF", "assets/logos/marvel-neon-random/OH.webp?v=1"],
        ["HLK", "Hulk", "#3F8F2A", "#5B2A86", "assets/logos/marvel-neon/HLK.webp?v=1"],
        ["OI", "I-Others", "#4A00FF", "#CE00FF", "assets/logos/marvel-neon-random/OI.webp?v=1"],
        ["IRM", "Iron Man", "#B3121B", "#F2C14E", "assets/logos/marvel-neon/IRM.webp?v=1"],
        ["OJ", "J-Others", "#4A00FF", "#CE00FF", "assets/logos/marvel-neon-random/OJ.webp?v=1"],
        ["OKL", "K/L-Others", "#4A00FF", "#CE00FF", "assets/logos/marvel-neon-random/OKL.webp?v=1"],
        ["LOK", "Loki/Alligator Loki", "#1E6B3A", "#D4AF37", "assets/logos/marvel-neon/LOK.webp?v=1"],
        ["OM", "M-Others", "#4A00FF", "#CE00FF", "assets/logos/marvel-neon-random/OM.webp?v=1"],
        ["ONO", "N/O-Others", "#4A00FF", "#CE00FF", "assets/logos/marvel-neon-random/ONO.webp?v=1"],
        ["OPQ", "P/Q-Others", "#4A00FF", "#CE00FF", "assets/logos/marvel-neon-random/OPQ.webp?v=1"],
        ["OR", "R-Others", "#4A00FF", "#CE00FF", "assets/logos/marvel-neon-random/OR.webp?v=1"],
        ["OS", "S-Others", "#4A00FF", "#CE00FF", "assets/logos/marvel-neon-random/OS.webp?v=1"],
        ["SCW", "Scarlet Witch", "#C2185B", "#7B1FA2", "assets/logos/marvel-neon/SCW.webp?v=1"],
        ["SPM", "Spider man", "#D0021B", "#1F4FBF", "assets/logos/marvel-neon/SPM.webp?v=1"],
        ["OTU", "T/U-Others", "#4A00FF", "#CE00FF", "assets/logos/marvel-neon-random/OTU.webp?v=1"],
        ["THN", "Thanos", "#5B2A86", "#D4AF37", "assets/logos/marvel-neon-random/THN.webp?v=1"],
        ["THR", "Thor", "#1F4FBF", "#C8102E", "assets/logos/marvel-neon/THR.webp?v=1"],
        ["OVW", "V/W-Others", "#4A00FF", "#CE00FF", "assets/logos/marvel-neon-random/OVW.webp?v=1"],
        ["VEN", "Venom", "#111111", "#F4F4F4", "assets/logos/marvel-neon/VEN.webp?v=1"],
        ["WOL", "Wolverine", "#FFCC00", "#1F4FBF", "assets/logos/marvel-neon/WOL.webp?v=1"],
        ["OXY", "X/Y-Others", "#4A00FF", "#CE00FF", "assets/logos/marvel-neon-random/OXY.webp?v=1"],
      ],
    },

    /* Break "Neon Hobby + Kakawow Cosmos" (37 spots) : meme liste que
       marvel-neon-random plus Cyclops et Magneto. Memes images. */
    "marvel-neon-cosmos": {
      nom: "Neon Hobby + Kakawow Cosmos",
      breaks: ["kakawow cosmos"],   // mots du titre Whatnot, utilises quand le break n'expose aucun spot
      parLigne: 13,   // 37 spots : 13+13+11
      portraits: true,
      equipes: [
        ["OA", "A-Others", "#4A00FF", "#CE00FF", "assets/logos/marvel-neon-random/OA.webp?v=1"],
        ["OB", "B-Others", "#4A00FF", "#CE00FF", "assets/logos/marvel-neon-random/OB.webp?v=1"],
        ["BP", "Black Panther", "#2B1A4F", "#9B6BFF", "assets/logos/marvel-neon-random/BP.webp?v=1"],
        ["OC", "C-Others", "#4A00FF", "#CE00FF", "assets/logos/marvel-neon-random/OC.webp?v=1"],
        ["CAP", "Captain America", "#1F3C8F", "#C8102E", "assets/logos/marvel-neon/CAP.webp?v=1"],
        ["CRN", "Carnage", "#8A0F1F", "#111111", "assets/logos/marvel-neon-random/CRN.webp?v=1"],
        ["OD", "D-Others", "#4A00FF", "#CE00FF", "assets/logos/marvel-neon-random/OD.webp?v=1"],
        ["DD", "Daredevil", "#B3121B", "#1A1A1A", "assets/logos/marvel-neon-random/DD.webp?v=1"],
        ["DOOM", "Doctor Doom", "#1E6B3A", "#2B2B2B", "assets/logos/marvel-neon-random/DOOM.webp?v=1"],
        ["DRS", "Doctor Strange", "#2B1A6B", "#D64B1F", "assets/logos/marvel-neon/DRS.webp?v=1"],
        ["CYC", "Cyclops", "#1F4FBF", "#FFD23D", "assets/logos/marvel-neon/CYC.webp?v=1"],
        ["MAG", "Magneto", "#8A1F2B", "#5B2A86", "assets/logos/marvel-neon-random/MAG.webp?v=1"],
        ["OEF", "E/F-Others", "#4A00FF", "#CE00FF", "assets/logos/marvel-neon-random/OEF.webp?v=1"],
        ["OG", "G-Others", "#4A00FF", "#CE00FF", "assets/logos/marvel-neon-random/OG.webp?v=1"],
        ["GAL", "Galactus", "#5B2A86", "#D4AF37", "assets/logos/marvel-neon-random/GAL.webp?v=1"],
        ["GHS", "Ghost Spider", "#F4F4F4", "#E0349B", "assets/logos/marvel-neon-random/GHS.webp?v=1"],
        ["OH", "H-Others", "#4A00FF", "#CE00FF", "assets/logos/marvel-neon-random/OH.webp?v=1"],
        ["HLK", "Hulk", "#3F8F2A", "#5B2A86", "assets/logos/marvel-neon/HLK.webp?v=1"],
        ["OI", "I-Others", "#4A00FF", "#CE00FF", "assets/logos/marvel-neon-random/OI.webp?v=1"],
        ["IRM", "Iron Man", "#B3121B", "#F2C14E", "assets/logos/marvel-neon/IRM.webp?v=1"],
        ["OJ", "J-Others", "#4A00FF", "#CE00FF", "assets/logos/marvel-neon-random/OJ.webp?v=1"],
        ["OKL", "K/L-Others", "#4A00FF", "#CE00FF", "assets/logos/marvel-neon-random/OKL.webp?v=1"],
        ["LOK", "Loki/Alligator Loki", "#1E6B3A", "#D4AF37", "assets/logos/marvel-neon/LOK.webp?v=1"],
        ["OM", "M-Others", "#4A00FF", "#CE00FF", "assets/logos/marvel-neon-random/OM.webp?v=1"],
        ["ONO", "N/O-Others", "#4A00FF", "#CE00FF", "assets/logos/marvel-neon-random/ONO.webp?v=1"],
        ["OPQ", "P/Q-Others", "#4A00FF", "#CE00FF", "assets/logos/marvel-neon-random/OPQ.webp?v=1"],
        ["OR", "R-Others", "#4A00FF", "#CE00FF", "assets/logos/marvel-neon-random/OR.webp?v=1"],
        ["OS", "S-Others", "#4A00FF", "#CE00FF", "assets/logos/marvel-neon-random/OS.webp?v=1"],
        ["SCW", "Scarlet Witch", "#C2185B", "#7B1FA2", "assets/logos/marvel-neon/SCW.webp?v=1"],
        ["SPM", "Spider man", "#D0021B", "#1F4FBF", "assets/logos/marvel-neon/SPM.webp?v=1"],
        ["OTU", "T/U-Others", "#4A00FF", "#CE00FF", "assets/logos/marvel-neon-random/OTU.webp?v=1"],
        ["THN", "Thanos", "#5B2A86", "#D4AF37", "assets/logos/marvel-neon-random/THN.webp?v=1"],
        ["THR", "Thor", "#1F4FBF", "#C8102E", "assets/logos/marvel-neon/THR.webp?v=1"],
        ["OVW", "V/W-Others", "#4A00FF", "#CE00FF", "assets/logos/marvel-neon-random/OVW.webp?v=1"],
        ["VEN", "Venom", "#111111", "#F4F4F4", "assets/logos/marvel-neon/VEN.webp?v=1"],
        ["WOL", "Wolverine", "#FFCC00", "#1F4FBF", "assets/logos/marvel-neon/WOL.webp?v=1"],
        ["OXY", "X/Y-Others", "#4A00FF", "#CE00FF", "assets/logos/marvel-neon-random/OXY.webp?v=1"],
      ],
    },

    nfl: {
      nom: "NFL",
      equipes: [
        ["ARI", "Arizona Cardinals",   "#97233F", "#1A1A1A"],
        ["ATL", "Atlanta Falcons",     "#A71930", "#1A1A1A"],
        ["BAL", "Baltimore Ravens",    "#241773", "#1A1A1A"],
        ["BUF", "Buffalo Bills",      "#00338D", "#C60C30"],
        ["CAR", "Carolina Panthers",   "#0085CA", "#101820"],
        ["CHI", "Chicago Bears",       "#0B162A", "#C83803"],
        ["CIN", "Cincinnati Bengals",  "#FB4F14", "#1A1A1A"],
        ["CLE", "Cleveland Browns",    "#311D00", "#FF3C00"],
        ["DAL", "Dallas Cowboys",      "#003594", "#869397"],
        ["DEN", "Denver Broncos",      "#FB4F14", "#002244"],
        ["DET", "Detroit Lions",       "#0076B6", "#B0B7BC"],
        ["GB",  "Green Bay Packers",   "#203731", "#FFB612"],
        ["HOU", "Houston Texans",      "#03202F", "#A71930"],
        ["IND", "Indianapolis Colts",  "#002C5F", "#A2AAAD"],
        ["JAX", "Jacksonville Jaguars","#101820", "#D7A22A"],
        ["KC",  "Kansas City Chiefs",  "#E31837", "#FFB81C"],
        ["LAC", "Los Angeles Chargers","#0080C6", "#FFC20E"],
        ["LAR", "Los Angeles Rams",    "#003594", "#FFA300"],
        ["LV",  "Las Vegas Raiders",   "#1A1A1A", "#A5ACAF"],
        ["MIA", "Miami Dolphins",      "#008E97", "#FC4C02"],
        ["MIN", "Minnesota Vikings",   "#4F2683", "#FFC62F"],
        ["NE",  "New England Patriots","#002244", "#C60C30"],
        ["NO",  "New Orleans Saints",  "#D3BC8D", "#101820"],
        ["NYG", "New York Giants",     "#0B2265", "#A71930"],
        ["NYJ", "New York Jets",       "#125740", "#1A1A1A"],
        ["PHI", "Philadelphia Eagles", "#004C54", "#A5ACAF"],
        ["PIT", "Pittsburgh Steelers", "#FFB612", "#101820"],
        ["SEA", "Seattle Seahawks",    "#002244", "#69BE28"],
        ["SF",  "San Francisco 49ers", "#AA0000", "#B3995D"],
        ["TB",  "Tampa Bay Buccaneers","#D50A0A", "#FF7900"],
        ["TEN", "Tennessee Titans",    "#0C2340", "#4B92DB"],
        ["WAS", "Washington Commanders","#5A1414", "#FFB612"],
      ],
    },
  };

  /* Sports crees depuis l'editeur (sports.html). Ils rejoignent la
     meme table que les ligues livrees : ni la regie, ni cette grille n'ont a
     savoir qu'un sport est "maison" ou personnalise. */
  for (const [id, sport] of Object.entries((window.SHAKS_CONFIG && window.SHAKS_CONFIG.sportsCustom) || {})) {
    if (sport && Array.isArray(sport.equipes)) {
      LIGUES[String(id).toLowerCase()] = { nom: sport.nom || id, equipes: sport.equipes, custom: true };
    }
  }

  /* Break PYP (pick your player) : ses joueurs, importes depuis le CSV des
     spots Whatnot (section pyp), deviennent les spots d'une roue "pyp". La
     regie et la synchro Whatnot la traitent comme les autres ; seul l'overlay
     differe : la fiche du joueur (pyp.js) remplace la grille. Couleurs : celles
     de l'equipe dans la roue NBA. */
  function majLiguePyp() {
    const pyp = window.SHAKS_CONFIG && window.SHAKS_CONFIG.pyp;
    const liste = pyp && Array.isArray(pyp.liste) ? pyp.liste : [];
    if (!liste.length) { delete LIGUES.pyp; return; }
    const couleurs = new Map(LIGUES.nba.equipes.map(([s, , c1, c2]) => [s, [c1, c2]]));
    LIGUES.pyp = {
      nom: `PYP · ${pyp.nom || "Pick your player"}`,
      pyp: true,
      equipes: liste.map((j) => [j.s, j.t, ...(couleurs.get(j.a) || ["#4A00FF", "#CE00FF"])]),
    };
  }
  majLiguePyp();
  window.SHAKS_MAJ_PYP = majLiguePyp;

  // Expose pour la page de reglages et la regie, qui affichent la meme table.
  window.SHAKS_LIGUES = LIGUES;

  /* Adresse du logo d'une equipe, la meme pour la grille, la regie et
     l'editeur de roue. Un logo propre a l'equipe (sport personnalise, spot
     special) passe d'abord ; sinon le modele d'adresse, avec le dossier de
     logos de la ligue — qui peut etre celui d'une autre ligue (dossierLogos). */
  function logoEquipe(modele, ligueId, sigle, logoDirect) {
    if (logoDirect) return logoDirect;
    const m = String(modele || "").trim();
    if (!m) return "";
    const id = String(ligueId || "nba").toLowerCase();
    const dossier = (LIGUES[id] && LIGUES[id].dossierLogos) || id;
    return m
      .replace(/\{ligue\}/g, dossier)
      .replace(/\{ABBR\}/g, sigle)
      .replace(/\{abbr\}/g, String(sigle).toLowerCase());
  }
  window.SHAKS_LOGO = logoEquipe;

  const hote = document.getElementById("randoms");
  if (!hote) return;

  function canaux(hex) {
    const n = parseInt(String(hex).replace("#", ""), 16);
    if (Number.isNaN(n)) return [128, 128, 128];
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  /* Texte clair ou sombre selon la couleur de fond. Sans ce calcul, les
     equipes en creme ou en gris clair rendaient leur sigle illisible. */
  function encre(hex) {
    const [r, v, b] = canaux(hex);
    return (0.2126 * r + 0.7152 * v + 0.0722 * b) / 255 > 0.62 ? "#0b0e18" : "#ffffff";
  }

  /* rgba() calcule ici plutot qu'en CSS : color-mix() n'est pas garanti dans
     le navigateur embarque d'OBS, qui suit Chromium avec du retard. */
  const teinte = (hex, alpha) => `rgba(${canaux(hex).join(",")},${alpha})`;

  /* --- ancrage sous le bandeau ------------------------------------------
     Le bloc du bandeau va de 27 a 43,9 % du canvas, mais sa BARRE VISIBLE
     s'arrete a 38,8 % : le bas de l'image est transparent. Se caler sur le
     bloc laissait donc un trou de plus de 100 px, et la grille flottait.

     On mesure donc la barre elle-meme, et l'ecart se compte a partir de la.
     Avantage : deplacer ou redimensionner le bandeau emmene la grille avec
     lui, sans avoir a retoucher un pourcentage a la main.
     -------------------------------------------------------------------- */
  function placer(ecart) {
    const repere = document.getElementById("bar") || document.getElementById("banner-host");
    if (!repere) { hote.style.top = `${45 + ecart}%`; return; }
    const bas = repere.getBoundingClientRect().bottom;
    if (!bas) return;                    // pas encore mis en page
    hote.style.top = `${(bas / window.innerHeight) * 100 + ecart}%`;
  }

  let focusTimer = 0;

  const logoDe = (cfg, sigle, logoDirect) => logoEquipe(cfg.logoUrl, cfg.ligue, sigle, logoDirect);

  /* --- punchlines -------------------------------------------------------
     Une phrase sous le logo a chaque spot attribue, prise dans la section
     punchlines de la config (reglages.html). Tiree de l'identifiant de la
     selection plutot qu'au hasard : l'apercu et le cadre OBS affichent ainsi
     la meme phrase pour la meme vente. Rien si la liste est vide ou eteinte.
     -------------------------------------------------------------------- */
  function punchline(id) {
    const p = (window.SHAKS_CONFIG && window.SHAKS_CONFIG.punchlines) || {};
    if (p.actif === false) return "";
    const liste = (Array.isArray(p.phrases) ? p.phrases : [])
      .map((x) => String(x).trim())
      .filter(Boolean);
    if (!liste.length) return "";
    let h = 0;
    for (const ch of String(id)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    return liste[h % liste.length];
  }

  /* Nuages de poussiere a l'impact, partis du bas du logo vers l'exterieur.
     [depart, trajet x, trajet y, echelle finale, taille, retard] : le depart
     en fraction de la demi-largeur du logo (-1 = coin gauche), le trajet en
     tailles de nuage, la taille en fraction de la largeur du logo. Cote
     gauche ; le droit est son miroir. */
  const NUAGES_GAUCHE = [
    [-0.95, -1.6, -0.5, 1.8, 0.16, 0.59],
    [-0.7, -1.2, -1.0, 1.6, 0.14, 0.6],
    [-0.35, -0.8, -0.8, 1.5, 0.12, 0.6],
    [-1.0, -2.6, -0.2, 1.4, 0.1, 0.62],
    [-0.85, -0.9, -1.6, 1.3, 0.09, 0.64],
  ];
  const NUAGES = NUAGES_GAUCHE.flatMap((n) => [n, [-n[0], -n[1], ...n.slice(2)]]);

  /* Une selection voyage dans la section randoms via le SSE deja en place.
     Trop ancienne, ou deja vue par cette source OBS, elle ne se rejoue pas.
     Renvoie true seulement quand l'animation part vraiment : la case de la
     grille ne doit sauter qu'a ce moment-la, pas a chaque re-rendu. */
  let demarre = false;
  function jouerSelection(cfg, ligue) {
    const selection = cfg.selection;
    if (!selection || !selection.id || !selection.sigle) return false;
    /* Au chargement, une selection ancienne ne se rejoue pas (fenetre de 2 min).
       Apres le demarrage, toute nouvelle selection joue : l'horloge du PC OBS
       peut deriver par rapport a celle du serveur et fausser la fenetre. */
    if (!demarre && Date.now() - Number(selection.at || 0) > 120000) {
      jouerSelection.derniere = selection.id;
      return false;
    }

    const cle = "shaks:selection-vue";
    try {
      if (sessionStorage.getItem(cle) === selection.id) return false;
      sessionStorage.setItem(cle, selection.id);
    } catch { /* OBS sans stockage : l'identifiant en memoire suffit */ }
    if (jouerSelection.derniere === selection.id) return false;
    jouerSelection.derniere = selection.id;

    const sigle = String(selection.sigle).toUpperCase();
    const equipe = ligue.equipes.find(([s]) => String(s).toUpperCase() === sigle);
    if (!equipe) return false;
    const [, nom, , , logoDirect] = equipe;

    clearTimeout(focusTimer);
    document.querySelectorAll(".spot-focus, .spot-anim").forEach((el) => el.remove());

    const ctx = {
      sigle,
      nom,
      src: logoDe(cfg, sigle, logoDirect),
      phrase: punchline(selection.id),
      // Le logo de l'equipe, ou son sigle si l'image ne charge pas.
      logo(classe) {
        const visuel = document.createElement("div");
        visuel.className = classe;
        const secours = document.createElement("span");
        secours.className = `${classe}-sigle`;
        secours.textContent = sigle;
        visuel.append(secours);
        if (this.src) {
          const img = document.createElement("img");
          img.alt = "";
          img.addEventListener("load", () => secours.remove());
          img.addEventListener("error", () => img.remove());
          img.src = this.src;
          visuel.append(img);
        }
        return visuel;
      },
    };
    const choix = choisirAnimation(selection.id);
    const anim = animations()[choix](ctx);
    document.body.append(anim.el);
    focusTimer = setTimeout(() => anim.el.remove(), anim.duree);
    return anim;
  }

  /* --- les animations du spot attribue --------------------------------------
     Plusieurs mises en scene, qui tournent : chaque vente en tire une, jamais
     la meme deux fois de suite. Chacune rend { el, duree, impact, secousse } :
     impact = le moment (ms) ou le logo apparait, sur lequel la case de la
     grille saute ; secousse = la grille tremble avec.
     Les autres que le catcheur vivent dans spot-anims.js.
     La section animations de la config (reglages.html) retire une animation
     de la rotation (false) ; window.SHAKS_ANIM_FORCEE en impose une (demo). */
  function animations() {
    return { catcheur: animCatcheur, ...(window.SHAKS_ANIMS_SPOT || {}) };
  }

  function choisirAnimation(id) {
    const toutes = animations();
    if (window.SHAKS_ANIM_FORCEE && toutes[window.SHAKS_ANIM_FORCEE]) return window.SHAKS_ANIM_FORCEE;
    const reglage = (window.SHAKS_CONFIG && window.SHAKS_CONFIG.animations) || {};
    let dispo = Object.keys(toutes).filter((nomAnim) => reglage[nomAnim] !== false);
    if (!dispo.length) dispo = ["catcheur"];
    let h = 7;
    for (const ch of String(id)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    let i = h % dispo.length;
    if (dispo.length > 1 && dispo[i] === choisirAnimation.derniere) i = (i + 1) % dispo.length;
    choisirAnimation.derniere = dispo[i];
    return dispo[i];
  }

  /* L'entree du catcheur : le logo tombe, s'ecrase, le tampon VENDU s'abat. */
  function animCatcheur(ctx) {
    const scene = document.createElement("div");
    scene.className = "spot-focus";

    const carte = document.createElement("div");
    carte.className = "spot-focus__carte";
    const visuel = document.createElement("div");
    visuel.className = "spot-focus__visuel";
    const secours = document.createElement("span");
    secours.className = "spot-focus__sigle";
    secours.textContent = ctx.sigle;
    visuel.append(secours);

    if (ctx.src) {
      const img = document.createElement("img");
      img.className = "spot-focus__image";
      img.alt = "";
      img.addEventListener("load", () => secours.remove());
      img.addEventListener("error", () => img.remove());
      img.src = ctx.src;
      visuel.append(img);
    }

    const tampon = document.createElement("div");
    tampon.className = "spot-focus__tampon";
    tampon.textContent = "VENDU !";

    const chute = document.createElement("div");
    chute.className = "spot-focus__chute";
    chute.append(visuel, tampon);

    const sol = document.createElement("div");
    sol.className = "spot-focus__sol";
    const onde = document.createElement("span");
    onde.className = "spot-focus__onde";
    sol.append(onde);
    for (const [x0, dx, dy, s, taille, retard] of NUAGES) {
      const nuage = document.createElement("span");
      nuage.className = "spot-focus__nuage";
      nuage.style.setProperty("--x0", String(x0));
      nuage.style.setProperty("--dx", String(dx));
      nuage.style.setProperty("--dy", String(dy));
      nuage.style.setProperty("--s", String(s));
      nuage.style.setProperty("--taille", String(taille));
      nuage.style.setProperty("--retard", `${retard}s`);
      sol.append(nuage);
    }

    const ring = document.createElement("div");
    ring.className = "spot-focus__ring";
    ring.append(sol, chute);

    const titre = document.createElement("div");
    titre.className = "spot-focus__nom";
    titre.textContent = ctx.nom;
    carte.append(ring, titre);
    if (ctx.phrase) {
      const punch = document.createElement("div");
      punch.className = "spot-focus__punch";
      punch.textContent = ctx.phrase;
      carte.append(punch);
    }
    scene.append(carte);
    return { el: scene, duree: 4300, impact: 590, secousse: true };
  }

  function rendre() {
    const cfg = (window.SHAKS_CONFIG && window.SHAKS_CONFIG.randoms) || {};

    if (cfg.actif === false) {
      hote.hidden = true;
      hote.textContent = "";
      fanion = null;
      return;
    }

    const ligue = LIGUES[String(cfg.ligue || "nba").toLowerCase()];
    if (!ligue) {
      console.warn("[shaks] ligue inconnue :", cfg.ligue);
      hote.hidden = true;
      return;
    }

    /* PYP : pas de grille ni d'animation de spot, la fiche du joueur
       (pyp.js) prend la place. On garde seulement le calage sous le bandeau. */
    if (ligue.pyp) {
      saut = null;
      const panneau = hote.querySelector(".randoms__panel");
      if (panneau) panneau.remove();
      majFanion(null);
      dimensionner(cfg);
      hote.hidden = false;
      placer(ecartCourant);
      window.dispatchEvent(new CustomEvent("shaks:pyp"));
      return;
    }

    const pris = new Set((Array.isArray(cfg.pris) ? cfg.pris : [])
      .map((s) => String(s).toUpperCase()));

    /* Si la grille se redessine pendant l'animation (une autre mise a jour
       de la synchro, par exemple), la case reprend la ou elle en etait grace
       a un retard negatif, au lieu de repartir de zero ou de s'arreter net. */
    /* La case saute au moment ou l'animation montre le logo : son horloge
       (calee sur l'impact du catcheur, a 590 ms) est decalee d'autant. */
    const joue = jouerSelection(cfg, ligue);
    if (joue) {
      saut = {
        sigle: String(cfg.selection.sigle).toUpperCase(),
        debut: Date.now(),
        decal: Math.max(0, joue.impact - 590),
        secousse: joue.secousse,
      };
    }
    const ecoule = saut ? Date.now() - saut.debut : Infinity;
    const enCours = ecoule < DUREE_SAUT + (saut ? saut.decal : 0);
    const selectionSigle = enCours ? saut.sigle : "";
    const t0 = enCours ? `${-ecoule}ms` : "0ms";
    const decal = enCours ? `${saut.decal}ms` : "0ms";

    /* Equipes par ligne, pas nombre de lignes. Avec un compte fixe par ligne,
       une equipe de plus (32 au lieu de 30) ne redistribue pas tout : elle se
       contente d'ajouter une ligne de reste, plus courte et centree. C'est ce
       qui permet a la NFL (32) de reprendre la meme largeur de case que la
       NBA (30) sans reglage a part. */
    const parLigne = Math.max(4, Math.min(15, Number(ligue.parLigne) || Number(cfg.parLigne) || 10));
    const total = ligue.equipes.length;
    const reste = total % parLigne;
    const completes = total - reste;   // nombre d'equipes dans les lignes pleines

    hote.hidden = total === 0;
    dimensionner(cfg);
    // Plus etroites, les cases gagnent en hauteur pour garder des logos lisibles.
    hote.style.setProperty("--rnd-hauteur", String(Math.max(0.7, Math.min(1.5, Number(cfg.hauteurCases ?? 1.1)))));
    hote.style.setProperty("--rnd-cols", String(parLigne));
    // Portraits (Marvel…) : l'image remplit la case au lieu d'y flotter.
    hote.classList.toggle("randoms--portraits", Boolean(ligue.portraits));
    // Voile derriere les logos : nul par defaut, c'est la camera qu'on veut voir.
    hote.style.setProperty("--rnd-voile", String(Number(cfg.voile ?? 0)));
    // Les attaches traversent l'ecart jusqu'a la barre, quel qu'il soit.
    hote.style.setProperty("--rnd-attache", `${Math.max(0, ecartCourant)}vh`);

    function tuile(sigle, nom, c1, c2, logoDirect) {
      const cell = document.createElement("div");
      const vendu = pris.has(String(sigle).toUpperCase());
      const selectionnee = String(sigle).toUpperCase() === selectionSigle;
      cell.className = "rnd"
        + (vendu ? " is-pris" : "")
        + (selectionnee ? " is-selectionnee" : "");
      if (selectionnee) {
        cell.style.setProperty("--t0", t0);
        cell.style.setProperty("--decal", decal);
      }
      cell.style.setProperty("--c1", c1);
      cell.style.setProperty("--c2", c2);
      cell.style.setProperty("--encre", encre(c1));
      // Le logo porte deja la couleur de l'equipe : elle ne sert plus qu'a
      // teinter le contour et la lueur, sinon les deux se battent.
      cell.style.setProperty("--bord", teinte(c1, 0.62));
      cell.style.setProperty("--lueur", teinte(c1, 0.3));
      cell.title = nom;

      const sig = document.createElement("span");
      sig.className = "rnd__sigle";
      sig.textContent = sigle;
      cell.append(sig);

      /* Logo. Un sport personnalise porte le sien directement (uploade par
         l'editeur, sans dossier assets/ ou reside) — il est prioritaire. Sinon
         le modele d'adresse s'applique, pour les ligues livrees. Si l'image ne
         charge pas, le sigle reste en place ; on ne bascule qu'a la reussite,
         pour ne jamais laisser une case vide. */
      const src = logoDe(cfg, sigle, logoDirect);
      if (src) {
        const img = document.createElement("img");
        img.className = "rnd__logo";
        img.alt = "";
        img.addEventListener("load", () => cell.classList.add("has-logo"));
        img.addEventListener("error", () => img.remove());
        img.src = src;
        cell.append(img);
      }

      /* Vendu : un bandeau en travers plutot qu'une case eteinte. Eteintes,
         les cases vendues faisaient des trous noirs dans la grille et l'oeil
         ne savait plus lire ce qui restait. */
      if (vendu) {
        const bande = document.createElement("span");
        bande.className = "rnd__vendu";
        const texte = document.createElement("b");
        texte.textContent = "VENDU";
        bande.append(texte);
        cell.append(bande);
      }
      return cell;
    }

    const panneau = document.createElement("div");
    const secoue = enCours && saut.secousse;
    panneau.className = "randoms__panel" + (secoue ? " is-secousse" : "");
    if (secoue) panneau.style.setProperty("--t0", t0);

    const grille = document.createElement("div");
    grille.className = "randoms__grid";
    for (const [sigle, nom, c1, c2, logo] of ligue.equipes.slice(0, completes)) {
      grille.append(tuile(sigle, nom, c1, c2, logo));
    }
    panneau.append(grille);

    // La ligne de reste : meme largeur de case, mais centree plutot que
    // plaquee a gauche — sinon deux equipes isolees dans le coin font
    // penser a une erreur de mise en page plutot qu'a un choix.
    if (reste > 0) {
      const ligneReste = document.createElement("div");
      ligneReste.className = "randoms__reste";
      for (const [sigle, nom, c1, c2, logo] of ligue.equipes.slice(completes)) {
        ligneReste.append(tuile(sigle, nom, c1, c2, logo));
      }
      panneau.append(ligneReste);
    }


    /* Seul le panneau est remplace : le fanion du 2 POUR 1 reste en place
       d'un rendu a l'autre, sinon son animation repartirait a chaque vente. */
    const ancien = hote.querySelector(".randoms__panel");
    if (ancien) ancien.replaceWith(panneau); else hote.prepend(panneau);

    // Le panneau flottant n'apparait que pendant le 2 POUR 1.
    const restants = Math.max(0, total - pris.size);
    const deux = cfg.deuxPourUn || {};
    const seuil = Number(deux.seuil ?? 10);
    majFanion(deux.actif && restants >= seuil ? seuil : null);
    // Apres l'insertion : placer() mesure la barre, qui doit etre en page.
    placer(ecartCourant);
  }

  /* Calage dans ce que le telephone montre VRAIMENT. Le canvas 9:16 est
     rogne sur les cotes par un ecran plus allonge (layout.safeSidePct), et
     Whatnot pose sa colonne d'icones a droite (Plus, Mises en avant, Clip…).
     Sur 78 % du canvas, la grille finissait sous ces icones. Elle reste
     centree, mais se retrecit pour laisser la place des icones des DEUX
     cotes : decalee, elle jurait avec le bandeau au-dessus. La fiche PYP
     reprend exactement la meme largeur. */
  function dimensionner(cfg) {
    ecartCourant = Number(cfg.ecart ?? 1.4);
    const cote = Number((window.SHAKS_CONFIG && window.SHAKS_CONFIG.layout
      && window.SHAKS_CONFIG.layout.safeSidePct) ?? 10);
    const marge = cote + Math.max(1.5, Number(cfg.margeIcones ?? 11));
    const largeur = Math.max(30, Math.min(78, Number(cfg.width ?? 78), 100 - 2 * marge));
    hote.style.width = `${largeur}%`;
    hote.style.opacity = String(Number(cfg.opacite ?? 0.95));
    hote.classList.toggle("randoms--pyp", Boolean(LIGUES[String(cfg.ligue || "").toLowerCase()]?.pyp));
  }

  let ecartCourant = 1.4;
  const DUREE_SAUT = 4200;   // meme horloge que les keyframes de frame.css
  let saut = null;

  /* --- le fanion du 2 POUR 1 ---------------------------------------------
     Le visuel fourni par le breaker (assets/deux-pour-un.webp, detoure),
     accroche sous la grille. Il descend quand le 2 POUR 1 s'active, se
     balance et pulse tant qu'il dure, et remonte quand on le coupe ou que
     les spots restants passent sous le seuil.

     C'est la seule animation permanente de la grille, a dessein : elle ne
     couvre qu'une petite zone et s'arrete avec le 2 POUR 1. Le reste de la
     grille reste fixe pour ne pas peser sur l'encodage du flux.
     -------------------------------------------------------------------- */
  const IMAGE_FANION = "assets/deux-pour-un.webp?v=2";
  let fanion = null;
  let fanionActif = false;
  let fanionMinuteur = 0;

  function construireFanion() {
    const el = (tag, classe) => {
      const n = document.createElement(tag);
      n.className = classe;
      return n;
    };
    const racine = el("div", "fanion");
    racine.hidden = true;
    const corps = el("div", "fanion__corps");
    const flottant = el("div", "fanion__flottant");
    const visuel = el("div", "fanion__visuel");
    const img = el("img", "fanion__image");
    img.src = IMAGE_FANION;
    img.alt = "2 pour 1";
    // Le reflet est decoupe a la forme exacte du visuel.
    const reflet = el("span", "fanion__reflet");
    /* Adresse absolue : dans une variable CSS, une url() relative se resout
       depuis la feuille de style (_moteur/), pas depuis la page. */
    reflet.style.setProperty("--fanion-image", `url("${new URL(IMAGE_FANION, location.href).href}")`);
    visuel.append(img, reflet);
    flottant.append(visuel);
    corps.append(flottant);
    racine.append(corps);
    return racine;
  }

  function majFanion(seuil) {
    if (!fanion || !fanion.isConnected) {
      fanion = construireFanion();
      hote.append(fanion);
      fanionActif = false;
    }
    const actif = seuil !== null;
    if (actif === fanionActif) return;
    fanionActif = actif;
    clearTimeout(fanionMinuteur);
    fanion.classList.remove("is-entree", "is-sortie");
    void fanion.offsetWidth;   // relance l'animation meme si la classe revient
    if (actif) {
      fanion.hidden = false;
      fanion.classList.add("is-entree");
    } else {
      fanion.classList.add("is-sortie");
      fanionMinuteur = setTimeout(() => {
        fanion.hidden = true;
        fanion.classList.remove("is-sortie");
      }, 650);
    }
  }

  rendre();
  demarre = true;

  /* Le bandeau se remet en page apres le chargement des polices : sans ce
     suivi, la grille resterait calee sur une mesure prise trop tot. */
  const barre = document.getElementById("bar");
  if (barre && "ResizeObserver" in window) {
    new ResizeObserver(() => placer(ecartCourant)).observe(barre);
  }
  window.addEventListener("resize", () => placer(ecartCourant));

  /* Application a chaud : marquer une equipe vendue ne doit pas recharger la
     page. boot.js previent quand seules des sections applicables a chaud ont
     bouge — sans cela, chaque vente aurait fait sauter le ticker et relance
     l'orbite du logo en pleine vente. */
  window.addEventListener("shaks:config", (ev) => {
    const sections = (ev.detail && ev.detail.sections) || [];
    if (sections.includes("pyp")) majLiguePyp();
    if (sections.includes("randoms") || sections.includes("pyp")) rendre();
  });
})();
