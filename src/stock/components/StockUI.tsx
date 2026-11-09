import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Boxes, Pencil, Plus, Trash2, X, type LucideIcon } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";

export const inputClass = "w-full min-w-0 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-sm text-[var(--text)] outline-none focus:border-[var(--brand)]";
export const labelClass = "grid gap-1.5 text-xs font-medium text-[var(--muted)]";

export function SectionHeader({ title, description, action, onAdd, disabled = false, icon: Icon = Boxes }: { title: string; description: string; action: string; onAdd: () => void; disabled?: boolean; icon?: LucideIcon }) {
  return <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--border)] p-5 sm:p-6">
    <div className="flex items-center gap-3"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[var(--brand-soft)] text-[var(--brand-deep)]"><Icon size={20} aria-hidden="true" /></span><div><h2>{title}</h2><p className="mt-1 !text-[11px]">{description}</p></div></div>
    <Button className="!h-10 !rounded-lg !bg-[var(--brand)] !px-4 !text-[11px] !text-white hover:!opacity-90" onClick={onAdd} disabled={disabled}><Plus size={16} />{action}</Button>
  </div>;
}

export function StockListItem({ icon: Icon, title, children, actions }: { icon: LucideIcon; title: string; children: ReactNode; actions: ReactNode }) {
  return <Card className="!gap-0 !rounded-xl !border-[var(--border)] !bg-[var(--surface)] !p-4 !text-[var(--text)] !shadow-none">
    <div className="flex flex-wrap items-start justify-between gap-4 sm:items-center"><div className="flex min-w-0 flex-1 items-start gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-[var(--border)] bg-[var(--brand-soft)] text-[var(--brand-deep)]"><Icon size={18} aria-hidden="true" /></span><div className="min-w-0"><h3 className="text-[11px] font-semibold">{title}</h3><div className="mt-1 grid gap-1 text-[10px] text-[var(--muted)]">{children}</div></div></div>{actions}</div>
  </Card>;
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="px-6 py-12 text-center text-sm text-[var(--muted)]">{children}</p>;
}

export function StockModal({ title, description, icon: Icon = Boxes, children, onClose }: { title: string; description?: string; icon?: LucideIcon; children: ReactNode; onClose: () => void }) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    (ref.current?.querySelector<HTMLElement>("input:not([disabled]),select:not([disabled])") || ref.current?.querySelector<HTMLElement>("button"))?.focus();
    return () => previous?.focus();
  }, []);
  return createPortal(<div className="modal-scrim stock-modal-scrim" onPointerDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section ref={ref} role="dialog" aria-modal="true" aria-labelledby="stock-editor-title" onKeyDown={(event) => {
      if (event.key === "Escape") { event.stopPropagation(); onClose(); return; }
      if (event.key !== "Tab") return;
      const controls = Array.from(ref.current?.querySelectorAll<HTMLElement>("button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled])") || []);
      const first = controls[0], last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }} className="relative max-h-[calc(100dvh-32px)] w-full max-w-xl overflow-y-auto rounded-[20px] border border-[var(--border)] bg-[var(--surface)] p-6 text-[var(--text)] shadow-2xl sm:p-7">
      <button type="button" aria-label="Cerrar" onClick={onClose} className="absolute right-5 top-5 rounded-lg p-2 text-[var(--muted)] hover:bg-[var(--brand-soft)]"><X size={18} /></button>
      <div className="mb-6 flex items-start gap-3 pr-10"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[var(--brand-soft)] text-[var(--brand-deep)]"><Icon size={19} aria-hidden="true" /></span><div><span className="eyebrow">GESTIÓN DE STOCK</span><h2 id="stock-editor-title" className="mt-1 text-xl">{title}</h2>{description && <p className="mt-1 text-xs">{description}</p>}</div></div>
      {children}
    </section>
  </div>, document.body);
}

export function RowActions({ name, onEdit, onDelete }: { name: string; onEdit: () => void; onDelete: () => void }) {
  return <div className="flex shrink-0 gap-2"><Button type="button" variant="outline" className="!h-9 !rounded-lg !border-[var(--border)] !bg-transparent !text-[11px] !text-[var(--text)]" onClick={onEdit} aria-label={`Editar ${name}`}><Pencil size={15} />Editar</Button><Button type="button" variant="outline" className="!h-9 !rounded-lg !border-[var(--border)] !bg-transparent !text-[11px] !text-[var(--muted)] hover:!text-red-500" onClick={onDelete} aria-label={`Eliminar ${name}`}><Trash2 size={15} />Eliminar</Button></div>;
}
