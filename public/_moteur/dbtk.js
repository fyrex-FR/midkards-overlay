/* ==========================================================================
   MIDKARDS — Regie du DBTK (pick your player)

   Une page a part de la roue spot : un joueur a l'ecran a la fois, le
   bouton « Joueur suivant », et le break Whatnot dont les ventes posent le
   tampon VENDU et le pseudo de l'acheteur sur la fiche.

   Elle ecrit dans les memes sections que la roue spot, car l'overlay n'a
   qu'une grille :
     randoms   ligue "pyp", joueurs vendus (pris), joueur affiche (pyp.courant)
     pyp       la liste des joueurs, les boites, le nom (POST /api/pyp)
   La liste se construit depuis les spots du break Whatnot quand on le
   touche : plus de CSV a renvoyer. Le CSV reste possible en secours.
   Les ventes Whatnot arrivent par la synchro du serveur, et la page les voit
   par le flux SSE de boot.js (evenement shaks:config).
   ========================================================================== */
(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const TOKEN_KEY = "shaks:token";
  const NOMS_CARTES = ["Auto", "Relic", "Case hit", "Insert", "Base"];

  /* --- jeton : meme mecanique que la roue spot (#k=, puis localStorage) --- */
  function lireJeton() {
    const m = (location.hash || "").match(/^#k=(.+)$/);
    if (m) {
      const t = decodeURIComponent(m[1]);
      try { localStorage.setItem(TOKEN_KEY, t); } catch { /* mode prive */ }
      history.replaceState(null, "", location.pathname);
      return t;
    }
    try { return localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY) || ""; } catch { return ""; }
  }
  let jeton = lireJeton();

  /* --- etat local ------------------------------------------------------- */
  const copie = (v) => JSON.parse(JSON.stringify(v || {}));
  let rnd = copie((window.SHAKS_CONFIG || {}).randoms || { ligue: "nba", pris: [] });
  let pyp = copie((window.SHAKS_CONFIG || {}).pyp);
  let pris = new Set((rnd.pris || []).map((s) => String(s).toUpperCase()));
  let whatnot = { connected: false, enabled: false };

  const liste = () => (Array.isArray(pyp.liste) ? pyp.liste : []);
  const enDbtk = () => String(rnd.ligue || "").toLowerCase() === "pyp";
  const courant = () => (rnd.pyp && rnd.pyp.courant) || "";
  const suiviDbtk = () => Boolean(whatnot.breakId && enDbtk());
  const plier = (t) => String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

  function texte(tag, classe, contenu) {
    const n = document.createElement(tag);
    if (classe) n.className = classe;
    n.textContent = contenu;
    return n;
  }

  function etat(msg, classe) {
    $("etat").textContent = msg;
    $("etat").className = "etat" + (classe ? ` is-${classe}` : "");
  }

  /* --- enregistrement (regroupe, comme la roue spot) ---------------------- */
  let minuteur = 0;
  let enVol = false;
  let aRefaire = false;

  function programmer() {
    clearTimeout(minuteur);
    minuteur = setTimeout(envoyer, 250);
  }

  async function envoyer() {
    clearTimeout(minuteur);
    minuteur = 0;
    if (!jeton) { etat("Lecture seule", "bad"); return false; }
    if (enVol) { aRefaire = true; return true; }
    enVol = true;
    etat("Enregistrement…");
    let ok = false;
    try {
      // Les acheteurs viennent de la synchro Whatnot : le serveur garde les siens.
      const { acheteurs, ...reste } = rnd;
      const res = await fetch("/api/config/randoms", {
        method: "PUT",
        headers: { "content-type": "application/json", authorization: `Bearer ${jeton}` },
        body: JSON.stringify({ ...reste, pris: [...pris] }),
      });
      if (res.status === 401) jetonRefuse();
      else if (!res.ok) etat(`Refusé : ${(await res.json().catch(() => ({}))).error || res.status}`, "bad");
      else { ok = true; etat(`Enregistré à ${new Date().toLocaleTimeString("fr-FR")}`, "ok"); }
    } catch (err) {
      etat(`Réseau : ${err.message}`, "bad");
    } finally {
      enVol = false;
      if (aRefaire) { aRefaire = false; programmer(); }
    }
    return ok;
  }

  /* Ce que le serveur pousse (ventes Whatnot, autre telephone) remplace
     l'etat local, sauf pendant qu'une ecriture d'ici attend ou part. */
  function reprendre(config) {
    if (!config || enVol || minuteur) return;
    if (config.pyp) pyp = copie(config.pyp);
    if (config.randoms) {
      rnd = copie(config.randoms);
      pris = new Set((rnd.pris || []).map((s) => String(s).toUpperCase()));
    }
    rendre();
  }

  window.addEventListener("shaks:config", () => reprendre(window.SHAKS_CONFIG));

  async function relire() {
    try {
      const res = await fetch("/api/config", { cache: "no-store" });
      if (res.ok && (res.headers.get("content-type") || "").includes("application/json")) reprendre(await res.json());
    } catch { /* hors ligne : on garde l'etat local */ }
  }

  /* --- le joueur a l'ecran ------------------------------------------------ */
  function cartesTexte(j) {
    if (j.eq) return "Carte équipe";
    return (j.k || []).map((n, i) => (n === null ? NOMS_CARTES[i] : n ? `${n} ${NOMS_CARTES[i]}` : ""))
      .filter(Boolean).join(" · ");
  }

  function choisir(sigle) {
    rnd.pyp = { courant: sigle, at: Date.now() };
    $("pyp-cherche").value = "";
    rendre();
    envoyer();
  }

  // Le suivant pas encore vendu ; en fin de liste, on repart du debut pour
  // rattraper les joueurs sautes.
  function prochainLibre(l, i) {
    return l.slice(i + 1).find((j) => !pris.has(j.s))
      || l.slice(0, Math.max(0, i)).find((j) => !pris.has(j.s)) || null;
  }

  function suivant(sens) {
    const l = liste();
    const i = l.findIndex((j) => j.s === courant());
    if (sens < 0) { if (i > 0) choisir(l[i - 1].s); return; }
    const p = prochainLibre(l, i);
    if (p) choisir(p.s);
    else etat("Tous les joueurs sont vendus", "ok");
  }

  /* Vendu a la main. Quand Whatnot coche les ventes, la correction passe par
     la synchro (force/release), sinon la prochaine synchro l'annulerait. */
  async function basculer(sigle) {
    const vendre = !pris.has(sigle);
    if (whatnot.wheelSyncEnabled && suiviDbtk()) {
      try { await commandeWhatnot(vendre ? "force" : "release", { sigle }); }
      catch (err) { etat(`Refusé : ${err.message}`, "bad"); return; }
      if (vendre) pris.add(sigle); else pris.delete(sigle);
      rendre();
      return;
    }
    if (vendre) {
      pris.add(sigle);
      rnd.selection = { sigle, id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`, at: Date.now() };
    } else {
      pris.delete(sigle);
    }
    rendre();
    programmer();
  }

  function afficherJoueur() {
    const l = liste();
    const i = l.findIndex((j) => j.s === courant());
    const j = l[i];
    const zone = $("pyp-joueur");
    zone.textContent = "";
    zone.classList.remove("is-vendu");
    if (!j) {
      zone.append(texte("p", "pyp-regie__vide", l.length
        ? "Aucun joueur à l'écran. « Premier joueur » affiche le premier joueur pas encore vendu."
        : "Pas encore de joueurs : touche le break du DBTK plus bas."));
    } else {
      const vendu = pris.has(j.s);
      zone.classList.toggle("is-vendu", vendu);
      if (j.p || (j.eq && j.a)) {
        const img = document.createElement("img");
        img.className = "pyp-regie__photo" + (j.eq ? " is-logo" : "");
        img.alt = "";
        img.addEventListener("error", () => img.remove());
        img.src = j.eq ? `assets/logos/nba/${j.a}.png` : `https://cdn.nba.com/headshots/nba/latest/260x190/${j.p}.png`;
        zone.append(img);
      }
      const id = document.createElement("div");
      id.className = "pyp-regie__id";
      const acheteur = (rnd.acheteurs && rnd.acheteurs[j.s]) || "";
      id.append(
        texte("strong", "", j.eq ? j.e : j.n),
        texte("span", "", j.eq ? `${j.s}` : `${j.e}${j.rc ? " · RC" : ""} · ${j.s}`),
        texte("span", "pyp-regie__cartes", cartesTexte(j)),
        texte("span", "pyp-regie__statut", vendu ? `Vendu${acheteur ? ` à @${acheteur}` : ""}` : "En enchère"),
      );
      const marquer = texte("button", "pyp-regie__marquer", vendu ? "Remettre en vente" : "Marquer vendu");
      marquer.type = "button";
      marquer.addEventListener("click", () => basculer(j.s));
      zone.append(id, marquer);
    }
    const vendus = l.filter((x) => pris.has(x.s)).length;
    const prochain = prochainLibre(l, i);
    $("pyp-progres").textContent = l.length
      ? `${vendus}/${l.length} vendus` + (prochain ? ` · ensuite : ${prochain.eq ? `Carte équipe ${prochain.e}` : prochain.n}` : "")
      : "";
    $("pyp-prec").disabled = i <= 0;
    $("pyp-suiv").textContent = j ? "Joueur suivant" : "Premier joueur";
    $("pyp-suiv").disabled = !prochain && !(!j && l.some((x) => !pris.has(x.s)));
    $("restant").textContent = l.length ? String(l.length - vendus) : "—";
    filtrer();
  }

  function filtrer() {
    const zone = $("pyp-resultats");
    zone.textContent = "";
    const mots = plier($("pyp-cherche").value).split(/\s+/).filter(Boolean);
    if (!mots.length) return;
    const trouves = liste().filter((j) => {
      const t = plier(`${j.n} ${j.e} ${j.s}`);
      return mots.every((m) => t.includes(m));
    }).slice(0, 8);
    if (!trouves.length) { zone.append(texte("p", "pyp-regie__vide", "Aucun joueur trouvé.")); return; }
    for (const j of trouves) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "pyp-regie__res" + (pris.has(j.s) ? " is-vendu" : "") + (j.s === courant() ? " is-courant" : "");
      b.append(texte("strong", "", j.eq ? `Carte équipe · ${j.e}` : j.n), texte("span", "", `${j.eq ? "" : `${j.e} · `}${j.s}${pris.has(j.s) ? " · vendu" : ""}`));
      b.addEventListener("click", () => choisir(j.s));
      zone.append(b);
    }
  }

  $("pyp-cherche").addEventListener("input", filtrer);
  $("pyp-suiv").addEventListener("click", () => suivant(1));
  $("pyp-prec").addEventListener("click", () => suivant(-1));

  /* --- l'overlay est-il sur le DBTK ? ------------------------------------- */
  function afficherAlerte() {
    const bloc = $("hors-dbtk");
    const l = liste();
    bloc.hidden = enDbtk() && l.length > 0;
    document.body.classList.toggle("hors-dbtk", !enDbtk());
    if (!l.length) {
      $("hors-dbtk-texte").textContent = "Pas encore de joueurs. Touche le break du DBTK plus bas : la liste se construit depuis ses spots Whatnot.";
      $("passer-dbtk").hidden = true;
    } else if (!enDbtk()) {
      $("hors-dbtk-texte").textContent = "L'overlay affiche la roue spot, pas le DBTK. Le bouton ci-dessous passe l'overlay sur la fiche joueur (les spots cochés de la roue repartent à zéro).";
      $("passer-dbtk").hidden = false;
    }
    // Les boites ne viennent pas de Whatnot : sans elles, pas de bandeau.
    const sansBoites = l.length > 0 && !(pyp.boites || []).length;
    $("sans-boites").hidden = !sansBoites;
    if (sansBoites && !boitesSignalees) { $("pyp-prep").open = true; boitesSignalees = true; }
  }
  let boitesSignalees = false;

  /* Passer l'overlay sur le DBTK, fiche visible : choisir le DBTK, c'est
     vouloir le voir dans OBS. */
  async function passerEnDbtk() {
    if (!liste().length) return;
    if (enDbtk() && rnd.actif !== false) return;
    if (!enDbtk()) {
      rnd.ligue = "pyp";
      rnd.selection = null;
      rnd.pyp = null;
      pris = new Set();
    }
    rnd.actif = true;
    rendre();
    if (!await envoyer()) throw new Error(`L'overlay n'a pas pu passer sur le DBTK (${$("etat").textContent}).`);
  }
  $("passer-dbtk").addEventListener("click", () => passerEnDbtk().catch((err) => erreurWhatnot(err.message)));

  /* --- suivre l'enchere Whatnot --------------------------------------------
     Deux interrupteurs : rnd.pypAuto (la fiche a le droit de bouger toute
     seule) et whatnot.enchere (la synchro guette le spot « running »). Le
     mode automatique demande les deux. */
  const nomDe = (sigle) => {
    const j = liste().find((x) => x.s === sigle);
    return j ? (j.eq ? `Carte équipe ${j.e}` : j.n) : sigle;
  };

  function afficherAuto() {
    const dbtk = suiviDbtk();
    const auto = rnd.pypAuto !== false && dbtk && Boolean(whatnot.enchere);
    $("auto-on").setAttribute("aria-checked", String(auto));
    $("auto-off").setAttribute("aria-checked", String(!auto));
    const note = $("auto-note");
    note.className = "reglage__note";
    if (!dbtk) {
      note.textContent = "Choisis le break du DBTK plus bas : la fiche pourra alors suivre toute seule le joueur mis en enchère sur Whatnot.";
    } else if (!auto) {
      note.textContent = "La fiche ne change qu'avec « Joueur suivant » ou la recherche.";
    } else if (whatnot.enchereSigle) {
      note.classList.add("is-ok");
      note.textContent = `Whatnot : enchère en cours sur ${nomDe(whatnot.enchereSigle)}. La fiche suit toute seule ; « Joueur suivant » reste possible.`;
    } else {
      note.textContent = "Pas d'enchère en cours sur Whatnot. Dès qu'un joueur passe en enchère, la fiche bascule dessus.";
    }
  }

  async function choisirAuto(on) {
    if (on && !suiviDbtk()) { afficherAuto(); return; }
    rnd.pypAuto = on;
    afficherAuto();
    await envoyer();
    // La synchro doit aussi guetter l'enchere : le break est resuivi avec l'option.
    if (on && !whatnot.enchere && whatnot.breakId) {
      try {
        afficherWhatnot(await commandeWhatnot("select", {
          breakId: whatnot.breakId,
          teams: liste().map((j) => ({ sigle: j.s, nom: j.t })),
          wheelSync: true,
          enchere: true,
        }));
      } catch (err) { erreurWhatnot(err.message); }
    }
    afficherAuto();
  }
  $("auto-on").addEventListener("click", () => choisirAuto(true));
  $("auto-off").addEventListener("click", () => choisirAuto(false));

  /* --- affichage dans OBS ------------------------------------------------- */
  function majVisible() {
    const on = rnd.actif !== false;
    $("visible").textContent = on ? "Fiche affichée" : "Fiche masquée";
    $("visible").title = on ? "Fiche visible dans OBS : touche pour la masquer" : "Fiche masquée dans OBS : touche pour l'afficher";
    $("visible").classList.toggle("is-off", !on);
    document.body.classList.toggle("est-masquee", !on);
  }
  $("visible").addEventListener("click", () => {
    rnd.actif = rnd.actif === false;
    majVisible();
    programmer();
  });

  function rendre() {
    afficherAlerte();
    afficherJoueur();
    majVisible();
    afficherWhatnot(whatnot);
  }

  /* --- Whatnot ------------------------------------------------------------- */
  async function commandeWhatnot(action, payload = {}) {
    if (!jeton && !whatnot.previewOpen) throw new Error("Lecture seule");
    const headers = { "content-type": "application/json" };
    if (jeton) headers.authorization = `Bearer ${jeton}`;
    const res = await fetch("/api/whatnot", { method: "PUT", headers, body: JSON.stringify({ action, ...payload }) });
    const data = await res.json().catch(() => ({}));
    if (res.status === 401) jetonRefuse();
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    return data;
  }

  /* L'erreur d'une action (toucher un break, STOP) reste affichee jusqu'a la
     prochaine action : le rafraichissement toutes les 10 s ne l'efface pas. */
  let erreurAction = "";
  function erreurWhatnot(msg) {
    erreurAction = msg || "";
    montrerErreur(erreurAction);
  }
  function montrerErreur(msg) {
    $("whatnot-error").hidden = !msg;
    $("whatnot-error").textContent = msg || "";
  }

  let occupe = "";   // le break en cours de branchement

  /* POST /api/pyp, puis la liste a jour. corps : { breakId } ou { csv },
     et/ou { boites, nom }. */
  async function importer(corps) {
    if (!jeton) throw new Error("Lecture seule : débloque la page avec ton lien de réglages.");
    // Par /api/whatnot : le Worker Cloudflare devant le serveur y transmet le jeton.
    const res = await fetch("/api/whatnot", {
      method: "PUT",
      headers: { "content-type": "application/json", authorization: `Bearer ${jeton}` },
      body: JSON.stringify({ action: "pyp", ...corps }),
    });
    const d = await res.json().catch(() => ({}));
    if (res.status === 401) {
      jetonRefuse();
      throw new Error("Jeton refusé : colle ton lien de réglages (celui avec #k=…) dans le cadre tout en haut, puis retouche le break.");
    }
    if (!res.ok) throw new Error(d.error || `HTTP ${res.status}`);
    const config = await (await fetch("/api/config", { cache: "no-store" })).json();
    pyp = copie(config.pyp);
    // Nouvelle liste : les sigles P001… ne designent plus les memes joueurs.
    if (!d.inchange && enDbtk() && (corps.breakId || corps.csv)) {
      pris = new Set();
      rnd.pyp = null;
      rnd.selection = null;
      await envoyer();
    }
    return d;
  }

  function resumeImport(d) {
    const sans = (d.sansPhoto || []).length ? ` Sans photo (logo du club à la place) : ${d.sansPhoto.join(", ")}.` : "";
    const ign = (d.ignores || []).length ? ` ${d.ignores.length} spot${d.ignores.length > 1 ? "s" : ""} hors format, ignoré${d.ignores.length > 1 ? "s" : ""} : ${d.ignores.slice(0, 3).join(" ; ")}.` : "";
    return { texte: `${d.joueurs} spots : ${d.joueurs - (d.equipes || 0)} joueurs, ${d.equipes || 0} cartes équipe.${sans}${ign}`, alerte: Boolean(ign) };
  }

  /* Suivre un break en DBTK : sa liste de joueurs se lit sur Whatnot, l'overlay
     passe sur la fiche, puis la synchro suit les ventes (sigle P001… et titre
     exact du spot). Retoucher le break suivi relit simplement ses spots. */
  async function suivre(breakId) {
    if (occupe) return;
    if (!jeton) {
      erreurWhatnot("Page en lecture seule : colle ton lien de réglages (celui avec #k=…) dans le cadre tout en haut, puis retouche le break.");
      scrollTo({ top: 0, behavior: "smooth" });
      if ($("jeton")) $("jeton").focus();
      return;
    }
    occupe = String(breakId);
    erreurWhatnot("");
    afficherWhatnot(whatnot);
    try {
      const d = await importer({ breakId });
      const r = resumeImport(d);
      etat(r.texte, r.alerte ? "bad" : "ok");
      await passerEnDbtk();
      afficherWhatnot(await commandeWhatnot("select", {
        breakId,
        teams: liste().map((j) => ({ sigle: j.s, nom: j.t })),
        wheelSync: true,
        enchere: rnd.pypAuto !== false,
      }));
      await relire();
    } catch (err) {
      erreurWhatnot(err.message);
    } finally {
      occupe = "";
      afficherWhatnot(whatnot);
    }
  }

  let stopArme = 0;
  function armerStop(on) {
    clearTimeout(stopArme);
    stopArme = 0;
    $("stop").classList.toggle("is-arme", on);
    $("stop").textContent = on ? "Touche encore pour arrêter" : "STOP · arrêter le suivi";
    if (on) stopArme = setTimeout(() => armerStop(false), 3000);
  }
  $("stop").addEventListener("click", async () => {
    if (!stopArme) { armerStop(true); return; }
    armerStop(false);
    $("stop").disabled = true;
    try { afficherWhatnot(await commandeWhatnot("stop")); }
    catch (err) { erreurWhatnot(err.message); }
    finally { $("stop").disabled = false; }
  });

  function afficherWhatnot(state) {
    whatnot = state || { connected: false, enabled: false };
    const live = whatnot.live || {};
    const connecte = Boolean(whatnot.connected);
    const prevu = connecte && String(live.status || "").toUpperCase() === "CREATED" && live.startTime
      ? ` · prévu ${new Date(live.startTime).toLocaleString("fr-FR", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })}`
      : "";
    $("whatnot-status").textContent = connecte ? `${live.title || "Live connecté"}${prevu}` : "Aucun live connecté";
    $("whatnot-status").classList.toggle("is-connecte", connecte);

    const breaks = whatnot.breaks || [];
    const suivi = String(whatnot.breakId || "");
    const brSuivi = breaks.find((b) => String(b.id) === suivi);
    const dbtk = Boolean(brSuivi && enDbtk());

    // Le break suivi en DBTK, en tete, avec son STOP.
    $("encours").hidden = !dbtk;
    $("direct-titre").textContent = dbtk ? "Changer de break" : "Quel break est le DBTK ?";
    $("direct-titre").classList.toggle("is-secondaire", dbtk);
    if (dbtk) {
      const total = Number((whatnot.totals && whatnot.totals.total) || brSuivi.total || 0);
      const vendus = Number((whatnot.totals && whatnot.totals.sold) ?? brSuivi.sold ?? 0);
      $("encours-titre").textContent = brSuivi.title;
      $("encours-fill").style.width = `${total ? Math.round((vendus / total) * 100) : 0}%`;
      $("encours-info").textContent = `${vendus}/${total} spots vendus sur Whatnot`
        + (whatnot.enabled && whatnot.wheelSyncEnabled ? "" : " · suivi en pause");
      const t = whatnot.lastSyncedAt
        ? new Date(whatnot.lastSyncedAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
        : "";
      $("encours-maj").textContent = t ? `mis à jour à ${t}` : "";
      $("encours").classList.toggle("is-pause", !(whatnot.enabled && whatnot.wheelSyncEnabled));
    } else {
      armerStop(false);
    }

    // Un break suivi par la roue spot : le prendre ici le remplace.
    const autre = $("autre-break");
    autre.hidden = !(brSuivi && !enDbtk());
    if (!autre.hidden) autre.textContent = `La roue spot suit « ${brSuivi.title} ». Choisir le DBTK ici arrête ce suivi.`;

    const zone = $("whatnot-breaks");
    zone.textContent = "";
    const n = liste().length;
    for (const br of breaks) {
      if (dbtk && String(br.id) === suivi) continue;
      const b = document.createElement("button");
      b.type = "button";
      // Le break qui a autant de spots que de joueurs importes est le bon.
      const assorti = n > 0 && Number(br.total) === n;
      b.className = "break" + (assorti ? " is-assorti" : "") + (String(br.id) === occupe ? " is-attente" : "");
      b.disabled = Boolean(occupe);
      const info = String(br.id) === occupe ? "Branchement…"
        : `${br.sold}/${br.total} vendus` + (assorti ? " · le DBTK actuel" : "");
      b.append(texte("span", "break__titre", br.title), texte("span", "break__info", info));
      b.addEventListener("click", () => suivre(br.id));
      zone.append(b);
    }
    const vide = $("whatnot-vide");
    vide.hidden = Boolean(zone.children.length);
    vide.textContent = !connecte
      ? "Aucun live Whatnot connecté. Le live de MidKards se connecte tout seul dès qu'il est programmé (réglage dans la roue spot). Tu peux aussi marquer les ventes à la main."
      : !breaks.length ? "Ce live n'a pas encore de break." : "Aucun autre break dans ce live.";

    const note = $("whatnot-note");
    const non = (whatnot.unmatched || []).length;
    note.hidden = !(dbtk && non);
    note.className = "reglage__note is-alerte";
    note.textContent = non ? `${non} spot${non > 1 ? "s" : ""} Whatnot sans joueur dans la liste (spots ajoutés ou renommés ?) : relis les spots.` : "";
    note.title = (whatnot.unmatched || []).join("\n");
    $("relire").hidden = !dbtk;
    $("relire").disabled = Boolean(occupe);
    $("relire").textContent = occupe && occupe === suivi ? "Lecture des spots…" : "Relire les spots du break Whatnot";

    montrerErreur(erreurAction || (dbtk && whatnot.error) || "");
    afficherAuto();
  }

  $("relire").addEventListener("click", () => { if (whatnot.breakId) suivre(whatnot.breakId); });

  async function chargerWhatnot() {
    try {
      const headers = {};
      if (jeton) headers.authorization = `Bearer ${jeton}`;
      const res = await fetch("/api/whatnot", { cache: "no-store", headers });
      if (res.ok) afficherWhatnot(await res.json());
    } catch { /* la saisie a la main reste possible */ }
  }

  /* --- import du CSV -------------------------------------------------------- */
  function preremplir() {
    if (!$("pyp-boites").value) $("pyp-boites").value = (pyp.boites || []).map((b) => `${b.n} ${b.nom}`).join(", ");
    if (!$("pyp-nom").value) $("pyp-nom").value = pyp.nom || "";
    apercuBoites();
  }

  /* Apercu de la lecture des boites, avec la meme regle que le serveur
     (src/pyp.js, parseBoites) : ce qui s'affiche ici est ce que montrera
     le bandeau sous la fiche. */
  function lireBoites(texte) {
    return String(texte || "").split(/[,;\n]+/).map((part) => {
      const t = part.trim();
      const m = t.match(/^(\d+)\s*x?\s+(.+)$/i) || t.match(/^(.+?)\s*:?\s+x?(\d+)$/i);
      if (!m) return t ? { faux: t } : null;
      const [n, nom] = /^\d+$/.test(m[1]) ? [m[1], m[2]] : [m[2], m[1]];
      return { nom: nom.trim().slice(0, 24), n: Math.min(9999, Number(n)) };
    }).filter(Boolean);
  }

  function apercuBoites() {
    const sortie = $("pyp-boites-lu");
    const lues = lireBoites($("pyp-boites").value);
    const bonnes = lues.filter((b) => !b.faux && b.nom && b.n > 0).slice(0, 8);
    const fausses = lues.filter((b) => b.faux);
    sortie.className = "pyp-prep__lu" + (fausses.length ? " is-alerte" : "");
    if (!lues.length) { sortie.textContent = ""; return; }
    const total = bonnes.reduce((t, b) => t + b.n, 0);
    sortie.textContent = (bonnes.length
      ? `Sur l'overlay : ${total} box${total > 1 ? "es" : ""} · ${bonnes.map((b) => `${b.n} ${b.nom}`).join(" · ")}`
      : "Rien de lisible pour l'instant.")
      + (fausses.length ? ` — pas compris : « ${fausses.map((b) => b.faux).join(" », « ")} » (il manque le nombre ?)` : "");
  }
  $("pyp-boites").addEventListener("input", apercuBoites);

  $("pyp-form").addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const sortie = $("pyp-prep-etat");
    sortie.className = "pyp-prep__etat";
    const fichier = $("pyp-csv").files[0];
    const corps = { boites: $("pyp-boites").value, nom: $("pyp-nom").value };
    if (fichier) corps.csv = await fichier.text();
    if (!fichier && !liste().length) {
      sortie.classList.add("is-alerte");
      sortie.textContent = "Touche d'abord le break du DBTK : les boîtes s'enregistrent avec sa liste de joueurs.";
      return;
    }
    $("pyp-importer").disabled = true;
    sortie.textContent = "Enregistrement…";
    try {
      const d = await importer(corps);
      if (fichier) {
        const r = resumeImport(d);
        sortie.classList.add(r.alerte ? "is-alerte" : "is-ok");
        sortie.textContent = `Liste du CSV : ${r.texte}`;
        $("pyp-csv").value = "";
        // La synchro doit connaitre les nouveaux titres.
        if (!d.inchange && suiviDbtk()) {
          await commandeWhatnot("select", { breakId: whatnot.breakId, teams: liste().map((j) => ({ sigle: j.s, nom: j.t })), wheelSync: true, enchere: rnd.pypAuto !== false })
            .then(afficherWhatnot).catch((err) => erreurWhatnot(err.message));
        }
      } else {
        sortie.classList.add("is-ok");
        sortie.textContent = `Enregistré : ${d.boites.length} type${d.boites.length > 1 ? "s" : ""} de boîtes.`;
      }
      rendre();
    } catch (err) {
      sortie.classList.add("is-alerte");
      sortie.textContent = `Refusé : ${err.message}`;
    } finally {
      $("pyp-importer").disabled = false;
    }
  });

  /* --- lecture seule ---------------------------------------------------------- */
  /* Le jeton enregistre sur ce telephone est refuse (ancien, ou celui d'une
     autre page) : on l'oublie et le cadre « Débloquer » revient. */
  function jetonRefuse() {
    jeton = "";
    try { localStorage.removeItem(TOKEN_KEY); sessionStorage.removeItem(TOKEN_KEY); } catch { /* mode prive */ }
    annoncer("Jeton refusé.");
    scrollTo({ top: 0, behavior: "smooth" });
  }

  function annoncer(raison = "Lecture seule.") {
    const el = $("mode");
    if (jeton) { el.hidden = true; etat("Prêt"); return; }
    el.hidden = false;
    el.className = "mode mode--averti";
    el.innerHTML = `<b>${raison}</b> Colle ton lien de réglages complet, celui qui `
      + "contient <code>#k=…</code>, pour pouvoir enregistrer."
      + '<form class="deblocage" id="deblocage">'
      + '<input type="password" id="jeton" autocomplete="off" spellcheck="false" placeholder="…/reglages#k=…">'
      + '<button type="submit">Débloquer</button></form>';
    etat("Lecture seule", "bad");
    $("deblocage").addEventListener("submit", async (ev) => {
      ev.preventDefault();
      const brut = $("jeton").value.trim();
      const m = brut.match(/#k=([^\s&]+)/);
      const t = m ? decodeURIComponent(m[1]) : brut;
      if (!t) return;
      etat("Vérification…");
      try {
        const res = await fetch("/api/jeton", { headers: { authorization: `Bearer ${t}` }, cache: "no-store" });
        if (res.status !== 204) { etat("Ce lien n'est pas le bon", "bad"); return; }
        try { localStorage.setItem(TOKEN_KEY, t); } catch { /* mode prive */ }
        jeton = t;
        el.hidden = true;
        etat("Prêt", "ok");
        chargerWhatnot();
      } catch (err) {
        etat(`Réseau : ${err.message}`, "bad");
      }
    });
  }

  preremplir();
  rendre();
  annoncer();
  chargerWhatnot();
  relire();
  setInterval(chargerWhatnot, 10_000);
  window.addEventListener("focus", () => { relire(); chargerWhatnot(); });
})();
