import { json, error, getEvent, windowState, sanitizeProfile, validateProfile, sha256, randomToken, safeEqual, readJson } from '../../../../../src/lib.js';

const MAX_PARTICIPANTS = 1000;

// POST /api/events/:slug/participants → crea un perfil y devuelve el token de edición
export async function onRequestPost({ env, params, request }) {
  const ev = await getEvent(env, params.slug);
  if (!ev) return error(404, 'Evento no encontrado.');
  const state = windowState(ev);
  if (state === 'upcoming') return error(403, 'El muro todavía no está abierto.');
  if (state === 'closed') return error(403, 'El muro está cerrado: ya solo es de lectura.');

  const parsed = await readJson(request, 32768);
  if (parsed.response) return parsed.response;
  const body = parsed.data;

  if (ev.join_code_hash) {
    const given = await sha256(String(body.join_code || '').trim());
    if (!safeEqual(given, ev.join_code_hash)) return error(403, 'Código de acceso incorrecto.');
  }

  const profile = sanitizeProfile(body.profile);
  const invalid = validateProfile(profile);
  if (invalid) return error(400, invalid);

  const { n } = await env.DB.prepare('SELECT COUNT(*) AS n FROM participants WHERE event_slug = ?').bind(ev.slug).first();
  if (n >= MAX_PARTICIPANTS) return error(409, 'Se ha alcanzado el máximo de participantes.');

  const id = crypto.randomUUID();
  const token = randomToken();
  const now = new Date().toISOString();
  await env.DB.prepare(
    'INSERT INTO participants (id, event_slug, name, data, token_hash, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).bind(id, ev.slug, profile.name, JSON.stringify(profile), await sha256(token), now, now).run();

  return json({ id, token, participant: { id, created_at: now, updated_at: now, ...profile } }, 201);
}
