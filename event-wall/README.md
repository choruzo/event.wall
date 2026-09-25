# event.wall

Muros temporales de participantes para eventos tech (meetups, cafés, hackathons). Cada evento tiene su muro en `/e/<slug>`:

- **Abre 3 días antes** del evento y **dura 7 días** (fechas configurables).
- Mientras está abierto, cada participante crea su perfil: bio, enlaces, proyectos, tags, qué busca y qué ofrece, y un texto libre.
- Al cerrarse queda en **solo lectura**. Después puedes exportarlo a JSON y purgarlo.
- Sin cuentas: al crear un perfil se genera un **enlace de edición secreto** (`/e/<slug>#edit=<id>.<token>`). El navegador lo recuerda y el participante puede guardarlo para usarlo en otro dispositivo. En la base de datos solo se guarda el hash SHA-256 del token.
- Dos temas, **helmcode** y **nan**, con selector en la cabecera. Cada evento define su tema por defecto.

Stack: Cloudflare Pages (estáticos) + Pages Functions (API) + D1 (SQLite). No tiene dependencias en el frontend ni paso de build.

```
public/            HTML, CSS y JS estáticos (+ _redirects, _headers con CSP)
functions/api/     API (Pages Functions)
src/lib.js         utilidades: validación, hashing, ventana temporal
schema.sql         esquema D1 + evento de ejemplo (cafe-helmcode)
wrangler.toml
```

## Despliegue en Cloudflare

```bash
npm install
npx wrangler login

# 1. Base de datos
npx wrangler d1 create event-wall        # copia el database_id en wrangler.toml
npm run db:init:remote                   # crea las tablas y el evento de ejemplo

# 2. Proyecto Pages + secreto de admin
npx wrangler pages project create event-wall --production-branch main
npx wrangler pages secret put ADMIN_TOKEN --project-name event-wall   # p. ej. openssl rand -hex 32

# 3. Deploy
npm run deploy
```

Para tu dominio: en Workers & Pages → event-wall → *Custom domains*, añade p. ej. `eventos.tudominio.com`.

La primera vez, comprueba en el panel (Settings → Bindings) que el binding `DB` apunta a la D1. Wrangler lo toma de `wrangler.toml`.

También puedes conectar el repositorio de GitHub a Pages (sin build command y con output `public`). Las Functions y `wrangler.toml` se detectan solos.

## Desarrollo local

```bash
npm run db:init:local
npx wrangler pages dev --binding ADMIN_TOKEN=devadmin
# http://localhost:8788/e/cafe-helmcode
```

## Crear un evento

```bash
curl -X POST https://eventos.tudominio.com/api/admin/events \
  -H "Authorization: Bearer $ADMIN_TOKEN" -H "content-type: application/json" \
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

- Sin `opens_at`/`closes_at`, el muro abre `event_date - 3 días` y cierra 7 días después. Si quieres otras fechas, pásalas en ISO 8601.
- `join_code` (opcional) exige un código para crear perfiles. Puedes enseñarlo en una slide o en un QR durante el evento para evitar spam. Si mandas `""`, se elimina el código.
- Llamar de nuevo con el mismo `slug` actualiza el evento.

## API

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| GET | `/api/events` | — | Lista de eventos con su estado y número de participantes |
| GET | `/api/events/:slug` | — | Evento + perfiles (también sirve de export JSON) |
| POST | `/api/events/:slug/participants` | código del evento, si lo tiene | Crea un perfil → `{ id, token }` |
| GET | `/api/events/:slug/participants/:id` | — | Un perfil |
| PUT | `/api/events/:slug/participants/:id` | `Bearer <token>` | Edita un perfil (solo con el muro abierto) |
| DELETE | `/api/events/:slug/participants/:id` | `Bearer <token>` o admin | Borra un perfil (el propietario puede hacerlo siempre) |
| POST | `/api/admin/events` | admin | Crea o actualiza un evento |
| DELETE | `/api/admin/events/:slug` | admin | Borra el evento y todos sus perfiles |

Moderar un perfil concreto:

```bash
curl -X DELETE https://eventos.tudominio.com/api/events/<slug>/participants/<id> -H "Authorization: Bearer $ADMIN_TOKEN"
```

## Seguridad y privacidad

- Todo el contenido de los usuarios se pinta como texto (sin `innerHTML`). La CSP no permite scripts ni estilos inline.
- Validación en el servidor: longitudes máximas, solo URLs `http(s)`, handles saneados y como mucho 6 proyectos y 12 tags.
- Tokens de edición aleatorios de 192 bits, guardados con hash SHA-256 y comparados en tiempo constante.
- Los datos son públicos por diseño. El email es opcional y el formulario avisa de que será visible para todos.
- Para limpiar tras el evento: exporta (`/api/events/:slug`) y ejecuta `DELETE /api/admin/events/:slug`.
- Si esperas tráfico abierto, añade una regla de *Rate limiting* de Cloudflare para `POST /api/events/*` o usa `join_code`.

## Personalizar temas

Los tokens están en `public/styles.css`, bajo `[data-theme="helmcode"]` y `[data-theme="nan"]`. Para añadir un tema, copia un bloque, cambia las variables y añade un botón `data-set-theme` en `index.html`.
