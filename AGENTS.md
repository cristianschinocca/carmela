# Instrucciones del proyecto

- Proyecto React 19, TypeScript, Vite y Tailwind CSS 4; usa pnpm. Es una aplicación de demostración sin backend ni pagos reales; parte de los datos persiste en localStorage.
- Desarrollo: `pnpm dev`. Compilación y verificación de tipos: `pnpm build`. Para validación visual, iniciar el servidor y ejecutar `node scripts/validate.mjs`; requiere Chromium de Playwright.
- Inspecciona primero los archivos relacionados con la tarea y reutiliza componentes, estilos y funciones existentes. Consulta `README.md` o `docs/design-system.md` cuando sean relevantes.
- Evita refactorizaciones y auditorías ajenas al pedido. Valida funcionalidad, accesibilidad y seguridad según el cambio; ejecuta pruebas proporcionales y evita repetir suites sin necesidad.
- Usa subagentes solo si el usuario los solicita o hay una justificación clara. Mantén las respuestas finales breves y muestra solo las partes relevantes de archivos o cambios.