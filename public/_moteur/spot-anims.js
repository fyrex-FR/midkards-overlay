/* ==========================================================================
   MIDKARDS — Animation du spot attribue : la carte

   Une carte blanche monte du bas, se pose, le tampon VENDU s'abat dessus.
   Une seule mise en scene, volontairement sobre : un seul element qui bouge,
   pas de filtre, pas de 3D (CEF d'OBS).

   Rend { el, duree, impact, secousse } comme randoms.js l'attend :
     duree    temps total (ms) avant que la scene soit retiree
     impact   moment (ms) ou la carte se pose : la case de la grille saute
     secousse la grille tremble avec (non)

   Charge AVANT randoms.js, qui lit window.SHAKS_ANIMS_SPOT.
   ========================================================================== */
(() => {
  "use strict";

  const el = (tag, classe, texte) => {
    const n = document.createElement(tag);
    if (classe) n.className = classe;
    if (texte !== undefined) n.textContent = texte;
    return n;
  };

  function carte(ctx) {
    const duree = 4300;
    const scene = el("div", "spot-anim spot-anim--carte");
    scene.style.setProperty("--d", `${duree}ms`);

    const c = el("div", "sc");
    const haut = el("div", "sc__haut");
    haut.append(el("span", "sc__titre", "SPOT ATTRIBUÉ"), el("small", "sc__sigle", ctx.sigle));

    const corps = el("div", "sc__corps");
    corps.append(ctx.logo("sc__logo"));
    const qui = el("div", "sc__qui");
    qui.append(el("div", "sc__equipe", ctx.nom));
    if (ctx.acheteur) {
      qui.append(el("div", "sc__pris", "pris par"), el("div", "sc__acheteur", ctx.acheteur));
    }
    corps.append(qui);

    c.append(haut, corps);
    if (ctx.phrase) c.append(el("div", "sc__punch", ctx.phrase));
    c.append(el("div", "sc__tampon", "VENDU"));
    scene.append(c);
    return { el: scene, duree, impact: 600, secousse: false };
  }

  window.SHAKS_ANIMS_SPOT = { carte };
})();
