import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { motion } from "motion/react";
import {
  ArrowDownRight,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  Coffee,
  Package,
  ReceiptText,
  UsersRound,
  Wallet,
} from "lucide-react";
import type { Product } from "../data";
import { money } from "../data";
import { fadeUp, press, staggerContainer } from "../motion";
import { loadSales } from "../stores/sales";

const monthFormatter = new Intl.DateTimeFormat("es-AR", {
  month: "long",
  year: "numeric",
});
const integerFormatter = new Intl.NumberFormat("es-AR");

export function SalesReports({ products }: { products: Product[] }) {
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const sales = useMemo(() => loadSales(), []);
  const selectedSales = useMemo(
    () =>
      sales.filter((sale) => {
        const date = new Date(sale.closedAt);
        return (
          date.getFullYear() === month.getFullYear() &&
          date.getMonth() === month.getMonth()
        );
      }),
    [sales, month],
  );
  const totalSales = selectedSales.reduce((sum, sale) => sum + sale.total, 0);
  const covers = selectedSales.reduce((sum, sale) => sum + sale.guests, 0);
  const averageTicket = selectedSales.length ? totalSales / selectedSales.length : 0;
  const itemsSold = selectedSales.reduce(
    (sum, sale) => sum + sale.items.reduce((lineSum, line) => lineSum + line.quantity, 0),
    0,
  );
  const productStats = useMemo(() => {
    const totals = new Map<number, { name: string; category: string; quantity: number; revenue: number }>();
    selectedSales.forEach((sale) => {
      const gross = sale.items.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0);
      const netFactor = gross > 0 ? sale.total / gross : 1;
      sale.items.forEach((line) => {
        const current = totals.get(line.productId) ?? {
          name: line.name,
          category: line.category,
          quantity: 0,
          revenue: 0,
        };
        current.quantity += line.quantity;
        current.revenue += line.quantity * line.unitPrice * netFactor;
        totals.set(line.productId, current);
      });
    });
    return totals;
  }, [selectedSales]);
  const topProducts = [...productStats.values()]
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 5);
  const categories = new Map<string, number>();
  selectedSales.forEach((sale) => {
    const gross = sale.items.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0);
    const netFactor = gross > 0 ? sale.total / gross : 1;
    sale.items.forEach((line) =>
      categories.set(
        line.category,
        (categories.get(line.category) ?? 0) + line.quantity * line.unitPrice * netFactor,
      ),
    );
  });
  const noSalesProducts = selectedSales.length
    ? products
        .filter((product) => product.available && !productStats.has(product.id))
        .slice(0, 6)
    : [];
  const categoryStats = [...categories.entries()].sort((a, b) => b[1] - a[1]);
  const paymentStats = [...selectedSales.reduce((totals, sale) => {
    totals.set(sale.payment, (totals.get(sale.payment) ?? 0) + sale.total);
    return totals;
  }, new Map<string, number>()).entries()].sort((a, b) => b[1] - a[1]);
  const recentSales = [...selectedSales]
    .sort((a, b) => b.closedAt.localeCompare(a.closedAt))
    .slice(0, 6);
  const monthDays = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const weeks = Array.from({ length: Math.ceil(monthDays / 7) }, (_, index) => {
    const fromDay = index * 7 + 1;
    const toDay = Math.min(fromDay + 6, monthDays);
    const total = selectedSales
      .filter((sale) => {
        const day = new Date(sale.closedAt).getDate();
        return day >= fromDay && day <= toDay;
      })
      .reduce((sum, sale) => sum + sale.total, 0);
    return { label: `${fromDay}–${toDay}`, total };
  });
  const maxWeek = Math.max(...weeks.map((week) => week.total), 1);

  const moveMonth = (amount: number) =>
    setMonth((current) => new Date(current.getFullYear(), current.getMonth() + amount, 1));

  return (
    <div className="sales-reports">
      <div className="reports-toolbar">
        <div>
          <span className="eyebrow">LECTURA DEL NEGOCIO</span>
          <p>Ventas, cubiertos y productos para entender cómo se mueve Carmela.</p>
        </div>
        <div className="report-month-control" aria-label="Período del reporte">
          <motion.button whileTap={press} aria-label="Mes anterior" onClick={() => moveMonth(-1)}>
            <ChevronLeft size={17} />
          </motion.button>
          <strong>{monthFormatter.format(month)}</strong>
          <motion.button
            whileTap={press}
            aria-label="Mes siguiente"
            disabled={month.getFullYear() === new Date().getFullYear() && month.getMonth() === new Date().getMonth()}
            onClick={() => moveMonth(1)}
          >
            <ChevronRight size={17} />
          </motion.button>
        </div>
      </div>

      <motion.div className="metrics reports-metrics" variants={staggerContainer} initial="hidden" animate="visible">
        <ReportMetric icon={<Wallet size={18} />} label="Ventas del mes" value={money(totalSales)} detail={`${selectedSales.length} cuentas cerradas`} />
        <ReportMetric icon={<UsersRound size={18} />} label="Cubiertos" value={integerFormatter.format(covers)} detail="Personas registradas en las mesas" />
        <ReportMetric icon={<ReceiptText size={18} />} label="Ticket promedio" value={money(averageTicket)} detail="Promedio por cuenta cerrada" />
        <ReportMetric icon={<Coffee size={18} />} label="Unidades vendidas" value={integerFormatter.format(itemsSold)} detail="Productos comandados y cobrados" />
      </motion.div>

      <div className="reports-grid">
        <section className="panel report-sales-chart">
          <div className="panel-heading">
            <div><h2>Ventas por semana</h2><p>Facturación de cada tramo del mes.</p></div>
            <span className="report-chart-legend"><i /> Ventas</span>
          </div>
          {selectedSales.length ? (
            <div className="weekly-chart" role="img" aria-label="Ventas semanales del mes">
              {weeks.map((week) => (
                <div className="weekly-column" key={week.label}>
                  <span className="weekly-value">{week.total ? money(week.total) : "—"}</span>
                  <div className="weekly-track"><motion.i initial={{ height: 0 }} animate={{ height: `${week.total ? Math.max(5, week.total / maxWeek * 100) : 0}%` }} transition={{ duration: .42 }} /></div>
                  <small>{week.label}</small>
                </div>
              ))}
            </div>
          ) : <ReportEmpty icon={<Wallet size={22} />} title="Todavía no hay ventas en este mes" copy="Las cuentas cobradas desde el punto de venta van a aparecer acá." />}
        </section>

        <section className="panel category-report">
          <div className="panel-heading"><div><h2>Ventas por categoría</h2><p>Qué parte de la facturación aporta cada rubro.</p></div></div>
          {categoryStats.length ? categoryStats.map(([name, amount]) => (
            <div className="report-row" key={name}>
              <strong>{name}</strong>
              <div><span style={{ width: `${totalSales ? amount / totalSales * 100 : 0}%` }} /></div>
              <b>{money(amount)}</b>
            </div>
          )) : <ReportEmpty icon={<Package size={22} />} title="Sin ventas por categoría" copy="El detalle se completa al cerrar cuentas." />}
        </section>

        <section className="panel product-performance">
          <div className="panel-heading"><div><h2>Lo que más se vende</h2><p>Productos ordenados por unidades.</p></div><ArrowUpRight size={17} className="report-positive" /></div>
          {topProducts.length ? topProducts.map((product, index) => (
            <div className="performance-row" key={product.name}>
              <span className="performance-rank">{index + 1}</span>
              <div><strong>{product.name}</strong><small>{product.category} · {money(product.revenue)} vendidos</small></div>
              <b>{integerFormatter.format(product.quantity)} <small>un.</small></b>
            </div>
          )) : <ReportEmpty icon={<Coffee size={22} />} title="Todavía no hay productos vendidos" copy="Acá vas a ver cuáles son los favoritos del mes." />}
        </section>

        <section className="panel product-performance unsold-products">
          <div className="panel-heading"><div><h2>Sin ventas este mes</h2><p>Productos activos que todavía no salieron.</p></div><ArrowDownRight size={17} className="report-neutral" /></div>
          {selectedSales.length === 0 ? (
            <ReportEmpty icon={<Package size={22} />} title="Esperando las primeras ventas" copy="Cuando haya movimientos del mes, vas a poder ver qué productos quedaron sin vender." />
          ) : noSalesProducts.length ? noSalesProducts.map((product) => (
            <div className="performance-row" key={product.id}>
              <span className="unsold-product-dot" />
              <div><strong>{product.name}</strong><small>{product.category}</small></div>
              <b className="no-sales-label">Sin ventas</b>
            </div>
          )) : <ReportEmpty icon={<Package size={22} />} title="Todos tuvieron movimiento" copy="Cada producto del catálogo registró ventas este mes." />}
        </section>

        <section className="panel payment-report">
          <div className="panel-heading"><div><h2>Medios de pago</h2><p>Cómo se cobraron las cuentas del mes.</p></div></div>
          {paymentStats.length ? paymentStats.map(([name, amount]) => (
            <div className="report-row" key={name}>
              <strong>{name}</strong>
              <div><span style={{ width: `${totalSales ? amount / totalSales * 100 : 0}%` }} /></div>
              <b>{money(amount)}</b>
            </div>
          )) : <ReportEmpty icon={<Wallet size={22} />} title="Todavía no hay cobros" copy="El desglose por medio de pago aparece al cerrar ventas." />}
        </section>

        <section className="panel recent-sales-report">
          <div className="panel-heading"><div><h2>Últimas cuentas del mes</h2><p>Ventas cerradas en el período seleccionado.</p></div></div>
          {recentSales.length ? (
            <div className="report-sales-list">
              {recentSales.map((sale) => (
                <div className="report-sale-row" key={sale.id}>
                  <span className="report-sale-icon"><ReceiptText size={16} /></span>
                  <div><strong>{sale.tableName}</strong><small>{new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(sale.closedAt))} · {sale.guests} {sale.guests === 1 ? "cubierto" : "cubiertos"}</small></div>
                  <span>{sale.payment}</span>
                  <b>{money(sale.total)}</b>
                </div>
              ))}
            </div>
          ) : <ReportEmpty icon={<ReceiptText size={22} />} title="No hay cuentas para mostrar" copy="Las ventas cobradas van a quedar registradas en este historial." />}
        </section>
      </div>
      <p className="reports-data-note">Los cubiertos usan la cantidad de personas configurada en cada mesa al cobrar. El historial local comienza desde que se habilitó el registro y no incluye ventas anteriores.</p>
    </div>
  );
}

function ReportMetric({ icon, label, value, detail }: { icon: ReactNode; label: string; value: string; detail: string }) {
  return <motion.section variants={fadeUp} className="metric"><div className="metric-label"><span>{label}</span><span className="round-icon">{icon}</span></div><strong className="metric-value">{value}</strong><span className="metric-bottom">{detail}</span></motion.section>;
}

function ReportEmpty({ icon, title, copy }: { icon: ReactNode; title: string; copy: string }) {
  return <div className="report-empty">{icon}<strong>{title}</strong><p>{copy}</p></div>;
}
