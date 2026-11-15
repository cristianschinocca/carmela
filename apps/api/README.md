# API y bases de datos

`apps/api` expone Express y Better Auth. `packages/db` contiene el cliente Prisma central, el esquema y las migraciones. La API verifica la sesión y la membresía antes de conectar con la base operativa de una cafetería. El navegador nunca elige una URL de base de datos.

## Bases

- `carmela_control`: usuarios, cuentas, sesiones, cafeterías y membresías. Prisma y Better Auth usan el mismo cliente.
- `carmela_demo`: base operativa de Carmela en desarrollo. Todavía no tiene tablas de ventas, stock o caja en el servidor. Su conexión está preparada en `packages/db/src/tenant.ts`.

Cada clave `workspaces.database_key` debe corresponder a una variable `TENANT_DB_<CLAVE>_URL` configurada en la API. La clave se valida antes de abrir la conexión. El rol global `admin` permite listar cafeterías; para entrar en una cafetería se requiere membresía explícita.

## Desarrollo con Docker

```sh
docker compose up -d --build
docker compose exec api pnpm --filter @carmela/db migrate:status
docker compose exec api pnpm --filter @carmela/api test
```

En una base central recién creada, aplicar la migración con `docker compose exec api pnpm --filter @carmela/db migrate:deploy`. Si la base ya contenía las tablas de Better Auth y `workspaces` creadas por los scripts anteriores, **no** volver a ejecutar esa migración: marcarla una sola vez como aplicada con:

```sh
docker compose exec api pnpm --filter @carmela/db exec prisma migrate resolve --applied 20261115000000_baseline
```

Después se puede crear el primer superadministrador con Better Auth. No se ejecutan migraciones en cada arranque del servidor; deben aplicarse explícitamente antes del despliegue. Para comparar el esquema de Better Auth con el de Prisma, `pnpm --filter @carmela/api auth:schema:reference` genera un archivo de referencia ignorado por Git.

## Reglas para los próximos módulos

- La API es la única fuente de verdad para nuevas operaciones. El frontend aún usa datos locales de demostración.
- Agregar modelos operativos por dominio en una migración propia, manteniendo la base de cada cafetería aislada de la central.
- Ventas, caja y stock deben confirmarse dentro de una misma base operativa mediante transacciones e idempotencia. No hacer transacciones entre distintas bases.
- Limitar conexiones por base, cerrar conexiones al apagar la API y mantener secretos fuera del repositorio.
