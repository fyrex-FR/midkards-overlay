/* ==========================================================================
   MIDKARDS — Editeur de sports

   Cree des sports personnalises (MLB, NHL, foot…) avec leurs equipes et
   leurs logos, pour rejoindre NBA et NFL dans le selecteur de la regie.
   Page d'installation, pas de direct : contrairement a la regie, rien ici ne
   s'enregistre tout seul a chaque frappe.

   Trois choix qui decoulent de cet usage :

   1. NBA et NFL sont en LECTURE SEULE. Elles sont livrees avec l'overlay,
      leurs logos vivent dans assets/ : rien de tout ca ne passe par cette
      page, qui ne gere que les sports crees en ligne.

   2. PUT /api/config/sportsCustom REMPLACE toute la section. On garde donc
      une copie complete en memoire, on ne modifie que le sport ouvert, et
      chaque enregistrement renvoie l'ensemble.

   3. Chaque logo est uploade au moment du depot, pas a l'enregistrement du
      sport. Ainsi, glisser dix logos et fermer l'onglet par erreur avant de
      cliquer "Enregistrer" ne fait perdre que la fiche, pas l'upload deja
      fait — moins grave, et plus simple a coder que de tout mettre en file
      d'attente jusqu'a la sauvegarde.
   ========================================================================== */
(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const TOKEN_KEY = "shaks:token";

  /* --- jeton --------------------------------------------------------------
     Meme mecanique que la regie et les reglages. localStorage et non
     sessionStorage : fermer l'onglet ne doit pas faire perdre le droit
     d'ecrire. */
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

  const cfg = window.SHAKS_CONFIG || {};

  /* Table des ligues telle que randoms.js l'a construite : les livrees
     (nba, nfl) sans "custom", et les sports personnalises deja enregistres
     avec "custom: true". C'est la reference pour la liste de gauche. */
  const LIGUES = window.SHAKS_LIGUES || {};
  const BUILTIN_IDS = Object.entries(LIGUES).filter(([, l]) => !l.custom && !l.pyp).map(([id]) => id);   // la roue PYP se gere dans la regie

  /* Copie locale modifiable de la section entiere : PUT /api/config/
     sportsCustom la remplace en bloc, donc chaque enregistrement doit
     renvoyer TOUS les sports personnalises, pas seulement celui ouvert. */
  const sports = JSON.parse(JSON.stringify(cfg.sportsCustom || {}));

  let actuel = null;       // { id, nom, equipes: [[sigle, nom, c1, c2, logo?]] }
  let idOriginal = null;   // cle sous laquelle "actuel" est deja enregistre, ou null si nouveau

  const COULEUR_DEFAUT_1 = "#403c2e";
  const COULEUR_DEFAUT_2 = "#171611";

  function normaliserId(brut) {
    return String(brut || "").trim().toLowerCase()
      .replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 30);
  }

  /* Sigle et nom devines depuis le nom de fichier depose. Grossier par
     construction — l'utilisateur les corrige dans le tableau — mais evite
     de partir d'un champ vide a chaque logo. */
  function sigleDepuis(nomFichier) {
    const base = nomFichier.replace(/\.[^.]+$/, "").replace(/[^a-zA-Z0-9]+/g, "");
    return (base.slice(0, 4).toUpperCase()) || "EQ";
  }
  function nomDepuis(nomFichier) {
    const base = nomFichier.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim();
    return base.replace(/\w\S*/g, (w) => w[0].toUpperCase() + w.slice(1).toLowerCase()) || "Nouvelle équipe";
  }

  function etatMsg(msg, classe) {
    const el = $("etat");
    el.textContent = msg;
    el.className = "etat" + (classe ? ` is-${classe}` : "");
  }
  function retourDepot(msg, classe) {
    const el = $("retour-depot");
    el.textContent = msg;
    el.className = "retour" + (classe ? ` is-${classe}` : "");
  }

  /* --------------------------------------------------------------------------
     Reencodage avant envoi
     Version allegee de celle de la page de reglages : pas de decoupage en
     rond ni de detourage — un crest d'equipe arrive deja transparent et deja
     cadre, contrairement a une photo de ballon. On se contente de brider la
     taille et de garder l'alpha via le WebP.
     -------------------------------------------------------------------------- */
  function reencoder(fichier, maxCote = 480, qualite = 0.92) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(fichier);
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        const k = Math.min(1, maxCote / Math.max(img.naturalWidth, img.naturalHeight));
        const c = document.createElement("canvas");
        c.width = Math.max(1, Math.round(img.naturalWidth * k));
        c.height = Math.max(1, Math.round(img.naturalHeight * k));
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
        const rendre = (b, secours) => {
          if (b) return resolve({ blob: b, type: b.type || "image/webp" });
          if (secours) return reject(new Error("réencodage impossible"));
          c.toBlob((b2) => rendre(b2, true), "image/png");
        };
        c.toBlob((b) => rendre(b, false), "image/webp", qualite);
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("image illisible")); };
      img.src = url;
    });
  }

  async function televerserLogo(fichier) {
    const { blob, type } = await reencoder(fichier);
    const res = await fetch("/api/bibliotheque/logo", {
      method: "PUT",
      headers: { "content-type": type, authorization: `Bearer ${jeton}` },
      body: blob,
    });
    const corps = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(corps.error || `erreur ${res.status}`);
    return corps.url;
  }

  function supprimerLogoDistant(url) {
    const m = String(url || "").match(/\/api\/media\/logo\/([a-z0-9]+)$/);
    if (!m) return;
    // Au mieux : un logo orphelin ne genera jamais rien, inutile de bloquer
    // sur son echec.
    fetch(`/api/bibliotheque/logo/${m[1]}`, {
      method: "DELETE",
      headers: { authorization: `Bearer ${jeton}` },
    }).catch(() => {});
  }

  /* --- liste des sports ----------------------------------------------------- */
  function rendreListe() {
    const box = $("liste-sports");
    box.textContent = "";

    for (const id of BUILTIN_IDS) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "liste__item is-verrouille" + (actuel && actuel.builtin && actuel.id === id ? " is-actif" : "");
      b.innerHTML = `${LIGUES[id].nom} <span class="puce">livré</span>`;
      b.addEventListener("click", () => ouvrirLecture(id));
      box.append(b);
    }
    for (const [id, sport] of Object.entries(sports)) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "liste__item" + (actuel && !actuel.builtin && actuel.id === id ? " is-actif" : "");
      b.innerHTML = `${sport.nom || id} <span class="puce">${(sport.equipes || []).length}</span>`;
      b.addEventListener("click", () => ouvrirEditeur(id));
      box.append(b);
    }
  }

  /* --- vue lecture seule (NBA / NFL) ----------------------------------------- */
  function ouvrirLecture(id) {
    actuel = { id, builtin: true };
    $("editeur").hidden = true;
    $("lecture").hidden = false;
    $("lecture-nom").textContent = LIGUES[id].nom;
    const corps = $("corps-lecture");
    corps.textContent = "";
    for (const [sigle, nom, , , direct] of LIGUES[id].equipes) {
      const tr = document.createElement("tr");
      const modele = String((cfg.randoms && cfg.randoms.logoUrl) || "").trim();
      const src = window.SHAKS_LOGO(modele, id, sigle, direct);
      tr.innerHTML = `<td><img class="eqv__logo" src="${src}" alt="" loading="lazy"></td>
                      <td>${sigle}</td><td>${nom}</td>`;
      corps.append(tr);
    }
    rendreListe();
  }

  /* --- editeur (sports personnalises) ---------------------------------------- */
  function ouvrirEditeur(id) {
    const source = sports[id];
    actuel = { id, builtin: false, nom: source.nom || id, equipes: (source.equipes || []).map((e) => e.slice()) };
    idOriginal = id;
    rendreEditeur();
  }

  function demarrerNouveau() {
    actuel = { id: "", builtin: false, nom: "", equipes: [] };
    idOriginal = null;
    rendreEditeur();
  }

  /* --- dupliquer -------------------------------------------------------------
     Repartir d'une base — un sport personnalise existant, ou une ligue livree
     (NBA/NFL) — pour n'ajuster que ce qui change. Ouvre toujours sur une fiche
     SANS idOriginal : Enregistrer cree donc un sport different, il ne peut
     jamais ecraser la source par erreur, meme si on ne change pas l'ID propose.
     -------------------------------------------------------------------------- */
  function dupliquer() {
    if (!actuel) return;

    let nomSource, equipesSource;
    if (actuel.builtin) {
      const ligue = LIGUES[actuel.id];
      if (!ligue) return;
      nomSource = ligue.nom;
      // Le modele de chemin est resolu et fige tout de suite : la copie doit
      // continuer d'afficher les vrais logos sans dependre d'un dossier
      // assets/<id>/ qui n'existera jamais pour un sport cree en ligne.
      const modele = String((cfg.randoms && cfg.randoms.logoUrl) || "").trim();
      equipesSource = ligue.equipes.map(([sigle, nom, c1, c2, direct]) => {
        const logo = window.SHAKS_LOGO(modele, actuel.id, sigle, direct);
        return logo ? [sigle, nom, c1, c2, logo] : [sigle, nom, c1, c2];
      });
    } else {
      // On part de l'etat AFFICHE, pas de la derniere version enregistree :
      // un reglage tape a l'instant et pas encore sauvegarde ne doit pas se
      // perdre dans la copie.
      nomSource = $("sport-nom").value.trim() || actuel.nom || actuel.id;
      equipesSource = actuel.equipes.map((e) => e.slice());
    }

    const idPropose = normaliserId(`${actuel.id}-copie`);
    actuel = { id: idPropose, builtin: false, nom: `${nomSource} (copie)`, equipes: equipesSource };
    idOriginal = null;
    rendreEditeur();
    etatMsg("Copie prête — ajuste l'ID et le nom si besoin, puis Enregistrer.", "ok");
  }

  function rendreEditeur() {
    $("lecture").hidden = true;
    $("editeur").hidden = false;
    $("sport-id").value = actuel.id;
    $("sport-nom").value = actuel.nom;
    $("zone-depot").classList.toggle("is-off", !jeton);
    etatMsg("");
    rendreTableau();
    rendreListe();
  }

  function rendreTableau() {
    const corps = $("corps-tableau");
    corps.textContent = "";
    $("tableau-vide").hidden = actuel.equipes.length > 0;

    actuel.equipes.forEach((equipe, i) => {
      const [sigle, nom, c1, c2, logo] = equipe;
      const tr = document.createElement("tr");

      const tdLogo = document.createElement("td");
      if (logo) {
        const img = document.createElement("img");
        img.className = "eqv__logo";
        img.src = logo;
        img.alt = "";
        tdLogo.append(img);
      } else {
        tdLogo.textContent = "—";
      }

      const tdSigle = document.createElement("td");
      const inSigle = document.createElement("input");
      inSigle.type = "text";
      inSigle.value = sigle;
      inSigle.maxLength = 6;
      inSigle.addEventListener("input", () => { equipe[0] = inSigle.value.toUpperCase(); });
      tdSigle.append(inSigle);

      const tdNom = document.createElement("td");
      const inNom = document.createElement("input");
      inNom.type = "text";
      inNom.value = nom;
      inNom.addEventListener("input", () => { equipe[1] = inNom.value; });
      tdNom.append(inNom);

      const tdCouleurs = document.createElement("td");
      const box = document.createElement("div");
      box.className = "couleurs";
      const c1input = document.createElement("input");
      c1input.type = "color";
      c1input.value = /^#[0-9a-f]{6}$/i.test(c1) ? c1 : COULEUR_DEFAUT_1;
      c1input.title = "Couleur principale (fond de la case si le logo ne charge pas)";
      c1input.addEventListener("input", () => { equipe[2] = c1input.value; });
      const c2input = document.createElement("input");
      c2input.type = "color";
      c2input.value = /^#[0-9a-f]{6}$/i.test(c2) ? c2 : COULEUR_DEFAUT_2;
      c2input.title = "Couleur secondaire (liseré)";
      c2input.addEventListener("input", () => { equipe[3] = c2input.value; });
      box.append(c1input, c2input);
      tdCouleurs.append(box);

      const tdX = document.createElement("td");
      const x = document.createElement("button");
      x.type = "button";
      x.className = "retirer";
      x.textContent = "✕";
      x.title = "Retirer cette équipe";
      x.addEventListener("click", () => {
        if (logo) supprimerLogoDistant(logo);
        actuel.equipes.splice(i, 1);
        rendreTableau();
      });
      tdX.append(x);

      tr.append(tdLogo, tdSigle, tdNom, tdCouleurs, tdX);
      corps.append(tr);
    });
  }

  /* --- depot des logos -------------------------------------------------------
     Chaque image devient une equipe. On uploade tout de suite : une equipe
     qui echoue a l'upload n'est simplement pas ajoutee, plutot que d'ajouter
     une ligne "en attente" qu'il faudrait ensuite gerer.
     -------------------------------------------------------------------------- */
  async function deposerFichiers(fichiers) {
    if (!jeton) { retourDepot("Débloque la page avec ton lien de réglages pour envoyer des logos.", "bad"); return; }
    if (!actuel || actuel.builtin) demarrerNouveau();

    const liste = [...fichiers].filter((f) => /^image\/(png|webp|jpeg|jpg)$/.test(f.type));
    if (!liste.length) { retourDepot("Aucune image reconnue (PNG ou WebP).", "bad"); return; }

    for (let i = 0; i < liste.length; i += 1) {
      const f = liste[i];
      retourDepot(`Envoi ${i + 1} / ${liste.length} — ${f.name}…`);
      try {
        const url = await televerserLogo(f);
        actuel.equipes.push([sigleDepuis(f.name), nomDepuis(f.name), COULEUR_DEFAUT_1, COULEUR_DEFAUT_2, url]);
        rendreTableau();
      } catch (err) {
        retourDepot(`${f.name} : ${err.message}`, "bad");
        return;
      }
    }
    retourDepot(`${liste.length} logo${liste.length > 1 ? "s" : ""} ajouté${liste.length > 1 ? "s" : ""}. Vérifie les sigles avant d'enregistrer.`, "ok");
  }

  const zone = $("zone-depot");
  const champFichiers = $("fichiers");
  zone.addEventListener("click", () => champFichiers.click());
  zone.addEventListener("keydown", (ev) => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); champFichiers.click(); } });
  champFichiers.addEventListener("change", () => { deposerFichiers(champFichiers.files); champFichiers.value = ""; });
  for (const ev of ["dragenter", "dragover"]) {
    zone.addEventListener(ev, (e) => { e.preventDefault(); zone.classList.add("is-survol"); });
  }
  for (const ev of ["dragleave", "drop"]) {
    zone.addEventListener(ev, (e) => { e.preventDefault(); zone.classList.remove("is-survol"); });
  }
  zone.addEventListener("drop", (e) => { if (e.dataTransfer?.files?.length) deposerFichiers(e.dataTransfer.files); });

  /* --- enregistrement, suppression, export/import ---------------------------- */
  async function sauvegarder() {
    if (!jeton) { etatMsg("Débloque la page avec ton lien de réglages pour enregistrer.", "bad"); return; }
    const id = normaliserId($("sport-id").value);
    if (!/^[a-z0-9][a-z0-9-]{0,29}$/.test(id)) {
      etatMsg("ID invalide : minuscules, chiffres et tirets, 30 caractères max.", "bad");
      return;
    }
    if (BUILTIN_IDS.includes(id)) {
      etatMsg(`« ${id} » est réservé à un sport livré avec l'overlay.`, "bad");
      return;
    }
    if (!actuel.equipes.length) {
      etatMsg("Ajoute au moins une équipe avant d'enregistrer.", "bad");
      return;
    }

    const nom = $("sport-nom").value.trim() || id.toUpperCase();
    if (idOriginal && idOriginal !== id) delete sports[idOriginal];
    sports[id] = { nom, equipes: actuel.equipes.map((e) => e.slice()) };

    etatMsg("Enregistrement…");
    try {
      const res = await fetch("/api/config/sportsCustom", {
        method: "PUT",
        headers: { "content-type": "application/json", authorization: `Bearer ${jeton}` },
        body: JSON.stringify(sports),
      });
      if (!res.ok) {
        const c = await res.json().catch(() => ({}));
        throw new Error(c.error || `erreur ${res.status}`);
      }
      idOriginal = id;
      actuel.id = id;
      etatMsg(`« ${nom} » enregistré. Recharge la roue spot (F5) pour le voir dans le sélecteur — l'overlay, lui, se recharge tout seul.`, "ok");
      rendreListe();
    } catch (err) {
      etatMsg(`Échec : ${err.message}`, "bad");
    }
  }

  async function supprimer() {
    if (!jeton || !idOriginal) return;
    if (!confirm(`Supprimer « ${actuel.nom || idOriginal} » et tous ses logos ?`)) return;
    for (const [, , , , logo] of sports[idOriginal].equipes || []) {
      if (logo) supprimerLogoDistant(logo);
    }
    delete sports[idOriginal];
    etatMsg("Suppression…");
    try {
      const res = await fetch("/api/config/sportsCustom", {
        method: "PUT",
        headers: { "content-type": "application/json", authorization: `Bearer ${jeton}` },
        body: JSON.stringify(sports),
      });
      if (!res.ok) throw new Error(`erreur ${res.status}`);
      $("editeur").hidden = true;
      actuel = null;
      idOriginal = null;
      rendreListe();
    } catch (err) {
      etatMsg(`Échec de la suppression : ${err.message}`, "bad");
    }
  }

  function exporter() {
    const id = normaliserId($("sport-id").value) || "sport";
    const donnees = { id, nom: $("sport-nom").value.trim() || id.toUpperCase(), equipes: actuel.equipes };
    const blob = new Blob([JSON.stringify(donnees, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${id}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }

  function importer(fichier) {
    const lecteur = new FileReader();
    lecteur.onload = () => {
      try {
        const d = JSON.parse(lecteur.result);
        if (!d || !Array.isArray(d.equipes)) throw new Error("format inattendu");
        actuel = { id: normaliserId(d.id || ""), builtin: false, nom: d.nom || "", equipes: d.equipes };
        idOriginal = null; // toujours importe comme nouveau, pour ne pas ecraser un sport existant par erreur
        rendreEditeur();
        etatMsg("Fichier importé. Vérifie puis clique sur Enregistrer.", "ok");
      } catch (err) {
        etatMsg(`Fichier illisible : ${err.message}`, "bad");
      }
    };
    lecteur.readAsText(fichier);
  }

  $("nouveau").addEventListener("click", demarrerNouveau);
  $("sauvegarder").addEventListener("click", sauvegarder);
  $("dupliquer").addEventListener("click", dupliquer);
  $("dupliquer-lecture").addEventListener("click", dupliquer);
  $("supprimer").addEventListener("click", supprimer);
  $("exporter").addEventListener("click", exporter);
  $("importer").addEventListener("click", () => $("importer-fichier").click());
  $("importer-fichier").addEventListener("change", () => {
    const f = $("importer-fichier").files[0];
    if (f) importer(f);
    $("importer-fichier").value = "";
  });

  /* --- mode ------------------------------------------------------------------ */
  async function detecterEnLigne() {
    try {
      const res = await fetch("/api/config", { cache: "no-store" });
      const t = res.headers.get("content-type") || "";
      return t.includes("application/json") && (res.ok || res.status === 404);
    } catch { return false; }
  }

  function annoncer(enLigne) {
    const el = $("mode");
    if (enLigne && jeton) { el.hidden = true; return; }
    el.hidden = false;
    if (!enLigne) {
      el.className = "mode mode--fichier";
      el.innerHTML = "<b>Version dossier.</b> L'éditeur a besoin du déploiement en "
        + "ligne : les logos que tu uploaderais n'auraient nulle part où vivre.";
      return;
    }
    el.className = "mode mode--averti";
    el.innerHTML = "<b>Lecture seule.</b> Colle ton lien de réglages complet, celui qui "
      + "contient <code>#k=…</code>, pour pouvoir créer ou modifier des sports."
      + '<form class="deblocage" id="deblocage">'
      + '<input type="password" id="jeton-colle" autocomplete="off" spellcheck="false" placeholder="…/reglages#k=…">'
      + '<button type="submit">Débloquer</button></form>';

    $("deblocage").addEventListener("submit", async (ev) => {
      ev.preventDefault();
      const brut = $("jeton-colle").value.trim();
      const m = brut.match(/#k=([^\s&]+)/);
      const t = m ? decodeURIComponent(m[1]) : brut;
      if (!t) return;
      try {
        const res = await fetch("/api/jeton", { headers: { authorization: `Bearer ${t}` }, cache: "no-store" });
        if (res.status !== 204) { el.querySelector(".deblocage").insertAdjacentHTML("afterend",
          '<p style="margin:8px 0 0;color:var(--bad);font-size:12.5px">Ce lien n\'est pas le bon.</p>'); return; }
        try { localStorage.setItem(TOKEN_KEY, t); } catch { /* mode prive */ }
        jeton = t;
        el.hidden = true;
        if (actuel && !actuel.builtin) $("zone-depot").classList.remove("is-off");
      } catch { /* reseau indisponible : on laisse le formulaire tel quel */ }
    });
  }

  rendreListe();
  if (BUILTIN_IDS.length) ouvrirLecture(BUILTIN_IDS[0]);
  detecterEnLigne().then(annoncer);
})();
