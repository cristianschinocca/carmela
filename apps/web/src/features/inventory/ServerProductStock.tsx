import { useEffect, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { Package, Save, Search, X } from "lucide-react";
import { catalogClient, type CatalogCategory, type CatalogProduct, type CatalogWorkspace } from "../catalog/catalogClient";
import { inventoryClient, InventoryRequestError, type StockChange, type StockRecord } from "./inventoryClient";

type Snapshot = { products: CatalogProduct[]; categories: CatalogCategory[]; stock: StockRecord[] };
type Draft = { product: CatalogProduct; record: StockRecord | undefined; kind: StockChange["kind"]; amount: string; minimum: string; note: string };

export function ServerProductStock() {
  const [workspaces, setWorkspaces] = useState<CatalogWorkspace[]>([]);
  const [workspaceId, setWorkspaceId] = useState("");
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"todos" | "bajo" | "sin-control">("todos");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [pending, setPending] = useState<StockChange | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true); setError("");
    void catalogClient.workspaces().then((items) => {
      if (!active) return;
      const available = items.filter((item) => item.status === "active");
      setWorkspaces(available);
      if (!available.length) setError("No hay una cafetería activa vinculada a esta cuenta.");
      if (available.length === 1) setWorkspaceId(available[0].id);
    }).catch(() => { if (active) setError("No se pudieron cargar las cafeterías."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [revision]);

  useEffect(() => {
    let active = true;
    setSnapshot(null);
    if (!workspaceId) return;
    setLoading(true); setError("");
    void Promise.all([catalogClient.products(workspaceId), catalogClient.categories(workspaceId), inventoryClient.products(workspaceId)])
      .then(([products, categories, stock]) => { if (active) setSnapshot({ products, categories, stock }); })
      .catch(() => { if (active) setError("No se pudo cargar el stock de la cafetería. Intentá nuevamente."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [workspaceId, revision]);

  const records = new Map(snapshot?.stock.map((item) => [item.productId, item]) ?? []);
  const visible = snapshot?.products.filter((product) => {
    const category = snapshot.categories.find((item) => item.id === product.categoryId)?.name ?? "";
    const stock = records.get(product.id)?.stock;
    return `${product.name} ${category}`.toLocaleLowerCase("es-AR").includes(query.trim().toLocaleLowerCase("es-AR")) &&
      (filter === "todos" || (filter === "sin-control" ? !stock?.enabled : Boolean(stock?.enabled && stock.quantity <= stock.minimum)));
  }) ?? [];
  const open = (product: CatalogProduct) => {
    const record = records.get(product.id);
    setDraft({ product, record, kind: record?.stock?.enabled ? "entrada" : "ajuste", amount: "", minimum: String(record?.stock?.minimum ?? 0), note: "" });
    setPending(null); setFormError("");
  };
  const close = () => { if (!saving) { setDraft(null); setPending(null); setFormError(""); } };
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!draft || saving) return;
    const amount = Number(draft.amount), minimum = Number(draft.minimum);
    if (!pending && (!draft.amount.trim() || !draft.minimum.trim() || !Number.isSafeInteger(amount) || amount < 0 || (draft.kind !== "ajuste" && amount === 0) || !Number.isSafeInteger(minimum) || minimum < 0)) {
      setFormError("Ingresá cantidades enteras válidas."); return;
    }
    const change = pending ?? { id: crypto.randomUUID(), productId: draft.product.id, kind: draft.kind, amount, minimum, enabled: true, expectedVersion: draft.record?.stock?.version ?? 0, note: draft.note };
    setPending(change); setSaving(true); setFormError("");
    try {
      await inventoryClient.move(workspaceId, change);
      setDraft(null); setPending(null); setRevision((value) => value + 1);
    } catch (reason) {
      if (reason instanceof InventoryRequestError && reason.status < 500) {
        setPending(null);
        setFormError(`${reason.message} Cerrá y actualizá la vista antes de volver a intentarlo.`);
        setSnapshot(null);
      } else setFormError("No se pudo confirmar el movimiento. Reintentá para verificarlo sin duplicarlo.");
    } finally { setSaving(false); }
  };

  return <div className="stock-page">
    <p className="mb-3 text-sm text-[var(--muted)]">Control manual guardado por cafetería. Las recetas y las ventas del punto de venta todavía no actualizan este stock.</p>
    {workspaces.length > 1 && <label className="field mb-3">Cafetería<select value={workspaceId} disabled={saving || !!pending} onChange={(event) => { close(); setWorkspaceId(event.target.value); }}><option value="">Seleccionar cafetería</option>{workspaces.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>}
    {loading && <p role="status">Cargando stock…</p>}
    {error && <div role="alert">{error} <button className="button" type="button" onClick={() => setRevision((value) => value + 1)}>Reintentar</button></div>}
    {snapshot && <section className="panel stock-list-panel">
      <div className="stock-toolbar"><label className="search"><Search size={17} /><input aria-label="Buscar en stock" placeholder="Buscar producto o categoría…" value={query} onChange={(event) => setQuery(event.target.value)} /></label><div className="stock-filters" role="group" aria-label="Filtrar productos">{([['todos','Todos'],['bajo','Para reponer'],['sin-control','Sin control']] as const).map(([id, label]) => <button key={id} type="button" className={filter === id ? "active" : ""} aria-pressed={filter === id} onClick={() => setFilter(id)}>{label}</button>)}</div></div>
      <div className="stock-list-head"><span>Producto</span><span>Existencias</span><span>Mínimo</span><span>Acciones</span></div>
      <div className="stock-list">{visible.map((product) => { const stock = records.get(product.id)?.stock; return <div className="stock-row" key={product.id}><div className="stock-product"><span className="stock-product-icon"><Package size={17} /></span><div><strong>{product.name}</strong><small>{snapshot.categories.find((item) => item.id === product.categoryId)?.name}</small></div></div><div className="stock-quantity">{stock?.enabled ? <><strong className={stock.quantity <= stock.minimum ? "stock-alert-text" : ""}>{stock.quantity}</strong><small>Conteo manual</small></> : <span>Sin control</span>}</div><div>{stock?.enabled ? stock.minimum : "—"}</div><div className="stock-actions"><button className="button" type="button" onClick={() => open(product)}>{stock?.enabled ? "Gestionar stock" : "Controlar stock"}</button></div></div>; })}</div>
      {!visible.length && <div className="stock-empty">No hay productos para mostrar.</div>}
    </section>}
    {draft && createPortal(<div className="modal-scrim stock-modal-scrim" onPointerDown={(event) => { if (event.target === event.currentTarget && !pending) close(); }}><section className="acrylic-modal stock-modal" role="dialog" aria-modal="true" aria-labelledby="remote-stock-title" onKeyDown={(event) => { if (event.key === "Escape" && !pending) close(); }}><button type="button" className="modal-close" aria-label="Cerrar" disabled={saving || !!pending} onClick={close}><X size={18} /></button><span className="stock-modal-icon"><Package size={19} /></span><h2 id="remote-stock-title">{draft.product.name}</h2><p>{draft.record?.stock?.enabled ? `Disponible: ${draft.record.stock.quantity} unidades` : "Activá el control con un conteo inicial."}</p><form className="stock-form" onSubmit={(event) => void submit(event)}><fieldset disabled={saving || !!pending} className="grid gap-4"><label className="field">Movimiento<select value={draft.kind} onChange={(event) => setDraft({ ...draft, kind: event.target.value as Draft["kind"], amount: "" })}><option value="ajuste">Fijar cantidad real</option>{draft.record?.stock?.enabled && <><option value="entrada">Entrada de unidades</option><option value="salida">Salida de unidades</option></>}</select></label><div className="stock-form-grid"><label className="field">{draft.kind === "ajuste" ? "Cantidad real" : "Unidades"}<input type="number" min={draft.kind === "ajuste" ? 0 : 1} max="2147483646" step="1" required autoFocus placeholder="Ej. 20" value={draft.amount} onChange={(event) => setDraft({ ...draft, amount: event.target.value })} /></label><label className="field">Avisar al llegar a<input type="number" min="0" max="2147483646" step="1" required value={draft.minimum} onChange={(event) => setDraft({ ...draft, minimum: event.target.value })} /></label></div><label className="field">Motivo (opcional)<input maxLength={500} placeholder="Ej. Compra a proveedor" value={draft.note} onChange={(event) => setDraft({ ...draft, note: event.target.value })} /></label></fieldset>{formError && <p role="alert">{formError}</p>}<div className="stock-form-actions"><button type="button" className="button" disabled={saving} onClick={() => { const refresh = !!pending || !snapshot; close(); if (refresh) setRevision((value) => value + 1); }}>{pending ? "Cerrar y actualizar" : "Cancelar"}</button><button type="submit" className="button primary" disabled={saving || !snapshot}><Save size={15} /> {saving ? "Guardando…" : pending ? "Reintentar confirmación" : "Guardar movimiento"}</button></div></form></section></div>, document.body)}
  </div>;
}
