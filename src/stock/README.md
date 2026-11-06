# Catálogo de stock

Esta etapa administra insumos, proveedores y recetas en el navegador. El stock de productos terminados conserva su flujo anterior.

- `types.ts`: entidades y unidades. Una receta corresponde a una unidad de un producto del catálogo del POS; las cantidades usan la unidad del insumo.
- `domain.ts`: reglas compartidas y presentación de cantidades.
- `repository.ts`: contrato asíncrono de lectura y escritura; el adaptador actual usa `localStorage`.
- `useStockCatalog.ts`: carga, guardado y errores; `StockWorkspace` organiza las secciones.
- `components/`: pantallas y formularios sin acceso directo al almacenamiento.

Las recetas almacenan el identificador del producto, sin copiar su catálogo. No se permite eliminar un insumo usado en recetas, cambiar su unidad mientras esté vinculado, ni eliminar un proveedor asociado a insumos. Si se elimina un producto desde el POS, su receta se identifica como pendiente de actualizar.

La cantidad de insumos se carga manualmente en esta etapa. Las ventas todavía no descuentan ingredientes; los movimientos, el historial, las compras y los reportes de insumos se implementarán en etapas posteriores. El contrato del repositorio permite reemplazar el adaptador, pero un backend deberá aportar validación, concurrencia y operaciones transaccionales.
