# Integración con Helmcode

event.wall nació de una necesidad detectada en Café Helmcode: que los asistentes puedan encontrarse y continuar las conversaciones después del evento.

El proyecto se mantiene genérico. Helmcode es una integración y un tema, no una dependencia del core.

## Despliegue recomendado

La opción más sencilla es mantener event.wall como proyecto Cloudflare Pages independiente y exponerlo desde un subdominio o mediante proxy/rewrite.

Ejemplos:

- `community.helmcode.com/e/cafe-helmcode`
- `events.helmcode.com/e/cafe-helmcode`
- `helmcode.com/cafe/community` si la infraestructura permite proxy/rewrite.

## Branding

La interfaz usa un único sistema visual alineado con el brand kit público de Helmcode.

Los tokens están en `public/styles.css`: fondo cálido negro, superficies oscuras, Roboto/Roboto Mono, esquinas rectas, separadores finos y el índigo de marca como señal visual.

El logotipo se referencia desde el recurso SVG oficial de Helmcode; no se recrea ni recolorea.

## Infraestructura mínima

- Cloudflare Pages
- Cloudflare Pages Functions
- Cloudflare D1
- secreto `ADMIN_TOKEN`

No requiere servidor persistente, contenedores ni framework frontend.

## Operación recomendada

1. Crear el evento.
2. Abrir el muro unos días antes.
3. Mostrar la URL o QR durante el evento.
4. Mantener edición abierta unos días después.
5. Pasar a solo lectura.
6. Exportar JSON si hace falta conservar una copia.
7. Purgar perfiles cuando deje de ser necesario.

Para eventos abiertos públicamente, usar `join_code` y/o rate limiting de Cloudflare.

## Privacidad

Los perfiles son públicos por diseño. Los asistentes deben publicar voluntariamente sus datos y la interfaz debe indicar claramente qué campos serán visibles.

## Créditos

Proyecto original: [Javier Martín (@choruzo)](https://github.com/choruzo).

Licencia: MIT.
