import { useState, type FormEvent } from "react";
import type { StockCatalog, Supplier } from "../types";
import { supplierInUse } from "../domain";
import { Empty, inputClass, labelClass, RowActions, SectionHeader, StockModal } from "./StockUI";

type Props = { catalog: StockCatalog; update: (next: StockCatalog) => Promise<boolean>; notify: (message: string) => void };
const newSupplier = (): Supplier => ({ id: crypto.randomUUID(), name: "", contact: "", phone: "", email: "", notes: "" });

export function Suppliers({ catalog, update, notify }: Props) {
  const [draft, setDraft] = useState<Supplier | null>(null);
  const [error, setError] = useState("");
  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (!draft) return;
    const name = draft.name.trim();
    if (!name) { setError("Ingresá el nombre del proveedor."); return; }
    if (catalog.suppliers.some((item) => item.id !== draft.id && item.name.toLocaleLowerCase("es-AR") === name.toLocaleLowerCase("es-AR"))) { setError("Ya existe un proveedor con ese nombre."); return; }
    const item = { ...draft, name, contact: draft.contact.trim(), phone: draft.phone.trim(), email: draft.email.trim(), notes: draft.notes.trim() };
    const suppliers = catalog.suppliers.some((supplier) => supplier.id === item.id) ? catalog.suppliers.map((supplier) => supplier.id === item.id ? item : supplier) : [...catalog.suppliers, item];
    if (await update({ ...catalog, suppliers })) { setDraft(null); notify("Proveedor guardado."); }
    else setError("No se pudo guardar. Revisá el almacenamiento del navegador y volvé a intentar.");
  };
  const remove = async (supplier: Supplier) => {
    if (supplierInUse(catalog, supplier.id)) { notify("Desvinculá este proveedor de los insumos antes de eliminarlo."); return; }
    if (window.confirm(`¿Eliminar a ${supplier.name}?`) && await update({ ...catalog, suppliers: catalog.suppliers.filter((item) => item.id !== supplier.id) })) notify("Proveedor eliminado.");
  };
  return <section className="overflow-hidden rounded-[20px] border border-[var(--border)] bg-[var(--surface)]">
    <SectionHeader title="Proveedores" description="Contactos vinculados a tus insumos." action="Nuevo proveedor" onAdd={() => { setError(""); setDraft(newSupplier()); }} />
    {catalog.suppliers.length ? <div className="divide-y divide-[var(--border)] px-5 sm:px-6">{catalog.suppliers.map((supplier) => <div key={supplier.id} className="flex flex-wrap items-center justify-between gap-3 py-4"><div className="min-w-0"><strong className="text-sm">{supplier.name}</strong><p className="mt-1 break-words text-xs">{[supplier.contact, supplier.phone, supplier.email].filter(Boolean).join(" · ") || "Sin datos de contacto"}</p><p className="text-xs">{catalog.ingredients.filter((ingredient) => ingredient.supplierIds.includes(supplier.id)).length} insumos vinculados</p></div><RowActions name={supplier.name} onEdit={() => { setError(""); setDraft({ ...supplier }); }} onDelete={() => remove(supplier)} /></div>)}</div> : <Empty>Todavía no agregaste proveedores.</Empty>}
    {draft && <StockModal title={catalog.suppliers.some((item) => item.id === draft.id) ? "Editar proveedor" : "Nuevo proveedor"} onClose={() => setDraft(null)}><form onSubmit={save} className="grid gap-4">
      <label className={labelClass}>Nombre<input className={inputClass} required maxLength={80} value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} /></label>
      <label className={labelClass}>Persona de contacto <span className="sr-only">opcional</span><input className={inputClass} maxLength={80} value={draft.contact} onChange={(event) => setDraft({ ...draft, contact: event.target.value })} /></label>
      <div className="grid gap-4 sm:grid-cols-2"><label className={labelClass}>Teléfono<input className={inputClass} type="tel" maxLength={40} value={draft.phone} onChange={(event) => setDraft({ ...draft, phone: event.target.value })} /></label><label className={labelClass}>Correo electrónico<input className={inputClass} type="email" maxLength={120} value={draft.email} onChange={(event) => setDraft({ ...draft, email: event.target.value })} /></label></div>
      <label className={labelClass}>Notas<input className={inputClass} maxLength={160} value={draft.notes} onChange={(event) => setDraft({ ...draft, notes: event.target.value })} /></label>
      {error && <p role="alert" className="text-sm text-red-500">{error}</p>}<div className="flex justify-end gap-2 border-t border-[var(--border)] pt-4"><button type="button" className="button" onClick={() => setDraft(null)}>Cancelar</button><button className="button primary" type="submit">Guardar proveedor</button></div>
    </form></StockModal>}
  </section>;
}
