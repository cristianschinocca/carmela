# API y bases de datos

`apps/api` expone Express y Better Auth. `packages/db` tiene dos esquemas, clientes y juegos de migraciones Prisma: uno central y otro operativo. La API verifica la sesión y la membresía antes de conectar con la base de una cafetería. El navegador nunca elige una URL de base de datos.

## Bases

- `carmela_control`: usuarios, cuentas, sesiones, cafeterías y membresías. Prisma y Better Auth usan el mismo cliente.
- `carmela_demo`: base operativa de Carmela en desarrollo. Su tabla `workspace_identity` vincula la base con una sola cafetería; ventas, stock y caja todavía no tienen tablas de servidor.

Cada clave `workspaces.database_key` debe corresponder a una variable `TENANT_DB_<CLAVE>_URL` configurada en la API. La clave se valida antes de abrir la conexión y la API comprueba que `workspace_identity.workspace_id` coincida con la cafetería autorizada. El rol global `admin` permite listar cafeterías; para entrar en una cafetería se requiere membresía explícita.

## Desarrollo con Docker

```sh
docker compose up -d --build
docker compose exec api pnpm --filter @mistro/db migrate:status
docker compose exec api pnpm --filter @mistro/api test
```

Para preparar una base operativa nueva, configurá `TENANT_DB_<CLAVE>_URL` en la API y aplicá **su** migración con la clave correspondiente. Después vinculala con una cafetería y un usuario existente:

```sh
docker compose exec -e TENANT_KEY=carmela api pnpm --filter @mistro/db migrate:tenant:deploy
docker compose exec api pnpm --filter @mistro/api workspace:provision carmela carmela dueño@ejemplo.com "Carmela"
```

El segundo comando es repetible: rechaza una base o clave ya vinculada a otra cafetería. Requiere acceso a la terminal del servidor y no se expone como registro público. Para futuras cafeterías se repite con otra clave y otra base PostgreSQL; no hace falta otra instancia de PostgreSQL. Ejecutá migraciones de cada base explícitamente antes de desplegar código que use el nuevo esquema.

En una base central recién creada, aplicar la migración con `docker compose exec api pnpm --filter @mistro/db migrate:deploy`. Si la base ya contenía las tablas de Better Auth y `workspaces` creadas por los scripts anteriores, **no** volver a ejecutar esa migración: marcarla una sola vez como aplicada con:

```sh
docker compose exec api pnpm --filter @mistro/db exec prisma migrate resolve --applied 20261115000000_baseline
```

Después de aplicar la migración, creá el primer administrador desde una terminal interactiva:

```sh
docker compose exec api pnpm --filter @mistro/api auth:create-admin --email vos@tucafe.com --name "Tu nombre" --role admin
```

El comando solicita la contraseña sin incluirla en el historial de la terminal. No uses `--force` salvo que quieras crear deliberadamente otro administrador. El registro público está deshabilitado: la creación de nuevas cuentas requiere permisos de administrador. La sesión se conserva en una cookie gestionada por Better Auth; el frontend no guarda contraseñas ni tokens en `localStorage`.

El primer administrador (`admin`) accede a **Superadmin** para crear usuarios comunes y pausar o eliminar sus cuentas. Al crear una cuenta se registra en la base central la marca, un identificador único para el futuro enlace del menú y la membresía de dueño. La clave interna de base reemplaza los guiones del identificador por guiones bajos (por ejemplo, `cafe-de-la-esquina` → `cafe_de_la_esquina`). La marca queda `pending` hasta preparar su base operativa y ejecutar `workspace:provision` con ese identificador, la clave interna y el mismo dueño; el comando la activa. El dominio público por cafetería todavía no está configurado. La sección **Equipo** y los códigos de fichaje aún son datos locales de demostración y no asignan roles operativos en el servidor.

En desarrollo fuera de Docker, configurá las variables de `apps/api/.env.example`, aplicá la migración y ejecutá `pnpm --filter @mistro/api auth:create-admin --email vos@tucafe.com --name "Tu nombre" --role admin`.

No se ejecutan migraciones en cada arranque del servidor; deben aplicarse explícitamente antes del despliegue. Para comparar el esquema de Better Auth con el de Prisma, `pnpm --filter @mistro/api auth:schema:reference` genera un archivo de referencia ignorado por Git.

## Reglas para los próximos módulos

- La API es la única fuente de verdad para nuevas operaciones. El frontend aún usa datos locales de demostración.
- Agregar modelos operativos por dominio en una migración propia, manteniendo la base de cada cafetería aislada de la central.
- Ventas, caja y stock deben confirmarse dentro de una misma base operativa mediante transacciones e idempotencia. No hacer transacciones entre distintas bases.
- Limitar conexiones por base, cerrar conexiones al apagar la API y mantener secretos fuera del repositorio.


### Códigos del equipo

En producción configurá `EMPLOYEE_PIN_PEPPER` con un secreto independiente de al menos 32 caracteres y conservá una copia segura. Es necesario para verificar unicidad de los PIN sin guardarlos en claro. Cambiarlo requiere restablecer los PIN existentes. En desarrollo, si no se configura, se usa `BETTER_AUTH_SECRET`. Los PIN se almacenan con sal y scrypt; todavía falta conectar su verificación con fichaje y POS.
