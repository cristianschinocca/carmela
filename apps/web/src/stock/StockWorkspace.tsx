import { useState } from "react";
import { Boxes, ChefHat, Package, Truck } from "lucide-react";
import type { Product } from "../data";
import { StockManager } from "../components/stock/StockManager";
import { ServerStockCatalog } from "../features/inventory/ServerStockCatalog";
import { ServerProductStock } from "../features/inventory/ServerProductStock";
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
  const [productSource, setProductSource] = useState<"servidor" | "local">("servidor");
  const { catalog, update, error, loading, readFailed } = useStockCatalog();
  return <div className="grid gap-4">
    <nav aria-label="Secciones de stock" className="stock-navigation">{sections.map((item) => <button key={item.id} type="button" aria-current={section === item.id ? "page" : undefined} onClick={() => setSection(item.id)}><item.icon size={16} aria-hidden="true" />{item.label}</button>)}</nav>
    {error && <p role="alert" className="rounded-lg border border-red-400/40 px-4 py-3 text-sm text-red-500">{error}</p>}
    {section === "productos" && <>
      <div className="flex flex-wrap items-center gap-2 text-sm"><span>Origen:</span><button type="button" className="button" aria-pressed={productSource === "servidor"} onClick={() => setProductSource("servidor")}>Cafetería</button><button type="button" className="button" aria-pressed={productSource === "local"} onClick={() => setProductSource("local")}>Datos locales</button></div>
      {productSource === "servidor" ? <ServerProductStock /> : <><p className="text-sm text-[var(--muted)]">Estos datos permanecen en este navegador y todavía no se sincronizan con la cafetería.</p>{!loading && !readFailed && <StockManager products={products} stock={stock} catalog={catalog} onStockChange={onStockChange} onToast={onToast} />}</>}
    </>}
    {loading && section !== "productos" && <p role="status">Cargando stock…</p>}
    {(section === "insumos" || section === "recetas") && <>
      <div className="flex flex-wrap items-center gap-2 text-sm"><span>Origen:</span><button type="button" className="button" aria-pressed={productSource === "servidor"} onClick={() => setProductSource("servidor")}>Cafetería</button><button type="button" className="button" aria-pressed={productSource === "local"} onClick={() => setProductSource("local")}>Datos locales</button></div>
      {productSource === "servidor" ? <ServerStockCatalog section={section} notify={onToast} /> : !loading && !readFailed && <><p className="text-sm text-[var(--muted)]">Datos guardados solo en este navegador.</p>{section === "insumos" ? <Ingredients catalog={catalog} update={update} notify={onToast} /> : <Recipes catalog={catalog} products={products} update={update} notify={onToast} />}</>}
    </>}
    {!loading && !readFailed && section === "proveedores" && <Suppliers catalog={catalog} update={update} notify={onToast} />}
  </div>;
}
