/* ==========================================================================
   MIDKARDS — Surcharge de config par l'URL
   Sert UNIQUEMENT a l'apercu live de reglages.html : celui-ci passe la config
   en cours d'edition dans le hash de l'URL, et cette couche la fusionne
   par-dessus config.js.

   Sans hash, ce fichier ne fait strictement rien. Il est donc sans effet
   quand OBS charge les pages normalement.

   A charger APRES config.js.
   ========================================================================== */
(() => {
  "use strict";
  const hash = location.hash || "";
  const marker = "#cfg=";
  if (!hash.startsWith(marker)) return;

  let incoming;
  try {
    // JSON.parse uniquement : on ne veut evaluer aucun code venu de l'URL.
    incoming = JSON.parse(decodeURIComponent(hash.slice(marker.length)));
  } catch (err) {
    console.warn("[shaks] surcharge de config illisible, ignoree", err);
    return;
  }
  if (!incoming || typeof incoming !== "object") return;

  /* Fusion recursive. Les tableaux sont remplaces en entier et non fusionnes :
     retirer un message du ticker doit vraiment le retirer. */
  const isPlain = (v) =>
    v && typeof v === "object" && !Array.isArray(v);

  function merge(base, patch) {
    for (const key of Object.keys(patch)) {
      const val = patch[key];
      if (isPlain(val) && isPlain(base[key])) merge(base[key], val);
      else base[key] = val;
    }
    return base;
  }

  window.SHAKS_CONFIG = merge(window.SHAKS_CONFIG || {}, incoming);
})();
