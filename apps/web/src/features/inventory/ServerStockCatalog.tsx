import { useEffect, useRef, useState } from "react";
import type { Product } from "../../data";
import { Ingredients } from "../../stock/components/Ingredients";
import { Recipes } from "../../stock/components/Recipes";
import type { StockCatalog, Unit } from "../../stock/types";
import { catalogClient, type CatalogWorkspace } from "../catalog/catalogClient";

type Ingredient = { id: string; name: string; unit: Unit; quantity: string; minimum: string; version: number };
type Recipe = { id: string; name: string; productId: string; version: number; ingredients: { ingredientId: string; quantity: string; unit: Unit }[] };
type Data = { catalog: StockCatalog; products: Product[]; productIds: Map<number, string>; ingredients: Ingredient[]; recipes: Recipe[] };
type Props = { section: "insumos" | "recetas"; notify: (message: string) => void };

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(path, { credentials: "same-origin", cache: "no-store", ...options });
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { error?: string } | null;
    throw new Error(body?.error || "No se pudo completar la operación.");
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}
const pathFor = (id: string) => `/api/workspaces/${encodeURIComponent(id)}/inventory`;
async function load(id: string): Promise<Data> {
  const base = pathFor(id);
  const [ingredients, recipes, products, categories] = await Promise.all([
    request<Ingredient[]>(`${base}/ingredients`), request<Recipe[]>(`${base}/recipes`), catalogClient.products(id), catalogClient.categories(id),
  ]);
  const productIds = new Map(products.map((product) => [product.legacyId, product.id]));
  const legacyIds = new Map(products.map((product) => [product.id, product.legacyId]));
  if (recipes.some((recipe) => !legacyIds.has(recipe.productId))) throw new Error("Una receta tiene un producto no disponible.");
  return {
    ingredients, recipes, productIds,
    products: products.map((product) => ({ id: product.legacyId, name: product.name, category: categories.find((c) => c.id === product.categoryId)?.name ?? "", description: product.description, price: product.price, image: product.image, available: product.available, onlineVisible: product.onlineVisible })),
    catalog: { suppliers: [], ingredients: ingredients.map((item) => ({ ...item, quantity: Number(item.quantity), minimum: Number(item.minimum), supplierIds: [] })), recipes: recipes.map((item) => ({ id: item.id, name: item.name, productId: legacyIds.get(item.productId)!, ingredients: item.ingredients.map((line) => ({ ...line, quantity: Number(line.quantity) })) })) },
  };
}

export function ServerStockCatalog({ section, notify }: Props) {
  const [workspaces, setWorkspaces] = useState<CatalogWorkspace[]>([]);
  const [workspace, setWorkspace] = useState("");
  const [data, setData] = useState<Data | null>(null);
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const saving = useRef(false);
  const generation = useRef(0);
  useEffect(() => {
    let active = true;
    setLoading(true);
    void catalogClient.workspaces().then((items) => {
      if (!active) return;
      const available = items.filter((item) => item.status === "active");
      setWorkspaces(available);
      if (available.length === 1) setWorkspace(available[0].id);
      if (!available.length) setError("No hay una cafetería activa vinculada a esta cuenta.");
    }).catch(() => { if (active) setError("No se pudieron cargar las cafeterías."); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [revision]);
  useEffect(() => {
    const current = ++generation.current;
    setData(null);
    if (!workspace) return;
    setLoading(true); setError("");
    void load(workspace).then((result) => { if (current === generation.current) setData(result); }).catch((reason: unknown) => { if (current === generation.current) setError(reason instanceof Error ? reason.message : "No se pudo cargar stock."); }).finally(() => { if (current === generation.current) setLoading(false); });
    return () => { generation.current++; };
  }, [workspace, revision]);

  const update = async (next: StockCatalog) => {
    if (!data || !workspace || saving.current) return false;
    const before = section === "insumos" ? data.catalog.ingredients : data.catalog.recipes;
    const after = section === "insumos" ? next.ingredients : next.recipes;
    const removed = before.filter((item) => !after.some((candidate) => candidate.id === item.id));
    const changed = after.filter((item) => JSON.stringify(item) !== JSON.stringify(before.find((candidate) => candidate.id === item.id)));
    if (removed.length + changed.length !== 1) { setError("No se pudo identificar el cambio. Actualizá la vista."); return false; }
    const item = changed[0] ?? removed[0];
    const previous = section === "insumos" ? data.ingredients.find((entry) => entry.id === item.id) : data.recipes.find((entry) => entry.id === item.id);
    const endpoint = section === "insumos" ? "ingredients" : "recipes";
    const target = `${pathFor(workspace)}/${endpoint}${previous ? `/${encodeURIComponent(item.id)}` : ""}`;
    let payload: unknown;
    if (removed.length) payload = { version: previous?.version };
    else if (section === "insumos") {
      const ingredient = next.ingredients.find((entry) => entry.id === item.id)!;
      payload = { name: ingredient.name, unit: ingredient.unit, quantity: ingredient.quantity, minimum: ingredient.minimum, version: previous?.version };
    } else {
      const recipe = next.recipes.find((entry) => entry.id === item.id)!;
      const productId = data.productIds.get(recipe.productId);
      if (!productId) { setError("El producto ya no está disponible."); return false; }
      payload = { name: recipe.name, productId, ingredients: recipe.ingredients, version: previous?.version };
    }
    saving.current = true; setError("");
    const current = generation.current;
    try {
      await request(target, { method: removed.length ? "DELETE" : previous ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const result = await load(workspace);
      if (current === generation.current) setData(result);
      return true;
    } catch (reason) {
      if (current === generation.current) { setData(null); setError(`${reason instanceof Error ? reason.message : "No se pudo confirmar el cambio."} Actualizá antes de volver a intentarlo.`); }
      return false;
    } finally { saving.current = false; }
  };
  return <div className="grid gap-4">
    <p className="text-sm text-[var(--muted)]">Insumos y recetas de la cafetería. Los proveedores y los descuentos por ventas aún se gestionan localmente.</p>
    {workspaces.length > 1 && <label>Cafetería <select aria-label="Cafetería" value={workspace} onChange={(event) => setWorkspace(event.target.value)}><option value="">Seleccionar cafetería</option>{workspaces.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>}
    {loading && <p role="status">Cargando…</p>}
    {error && <p role="alert">{error} <button type="button" className="button" onClick={() => setRevision((value) => value + 1)}>Actualizar</button></p>}
    {!loading && data && (section === "insumos" ? <Ingredients catalog={data.catalog} update={update} notify={notify} /> : <Recipes catalog={data.catalog} products={data.products} update={update} notify={notify} server />)}
  </div>;
}
