/* ==========================================================================
   MIDKARDS — fiche joueur du PYP (pick your player)

   Quand la roue "pyp" est choisie, randoms.js ne dessine plus la grille et
   cette fiche prend sa place : photo, nom, equipe, ce qu'on peut toucher, et
   les boites du break.

   Ce qu'elle lit dans la config, sans rien ecrire :
     pyp.liste, pyp.boites            le break, importe depuis la regie
     randoms.pyp.courant               le joueur en enchere (sigle P001…)
     randoms.pris, randoms.acheteurs   les ventes, posees par la synchro Whatnot

   Vendu : le tampon VENDU au pseudo de l'acheteur, puis la fiche s'en va.
   La regie passe au joueur suivant.
   ========================================================================== */
(() => {
  "use strict";

  const hote = document.getElementById("randoms");
  if (!hote) return;

  const PHOTO = (id) => `https://cdn.nba.com/headshots/nba/latest/1040x760/${id}.png`;
  const VIGNETTE = (id) => `https://cdn.nba.com/headshots/nba/latest/260x190/${id}.png`;
  const LOGO = (abbr) => `assets/logos/nba/${abbr}.png`;
  const DUREE_VENDU = 6500;   // le tampon reste lisible, puis la fiche s'en va
  const CASES = [["auto", "Auto"], ["relic", "Relic"], ["case", "Case hit"], ["insert", "Insert"], ["base", "Base"]];

  let fiche = null;
  let ficheJoueur = "";
  let minuteur = 0;
  let bandeau = null;
  let bandeauSignature = "";
  let venduA = 0;      // quand le tampon VENDU de la fiche affichee est tombe
  let attente = 0;

  const el = (tag, classe, texte) => {
    const n = document.createElement(tag);
    if (classe) n.className = classe;
    if (texte != null) n.textContent = texte;
    return n;
  };

  // color-mix n'est pas sur dans le Chromium d'OBS : la teinte se calcule ici.
  function teinte(hex, alpha) {
    const n = parseInt(String(hex).replace("#", ""), 16);
    if (Number.isNaN(n)) return `rgba(206,103,118,${alpha})`;
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
  }

  /* Le joueur que « Joueur suivant » appellera dans la regie : le prochain
     pas encore vendu dans l'ordre de la liste, en repartant du debut. */
  function prochainLibre(liste, i, pris) {
    return liste.slice(i + 1).find((j) => !pris.has(j.s))
      || liste.slice(0, Math.max(0, i)).find((j) => !pris.has(j.s)) || null;
  }

  function courant() {
    const c = window.SHAKS_CONFIG || {};
    const rnd = c.randoms || {};
    if (rnd.actif === false || String(rnd.ligue || "").toLowerCase() !== "pyp") return null;
    const liste = (c.pyp && Array.isArray(c.pyp.liste)) ? c.pyp.liste : [];
    const sigle = rnd.pyp && rnd.pyp.courant;
    const joueur = sigle && liste.find((j) => j.s === sigle);
    if (!joueur) return null;
    const ligue = (window.SHAKS_LIGUES || {}).pyp;
    const equipe = ((ligue && ligue.equipes) || []).find(([s]) => s === joueur.s) || [];
    const pris = new Set((Array.isArray(rnd.pris) ? rnd.pris : []).map((s) => String(s).toUpperCase()));
    return {
      joueur,
      suivant: prochainLibre(liste, liste.indexOf(joueur), pris),
      boites: (c.pyp && Array.isArray(c.pyp.boites)) ? c.pyp.boites : [],
      vendu: pris.has(joueur.s),
      acheteur: (rnd.acheteurs && rnd.acheteurs[joueur.s]) || "",
      couleur: equipe[2] || "#ce6776",
    };
  }

  function visuel(j) {
    const v = el("div", "pyp__visuel");
    if (j.a) {
      const logo = el("img", "pyp__filigrane");
      logo.alt = "";
      logo.addEventListener("error", () => logo.remove());
      logo.src = LOGO(j.a);
      v.append(logo);
    }
    if (j.p) {
      const photo = el("img", "pyp__photo");
      photo.alt = "";
      photo.addEventListener("error", () => { photo.remove(); v.classList.add("is-sans-photo"); });
      photo.src = PHOTO(j.p);
      v.append(photo);
    } else {
      v.classList.add("is-sans-photo");
    }
    if (j.rc) v.append(el("span", "pyp__rc", "RC"));
    if (j.eq) v.classList.add("is-equipe");
    return v;
  }

  function infos(j) {
    const bloc = el("div", "pyp__infos");
    if (j.d != null) {
      const depart = el("span", "pyp__depart", "Enchère · départ ");
      depart.append(el("b", "", `${j.d} €`));
      bloc.append(depart);
    }
    // Spot equipe : la ville au-dessus, le surnom du club en gros
    // ("Oklahoma City" / "Thunder"), comme prenom et nom d'un joueur.
    if (j.eq) {
      const club = String(j.e || "").match(/^(.*?)\s*((?:Trail )?\S+)$/) || ["", "", j.e || ""];
      bloc.append(el("span", "pyp__prenom", club[1]), el("span", "pyp__famille", club[2]));
      const type = el("p", "pyp__total");
      type.append(el("b", "", "Carte équipe"));
      bloc.append(type);
      return bloc;
    }
    const mots = String(j.n).split(" ");
    const prenom = mots.length > 1 ? mots[0] : "";
    bloc.append(el("span", "pyp__prenom", prenom), el("span", "pyp__famille", mots.slice(prenom ? 1 : 0).join(" ")));
    const equipe = el("p", "pyp__equipe");
    if (j.a) {
      const logo = el("img");
      logo.alt = "";
      logo.addEventListener("error", () => logo.remove());
      logo.src = LOGO(j.a);
      equipe.append(logo);
    }
    equipe.append(document.createTextNode(j.e || ""));
    bloc.append(equipe);
    // Les hits : tout sauf la base, dont la quantite n'est pas toujours annoncee.
    const hits = (j.k || []).slice(0, 4).reduce((t, n) => t + (Number(n) || 0), 0);
    if (hits) {
      const total = el("p", "pyp__total");
      total.append(el("b", "", String(hits)), document.createTextNode(` hit${hits > 1 ? "s" : ""} à toucher`));
      bloc.append(total);
    }
    return bloc;
  }

  function stats(j) {
    if (!Array.isArray(j.k)) return null;   // spot equipe : pas de detail des cartes
    const ul = el("ul", "pyp__stats");
    CASES.forEach(([cle, label], i) => {
      const n = (j.k || [])[i];
      // null : categorie annoncee sans quantite ("Base")
      const li = el("li", `pyp__stat k-${cle}` + (n === 0 || n === undefined ? " is-zero" : ""));
      li.style.setProperty("--i", String(i));
      li.append(el("b", "", n === null ? "✓" : String(n || 0)), el("span", "", label));
      ul.append(li);
    });
    return ul;
  }

  /* « À suivre » : une ligne, sous les cases. Vignette nba.com, ou le logo du
     club pour une carte equipe ou un joueur sans photo. */
  function suite(j) {
    if (!j) return null;
    const ligne = el("div", "pyp__suite");
    ligne.dataset.joueur = j.s;
    ligne.append(el("b", "pyp__suite-label", "À suivre"));
    const avatar = el("span", "pyp__suite-avatar" + (j.p ? "" : " is-logo"));
    const src = j.p ? VIGNETTE(j.p) : (j.a ? LOGO(j.a) : "");
    if (src) {
      const img = el("img");
      img.alt = "";
      img.addEventListener("error", () => img.remove());
      img.src = src;
      avatar.append(img);
    }
    ligne.append(avatar);
    const nom = el("span", "pyp__suite-nom", j.eq ? `Carte équipe · ${j.e}` : j.n);
    ligne.append(nom);
    if (!j.eq && j.e) ligne.append(el("span", "pyp__suite-equipe", j.e));
    return ligne;
  }

  function majSuite(e) {
    const ancien = fiche.querySelector(".pyp__suite");
    if (ancien && e.suivant && ancien.dataset.joueur === e.suivant.s) return;
    const neuf = suite(e.suivant);
    if (ancien && neuf) ancien.replaceWith(neuf);
    else if (ancien) ancien.remove();
    else if (neuf) fiche.append(neuf);
  }

  function boites(liste) {
    if (!liste.length) return null;
    const pied = el("footer", "pyp__boites");
    pied.innerHTML = '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M4 10l12-6 12 6v12l-12 6-12-6z M4 10l12 6 12-6 M16 16v12" fill="none" stroke="#fff" stroke-width="2.4" stroke-linejoin="round"/></svg>';
    const total = liste.reduce((t, b) => t + (Number(b.n) || 0), 0);
    const titre = el("span");
    titre.append(el("b", "", String(total)), document.createTextNode(` box${total > 1 ? "es" : ""}`));
    pied.append(titre, el("span", "pyp__detail", liste.map((b) => `${b.n} ${b.nom}`).join(" · ")));
    return pied;
  }

  function construire(e) {
    const f = el("article", "pyp");
    f.style.setProperty("--halo", teinte(e.couleur, 0.7));
    const haut = el("div", "pyp__haut");
    haut.append(visuel(e.joueur), infos(e.joueur));
    f.append(haut);
    const cases = stats(e.joueur);
    if (cases) f.append(cases);
    const ensuite = suite(e.suivant);
    if (ensuite) f.append(ensuite);
    return f;
  }

  /* Un nom trop long (Gilgeous-Alexander) reduit sa taille plutot que d'etre
     coupe : on mesure apres insertion, et de nouveau quand la police arrive. */
  function ajusterNom(f) {
    const nom = f.querySelector(".pyp__famille");
    if (!nom) return;
    nom.style.fontSize = "";
    let taille = parseFloat(getComputedStyle(nom).fontSize);
    const min = taille * 0.55;
    while (nom.scrollWidth > nom.clientWidth + 1 && taille > min) {
      taille -= 2;
      nom.style.fontSize = `${taille}px`;
    }
  }

  /* Le bandeau des boxes du break reste affiche tant que la roue PYP est
     choisie, avec ou sans joueur en enchere : la fiche se pose dessous. Il
     ne se redessine que si les boites changent. */
  function boitesConfig() {
    const c = window.SHAKS_CONFIG || {};
    const rnd = c.randoms || {};
    if (rnd.actif === false || String(rnd.ligue || "").toLowerCase() !== "pyp") return [];
    return (c.pyp && Array.isArray(c.pyp.boites)) ? c.pyp.boites : [];
  }

  function majBandeau() {
    const liste = boitesConfig();
    const signature = JSON.stringify(liste);
    if (!liste.length) {
      if (bandeau) { bandeau.remove(); bandeau = null; bandeauSignature = ""; }
      return;
    }
    if (bandeau && bandeau.isConnected && signature === bandeauSignature) return;
    const neuf = el("div", "pyp-bandeau");
    neuf.append(boites(liste));
    if (bandeau && bandeau.isConnected) bandeau.replaceWith(neuf);
    else hote.prepend(neuf);
    bandeau = neuf;
    bandeauSignature = signature;
  }

  function majVendu(e) {
    let tampon = fiche.querySelector(".pyp__vendu");
    if (!e.vendu) {
      if (tampon) tampon.remove();
      fiche.classList.remove("is-vendu", "is-sortie");
      clearTimeout(minuteur);
      minuteur = 0;
      return;
    }
    if (!tampon) {
      tampon = el("div", "pyp__vendu");
      const bande = el("div");
      bande.append(el("b", "", "VENDU"), el("span", "pyp__acheteur"));
      tampon.append(bande);
      fiche.append(tampon);
      fiche.classList.add("is-vendu");
      venduA = Date.now();
    }
    tampon.querySelector(".pyp__acheteur").textContent = e.acheteur ? `@${e.acheteur}` : "";
    if (!minuteur) {
      const cible = fiche;
      minuteur = setTimeout(() => cible.classList.add("is-sortie"), DUREE_VENDU);
    }
  }

  function retirer() {
    clearTimeout(minuteur);
    minuteur = 0;
    ficheJoueur = "";
    if (!fiche) return;
    const partante = fiche;
    fiche = null;
    if (!partante.isConnected) return;
    partante.classList.add("is-sortie");
    setTimeout(() => partante.remove(), 450);
  }

  function sync() {
    clearTimeout(attente);
    majBandeau();
    const e = courant();
    if (!e) { retirer(); return; }
    /* L'enchere suivante peut demarrer sur Whatnot juste apres une vente :
       le tampon VENDU reste lisible jusqu'au bout avant de changer de fiche. */
    if (fiche && fiche.isConnected && ficheJoueur !== e.joueur.s && fiche.classList.contains("is-vendu")) {
      const reste = DUREE_VENDU - (Date.now() - venduA);
      if (reste > 0) { attente = setTimeout(sync, reste); return; }
    }
    if (!fiche || !fiche.isConnected || ficheJoueur !== e.joueur.s) {
      retirer();
      fiche = construire(e);
      ficheJoueur = e.joueur.s;
      hote.append(fiche);
      ajusterNom(fiche);
      void fiche.offsetWidth;
      fiche.classList.add("is-entree");
    } else {
      majSuite(e);
    }
    majVendu(e);
  }

  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => { if (fiche) ajusterNom(fiche); });
  }
  window.addEventListener("shaks:pyp", sync);
  window.addEventListener("shaks:config", (ev) => {
    const sections = (ev.detail && ev.detail.sections) || [];
    if (sections.includes("randoms") || sections.includes("pyp")) sync();
  });
  sync();
})();
