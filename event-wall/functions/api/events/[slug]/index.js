import { json, error, getEvent, publicEvent } from '../../../../src/lib.js';

// GET /api/events/:slug → evento + participantes
export async function onRequestGet({ env, params }) {
  const ev = await getEvent(env, params.slug);
  if (!ev) return error(404, 'Evento no encontrado.');
  const { results } = await env.DB.prepare(
    'SELECT id, data, created_at, updated_at FROM participants WHERE event_slug = ? ORDER BY created_at ASC'
  ).bind(ev.slug).all();
  const participants = results.map((r) => ({ id: r.id, created_at: r.created_at, updated_at: r.updated_at, ...JSON.parse(r.data) }));
  return json({ event: publicEvent(ev), participants });
}
