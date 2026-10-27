import type React from "react";
import { Check } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { money } from "../data";
import { fadeUp, press, staggerContainer, subtleHover } from "../motion";

export function Metric({
  icon,
  label,
  value,
  detail,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  detail?: string;
  sub: string;
}) {
  const valueKey =
    typeof value === "string" || typeof value === "number"
      ? String(value)
      : label;
  return (
    <motion.section
      className="metric"
      variants={fadeUp}
      initial="hidden"
      animate="visible"
      whileHover={subtleHover}
      whileTap={press}
    >
      <div className="metric-label">
        <span>{label}</span>
        <span className="round-icon">{icon}</span>
      </div>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.strong
          key={valueKey}
          className="metric-value"
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -3 }}
        >
          {value}
        </motion.strong>
      </AnimatePresence>
      <div className="metric-bottom">
        {detail && <span className="trend">↗ {detail}</span>}
        <span>{sub}</span>
      </div>
    </motion.section>
  );
}

export function Orders({
  handled,
  onHandle,
}: {
  handled: number[];
  onHandle: (id: number) => void;
}) {
  const rows = [
    {
      id: 1048,
      place: "Mesa 04",
      time: "Hace 3 min",
      status: "Listo",
      price: 8000,
    },
    {
      id: 1047,
      place: "Para llevar",
      time: "Hace 5 min",
      status: "En preparación",
      price: 7000,
    },
    {
      id: 1046,
      place: "Mesa 02",
      time: "Hace 8 min",
      status: "En preparación",
      price: 15500,
    },
    {
      id: 1045,
      place: "Mesa 08",
      time: "Hace 12 min",
      status: "Entregado",
      price: 11200,
    },
  ];
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Pedido</th>
            <th>Destino</th>
            <th>Estado</th>
            <th>Total</th>
            <th aria-label="Acción" />
          </tr>
        </thead>
        <motion.tbody
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
        >
          {rows.map((o) => (
            <motion.tr key={o.id} variants={fadeUp} layout>
              <td>
                <strong>#{o.id}</strong>
                <small>{o.time}</small>
              </td>
              <td>{o.place}</td>
              <td>
                <AnimatePresence mode="popLayout" initial={false}>
                  <motion.span
                    key={handled.includes(o.id) ? "Entregado" : o.status}
                    className={
                      "badge " +
                      (handled.includes(o.id) || o.status === "Entregado"
                        ? "done"
                        : o.status === "Listo"
                          ? "ready"
                          : "preparing")
                    }
                    initial={{ opacity: 0, scale: 0.96 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.96 }}
                  >
                    <i />
                    {handled.includes(o.id) ? "Entregado" : o.status}
                  </motion.span>
                </AnimatePresence>
              </td>
              <td>
                <strong>{money(o.price)}</strong>
              </td>
              <td>
                <AnimatePresence mode="wait" initial={false}>
                  {o.status === "Listo" && !handled.includes(o.id) ? (
                    <motion.button
                      key="deliver"
                      className="deliver"
                      whileTap={press}
                      exit={{ opacity: 0, scale: 0.9 }}
                      onClick={() => onHandle(o.id)}
                    >
                      Entregar
                    </motion.button>
                  ) : (
                    <motion.span
                      key="done"
                      initial={{ opacity: 0, scale: 0.7 }}
                      animate={{ opacity: 1, scale: 1 }}
                    >
                      <Check size={15} className="muted-check" />
                    </motion.span>
                  )}
                </AnimatePresence>
              </td>
            </motion.tr>
          ))}
        </motion.tbody>
      </table>
    </div>
  );
}
