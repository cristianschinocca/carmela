import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Plus, X } from "lucide-react";

export const inputClass = "w-full min-w-0 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-sm text-[var(--text)] outline-none focus:border-[var(--brand)]";
export const labelClass = "grid gap-1.5 text-xs font-medium text-[var(--muted)]";

export function SectionHeader({ title, description, action, onAdd, disabled = false }: { title: string; description: string; action: string; onAdd: () => void; disabled?: boolean }) {
  return <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--border)] p-5 sm:p-6">
    <div><h2>{title}</h2><p className="mt-1">{description}</p></div>
    <button className="button primary" onClick={onAdd} disabled={disabled}><Plus size={16} />{action}</button>
  </div>;
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="px-6 py-12 text-center text-sm text-[var(--muted)]">{children}</p>;
}

export function StockModal({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
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
      <span className="eyebrow">GESTIÓN DE STOCK</span><h2 id="stock-editor-title" className="mt-2 mb-6 pr-10 text-xl">{title}</h2>
      {children}
    </section>
  </div>, document.body);
}

export function RowActions({ name, onEdit, onDelete }: { name: string; onEdit: () => void; onDelete: () => void }) {
  return <div className="flex shrink-0 gap-2"><button className="button" onClick={onEdit} aria-label={`Editar ${name}`}>Editar</button><button className="button danger-button" onClick={onDelete} aria-label={`Eliminar ${name}`}>Eliminar</button></div>;
}
