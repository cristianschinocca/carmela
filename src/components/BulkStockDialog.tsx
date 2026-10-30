import { useMemo, useState, type FormEvent, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { Check, Search, X } from "lucide-react";
import type { Product } from "../data";
import { modalVariants, overlayVariants } from "../motion";
import { saveStockCountBatch, type Stock } from "../stores/inventory";

type Draft = Record<number, { quantity: string; minimum: string }>;
type Props = {
  open: boolean;
  products: Product[];
  stock: Stock;
  onClose: () => void;
  onSaved: (stock: Stock, changed: number) => void;
};

function CountForm({ products, stock, onClose, onSaved }: Omit<Props, "open">) {
  const [draft, setDraft] = useState<Draft>(() => Object.fromEntries(products.map((product) => [product.id, {
    quantity: stock[product.id]?.enabled ? String(stock[product.id].quantity) : "",
    minimum: String(stock[product.id]?.minimum ?? 0),
  }])));
  const [search, setSearch] = useState("");
  const [commonMinimum, setCommonMinimum] = useState("");
  const [error, setError] = useState("");
  const visible = useMemo(() => products.filter((product) =>
    `${product.name} ${product.category}`.toLocaleLowerCase("es-AR").includes(search.trim().toLocaleLowerCase("es-AR")),
  ), [products, search]);
  const changed = products.filter((product) => {
    const row = draft[product.id];
    if (!row || row.quantity.trim() === "") return false;
    const item = stock[product.id];
    return !item?.enabled || item.quantity !== Number(row.quantity) || item.minimum !== Number(row.minimum);
  }).length;

  const update = (id: number, field: "quantity" | "minimum", value: string) => {
    setDraft((current) => ({ ...current, [id]: { ...current[id], [field]: value } }));
    setError("");
  };
  const advance = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    const fields = Array.from(document.querySelectorAll<HTMLInputElement>(".bulk-stock-quantity"));
    const next = fields[fields.indexOf(event.currentTarget) + 1];
    if (next) { next.focus(); next.select(); }
    else document.querySelector<HTMLButtonElement>(".bulk-stock-save")?.focus();
  };
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const entries = products.flatMap((product) => {
      const row = draft[product.id];
      const previous = stock[product.id];
      if (!row || row.quantity.trim() === "" ||
        (previous?.enabled && previous.quantity === Number(row.quantity) && previous.minimum === Number(row.minimum))) return [];
      return [{ productId: product.id, quantity: Number(row.quantity), minimum: Number(row.minimum) }];
    });
    if (!entries.length) { setError("Ingresá la cantidad de al menos un producto."); return; }
    if (products.some((product) => {
      const row = draft[product.id];
      return row?.quantity.trim() === "" && stock[product.id]?.enabled;
    })) { setError("Los productos con control necesitan una cantidad."); return; }
    const result = saveStockCountBatch(products, stock, entries);
    if (!result) { setError("Revisá las cantidades y mínimos: deben ser números enteros desde cero."); return; }
    if (!result.changed) { setError("No hay cambios para guardar."); return; }
    onSaved(result.stock, result.changed);
  };

  return <motion.div className="stock-modal-scrim" variants={overlayVariants} initial="hidden" animate="visible" exit="exit" onPointerDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <motion.section className="acrylic-modal bulk-stock-modal" role="dialog" aria-modal="true" aria-labelledby="bulk-stock-title" variants={modalVariants} initial="hidden" animate="visible" exit="exit" onKeyDown={(event) => { if (event.key === "Escape") { event.stopPropagation(); onClose(); } }}>
      <div className="bulk-stock-header"><div><span className="eyebrow">INVENTARIO</span><h2 id="bulk-stock-title">Carga rápida de stock</h2><p>Escribí las cantidades de los productos que querés controlar. Los productos nuevos sin cantidad quedan sin control.</p></div><button className="modal-close" type="button" aria-label="Cerrar carga rápida" onClick={onClose}><X size={19} /></button></div>
      <div className="bulk-stock-tools"><label className="search"><Search size={16} /><input aria-label="Buscar producto en carga rápida" placeholder="Buscar producto…" value={search} onChange={(event) => setSearch(event.target.value)} /></label><label className="bulk-common-minimum">Mínimo para todos<input type="number" min="0" step="1" value={commonMinimum} onChange={(event) => setCommonMinimum(event.target.value)} placeholder="Ej. 5" /></label><button className="button" type="button" disabled={commonMinimum === "" || !Number.isSafeInteger(Number(commonMinimum)) || Number(commonMinimum) < 0} onClick={() => setDraft((current) => Object.fromEntries(products.map((product) => [product.id, { ...current[product.id], minimum: commonMinimum }])))}>Aplicar mínimo</button></div>
      <form onSubmit={submit} className="bulk-stock-form"><div className="bulk-stock-columns"><span>Producto</span><span>Cantidad real</span><span>Alerta desde</span></div><div className="bulk-stock-list">{visible.map((product) => <div className="bulk-stock-row" key={product.id}><div className="stock-product"><img src={product.image} alt="" /><div><strong>{product.name}</strong><small>{product.category}</small></div></div><input className="bulk-stock-quantity" type="number" min={stock[product.id]?.quantity < 0 ? undefined : "0"} step="1" inputMode="numeric" aria-label={`Cantidad real de ${product.name}`} placeholder="Sin control" value={draft[product.id]?.quantity ?? ""} onChange={(event) => update(product.id, "quantity", event.target.value)} onKeyDown={advance} /><input type="number" min="0" step="1" inputMode="numeric" aria-label={`Mínimo de ${product.name}`} value={draft[product.id]?.minimum ?? "0"} onChange={(event) => update(product.id, "minimum", event.target.value)} /></div>)}{!visible.length && <p className="bulk-stock-empty">No hay productos con esa búsqueda.</p>}</div><div className="bulk-stock-footer"><span role="status">{error || `${changed} ${changed === 1 ? "producto listo" : "productos listos"} para actualizar`}</span><div><button className="button" type="button" onClick={onClose}>Cancelar</button><button className="button primary bulk-stock-save" type="submit" disabled={!changed}><Check size={16} /> Guardar cambios</button></div></div></form>
    </motion.section>
  </motion.div>;
}

export function BulkStockDialog({ open, products, stock, onClose, onSaved }: Props) {
  return createPortal(<AnimatePresence>{open && <CountForm key="bulk-stock" products={products} stock={stock} onClose={onClose} onSaved={onSaved} />}</AnimatePresence>, document.body);
}
