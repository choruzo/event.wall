# Self-hosting event.wall

event.wall puede desplegarse de dos maneras:

1. **Tal cual, usando Cloudflare Pages + Pages Functions + D1**
2. **Integrado en la infraestructura existente de Helmcode**, reutilizando el frontend y manteniendo el mismo contrato de API

El frontend no depende de un framework y está separado del backend. Esto permite mover el proyecto sin obligar a mantener el despliegue original.

---

## Opción A — Desplegarlo en vuestra propia cuenta de Cloudflare

Es la opción más rápida si queréis mantener la arquitectura actual.

### Requisitos

- Cuenta de Cloudflare
- Cloudflare Pages
- Cloudflare D1
- Node.js + npm
- Wrangler

### 1. Clonar el repositorio

```bash
git clone https://github.com/choruzo/event.wall.git
cd event.wall
npm install
```

### 2. Crear la base D1

```bash
npx wrangler login
npx wrangler d1 create event-wall
```

Cloudflare devolverá un `database_id`.

Editad `wrangler.toml`:

```toml
name = "event-wall"
compatibility_date = "2026-09-01"
pages_build_output_dir = "public"

[[d1_databases]]
binding = "DB"
database_name = "event-wall"
database_id = "VUESTRO_DATABASE_ID"
```

### 3. Inicializar la base de datos

Para una instalación nueva:

```bash
npm run db:init:remote
```

No es necesario ejecutar el seed de Café Helmcode salvo que queráis cargar el ejemplo.

### 4. Crear el proyecto Pages

```bash
npx wrangler pages project create event-wall --production-branch main
```

### 5. Configurar el token de administración

Generad un token:

```bash
openssl rand -hex 32
```

Guardadlo como secreto de Pages:

```bash
npx wrangler pages secret put ADMIN_TOKEN --project-name event-wall
```

### 6. Desplegar

```bash
npm run check
npm run deploy
```

Después podéis asociar un dominio propio desde Cloudflare Pages, por ejemplo:

```text
events.helmcode.com
community.helmcode.com
```

En este modelo, el proyecto queda completamente bajo vuestra cuenta y no depende de la infraestructura del autor original.

---

## Opción B — Integrarlo directamente en vuestra infraestructura

Si no queréis usar Cloudflare Pages / Functions / D1, también se puede integrar event.wall dentro del stack actual de Helmcode.

La separación del proyecto es:

```text
public/             frontend estático
functions/api/      API actual en Cloudflare Pages Functions
src/lib.js          validación y utilidades compartidas
schema.sql          esquema SQL de referencia
```

### Frontend

El contenido de `public/` puede servirse desde cualquier servidor web o integrarse dentro de vuestro frontend.

El frontend consume rutas bajo:

```text
/api/...
```

Mientras esas rutas mantengan el mismo contrato JSON, no importa si el backend está implementado con:

- Node.js / Express / Fastify
- Next.js
- Python / FastAPI
- Go
- PHP
- otro framework o plataforma interna

### Contrato de API

El frontend espera estas rutas:

```text
GET    /api/events
GET    /api/events/:slug
POST   /api/events/:slug/participants
GET    /api/events/:slug/participants/:id
PUT    /api/events/:slug/participants/:id
DELETE /api/events/:slug/participants/:id

POST   /api/admin/events
DELETE /api/admin/events/:slug
```

Si se conservan los mismos campos y respuestas JSON, el frontend no necesita cambios relevantes.

---

## Persistencia

Actualmente se usa Cloudflare D1, pero el modelo es SQL sencillo.

Tablas principales:

```text
events
participants
```

El esquema está documentado en:

```text
schema.sql
migrations/
```

Puede migrarse a:

- PostgreSQL
- MySQL / MariaDB
- SQLite
- cualquier base relacional equivalente

La única condición es mantener la misma lógica de eventos, participantes y hashes de tokens.

---

## Autenticación

event.wall no usa cuentas de usuario.

Cada participante recibe un token aleatorio de edición y en base de datos solo se guarda su SHA-256.

La administración usa:

```text
Authorization: Bearer <ADMIN_TOKEN>
```

Si Helmcode ya tiene autenticación propia, esta capa puede sustituirse por vuestro sistema interno.

---

## Integrarlo dentro de helmcode.com

Si queréis que forme parte real de la web y no sea una aplicación separada, una estructura posible sería:

```text
helmcode.com/events
helmcode.com/events/cafe-helmcode
```

En ese caso podéis:

1. reutilizar la UI de `public/`,
2. adaptar las llamadas a vuestra API,
3. almacenar los datos en vuestra base,
4. aplicar vuestra autenticación o moderación,
5. mantener el diseño actual alineado con el brand kit de Helmcode.

No es necesario usar reverse proxy ni mantener un dominio Pages visible.

---

## Qué conviene mantener

Aunque se cambie de infraestructura, conviene conservar:

- saneado y validación de perfiles,
- tokens de edición aleatorios,
- almacenamiento de hashes en lugar de tokens en claro,
- CSP y cabeceras de seguridad,
- límite de tamaño para cuerpos JSON,
- control temporal de apertura/cierre,
- modo solo lectura al cerrar el muro.

---

## Resumen

Si queréis **cero fricción**, desplegad el repo en vuestra propia cuenta de Cloudflare.

Si queréis **integración total con helmcode.com**, reutilizad el frontend y portad las rutas de `functions/api/` a vuestro backend manteniendo el mismo contrato.

El proyecto está pensado para soportar ambas opciones.
