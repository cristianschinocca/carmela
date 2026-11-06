import { useState, type FormEvent } from "react";
import { formatQuantity, ingredientInUse, isLowStock, validQuantity } from "../domain";
import { units, type Ingredient, type StockCatalog, type Unit } from "../types";
import { Empty, inputClass, labelClass, RowActions, SectionHeader, StockModal } from "./StockUI";

type Props = { catalog: StockCatalog; update: (next: StockCatalog) => Promise<boolean>; notify: (message: string) => void };
type Draft = Omit<Ingredient, "quantity" | "minimum"> & { quantity: string; minimum: string };
const newDraft = (): Draft => ({ id: crypto.randomUUID(), name: "", unit: "unidad", quantity: "0", minimum: "0", supplierIds: [] });

export function Ingredients({ catalog, update, notify }: Props) {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const visible = catalog.ingredients.filter((ingredient) => ingredient.name.toLocaleLowerCase("es-AR").includes(query.trim().toLocaleLowerCase("es-AR")));
  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (!draft) return;
    const name = draft.name.trim();
    const quantity = Number(draft.quantity), minimum = Number(draft.minimum);
    if (!name || draft.quantity.trim() === "" || draft.minimum.trim() === "" || !validQuantity(quantity) || !validQuantity(minimum)) { setError("Completá el nombre y cantidades válidas, mayores o iguales a cero."); return; }
    if (catalog.ingredients.some((item) => item.id !== draft.id && item.name.toLocaleLowerCase("es-AR") === name.toLocaleLowerCase("es-AR"))) { setError("Ya existe un insumo con ese nombre."); return; }
    const item: Ingredient = { ...draft, name, quantity, minimum };
    const ingredients = catalog.ingredients.some((ingredient) => ingredient.id === item.id) ? catalog.ingredients.map((ingredient) => ingredient.id === item.id ? item : ingredient) : [...catalog.ingredients, item];
    if (await update({ ...catalog, ingredients })) { setDraft(null); notify("Insumo guardado."); }
    else setError("No se pudo guardar. Revisá el almacenamiento del navegador y volvé a intentar.");
  };
  const remove = async (ingredient: Ingredient) => {
    if (ingredientInUse(catalog, ingredient.id)) { notify("Quitá este insumo de las recetas antes de eliminarlo."); return; }
    if (window.confirm(`¿Eliminar ${ingredient.name}?`) && await update({ ...catalog, ingredients: catalog.ingredients.filter((item) => item.id !== ingredient.id) })) notify("Insumo eliminado.");
  };
  return <section className="overflow-hidden rounded-[20px] border border-[var(--border)] bg-[var(--surface)]">
    <SectionHeader title="Insumos" description="Cantidades, mínimos y proveedores de cada ingrediente." action="Nuevo insumo" onAdd={() => { setError(""); setDraft(newDraft()); }} />
    <div className="border-b border-[var(--border)] px-5 py-3 sm:px-6"><input className={`${inputClass} max-w-sm`} aria-label="Buscar insumos" placeholder="Buscar insumo…" value={query} onChange={(event) => setQuery(event.target.value)} /></div>
    {visible.length ? <div className="divide-y divide-[var(--border)] px-5 sm:px-6">{visible.map((ingredient) => <div key={ingredient.id} className="flex flex-wrap items-center justify-between gap-3 py-4"><div className="min-w-0"><strong className="text-sm">{ingredient.name}</strong><p className="mt-1 text-xs">Disponible: <b className={isLowStock(ingredient.quantity, ingredient.minimum) ? "text-amber-500" : "text-[var(--text)]"}>{formatQuantity(ingredient.quantity)} {ingredient.unit}</b> · Mínimo: {formatQuantity(ingredient.minimum)} {ingredient.unit}{isLowStock(ingredient.quantity, ingredient.minimum) && " · Reponer"}</p><p className="text-xs">{ingredient.supplierIds.map((id) => catalog.suppliers.find((supplier) => supplier.id === id)?.name).filter(Boolean).join(", ") || "Sin proveedor"}</p></div><RowActions name={ingredient.name} onEdit={() => { setError(""); setDraft({ ...ingredient, quantity: String(ingredient.quantity), minimum: String(ingredient.minimum) }); }} onDelete={() => remove(ingredient)} /></div>)}</div> : <Empty>{catalog.ingredients.length ? "No encontramos insumos con ese nombre." : "Agregá tu primer insumo para comenzar a crear recetas."}</Empty>}
    {draft && <StockModal title={catalog.ingredients.some((item) => item.id === draft.id) ? "Editar insumo" : "Nuevo insumo"} onClose={() => setDraft(null)}><form onSubmit={save} className="grid gap-4">
      <label className={labelClass}>Nombre<input className={inputClass} required maxLength={80} value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} /></label>
      <div className="grid gap-4 sm:grid-cols-3"><label className={labelClass}>Unidad<select aria-label="Unidad" className={inputClass} value={draft.unit} disabled={ingredientInUse(catalog, draft.id)} onChange={(event) => setDraft({ ...draft, unit: event.target.value as Unit })}>{units.map((unit) => <option key={unit} value={unit}>{unit}</option>)}</select></label><label className={labelClass}>Cantidad actual<input className={inputClass} required type="number" min="0" max="1000000000" step="any" value={draft.quantity} onChange={(event) => setDraft({ ...draft, quantity: event.target.value })} /></label><label className={labelClass}>Stock mínimo<input className={inputClass} required type="number" min="0" max="1000000000" step="any" value={draft.minimum} onChange={(event) => setDraft({ ...draft, minimum: event.target.value })} /></label></div>
      {ingredientInUse(catalog, draft.id) && <p className="text-xs">La unidad está vinculada a una receta.</p>}
      <fieldset className="grid gap-2"><legend className="mb-2 text-xs font-medium text-[var(--muted)]">Proveedores <span>(opcional)</span></legend>{catalog.suppliers.length ? <div className="grid max-h-36 gap-2 overflow-auto rounded-lg border border-[var(--border)] p-3 sm:grid-cols-2">{catalog.suppliers.map((supplier) => <label className="flex items-center gap-2 text-sm" key={supplier.id}><input type="checkbox" checked={draft.supplierIds.includes(supplier.id)} onChange={(event) => setDraft({ ...draft, supplierIds: event.target.checked ? [...draft.supplierIds, supplier.id] : draft.supplierIds.filter((id) => id !== supplier.id) })} />{supplier.name}</label>)}</div> : <p className="text-xs">Podés agregarlos desde la sección Proveedores.</p>}</fieldset>
      {error && <p role="alert" className="text-sm text-red-500">{error}</p>}<div className="flex justify-end gap-2 border-t border-[var(--border)] pt-4"><button type="button" className="button" onClick={() => setDraft(null)}>Cancelar</button><button className="button primary" type="submit">Guardar insumo</button></div>
    </form></StockModal>}
  </section>;
}
