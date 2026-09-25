# event.wall

Muros temporales de participantes para eventos tech: meetups, cafés, hackathons y comunidades.

**Demo:** https://event-wall-4bq.pages.dev/e/cafe-helmcode

Cada evento vive en `/e/<slug>` y dispone de una ventana temporal configurable para crear y editar perfiles. Al cerrarse, el muro queda en modo solo lectura.

## Características

- Perfiles con bio, enlaces, proyectos, tags, qué buscan y qué ofrecen.
- Sin cuentas: cada perfil recibe un enlace secreto de edición.
- Tokens aleatorios de 192 bits; en D1 solo se almacena su hash SHA-256.
- Código de acceso opcional por evento.
- Ventanas de apertura y cierre configurables.
- Modo solo lectura al cerrar el muro.
- Exportación JSON y moderación/admin.
- Temas independientes por evento: `helmcode` y `nan`.
- Frontend sin framework ni paso de build.

## Stack

- Cloudflare Pages
- Cloudflare Pages Functions
- Cloudflare D1 (SQLite)
- JavaScript / HTML / CSS

```text
public/             frontend estático
functions/api/      API
src/lib.js          validación, hashing y utilidades
migrations/         migraciones D1
examples/           datos de ejemplo opcionales
docs/               documentación de integración
schema.sql          bootstrap inicial no destructivo
wrangler.toml
```

## Desarrollo local

```bash
npm install
npm run db:init:local
npm run db:seed:cafe:local
npm run dev
```

Demo local: `http://localhost:8788/e/cafe-helmcode`

## Despliegue en Cloudflare

```bash
npx wrangler login
npx wrangler d1 create event-wall
```

Copia el `database_id` en `wrangler.toml` y después:

```bash
npm run db:init:remote
npx wrangler pages project create event-wall --production-branch main
npx wrangler pages secret put ADMIN_TOKEN --project-name event-wall
npm run deploy
```

Para cambios posteriores de esquema:

```bash
npm run db:migrate:remote
```

> `schema.sql` no contiene `DROP TABLE`. Las evoluciones posteriores deben hacerse mediante `migrations/`.

## Crear o actualizar un evento

```bash
curl -X POST https://eventos.tudominio.com/api/admin/events \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "content-type: application/json" \
  -d '{
    "slug": "cafe-helmcode-octubre",
    "name": "Café Helmcode",
    "tagline": "Inferencia, open models y café.",
    "description": "Deja tu perfil y enseña en qué estás trabajando.",
    "location": "Madrid",
    "organizer": "Helmcode",
    "url": "https://helmcode.com/es",
    "event_date": "2026-10-20T18:00:00+02:00",
    "default_theme": "helmcode",
    "join_code": "cafe2026"
  }'
```

Sin `opens_at`/`closes_at`, el muro abre tres días antes y cierra siete días después.

## API

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| GET | `/api/events` | — | Lista eventos |
| GET | `/api/events/:slug` | — | Evento + perfiles / export JSON |
| POST | `/api/events/:slug/participants` | código si existe | Crea perfil |
| GET | `/api/events/:slug/participants/:id` | — | Obtiene perfil |
| PUT | `/api/events/:slug/participants/:id` | token | Edita perfil |
| DELETE | `/api/events/:slug/participants/:id` | propietario/admin | Borra perfil |
| POST | `/api/admin/events` | admin | Crea/actualiza evento |
| DELETE | `/api/admin/events/:slug` | admin | Borra evento |

## Seguridad y privacidad

- El contenido de usuario se renderiza como texto.
- CSP restrictiva en `public/_headers`.
- Validación de longitudes y URLs en servidor.
- Tokens de edición de 192 bits y hash SHA-256.
- Los perfiles son públicos por diseño.
- El email es opcional y la interfaz avisa de su visibilidad.
- Para tráfico abierto, usa `join_code` y/o rate limiting de Cloudflare.

## Temas

Cada evento define `default_theme`. Los tokens visuales están en `public/styles.css`.

El core de event.wall es independiente del branding de cada comunidad.

## Helmcode

La demo original nació para Café Helmcode. La guía específica de integración está en [docs/HELMCODE.md](docs/HELMCODE.md).

## Licencia

MIT. Consulta [LICENSE](LICENSE).

---

Creado por [Javier Martín (@choruzo)](https://github.com/choruzo).
