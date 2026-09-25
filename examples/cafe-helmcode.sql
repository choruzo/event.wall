INSERT INTO events (
  slug, name, tagline, description, location, organizer, url,
  event_date, opens_at, closes_at, default_theme, join_code_hash
)
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
)
ON CONFLICT(slug) DO UPDATE SET
  name = excluded.name,
  tagline = excluded.tagline,
  description = excluded.description,
  location = excluded.location,
  organizer = excluded.organizer,
  url = excluded.url,
  event_date = excluded.event_date,
  opens_at = excluded.opens_at,
  closes_at = excluded.closes_at,
  default_theme = excluded.default_theme;
