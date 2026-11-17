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
