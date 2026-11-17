/* ==========================================================================
   MIDKARDS — Animations du spot attribue

   Les mises en scene qui tournent avec l'entree du catcheur (randoms.js).
   Chacune construit sa scene et rend { el, duree, impact, secousse } :
     duree    le temps total (ms) avant que la scene ne soit retiree
     impact   le moment (ms) ou le logo de l'equipe apparait : la case de la
              grille saute a cet instant
     secousse la grille tremble avec

   Tout le mouvement est en CSS (spot-anims.css), sur une seule horloge par
   scene : --d. Les pourcentages des keyframes sont donc des instants de la
   scene, comme pour le catcheur.

   Charge AVANT randoms.js, qui lit window.SHAKS_ANIMS_SPOT au moment de
   jouer une animation.
   ========================================================================== */
(() => {
  "use strict";

  const el = (tag, classe, texte) => {
    const n = document.createElement(tag);
    if (classe) n.className = classe;
    if (texte !== undefined) n.textContent = texte;
    return n;
  };

  // Un fragment SVG, ecrit en clair : plus lisible que des createElementNS.
  const svg = (markup) => {
    const tmp = document.createElement("div");
    tmp.innerHTML = markup.trim();
    return tmp.firstElementChild;
  };

  function scene(nom, duree) {
    const racine = el("div", `spot-anim spot-anim--${nom}`);
    racine.style.setProperty("--d", `${duree}ms`);
    return racine;
  }

  // Le nom de l'equipe et la punchline, sous le logo.
  function textes(ctx) {
    const bloc = el("div", "sa-textes");
    bloc.append(el("div", "sa-textes__nom", ctx.nom));
    if (ctx.phrase) bloc.append(el("div", "sa-textes__punch", ctx.phrase));
    return bloc;
  }

  /* --- 1. Le shooteur ------------------------------------------------------
     Un bonhomme baton arrive en dribblant, saute, shoote : le ballon fait
     la cloche jusqu'au panier, SWISH, onde de choc, et le logo jaillit du
     filet. Le bonhomme fete ca. Volontairement epure : peu d'elements, peu
     de lueurs en filtre, pour rester fluide dans OBS. */
  function shooteur(ctx) {
    const duree = 5600;
    const racine = scene("shooteur", duree);

    // Le bonhomme (classe et retard servent a d'eventuels echos).
    const bonhomme = (classe, retard) => `
      <g class="sa-bonhomme-x ${classe}" style="--retard:${retard}s"><g class="sa-bonhomme-y"><g transform="translate(0 1340)">
        <g transform="translate(0 -95)">
          <line class="sa-halo sa-jambe-a" x1="0" y1="0" x2="0" y2="95"/>
          <line class="sa-halo sa-jambe-b" x1="0" y1="0" x2="0" y2="95"/>
          <line class="sa-membre sa-jambe-a" x1="0" y1="0" x2="0" y2="95"/>
          <line class="sa-membre sa-jambe-b" x1="0" y1="0" x2="0" y2="95"/>
        </g>
        <line class="sa-halo" x1="0" y1="-95" x2="6" y2="-186"/>
        <line class="sa-membre" x1="0" y1="-95" x2="6" y2="-186"/>
        <g transform="translate(5 -172)">
          <line class="sa-halo sa-bras-b" x1="0" y1="0" x2="0" y2="80"/>
          <line class="sa-halo sa-bras-a" x1="0" y1="0" x2="0" y2="80"/>
          <line class="sa-membre sa-bras-b" x1="0" y1="0" x2="0" y2="80"/>
          <line class="sa-membre sa-bras-a" x1="0" y1="0" x2="0" y2="80"/>
        </g>
        <circle class="sa-halo" cx="10" cy="-216" r="27"/>
        <circle class="sa-tete" cx="10" cy="-216" r="27"/>
        <path class="sa-bandeau" d="M-15-226Q10-236 35-226"/>
      </g></g></g>`;
    // Le ballon, et un reflet en retard qui dessine sa trainee.
    const ballon = (classe, retard) => `
      <g class="sa-ballon-x ${classe}" style="--retard:${retard}s"><g class="sa-ballon-y"><g class="sa-ballon-r">
        <circle class="sa-ballon" r="24"/>
        <path class="sa-ballon-coutures" d="M-24 0H24M0-24V24M-16-17Q-2 0-16 17M16-17Q2 0 16 17"/>
      </g></g></g>`;

    // Le filet : maillage en X entre le cercle et le bas.
    const haut = [-52, -26, 0, 26, 52];
    const bas = [-34, -17, 0, 17, 34];
    let maille = "M-52 0 L-34 80 M52 0 L34 80 M-34 80 L34 80 M-43 40 L43 40";
    for (let i = 0; i < 4; i += 1) maille += ` M${haut[i]} 0 L${bas[i + 1]} 80 M${haut[i + 1]} 0 L${bas[i]} 80`;

    racine.append(svg(`
      <svg class="sa-svg" viewBox="0 0 1080 1920" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
        <defs>
          <linearGradient id="sa-parquet" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="#e01631" stop-opacity="0.3"/>
            <stop offset="1" stop-color="#eb0e37" stop-opacity="0"/>
          </linearGradient>
          <radialGradient id="sa-cuir" cx="0.35" cy="0.3" r="0.75">
            <stop offset="0" stop-color="#ffc27a"/>
            <stop offset="0.45" stop-color="#ff7a12"/>
            <stop offset="1" stop-color="#8a3100"/>
          </radialGradient>
        </defs>
        <g class="sa-terrain">
          <path class="sa-parquet" d="M0 1340H1080V1460H0Z"/>
          <line class="sa-sol-halo" x1="60" y1="1340" x2="1020" y2="1340"/>
          <line class="sa-sol" x1="60" y1="1340" x2="1020" y2="1340"/>
        </g>
        <g class="sa-panier">
          <line class="sa-poteau" x1="800" y1="1035" x2="800" y2="1340"/>
          <rect class="sa-planche-halo" x="712" y="790" width="176" height="128" rx="10"/>
          <rect class="sa-planche" x="712" y="790" width="176" height="128" rx="10"/>
          <rect class="sa-cible" x="768" y="858" width="64" height="48" rx="4"/>
          <g transform="translate(800 952)"><path class="sa-filet" d="${maille}"/></g>
          <ellipse class="sa-cercle-halo" cx="800" cy="952" rx="56" ry="12"/>
          <ellipse class="sa-cercle" cx="800" cy="952" rx="56" ry="12"/>
        </g>
        <ellipse class="sa-ombre" cx="0" cy="1342" rx="52" ry="10"/>
        ${bonhomme("", 0)}
        ${ballon("sa-trace", 0.05)}
        ${ballon("", 0)}
        <circle class="sa-onde" cx="800" cy="958" r="60"/>
        <circle class="sa-eclair" cx="800" cy="960" r="46"/>
      </svg>`));

    racine.append(el("div", "sa-cri sa-cri--swish", "SWISH !"));

    const revel = el("div", "sa-revel");
    revel.append(ctx.logo("sa-revel__logo"));
    racine.append(revel, textes(ctx));
    return { el: racine, duree, impact: 2700, secousse: false };
  }

  /* --- 2. La pince -------------------------------------------------------------
     Une borne de fete foraine « MIDKARDS CLAW », en simple contour neon : la
     pince se promene sur son rail, hesite, descend sur les cartes mystere,
     attrape celle qui brille, manque de la lacher (OUPS !), la remonte, et
     la carte jaillit de la borne en se retournant sur le logo : ATTRAPE ! */
  function pince(ctx) {
    const duree = 6800;
    const racine = scene("pince", duree);

    // Le tas de cartes, derriere la carte gagnante : [x, y, rotation, teinte].
    const TAS = [[370, 1190, -16, 1], [455, 1215, -6, 0], [625, 1215, 7, 2], [710, 1190, 17, 1]];
    const DOS = ["url(#sa-dos-a)", "url(#sa-dos-b)", "url(#sa-dos-c)"];
    const tas = TAS.map(([x, y, r, t]) => `
      <g transform="translate(${x} ${y}) rotate(${r})">
        <rect class="sa-tas-carte" x="-70" y="-100" width="140" height="200" rx="12" fill="${DOS[t]}"/>
        <text class="sa-tas-q" x="0" y="26">?</text>
      </g>`).join("");

    // Arriere-plan : la borne, son enseigne, le tas.
    racine.append(svg(`
      <svg class="sa-svg sa-borne" viewBox="0 0 1080 1920" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
        <defs>
          <linearGradient id="sa-cadre-neon" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stop-color="#e01631"/><stop offset="0.5" stop-color="#eb0e37"/><stop offset="1" stop-color="#e01631"/>
          </linearGradient>
          <linearGradient id="sa-enseigne" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stop-color="#e01631"/><stop offset="1" stop-color="#e01631"/>
          </linearGradient>
          <linearGradient id="sa-metal-rail" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stop-color="#928487"/><stop offset="0.5" stop-color="#eef2ff"/><stop offset="1" stop-color="#928487"/>
          </linearGradient>
          <linearGradient id="sa-dos-a" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#e03950"/><stop offset="1" stop-color="#530e17"/></linearGradient>
          <linearGradient id="sa-dos-b" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#eb274b"/><stop offset="1" stop-color="#5e0d1c"/></linearGradient>
          <linearGradient id="sa-dos-c" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#e05366"/><stop offset="1" stop-color="#5a0f19"/></linearGradient>
        </defs>
        <rect class="sa-caisse-halo" x="150" y="380" width="780" height="1040" rx="40"/>
        <rect class="sa-caisse" x="150" y="380" width="780" height="1040" rx="40"/>
        <rect class="sa-vitre" x="190" y="420" width="700" height="880" rx="22"/>
        <rect class="sa-lit" x="190" y="1250" width="700" height="50"/>
        ${tas}
        <rect class="sa-fronton" x="200" y="245" width="680" height="135" rx="26"/>
        <text class="sa-fronton-texte" x="540" y="335">MIDKARDS CLAW</text>
        <line class="sa-rail" x1="205" y1="448" x2="875" y2="448"/>
        <g class="sa-chariot">
          <rect class="sa-chariot-bloc" x="-46" y="430" width="92" height="36" rx="10"/>
        </g>
      </svg>`));

    // La carte gagnante, entre la borne et la pince (elle se retourne en 3D).
    const proie = el("div", "sa-proie");
    const tourne = el("div", "sa-proie__tourne");
    const face = el("div", "sa-proie__face");
    face.append(ctx.logo("sa-carte__logo"));
    tourne.append(el("div", "sa-proie__dos", "?"), face);
    proie.append(tourne);
    racine.append(proie);

    // Premier plan : la pince, son cable coupe au rail.
    racine.append(svg(`
      <svg class="sa-svg sa-avant" viewBox="0 0 1080 1920" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
        <defs>
          <linearGradient id="sa-metal" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stop-color="#928487"/><stop offset="0.5" stop-color="#eef2ff"/><stop offset="1" stop-color="#928487"/>
          </linearGradient>
        </defs>
        <!-- Le cable est coupe au rail par la decoupe CSS du SVG (.sa-avant). -->
        <g class="sa-chariot"><g class="sa-descente"><g transform="translate(0 480)">
            <rect class="sa-cable" x="-6" y="-1200" width="12" height="1200"/>
            <g transform="translate(-26 26)"><path class="sa-griffe sa-griffe-g" d="M0 0Q-42 58-14 118L4 110"/></g>
            <g transform="translate(26 26)"><path class="sa-griffe sa-griffe-d" d="M0 0Q42 58 14 118L-4 110"/></g>
            <path class="sa-griffe" d="M0 28V100Q0 116 14 112"/>
            <rect class="sa-moyeu" x="-48" y="-14" width="96" height="46" rx="14"/>
            <rect class="sa-moyeu-neon" x="-40" y="22" width="80" height="6" rx="3"/>
            <circle class="sa-voyant" cx="0" cy="6" r="9"/>
          </g></g></g>
      </svg>`));

    racine.append(
      el("div", "sa-cri sa-cri--oups", "OUPS !"),
      el("div", "sa-cri sa-cri--attrape", "ATTRAPÉ !"),
      textes(ctx),
    );
    return { el: racine, duree, impact: 4250, secousse: false };
  }

  window.SHAKS_ANIMS_SPOT = { shooteur, pince };
})();
