import { useState } from "react";
import { Boxes, ChefHat, Package, Truck } from "lucide-react";
import type { Product } from "../data";
import { StockManager } from "../components/stock/StockManager";
import type { Stock } from "../stores/inventory";
import { useStockCatalog } from "./useStockCatalog";
import { Ingredients } from "./components/Ingredients";
import { Recipes } from "./components/Recipes";
import { Suppliers } from "./components/Suppliers";

type Props = { products: Product[]; stock: Stock; onStockChange: (stock: Stock) => void; onToast: (message: string) => void };
type Section = "productos" | "insumos" | "recetas" | "proveedores";
const sections: { id: Section; label: string; icon: typeof Package }[] = [
  { id: "productos", label: "Productos", icon: Package }, { id: "insumos", label: "Insumos", icon: Boxes },
  { id: "recetas", label: "Recetas", icon: ChefHat }, { id: "proveedores", label: "Proveedores", icon: Truck },
];

export function StockWorkspace({ products, stock, onStockChange, onToast }: Props) {
  const [section, setSection] = useState<Section>("productos");
  const { catalog, update, error, loading, readFailed } = useStockCatalog();
  return <div className="grid gap-4">
    <nav aria-label="Secciones de stock" className="stock-navigation">{sections.map((item) => <button key={item.id} type="button" aria-current={section === item.id ? "page" : undefined} onClick={() => setSection(item.id)}><item.icon size={16} aria-hidden="true" />{item.label}</button>)}</nav>
    {error && <p role="alert" className="rounded-lg border border-red-400/40 px-4 py-3 text-sm text-red-500">{error}</p>}
    {!loading && !readFailed && section === "productos" && <StockManager products={products} stock={stock} catalog={catalog} onStockChange={onStockChange} onToast={onToast} />}
    {loading && <p role="status">Cargando stock…</p>}
    {!loading && !readFailed && section === "insumos" && <Ingredients catalog={catalog} update={update} notify={onToast} />}
    {!loading && !readFailed && section === "recetas" && <Recipes catalog={catalog} products={products} update={update} notify={onToast} />}
    {!loading && !readFailed && section === "proveedores" && <Suppliers catalog={catalog} update={update} notify={onToast} />}
  </div>;
}
