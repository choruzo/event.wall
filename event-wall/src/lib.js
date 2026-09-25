// Utilidades compartidas por las Pages Functions

export const json = (data, status = 200, extra = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      ...extra,
    },
  });

export const error = (status, message) => json({ error: message }, status);

export async function sha256(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function randomToken(bytes = 24) {
  const arr = crypto.getRandomValues(new Uint8Array(bytes));
  return [...arr].map((b) => b.toString(16).padStart(2, '0')).join('');
}

// Comparación en tiempo constante de dos hex del mismo tamaño
export function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export function bearer(request) {
  const h = request.headers.get('authorization') || '';
  return h.startsWith('Bearer ') ? h.slice(7).trim() : '';
}

export function isAdmin(request, env) {
  const t = bearer(request);
  return Boolean(env.ADMIN_TOKEN) && t.length > 0 && t.length === env.ADMIN_TOKEN.length && safeEqual(t, env.ADMIN_TOKEN);
}

// Estado de la ventana temporal del evento
export function windowState(ev, now = Date.now()) {
  const open = Date.parse(ev.opens_at);
  const close = Date.parse(ev.closes_at);
  if (now < open) return 'upcoming';
  if (now > close) return 'closed';
  return 'open';
}

export function publicEvent(ev) {
  return {
    slug: ev.slug,
    name: ev.name,
    tagline: ev.tagline,
    description: ev.description,
    location: ev.location,
    organizer: ev.organizer,
    url: ev.url,
    event_date: ev.event_date,
    opens_at: ev.opens_at,
    closes_at: ev.closes_at,
    default_theme: ev.default_theme,
    requires_code: Boolean(ev.join_code_hash),
    state: windowState(ev),
    now: new Date().toISOString(),
  };
}

export async function getEvent(env, slug) {
  return env.DB.prepare('SELECT * FROM events WHERE slug = ?').bind(slug).first();
}

// ---------- Validación / saneado del perfil ----------

const str = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

function url(v) {
  const s = str(v, 300);
  if (!s) return '';
  try {
    const u = new URL(/^https?:\/\//i.test(s) ? s : `https://${s}`);
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.toString() : '';
  } catch {
    return '';
  }
}

function handle(v) {
  // usuario de GitHub / X: solo caracteres seguros
  return str(v, 60).replace(/^@/, '').replace(/[^A-Za-z0-9_.-]/g, '');
}

function tags(v, maxItems = 12) {
  const arr = Array.isArray(v) ? v : typeof v === 'string' ? v.split(',') : [];
  const seen = new Set();
  const out = [];
  for (const t of arr) {
    const s = str(String(t), 32).toLowerCase().replace(/\s+/g, '-');
    if (s && !seen.has(s)) {
      seen.add(s);
      out.push(s);
    }
    if (out.length >= maxItems) break;
  }
  return out;
}

export function sanitizeProfile(input = {}) {
  const projects = (Array.isArray(input.projects) ? input.projects : [])
    .slice(0, 6)
    .map((p) => ({
      title: str(p?.title, 80),
      description: str(p?.description, 600),
      url: url(p?.url),
      stack: tags(p?.stack, 8),
      status: ['idea', 'wip', 'live', 'archived'].includes(p?.status) ? p.status : 'wip',
    }))
    .filter((p) => p.title);

  const profile = {
    name: str(input.name, 80),
    role: str(input.role, 80),
    company: str(input.company, 80),
    location: str(input.location, 60),
    bio: str(input.bio, 600),
    avatar: url(input.avatar),
    links: {
      github: handle(input.links?.github),
      linkedin: url(input.links?.linkedin),
      x: handle(input.links?.x),
      web: url(input.links?.web),
      email: /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/.test(str(input.links?.email, 254)) ? str(input.links.email, 254) : '',
    },
    tags: tags(input.tags),
    looking_for: str(input.looking_for, 300),
    offering: str(input.offering, 300),
    extra: str(input.extra, 1500),
    projects,
  };
  return profile;
}

export function validateProfile(p) {
  if (!p.name || p.name.length < 2) return 'El nombre es obligatorio.';
  return null;
}
