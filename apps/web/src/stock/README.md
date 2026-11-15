# Catálogo de stock

Esta etapa administra insumos, proveedores y recetas en el navegador. El stock de productos terminados conserva su flujo anterior.

- `types.ts`: entidades y unidades. Una receta corresponde a una unidad de un producto del POS; cada ingrediente puede usar una unidad compatible con la de su inventario.
- `domain.ts`: reglas compartidas, conversiones entre kg/g y l/ml y presentación de cantidades. Las unidades no se convierten a masa ni volumen.
- `repository.ts`: contrato asíncrono de lectura y escritura; el adaptador actual usa `localStorage`.
- `useStockCatalog.ts`: carga, guardado y errores; `StockWorkspace` organiza las secciones.
- `components/`: pantallas y formularios sin acceso directo al almacenamiento.

Las recetas almacenan el identificador del producto, sin copiar su catálogo. No se permite eliminar un insumo usado en recetas, cambiar su unidad mientras esté vinculado, ni eliminar un proveedor asociado a insumos. Si se elimina un producto desde el POS, su receta se identifica como pendiente de actualizar.

Las líneas antiguas sin unidad propia conservan la unidad del insumo: no se modifican ni se reinterpretan al cargar. Por ejemplo, una receta que ya indica 200 kg seguirá indicando 200 kg y debe corregirse manualmente si se pretendía ingresar 200 g.

Al cobrar una venta se descuentan los insumos de sus recetas, convirtiendo unidades compatibles. Se permite stock negativo para reflejar diferencias sin impedir el cobro y se guardan los identificadores de ventas aplicadas para evitar descuentos repetidos. El stock de productos terminados sigue siendo independiente. Los movimientos, el historial, las compras y los reportes de insumos se implementarán en etapas posteriores.

Productos muestra la cantidad teórica de unidades completas según el insumo más limitante. El conteo manual se muestra por separado y no se suma: representa productos terminados, no una reserva de insumos. Un mínimo configurado genera alerta cuando cualquiera de los dos controles disponibles llega a ese valor. El cálculo por receta no reserva ingredientes compartidos ni modifica por sí solo la disponibilidad en el POS.

La persistencia actual funciona en un solo navegador. Su restauración ante errores es de mejor esfuerzo: `localStorage` no ofrece transacciones entre claves ni garantiza concurrencia entre pestañas o dispositivos. Antes del uso real, el backend debe confirmar venta, insumos y stock de productos en una única transacción con idempotencia y control de concurrencia.
