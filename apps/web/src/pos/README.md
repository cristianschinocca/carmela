# Punto de venta

`../components/pos/TablePOS.tsx` coordina el estado compartido, la selección de mesas y los modales. Las funcionalidades principales se organizan así:

- `floorModel.ts`: tipos, persistencia inicial y reglas geométricas del plano.
- `useFloorEditor.ts`: alta, eliminación, selección y orden de mesas y sectores.
- `useFloorInteractions.ts`: arrastre, redimensionamiento y desplazamiento durante gestos.
- `useFloorLayout.ts`: ajuste del tablero a sus sectores y al tamaño de pantalla.
- `accountModel.ts` y `useTableAccount.ts`: artículos, precios, descuentos y traslados de la cuenta.
- `../components/pos/PosCatalog.tsx` y `../components/pos/PosAccountTicket.tsx`: selección de productos y presentación de la cuenta.
- `../components/pos/dialogs/`: modales para abrir, editar, trasladar y gestionar la cuenta.

Los datos de la demostración siguen guardándose en el navegador. La lógica de cobro y stock se coordina con `stock/settleSale.ts`.
