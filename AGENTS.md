# Instrucciones del proyecto

- Proyecto React 19, TypeScript, Vite y Tailwind CSS 4; usa pnpm. Es una aplicación de demostración sin backend ni pagos reales; parte de los datos persiste en localStorage.
- Desarrollo: `pnpm dev`. Compilación y verificación de tipos: `pnpm build`. Para validación visual, iniciar el servidor y ejecutar `node scripts/validate.mjs`; requiere Chromium de Playwright.
- Inspecciona primero los archivos relacionados con la tarea y reutiliza componentes, estilos y funciones existentes. Consulta `README.md` o `docs/design-system.md` cuando sean relevantes.
- Evita refactorizaciones y auditorías ajenas al pedido. Valida funcionalidad, accesibilidad y seguridad según el cambio; ejecuta pruebas proporcionales y evita repetir suites sin necesidad.
- Usa subagentes solo si el usuario los solicita o hay una justificación clara. Mantén las respuestas finales breves y muestra solo las partes relevantes de archivos o cambios.


# Stack tecnológico — Sistema de Cafeterías

**Frontend**
- React + TypeScript + Vite
- Tailwind CSS
- Zustand — Estado global.
- TanStack Query — Consultas, caché y sincronización.
- React Hook Form + Zod — Formularios y validaciones.

**Backend**
- Node.js + TypeScript
- Express — Framework para la API.
- Better Auth — Autenticación y sesiones.
- Socket.IO — Comunicación en tiempo real.
- Rate limiting — Protección contra solicitudes excesivas.

**Base de datos**
- PostgreSQL — Datos persistentes, ventas, stock y pedidos.

**Modo offline (planificado)**
- PWA + Service Worker — Funcionamiento sin conexión.
- IndexedDB + Dexie.js — Almacenamiento local.
- Sincronización de operaciones pendientes con el backend.

**Servicios e infraestructura**
- Cloudflare Pages — Hosting del frontend.
- Cloudflare R2 — Fotografías de productos.
- Railway Hobby — Backend y PostgreSQL.
- Resend — Correos electrónicos.
- Docker + Docker Compose — Contenedores.
- GitHub + pnpm — Versionado y dependencias.

**Principios**
- Arquitectura modular, segura y mantenible.
- Backend como fuente de verdad.
- Transacciones e idempotencia para ventas y pagos.
- Optimización de RAM, CPU y consultas SQL.
- Presupuesto objetivo de Railway: USD 5–10 mensuales.
- Primera instalación para una sola cafetería, con código reutilizable para un futuro SaaS.

**Importante:** este es el stack objetivo. Antes de implementar, revisar las dependencias y tecnologías existentes. No migrar ni reemplazar herramientas sin evaluar su impacto y compatibilidad.