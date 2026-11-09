# Carmela

React + TypeScript + Vite + Tailwind CSS 4 + Lucide + Motion. Gestor: pnpm.

## Ejecutar

```sh
pnpm install
pnpm dev
```

Abrir http://127.0.0.1:5173. Menú público: http://127.0.0.1:5173/#menu.

## Desarrollo con Docker

Con Docker Desktop abierto, desde la carpeta del proyecto ejecutá:

```sh
docker compose up --build
```

Abrí http://127.0.0.1:5174. Docker usa ese puerto para que pueda funcionar junto al servidor local en el 5173. Si necesitás otro, configurá `FRONTEND_PORT` antes de iniciar Compose (por ejemplo, en PowerShell: `$env:FRONTEND_PORT = "5175"`). Los cambios en el código se reflejan automáticamente; la primera ejecución descarga la imagen e instala las dependencias. Para detenerlo, presioná `Ctrl+C` y ejecutá `docker compose down`. Para iniciarlo en segundo plano usá `docker compose up -d --build`; sus registros se consultan con `docker compose logs -f frontend`.

Las dependencias de Linux se guardan en un volumen independiente de `node_modules` de Windows. Si se modifica `pnpm-lock.yaml`, reiniciá el servicio con `docker compose up --build` para actualizar las dependencias. La configuración habilita el seguimiento de archivos por sondeo para Windows y Docker Desktop.

Esta configuración es para desarrollo local. La aplicación sigue siendo una demostración sin servidor ni base de datos: sus datos permanecen en el `localStorage` del navegador.

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
- `src/styles/`: estilos generales y por área, importados en orden desde `src/main.tsx`.
- `docs/frontend-architecture.md`: mapa de responsabilidades del frontend.
- `docs/design-system.md`: decisiones visuales y alcance.
- `docs/arquitectura-objetivo.md`: arquitectura prevista, seguridad y etapas de implementación.
- `docs/costos-operacion.md`: presupuesto orientativo y controles para la infraestructura.

Las fotografías se sirven desde Unsplash y las fuentes desde Google Fonts; necesitan conexión. Las fechas y cifras son ilustrativas.
