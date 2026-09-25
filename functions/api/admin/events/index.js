import { json, error, isAdmin, sha256, readJson, safeHttpUrl } from '../../../../src/lib.js';

const DAY = 86400000;

// POST /api/admin/events → crea o actualiza un evento (Authorization: Bearer $ADMIN_TOKEN)
// Si no se indican opens_at / closes_at: abre 3 días antes del evento y dura 7 días.
export async function onRequestPost({ env, request }) {
  if (!isAdmin(request, env)) return error(401, 'No autorizado.');
  const parsed = await readJson(request, 32768);
  if (parsed.response) return parsed.response;
  const b = parsed.data;

  const slug = String(b.slug || '').toLowerCase().trim();
  if (!/^[a-z0-9][a-z0-9-]{1,62}$/.test(slug)) return error(400, 'slug no válido (a-z, 0-9, guiones).');
  const eventName = typeof b.name === 'string' ? b.name.trim() : '';
  if (eventName.length < 2 || !b.event_date || isNaN(Date.parse(b.event_date))) {
    return error(400, 'name y event_date son obligatorios.');
  }

  const eventTs = Date.parse(b.event_date);
  const opens = b.opens_at ? new Date(Date.parse(b.opens_at)) : new Date(eventTs - 3 * DAY);
  const closes = b.closes_at ? new Date(Date.parse(b.closes_at)) : new Date(opens.getTime() + 7 * DAY);
  if (isNaN(opens) || isNaN(closes) || closes <= opens) return error(400, 'Fechas de apertura/cierre no válidas.');

  const theme = 'helmcode';
  const existing = await env.DB.prepare('SELECT join_code_hash FROM events WHERE slug = ?').bind(slug).first();
  // join_code: string → nuevo código; vacío/null → sin código; ausente → se mantiene.
  let codeHash = existing?.join_code_hash ?? null;
  if ('join_code' in b) {
    const joinCode = b.join_code == null ? '' : String(b.join_code).trim();
    if (joinCode.length > 80) return error(400, 'join_code demasiado largo.');
    codeHash = joinCode ? await sha256(joinCode) : null;
  }

  const clean = (v, max) => {
    const x = v == null ? '' : String(v).trim();
    return x ? x.slice(0, max) : null;
  };
  const eventUrl = b.url ? safeHttpUrl(b.url) : '';
  if (b.url && !eventUrl) return error(400, 'url no válida; usa http(s).');

  await env.DB.prepare(
    `INSERT INTO events (slug, name, tagline, description, location, organizer, url, event_date, opens_at, closes_at, default_theme, join_code_hash)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(slug) DO UPDATE SET name=excluded.name, tagline=excluded.tagline, description=excluded.description,
       location=excluded.location, organizer=excluded.organizer, url=excluded.url, event_date=excluded.event_date,
       opens_at=excluded.opens_at, closes_at=excluded.closes_at, default_theme=excluded.default_theme,
       join_code_hash=excluded.join_code_hash`
  ).bind(
    slug,
    eventName.slice(0, 120),
    clean(b.tagline, 180),
    clean(b.description, 1200),
    clean(b.location, 120),
    clean(b.organizer, 120),
    eventUrl || null,
    new Date(eventTs).toISOString(),
    opens.toISOString(),
    closes.toISOString(),
    theme,
    codeHash
  ).run();

  return json({ ok: true, slug, opens_at: opens.toISOString(), closes_at: closes.toISOString(), url: `/e/${slug}` }, existing ? 200 : 201);
}
