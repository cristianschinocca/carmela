# Estructura del frontend

- `src/App.tsx`: composición de pantallas, estado compartido y navegación de la demostración.
- `src/features/shell/`: navegación y estructura visible en todas las pantallas internas.
- `src/features/dashboard/`, `menu/`, `settings/`: pantallas administrativas con sus propias dependencias y props explícitas.
- `src/components/`: módulos funcionales existentes (POS, productos, equipo, caja, menú público). Se mantienen sus contratos para evitar regresiones.
- `src/pos/` y `src/stock/`: lógica y componentes específicos de esos dominios.
- `src/stores/`: modelos compartidos, persistencia local y datos de demostración. `workspace.ts` conserva las claves existentes de `localStorage` y `sessionStorage`.
- `src/config/`: datos fijos del negocio; `src/motion.tsx`: lenguaje de movimiento compartido.
- `src/styles/`: CSS existente dividido por área. `main.tsx` lo importa en orden para conservar la cascada; `refinements.css` contiene ajustes posteriores compartidos.

El frontend sigue sin backend. `App` coordina datos entre módulos; cada pantalla renderiza su propia interfaz. Las claves de almacenamiento local son parte del contrato de la demostración y no deben cambiarse sin una migración.
