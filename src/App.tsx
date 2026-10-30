import React, { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  Coffee,
  LayoutDashboard,
  ShoppingBag,
  Package,
  Boxes,
  Wallet,
  QrCode,
  ChartNoAxesCombined,
  Settings,
  ArrowUpRight,
  ArrowRight,
  Plus,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
  Clock3,
  Check,
  X,
  Minus,
  Utensils,
  Menu,
  ExternalLink,
  Instagram,
  SlidersHorizontal,
  ReceiptText,
  LoaderCircle,
  UsersRound,
  LifeBuoy,
  MessageSquareText,
  Moon,
  Sun,
} from "lucide-react";
import {
  defaultCategories,
  money,
  photos,
  products as seedProducts,
  type Product,
} from "./data";
import { Metric } from "./components/Operations";
import TablePOS from "./components/TablePOS";
import { PaidTablesDialog } from "./components/PaidTablesDialog";
import { ProductManager } from "./components/ProductManager";
import { StockManager } from "./components/StockManager";
import { StockAlerts } from "./components/StockAlerts";
import { loadStock, productsWithStock, type Stock } from "./stores/inventory";
import { TeamManager } from "./components/TeamManager";
import { AttendanceManager } from "./components/AttendanceManager";
import { SalesReports } from "./components/SalesReports";
import {
  CASH_BASE_EXPECTED,
  CASH_SALES,
  CashRegister,
  type CashExpense,
} from "./components/CashRegister";
import { PublicMenu } from "./components/PublicMenu";
import { useDashboardTheme } from "./hooks/useDashboardTheme";
import { business } from "./config/business";
import {
  fadeUp,
  modalVariants,
  overlayVariants,
  pageVariants,
  press,
  subtleHover,
  toastVariants,
  transitions,
} from "./motion";
const nav = [
  ["Resumen", LayoutDashboard],
  ["Punto de venta", ShoppingBag],
  ["Productos", Package],
  ["Stock", Boxes],
  ["Fichaje", Clock3],
  ["Menú digital", QrCode],
  ["Reportes", ChartNoAxesCombined],
  ["Equipo", UsersRound],
  ["Configuración", Settings],
] as const;
const PRODUCT_STORAGE = "carmela.products.v1";
const CATEGORY_STORAGE = "carmela.categories.v1";
const CASH_EXPENSE_STORAGE = "carmela.cash.expenses.v1";
const loadProducts = () => {
  try {
    const saved = localStorage.getItem(PRODUCT_STORAGE);
    return saved ? (JSON.parse(saved) as Product[]) : seedProducts;
  } catch {
    return seedProducts;
  }
};
const loadCategories = () => {
  try {
    const saved = localStorage.getItem(CATEGORY_STORAGE);
    return saved ? (JSON.parse(saved) as string[]) : defaultCategories;
  } catch {
    return defaultCategories;
  }
};
const loadCashExpenses = () => {
  try {
    const saved = localStorage.getItem(CASH_EXPENSE_STORAGE);
    return saved ? (JSON.parse(saved) as CashExpense[]) : [];
  } catch {
    return [];
  }
};
export function App() {
  const [products, setProducts] = useState<Product[]>(loadProducts);
  const [stock, setStock] = useState<Stock>(loadStock);
  const [categoryList, setCategoryList] = useState<string[]>(loadCategories);
  const [page, setPage] = useState("Resumen");
  const [cashOpen, setCashOpen] = useState(false);
  const [salesOpen, setSalesOpen] = useState(false);
  const [cashMode, setCashMode] = useState<"movements" | "count">("movements");
  const [publicView, setPublicView] = useState(location.hash === "#menu");
  const [publicThemeActive, setPublicThemeActive] = useState(
    location.hash === "#menu",
  );
  const { darkMode, setDarkMode } = useDashboardTheme(publicThemeActive);
  const [side, setSide] = useState(false);
  const [notice, setNotice] = useState("");
  const [period, setPeriod] = useState("Hoy");
  const [selected, setSelected] = useState<Product | null>(null);
  const [handled, setHandled] = useState<number[]>([]);
  const [service, setService] = useState("En el local");
  const [saving, setSaving] = useState(false);
  const [cashExpenses, setCashExpenses] = useState<CashExpense[]>(loadCashExpenses);
  useEffect(() => {
    localStorage.setItem(PRODUCT_STORAGE, JSON.stringify(products));
  }, [products]);
  useEffect(() => {
    localStorage.setItem(CATEGORY_STORAGE, JSON.stringify(categoryList));
  }, [categoryList]);
  useEffect(() => {
    localStorage.setItem(CASH_EXPENSE_STORAGE, JSON.stringify(cashExpenses));
  }, [cashExpenses]);
  const cashExpenseTotal = cashExpenses.filter((expense) => expense.kind !== "ajuste").reduce(
    (sum, expense) => sum + expense.amount,
    0,
  );
  const cashPaidExpenses = cashExpenses
    .filter((expense) => expense.payment === "Efectivo")
    .reduce((sum, expense) => sum + (expense.direction === "in" ? -expense.amount : expense.amount), 0);
  useEffect(() => {
    const syncPublicView = () => {
      const nextPublicView = location.hash === "#menu";
      if (nextPublicView) setPublicThemeActive(true);
      setPublicView(nextPublicView);
    };
    window.addEventListener("hashchange", syncPublicView);
    return () => window.removeEventListener("hashchange", syncPublicView);
  }, []);
  const go = (p: string) => {
    setPage(p);
    setSide(false);
  };
  const openMenu = () => {
    setNotice("");
    const menuUrl = new URL(window.location.href);
    menuUrl.hash = "menu";
    window.open(menuUrl.toString(), "_blank", "noopener,noreferrer");
  };
  const toast = (s: string) => {
    setNotice(s);
    window.setTimeout(() => setNotice(""), 3500);
  };
  const savePreferences = (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    window.setTimeout(() => {
      setSaving(false);
      toast("Preferencias actualizadas en esta vista de demostración.");
    }, 650);
  };
  const saveProduct = (product: Product) => {
    setProducts((current) =>
      current.some((item) => item.id === product.id)
        ? current.map((item) => (item.id === product.id ? product : item))
        : [...current, product],
    );
    toast(
      product.id && products.some((item) => item.id === product.id)
        ? "Producto actualizado."
        : "Producto creado.",
    );
  };
  const deleteProduct = (id: number) => {
    setProducts((current) => current.filter((item) => item.id !== id));
    toast("Producto eliminado de este navegador.");
  };
  const sellableProducts = productsWithStock(products, stock);
  const reorderProducts = (fromId: number, toId: number) =>
    setProducts((current) => {
      const from = current.findIndex((item) => item.id === fromId),
        to = current.findIndex((item) => item.id === toId);
      if (from < 0 || to < 0) return current;
      const next = [...current];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  const addCategory = (name: string) => {
    if (
      !name ||
      categoryList.some((item) => item.toLowerCase() === name.toLowerCase())
    )
      return false;
    setCategoryList((current) => [...current, name]);
    return true;
  };
  const reorderCategories = (fromName: string, toName: string) => {
    setCategoryList((current) => {
      const from = current.indexOf(fromName);
      const to = current.indexOf(toName);
      if (from < 0 || to < 0 || from === to) return current;
      const next = [...current];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  };
  const renameCategory = (currentName: string, nextName: string) => {
    if (
      !nextName ||
      categoryList.some(
        (item) =>
          item !== currentName && item.toLowerCase() === nextName.toLowerCase(),
      )
    )
      return false;
    setCategoryList((current) =>
      current.map((item) => (item === currentName ? nextName : item)),
    );
    setProducts((current) =>
      current.map((item) =>
        item.category === currentName ? { ...item, category: nextName } : item,
      ),
    );
    return true;
  };
  const deleteCategory = (name: string) => {
    if (
      categoryList.length === 1 ||
      products.some((item) => item.category === name)
    )
      return false;
    setCategoryList((current) => current.filter((item) => item !== name));
    return true;
  };
  return (
    <>
      <AnimatePresence
        mode="wait"
        initial={false}
        onExitComplete={() => {
          if (!publicView) setPublicThemeActive(false);
        }}
      >
        {publicView ? (
          <PublicMenu
            products={sellableProducts}
            categories={categoryList}
            onBack={() => {
              setPublicView(false);
              location.hash = "";
            }}
            onSelect={setSelected}
          />
        ) : (
          <motion.div
            key="dashboard"
            className="dashboard-frame"
            variants={pageVariants}
            initial="initial"
            animate="animate"
            exit="exit"
          >
            <div className="app-shell">
            <motion.aside className={side ? "sidebar visible" : "sidebar"}>
              <button
                className="workspace profile-workspace"
                onClick={() => go("Configuración")}
              >
                <div className="avatar">CL</div>
                <span>
                  <strong>Camila López</strong>
                  <small>Administradora</small>
                </span>
                <ChevronDown size={15} />
              </button>
              <span className="nav-label">TU ESPACIO DE TRABAJO</span>
              <nav>
                {nav.map(([label, Icon], i) => (
                  <motion.button
                    layout
                    whileTap={press}
                    key={label}
                    onClick={() => go(label)}
                    className={page === label ? "active" : ""}
                  >
                    <Icon size={19} />
                    <span>{label}</span>
                  </motion.button>
                ))}
              </nav>
              <div className="sidebar-bottom">
                <div className="sidebar-help">
                  <button
                    className="theme-toggle"
                    aria-pressed={darkMode}
                    onClick={() => setDarkMode((value) => !value)}
                  >
                    {darkMode ? <Sun size={17} /> : <Moon size={17} />}
                    <span>
                      <strong>{darkMode ? "Modo claro" : "Modo oscuro"}</strong>
                      <small>
                        {darkMode
                          ? "Cambiar a tema claro"
                          : "Cambiar a tema oscuro"}
                      </small>
                    </span>
                    <i className="theme-switch">
                      <b />
                    </i>
                  </button>
                  <button
                    onClick={() =>
                      toast(
                        "El centro de ayuda estará disponible próximamente.",
                      )
                    }
                  >
                    <LifeBuoy size={17} />
                    <span>
                      <strong>Ayuda y soporte</strong>
                      <small>Centro de ayuda</small>
                    </span>
                  </button>
                  <button
                    onClick={() =>
                      toast(
                        "Gracias. Pronto vas a poder enviarnos tus sugerencias desde acá.",
                      )
                    }
                  >
                    <MessageSquareText size={17} />
                    <span>
                      <strong>Enviar sugerencia</strong>
                      <small>Ayudanos a mejorar</small>
                    </span>
                  </button>
                </div>
              </div>
            </motion.aside>
            <AnimatePresence>
              {side && (
                <motion.div
                  className="backdrop"
                  variants={overlayVariants}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                  onClick={() => setSide(false)}
                />
              )}
            </AnimatePresence>
            <div className="main-shell">
                <main className={page === "Punto de venta" ? "pos-page" : undefined}>
                <button
                  className="icon-btn mobile-toggle floating-menu"
                  aria-label="Abrir navegación"
                  onClick={() => setSide(!side)}
                >
                  <Menu size={20} />
                </button>
                <AnimatePresence mode="wait" initial={false}>
                  <motion.div
                    key={page}
                    className="page-motion"
                    variants={pageVariants}
                    initial="initial"
                    animate="animate"
                    exit="exit"
                  >
                    {page !== "Punto de venta" && <div className="page-heading">
                      <div>
                        <span className="eyebrow">
                          {page === "Resumen"
                            ? "VIERNES, 23 DE OCTUBRE DE 2026"
                            : "CARMELA · TU OPERACIÓN"}
                        </span>
                        <h1>
                          {page === "Resumen"
                            ? "Un buen día empieza acá."
                            : page}
                        </h1>
                        <p>
                          {page === "Resumen"
                            ? "Tu café en movimiento. Todo lo importante, de un vistazo."
                            : page === "Punto de venta"
                              ? "Mesas, consumos, descuentos y cobros en un solo lugar."
                              : page === "Menú digital"
                                ? "La experiencia de tu café empieza antes del primer sorbo."
                                : page === "Equipo"
                                  ? "Personas, roles y accesos del equipo."
                                  : page === "Fichaje"
                                    ? "Entradas, salidas y personal en turno, siempre a mano."
                                    : page === "Reportes"
                                      ? "Qué se vende, cuántas personas vienen y cuánto factura el café."
                                  : "Todo en su lugar, para que puedas enfocarte en tu café."}
                        </p>
                      </div>
                      <div className="heading-actions">
                        {page === "Resumen" ? (
                          <>
                            <button
                              className="button"
                              onClick={() =>
                                setPeriod(period === "Hoy" ? "Ayer" : "Hoy")
                              }
                            >
                              <Clock3 size={16} />
                              {period}
                              <ChevronDown size={14} />
                            </button>
                            <button
                              className="button primary"
                              onClick={() => go("Punto de venta")}
                            >
                              <Plus size={17} /> Nueva venta
                            </button>
                          </>
                        ) : page === "Menú digital" ? (
                          <button className="button primary" onClick={openMenu}>
                            Ver menú público <ExternalLink size={16} />
                          </button>
                        ) : null}
                      </div>
                    </div>}
                    {page === "Resumen" ? (
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
                              onClick={() => { setCashMode("movements"); setCashOpen(true); }}
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
                    ) : page === "Punto de venta" ? (
                      <TablePOS
                        products={sellableProducts}
                        onStockChange={setStock}
                        categories={categoryList}
                        onToast={toast}
                      />
                    ) : page === "Productos" ? (
                      <ProductManager
                        products={products}
                        categories={categoryList}
                        onSave={saveProduct}
                        onDelete={deleteProduct}
                        onReorder={reorderProducts}
                        onAddCategory={addCategory}
                        onReorderCategory={reorderCategories}
                        onRenameCategory={renameCategory}
                        onDeleteCategory={deleteCategory}
                      />
                    ) : page === "Stock" ? (
                      <StockManager products={products} stock={stock} onStockChange={setStock} onToast={toast} />
                    ) : page === "Menú digital" ? (
                      <div className="menu-admin">
                        <section className="panel">
                          <span className="eyebrow">TU VIDRIERA DIGITAL</span>
                          <h2>
                            El sabor de Carmela,
                            <br />a un escaneo de distancia.
                          </h2>
                          <p>
                            Una carta pensada para descubrir desde el celular.
                            Con tus productos, tus colores y toda tu esencia.
                          </p>
                          <div className="menu-setting">
                            <span>Nombre del establecimiento</span>
                            <strong>Carmela</strong>
                          </div>
                          <div className="menu-setting">
                            <span>Identidad visual</span>
                            <strong>
                              <i className="color-dot" /> Rosa
                            </strong>
                          </div>
                          <div className="menu-setting">
                            <span>Productos visibles</span>
                            <strong>
                              {products.filter(
                                (item) => item.available && item.onlineVisible !== false,
                              ).length}{" "}
                              productos · {categoryList.length} categorías
                            </strong>
                          </div>
                          <button className="button primary" onClick={openMenu}>
                            Explorar menú público <ArrowUpRight size={17} />
                          </button>
                          <p className="help-copy">
                            Vista previa local. La publicación y el QR se
                            conectarán en la próxima etapa.
                          </p>
                        </section>
                        <motion.button
                          whileHover={subtleHover}
                          whileTap={press}
                          className="menu-preview"
                          onClick={openMenu}
                        >
                          <img src={photos.shop} alt="Café de Carmela" />
                          <div>
                            <span>Carmela.</span>
                            <h2>Tu pausa favorita.</h2>
                            <p>Café con origen. Hecho con cariño.</p>
                            <span className="preview-cta">
                              Conocé nuestra carta <ArrowRight size={18} />
                            </span>
                          </div>
                        </motion.button>
                      </div>
                    ) : page === "Reportes" ? (
                      <SalesReports products={products} />
                    ) : page === "Equipo" ? (
                      <TeamManager />
                    ) : page === "Fichaje" ? (
                      <AttendanceManager />
                    ) : (
                      <section className="panel settings">
                        <h2>La identidad de tu local</h2>
                        <p>Datos principales de Carmela.</p>
                        <form onSubmit={savePreferences}>
                          <label className="field">
                            Nombre del local
                            <input defaultValue={business.name} required />
                          </label>
                          <div className="field">
                            <span>Dirección</span>
                            <a
                              className="fixed-business-field"
                              href={business.mapsUrl}
                              target="_blank"
                              rel="noreferrer"
                              aria-label="Abrir dirección de Carmela en Google Maps"
                            >
                              <span>
                                <strong>{business.address}</strong>
                                <small>{business.addressRegion}</small>
                              </span>
                              <ExternalLink size={16} />
                            </a>
                            <small className="field-note">
                              Dirección vinculada con Google Maps.
                            </small>
                          </div>
                          <label className="field">
                            Horario de atención
                            <input
                              defaultValue="Lun., mié., jue., vie. y sáb. · 08:00–20:00 · Dom. 12:00–20:00 · Mar. cerrado"
                              required
                            />
                          </label>
                          <div className="field">
                            <span>Instagram</span>
                            <div className="settings-social">
                              <Instagram size={17} />
                              <input
                                aria-label="Instagram"
                                defaultValue={business.instagram}
                                required
                              />
                              <a
                                href={business.instagramUrl}
                                target="_blank"
                                rel="noreferrer"
                                aria-label="Abrir Instagram de Carmela"
                              >
                                <ExternalLink size={16} />
                              </a>
                            </div>
                          </div>
                          <button className="button primary" disabled={saving}>
                            {saving ? (
                              <>
                                <LoaderCircle className="spinner" size={16} />{" "}
                                Guardando…
                              </>
                            ) : (
                              "Guardar cambios"
                            )}
                          </button>
                        </form>
                      </section>
                    )}
                  </motion.div>
                </AnimatePresence>
              </main>
            </div>
              </div>
            <aside className="workspace-utility-rail" aria-label="Panel lateral de opciones">
              <StockAlerts products={products} stock={stock} onOpenStock={() => go("Stock")} />
              <div className="utility-rail-divider" role="separator" />
              <button className="utility-rail-button" aria-label="Abrir caja" aria-pressed={cashOpen && cashMode === "movements"} title="Caja" onClick={() => { setCashMode("movements"); setCashOpen(true); }}><Wallet size={19} /></button>
              <button className="utility-rail-button" aria-label="Abrir arqueo" aria-pressed={cashOpen && cashMode === "count"} title="Arqueo" onClick={() => { setCashMode("count"); setCashOpen(true); }}><ReceiptText size={19} /></button>
              <button className="utility-rail-button" aria-label="Mesas cobradas del día" aria-pressed={salesOpen} title="Mesas cobradas del día" onClick={() => setSalesOpen(true)}><ShoppingBag size={19} /></button>
            </aside>
          </motion.div>
        )}
      </AnimatePresence>
      <PaidTablesDialog open={salesOpen && !publicView} onClose={() => setSalesOpen(false)} />
      <CashRegister mode={cashMode} open={cashOpen && !publicView} onClose={() => setCashOpen(false)} onToast={toast} expenses={cashExpenses} setExpenses={setCashExpenses} />
      <AnimatePresence>
        {notice && (
          <motion.div
            key="toast"
            className="toast"
            role="status"
            variants={toastVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            <Check size={18} />
            {notice}
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {selected && (
          <motion.div
            className="modal-backdrop"
            variants={overlayVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            onClick={() => setSelected(null)}
          >
            <motion.section
              className="product-modal"
              variants={modalVariants}
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-label={selected.name}
            >
              <button
                className="icon-btn close-modal"
                aria-label="Cerrar detalle"
                onClick={() => setSelected(null)}
              >
                <X size={20} />
              </button>
              <img src={selected.image} alt={selected.name} />
              <div>
                <span className="eyebrow">{selected.category}</span>
                <h2>{selected.name}</h2>
                <p>{selected.description}</p>
                <strong>{money(selected.price)}</strong>
                <p className="help-copy">
                  Consultá al equipo por opciones y alérgenos.
                </p>
              </div>
            </motion.section>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
