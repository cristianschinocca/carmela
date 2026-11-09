# Arquitectura objetivo

Esta es una propuesta para evolucionar la demostración hacia un sistema para cafeterías. Hoy la aplicación funciona en el navegador con datos locales: no cuenta con backend, base de datos ni autenticación de producción. Las tecnologías siguientes son objetivos, no una descripción de dependencias ya instaladas.

## Organización

- **Frontend:** React, TypeScript, Vite y Tailwind CSS; Zustand para estado compartido, TanStack Query para datos del servidor y React Hook Form con Zod para formularios.
- **API:** Node.js, TypeScript y Express, organizada como monolito modular. Better Auth administra las sesiones; Socket.IO se incorpora cuando una función necesite actualización en tiempo real.
- **Datos:** PostgreSQL es la fuente de verdad. La API y PostgreSQL se alojan en Railway, con la base de datos accesible por red privada.
- **Servicios:** Cloudflare Pages para el frontend estático, R2 para imágenes y Resend para correos. Docker Compose facilita el desarrollo local; pnpm y GitHub mantienen dependencias y código.

La primera instalación atiende una cafetería. Los límites entre módulos deben permitir incorporar más negocios después, sin agregar infraestructura distribuida antes de necesitarla. Antes de ofrecer múltiples negocios se debe implementar y probar el aislamiento de datos en cada operación.

La API separará rutas, validación, casos de uso y acceso a datos por dominio: autenticación y equipo, catálogo, mesas y ventas, caja, stock y reportes. El frontend conserva componentes de interfaz separados de las consultas y reglas de negocio. Los contratos de API deben estar tipados y versionados de forma compatible; las validaciones críticas siempre se repiten en el servidor.

## Operación y seguridad

- Autenticación y autorización en el servidor, con permisos por rol y usuario activo. El menú público solo expone datos publicados. Configurar HTTPS, cookies de sesión seguras y protección CSRF, además de restringir CORS y orígenes según los dominios reales.
- Los códigos de cuatro dígitos sirven para identificar acciones de empleados, no como contraseña principal. Al implementarlos, protegerlos en el servidor con una clave secreta y sal por empleado, limitar intentos y evitar registrarlos en logs o devolverlos en respuestas.
- Mantener secretos fuera del repositorio y del frontend; validar datos, tamaño y tipo de imágenes en el servidor y limitar solicitudes. Registrar errores y operaciones relevantes sin contraseñas, códigos ni datos sensibles.
- Las ventas, movimientos de caja y cambios de stock deben confirmarse mediante transacciones y controles de concurrencia. Calcular importes en unidades monetarias enteras y validar precios, descuentos y permisos en el servidor.
- Proteger operaciones reintentables con claves de idempotencia persistidas junto a la transacción. Una operación repetida con la misma clave y contenido devuelve su resultado anterior; una clave reutilizada con otros datos debe rechazarse.
- Las notificaciones de Socket.IO se emiten después de confirmar los cambios, a clientes autorizados. Al reconectar se consulta el estado actualizado; los eventos no reemplazan la base de datos.
- Preparar copias de seguridad, retención y pruebas de restauración antes de usar datos reales. Una copia de volumen puede tener costo adicional y no sustituye una prueba de recuperación.

## Rendimiento y disponibilidad

Empezar con una instancia de API y una base PostgreSQL, sin Redis ni workers separados hasta que las métricas lo justifiquen. Limitar y medir conexiones a la base, indexar consultas frecuentes, paginar historiales y evitar consultas repetidas. Usar caché de consultas en el frontend e invalidarla tras cambios; monitorear memoria, CPU, almacenamiento y errores. La disponibilidad y los costos deben medirse con el uso real del local.

## Modo offline posterior

PWA, Service Worker, IndexedDB y Dexie están planificados, no implementados. Antes de habilitar operaciones sin conexión se deben diseñar la cola persistente, identificadores de operación, reintentos idempotentes y resolución de conflictos de mesas y stock. La interfaz distinguirá una operación pendiente de otra confirmada por el servidor. No se debe presentar un cobro como confirmado por un proveedor de pagos sin esa confirmación. Evitar almacenar datos sensibles en cachés públicas.

## Etapas propuestas

1. Preparar API y PostgreSQL en desarrollo, migraciones, autenticación, permisos y pruebas.
2. Implementar mesas, ventas y caja con transacciones, concurrencia e idempotencia; definir una migración explícita de datos locales cuando corresponda.
3. Conectar catálogo, stock, equipo y reportes; validar que los cálculos compartan datos consistentes.
4. Desplegar una instalación, configurar copias y monitoreo, y medir recursos y gastos reales según [Costos de operación](costos-operacion.md).
5. Evaluar modo offline y, posteriormente, aislamiento y operación para múltiples cafeterías.
