import { useState, type FormEvent } from "react";
import { Plus, Trash2 } from "lucide-react";
import type { Product } from "../../data";
import { formatQuantity, validQuantity } from "../domain";
import type { Recipe, StockCatalog } from "../types";
import { Empty, inputClass, labelClass, RowActions, SectionHeader, StockModal } from "./StockUI";

type Props = { catalog: StockCatalog; products: Product[]; update: (next: StockCatalog) => Promise<boolean>; notify: (message: string) => void };
type Draft = { id: string; name: string; productId: string; ingredients: { ingredientId: string; quantity: string }[] };
const newDraft = (): Draft => ({ id: crypto.randomUUID(), name: "", productId: "", ingredients: [{ ingredientId: "", quantity: "" }] });

export function Recipes({ catalog, products, update, notify }: Props) {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState("");
  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (!draft) return;
    const productId = Number(draft.productId);
    if (!draft.name.trim() || !products.some((product) => product.id === productId)) { setError("Completá el nombre y elegí un producto existente."); return; }
    if (catalog.recipes.some((recipe) => recipe.id !== draft.id && recipe.productId === productId)) { setError("Este producto ya tiene una receta."); return; }
    const ingredients = draft.ingredients.map((line) => ({ ingredientId: line.ingredientId, quantity: Number(line.quantity) }));
    if (!ingredients.length || draft.ingredients.some((line) => !line.quantity.trim()) || ingredients.some((line) => !catalog.ingredients.some((item) => item.id === line.ingredientId) || !validQuantity(line.quantity) || line.quantity <= 0) || new Set(ingredients.map((line) => line.ingredientId)).size !== ingredients.length) { setError("Elegí insumos diferentes e ingresá una cantidad mayor a cero para cada uno."); return; }
    const recipe: Recipe = { id: draft.id, name: draft.name.trim(), productId, ingredients };
    const recipes = catalog.recipes.some((item) => item.id === recipe.id) ? catalog.recipes.map((item) => item.id === recipe.id ? recipe : item) : [...catalog.recipes, recipe];
    if (await update({ ...catalog, recipes })) { setDraft(null); notify("Receta guardada."); }
    else setError("No se pudo guardar. Revisá el almacenamiento del navegador y volvé a intentar.");
  };
  const remove = async (recipe: Recipe) => {
    if (window.confirm(`¿Eliminar la receta ${recipe.name}?`) && await update({ ...catalog, recipes: catalog.recipes.filter((item) => item.id !== recipe.id) })) notify("Receta eliminada.");
  };
  const edit = (recipe: Recipe) => { setError(""); setDraft({ ...recipe, productId: String(recipe.productId), ingredients: recipe.ingredients.map((line) => ({ ...line, quantity: String(line.quantity) })) }); };
  return <section className="overflow-hidden rounded-[20px] border border-[var(--border)] bg-[var(--surface)]">
    <SectionHeader title="Recetas" description="Definí los insumos necesarios para preparar una unidad de cada producto." action="Nueva receta" onAdd={() => { setError(""); setDraft(newDraft()); }} />
    {!products.length || !catalog.ingredients.length ? <p className="border-b border-[var(--border)] px-6 py-3 text-xs">Para crear una receta necesitás al menos un producto y un insumo.</p> : null}
    {catalog.recipes.length ? <div className="divide-y divide-[var(--border)] px-5 sm:px-6">{catalog.recipes.map((recipe) => <div key={recipe.id} className="flex flex-wrap items-center justify-between gap-3 py-4"><div className="min-w-0"><strong className="text-sm">{recipe.name}</strong><p className="mt-1 text-xs">Producto: {products.find((product) => product.id === recipe.productId)?.name || "Producto eliminado · actualizá la receta"}</p><p className="text-xs">{recipe.ingredients.map((line) => { const ingredient = catalog.ingredients.find((item) => item.id === line.ingredientId); return `${formatQuantity(line.quantity)} ${ingredient?.unit || ""} ${ingredient?.name || "Insumo no disponible"}`; }).join(" · ")}</p></div><RowActions name={recipe.name} onEdit={() => edit(recipe)} onDelete={() => remove(recipe)} /></div>)}</div> : <Empty>Todavía no creaste recetas.</Empty>}
    {draft && <StockModal title={catalog.recipes.some((item) => item.id === draft.id) ? "Editar receta" : "Nueva receta"} onClose={() => setDraft(null)}><form onSubmit={save} className="grid gap-4">
      <label className={labelClass}>Nombre de la receta<input className={inputClass} required maxLength={80} value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} /></label>
      <label className={labelClass}>Producto del POS<select aria-label="Producto del POS" className={inputClass} required value={draft.productId} onChange={(event) => setDraft({ ...draft, productId: event.target.value })}><option value="">Seleccioná un producto</option>{products.map((product) => <option key={product.id} value={product.id}>{product.name} · {product.category}</option>)}</select></label>
      <div className="flex items-center justify-between gap-3"><div><strong className="text-sm">Ingredientes</strong><p className="text-xs">Cantidades para una unidad del producto.</p></div><button type="button" className="button" disabled={!catalog.ingredients.length} onClick={() => setDraft({ ...draft, ingredients: [...draft.ingredients, { ingredientId: "", quantity: "" }] })}><Plus size={15} /> Agregar</button></div>
      <div className="grid gap-2">{draft.ingredients.map((line, index) => <div key={index} className="grid grid-cols-[minmax(0,1fr)_90px_34px] items-end gap-2"><label className={labelClass}>Insumo<select aria-label={`Insumo ${index + 1}`} className={inputClass} required value={line.ingredientId} onChange={(event) => setDraft({ ...draft, ingredients: draft.ingredients.map((item, i) => i === index ? { ...item, ingredientId: event.target.value } : item) })}><option value="">Elegir</option>{catalog.ingredients.map((ingredient) => <option key={ingredient.id} value={ingredient.id}>{ingredient.name} ({ingredient.unit})</option>)}</select></label><label className={labelClass}>Cantidad<input className={inputClass} required type="number" min="0.001" max="1000000000" step="any" value={line.quantity} onChange={(event) => setDraft({ ...draft, ingredients: draft.ingredients.map((item, i) => i === index ? { ...item, quantity: event.target.value } : item) })} /></label><button type="button" aria-label={`Quitar ingrediente ${index + 1}`} className="mb-1 grid h-8 w-8 place-items-center text-[var(--muted)]" onClick={() => setDraft({ ...draft, ingredients: draft.ingredients.filter((_, i) => i !== index) })}><Trash2 size={16} /></button></div>)}</div>
      {error && <p role="alert" className="text-sm text-red-500">{error}</p>}<div className="flex justify-end gap-2 border-t border-[var(--border)] pt-4"><button type="button" className="button" onClick={() => setDraft(null)}>Cancelar</button><button className="button primary" type="submit" disabled={!products.length || !catalog.ingredients.length}>Guardar receta</button></div>
    </form></StockModal>}
  </section>;
}
