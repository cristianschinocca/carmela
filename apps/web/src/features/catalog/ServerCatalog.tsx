import { useEffect, useMemo, useRef, useState } from "react";
import type { Product } from "../../data";
import { ProductManager } from "../../components/products/ProductManager";
import { catalogClient, type CatalogCategory, type CatalogProduct, type CatalogWorkspace } from "./catalogClient";

type Snapshot = { categories: CatalogCategory[]; products: CatalogProduct[] };
const move = <T,>(items: T[], from: number, to: number) => { const next = [...items]; const [item] = next.splice(from, 1); next.splice(to, 0, item); return next; };

export function ServerCatalog() {
  const [workspaces, setWorkspaces] = useState<CatalogWorkspace[]>([]);
  const [workspaceId, setWorkspaceId] = useState("");
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const generation = useRef(0);
  const locked = useRef(false);

  useEffect(() => {
    let active = true;
    setLoading(true); setError("");
    void catalogClient.workspaces().then((items) => {
      if (!active) return;
      const activeWorkspaces = items.filter((item) => item.status === "active");
      setWorkspaces(activeWorkspaces);
      if (activeWorkspaces.length === 1) setWorkspaceId(activeWorkspaces[0].id);
      else if (!activeWorkspaces.length) setError("No hay una cafetería activa vinculada a esta cuenta.");
    }).catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : "No se pudieron cargar las cafeterías."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [revision]);

  useEffect(() => {
    const version = ++generation.current;
    setSnapshot(null);
    if (!workspaceId) return;
    setLoading(true); setError("");
    void Promise.all([catalogClient.categories(workspaceId), catalogClient.products(workspaceId)]).then(([categories, products]) => {
      if (version !== generation.current) return;
      if (products.some((p) => !Number.isSafeInteger(p.legacyId) || !categories.some((c) => c.id === p.categoryId))) throw new Error("El catálogo recibido está incompleto.");
      setSnapshot({ categories, products });
    }).catch((reason: unknown) => { if (version === generation.current) setError(reason instanceof Error ? reason.message : "No se pudo cargar el catálogo."); })
      .finally(() => { if (version === generation.current) setLoading(false); });
    return () => { generation.current++; };
  }, [workspaceId, revision]);

  const products = useMemo<Product[]>(() => snapshot?.products.map((p) => ({ id: p.legacyId, name: p.name, category: snapshot.categories.find((c) => c.id === p.categoryId)?.name ?? "", description: p.description, price: p.price, image: p.image, available: p.available, onlineVisible: p.onlineVisible })) ?? [], [snapshot]);
  const run = async (action: (data: Snapshot, id: string) => Promise<unknown>) => {
    if (!snapshot || !workspaceId || locked.current) return false;
    locked.current = true; setBusy(true); setError("");
    const version = generation.current;
    let saved = false;
    try {
      await action(snapshot, workspaceId); saved = true;
      const [categories, products] = await Promise.all([catalogClient.categories(workspaceId), catalogClient.products(workspaceId)]);
      if (version !== generation.current) return true;
      setSnapshot({ categories, products });
      return true;
    } catch (reason) {
      if (version === generation.current) {
        setSnapshot(null);
        setError(saved ? "El cambio se guardó, pero no se pudo actualizar la vista. Volvé a cargar el catálogo." : `${reason instanceof Error ? reason.message : "No se pudo confirmar el cambio."} Volvé a cargar el catálogo antes de reintentar.`);
      }
      return saved;
    } finally { locked.current = false; if (version === generation.current) setBusy(false); }
  };

  if (loading) return <p role="status">Cargando catálogo…</p>;
  if (!workspaceId) return <div className="grid gap-3"><p role={error ? "alert" : undefined}>{error || "Seleccioná una cafetería para administrar sus productos."}</p>{error && <button type="button" className="button" onClick={() => setRevision((v) => v + 1)}>Reintentar</button>}{workspaces.length > 1 && <select aria-label="Cafetería" value="" onChange={(event) => setWorkspaceId(event.target.value)}><option value="">Seleccionar cafetería</option>{workspaces.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>}</div>;
  if (!snapshot) return <div className="grid gap-3"><p role="alert">{error || "No se pudo cargar el catálogo."}</p><button type="button" className="button" onClick={() => setRevision((v) => v + 1)}>Reintentar</button></div>;

  return <div className="grid gap-4">
    <p className="text-sm text-[var(--muted)]">Catálogo de {workspaces.find((w) => w.id === workspaceId)?.name}. El punto de venta, las recetas y el menú digital todavía usan datos locales.</p>
    {workspaces.length > 1 && <label>Cafetería <select aria-label="Cafetería" value={workspaceId} disabled={busy} onChange={(event) => { setSnapshot(null); setWorkspaceId(event.target.value); }}>{workspaces.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>}
    {error && <p role="alert">{error}</p>}
    <ProductManager error={error} busy={busy} products={products} categories={snapshot.categories.map((c) => c.name)}
      onSave={(p) => run(async (s, id) => { const category = s.categories.find((c) => c.name === p.category); if (!category) throw new Error("Creá o elegí una categoría."); const old = s.products.find((item) => item.legacyId === p.id); await catalogClient.saveProduct(id, { name: p.name, categoryId: category.id, description: p.description, price: p.price, image: p.image, available: p.available, onlineVisible: p.onlineVisible !== false, position: old?.position ?? Math.max(-1, ...s.products.map((item) => item.position)) + 1 }, old?.id); })}
      onDelete={(id) => run(async (s, workspace) => { const p = s.products.find((item) => item.legacyId === id); if (!p) throw new Error("El producto ya no existe."); await catalogClient.deleteProduct(workspace, p.id); })}
      onReorder={(from, to) => run(async (s, workspace) => { const a = s.products.findIndex((p) => p.legacyId === from), b = s.products.findIndex((p) => p.legacyId === to); if (a < 0 || b < 0) throw new Error("El catálogo cambió."); await catalogClient.reorder(workspace, "products", move(s.products, a, b).map((p) => p.id)); })}
      onAddCategory={(name) => run(async (s, workspace) => { if (!name || s.categories.some((c) => c.name.toLocaleLowerCase("es") === name.toLocaleLowerCase("es"))) throw new Error("Ese nombre ya existe."); await catalogClient.saveCategory(workspace, { name, position: Math.max(-1, ...s.categories.map((item) => item.position)) + 1 }); })}
      onRenameCategory={(name, next) => run(async (s, workspace) => { const c = s.categories.find((item) => item.name === name); if (!c || !next || s.categories.some((item) => item.id !== c.id && item.name.toLocaleLowerCase("es") === next.toLocaleLowerCase("es"))) throw new Error("Ese nombre no está disponible."); await catalogClient.saveCategory(workspace, { name: next, position: c.position }, c.id); })}
      onDeleteCategory={(name) => run(async (s, workspace) => { const c = s.categories.find((item) => item.name === name); if (!c) throw new Error("La categoría ya no existe."); await catalogClient.deleteCategory(workspace, c.id); })}
      onReorderCategory={(from, to) => run(async (s, workspace) => { const a = s.categories.findIndex((c) => c.name === from), b = s.categories.findIndex((c) => c.name === to); if (a < 0 || b < 0) throw new Error("Las categorías cambiaron."); await catalogClient.reorder(workspace, "categories", move(s.categories, a, b).map((c) => c.id)); })}
    />
  </div>;
}
