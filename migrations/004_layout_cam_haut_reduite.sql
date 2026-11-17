-- Novembre 2026 : camera du haut moins haute (meme largeur, plus de 16:9),
-- remontee ; bandeau et camera break remontent d'autant. La place gagnee va
-- en bas, a la camera break.
--
-- Les migrations sont rejouees a chaque demarrage : celle-ci ne s'applique
-- qu'une fois, grace au marqueur layout.rev. Un reglage fait ensuite dans la
-- page de reglages n'est donc jamais ecrase. Seules ces 7 valeurs bougent,
-- le reste du layout est garde. En cas d'erreur, le serveur demarre quand
-- meme (le layout reste tel quel).
DO $$
BEGIN
  UPDATE overlay_state
  SET config = jsonb_set(config, '{layout}',
        (config->'layout')
        || jsonb_build_object(
             'camTop',   COALESCE(config->'layout'->'camTop', '{}'::jsonb)
                         || '{"top": 3, "height": 20.7, "ratio": ""}'::jsonb,
             'banner',   COALESCE(config->'layout'->'banner', '{}'::jsonb)
                         || '{"top": 18}'::jsonb,
             'camBreak', COALESCE(config->'layout'->'camBreak', '{}'::jsonb)
                         || '{"top": 30, "height": 70}'::jsonb,
             'rev', 2)),
      version = version + 1,
      updated_at = now()
  WHERE singleton = true
    AND jsonb_typeof(config->'layout') = 'object'
    AND COALESCE((config->'layout'->>'rev')::numeric, 0) < 2;
EXCEPTION WHEN others THEN
  RAISE WARNING 'migration 004 (layout) ignoree : %', SQLERRM;
END
$$;
