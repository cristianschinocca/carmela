import { useMemo, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { ArrowUpRight, Boxes, Save, Package, PackageCheck, Plus, Search, SlidersHorizontal, TriangleAlert, X } from "lucide-react";
import type { Product } from "../../data";
import { saveStockChange, setProductMinimum, setStockEnabled, type Stock } from "../../stores/inventory";
import { recipeCapacity } from "../../stock/domain";
import type { StockCatalog } from "../../stock/types";
import { BulkStockDialog } from "./BulkStockDialog";

type Props = { products: Product[]; stock: Stock; catalog: StockCatalog; onStockChange: (stock: Stock) => void; onToast: (message: string) => void };
type MovementType = "entrada" | "salida" | "ajuste";

export function StockManager({ products, stock, catalog, onStockChange, onToast }: Props) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"todos" | "bajo" | "sin-control">("todos");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [minimumId, setMinimumId] = useState<number | null>(null);
  const [minimumDraft, setMinimumDraft] = useState("");
  const [bulkOpen, setBulkOpen] = useState(false);
  const [type, setType] = useState<MovementType>("entrada");
  const [amount, setAmount] = useState("");
  const [minimum, setMinimum] = useState("0");
  const [note, setNote] = useState("");
  const capacity = useMemo(() => new Map(products.map((product) => [product.id, recipeCapacity(catalog, product.id)])), [products, catalog]);
  const sharedIngredients = useMemo(() => {
    const productIds = new Set(products.map((product) => product.id));
    const usage = new Map<string, Set<number>>();
    for (const recipe of catalog.recipes) {
      if (!productIds.has(recipe.productId)) continue;
      for (const line of recipe.ingredients) {
        const users = usage.get(line.ingredientId) ?? new Set<number>();
        users.add(recipe.productId);
        usage.set(line.ingredientId, users);
      }
    }
    return new Map(catalog.recipes.map((recipe) => [recipe.productId,
      recipe.ingredients.some((line) => (usage.get(line.ingredientId)?.size ?? 0) > 1)]));
  }, [catalog, products]);
  const tracked = products.filter((product) => stock[product.id]?.enabled || capacity.get(product.id)?.kind === "available");
  const isLow = (id: number) => { const item = stock[id]; const recipe = capacity.get(id); return Boolean(item && ((item.enabled && item.quantity <= item.minimum) || (recipe?.kind === "available" && recipe.quantity <= item.minimum))); };
  const low = tracked.filter((product) => isLow(product.id));
  const visible = useMemo(() => products.filter((product) => {
    if (!`${product.name} ${product.category}`.toLocaleLowerCase("es-AR").includes(query.trim().toLocaleLowerCase("es-AR"))) return false;
    if (filter === "bajo") return isLow(product.id);
    if (filter === "sin-control") return !stock[product.id]?.enabled && capacity.get(product.id)?.kind !== "available";
    return true;
  }), [products, stock, query, filter, capacity]);

  const open = (product: Product, initial: MovementType = "entrada") => {
    setEditingId(product.id);
    setType(stock[product.id]?.enabled ? initial : "ajuste");
    setAmount("");
    setMinimum(String(stock[product.id]?.minimum ?? 0));
    setNote("");
  };
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const product = products.find((item) => item.id === editingId);
    const value = Number(amount);
    const threshold = Number(minimum);
    if (!product || !Number.isSafeInteger(value) || value < 0 || (type !== "ajuste" && value === 0) || !Number.isSafeInteger(threshold) || threshold < 0) return;
    const next = saveStockChange(product, stock, type, value, threshold, note);
    if (!next) { onToast("La salida supera las unidades disponibles."); return; }
    onStockChange(next);
    setEditingId(null);
    onToast(`Stock de ${product.name} actualizado.`);
  };
  const toggle = (product: Product) => {
    const enabled = !stock[product.id]?.enabled;
    if (enabled) { open(product, "ajuste"); return; }
    onStockChange(setStockEnabled(product, stock, false));
    onToast(`Control de stock desactivado para ${product.name}.`);
  };
  const activeProduct = products.find((product) => product.id === editingId);
  const minimumProduct = products.find((product) => product.id === minimumId);

  return <div className="stock-page">
    <section className="panel stock-list-panel">
      <div className="stock-toolbar"><label className="search"><Search size={17} /><input aria-label="Buscar en stock" placeholder="Buscar producto o categoría…" value={query} onChange={(event) => setQuery(event.target.value)} /></label><div className="stock-toolbar-actions"><div className="stock-filters" role="group" aria-label="Filtrar productos"><button aria-pressed={filter === "todos"} className={filter === "todos" ? "active" : ""} onClick={() => setFilter("todos")}>Todos</button><button aria-pressed={filter === "bajo"} className={filter === "bajo" ? "active" : ""} onClick={() => setFilter("bajo")}><TriangleAlert size={14} /> Para reponer {low.length > 0 && <b>{low.length}</b>}</button><button aria-pressed={filter === "sin-control"} className={filter === "sin-control" ? "active" : ""} onClick={() => setFilter("sin-control")}>Sin control</button></div><button className="button primary stock-bulk-trigger" onClick={() => setBulkOpen(true)}><Boxes size={16} /> Carga rápida</button></div></div>
      {Array.from(capacity.values()).some((item) => item.kind === "available") && <p className="stock-recipe-explanation">El máximo de cada receta se calcula por separado. Los insumos compartidos no se reservan y las cantidades no se suman.</p>}
      <div className="stock-list-head"><span>Producto</span><span>Existencias</span><span>Mínimo</span><span>Acciones</span></div>
      <div className="stock-list">{visible.map((product) => {
        const item = stock[product.id]; const enabled = item?.enabled; const recipe = capacity.get(product.id); const needsStock = isLow(product.id); const shared = sharedIngredients.get(product.id);
        return <div className="stock-row" key={product.id}>
          <div className="stock-product"><span className="stock-product-icon" aria-hidden="true"><Package size={17} /></span><div><strong>{product.name}</strong><small>{product.category}</small></div></div>
          <div className="stock-quantity">{recipe?.kind === "available" ? <><strong className={needsStock ? "stock-alert-text" : ""}>{recipe.quantity}</strong><small>Máximo individual</small>{shared && <small>Insumos compartidos</small>}{enabled && <small>Manual: {item.quantity}</small>}</> : enabled ? <><strong className={needsStock ? "stock-alert-text" : ""}>{item.quantity}</strong><small>Conteo manual</small></> : <span className="stock-untracked">{recipe?.kind === "invalid" ? "Revisar receta" : "Sin control"}</span>}</div>
          <div className="stock-minimum">{item ? item.minimum : "—"}{recipe?.kind === "available" && <button type="button" className="stock-minimum-edit" aria-label={`Configurar mínimo de ${product.name}`} onClick={() => { setMinimumId(product.id); setMinimumDraft(String(item?.minimum ?? 0)); }}>Editar</button>}</div>
          <div className="stock-actions">{enabled ? <><button className="button" onClick={() => open(product, "entrada")} aria-label={`Ingresar unidades de ${product.name}`}><Plus size={15} /> Ingresar</button><button className="button icon-only" onClick={() => open(product, "salida")} title="Registrar salida" aria-label={`Registrar salida de ${product.name}`}><ArrowUpRight size={16} /></button><button className="button icon-only" onClick={() => open(product, "ajuste")} title="Ajustar conteo" aria-label={`Ajustar stock de ${product.name}`}><SlidersHorizontal size={16} /></button></> : <button className="button" onClick={() => toggle(product)}><PackageCheck size={15} /> Controlar stock</button>}</div>
        </div>;
      })}</div>
      {!visible.length && <div className="stock-empty"><Boxes size={24} /><strong>Sin productos para mostrar</strong><p>Probá otro filtro o agregá productos desde Productos.</p></div>}
    </section>
    <BulkStockDialog open={bulkOpen} products={products} stock={stock} onClose={() => setBulkOpen(false)} onSaved={(next, changed) => { onStockChange(next); setBulkOpen(false); onToast(`${changed} ${changed === 1 ? "producto actualizado" : "productos actualizados"} en stock.`); }} />
    {minimumProduct && createPortal(<div className="stock-modal-scrim" onPointerDown={(event) => { if (event.target === event.currentTarget) setMinimumId(null); }}><section className="stock-modal" role="dialog" aria-modal="true" aria-labelledby="stock-minimum-title" onKeyDown={(event) => { if (event.key === "Escape") setMinimumId(null); }}><button type="button" className="modal-close" aria-label="Cerrar" onClick={() => setMinimumId(null)}><X size={18} /></button><span className="stock-modal-icon" aria-hidden="true"><TriangleAlert size={19} /></span><h2 id="stock-minimum-title">Mínimo de {minimumProduct.name}</h2><p>Recibirás una alerta cuando las unidades según receta o el conteo manual lleguen a este valor.</p><form className="stock-form" onSubmit={(event) => { event.preventDefault(); const value = Number(minimumDraft); if (minimumDraft.trim() === "" || !Number.isSafeInteger(value) || value < 0) return; try { onStockChange(setProductMinimum(minimumProduct.id, stock, value)); setMinimumId(null); onToast("Mínimo actualizado."); } catch { onToast("No se pudo guardar el mínimo."); } }}><label className="field">Mínimo de unidades<input type="number" min="0" step="1" required autoFocus value={minimumDraft} onChange={(event) => setMinimumDraft(event.target.value)} /></label><div className="stock-form-actions"><button type="button" className="button" onClick={() => setMinimumId(null)}>Cancelar</button><button type="submit" className="button primary"><Save size={15} /> Guardar mínimo</button></div></form></section></div>, document.body)}
    {activeProduct && createPortal(<div className="modal-scrim stock-modal-scrim" onPointerDown={(event) => { if (event.target === event.currentTarget) setEditingId(null); }}><section className="acrylic-modal stock-modal" role="dialog" aria-modal="true" aria-labelledby="stock-modal-title" onKeyDown={(event) => { if (event.key === "Escape") setEditingId(null); }}><button className="modal-close" aria-label="Cerrar" onClick={() => setEditingId(null)}><X size={18} /></button><span className="stock-modal-icon" aria-hidden="true"><Package size={19} /></span><span className="eyebrow">GESTIÓN DE STOCK</span><h2 id="stock-modal-title">{activeProduct.name}</h2><p>{stock[activeProduct.id]?.enabled ? `Disponible: ${stock[activeProduct.id].quantity} unidades` : "Activá el control con un conteo inicial."}</p><form onSubmit={submit} className="stock-form"><label className="field">Movimiento<select value={type} onChange={(event) => { setType(event.target.value as MovementType); setAmount(""); }}><option value="entrada">Entrada de unidades</option><option value="salida" disabled={!stock[activeProduct.id]?.enabled}>Salida de unidades</option><option value="ajuste">Fijar cantidad real</option></select></label><div className="stock-form-grid"><label className="field">{type === "ajuste" ? "Cantidad real" : "Unidades"}<input type="number" min={type === "ajuste" ? 0 : 1} step="1" placeholder="Ej. 20" required autoFocus value={amount} onChange={(event) => setAmount(event.target.value)} /></label><label className="field">Avisar al llegar a<input type="number" min="0" step="1" required value={minimum} onChange={(event) => setMinimum(event.target.value)} /></label></div><p className="stock-form-hint">{type === "ajuste" ? "Ejemplo: si contaste 20 unidades, ingresá 20 como cantidad real." : type === "entrada" ? "Ejemplo: si recibiste 20 unidades, ingresá 20 para sumarlas." : "Ejemplo: si retiraste 2 unidades, ingresá 2 para descontarlas."} El aviso indica cuándo reponer; por ejemplo, al llegar a 5.</p><label className="field">Motivo <span className="stock-optional">opcional</span><input maxLength={100} placeholder="Ej. Compra a proveedor, merma…" value={note} onChange={(event) => setNote(event.target.value)} /></label><div className="stock-form-actions">{stock[activeProduct.id]?.enabled && <button className="button" type="button" onClick={() => { toggle(activeProduct); setEditingId(null); }}><X size={15} aria-hidden="true" /> Dejar de controlar</button>}<button className="button primary" type="submit"><Save size={15} aria-hidden="true" /> Guardar movimiento</button></div></form></section></div>, document.body)}
  </div>;
}
