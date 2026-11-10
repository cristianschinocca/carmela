import React, { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  ShoppingBag,
  Wallet,
  Plus,
  ChevronDown,
  Clock3,
  Check,
  X,
  Menu,
  ExternalLink,
  ReceiptText,
} from "lucide-react";
import {
  money,
  type Product,
} from "./data";
import TablePOS from "./components/pos/TablePOS";
import { PaidTablesDialog } from "./components/pos/PaidTablesDialog";
import { ProductManager } from "./components/products/ProductManager";
import { StockWorkspace } from "./stock/StockWorkspace";
import { StockAlerts } from "./components/stock/StockAlerts";
import { loadStock, productsWithStock, type Stock } from "./stores/inventory";
import { TeamManager } from "./components/team/TeamManager";
import { AttendanceManager } from "./components/attendance/AttendanceManager";
import { SalesReports } from "./components/reports/SalesReports";
import { CashRegister } from "./components/cash/CashRegister";
import { cashMovementImpact, isCashExpense, type CashExpense } from "./stores/cash";
import { PublicMenu } from "./components/menu/PublicMenu";
import { LoginPage } from "./components/auth/LoginPage";
import { type TeamMember } from "./stores/team";
import { useDashboardTheme } from "./hooks/useDashboardTheme";
import {
  modalVariants,
  overlayVariants,
  pageVariants,
  toastVariants,
} from "./motion";
import { OverviewPage } from "./features/dashboard/OverviewPage";
import { MenuAdminPage } from "./features/menu/MenuAdminPage";
import { SettingsPage } from "./features/settings/SettingsPage";
import { WorkspaceSidebar } from "./features/shell/WorkspaceSidebar";
import {
  CATEGORY_STORAGE,
  CASH_EXPENSE_STORAGE,
  PRODUCT_STORAGE,
  loadCategories,
  loadCashExpenses,
  loadDemoMember,
  loadProducts,
  saveDemoMember,
  clearDemoMember,
} from "./stores/workspace";

export function App() {
  const [sessionMember, setSessionMember] = useState<TeamMember | null>(loadDemoMember);
  const [profileOpen, setProfileOpen] = useState(false);
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
  const { darkMode, setDarkMode } = useDashboardTheme(publicThemeActive || !sessionMember);
  const [side, setSide] = useState(false);
  const [notice, setNotice] = useState("");
  const [period, setPeriod] = useState("Hoy");
  const [selected, setSelected] = useState<Product | null>(null);
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
  const cashExpenseTotal = cashExpenses.filter(isCashExpense).reduce(
    (sum, expense) => sum + expense.amount,
    0,
  );
  const cashPaidExpenses = cashExpenses
    .reduce((sum, expense) => sum - cashMovementImpact(expense), 0);
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
    setProfileOpen(false);
  };
  const login = (member: TeamMember) => {
    saveDemoMember(member);
    setSessionMember(member);
    setPage("Resumen");
  };
  const logout = () => {
    clearDemoMember();
    setSessionMember(null);
    setProfileOpen(false);
    setSide(false);
    setCashOpen(false);
    setSalesOpen(false);
    setPage("Resumen");
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
        ) : !sessionMember ? (
          <LoginPage onLogin={login} onOpenMenu={openMenu} />
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
            <WorkspaceSidebar side={side} profileOpen={profileOpen} setProfileOpen={setProfileOpen} sessionMember={sessionMember} page={page} go={go} logout={logout} darkMode={darkMode} setDarkMode={setDarkMode} toast={toast} />
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
                      <OverviewPage period={period} products={products} cashExpenseTotal={cashExpenseTotal} cashPaidExpenses={cashPaidExpenses} go={go} openCash={() => { setCashMode("movements"); setCashOpen(true); }} />
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
                      <StockWorkspace products={products} stock={stock} onStockChange={setStock} onToast={toast} />
                    ) : page === "Menú digital" ? (
                      <MenuAdminPage products={products} categories={categoryList} openMenu={openMenu} />
                    ) : page === "Reportes" ? (
                      <SalesReports products={products} />
                    ) : page === "Equipo" ? (
                      <TeamManager />
                    ) : page === "Fichaje" ? (
                      <AttendanceManager />
                    ) : (
                      <SettingsPage saving={saving} onSubmit={savePreferences} />
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
      <PaidTablesDialog open={salesOpen && !publicView && Boolean(sessionMember)} onClose={() => setSalesOpen(false)} />
      <CashRegister mode={cashMode} open={cashOpen && !publicView && Boolean(sessionMember)} onClose={() => setCashOpen(false)} onToast={toast} expenses={cashExpenses} setExpenses={setCashExpenses} />
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
