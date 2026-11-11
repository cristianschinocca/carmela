# Instrucciones del proyecto

- Proyecto React 19, TypeScript, Vite y Tailwind CSS 4; usa pnpm. Actualmente es una aplicación de demostración sin backend ni pagos reales; parte de los datos persiste en localStorage.
- Desarrollo: `pnpm dev`. Compilación y verificación de tipos: `pnpm build`. Para validación visual, iniciar el servidor y ejecutar `node scripts/validate.mjs`; requiere Chromium de Playwright.
- Inspecciona primero los archivos relacionados con la tarea y reutiliza componentes, estilos y funciones existentes. Consulta `README.md` o `docs/design-system.md` cuando sean relevantes.
- Evita refactorizaciones y auditorías ajenas al pedido. Valida funcionalidad, accesibilidad y seguridad según el cambio; ejecuta pruebas proporcionales y evita repetir suites sin necesidad.
- Usa subagentes solo si el usuario los solicita o hay una justificación clara. Mantén las respuestas finales breves y muestra solo las partes relevantes de archivos o cambios.

## Uso de skills y herramientas

### Ponytail — Simplicidad y arquitectura

- Aplica los principios de Ponytail para evitar sobreingeniería, abstracciones innecesarias, duplicación de código y dependencias injustificadas.
- Prioriza soluciones simples, legibles, modulares y fáciles de mantener.
- No reduzcas código únicamente para disminuir la cantidad de líneas.
- **No apliques criterios de simplificación de Ponytail sobre mecanismos críticos de seguridad**, autenticación, autorización, aislamiento de datos, validaciones, transacciones, pagos, idempotencia o integridad de la información.
- En componentes críticos, prioriza corrección, seguridad, robustez y pruebas por encima de la simplicidad.
- No elimines controles, validaciones, manejo de errores ni mecanismos de recuperación para simplificar implementaciones.
- Utiliza Ponytail cuando aporte valor real, evitando invocaciones innecesarias.

### shadcn/ui — Componentes

- Prioriza componentes de shadcn/ui para nuevas interfaces cuando sean adecuados.
- Reutiliza los componentes ya instalados antes de agregar otros.
- Mantén compatibilidad con React 19, TypeScript y Tailwind CSS 4.
- Respeta los estilos, tokens, variantes y convenciones existentes.
- Evita instalar dependencias o componentes innecesarios.
- No reemplaces componentes funcionales existentes únicamente para adoptar shadcn/ui.

### Impeccable — Diseño y experiencia de usuario

- Utiliza los principios de Impeccable para mejorar la calidad visual, consistencia y usabilidad de las interfaces.
- Prioriza jerarquía visual, tipografía, espaciado, contraste, accesibilidad y diseño responsive.
- Mantén una estética profesional, moderna, minimalista y consistente.
- Evita interfaces genéricas, decoraciones excesivas y animaciones innecesarias.
- Diseña pensando en el uso intensivo del sistema por empleados y administradores.
- En el POS, prioriza velocidad operativa, claridad y facilidad de interacción.
- Utiliza Impeccable especialmente en tareas de diseño, rediseño o revisión visual, sin ejecutar auditorías completas cuando no sean necesarias.
- No modifiques lógica de negocio para resolver problemas puramente visuales.

### Prioridades generales

1. Seguridad e integridad de los datos.
2. Correctitud funcional y reglas de negocio.
3. Mantenibilidad y arquitectura modular.
4. Rendimiento y consumo eficiente de recursos.
5. Accesibilidad y experiencia de usuario.
6. Simplicidad y reducción de complejidad innecesaria.

Las skills son herramientas complementarias, no reglas absolutas. Nunca deben prevalecer sobre los requisitos funcionales, las decisiones arquitectónicas justificadas ni las medidas de seguridad.

# Stack tecnológico — Sistema de Cafeterías

## Frontend

- React 19 + TypeScript + Vite.
- Tailwind CSS 4.
- shadcn/ui — Componentes de interfaz.
- Zustand — Estado global.
- TanStack Query — Consultas, caché y sincronización.
- React Hook Form + Zod — Formularios y validaciones.

## Backend

- Node.js + TypeScript.
- Express — Framework para la API.
- Better Auth — Autenticación y sesiones.
- Socket.IO — Comunicación en tiempo real.
- Rate limiting — Protección contra solicitudes excesivas.

## Base de datos

- PostgreSQL — Datos persistentes, ventas, stock y pedidos.

## Modo offline (planificado)

- PWA + Service Worker — Funcionamiento sin conexión.
- IndexedDB + Dexie.js — Almacenamiento local.
- Sincronización de operaciones pendientes con el backend.

## Servicios e infraestructura

- Cloudflare Pages — Hosting del frontend.
- Cloudflare R2 — Fotografías de productos.
- Railway Hobby — Backend y PostgreSQL.
- Resend — Correos electrónicos.
- Docker + Docker Compose — Contenedores.
- GitHub + pnpm — Versionado y dependencias.

## Principios

- Arquitectura modular, segura y mantenible.
- Backend como fuente de verdad.
- Transacciones e idempotencia para ventas y pagos.
- Optimización de RAM, CPU y consultas SQL.
- Evitar consultas innecesarias, procesos persistentes injustificados y consumo excesivo de recursos.
- Presupuesto objetivo de Railway: USD 5–10 mensuales.
- Primera instalación para una sola cafetería, con código reutilizable para un futuro SaaS.
- Priorizar soluciones que funcionen correctamente antes de introducir complejidad para escalabilidad futura.
- Mantener separadas las responsabilidades del frontend, backend y base de datos.

**Importante:** este es el stack objetivo. Antes de implementar, revisar las dependencias y tecnologías existentes. No migrar ni reemplazar herramientas sin evaluar su impacto y compatibilidad.