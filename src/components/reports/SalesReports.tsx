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
import type { Product } from "../../data";
import { money } from "../../data";
import { fadeUp, press, staggerContainer } from "../../motion";
import { loadSales } from "../../stores/sales";
import { WeeklySalesChart } from "../../features/dashboard/WeeklySalesChart";

const monthFormatter = new Intl.DateTimeFormat("es-AR", {
  month: "long",
  year: "numeric",
});
const integerFormatter = new Intl.NumberFormat("es-AR");
const barRowClass = "my-[17px] flex items-center gap-3 text-[10px] max-[760px]:gap-2";
const barLabelClass = "w-[82px] shrink-0 truncate font-medium max-[760px]:w-[70px]";
const barTrackClass = "h-2 flex-1 overflow-hidden rounded-lg bg-[var(--brand-wash)] in-data-[theme=dark]:bg-[#34232b]";
const barValueClass = "min-w-[78px] text-right text-[9px] font-[550] text-[var(--text)] tabular-nums max-[760px]:min-w-[70px] max-[760px]:text-[8px]";
const performanceClass = "grid grid-cols-[27px_minmax(0,1fr)_auto] items-center gap-2.5 border-b border-[var(--border)] py-[11px] last:border-b-0";

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

  const moveMonth = (amount: number) =>
    setMonth((current) => new Date(current.getFullYear(), current.getMonth() + amount, 1));

  return (
    <div className="grid gap-[18px]">
      <div className="flex items-center justify-between gap-[18px] max-[760px]:flex-col max-[760px]:items-start">
        <div>
          <p className="!text-[11px]">Seleccioná un mes para consultar los datos.</p>
        </div>
        <div className="flex items-center gap-2 rounded-[11px] border border-[var(--border)] bg-[var(--surface)] p-1 max-[760px]:self-stretch max-[760px]:justify-between" aria-label="Período del reporte">
          <motion.button className="!grid size-[30px] place-items-center rounded-lg !text-[var(--muted)] hover:!bg-[var(--brand-wash)] hover:!text-[var(--brand)]" whileTap={press} aria-label="Mes anterior" onClick={() => moveMonth(-1)}>
            <ChevronLeft size={17} />
          </motion.button>
          <strong className="min-w-[130px] text-center text-[11px] font-semibold capitalize">{monthFormatter.format(month)}</strong>
          <motion.button
            className="!grid size-[30px] place-items-center rounded-lg !text-[var(--muted)] hover:enabled:!bg-[var(--brand-wash)] hover:enabled:!text-[var(--brand)]"
            whileTap={press}
            aria-label="Mes siguiente"
            disabled={month.getFullYear() === new Date().getFullYear() && month.getMonth() === new Date().getMonth()}
            onClick={() => moveMonth(1)}
          >
            <ChevronRight size={17} />
          </motion.button>
        </div>
      </div>

      <motion.div className="metrics !mb-0 !grid-cols-4 max-[1100px]:!grid-cols-2 max-[760px]:!gap-2.5" variants={staggerContainer} initial="hidden" animate="visible">
        <ReportMetric icon={<Wallet size={18} />} label="Ventas del mes" value={money(totalSales)} detail={`${selectedSales.length} cuentas cerradas`} />
        <ReportMetric icon={<UsersRound size={18} />} label="Cubiertos" value={integerFormatter.format(covers)} detail="Personas registradas en las mesas" />
        <ReportMetric icon={<ReceiptText size={18} />} label="Ticket promedio" value={money(averageTicket)} detail="Promedio por cuenta cerrada" />
        <ReportMetric icon={<Coffee size={18} />} label="Unidades vendidas" value={integerFormatter.format(itemsSold)} detail="Productos comandados y cobrados" />
      </motion.div>

      <div className="grid grid-cols-[minmax(0,1.15fr)_minmax(0,.85fr)] items-stretch gap-4 max-[1100px]:grid-cols-2 max-[760px]:grid-cols-1">
        <WeeklySalesChart key={`${month.getFullYear()}-${month.getMonth()}`} month={month} sales={selectedSales} />

        <section className="panel min-w-0">
          <div className="panel-heading !mb-[18px]"><div><h2>Ventas por categoría</h2><p>Qué parte de la facturación aporta cada rubro.</p></div></div>
          {categoryStats.length ? categoryStats.map(([name, amount]) => (
            <div className={barRowClass} key={name}>
              <strong className={barLabelClass}>{name}</strong>
              <div className={barTrackClass}><span className="block h-full rounded-lg bg-[var(--brand)]" style={{ width: `${totalSales ? amount / totalSales * 100 : 0}%` }} /></div>
              <b className={barValueClass}>{money(amount)}</b>
            </div>
          )) : <ReportEmpty icon={<Package size={22} />} title="Sin ventas por categoría" copy="El detalle se completa al cerrar cuentas." />}
        </section>

        <section className="panel min-w-0">
          <div className="panel-heading !mb-[18px]"><div><h2>Productos más vendidos</h2><p>Ordenados por unidades.</p></div><ArrowUpRight size={17} className="text-[#4d9a69]" /></div>
          {topProducts.length ? topProducts.map((product, index) => (
            <div className={performanceClass} key={product.name}>
              <span className="grid size-[25px] place-items-center rounded-lg bg-[var(--brand-wash)] text-[9px] font-bold text-[var(--brand-deep)]">{index + 1}</span>
              <div className="min-w-0"><strong className="block truncate text-[10px] font-semibold">{product.name}</strong><small className="mt-1 block truncate text-[8px] text-[var(--muted)]">{product.category} · {money(product.revenue)} vendidos</small></div>
              <b className="text-[10px] font-semibold whitespace-nowrap">{integerFormatter.format(product.quantity)} <small className="text-[8px] font-normal text-[var(--muted)]">un.</small></b>
            </div>
          )) : <ReportEmpty icon={<Coffee size={22} />} title="Sin productos vendidos" copy="Los productos aparecerán al cerrar ventas." />}
        </section>

        <section className="panel min-w-0">
          <div className="panel-heading !mb-[18px]"><div><h2>Sin ventas este mes</h2><p>Productos disponibles sin ventas en el mes.</p></div><ArrowDownRight size={17} className="text-[var(--muted)]" /></div>
          {selectedSales.length === 0 ? (
            <ReportEmpty icon={<Package size={22} />} title="Sin ventas registradas" copy="Al cerrar ventas, podrás ver qué productos quedaron sin vender." />
          ) : noSalesProducts.length ? noSalesProducts.map((product) => (
            <div className={performanceClass} key={product.id}>
              <span className="size-2 justify-self-center rounded-full border-2 border-[#c8bfc2]" />
              <div className="min-w-0"><strong className="block truncate text-[10px] font-semibold">{product.name}</strong><small className="mt-1 block truncate text-[8px] text-[var(--muted)]">{product.category}</small></div>
              <b className="text-[8px] font-[450] whitespace-nowrap text-[var(--muted)]">Sin ventas</b>
            </div>
          )) : <ReportEmpty icon={<Package size={22} />} title="Sin productos pendientes" copy="Todos los productos disponibles registraron ventas este mes." />}
        </section>

        <section className="panel min-w-0">
          <div className="panel-heading !mb-[18px]"><div><h2>Medios de pago</h2><p>Cómo se cobraron las cuentas del mes.</p></div></div>
          {paymentStats.length ? paymentStats.map(([name, amount]) => (
            <div className={barRowClass} key={name}>
              <strong className={barLabelClass}>{name}</strong>
              <div className={barTrackClass}><span className="block h-full rounded-lg bg-[var(--brand)]" style={{ width: `${totalSales ? amount / totalSales * 100 : 0}%` }} /></div>
              <b className={barValueClass}>{money(amount)}</b>
            </div>
          )) : <ReportEmpty icon={<Wallet size={22} />} title="Todavía no hay cobros" copy="El desglose por medio de pago aparece al cerrar ventas." />}
        </section>

        <section className="panel min-w-0">
          <div className="panel-heading !mb-[18px]"><div><h2>Últimas cuentas del mes</h2><p>Ventas cerradas en el período seleccionado.</p></div></div>
          {recentSales.length ? (
            <div className="grid">
              {recentSales.map((sale) => (
                <div className="grid grid-cols-[32px_minmax(0,1fr)_auto_auto] items-center gap-2.5 border-b border-[var(--border)] py-[11px] last:border-b-0 max-[760px]:grid-cols-[30px_minmax(0,1fr)_auto]" key={sale.id}>
                  <span className="grid size-[30px] place-items-center rounded-[9px] bg-[var(--brand-wash)] text-[var(--brand)]"><ReceiptText size={16} /></span>
                  <div className="min-w-0"><strong className="block truncate text-[10px]">{sale.tableName}</strong><small className="mt-[3px] block truncate text-[8px] text-[var(--muted)]">{new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(sale.closedAt))} · {sale.guests} {sale.guests === 1 ? "cubierto" : "cubiertos"}</small></div>
                  <span className="mt-[3px] text-[8px] text-[var(--muted)] max-[760px]:hidden">{sale.payment}</span>
                  <b className="text-[10px] whitespace-nowrap">{money(sale.total)}</b>
                </div>
              ))}
            </div>
          ) : <ReportEmpty icon={<ReceiptText size={22} />} title="No hay cuentas para mostrar" copy="Las ventas cobradas van a quedar registradas en este historial." />}
        </section>
      </div>
      <p className="!text-[9px] !text-[var(--muted)] max-[760px]:!text-[8px]">Los cubiertos usan la cantidad de personas configurada en cada mesa al cobrar. El historial local comienza desde que se habilitó el registro y no incluye ventas anteriores.</p>
    </div>
  );
}

function ReportMetric({ icon, label, value, detail }: { icon: ReactNode; label: string; value: string; detail: string }) {
  return <motion.section variants={fadeUp} className="metric !min-w-0 max-[760px]:!p-3.5"><div className="metric-label"><span>{label}</span><span className="round-icon">{icon}</span></div><strong className="metric-value !text-[25px] !whitespace-nowrap max-[760px]:!text-xl">{value}</strong><span className="metric-bottom max-[760px]:!text-[8px]">{detail}</span></motion.section>;
}

function ReportEmpty({ icon, title, copy }: { icon: ReactNode; title: string; copy: string }) {
  return <div className="flex min-h-[142px] flex-col items-center justify-center gap-[7px] text-center text-[var(--muted)] [&>svg]:mb-0.5 [&>svg]:text-[var(--brand)]">{icon}<strong className="text-[10px] text-[var(--text)]">{title}</strong><p className="max-w-[280px] !text-[9px]">{copy}</p></div>;
}
