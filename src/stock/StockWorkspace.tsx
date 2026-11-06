import { useState } from "react";
import type { Product } from "../data";
import { StockManager } from "../components/StockManager";
import type { Stock } from "../stores/inventory";
import { useStockCatalog } from "./useStockCatalog";
import { Ingredients } from "./components/Ingredients";
import { Recipes } from "./components/Recipes";
import { Suppliers } from "./components/Suppliers";

type Props = { products: Product[]; stock: Stock; onStockChange: (stock: Stock) => void; onToast: (message: string) => void };
type Section = "productos" | "insumos" | "recetas" | "proveedores";
const sections: { id: Section; label: string }[] = [
  { id: "productos", label: "Productos" }, { id: "insumos", label: "Insumos" },
  { id: "recetas", label: "Recetas" }, { id: "proveedores", label: "Proveedores" },
];

export function StockWorkspace({ products, stock, onStockChange, onToast }: Props) {
  const [section, setSection] = useState<Section>("productos");
  const { catalog, update, error, loading, readFailed } = useStockCatalog();
  return <div className="grid gap-4">
    <div role="navigation" aria-label="Secciones de stock" className="flex flex-wrap gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-2">{sections.map((item) => <button key={item.id} type="button" aria-pressed={section === item.id} onClick={() => setSection(item.id)} className={`min-h-10 rounded-lg px-4 py-2 text-sm font-semibold ${section === item.id ? "bg-[var(--brand-soft)] text-[var(--brand-deep)]" : "text-[var(--muted)] hover:bg-[var(--brand-soft)]"}`}>{item.label}</button>)}</div>
    {error && <p role="alert" className="rounded-lg border border-red-400/40 px-4 py-3 text-sm text-red-500">{error}</p>}
    {section === "productos" && <StockManager products={products} stock={stock} onStockChange={onStockChange} onToast={onToast} />}
    {section !== "productos" && loading && <p role="status">Cargando stock…</p>}
    {!loading && !readFailed && section === "insumos" && <Ingredients catalog={catalog} update={update} notify={onToast} />}
    {!loading && !readFailed && section === "recetas" && <Recipes catalog={catalog} products={products} update={update} notify={onToast} />}
    {!loading && !readFailed && section === "proveedores" && <Suppliers catalog={catalog} update={update} notify={onToast} />}
  </div>;
}
