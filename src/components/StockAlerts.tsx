import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, Bell, TriangleAlert } from "lucide-react";
import type { Product } from "../data";
import type { Stock } from "../stores/inventory";
import { fadeUp } from "../motion";

type Props = {
  products: Product[];
  stock: Stock;
  onOpenStock: () => void;
};

export function StockAlerts({ products, stock, onOpenStock }: Props) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const alerts = products
    .filter((product) => stock[product.id]?.enabled && stock[product.id].quantity <= stock[product.id].minimum)
    .sort((a, b) => stock[a.id].quantity - stock[b.id].quantity);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return <div className="rail-stock-alerts" ref={containerRef}>
    <button
      type="button"
      className="utility-rail-button rail-alert-button"
      aria-label={alerts.length ? `Notificaciones: ${alerts.length} ${alerts.length === 1 ? "producto" : "productos"} con stock bajo` : "Notificaciones: sin alertas de stock"}
      aria-expanded={open}
      aria-controls="stock-alert-popover"
      title="Notificaciones de stock"
      onClick={() => setOpen((value) => !value)}
    >
      <Bell size={19} />
      {alerts.length > 0 && <span className="rail-alert-count">{alerts.length > 9 ? "9+" : alerts.length}</span>}
    </button>
    <AnimatePresence>
      {open && <motion.section
        id="stock-alert-popover"
        className="stock-alert-popover"
        role="region"
        aria-label="Notificaciones de stock"
        variants={fadeUp}
        initial="hidden"
        animate="visible"
        exit="exit"
      >
        <div className="stock-alert-heading"><span className="stock-alert-heading-icon"><Bell size={16} /></span><div><strong>Notificaciones</strong><small>{alerts.length ? `${alerts.length} ${alerts.length === 1 ? "producto necesita" : "productos necesitan"} reposición` : "Todo al día"}</small></div></div>
        {alerts.length ? <div className="stock-alert-list">{alerts.map((product) => {
          const item = stock[product.id];
          return <button type="button" key={product.id} className="stock-alert-item" onClick={() => { setOpen(false); onOpenStock(); }}>
            <span className="stock-alert-item-icon"><TriangleAlert size={16} /></span>
            <span><strong>{product.name}</strong><small>{item.quantity <= 0 ? "Sin stock" : `${item.quantity} disponibles`} · mínimo ${item.minimum}</small></span>
            <ArrowRight size={15} />
          </button>;
        })}</div> : <p className="stock-alert-empty">No hay productos con stock bajo.</p>}
        <button type="button" className="stock-alert-footer" onClick={() => { setOpen(false); onOpenStock(); }}>Ver stock <ArrowRight size={15} /></button>
      </motion.section>}
    </AnimatePresence>
  </div>;
}
