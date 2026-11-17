CREATE TABLE IF NOT EXISTS overlay_state (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  config jsonb NOT NULL,
  version bigint NOT NULL DEFAULT 1,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS overlay_media (
  slot text NOT NULL CHECK (slot IN ('fond', 'globe', 'logo')),
  id text NOT NULL,
  name text NOT NULL,
  content_type text NOT NULL,
  byte_size integer NOT NULL CHECK (byte_size > 0),
  sha256 text NOT NULL CHECK (sha256 ~ '^[a-f0-9]{64}$'),
  object_key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (slot, id)
);

CREATE INDEX IF NOT EXISTS overlay_media_slot_created_idx
  ON overlay_media (slot, created_at DESC);

