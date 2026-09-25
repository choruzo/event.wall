import { json, publicEvent } from '../../../src/lib.js';

// GET /api/events → lista pública de eventos (más recientes primero)
export async function onRequestGet({ env }) {
  const { results } = await env.DB.prepare(
    `SELECT e.*, (SELECT COUNT(*) FROM participants p WHERE p.event_slug = e.slug) AS participants
       FROM events e ORDER BY e.event_date DESC LIMIT 50`
  ).all();
  return json({ events: results.map((e) => ({ ...publicEvent(e), participants: e.participants })) });
}
