# Estructura del frontend

Todos los paths `src/` de este documento están dentro de `apps/web/`.

Este documento describe el frontend de la demostración. La arquitectura con API y PostgreSQL está definida en [Arquitectura objetivo](arquitectura-objetivo.md); la interfaz aún no consume esa API.

- `src/App.tsx`: composición de pantallas, estado compartido y navegación de la demostración.
- `src/features/shell/`: navegación y estructura visible en todas las pantallas internas.
- `src/features/dashboard/`, `menu/`, `settings/`: pantallas administrativas con sus propias dependencias y props explícitas.
- `src/components/`: componentes agrupados por sección: `pos`, `stock`, `products`, `team`, `attendance`, `cash`, `menu`, `reports` y `auth`. `shared` contiene elementos reutilizados y `ui` los componentes shadcn/ui.
- `src/pos/` y `src/stock/`: lógica y componentes específicos de esos dominios.
- `src/stores/`: modelos compartidos, persistencia local y datos de demostración. `workspace.ts` conserva las claves existentes de `localStorage` y `sessionStorage`.
- `src/config/`: datos fijos del negocio; `src/motion.tsx`: lenguaje de movimiento compartido.
- `src/styles/`: CSS existente dividido por área. `main.tsx` lo importa en orden para conservar la cascada; `refinements.css` contiene ajustes posteriores compartidos.

`App` coordina datos entre módulos; cada pantalla renderiza su propia interfaz. Las claves de almacenamiento local son parte del contrato de la demostración y no deben cambiarse sin una migración.



ac051d634321c30aa1db24c22f1a6cf5