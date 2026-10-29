import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { motion } from "motion/react";
import { Check, Eraser, GripVertical, Palette, Plus, Search, X } from "lucide-react";
import type { Product } from "../data";
import { catalogPalette, catalogColorStyle, catalogCellFromCoordinates, catalogClosestFreeCell, catalogDefaultCells, catalogGridPosition, PRODUCT_CARD_SIZE, PRODUCT_CELL, PRODUCT_GAP, type CatalogColors } from "../pos/catalogLayout";

export default function PosCatalog({ products, categories, onAddProduct, categoryContainer }: { products: Product[]; categories: string[]; onAddProduct: (productId: number) => void; categoryContainer: HTMLElement | null }) {
  const addProduct = onAddProduct;
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState(() => categories[0] ?? "");
  const activeCategory = categories.includes(category) ? category : categories[0] ?? "";
  useEffect(() => { if (category !== activeCategory) setCategory(activeCategory); }, [category, activeCategory]);
  const [sortingProducts, setSortingProducts] = useState(false);
  const [colorMode, setColorMode] = useState(false);
  const [selectedColor, setSelectedColor] = useState("rosa");
  const [catalogColors, setCatalogColors] = useState<CatalogColors>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("carmela.pos.catalog-colors.v1") || "{}");
      return { categories: saved.categories || {}, products: saved.products || {} };
    } catch { return { categories: {}, products: {} }; }
  });
  const [draggingProduct, setDraggingProduct] = useState<number | null>(null);
  const [productOrder] = useState<number[]>(() => {
    const ids = products.map((product) => product.id);
    try {
      const saved = JSON.parse(localStorage.getItem("carmela.pos.product-order.v1") || "null");
      if (Array.isArray(saved)) return [...new Set(saved.filter((id): id is number => ids.includes(id))), ...ids.filter((id) => !saved.includes(id))];
      const positions = JSON.parse(localStorage.getItem("carmela.pos.product-positions.v1") || "{}");
      const slots = JSON.parse(localStorage.getItem("carmela.pos.product-slots.v1") || "{}");
      return [...ids].sort((a, b) => {
        const first = positions[a], second = positions[b];
        if (first && second) return first.y - second.y || first.x - second.x;
        if (first) return -1;
        if (second) return 1;
        return (slots[a] ?? ids.indexOf(a)) - (slots[b] ?? ids.indexOf(b));
      });
    } catch { return ids; }
  });
  const [productPositions, setProductPositions] = useState<Record<number, { x: number; y: number }>>(() => {
    try { return JSON.parse(localStorage.getItem("carmela.pos.product-grid-positions.v1") || "{}"); }
    catch { return {}; }
  });
  const [productGridWidth, setProductGridWidth] = useState(0);
  const [productGridHeight, setProductGridHeight] = useState(0);
  const [productPage, setProductPage] = useState(0);
  const [productDragPosition, setProductDragPosition] = useState<{ id: number; x: number; y: number } | null>(null);
  const productGridRef = useRef<HTMLDivElement>(null);
  const productPointerRef = useRef<{ id: number; pointerId: number; startX: number; startY: number; x: number; y: number } | null>(null);
  const allOrder = useMemo(() => {
    const ids = products.map((product) => product.id);
    return [...productOrder.filter((id) => ids.includes(id)), ...ids.filter((id) => !productOrder.includes(id))];
  }, [products, productOrder]);
  const available = useMemo(() => {
    const rank = new Map(allOrder.map((id, index) => [id, index]));
    return products.filter(
        (product) =>
          product.available &&
          product.category === activeCategory &&
          product.name.toLowerCase().includes(query.toLowerCase()),
      ).sort((a, b) => (rank.get(a.id) ?? Infinity) - (rank.get(b.id) ?? Infinity));
  }, [products, activeCategory, query, allOrder]);
  useEffect(() => {
    const grid = productGridRef.current;
    if (!grid) return;
    const observer = new ResizeObserver(() => { setProductGridWidth(grid.clientWidth); setProductGridHeight(grid.clientHeight); });
    observer.observe(grid);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    localStorage.setItem("carmela.pos.product-order.v1", JSON.stringify(allOrder));
  }, [allOrder]);
  useEffect(() => {
    localStorage.setItem("carmela.pos.product-grid-positions.v1", JSON.stringify(productPositions));
  }, [productPositions]);
  useEffect(() => {
    localStorage.setItem("carmela.pos.catalog-colors.v1", JSON.stringify(catalogColors));
  }, [catalogColors]);
  const paintCatalog = (kind: keyof CatalogColors, id: string) => {
    setCatalogColors((current) => {
      const values = { ...current[kind] };
      if (selectedColor === "") delete values[id]; else values[id] = selectedColor;
      return { ...current, [kind]: values };
    });
  };
  const productMaxX = Math.max(0, productGridWidth - PRODUCT_CARD_SIZE - 16);
  const productMaxY = Math.max(0, productGridHeight - PRODUCT_CARD_SIZE - 16);
  const productColumns = Math.max(1, Math.floor((Math.max(0, productGridWidth - 16) + PRODUCT_GAP) / PRODUCT_CELL));
  const productRows = Math.max(1, Math.floor((Math.max(0, productGridHeight - 16) + PRODUCT_GAP) / PRODUCT_CELL));
  const productPageSize = productColumns * productRows;
  const productPageCount = Math.max(1, Math.ceil(available.length / productPageSize));
  const safeProductPage = Math.min(productPage, productPageCount - 1);
  const visibleProducts = useMemo(() => available.slice(safeProductPage * productPageSize, (safeProductPage + 1) * productPageSize), [available, safeProductPage, productPageSize]);
  useEffect(() => setProductPage(0), [activeCategory, query]);
  const productCells = useMemo(() => {
    const defaults = catalogDefaultCells(visibleProducts.length, productColumns, productRows);
    const result: Record<number, { column: number; row: number }> = {};
    const occupied = new Set<number>();
    const candidates = visibleProducts.map((product, index) => ({ product, index }));
    candidates.sort((a, b) => Number(Boolean(productPositions[b.product.id])) - Number(Boolean(productPositions[a.product.id])) || a.index - b.index);
    for (const { product, index } of candidates) {
      const saved = productPositions[product.id];
      const target = saved && Number.isFinite(saved.x) && Number.isFinite(saved.y)
        ? { column: Math.round(Math.max(0, Math.min(1, saved.x)) * (productColumns - 1)), row: Math.round(Math.max(0, Math.min(1, saved.y)) * (productRows - 1)) }
        : defaults[index];
      const slot = catalogClosestFreeCell(target, occupied, productColumns, productRows);
      if (slot < 0) continue;
      occupied.add(slot);
      result[product.id] = { column: slot % productColumns, row: Math.floor(slot / productColumns) };
    }
    return result;
  }, [visibleProducts, productPositions, productColumns, productRows]);
  const positionForProduct = (id: number) => {
    const cell = productCells[id];
    return catalogGridPosition(cell.row * productColumns + cell.column, productColumns);
  };
  const saveProductPosition = (id: number, x: number, y: number) => {
    const target = catalogCellFromCoordinates(x, y, productColumns, productRows);
    const current = productCells[id];
    if (!current || current.column === target.column && current.row === target.row) return;
    const occupant = visibleProducts.find((product) => product.id !== id && productCells[product.id]?.column === target.column && productCells[product.id]?.row === target.row);
    const stored = (cell: { column: number; row: number }) => ({ x: productColumns > 1 ? cell.column / (productColumns - 1) : 0, y: productRows > 1 ? cell.row / (productRows - 1) : 0 });
    setProductPositions((positions) => ({ ...positions, [id]: stored(target), ...(occupant ? { [occupant.id]: stored(current) } : {}) }));
  };
  useEffect(() => {
    const closeColors = (event: KeyboardEvent) => {
      if (event.key === "Escape" && colorMode) {
        event.preventDefault();
        event.stopImmediatePropagation();
        setColorMode(false);
      }
    };
    window.addEventListener("keydown", closeColors, true);
    return () => window.removeEventListener("keydown", closeColors, true);
  }, [colorMode]);
  return (
                <section className="account-catalog">
                  {categoryContainer && createPortal(
                    <div className="pos-header-categories" role="group" aria-label="Categorías de productos">
                      <span className="pos-category-label">Categorías</span>
                      <div className="pos-categories">
                        {categories.map((item) => (
                          <button
                            type="button"
                            key={item}
                            className={activeCategory === item ? "active" : ""}
                            aria-pressed={activeCategory === item}
                            data-colored={Boolean(catalogColors.categories[item]) || undefined}
                            style={catalogColorStyle(catalogColors.categories[item])}
                            onClick={() => colorMode ? paintCatalog("categories", item) : setCategory(item)}
                            title={colorMode ? `Aplicar color a ${item}` : item}
                          >
                            <span className="pos-category-name">{item}</span>
                          </button>
                        ))}
                      </div>
                    </div>, categoryContainer,
                  )}
                  <div className="account-catalog-tools">
                    <label className="search">
                      <Search size={17} />
                      <input
                        aria-label="Buscar producto"
                        placeholder={activeCategory ? `Buscar en ${activeCategory}…` : "Buscar producto…"}
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                      />
                    </label>
                    <button
                      type="button"
                      aria-pressed={sortingProducts}
                      className={
                        sortingProducts ? "text-btn active" : "text-btn"
                      }
                      onClick={() => {
                        setSortingProducts((value) => !value);
                        setColorMode(false);
                        setDraggingProduct(null);
                      }}
                    >
                      {sortingProducts ? (
                        <>
                          <Check size={14} /> Listo
                        </>
                      ) : (
                        <>
                          <GripVertical size={14} /> Ordenar productos
                        </>
                      )}
                    </button>
                    <div className="catalog-color-control">
                      <button type="button" className={colorMode ? "text-btn active" : "text-btn"} aria-label="Colores" aria-expanded={colorMode} aria-controls="catalog-color-palette" onClick={() => { setColorMode((value) => !value); setSortingProducts(false); }}><Palette size={15} /> Colores</button>
                      {colorMode && <div className="catalog-color-palette" id="catalog-color-palette" role="region" aria-label="Paleta de colores">
                        <div className="catalog-color-heading"><strong>Colores</strong><button type="button" className="catalog-color-close" aria-label="Cerrar colores" onClick={() => setColorMode(false)}><X size={15} /></button></div>
                        <p>Seleccioná un color y aplicalo a una categoría o producto.</p>
                        <div className="catalog-color-options">
                          <div className="catalog-color-swatches" role="group" aria-label="Colores disponibles">
                            {catalogPalette.map((color) => <button type="button" key={color.id} aria-label={color.label} title={color.label} aria-pressed={selectedColor === color.id} style={catalogColorStyle(color.id)} onClick={() => setSelectedColor(color.id)}>{selectedColor === color.id && <Check size={13} aria-hidden="true" />}</button>)}
                          </div>
                          <div className="catalog-color-footer"><span aria-live="polite">{selectedColor ? `Color: ${catalogPalette.find((color) => color.id === selectedColor)?.label || "Personalizado"}` : "Modo quitar color"}</span><button type="button" className="catalog-color-reset" aria-pressed={selectedColor === ""} onClick={() => setSelectedColor("")}><Eraser size={14} aria-hidden="true" /> Quitar color</button></div>
                        </div>
                        {selectedColor === "" && <small>Tocá un elemento para quitar su color propio.</small>}
                      </div>}
                    </div>
                  </div>
                    <div className="pos-products-workspace">
                  <div className="product-page-controls" aria-label="Páginas de productos">
                    <span>{available.length} {available.length === 1 ? "producto" : "productos"}</span>
                    {productPageCount > 1 && <div><button type="button" disabled={safeProductPage === 0} onClick={() => setProductPage(safeProductPage - 1)} aria-label="Página anterior">‹</button><span>{safeProductPage + 1} / {productPageCount}</span><button type="button" disabled={safeProductPage >= productPageCount - 1} onClick={() => setProductPage(safeProductPage + 1)} aria-label="Página siguiente">›</button></div>}
                  </div>
                  <div
                    ref={productGridRef}
                    style={{ "--product-card-size": `${PRODUCT_CARD_SIZE}px` } as CSSProperties}
                    className={
                      sortingProducts
                        ? "compact-products sorting"
                        : "compact-products"
                    }
                  >
                    <div className="product-position-canvas">
                    {visibleProducts.map((product) => {
                      const position = productDragPosition?.id === product.id ? productDragPosition : positionForProduct(product.id);
                      const productColor = catalogColors.products[product.id] || catalogColors.categories[product.category];
                      return (
                      sortingProducts ? (
                        <motion.div
                          style={{ left: position.x + 8, top: position.y + 8, touchAction: "none", ...catalogColorStyle(productColor) }}
                          data-colored={Boolean(productColor) || undefined}
                          role="button"
                          tabIndex={0}
                          aria-label={`Ordenar ${product.name}. Usá las flechas para moverlo.`}
                          onKeyDown={(event) => {
                            if (event.key === "ArrowUp" || event.key === "ArrowLeft" || event.key === "ArrowDown" || event.key === "ArrowRight") {
                              event.preventDefault();
                              const step = event.shiftKey ? PRODUCT_CELL * 2 : PRODUCT_CELL;
                              saveProductPosition(product.id, position.x + (event.key === "ArrowLeft" ? -step : event.key === "ArrowRight" ? step : 0), position.y + (event.key === "ArrowUp" ? -step : event.key === "ArrowDown" ? step : 0));
                            }
                          }}
                          className={
                            draggingProduct === product.id
                              ? "catalog-sort-card dragging"
                              : "catalog-sort-card"
                          }
                          onPointerDown={(event) => { if (event.button !== 0) return; event.currentTarget.setPointerCapture(event.pointerId); productPointerRef.current = { id: product.id, pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, x: position.x, y: position.y }; setDraggingProduct(product.id); }}
                          onPointerMove={(event) => { const drag = productPointerRef.current; if (!drag || drag.pointerId !== event.pointerId) return; setProductDragPosition({ id: drag.id, x: Math.max(0, Math.min(productMaxX, drag.x + event.clientX - drag.startX)), y: Math.max(0, Math.min(productMaxY, drag.y + event.clientY - drag.startY)) }); }}
                          onPointerUp={(event) => { const drag = productPointerRef.current; if (!drag || drag.pointerId !== event.pointerId) return; saveProductPosition(drag.id, drag.x + event.clientX - drag.startX, drag.y + event.clientY - drag.startY); productPointerRef.current = null; setProductDragPosition(null); setDraggingProduct(null); }}
                          onPointerCancel={() => { productPointerRef.current = null; setProductDragPosition(null); setDraggingProduct(null); }}
                          key={product.id}
                        >
                          <GripVertical size={16} />
                          <span>
                            <strong>{product.name}</strong>
                          </span>
                        </motion.div>
                      ) : (
                        <motion.button
                          style={{ left: position.x + 8, top: position.y + 8, ...catalogColorStyle(productColor) }}
                          data-colored={Boolean(productColor) || undefined}
                          whileTap={{ scale: 0.985 }}
                          key={product.id}
                          aria-label={`${colorMode ? "Aplicar color a" : "Agregar"} ${product.name}`}
                          onClick={() => colorMode ? paintCatalog("products", String(product.id)) : addProduct(product.id)}
                        >
                          <span>
                            <strong>{product.name}</strong>
                          </span>
                          <i>
                            <Plus size={15} />
                          </i>
                        </motion.button>
                      ));
                    })}
                    </div>
                  </div>
                  {!available.length && (
                    <div className="empty">
                      <p>No encontramos productos.</p>
                    </div>
                  )}
                  </div>
                </section>
  );
}
