# Mistro

Mistro es un sistema para cafeterías en un monorepo pnpm. Carmela es la cafetería de demostración. La interfaz sigue siendo una demostración con datos en el navegador; la API y las bases ya están separadas para conectar cada módulo gradualmente.

## Estructura

| Carpeta | Responsabilidad |
| --- | --- |
| `apps/web` | React, Vite, TypeScript y Tailwind. Dashboard, POS y menú público. |
| `apps/api` | Express y Better Auth. Sesiones, autorización y rutas HTTP. Es el único proceso que accede a las bases. |
| `packages/db` | Prisma de la base central, migraciones y conexiones a las bases de cada cafetería. |
| `scripts` | Validaciones de la interfaz con Playwright. |
| `docs` | Decisiones de arquitectura, frontend y operación. |

```
apps/web ──HTTP──▶ apps/api ──▶ carmela_control (usuarios, sesiones, cafeterías)
                            └──▶ carmela_demo (datos operativos de Carmela)
```

Los nombres `carmela_control` y `carmela_demo` son identificadores existentes de desarrollo y no cambian con la marca del sistema. La base central contiene usuarios y membresías. Cada cafetería tendrá una base operativa propia; la API obtiene su conexión a partir de la membresía autorizada. En Docker ambas bases lógicas viven en un mismo PostgreSQL para ahorrar recursos. Prisma gestiona la base central. Cuando se implementen ventas, stock y caja en el servidor, sus modelos y migraciones se agregarán por dominio en `packages/db`, sin mezclar datos de cafeterías.

## Desarrollo

Requisitos: Node 24, pnpm 12 y Docker Desktop.

```sh
pnpm install
pnpm --filter @mistro/db generate
pnpm dev
```

El frontend local abre en http://127.0.0.1:5173. Para iniciar API, PostgreSQL y frontend juntos:

```sh
docker compose up -d --build
```

El frontend de Docker abre en http://127.0.0.1:5174 y la API en http://127.0.0.1:3001. `FRONTEND_PORT` y `API_PORT` permiten cambiar los puertos publicados. Las credenciales y secretos de `compose.yaml` son solo para desarrollo.

## Base central

La migración inicial está en `packages/db/prisma/migrations`. Docker Compose la aplica al iniciar la API. Fuera de Docker, en una base **nueva** se aplica con `pnpm --filter @mistro/db migrate:deploy` y `CONTROL_DATABASE_URL` configurada. Si la base ya fue creada con los scripts anteriores, primero se marca esa migración como aplicada con `prisma migrate resolve --applied 20261115000000_baseline`; no se vuelve a ejecutar el SQL sobre tablas existentes. Ver [guía de API y datos](apps/api/README.md).

Better Auth usa el cliente Prisma central. El login visible en el frontend aún es de demostración y no autentica contra la API. No hay pagos reales ni datos compartidos entre dispositivos. Antes de usar datos reales faltan permisos por módulo, migraciones de las bases operativas, pruebas de concurrencia y copias de seguridad.

## Verificación

```sh
pnpm build
docker compose exec api pnpm --filter @mistro/api test
```

Las pruebas visuales de `scripts/` requieren el frontend y Chromium de Playwright. Más detalles en [arquitectura objetivo](docs/arquitectura-objetivo.md).
