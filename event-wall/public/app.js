// event.wall — frontend sin dependencias

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

// Crea nodos DOM sin innerHTML (todo el contenido del usuario va como texto)
function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat()) {
    if (c == null || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

const store = {
  get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
  del(k) { try { localStorage.removeItem(k); } catch {} },
};

async function api(path, opts = {}) {
  const res = await fetch(path, {
    ...opts,
    headers: { 'content-type': 'application/json', ...(opts.headers || {}) },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
  return data;
}

function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => (t.hidden = true), 3200);
}

// ---------- Tema ----------
function applyTheme(theme, persist = true) {
  document.documentElement.dataset.theme = theme;
  $$('[data-set-theme]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.setTheme === theme)));
  if (persist) store.set('ew:theme', theme);
}
$$('[data-set-theme]').forEach((b) => b.addEventListener('click', () => applyTheme(b.dataset.setTheme)));
applyTheme(document.documentElement.dataset.theme, false);

// ---------- Formato ----------
const fmtDate = (iso, opts) => new Intl.DateTimeFormat('es-ES', opts).format(new Date(iso));
const fmtDay = (iso) => fmtDate(iso, { day: 'numeric', month: 'short', year: 'numeric' });
const fmtDayTime = (iso) => fmtDate(iso, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

function duration(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(s / 86400), hh = Math.floor((s % 86400) / 3600), mm = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d}d ${String(hh).padStart(2, '0')}h ${String(mm).padStart(2, '0')}m`;
  return `${String(hh).padStart(2, '0')}h ${String(mm).padStart(2, '0')}m ${String(s % 60).padStart(2, '0')}s`;
}

const initials = (name) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();

function avatar(p, size = '') {
  const src = p.avatar || (p.links?.github ? `https://github.com/${encodeURIComponent(p.links.github)}.png?size=176` : '');
  const box = h('div', { class: `avatar ${size}`, 'aria-hidden': 'true' }, initials(p.name));
  if (src) {
    const img = h('img', { src, alt: '', loading: 'lazy', referrerpolicy: 'no-referrer' });
    img.addEventListener('load', () => box.replaceChildren(img));
  }
  return box;
}

const STATUS_LABEL = { idea: 'idea', wip: 'en curso', live: 'en producción', archived: 'archivado' };

// ---------- Estado ----------
const state = {
  slug: null,
  event: null,
  participants: [],
  skew: 0,          // diferencia reloj servidor - cliente
  query: '',
  tag: null,
  sort: 'recent',
  editing: null,    // participante en edición
};

const mineKey = () => `ew:mine:${state.slug}`;
const mine = () => store.get(mineKey());
const serverNow = () => Date.now() + state.skew;

function liveState() {
  const ev = state.event;
  const now = serverNow();
  if (now < Date.parse(ev.opens_at)) return 'upcoming';
  if (now > Date.parse(ev.closes_at)) return 'closed';
  return 'open';
}

// ---------- Router ----------
async function route() {
  const m = location.pathname.match(/^\/e\/([a-z0-9-]+)\/?$/);
  if (m) return loadEvent(m[1]);
  return renderHome();
}

// ---------- Home: lista de eventos ----------
async function renderHome() {
  const view = $('#view');
  document.title = 'event.wall';
  try {
    const { events } = await api('/api/events');
    view.replaceChildren(
      h('section', { class: 'wrap hero' },
        h('p', { class: 'eyebrow' }, '// muros temporales para eventos tech'),
        h('h1', {}, 'Quién vino.', h('span', { class: 'l2' }, 'Qué está construyendo.')),
        h('p', { class: 'hero__lead' }, 'Cada evento tiene su muro: abre unos días antes, dura una semana y después se queda en solo lectura. Los participantes publican su perfil, sus proyectos y lo que buscan.'),
      ),
      h('section', { class: 'wrap' },
        events.length
          ? h('div', { class: 'events' }, events.map((e) =>
              h('a', { class: 'event-row', href: `/e/${e.slug}` },
                h('div', {},
                  h('div', { class: 'mono' }, `${fmtDay(e.event_date)}${e.location ? ' · ' + e.location : ''}`),
                  h('h3', {}, e.name),
                ),
                h('span', { class: 'status', 'data-state': e.state },
                  h('span', { class: 'dot' }), h('span', { class: 'mono' }, `${labelState(e.state)} · ${e.participants}`)),
              )))
          : h('p', { class: 'empty' }, 'Todavía no hay eventos.'),
      ),
    );
  } catch (err) {
    view.replaceChildren(h('p', { class: 'empty' }, err.message));
  }
}

const labelState = (s) => ({ open: 'abierto', upcoming: 'próximamente', closed: 'cerrado' }[s]);

// ---------- Evento ----------
async function loadEvent(slug) {
  state.slug = slug;
  claimEditLinkFromHash();
  try {
    const t0 = Date.now();
    const data = await api(`/api/events/${slug}`);
    state.skew = Date.parse(data.event.now) - Math.round((t0 + Date.now()) / 2);
    state.event = data.event;
    state.participants = data.participants;
    // tema por defecto del evento si el usuario no ha elegido uno
    if (!store.get('ew:theme')) applyTheme(data.event.default_theme, false);
    document.title = `${data.event.name} · event.wall`;
    renderEvent();
    tick();
    setInterval(tick, 1000);
    const q = new URLSearchParams(location.search).get('p');
    if (q) openProfile(q);
  } catch (err) {
    $('#view').replaceChildren(h('div', { class: 'wrap empty' }, err.message, h('br'), h('a', { href: '/' }, '← volver')));
  }
}

// Enlace de edición: /e/slug#edit=<id>.<token>
function claimEditLinkFromHash() {
  const m = location.hash.match(/^#edit=([0-9a-f-]{36})\.([0-9a-f]{48})$/);
  if (!m) return;
  store.set(mineKey(), { id: m[1], token: m[2] });
  history.replaceState(null, '', location.pathname + location.search);
  setTimeout(() => toast('Enlace de edición guardado en este navegador.'), 300);
}

function tick() {
  const ev = state.event;
  const s = liveState();
  const now = serverNow();
  const bar = $('#topbar');
  bar.hidden = false;
  $('#status').dataset.state = s;
  $('#status-text').textContent =
    s === 'open' ? `muro abierto · cierra en ${duration(Date.parse(ev.closes_at) - now)}`
    : s === 'upcoming' ? `abre en ${duration(Date.parse(ev.opens_at) - now)}`
    : `muro cerrado · solo lectura desde ${fmtDay(ev.closes_at)}`;
  $('#topbar-meta').textContent = `${fmtDayTime(ev.opens_at)} → ${fmtDayTime(ev.closes_at)}`;
  if (s !== tick.last) {
    tick.last = s;
    updateCtas();
  }
}

function updateCtas() {
  const s = liveState();
  const my = mine();
  const exists = my && state.participants.some((p) => p.id === my.id);
  const label = exists ? 'editar_mi_perfil' : 'crear_perfil';
  const btns = [$('#cta-nav'), $('#cta-hero')].filter(Boolean);
  btns.forEach((b) => {
    b.hidden = s !== 'open';
    b.textContent = label;
    b.onclick = () => openForm(exists ? state.participants.find((p) => p.id === my.id) : null);
  });
  const notice = $('#notice');
  if (notice) {
    notice.hidden = s === 'open';
    notice.textContent = s === 'upcoming'
      ? `// el muro abre el ${fmtDayTime(state.event.opens_at)}. Vuelve entonces para crear tu perfil.`
      : `// este muro se cerró el ${fmtDayTime(state.event.closes_at)}. Los perfiles quedan en solo lectura.`;
  }
}

function allTags() {
  const count = new Map();
  for (const p of state.participants) for (const t of p.tags || []) count.set(t, (count.get(t) || 0) + 1);
  return [...count.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

function renderEvent() {
  const ev = state.event;
  const ps = state.participants;
  const projects = ps.reduce((n, p) => n + (p.projects?.length || 0), 0);
  const tags = allTags();
  const companies = new Set(ps.map((p) => p.company?.toLowerCase()).filter(Boolean)).size;

  const eyebrow = `// ${fmtDay(ev.event_date)}${ev.location ? ' · ' + ev.location : ''}${ev.organizer ? ' · ' + ev.organizer : ''}`;

  $('#view').replaceChildren(
    h('section', { class: 'wrap hero' },
      h('p', { class: 'eyebrow' }, eyebrow),
      h('h1', {}, ev.name, h('span', { class: 'l2' }, ev.tagline || 'Muro de participantes.')),
      ev.description && h('p', { class: 'hero__lead' }, ev.description),
      h('div', { class: 'hero__ctas' },
        h('button', { type: 'button', class: 'btn btn--primary', id: 'cta-hero', hidden: true }),
        ev.url && h('a', { class: 'btn btn--ghost', href: ev.url, target: '_blank', rel: 'noopener' }, 'web_del_evento ↗'),
      ),
      h('p', { class: 'notice', id: 'notice', hidden: true }),
      h('div', { class: 'stats' },
        stat('participantes', ps.length),
        stat('proyectos', projects),
        stat('empresas', companies),
        stat('temas', tags.length),
      ),
    ),
    h('section', { class: 'wrap', 'aria-label': 'Participantes' },
      h('div', { class: 'toolbar' },
        h('label', { class: 'search' },
          h('span', { class: 'sr', hidden: true }, 'Buscar'),
          h('input', { type: 'search', placeholder: 'buscar por nombre, empresa, proyecto, stack…', value: state.query, 'aria-label': 'Buscar participantes',
            oninput: (e) => { state.query = e.target.value; renderGrid(); } })),
        h('select', { 'aria-label': 'Ordenar', onchange: (e) => { state.sort = e.target.value; renderGrid(); } },
          h('option', { value: 'recent', selected: state.sort === 'recent' }, 'más recientes'),
          h('option', { value: 'alpha', selected: state.sort === 'alpha' }, 'a → z'),
          h('option', { value: 'projects', selected: state.sort === 'projects' }, 'más proyectos'),
        ),
      ),
      tags.length ? h('div', { class: 'chips', id: 'tag-chips' }, tags.slice(0, 20).map(([t, n]) =>
        h('button', { type: 'button', class: 'chip', 'aria-pressed': String(state.tag === t), onclick: () => { state.tag = state.tag === t ? null : t; renderEvent(); } },
          `#${t}`, h('small', {}, n)))) : null,
      h('div', { class: 'grid', id: 'grid' }),
    ),
  );

  $('#footer').replaceChildren(
    h('span', {}, `event.wall · ${ev.name} · muro temporal: ${fmtDay(ev.opens_at)} → ${fmtDay(ev.closes_at)}`),
    h('span', {}, h('a', { href: `/api/events/${ev.slug}`, download: `${ev.slug}.json` }, 'exportar_json'), ' · ', h('a', { href: '/' }, 'todos_los_eventos')),
  );

  tick.last = null;
  tick();
  renderGrid();
}

function stat(label, value) {
  return h('div', { class: 'stat' }, h('div', { class: 'stat__label' }, label), h('div', { class: 'stat__value' }, value));
}

function matches(p, q) {
  if (!q) return true;
  const hay = [p.name, p.role, p.company, p.location, p.bio, p.looking_for, p.offering, p.extra, ...(p.tags || []),
    ...(p.projects || []).flatMap((x) => [x.title, x.description, ...(x.stack || [])])].join(' ').toLowerCase();
  return q.toLowerCase().split(/\s+/).every((w) => hay.includes(w));
}

function renderGrid() {
  const grid = $('#grid');
  if (!grid) return;
  const my = mine();
  let list = state.participants.filter((p) => matches(p, state.query) && (!state.tag || p.tags?.includes(state.tag)));
  if (state.sort === 'recent') list = [...list].reverse();
  if (state.sort === 'alpha') list = [...list].sort((a, b) => a.name.localeCompare(b.name, 'es'));
  if (state.sort === 'projects') list = [...list].sort((a, b) => (b.projects?.length || 0) - (a.projects?.length || 0));

  if (!list.length) {
    grid.replaceChildren(h('p', { class: 'empty empty--full' },
      state.participants.length ? 'Nadie coincide con esa búsqueda.' : liveState() === 'open' ? 'Aún no hay perfiles. Sé el primero.' : 'No hay perfiles en este muro.'));
    return;
  }
  grid.replaceChildren(...list.map((p) =>
    h('button', { type: 'button', class: `card${my?.id === p.id ? ' card--mine' : ''}`, onclick: () => openProfile(p.id) },
      h('div', { class: 'card__head' },
        avatar(p),
        h('div', { class: 'card__main' },
          h('h3', { class: 'card__name' }, p.name),
          (p.role || p.company) && h('div', { class: 'card__role' }, [p.role, p.company].filter(Boolean).join(' @ ')),
        )),
      p.bio && h('p', { class: 'card__bio' }, p.bio),
      p.tags?.length ? h('div', { class: 'card__tags' }, p.tags.slice(0, 5).map((t) => h('span', { class: 'chip chip--static' }, `#${t}`))) : null,
      h('div', { class: 'card__foot' },
        h('span', { class: 'nowrap' }, h('b', {}, p.projects?.length || 0), (p.projects?.length === 1 ? ' proyecto' : ' proyectos')),
        p.looking_for ? h('span', { class: 'ellipsis' }, 'busca: ', h('b', {}, p.looking_for)) : h('span', {}, p.location || ''),
      ),
    )));
}

const truncate = (s, n) => (s.length > n ? s.slice(0, n - 1) + '…' : s);

// ---------- Vista de perfil ----------
function openProfile(id) {
  const p = state.participants.find((x) => x.id === id);
  if (!p) return;
  const my = mine();
  const L = p.links || {};
  const links = [
    L.github && ['github', `https://github.com/${encodeURIComponent(L.github)}`],
    L.linkedin && ['linkedin', L.linkedin],
    L.x && ['x', `https://x.com/${encodeURIComponent(L.x)}`],
    L.web && ['web', L.web],
    L.email && ['email', `mailto:${L.email}`],
  ].filter(Boolean);

  const body = $('#profile-body');
  body.replaceChildren(...[
    h('div', { class: 'dialog__head' },
      h('div', { class: 'profile__top' },
        avatar(p, 'avatar--lg'),
        h('div', {},
          h('h2', { id: 'profile-title' }, p.name),
          h('div', { class: 'profile__meta' }, [p.role, p.company, p.location].filter(Boolean).join(' · ') || '—'),
        )),
      h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Cerrar', onclick: () => $('#profile-dialog').close() }, '✕'),
    ),
    p.bio && section('sobre mí', h('p', { class: 'profile__text' }, p.bio)),
    links.length ? section('enlaces', h('div', { class: 'links' }, links.map(([label, href]) =>
      h('a', { href, target: '_blank', rel: 'noopener nofollow ugc' }, `${label} ↗`)))) : null,
    (p.looking_for || p.offering) && section('networking', h('div', { class: 'two-col' },
      p.looking_for && h('div', { class: 'box' }, h('h4', {}, 'busco'), h('p', {}, p.looking_for)),
      p.offering && h('div', { class: 'box' }, h('h4', {}, 'ofrezco'), h('p', {}, p.offering)),
    )),
    p.projects?.length ? section(`proyectos (${p.projects.length})`, p.projects.map((x) =>
      h('div', { class: 'project' },
        h('div', { class: 'project__head' },
          h('p', { class: 'project__title' }, x.url ? h('a', { href: x.url, target: '_blank', rel: 'noopener nofollow ugc' }, `${x.title} ↗`) : x.title),
          h('span', { class: `badge badge--${x.status}` }, STATUS_LABEL[x.status] || x.status)),
        x.description && h('p', {}, x.description),
        x.stack?.length ? h('div', { class: 'card__tags' }, x.stack.map((s) => h('span', { class: 'chip chip--static' }, s))) : null,
      ))) : null,
    p.tags?.length ? section('temas', h('div', { class: 'card__tags' }, p.tags.map((t) =>
      h('button', { type: 'button', class: 'chip', onclick: () => { state.tag = t; $('#profile-dialog').close(); renderEvent(); } }, `#${t}`)))) : null,
    p.extra && section('extra', h('p', { class: 'profile__text' }, p.extra)),
    h('div', { class: 'dialog__foot' },
      h('span', { class: 'mono muted small' }, `actualizado ${fmtDayTime(p.updated_at)}`),
      h('span', { class: 'spacer' }),
      h('button', { type: 'button', class: 'btn btn--ghost btn--sm', onclick: () => copyProfileLink(p.id) }, 'copiar_enlace'),
      my?.id === p.id && liveState() === 'open'
        ? h('button', { type: 'button', class: 'btn btn--primary btn--sm', onclick: () => { $('#profile-dialog').close(); openForm(p); } }, 'editar')
        : null,
    ),
  ].filter(Boolean));
  const d = $('#profile-dialog');
  if (!d.open) d.showModal();
  body.parentElement.scrollTop = 0;
}

function section(title, ...content) {
  return h('div', { class: 'profile__section' }, h('h3', {}, `// ${title}`), ...content);
}

async function copyProfileLink(id) {
  const url = `${location.origin}/e/${state.slug}?p=${id}`;
  try { await navigator.clipboard.writeText(url); toast('Enlace copiado.'); } catch { prompt('Copia el enlace:', url); }
}

// ---------- Formulario ----------
const form = $('#profile-form');

function addProjectRow(p = {}) {
  const list = $('#projects-list');
  if (list.children.length >= 6) return toast('Máximo 6 proyectos.');
  const node = $('#project-tpl').content.firstElementChild.cloneNode(true);
  $('[data-f="title"]', node).value = p.title || '';
  $('[data-f="url"]', node).value = p.url || '';
  $('[data-f="status"]', node).value = p.status || 'wip';
  $('[data-f="stack"]', node).value = (p.stack || []).join(', ');
  $('[data-f="description"]', node).value = p.description || '';
  $('[data-remove-project]', node).addEventListener('click', () => node.remove());
  list.append(node);
}
$('#add-project').addEventListener('click', () => { addProjectRow(); $('#projects-list').lastElementChild?.querySelector('input')?.focus(); });

function setField(name, value) {
  const el = form.elements.namedItem(name);
  if (el) el.value = value ?? '';
}

function openForm(p = null) {
  state.editing = p;
  form.reset();
  $('#projects-list').replaceChildren();
  $('#form-error').hidden = true;
  $('#form-title').textContent = p ? 'Edita tu perfil' : 'Crea tu perfil';
  $('#form-eyebrow').textContent = p ? '// editar perfil' : `// ${state.event.name}`;
  $('#form-submit').textContent = p ? 'guardar' : 'publicar';
  $('#delete-profile').hidden = !p;
  $('#join-code-field').hidden = Boolean(p) || !state.event.requires_code;

  if (p) {
    for (const k of ['name', 'role', 'company', 'location', 'bio', 'avatar', 'looking_for', 'offering', 'extra']) setField(k, p[k]);
    for (const k of ['github', 'linkedin', 'x', 'web', 'email']) setField(`links.${k}`, p.links?.[k]);
    setField('tags', (p.tags || []).join(', '));
    (p.projects || []).forEach(addProjectRow);
  } else {
    const draft = store.get(`ew:draft:${state.slug}`);
    if (draft) {
      for (const [k, v] of Object.entries(draft)) if (typeof v === 'string') setField(k, v);
    }
  }
  if (!$('#projects-list').children.length) addProjectRow();
  $('#form-dialog').showModal();
  form.elements.namedItem('name').focus();
}

function readForm() {
  const f = (n) => form.elements.namedItem(n)?.value.trim() || '';
  return {
    name: f('name'), role: f('role'), company: f('company'), location: f('location'),
    bio: f('bio'), avatar: f('avatar'),
    links: { github: f('links.github'), linkedin: f('links.linkedin'), x: f('links.x'), web: f('links.web'), email: f('links.email') },
    tags: f('tags').split(',').map((s) => s.trim()).filter(Boolean),
    looking_for: f('looking_for'), offering: f('offering'), extra: f('extra'),
    projects: $$('.project-edit', form).map((n) => ({
      title: $('[data-f="title"]', n).value.trim(),
      url: $('[data-f="url"]', n).value.trim(),
      status: $('[data-f="status"]', n).value,
      stack: $('[data-f="stack"]', n).value.split(',').map((s) => s.trim()).filter(Boolean),
      description: $('[data-f="description"]', n).value.trim(),
    })).filter((x) => x.title),
  };
}

// borrador local mientras se escribe (solo al crear)
form.addEventListener('input', () => {
  if (state.editing) return;
  const draft = {};
  for (const el of form.elements) if (el.name && el.name !== 'join_code') draft[el.name] = el.value;
  store.set(`ew:draft:${state.slug}`, draft);
});

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const err = $('#form-error');
  err.hidden = true;
  const profile = readForm();
  if (profile.name.length < 2) {
    err.textContent = 'El nombre es obligatorio.';
    err.hidden = false;
    return form.elements.namedItem('name').focus();
  }
  const btn = $('#form-submit');
  btn.disabled = true;
  try {
    if (state.editing) {
      const my = mine();
      const { participant } = await api(`/api/events/${state.slug}/participants/${state.editing.id}`, {
        method: 'PUT', headers: { authorization: `Bearer ${my.token}` }, body: JSON.stringify({ profile }),
      });
      state.participants = state.participants.map((p) => (p.id === participant.id ? participant : p));
      $('#form-dialog').close();
      renderEvent();
      toast('Perfil actualizado.');
    } else {
      const { id, token, participant } = await api(`/api/events/${state.slug}/participants`, {
        method: 'POST', body: JSON.stringify({ profile, join_code: form.elements.namedItem('join_code').value }),
      });
      store.set(mineKey(), { id, token });
      store.del(`ew:draft:${state.slug}`);
      state.participants.push(participant);
      $('#form-dialog').close();
      renderEvent();
      $('#edit-link').value = `${location.origin}/e/${state.slug}#edit=${id}.${token}`;
      $('#token-dialog').showModal();
    }
  } catch (ex) {
    err.textContent = ex.message;
    err.hidden = false;
  } finally {
    btn.disabled = false;
  }
});

$('#delete-profile').addEventListener('click', async () => {
  if (!state.editing) return;
  if (!confirm('¿Borrar tu perfil de este muro? No se puede deshacer.')) return;
  try {
    const my = mine();
    await api(`/api/events/${state.slug}/participants/${state.editing.id}`, { method: 'DELETE', headers: { authorization: `Bearer ${my.token}` } });
    state.participants = state.participants.filter((p) => p.id !== state.editing.id);
    store.del(mineKey());
    $('#form-dialog').close();
    renderEvent();
    toast('Perfil borrado.');
  } catch (ex) {
    toast(ex.message);
  }
});

$('#copy-link').addEventListener('click', async () => {
  const input = $('#edit-link');
  try { await navigator.clipboard.writeText(input.value); toast('Enlace de edición copiado.'); }
  catch { input.select(); document.execCommand('copy'); }
});

// cerrar diálogos
$$('[data-close]').forEach((b) => b.addEventListener('click', () => b.closest('dialog').close()));
$$('dialog').forEach((d) => d.addEventListener('click', (e) => { if (e.target === d) d.close(); }));
$('#profile-dialog').addEventListener('close', () => {
  if (new URLSearchParams(location.search).has('p')) history.replaceState(null, '', location.pathname);
});

route();
