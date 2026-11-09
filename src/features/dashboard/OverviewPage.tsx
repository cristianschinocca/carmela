import { motion } from "motion/react";
import { ArrowRight, ArrowUpRight, ChartNoAxesCombined, Coffee, ShoppingBag, Utensils, Wallet } from "lucide-react";
import { Metric } from "../../components/shared/Operations";
import { money, type Product } from "../../data";
import { CASH_BASE_EXPECTED, CASH_SALES } from "../../stores/cash";
import { transitions } from "../../motion";

type Props = {
  period: string;
  products: Product[];
  cashExpenseTotal: number;
  cashPaidExpenses: number;
  go: (page: string) => void;
  openCash: () => void;
};

export function OverviewPage({
  period,
  products,
  cashExpenseTotal,
  cashPaidExpenses,
  go,
  openCash,
}: Props) {
  return (
    <>
      <div className="mb-6 grid grid-cols-4 gap-[15px] max-[1000px]:gap-2.5 max-[760px]:grid-cols-2 max-[760px]:gap-3">
        <Metric
          icon={<Wallet size={19} />}
          label="Ventas del día"
          value={money(period === "Hoy" ? 284500 : 253800)}
          detail="12,1%"
          sub="vs. ayer"
        />
        <Metric
          icon={<ShoppingBag size={19} />}
          label="Ventas registradas"
          value={period === "Hoy" ? "48" : "43"}
          detail="5 más"
          sub="vs. ayer"
        />
        <Metric
          icon={<Utensils size={19} />}
          label="Mesas activas"
          value="64"
          sub="8 ocupadas · 56 disponibles"
        />
        <Metric
          icon={<ChartNoAxesCombined size={19} />}
          label="Ticket promedio"
          value={money(period === "Hoy" ? 5927 : 5902)}
          detail="4,8%"
          sub="vs. ayer"
        />
      </div>
      <div className="grid grid-cols-[minmax(0,1.75fr)_minmax(280px,1fr)] gap-5 max-[1200px]:grid-cols-[minmax(0,1.6fr)_minmax(260px,1fr)] max-[1200px]:gap-4 max-[1000px]:grid-cols-1">
        <section className="panel sales-panel">
          <div className="panel-heading">
            <div>
              <h2>El pulso de tus ventas</h2>
              <p>Un buen café nunca pasa desapercibido.</p>
            </div>
            <span className="flex items-center gap-[7px] text-[10px] text-[var(--muted)]">
              <i className="h-[7px] w-[7px] rounded-[3px] bg-[var(--brand)]" /> {period}
            </span>
          </div>
          <div className="mt-7 flex h-[202px] gap-4 min-[1600px]:h-[250px] max-[1200px]:gap-2 max-[1000px]:h-[220px] max-[760px]:h-[210px] min-[761px]:max-h-[800px]:mt-[23px] min-[761px]:max-h-[800px]:h-[170px]">
            <div className="flex w-[45px] shrink-0 flex-col justify-between pb-[26px] text-[9px] text-[var(--muted)]">
              <span>$ 80 mil</span>
              <span>$ 60 mil</span>
              <span>$ 40 mil</span>
              <span>$ 20 mil</span>
              <span>$ 0</span>
            </div>
            <div className="relative min-w-0 flex-1">
              <div className="absolute inset-x-0 top-0 bottom-[26px] flex flex-col justify-between [&_i]:w-full [&_i]:border-t [&_i]:border-dashed [&_i]:border-[var(--border)]">
                <i />
                <i />
                <i />
                <i />
                <i />
              </div>
              <div className="flex h-full items-end justify-around gap-2 px-1 pb-[26px]">
                {[
                  24, 44, 66, 51, 84, 62, 38, 20, 8, 4, 2, 2,
                ].map((h, i) => (
                  <div className="relative flex h-full flex-1 items-end justify-center" key={i}>
                    <motion.div
                      className={`group relative min-h-[3px] w-full max-w-[27px] rounded-t-[5px] rounded-b-[2px] ${i === 4 ? "bg-[var(--brand)]" : "bg-[#f1cfdd] in-data-[theme=dark]:bg-[#583040]"}`}
                      initial={{ height: 0 }}
                      animate={{
                        height: `${period === "Hoy" ? h : h * 0.85}%`,
                      }}
                      transition={{
                        ...transitions.base,
                        delay: i * 0.018,
                      }}
                    >
                      <span className={`absolute bottom-[calc(100%+7px)] left-1/2 z-[2] -translate-x-1/2 whitespace-nowrap rounded-[5px] bg-[var(--brand-deep)] p-[5px] text-[9px] text-white ${i === 4 ? "block" : "hidden group-hover:block"}`}>{money(h * 900)}</span>
                    </motion.div>
                    <small className={`absolute -bottom-6 whitespace-nowrap text-[8px] text-[var(--muted)] max-[1200px]:text-[7px] max-[1000px]:text-[9px] ${i % 2 ? "max-[600px]:hidden" : ""}`}>{8 + i}:00</small>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="mt-[21px] flex items-center justify-between gap-2 border-t border-[var(--border)] pt-[15px] text-[9px] text-[var(--muted)] max-[1200px]:text-[8px]">
            <span>
              <span className="spark">↗</span> Tu mejor hora
              fue a las <strong className="font-medium text-[var(--text)]">12:00</strong>
            </span>
            <button
              className="text-btn"
              onClick={() => go("Reportes")}
            >
              Ver reporte <ArrowUpRight size={15} />
            </button>
          </div>
        </section>
        <section className="panel flex min-w-0 flex-col">
          <div className="panel-heading !mb-5 !items-start">
            <div>
              <h2>Caja del turno</h2>
              <p>Un resumen antes de hacer el arqueo.</p>
            </div>
            <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-[#edf7ef] px-[9px] py-1.5 text-[10px] font-semibold text-[#347a4c] in-data-[theme=dark]:bg-[#1d3024] in-data-[theme=dark]:text-[#9bd6aa]"><i className="h-1.5 w-1.5 rounded-full bg-[#49a86b]" aria-hidden="true" /> Abierta</span>
          </div>
          <div className="flex items-start justify-between gap-3.5 rounded-[14px] border border-[var(--border)] bg-[color-mix(in_srgb,var(--text)_3%,var(--surface))] p-[18px]">
            <div className="min-w-0">
              <span className="block text-[11px] text-[var(--muted)]">Efectivo esperado en caja</span>
              <strong className="mt-2.5 block text-[32px] leading-[1.1] font-semibold tracking-[-1.1px] text-[var(--text)] tabular-nums max-[760px]:text-[28px]">{money(CASH_BASE_EXPECTED - cashPaidExpenses)}</strong>
              <p className="mt-2.5 !text-[10px] !leading-[1.5] !text-[var(--muted)]">Fondo inicial + ventas en efectivo − gastos en efectivo.</p>
            </div>
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[11px] bg-[var(--brand-soft)] text-[var(--brand)]" aria-hidden="true"><Wallet size={20} /></span>
          </div>
          <dl className="my-5 grid grid-cols-2 gap-4 max-[760px]:mt-[18px] max-[760px]:mb-5">
            <div className="min-w-0">
              <dt className="text-[10px] text-[var(--muted)]">Ventas en efectivo</dt>
              <dd className="mt-[7px] !ml-0 text-[17px] font-semibold text-[var(--text)] tabular-nums">{money(CASH_SALES)}</dd>
            </div>
            <div className="min-w-0 border-l border-[var(--border)] pl-4">
              <dt className="text-[10px] text-[var(--muted)]">Gastos registrados</dt>
              <dd className="mt-[7px] !ml-0 text-[17px] font-semibold text-[var(--text)] tabular-nums">{money(cashExpenseTotal)}</dd>
            </div>
          </dl>
          <button
            className="button mt-auto !flex w-full justify-between !px-3.5 !py-3 !text-[var(--brand-deep)]"
            onClick={openCash}
          >
            Gestionar caja <ArrowRight size={16} />
          </button>
        </section>
        <section className="panel !pb-2.5">
          <div className="panel-heading">
            <div>
              <h2>Mesas en curso</h2>
              <p>Las cuentas abiertas del salón.</p>
            </div>
            <button
              className="text-btn"
              onClick={() => go("Punto de venta")}
            >
              Gestionar <ArrowUpRight size={15} />
            </button>
          </div>
          <div className="grid gap-1.5">
            {[
              ["Mesa 04", "3 personas", 8000],
              ["Mesa 02", "2 personas", 15500],
              ["Mesa 08", "4 personas", 11200],
            ].map((row) => (
              <button
                key={row[0]}
                className="grid grid-cols-[1fr_auto_auto] items-center gap-3.5 border-0 border-b border-[var(--border)] bg-transparent px-1 py-3 text-left text-[var(--text)] in-data-[theme=dark]:border-[#302c2e]"
                onClick={() => go("Punto de venta")}
              >
                <span>
                  <strong className="block">{row[0]}</strong>
                  <small className="mt-[3px] block text-[10px] text-[var(--muted)]">{row[1]}</small>
                </span>
                <b className="text-xs">{money(Number(row[2]))}</b>
                <ArrowRight size={15} />
              </button>
            ))}
          </div>
        </section>
        <section className="panel">
          <div className="panel-heading !mb-3.5">
            <div>
              <h2>Los favoritos de hoy</h2>
              <p>Los que siempre vuelven a pedir.</p>
            </div>
            <span className="round-icon">
              <Coffee size={19} />
            </span>
          </div>
          {products.slice(0, 3).map((p, i) => (
            <div className="flex items-center gap-[11px] border-b border-[var(--border)] py-[13px] min-[1600px]:py-[19px] max-[1200px]:gap-2 max-[1000px]:py-3 in-data-[theme=dark]:border-[#302c2e]" key={p.id}>
              <img className="h-[43px] w-[42px] rounded-[10px] object-cover min-[1600px]:h-[54px] min-[1600px]:w-[54px]" src={p.image} alt={p.name} />
              <div>
                <strong className="block text-[10px] font-semibold max-[1200px]:text-[9px] max-[1000px]:text-xs">{p.name}</strong>
                <span className="mt-1.5 block text-[9px] text-[var(--muted)]">
                  {[24, 18, 12][i]} unidades vendidas
                </span>
              </div>
              <b className="ml-auto whitespace-nowrap text-[10px] font-medium max-[1200px]:text-[9px] max-[1000px]:text-xs">{money([91200, 57600, 102000][i])}</b>
            </div>
          ))}
          <button
            className="text-btn !mt-5"
            onClick={() => go("Productos")}
          >
            Explorar productos <ArrowRight size={15} />
          </button>
        </section>
      </div>
      <div className="mt-6 flex items-center justify-between gap-4 text-[9px] text-[var(--muted)] max-[760px]:text-[8px]">
        <span className="flex items-center gap-[7px]">
          <span className="text-[var(--brand)]">m</span> Menos gestión.
          Más café.
        </span>
        <span>
          Los datos de esta vista son de demostración.
        </span>
      </div>
    </>
  );
}
