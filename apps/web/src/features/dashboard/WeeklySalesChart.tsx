import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, YAxis } from "recharts";
import { Button } from "../../components/ui/button";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "../../components/ui/chart";
import { money } from "../../data";
import type { SaleRecord } from "../../stores/sales";

const chartConfig = { total: { label: "Ventas", color: "var(--brand)" } } satisfies ChartConfig;
const weekday = new Intl.DateTimeFormat("es-AR", { weekday: "short" });
const fullDate = new Intl.DateTimeFormat("es-AR", { weekday: "long", day: "numeric", month: "long" });
const shortDate = new Intl.DateTimeFormat("es-AR", { day: "numeric", month: "short" });
const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
const addDays = (date: Date, days: number) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
const monday = (date: Date) => addDays(date, -((date.getDay() + 6) % 7));

export function WeeklySalesChart({ month, sales }: { month: Date; sales: SaleRecord[] }) {
  const initialDay = useMemo(() => {
    const today = new Date();
    return today.getFullYear() === month.getFullYear() && today.getMonth() === month.getMonth() ? today : month;
  }, [month]);
  const [selectedDay, setSelectedDay] = useState(initialDay);
  const [week, setWeek] = useState(() => monday(initialDay));
  const firstWeek = monday(month);
  const lastDay = new Date(month.getFullYear(), month.getMonth() + 1, 0);
  const lastWeek = monday(lastDay);
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = addDays(week, index);
    const inMonth = date.getMonth() === month.getMonth() && date.getFullYear() === month.getFullYear();
    const daySales = inMonth ? sales.filter((sale) => sameDay(new Date(sale.closedAt), date)) : [];
    return { date, inMonth, total: daySales.reduce((sum, sale) => sum + sale.total, 0), count: daySales.length };
  });
  const selected = days.find((day) => sameDay(day.date, selectedDay));
  const moveWeek = (delta: number) => {
    const next = addDays(week, delta * 7);
    setWeek(next);
    const firstInMonth = Array.from({ length: 7 }, (_, index) => addDays(next, index)).find((date) => date.getMonth() === month.getMonth() && date.getFullYear() === month.getFullYear());
    if (firstInMonth) setSelectedDay(firstInMonth);
  };

  return <section className="panel min-w-0">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h2>Ventas por día</h2><p className="mt-1 !text-[11px]">Facturación diaria de la semana seleccionada.</p></div>
      <div className="flex items-center gap-1 rounded-lg border border-[var(--border)] p-1">
        <Button variant="ghost" size="icon-sm" aria-label="Semana anterior" disabled={week.getTime() <= firstWeek.getTime()} onClick={() => moveWeek(-1)}><ChevronLeft size={16} /></Button>
        <span className="min-w-[100px] text-center text-[10px] font-medium text-[var(--muted)]">{shortDate.format(week)} – {shortDate.format(addDays(week, 6))}</span>
        <Button variant="ghost" size="icon-sm" aria-label="Semana siguiente" disabled={week.getTime() >= lastWeek.getTime()} onClick={() => moveWeek(1)}><ChevronRight size={16} /></Button>
      </div>
    </div>
    <div className="mt-5" aria-label="Gráfico de ventas diarias">
      <ChartContainer config={chartConfig} className="!aspect-auto h-[170px] w-full">
        <BarChart accessibilityLayer data={days} margin={{ top: 8, right: 0, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 3" />
          <YAxis width={48} tickLine={false} axisLine={false} tick={{ fill: "var(--muted)", fontSize: 9 }} tickFormatter={(value: number) => value >= 1000 ? `$${Math.round(value / 1000)}k` : `$${value}`} />
          <ChartTooltip cursor={{ fill: "var(--brand-soft)", opacity: 0.35 }} content={<ChartTooltipContent hideLabel formatter={(value) => <span className="font-semibold text-[var(--text)]">{money(Number(value))}</span>} className="!border-[var(--border)] !bg-[var(--surface)] !text-[var(--text)]" />} />
          <Bar dataKey="total" fill="var(--color-total)" radius={[5, 5, 0, 0]} maxBarSize={36} isAnimationActive={false}>{days.map((day) => <Cell key={day.date.toISOString()} fillOpacity={sameDay(day.date, selectedDay) ? 1 : 0.45} />)}</Bar>
        </BarChart>
      </ChartContainer>
      <div className="ml-12 grid grid-cols-7" aria-label="Seleccionar día">{days.map((day) => <button key={day.date.toISOString()} type="button" disabled={!day.inMonth} aria-pressed={sameDay(day.date, selectedDay)} aria-label={`${fullDate.format(day.date)}: ${money(day.total)}, ${day.count} ${day.count === 1 ? "venta" : "ventas"}`} onClick={() => setSelectedDay(day.date)} className={`grid min-h-11 place-items-center rounded-lg px-0.5 py-1 text-center transition-colors ${sameDay(day.date, selectedDay) ? "!bg-[var(--brand-soft)] !text-[var(--brand-deep)]" : "!text-[var(--muted)] hover:!bg-[var(--brand-wash)]"}`}><span className="text-[10px] capitalize">{weekday.format(day.date).replace(".", "")}</span><strong className="text-[11px]">{day.date.getDate()}</strong></button>)}</div>
    </div>
    {selected && <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-[var(--border)] pt-3" aria-live="polite"><span className="text-[10px] capitalize text-[var(--muted)]">{fullDate.format(selected.date)} · {selected.count} {selected.count === 1 ? "cuenta" : "cuentas"}</span><strong className="text-sm tabular-nums">{money(selected.total)}</strong></div>}
  </section>;
}
