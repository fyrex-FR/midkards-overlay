-- Historique des roues : chaque ecriture, suppression ou restauration garde l'etat d'avant (retour arriere).
CREATE TABLE IF NOT EXISTS wheel_history (
  id bigserial PRIMARY KEY,
  wheel_id text NOT NULL,
  action text NOT NULL CHECK (action IN ('put', 'delete', 'restore')),
  before jsonb,
  after jsonb,
  config_version integer NOT NULL,
  actor text NOT NULL DEFAULT 'wheels-token',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS wheel_history_wheel_idx ON wheel_history (wheel_id, id DESC);
