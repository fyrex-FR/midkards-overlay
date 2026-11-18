(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const cfg = window.SHAKS_CONFIG || {};
  let jeton = "";
  try { jeton = localStorage.getItem("shaks:token") || sessionStorage.getItem("shaks:token") || ""; } catch { /* mode prive */ }

  /* --- cartes infographie ------------------------------------------------
     Le serveur calcule la carte depuis l'API checklist et la pousse par SSE ;
     cette page ne fait que choisir les produits puis afficher ou masquer. */
  const cartes = { ids: new Set(), charge: false };

  async function commandeCartes(chemin, corps) {
    if (!jeton) throw new Error("Lecture seule");
    const res = await fetch(`/api/config/cards${chemin}`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${jeton}` },
      body: JSON.stringify(corps || {}),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    return data;
  }

  function erreurCartes(message) {
    $("cartes-erreur").hidden = !message;
    $("cartes-erreur").textContent = message || "";
  }

  const noms = new Map();

  function compteCartes() {
    const n = cartes.ids.size;
    $("cartes-compte").textContent = `${n} produit${n > 1 ? "s" : ""}`;
    const resume = $("cartes-resume");
    resume.hidden = !n;
    resume.textContent = "";
    for (const id of cartes.ids) resume.append(Object.assign(document.createElement("span"), { textContent: noms.get(id) || id }));
  }

  function filtrerCartes() {
    const mots = $("cartes-filtre").value.toLowerCase().split(/\s+/).filter(Boolean);
    for (const label of $("cartes-liste").children) {
      const texte = label.dataset.texte;
      label.hidden = !mots.every((mot) => texte.includes(mot));
    }
  }

  let presets = [];
  let presetActif = "";

  function afficherBreaks() {
    const zone = $("cartes-breaks");
    zone.textContent = "";
    for (const p of presets) {
      const puce = document.createElement("span");
      const choisir = document.createElement("button");
      choisir.type = "button";
      choisir.textContent = p.name;
      choisir.classList.toggle("is-on", p.id === presetActif);
      choisir.addEventListener("click", () => {
        presetActif = p.id;
        cartes.ids = new Set(p.ids);
        for (const label of $("cartes-liste").children) label.firstChild.checked = cartes.ids.has(label.dataset.id);
        compteCartes();
        afficherBreaks();
        $("cartes-etape2").classList.add("is-off");
        analyser().then(() => $("cartes-etape2").scrollIntoView({ behavior: "smooth", block: "start" }));
      });
      const suppr = document.createElement("button");
      suppr.type = "button";
      suppr.className = "cartes__x";
      suppr.textContent = "×";
      suppr.setAttribute("aria-label", `Supprimer ${p.name}`);
      suppr.addEventListener("click", () => {
        if (confirm(`Supprimer le break « ${p.name} » ?`)) enregistrerBreaks(presets.filter((x) => x !== p));
      });
      puce.append(choisir, suppr);
      zone.append(puce);
    }
  }

  async function enregistrerBreaks(liste) {
    try {
      presets = (await commandeCartes("presets", { presets: liste })).presets;
      afficherBreaks();
      erreurCartes("");
    } catch (error) { erreurCartes(error.message); }
  }

  $("cartes-sauver").addEventListener("click", () => {
    const name = $("cartes-nom-break").value.trim();
    if (!name) return erreurCartes("Donne un nom au break");
    if (!cartes.ids.size) return erreurCartes("Choisis au moins un produit");
    const existant = presets.find((p) => p.name.toLowerCase() === name.toLowerCase());
    const preset = { id: existant ? existant.id : Date.now().toString(36), name, ids: [...cartes.ids] };
    presetActif = preset.id;
    $("cartes-nom-break").value = "";
    enregistrerBreaks(existant ? presets.map((p) => (p === existant ? preset : p)) : [...presets, preset]);
  });

  async function chargerProduits() {
    try {
      const { checklists } = await commandeCartes("list");
      const liste = $("cartes-liste");
      liste.textContent = "";
      for (const item of checklists) {
        const label = document.createElement("label");
        noms.set(item.id, item.name);
        label.dataset.id = item.id;
        label.dataset.texte = `${item.year} ${item.name}`.toLowerCase();
        const box = document.createElement("input");
        box.type = "checkbox";
        box.checked = cartes.ids.has(item.id);
        box.addEventListener("change", () => {
          if (box.checked) cartes.ids.add(item.id); else cartes.ids.delete(item.id);
          compteCartes();
        });
        const nom = document.createElement("span");
        nom.textContent = item.name;
        label.append(box, nom);
        liste.append(label);
      }
      compteCartes();
      erreurCartes("");
    } catch (error) { erreurCartes(error.message); }
  }

  let joueurs = [];
  const plat = (t) => t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

  $("cartes-joueur").addEventListener("input", () => {
    const box = $("cartes-suggestions");
    const q = plat($("cartes-joueur").value.trim());
    box.textContent = "";
    if (!q) return;
    for (const nom of joueurs.filter((n) => plat(n).includes(q)).slice(0, 8)) {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = nom;
      b.addEventListener("click", () => { $("cartes-joueur").value = nom; box.textContent = ""; });
      box.append(b);
    }
  });

  function typeCartes() { return $("cartes-type").value; }

  function majTypeCartes() {
    const joueur = typeCartes() === "player";
    $("cartes-equipe").hidden = joueur;
    $("cartes-joueur").hidden = !joueur;
  }

  $("cartes-filtre").addEventListener("input", filtrerCartes);
  for (const bouton of document.querySelectorAll(".cartes__segments button")) {
    bouton.addEventListener("click", () => {
      $("cartes-type").value = bouton.dataset.type;
      for (const autre of document.querySelectorAll(".cartes__segments button")) autre.classList.toggle("is-on", autre === bouton);
      majTypeCartes();
    });
  }

  async function analyser() {
    if (!cartes.ids.size) return erreurCartes("Choisis au moins un produit");
    const bouton = $("cartes-charger");
    bouton.disabled = true;
    $("cartes-etat").textContent = "analyse…";
    try {
      const index = await commandeCartes("index", { ids: [...cartes.ids] });
      $("cartes-equipe").textContent = "";
      for (const nom of index.teams) $("cartes-equipe").append(new Option(nom, nom));
      joueurs = index.players;
      $("cartes-etape2").classList.remove("is-off");
      $("cartes-etape3").classList.remove("is-off");
      $("cartes-spots-aide").textContent = "live Whatnot suivi";
      if (!spots.lu) lireSpots();
      $("cartes-aide").textContent = `${index.teams.length} équipe${index.teams.length > 1 ? "s" : ""} · ${index.players.length} joueur${index.players.length > 1 ? "s" : ""}`;
      majTypeCartes();
      $("cartes-etat").textContent = "prêt";
      erreurCartes("");
    } catch (error) {
      $("cartes-etat").textContent = "NBA";
      erreurCartes(error.message);
    } finally { bouton.disabled = false; }
  }
  $("cartes-charger").addEventListener("click", analyser);

  $("cartes-afficher").addEventListener("click", async () => {
    const kind = typeCartes();
    const name = kind === "player" ? $("cartes-joueur").value.trim() : $("cartes-equipe").value;
    if (!name) return erreurCartes("Choisis une équipe ou un joueur");
    const bouton = $("cartes-afficher");
    bouton.disabled = true;
    try {
      const res = await commandeCartes("show", { ids: [...cartes.ids], kind, name });
      $("cartes-etat").textContent = `en direct : ${res.name}`;$("cartes-etat").classList.add("is-live");
      erreurCartes("");
    } catch (error) { erreurCartes(error.message); }
    finally { bouton.disabled = false; }
  });

  $("cartes-masquer").addEventListener("click", async () => {
    try {
      await commandeCartes("hide");
      $("cartes-etat").textContent = "masquée";$("cartes-etat").classList.remove("is-live");
      erreurCartes("");
    } catch (error) { erreurCartes(error.message); }
  });

  /* --- etape 3 : spots restants d'un break Whatnot ------------------------
     Le serveur relie chaque titre de spot a une equipe NBA. Un lien faux ou
     manquant se corrige ici ; il est garde pour les lives suivants. */
  const spots = { lu: false, breakId: "", rows: [], teams: [], links: {}, tempo: 12 };
  const SANS = "__aucune";

  function optionsEquipes(select, row) {
    select.textContent = "";
    const auto = row.teams || [];
    if (!auto.length) select.append(new Option("— à lier —", ""));
    if (auto.length > 1) select.append(new Option(auto.join(" + "), auto.join("|")));
    for (const nom of spots.teams) select.append(new Option(nom, nom));
    select.append(new Option("Aucune équipe (ignorer ce spot)", SANS));
    select.value = row.manuel && !auto.length ? SANS : auto.join("|");
  }

  function afficherSpots() {
    const zone = $("cartes-spots");
    zone.textContent = "";
    zone.hidden = false;
    const restants = spots.rows.filter((r) => !r.sold);
    const aLier = restants.filter((r) => !r.teams.length && !r.manuel);
    const tete = document.createElement("div");
    tete.className = "cartes__spots-tete";
    tete.innerHTML = `<span><b>${restants.length}</b> restant${restants.length > 1 ? "s" : ""} sur ${spots.rows.length}</span>`
      + (aLier.length ? `<span><b>${aLier.length}</b> à lier</span>` : "<span>tous reliés</span>");
    zone.append(tete);
    if (!spots.rows.length) {
      zone.append(Object.assign(document.createElement("div"), { className: "cartes__spots-tete", textContent: "Ce break n'expose pas encore ses spots (break aléatoire avant tirage ?)." }));
      return;
    }
    const ligne = (row) => {
      const div = document.createElement("div");
      div.className = "cartes__spot";
      div.classList.toggle("is-vendu", row.sold);
      div.classList.toggle("is-manuel", row.manuel);
      div.classList.toggle("is-alier", !row.sold && !row.teams.length && !row.manuel);
      const titre = Object.assign(document.createElement("span"), { textContent: row.title, title: row.title });
      const select = document.createElement("select");
      select.setAttribute("aria-label", `Équipe du spot ${row.title}`);
      optionsEquipes(select, row);
      select.addEventListener("change", async () => {
        const teams = select.value === SANS ? [] : select.value.split("|").filter(Boolean);
        if (!select.value) return;
        try {
          await commandeCartes("links", { links: { [row.title]: teams } });
          for (const r of spots.rows) if (r.title === row.title) { r.teams = teams; r.manuel = true; }
          afficherSpots();
          erreurCartes("");
        } catch (error) { erreurCartes(error.message); }
      });
      const voir = Object.assign(document.createElement("button"), { type: "button", textContent: "Voir" });
      voir.disabled = !row.teams.length;
      voir.title = "Afficher tout de suite la carte de cette équipe";
      voir.addEventListener("click", async () => {
        try {
          const res = await commandeCartes("show", { ids: [...cartes.ids], kind: "team", name: row.teams[0] });
          $("cartes-etat").textContent = `en direct : ${res.name}`; $("cartes-etat").classList.add("is-live");
          erreurCartes("");
        } catch (error) { erreurCartes(error.message); }
      });
      div.append(titre, select, voir);
      return div;
    };
    for (const row of restants) zone.append(ligne(row));
    const vendus = spots.rows.filter((r) => r.sold);
    if (vendus.length) {
      const pli = document.createElement("details");
      pli.className = "cartes__vendus";
      pli.append(Object.assign(document.createElement("summary"), { textContent: `${vendus.length} spot${vendus.length > 1 ? "s" : ""} déjà vendu${vendus.length > 1 ? "s" : ""}` }));
      for (const row of vendus) pli.append(ligne(row));
      zone.append(pli);
    }
  }

  async function lireSpots() {
    const bouton = $("cartes-lire");
    bouton.disabled = true;
    try {
      const data = await commandeCartes("spots", { breakId: $("cartes-break").value || spots.breakId || "" });
      spots.lu = true;
      spots.breakId = data.breakId;
      spots.rows = data.rows;
      spots.teams = data.teams;
      const choix = $("cartes-break");
      choix.textContent = "";
      for (const b of data.breaks) choix.append(new Option(`${b.title}${b.id === data.followed ? " (suivi)" : ""}`, b.id));
      choix.value = data.breakId;
      afficherSpots();
      erreurCartes("");
    } catch (error) {
      $("cartes-spots").hidden = true;
      erreurCartes(error.message);
    } finally { bouton.disabled = false; }
  }
  $("cartes-lire").addEventListener("click", lireSpots);
  $("cartes-break").addEventListener("change", lireSpots);

  for (const bouton of document.querySelectorAll("#cartes-tempo button")) {
    bouton.addEventListener("click", () => {
      spots.tempo = Number(bouton.dataset.s);
      for (const autre of document.querySelectorAll("#cartes-tempo button")) autre.classList.toggle("is-on", autre === bouton);
    });
  }

  $("cartes-tourner").addEventListener("click", async () => {
    if (!spots.breakId) return erreurCartes("Lis d'abord les spots d'un break");
    const bouton = $("cartes-tourner");
    bouton.disabled = true;
    try {
      const res = await commandeCartes("rotation", { ids: [...cartes.ids], breakId: spots.breakId, interval: spots.tempo });
      $("cartes-etat").textContent = `en direct : rotation de ${res.items} équipe${res.items > 1 ? "s" : ""}`;
      $("cartes-etat").classList.add("is-live");
      const notes = [];
      if (res.skipped.length) notes.push(`sans carte dans ces produits : ${res.skipped.join(", ")}`);
      if (res.unmatched.length) notes.push(`spots sans équipe : ${res.unmatched.join(", ")}`);
      erreurCartes(notes.length ? `Rotation lancée. ${notes.join(" · ")}` : "");
    } catch (error) { erreurCartes(error.message); }
    finally { bouton.disabled = false; }
  });

  $("cartes-masquer2").addEventListener("click", () => $("cartes-masquer").click());

  async function demarrer() {
    try {
      const enreg = await (await fetch("/api/config", { cache: "no-store" })).json();
      for (const id of (enreg.card && enreg.card.ids) || []) cartes.ids.add(String(id));
      presets = (enreg.card && enreg.card.presets) || [];
      afficherBreaks();
    } catch { /* selection vide */ }
    await chargerProduits();
    if (cartes.ids.size) analyser();
  }
  if (jeton) demarrer(); else $("cartes").hidden = true;
})();
