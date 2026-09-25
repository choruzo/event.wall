import { json, error, getEvent, windowState, sanitizeProfile, validateProfile, sha256, safeEqual, bearer, isAdmin } from '../../../../../src/lib.js';

async function load(env, params) {
  const ev = await getEvent(env, params.slug);
  if (!ev) return { err: error(404, 'Evento no encontrado.') };
  const row = await env.DB.prepare('SELECT * FROM participants WHERE id = ? AND event_slug = ?').bind(params.id, ev.slug).first();
  if (!row) return { err: error(404, 'Perfil no encontrado.') };
  return { ev, row };
}

async function ownerOk(request, row) {
  const t = bearer(request);
  return t.length > 0 && safeEqual(await sha256(t), row.token_hash);
}

export async function onRequestGet({ env, params }) {
  const { err, row } = await load(env, params);
  if (err) return err;
  return json({ participant: { id: row.id, created_at: row.created_at, updated_at: row.updated_at, ...JSON.parse(row.data) } });
}

// PUT → editar (requiere token del propietario y que el muro esté abierto)
export async function onRequestPut({ env, params, request }) {
  const { err, ev, row } = await load(env, params);
  if (err) return err;
  if (!(await ownerOk(request, row))) return error(401, 'Token de edición no válido.');
  if (windowState(ev) !== 'open') return error(403, 'El muro no está abierto: no se pueden editar perfiles.');

  let body;
  try { body = await request.json(); } catch { return error(400, 'JSON no válido.'); }
  const profile = sanitizeProfile(body.profile);
  const invalid = validateProfile(profile);
  if (invalid) return error(400, invalid);

  const now = new Date().toISOString();
  await env.DB.prepare('UPDATE participants SET name = ?, data = ?, updated_at = ? WHERE id = ?')
    .bind(profile.name, JSON.stringify(profile), now, row.id).run();
  return json({ participant: { id: row.id, created_at: row.created_at, updated_at: now, ...profile } });
}

// DELETE → el propietario puede borrarse siempre; el admin también
export async function onRequestDelete({ env, params, request }) {
  const { err, row } = await load(env, params);
  if (err) return err;
  if (!isAdmin(request, env) && !(await ownerOk(request, row))) return error(401, 'No autorizado.');
  await env.DB.prepare('DELETE FROM participants WHERE id = ?').bind(row.id).run();
  return json({ ok: true });
}
