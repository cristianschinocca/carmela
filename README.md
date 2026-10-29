# Carmela

React + TypeScript + Vite + Tailwind CSS 4 + Lucide + Motion. Gestor: pnpm.

## Ejecutar

```sh
pnpm install
pnpm dev
```

Abrir http://127.0.0.1:5173. Menú público: http://127.0.0.1:5173/#menu.

```sh
pnpm build
pnpm exec playwright install chromium
node scripts/validate.mjs
```

La validación requiere el servidor de desarrollo activo. Capturas en `artifacts/`.

## Alcance

Resumen, POS interactivo, catálogo, pedidos, caja, menú digital, reportes, equipo y preferencias. La gestión de productos permite crear, editar, ocultar, eliminar y reordenar; las categorías pueden crearse, renombrarse y eliminarse cuando no tienen productos. El módulo Equipo administra usuarios con roles de cajero, mozo, barista, encargado y propietario, junto con PIN de cuatro cifras y fichajes de entrada/salida. Productos, categorías, equipo y fichajes persisten en `localStorage`. No hay backend, pagos reales, publicación ni QR de producción.

## Organización

- `src/main.tsx`: punto de entrada; monta React y los proveedores globales.
- `src/App.tsx`: estado y navegación del dashboard de gestión.
- `src/components/TablePOS.tsx`: interacción de mesas, comandas y cobros.
- `src/components/PosCatalog.tsx`: búsqueda, categorías, colores y ubicación de productos del POS.
- `src/components/PosAccountTicket.tsx`: artículos, acciones y totales de la cuenta.
- `src/components/PosPaymentDialog.tsx`: elección del medio de pago y confirmación del cobro.
- `src/components/pos-dialogs/`: modales de empleado, cubiertos, código y edición de mesa.
- `src/pos/floorModel.ts`: tipos, distribución, límites y carga de mesas y sectores.
- `src/pos/catalogLayout.ts`: colores y reglas de ordenamiento en la grilla del POS.
- `src/pos/table-pos.css`: estilos del modal de cuenta y del catálogo del POS.
- `src/components/PublicMenu.tsx`: experiencia pública del menú digital, aislada del dashboard.
- `src/hooks/useDashboardTheme.ts`: persistencia del tema del dashboard y separación del tema público.
- `src/components/Operations.tsx`: métricas y tabla de pedidos compartidas.
- `src/components/ProductManager.tsx`: catálogo, editor, ordenamiento y categorías.
- `src/components/TeamManager.tsx`: usuarios, roles, códigos e historial de fichajes.
- `src/data.ts`: datos y fotografías de demostración.
- `src/motion.tsx`: tokens, variantes, proveedor y componentes animados compartidos.
- `src/styles.css`: estilos generales, temas y componentes compartidos.
- `docs/design-system.md`: decisiones visuales y alcance.

Las fotografías se sirven desde Unsplash y las fuentes desde Google Fonts; necesitan conexión. Las fechas y cifras son ilustrativas.
