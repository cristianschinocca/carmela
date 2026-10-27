# Sistema visual · Miga

## Dirección

Una cafetería de barrio con una operación profesional. Marfil, rosa frambuesa y rosa empolvado, con superficies blancas y tipografía sobria. La referencia inspira el ritmo, las curvas y el contraste suave; el sidebar permite crecer a ocho módulos sin comprimir la navegación.

## Tokens

- Fondo cálido: #fff8f5; superficie: #ffffff; primario Carmela: #c52f70; rosa profundo: #91204d; rosa empolvado: #f8e5ed; texto: #252d28; borde: #eee2e4.
- Manrope: títulos y cifras. DM Sans: controles y contenido.
- Escala de espacio: 4, 8, 12, 16, 20, 24, 32, 40 px.
- Radios: controles 9–10 px, productos 16 px, paneles 22 px.
- Estados: verde para listo, ámbar para preparación, gris para entregado. Etiquetas textuales acompañan los colores.
- Interacciones: foco visible, hover discreto y respeto por reduced-motion.

## Experiencias

Resumen: cuatro indicadores, ventas por hora, estado operativo, pedidos y productos populares. POS: catálogo y pedido, búsqueda, categorías, cantidades y cobro simulado. Menú público: fotografía editorial, portada con identidad, categorías y fichas de producto; sin navegación administrativa.

## Responsive

Navegación lateral colapsada debajo de 760 px. Paneles apilados en tablet y ventanas estrechas; catálogo adapta columnas y POS apila el pedido sin alturas fijas. Menú público con dos columnas en móvil. El escalado se comprueba con viewports equivalentes al área CSS disponible (1093 y 853 px para 125% y 150% sobre 1366 px).

## Movimiento

Motion centraliza duraciones de 140–300 ms y curvas de entrada, salida y transición. Las páginas usan desplazamientos breves; productos, métricas y filas aparecen de forma escalonada; POS, estados, avisos, dropdowns y modales conservan animaciones de salida. Los esqueletos se limitan a la carga de imágenes. `MotionConfig` respeta la preferencia de movimiento reducido y CSS desactiva shimmer, rotaciones y transformaciones auxiliares.

## Próxima fase

Persistencia remota, autenticación, permisos efectivos por rol, carga real de imágenes, flujo de apertura/cierre de caja, métricas reales, URL pública estable y QR. En esta etapa, productos, categorías, usuarios y fichajes se guardan localmente en cada navegador.
