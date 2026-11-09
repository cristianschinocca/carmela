import { useState, type FormEvent } from "react";
import { Save, Truck, X } from "lucide-react";
import type { StockCatalog, Supplier } from "../types";
import { supplierInUse } from "../domain";
import { Empty, inputClass, labelClass, RowActions, SectionHeader, StockListItem, StockModal } from "./StockUI";

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
    <SectionHeader icon={Truck} title="Proveedores" description="Contactos vinculados a tus insumos." action="Nuevo proveedor" onAdd={() => { setError(""); setDraft(newSupplier()); }} />
    {catalog.suppliers.length ? <div className="grid gap-3 p-5 sm:p-6">{catalog.suppliers.map((supplier) => <StockListItem key={supplier.id} icon={Truck} title={supplier.name} actions={<RowActions name={supplier.name} onEdit={() => { setError(""); setDraft({ ...supplier }); }} onDelete={() => remove(supplier)} />}>
      <span className="break-words">{[supplier.contact, supplier.phone, supplier.email].filter(Boolean).join(" · ") || "Sin datos de contacto"}</span><span>{catalog.ingredients.filter((ingredient) => ingredient.supplierIds.includes(supplier.id)).length} insumos vinculados</span>
    </StockListItem>)}</div> : <Empty>Todavía no agregaste proveedores.</Empty>}
    {draft && <StockModal title={catalog.suppliers.some((item) => item.id === draft.id) ? "Editar proveedor" : "Nuevo proveedor"} icon={Truck} description="Guardá sus datos para vincularlo a tus insumos." onClose={() => setDraft(null)}><form onSubmit={save} className="grid gap-4">
      <label className={labelClass}>Nombre<input className={inputClass} required maxLength={80} placeholder="Ej. Distribuidora de café" value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} /></label>
      <label className={labelClass}>Persona de contacto <span className="sr-only">opcional</span><input className={inputClass} maxLength={80} placeholder="Ej. María Pérez" value={draft.contact} onChange={(event) => setDraft({ ...draft, contact: event.target.value })} /></label>
      <div className="grid gap-4 sm:grid-cols-2"><label className={labelClass}>Teléfono<input className={inputClass} type="tel" placeholder="Ej. 11 1234-5678" maxLength={40} value={draft.phone} onChange={(event) => setDraft({ ...draft, phone: event.target.value })} /></label><label className={labelClass}>Correo electrónico<input className={inputClass} type="email" placeholder="Ej. pedidos@proveedor.com" maxLength={120} value={draft.email} onChange={(event) => setDraft({ ...draft, email: event.target.value })} /></label></div>
      <label className={labelClass}>Notas<input className={inputClass} maxLength={160} placeholder="Ej. Entrega los lunes" value={draft.notes} onChange={(event) => setDraft({ ...draft, notes: event.target.value })} /></label>
      {error && <p role="alert" className="text-sm text-red-500">{error}</p>}<div className="flex justify-end gap-2 border-t border-[var(--border)] pt-4"><button type="button" className="button" onClick={() => setDraft(null)}><X size={15} aria-hidden="true" /> Cancelar</button><button className="button primary" type="submit"><Save size={15} aria-hidden="true" /> Guardar proveedor</button></div>
    </form></StockModal>}
  </section>;
}
