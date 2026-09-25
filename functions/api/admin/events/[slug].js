import { json, error, isAdmin } from '../../../../src/lib.js';

// DELETE /api/admin/events/:slug → borra el evento y todos sus perfiles (purga tras el evento)
export async function onRequestDelete({ env, params, request }) {
  if (!isAdmin(request, env)) return error(401, 'No autorizado.');
  await env.DB.batch([
    env.DB.prepare('DELETE FROM participants WHERE event_slug = ?').bind(params.slug),
    env.DB.prepare('DELETE FROM events WHERE slug = ?').bind(params.slug),
  ]);
  return json({ ok: true });
}
