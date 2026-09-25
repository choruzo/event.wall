-- Esquema D1 (SQLite) para event-wall
DROP TABLE IF EXISTS participants;
DROP TABLE IF EXISTS events;

CREATE TABLE events (
  slug            TEXT PRIMARY KEY,           -- p. ej. "cafe-helmcode-2026-09"
  name            TEXT NOT NULL,
  tagline         TEXT,
  description     TEXT,
  location        TEXT,
  organizer       TEXT,
  url             TEXT,
  event_date      TEXT NOT NULL,              -- ISO 8601, día del evento
  opens_at        TEXT NOT NULL,              -- ISO 8601: desde cuándo se pueden crear perfiles
  closes_at       TEXT NOT NULL,              -- ISO 8601: a partir de aquí, solo lectura
  default_theme   TEXT NOT NULL DEFAULT 'helmcode', -- 'helmcode' | 'nan'
  join_code_hash  TEXT,                       -- SHA-256 del código de acceso (NULL = sin código)
  created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE participants (
  id          TEXT PRIMARY KEY,
  event_slug  TEXT NOT NULL REFERENCES events(slug) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  data        TEXT NOT NULL,                  -- JSON con el perfil público
  token_hash  TEXT NOT NULL,                  -- SHA-256 del token de edición
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);

CREATE INDEX idx_participants_event ON participants(event_slug, created_at);

-- Evento de ejemplo: abre 3 días antes y dura una semana
INSERT INTO events (slug, name, tagline, description, location, organizer, url,
                    event_date, opens_at, closes_at, default_theme, join_code_hash)
VALUES (
  'cafe-helmcode',
  'Café Helmcode',
  'Inferencia, open models y café.',
  'Muro de participantes del Café Helmcode. Deja tu perfil, enseña en qué estás trabajando y encuentra con quién seguir la conversación.',
  'Madrid',
  'Helmcode',
  'https://helmcode.com/es',
  '2026-09-22T18:00:00+02:00',
  '2026-09-19T00:00:00+02:00',
  '2026-09-26T23:59:59+02:00',
  'helmcode',
  NULL
);
