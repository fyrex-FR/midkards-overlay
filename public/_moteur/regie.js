/* ==========================================================================
   MIDKARDS — Regie des randoms

   Une page qui ne fait qu'une chose : marquer les equipes vendues, en direct,
   depuis un telephone. Elle existe separement de la page de reglages parce
   qu'on s'en sert EN PLEINE VENTE — chercher un reglage parmi soixante entre
   deux cartes n'est pas tenable.

   Trois choix qui decoulent de cet usage :

   1. Chaque tape enregistre toute seule. Pas de bouton a ne pas oublier.
   2. L'ecriture passe par PUT /api/config/randoms, qui ne remplace que cette
      section. Renvoyer la config entiere ecraserait un reglage change
      ailleurs entre le chargement de cette page et la tape.
   3. Les tapes rapides sont regroupees : marquer six equipes d'affilee fait
      une seule ecriture, pas six.
   ========================================================================== */
(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const TOKEN_KEY = "shaks:token";

  /* --- jeton -------------------------------------------------------------
     Meme mecanique que la page de reglages : il arrive par #k=, on le range
     en localStorage et on nettoie l'adresse. localStorage et non session :
     sinon fermer l'onglet ferait perdre le droit d'ecrire en pleine soiree.
     -------------------------------------------------------------------- */
  function lireJeton() {
    const m = (location.hash || "").match(/^#k=(.+)$/);
    if (m) {
      const t = decodeURIComponent(m[1]);
      try { localStorage.setItem(TOKEN_KEY, t); } catch { /* mode prive */ }
      history.replaceState(null, "", location.pathname);
      return t;
    }
    try {
      return localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY) || "";
    } catch { return ""; }
  }

  let jeton = lireJeton();
  let whatnotState = { connected: false, enabled: false };
  let whatnotPreviewOpen = false;

  const cfg = window.SHAKS_CONFIG || {};
  const rnd = cfg.randoms || (cfg.randoms = { ligue: "nba", pris: [] });
  const ligues = window.SHAKS_LIGUES || {};
  let ligue = ligues[String(rnd.ligue || "nba").toLowerCase()];

  let pris = new Set((Array.isArray(rnd.pris) ? rnd.pris : []).map((s) => String(s).toUpperCase()));

  function canaux(hex) {
    const n = parseInt(String(hex).replace("#", ""), 16);
    if (Number.isNaN(n)) return [128, 128, 128];
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function encre(hex) {
    const [r, v, b] = canaux(hex);
    return (0.2126 * r + 0.7152 * v + 0.0722 * b) / 255 > 0.62 ? "#171611" : "#ffffff";
  }
  const teinte = (hex, a) => `rgba(${canaux(hex).join(",")},${a})`;

  function etat(msg, classe) {
    const el = $("etat");
    el.textContent = msg;
    el.className = "etat" + (classe ? ` is-${classe}` : "");
  }

  /* --- enregistrement ----------------------------------------------------
     Regroupe : marquer six equipes d'affilee ne doit faire qu'une ecriture.
     Une ecriture deja en vol n'est pas annulee, on en reprogramme une apres.
     -------------------------------------------------------------------- */
  let minuteur = 0;
  let enVol = false;
  let aRefaire = false;

  /* Regroupement court : assez pour qu'une rafale de six tapes ne fasse qu'une
     ecriture, assez bref pour ne pas s'ajouter de facon sensible a la latence
     d'affichage, qui est deja d'environ une seconde. */
  function programmer() {
    clearTimeout(minuteur);
    minuteur = setTimeout(envoyer, 250);
  }

  const sansAcheteurs = ({ acheteurs, ...reste }) => reste;

  async function envoyer() {
    minuteur = 0;   // sinon une resynchronisation se croirait bloquee par un envoi en attente
    if (!jeton) { etat("Lecture seule", "bad"); return; }
    if (enVol) { aRefaire = true; return; }
    enVol = true;
    etat("Enregistrement…");
    try {
      const res = await fetch("/api/config/randoms", {
        method: "PUT",
        headers: { "content-type": "application/json", authorization: `Bearer ${jeton}` },
        // Les acheteurs viennent de la synchro Whatnot : le serveur garde les siens.
        body: JSON.stringify({ ...sansAcheteurs(rnd), pris: [...pris] }),
      });
      if (res.status === 401) {
        etat("Jeton refusé", "bad");
      } else if (!res.ok) {
        const c = await res.json().catch(() => ({}));
        etat(`Refusé : ${c.error || res.status}`, "bad");
      } else {
        const h = new Date().toLocaleTimeString("fr-FR");
        etat(`Enregistré à ${h}`, "ok");
      }
    } catch (err) {
      etat(`Réseau : ${err.message}`, "bad");
    } finally {
      enVol = false;
      if (aRefaire) { aRefaire = false; programmer(); }
    }
  }

  /* --- choix du sport -----------------------------------------------------
     "pris" est une liste de sigles SANS contexte de ligue, et plusieurs
     sigles se recoupent entre la NBA et la NFL (DEN, DAL, CHI, MIN, MIA,
     WAS…). Garder l'ancienne liste en changeant de sport marquerait donc de
     mauvaises equipes vendues par coincidence. Changer de sport, c'est
     changer de break : la liste repart a zero.
     -------------------------------------------------------------------- */
  function remplirOptionsSport() {
    const sel = $("sport");
    sel.textContent = "";
    const actuelle = String(rnd.ligue || "nba").toLowerCase();
    for (const [id, l] of Object.entries(ligues)) {
      // Le DBTK a sa page : il n'apparait ici que s'il est a l'ecran.
      if (l.pyp && id !== actuelle) continue;
      const o = document.createElement("option");
      o.value = id;
      o.textContent = l.pyp ? "DBTK (géré sur la page DBTK)" : l.nom;
      o.disabled = Boolean(l.pyp);
      sel.append(o);
    }
    sel.value = actuelle;
  }

  function remplirSelecteurSport() {
    remplirOptionsSport();
    const sel = $("sport");
    sel.addEventListener("change", async () => {
      roueAuto = null;
      await changerDeRoue(sel.value);
      // Un break suivi est resuivi avec la nouvelle roue, dans le meme mode.
      if (whatnotState.breakId) await suivre(whatnotState.breakId, { detecter: false });
      else afficherRoue();
    });
  }

  /* Changer de roue, c'est changer de break : la liste des vendus repart a
     zero, et l'enregistrement part tout de suite (pas de regroupement), pour
     que le serveur connaisse la roue avant qu'on lui demande de la suivre. */
  async function changerDeRoue(id) {
    if (!ligues[id] || id === String(rnd.ligue || "nba").toLowerCase()) return;
    rnd.ligue = id;
    rnd.selection = null;
    ligue = ligues[id];
    pris = new Set();
    $("sport").value = id;
    rendre();
    majVisible();
    clearTimeout(minuteur);
    await envoyer();
  }

  /* --- rendu -------------------------------------------------------------- */
  function majJauge() {
    const total = ligue ? ligue.equipes.length : 0;
    const reste = total - pris.size;
    $("restant").textContent = String(reste);
    if ($("deux-expl")) majDeux();
    const j = $("jauge");
    j.classList.toggle("is-bas", reste > 0 && reste <= Math.max(3, Math.round(total * 0.2)));
    j.classList.toggle("is-vide", reste === 0);
    $("liberer").disabled = whatnotState.wheelSyncEnabled || pris.size === 0;
    $("vendre").disabled = whatnotState.wheelSyncEnabled || reste === 0;
  }

  async function basculer(sigle, el) {
    if (whatnotState.wheelSyncEnabled) {
      const prendre = !pris.has(sigle);
      try {
        await commandeWhatnot(prendre ? "force" : "release", { sigle });
      } catch (err) {
        etat(`Refusé : ${err.message}`, "bad");
        return;
      }
      if (prendre) pris.add(sigle); else pris.delete(sigle);
      el.classList.toggle("is-pris", prendre);
      el.setAttribute("aria-pressed", String(prendre));
      majJauge();
      return;
    }
    if (pris.has(sigle)) {
      pris.delete(sigle);
    } else {
      pris.add(sigle);
      /* L'identifiant rend chaque vente unique : OBS ne rejoue pas une
         ancienne animation apres un rechargement ou une reconnexion SSE. */
      rnd.selection = {
        sigle,
        id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`,
        at: Date.now(),
      };
    }
    el.classList.toggle("is-pris", pris.has(sigle));
    el.setAttribute("aria-pressed", String(pris.has(sigle)));
    majJauge();
    programmer();
  }

  function rendre() {
    const grille = $("grille");
    grille.textContent = "";

    if (!ligue) {
      etat("Ligue inconnue", "bad");
      return;
    }

    // PYP : un joueur a la fois, pas de grille de 350 cases.
    afficherPyp();
    if (enPyp()) { majJauge(); return; }

    const modele = String(rnd.logoUrl || "").trim();

    for (const [sigle, nom, c1, , logoDirect] of ligue.equipes) {
      const el = document.createElement("button");
      el.type = "button";
      el.className = "eq" + (pris.has(sigle) ? " is-pris" : "");
      el.style.setProperty("--bord", teinte(c1, 0.42));
      el.style.setProperty("--c1", c1);
      el.style.setProperty("--encre", encre(c1));
      el.setAttribute("aria-pressed", String(pris.has(sigle)));
      el.title = nom;

      /* Le sigle sur la couleur de l'equipe est pose d'abord : si le logo
         n'arrive pas, la case reste lisible au lieu de rester vide. */
      const secours = document.createElement("span");
      secours.className = "eq__vide";
      secours.textContent = sigle;
      el.append(secours);

      // Un sport personnalise porte son propre logo, uploade par l'editeur ;
      // il est prioritaire sur le modele de chemin des ligues livrees.
      const src = window.SHAKS_LOGO(modele, rnd.ligue, sigle, logoDirect);
      if (src) {
        const img = document.createElement("img");
        img.className = "eq__logo";
        img.alt = "";
        img.addEventListener("load", () => secours.remove());
        img.addEventListener("error", () => img.remove());
        img.src = src;
        el.append(img);
      }

      const lab = document.createElement("span");
      lab.className = "eq__sigle";
      lab.textContent = sigle;
      el.append(lab);

      el.addEventListener("click", () => basculer(sigle, el));
      grille.append(el);
    }

    majJauge();
  }

  /* Interrupteur d'affichage. Une soiree sans random doit pouvoir masquer la
     grille depuis le telephone, sans ouvrir la page de reglages. */
  function majVisible() {
    const on = rnd.actif !== false;
    const b = $("visible");
    const quoi = enPyp() ? "Fiche" : "Grille";
    b.textContent = on ? `${quoi} affichée` : `${quoi} masquée`;
    b.title = on ? `${quoi} visible dans OBS : touche pour la masquer` : `${quoi} masquée dans OBS : touche pour l'afficher`;
    b.classList.toggle("is-off", !on);
    document.body.classList.toggle("est-masquee", !on);
  }

  $("visible").addEventListener("click", () => {
    rnd.actif = rnd.actif === false;
    majVisible();
    programmer();
  });

  /* --- le 2 pour 1 ------------------------------------------------------
     Le bandeau 2 POUR 1 s'affiche dans l'overlay tant que le 2 pour 1 est
     active ET qu'il reste au moins « seuil » spots. La phrase sous le reglage
     dit lequel des deux cas est en cours, pour qu'on ne cherche pas pourquoi
     le bandeau a disparu. */
  function seuilDeux() {
    return Math.max(1, Math.round(Number((rnd.deuxPourUn || {}).seuil ?? 10)) || 10);
  }

  function majDeux() {
    const d = rnd.deuxPourUn || {};
    const seuil = seuilDeux();
    $("deux-on").setAttribute("aria-checked", String(Boolean(d.actif)));
    $("deux-off").setAttribute("aria-checked", String(!d.actif));
    $("deux-seuil-ligne").hidden = !d.actif;
    if (document.activeElement !== $("deux-seuil")) $("deux-seuil").value = String(seuil);
    $("deux-moins").disabled = seuil <= 1;
    const reste = (ligue ? ligue.equipes.length : 0) - pris.size;
    const spots = (n) => `${n} spot${n > 1 ? "s" : ""}`;
    $("deux-expl").className = "reglage__note";
    if (!d.actif) {
      $("deux-expl").textContent = "Le bandeau 2 POUR 1 n'est pas affiché.";
    } else if (reste >= seuil) {
      $("deux-expl").classList.add("is-ok");
      $("deux-expl").textContent = `Il reste ${spots(reste)} : le bandeau 2 POUR 1 est affiché. Il partira tout seul sous ${spots(seuil)}.`;
    } else {
      $("deux-expl").classList.add("is-alerte");
      $("deux-expl").textContent = `Il reste ${spots(reste)}, moins que ${seuil} : le bandeau 2 POUR 1 est masqué.`;
    }
  }

  function regleDeux(changement) {
    rnd.deuxPourUn = { actif: false, seuil: seuilDeux(), ...(rnd.deuxPourUn || {}), ...changement };
    majDeux();
    programmer();
  }
  $("deux-on").addEventListener("click", () => regleDeux({ actif: true }));
  $("deux-off").addEventListener("click", () => regleDeux({ actif: false }));
  $("deux-moins").addEventListener("click", () => regleDeux({ seuil: Math.max(1, seuilDeux() - 1) }));
  $("deux-plus").addEventListener("click", () => regleDeux({ seuil: Math.min(99, seuilDeux() + 1) }));
  $("deux-seuil").addEventListener("change", (e) => {
    const v = Math.round(Number(e.currentTarget.value));
    if (v >= 1 && v <= 99) regleDeux({ seuil: v });
    else majDeux();
  });

  $("liberer").addEventListener("click", () => {
    if (whatnotState.wheelSyncEnabled) return;
    pris = new Set();
    rnd.selection = null;
    rendre();
    programmer();
  });
  $("vendre").addEventListener("click", () => {
    if (whatnotState.wheelSyncEnabled) return;
    pris = new Set(ligue.equipes.map(([s]) => s));
    rnd.selection = null;
    rendre();
    programmer();
  });

  /* --- DBTK (pick your player) ---------------------------------------------
     Il se gere sur sa propre page (dbtk.html). Quand l'overlay est dessus, la
     roue spot ne montre pas de grille : juste le lien vers cette page. */
  const enPyp = () => Boolean(ligue && ligue.pyp);

  function afficherPyp() {
    const actif = enPyp();
    document.body.classList.toggle("mode-pyp", actif);
    $("dbtk-actif").hidden = !actif;
  }

  /* --- mode -------------------------------------------------------------- */
  async function detecterEnLigne() {
    try {
      const res = await fetch("/api/config", { cache: "no-store" });
      const t = res.headers.get("content-type") || "";
      return t.includes("application/json") && (res.ok || res.status === 404);
    } catch { return false; }
  }

  function annoncer(enLigne) {
    const el = $("mode");
    if (enLigne && jeton) { el.hidden = true; etat("Prêt"); return; }
    el.hidden = false;
    if (!enLigne) {
      el.className = "mode mode--fichier";
      el.innerHTML = "<b>Version dossier.</b> Cette page a besoin du déploiement en "
        + "ligne pour enregistrer. En local, passe par <code>reglages.html</code>.";
      etat("Hors ligne", "bad");
      return;
    }
    el.className = "mode mode--averti";
    el.innerHTML = "<b>Lecture seule.</b> Colle ton lien de réglages complet, celui qui "
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
        const res = await fetch("/api/jeton", {
          headers: { authorization: `Bearer ${t}` }, cache: "no-store",
        });
        if (res.status !== 204) { etat("Ce lien n'est pas le bon", "bad"); return; }
        try { localStorage.setItem(TOKEN_KEY, t); } catch { /* mode prive */ }
        jeton = t;
        el.hidden = true;
        etat("Prêt", "ok");
      } catch (err) {
        etat(`Réseau : ${err.message}`, "bad");
      }
    });
  }

  /* Resynchronisation au retour sur l'onglet : s'il a change quelque chose
     depuis la page de reglages, la regie ne doit pas garder un etat perime et
     le reecrire par-dessus a la tape suivante. */
  async function resynchroniser() {
    try {
      // Une seule lecture de la config : elle dit aussi si on est en ligne.
      const res = await fetch("/api/config", { cache: "no-store" });
      if (!res.ok || !(res.headers.get("content-type") || "").includes("application/json")) return;
      const d = await res.json();
      const distant = (d.randoms && Array.isArray(d.randoms.pris)) ? d.randoms.pris : null;
      if (!distant) return;
      const ligueDistante = String(d.randoms.ligue || "nba").toLowerCase();
      const memeEnsemble = distant.length === pris.size
        && distant.every((s) => pris.has(String(s).toUpperCase()))
        && ligueDistante === String(rnd.ligue || "nba").toLowerCase();
      if (!enVol && !minuteur) {
        let pypChange = false;
        if (d.pyp && JSON.stringify(d.pyp) !== JSON.stringify(cfg.pyp || null)) {
          cfg.pyp = d.pyp;
          if (window.SHAKS_MAJ_PYP) window.SHAKS_MAJ_PYP();
          remplirOptionsSport();
          if (enPyp()) ligue = ligues.pyp;
          pypChange = true;
        }
        // Le joueur affiche se choisit sur la page DBTK : on garde le sien.
        rnd.pyp = d.randoms.pyp || null;
        rnd.acheteurs = d.randoms.acheteurs || {};
        if (pypChange && memeEnsemble) afficherPyp();
      }
      if (memeEnsemble || enVol || minuteur) return;
      rnd.ligue = ligueDistante;
      ligue = ligues[ligueDistante];
      pris = new Set(distant.map((s) => String(s).toUpperCase()));
      if (typeof d.randoms.actif === "boolean") rnd.actif = d.randoms.actif;
      if (d.randoms.deuxPourUn) { rnd.deuxPourUn = d.randoms.deuxPourUn; majDeux(); }
      rnd.selection = d.randoms.selection || null;
      remplirOptionsSport();
      rendre();
      majVisible();
      etat("Repris depuis le serveur", "ok");
    } catch { /* hors ligne : on garde l'etat local */ }
  }

  /* --- synchronisation Whatnot ------------------------------------------ */
  async function commandeWhatnot(action, payload = {}) {
    if (!jeton && !whatnotPreviewOpen) throw new Error("Lecture seule");
    const headers = { "content-type": "application/json" };
    if (jeton) headers.authorization = `Bearer ${jeton}`;
    const res = await fetch("/api/whatnot", {
      method: "PUT",
      headers,
      body: JSON.stringify({ action, ...payload }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    return data;
  }

  /* --- le direct ------------------------------------------------------------
     Un seul geste : toucher le break qu'on ouvre. Suivre un break, c'est
     (1) reconnaitre la roue qui correspond a ses spots Whatnot, (2) passer
     dessus, (3) le suivre en mode automatique. Le mode et la roue restent
     modifiables, mais on n'a plus a les regler dans le bon ordre. */
  let roueAuto = null;     // { breakId, reconnus, spots } : roue choisie d'apres le break
  let occupe = false;      // un suivi est en cours de preparation
  let modeVoulu = "auto";  // le mode demande par la regie, applique a chaque break suivi

  const nfr = (n, un, plusieurs) => `${n} ${n > 1 ? plusieurs : un}`;

  function equipesDe(id) {
    return ((ligues[id] && ligues[id].equipes) || []).map(([sigle, nom]) => ({ sigle, nom }));
  }

  async function suivre(breakId, { detecter = true } = {}) {
    if (occupe || !breakId) return;
    occupe = true;
    erreurWhatnot("");
    afficherBreaks(String(breakId));
    try {
      if (detecter) {
        const leagues = {};
        for (const id of Object.keys(ligues)) if (!ligues[id].pyp) leagues[id] = equipesDe(id);
        const res = await commandeWhatnot("detect", { breakId, leagues });
        let meilleur = res.classement && res.classement[0];
        if (!res.exposes) {
          const titre = String(res.titre || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ");
          const id = Object.keys(ligues).find((k) => (ligues[k].breaks || []).some((mot) => titre.includes(mot)));
          if (id) meilleur = { id, reconnus: res.spots };
        }
        if (meilleur && meilleur.reconnus > 0) {
          roueAuto = { breakId: String(breakId), reconnus: meilleur.reconnus, spots: res.spots };
          await changerDeRoue(meilleur.id);
        } else {
          roueAuto = { breakId: String(breakId), reconnus: 0, spots: res.spots };
        }
      }
      // Automatique par defaut ; on garde « a la main » si on l'a choisi.
      const auto = modeVoulu === "auto";
      afficherWhatnot(await commandeWhatnot("select", {
        breakId,
        teams: equipesDe(String(rnd.ligue || "nba").toLowerCase()),
        wheelSync: auto,
      }));
      await resynchroniser();
    } catch (error) {
      erreurWhatnot(error.message);
    } finally {
      occupe = false;
      afficherBreaks();
    }
  }

  async function choisirMode(mode) {
    modeVoulu = mode;
    if (!whatnotState.breakId) { afficherMode(); return; }
    const enabled = mode === "auto";
    if (enabled === Boolean(whatnotState.wheelSyncEnabled)) { afficherMode(); return; }
    try {
      afficherWhatnot(await commandeWhatnot("wheel-sync", { enabled }));
      if (enabled) await resynchroniser();
    } catch (error) {
      erreurWhatnot(error.message);
      afficherMode();
    }
  }
  $("mode-auto").addEventListener("click", () => choisirMode("auto"));
  $("mode-manuel").addEventListener("click", () => choisirMode("manuel"));

  function erreurWhatnot(msg) {
    $("whatnot-error").hidden = !msg;
    $("whatnot-error").textContent = msg || "";
  }

  /* Les breaks du live, en grandes cibles : celui qu'on suit en tete, les
     breaks complets a la fin. */
  function afficherBreaks(enCours) {
    const zone = $("whatnot-breaks");
    const suivi = String(whatnotState.breakId || "");
    const breaks = [...(whatnotState.breaks || [])];
    const complet = (b) => Number(b.total) > 0 && Number(b.sold) >= Number(b.total);
    breaks.sort((x, y) => complet(x) - complet(y));
    zone.textContent = "";
    afficherEnCours();
    for (const br of breaks) {
      if (String(br.id) === suivi && String(br.id) !== enCours) continue;
      const actif = String(br.id) === suivi;
      const bouton = document.createElement("button");
      bouton.type = "button";
      bouton.className = "break" + (actif ? " is-suivi" : "") + (complet(br) ? " is-complet" : "")
        + (String(br.id) === enCours ? " is-attente" : "");
      bouton.setAttribute("aria-pressed", String(actif));
      bouton.disabled = occupe;
      const titre = document.createElement("span");
      titre.className = "break__titre";
      titre.textContent = br.title;
      const info = document.createElement("span");
      info.className = "break__info";
      const etiquette = String(br.id) === enCours ? "Préparation…"
        : actif ? "En cours" : complet(br) ? "Complet" : "";
      info.textContent = `${br.sold}/${br.total} vendus` + (etiquette ? ` · ${etiquette}` : "");
      bouton.append(titre, info);
      bouton.addEventListener("click", () => { if (!actif) suivre(br.id); });
      zone.append(bouton);
    }
    const vide = $("whatnot-vide");
    if (!whatnotState.connected) {
      vide.hidden = false;
      vide.textContent = "Aucun live Whatnot connecté. Le live de MidKards se connecte tout seul dès qu'il est programmé ; sinon, ouvre « Réglages du live Whatnot » ci-dessous. En attendant, tu peux cocher les spots à la main.";
    } else if (!breaks.length) {
      vide.hidden = false;
      vide.textContent = "Ce live n'a pas encore de break. Ils apparaîtront ici dès qu'ils sont créés sur Whatnot.";
    } else if (!zone.children.length) {
      vide.hidden = false;
      vide.textContent = "Aucun autre break dans ce live.";
    } else {
      vide.hidden = true;
    }
  }

  /* Le break suivi, en tete : titre, progression, et le STOP. */
  function afficherEnCours() {
    const suivi = String(whatnotState.breakId || "");
    const br = (whatnotState.breaks || []).find((b) => String(b.id) === suivi);
    const actif = Boolean(suivi && br);
    $("encours").hidden = !actif;
    $("direct-titre").textContent = actif ? "Changer de break" : "Quel break ouvres-tu ?";
    $("direct-titre").classList.toggle("is-secondaire", actif);
    document.body.classList.toggle("break-en-cours", actif);
    if (!actif) { armerStop(false); return; }
    const total = Number((whatnotState.totals && whatnotState.totals.total) || br.total || 0);
    const vendus = Number((whatnotState.totals && whatnotState.totals.sold) ?? br.sold ?? 0);
    const reste = Math.max(0, total - vendus);
    $("encours-titre").textContent = br.title;
    $("encours-fill").style.width = `${total ? Math.round((vendus / total) * 100) : 0}%`;
    $("encours-info").textContent = `${vendus}/${total} vendus · ${reste} restant${reste > 1 ? "s" : ""}`
      + (whatnotState.enabled ? "" : " · suivi en pause");
    const t = whatnotState.lastSyncedAt
      ? new Date(whatnotState.lastSyncedAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
      : "";
    $("encours-maj").textContent = t ? `mis à jour à ${t}` : "";
    $("encours").classList.toggle("is-pause", !whatnotState.enabled);
  }

  /* STOP en deux temps : un premier toucher arme le bouton, le second (dans
     les 3 secondes) arrete. Un STOP par megarde en pleine vente couperait la
     synchro sans qu'on s'en rende compte. */
  let stopArme = 0;
  function armerStop(on) {
    clearTimeout(stopArme);
    stopArme = 0;
    const b = $("stop");
    b.classList.toggle("is-arme", on);
    b.textContent = on ? "Touche encore pour arrêter" : "STOP · arrêter ce break";
    if (on) stopArme = setTimeout(() => armerStop(false), 3000);
  }
  $("stop").addEventListener("click", async () => {
    if (!stopArme) { armerStop(true); return; }
    armerStop(false);
    $("stop").disabled = true;
    try {
      afficherWhatnot(await commandeWhatnot("stop"));
      roueAuto = null;
    } catch (error) {
      erreurWhatnot(error.message);
    } finally {
      $("stop").disabled = false;
    }
  });

  function afficherRoue() {
    const note = $("roue-note");
    const total = ligue ? ligue.equipes.length : 0;
    const nonReconnus = (whatnotState.unmatched || []).length;
    note.className = "reglage__note";
    if (whatnotState.breakId && nonReconnus) {
      note.hidden = false;
      note.classList.add("is-alerte");
      note.textContent = `${nfr(nonReconnus, "spot Whatnot ne correspond", "spots Whatnot ne correspondent")} à aucune équipe de cette roue : vérifie que c'est la bonne.`;
      note.title = (whatnotState.unmatched || []).join("\n");
    } else if (roueAuto && String(roueAuto.breakId) === String(whatnotState.breakId) && roueAuto.reconnus) {
      note.hidden = false;
      note.textContent = `Choisie d'après le break · ${roueAuto.reconnus}/${roueAuto.spots} spots reconnus (ou même nombre de spots).`;
      note.title = "";
    } else if (whatnotState.breakId && roueAuto && roueAuto.reconnus === 0) {
      note.hidden = false;
      note.classList.add("is-alerte");
      note.textContent = "Aucune roue ne correspond aux spots de ce break : choisis-la à la main.";
      note.title = "";
    } else {
      note.hidden = false;
      note.textContent = `${total} équipes.`;
      note.title = "";
    }
  }

  function afficherMode() {
    const suiviBreak = Boolean(whatnotState.breakId);
    const auto = suiviBreak ? Boolean(whatnotState.wheelSyncEnabled) : false;
    $("mode-auto").setAttribute("aria-checked", String(auto));
    $("mode-manuel").setAttribute("aria-checked", String(!auto));
    $("mode-auto").disabled = !suiviBreak;
    $("mode-expl").textContent = !suiviBreak
      ? "Choisis un break au-dessus pour que les ventes Whatnot cochent les spots toutes seules."
      : auto
        ? "Chaque vente Whatnot coche son spot et lance l'animation. Tu n'as rien à faire."
        : "Les ventes ne cochent plus rien : touche un spot quand il est vendu.";
    $("grille-aide").textContent = auto
      ? "Touche un spot seulement pour corriger une erreur."
      : "Touche un spot quand il est vendu.";
    document.body.classList.toggle("whatnot-active", auto);
  }

  function afficherWhatnot(state) {
    whatnotState = state || { connected: false, enabled: false };
    whatnotPreviewOpen = Boolean(whatnotState.previewOpen);
    const connected = Boolean(whatnotState.connected);
    const live = whatnotState.live || {};
    /* Un live programme (statut CREATED) n'a pas commence : on affiche sa
       date, c'est ce qui dit a l'animateur que l'appli est deja prete. */
    const prevu = connected && String(live.status || "").toUpperCase() === "CREATED" && live.startTime
      ? ` · prévu ${new Date(live.startTime).toLocaleString("fr-FR", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })}`
      : "";
    $("whatnot-status").textContent = connected ? `${live.title || "Live connecté"}${prevu}` : "Aucun live connecté";
    $("whatnot-status").classList.toggle("is-connecte", connected);
    $("whatnot-seller").textContent = `@${whatnotState.seller || "midkards"}`;
    $("whatnot-auto").checked = whatnotState.auto !== false;
    const syncTime = whatnotState.lastSyncedAt
      ? new Date(whatnotState.lastSyncedAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
      : "";
    $("whatnot-sync").textContent = !whatnotState.breakId ? ""
      : whatnotState.enabled
        ? `● Suivi actif${syncTime ? ` · mis à jour à ${syncTime}` : ""}`
        : "⏸ Suivi en pause";
    $("whatnot-toggle").textContent = whatnotState.enabled ? "Mettre en pause" : "Reprendre";
    $("whatnot-toggle").disabled = !whatnotState.breakId;
    $("whatnot-disconnect").disabled = !connected;
    if (whatnotState.error) erreurWhatnot(whatnotState.error);
    else if (!occupe) erreurWhatnot("");
    if (!occupe) afficherBreaks();
    afficherRoue();
    afficherMode();
    majJauge();
  }

  async function chargerWhatnot() {
    try {
      const headers = {};
      if (jeton) headers.authorization = `Bearer ${jeton}`;
      const res = await fetch("/api/whatnot", {
        cache: "no-store", headers,
      });
      if (res.ok) afficherWhatnot(await res.json());
    } catch { /* la regie manuelle reste utilisable */ }
  }

  $("whatnot-connect").addEventListener("submit", async (event) => {
    event.preventDefault();
    const url = $("whatnot-url").value.trim();
    if (!url) return;
    erreurWhatnot("");
    try { afficherWhatnot(await commandeWhatnot("connect", { url })); }
    catch (error) { erreurWhatnot(error.message); }
  });

  $("whatnot-toggle").addEventListener("click", async () => {
    try { afficherWhatnot(await commandeWhatnot(whatnotState.enabled ? "pause" : "resume")); }
    catch (error) { erreurWhatnot(error.message); }
  });

  $("whatnot-auto").addEventListener("change", async (event) => {
    const enabled = event.currentTarget.checked;
    event.currentTarget.disabled = true;
    try {
      afficherWhatnot(await commandeWhatnot("auto", { enabled }));
    } catch (error) {
      event.currentTarget.checked = !enabled;
      erreurWhatnot(error.message);
    } finally {
      event.currentTarget.disabled = false;
    }
  });

  $("whatnot-disconnect").addEventListener("click", async () => {
    try { afficherWhatnot(await commandeWhatnot("disconnect")); }
    catch (error) { erreurWhatnot(error.message); }
  });

  remplirSelecteurSport();
  rendre();
  majVisible();
  majDeux();
  afficherWhatnot(whatnotState);
  detecterEnLigne().then(annoncer);
  chargerWhatnot();
  setInterval(async () => { await chargerWhatnot(); await resynchroniser(); }, 10_000);
  window.addEventListener("focus", resynchroniser);
})();
