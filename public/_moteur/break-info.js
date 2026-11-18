(() => {
  "use strict";

  const host = document.getElementById("break-info");
  if (!host) return;

  let data = null;
  let index = 0;
  let lastSelectedSold = null;

  /* Un break complet (tout vendu, ou clos par Whatnot) n'a plus rien a
     vendre : il sort du defilement.

     Le break SUIVI par la roue n'est pas repete ici : l'etiquette
     (label.js) porte deja son titre, son compteur et sa jauge. Cette fiche ne
     montre donc que les AUTRES breaks du live, pour que le chat voie ce qui
     se vend ensuite. Si aucun break n'est suivi, l'etiquette n'a pas de
     compteur : tous les breaks restent alors affiches ici. */
  const CLOS = /complet|filled|sold.?out|closed|ended|done|finished/i;
  function termine(item) {
    const total = Number(item.total || 0);
    return (total > 0 && Number(item.sold || 0) >= total) || CLOS.test(String(item.status || ""));
  }

  function orderedBreaks() {
    const all = (data && Array.isArray(data.breaks)) ? [...data.breaks] : [];
    const suivi = data && data.breakId != null ? String(data.breakId) : "";
    return all.filter((item) => String(item.id) !== suivi && !termine(item));
  }

  function render(animate = false) {
    const breaks = orderedBreaks();
    if (coupee() || !data?.connected || !breaks.length) { masquer(); return; }
    index %= breaks.length;
    const item = breaks[index];
    const total = Math.max(0, Number(item.total || 0));
    const sold = Math.max(0, Math.min(total || Infinity, Number(item.sold || 0)));
    const remaining = Math.max(0, total - sold);
    const percent = total ? Math.round((sold / total) * 100) : 0;
    const selected = String(item.id) === String(data.breakId);
    const apply = () => {
      host.textContent = "";
      const top = document.createElement("div"); top.className = "break-info__top";
      const badge = document.createElement("span"); badge.className = "break-info__badge";
      badge.textContent = breaks.length > 1 ? `AUSSI EN LIVE ${index + 1}/${breaks.length}` : "AUSSI EN LIVE";
      const title = document.createElement("span"); title.className = "break-info__title"; title.textContent = item.title || data.liveTitle || "Break Whatnot";
      const stats = document.createElement("span"); stats.className = "break-info__stats";
      stats.innerHTML = `<b>${sold}/${total || "—"}</b> vendus`;
      const track = document.createElement("div"); track.className = "break-info__track";
      const fill = document.createElement("div"); fill.className = "break-info__fill"; fill.style.width = `${percent}%`;
      track.append(fill); top.append(title, badge, stats); host.append(top, track);
      host.hidden = false; host.classList.remove("is-changing");
    };
    if (animate && !host.hidden) { host.classList.add("is-changing"); setTimeout(apply, 230); }
    else apply();
  }

  function masquer() { host.hidden = true; }

  /* Coupee dans Reglages (layout.breakInfo = false) : la fiche ne s'affiche plus. */
  function coupee() {
    const layout = (window.SHAKS_CONFIG && window.SHAKS_CONFIG.layout) || {};
    return layout.breakInfo === false;
  }
  window.addEventListener("shaks:config", () => render());

  async function refresh() {
    try {
      const response = await fetch("/api/whatnot/display", { cache: "no-store" });
      if (!response.ok) return;
      const next = await response.json();
      const currentId = orderedBreaks()[index]?.id;
      const selected = (next.breaks || []).find((item) => String(item.id) === String(next.breakId));
      const selectedSold = selected ? Number(selected.sold || 0) : null;
      const sale = lastSelectedSold !== null && selectedSold !== null && selectedSold > lastSelectedSold;
      lastSelectedSold = selectedSold;
      data = next;
      const refreshed = orderedBreaks();
      const preservedIndex = refreshed.findIndex((item) => String(item.id) === String(currentId));
      index = preservedIndex >= 0 ? preservedIndex : 0;
      render();
      if (sale) { host.classList.remove("is-sale"); void host.offsetWidth; host.classList.add("is-sale"); }
    } catch { /* l'overlay courant reste affiche pendant une coupure */ }
  }

  setInterval(() => {
    const count = orderedBreaks().length;
    if (count < 2) return;
    index = (index + 1) % count;
    render(true);
  }, 8000);
  setInterval(refresh, 5000);
  refresh();
})();
