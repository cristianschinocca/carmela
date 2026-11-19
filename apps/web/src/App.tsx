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
import { ConnectedTablePOS } from "./pos/ConnectedTablePOS";
import { PaidTablesDialog } from "./components/pos/PaidTablesDialog";
import { ServerCatalog } from "./features/catalog/ServerCatalog";
import { StockWorkspace } from "./stock/StockWorkspace";
import { StockAlerts } from "./components/stock/StockAlerts";
import { loadStock, productsWithStock, type Stock } from "./stores/inventory";
import { ServerTeamManager } from "./features/team/ServerTeamManager";
import { ServerAttendanceManager } from "./features/team/ServerAttendanceManager";
import { SalesReports } from "./components/reports/SalesReports";
import { CashRegister } from "./components/cash/CashRegister";
import { ConnectedCashRegister } from "./features/cash/ConnectedCashRegister";
import { cashMovementImpact, isCashExpense, type CashExpense } from "./stores/cash";
import { PublicMenu } from "./components/menu/PublicMenu";
import { LoginPage } from "./components/auth/LoginPage";
import { authClient, isSuperadmin, type SessionUser } from "./features/auth/authClient";
import { clearOfflineAccess, clearPendingSignOut, hasPendingSignOut, markPendingSignOut } from "./features/auth/offlineAccess";
import { SuperadminPage } from "./features/superadmin/SuperadminPage";
import { SuperadminLoginPage } from "./features/superadmin/SuperadminLoginPage";
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
  loadProducts,
} from "./stores/workspace";

export function App() {
  const [sessionMember, setSessionMember] = useState<SessionUser | null>(null);
  const [offlineMode, setOfflineMode] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [profileOpen, setProfileOpen] = useState(false);
  const [products] = useState<Product[]>(loadProducts);
  const [stock, setStock] = useState<Stock>(loadStock);
  const [categoryList] = useState<string[]>(loadCategories);
  const [page, setPage] = useState("Resumen");
  const [cashOpen, setCashOpen] = useState(false);
  const [salesOpen, setSalesOpen] = useState(false);
  const [cashMode, setCashMode] = useState<"movements" | "count">("movements");
  const [publicView, setPublicView] = useState(location.hash === "#menu");
  useEffect(() => {
    document.title = publicView ? "Carmela — Salumería y café" : "Mistro — Gestión de cafeterías";
  }, [publicView]);
  const [publicThemeActive, setPublicThemeActive] = useState(
    location.hash === "#menu",
  );
  const { darkMode, setDarkMode } = useDashboardTheme(publicThemeActive || !sessionMember);
  const [side, setSide] = useState(false);
  const [notice, setNotice] = useState("");
  const [period, setPeriod] = useState("Hoy");
  const [selected, setSelected] = useState<Product | null>(null);
  const [saving, setSaving] = useState(false);
  const [cashLegacy, setCashLegacy] = useState(false);
  const [cashExpenses, setCashExpenses] = useState<CashExpense[]>(loadCashExpenses);
  useEffect(() => {
    let active = true;
    const finishSignOut = async () => {
      if (!hasPendingSignOut() || !navigator.onLine) return;
      try {
        const result = await authClient.signOut();
        if (!result.error) clearPendingSignOut();
      } catch { /* Se intentará de nuevo cuando vuelva la conexión. */ }
    };
    if (hasPendingSignOut()) {
      setSessionLoading(false);
      void finishSignOut();
    } else {
      void authClient.getSession().then(({ data }) => {
        if (active) {
          setSessionMember(data?.user ?? null);
          if (isSuperadmin(data?.user ?? null)) setPage("Superadmin");
        }
      }).catch(() => {
        if (active) setSessionMember(null);
      }).finally(() => {
        if (active) setSessionLoading(false);
      });
    }
    window.addEventListener("online", finishSignOut);
    return () => { active = false; window.removeEventListener("online", finishSignOut); };
  }, []);
  useEffect(() => {
    if (sessionLoading || publicView) return;
    if (sessionMember && isSuperadmin(sessionMember) && !offlineMode && location.pathname !== "/superadmin") {
      history.replaceState(history.state, "", "/superadmin" + location.search + location.hash);
    }
  }, [sessionLoading, sessionMember, offlineMode, publicView]);
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
    if (offlineMode && p !== "Punto de venta") return;
    if (isSuperadmin(sessionMember) && p !== "Superadmin") return;
    if (p === "Superadmin" && !isSuperadmin(sessionMember)) return;
    setPage(p);
    setSide(false);
    setProfileOpen(false);
  };
  const login = (user: SessionUser, offline = false) => {
    setSessionMember(user);
    setOfflineMode(offline);
    setPage(offline ? "Punto de venta" : isSuperadmin(user) ? "Superadmin" : "Resumen");
  };
  const logout = async () => {
    try {
      if (offlineMode) markPendingSignOut();
      else {
        const result = await authClient.signOut();
        if (result.error) throw new Error(result.error.message);
        clearPendingSignOut();
      }
    } catch {
      toast("No se pudo cerrar la sesión. Intentá nuevamente.");
      return;
    }
    clearOfflineAccess();
    setSessionMember(null);
    setOfflineMode(false);
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
  const reconnect = async () => {
    if (reconnecting || !sessionMember) return;
    setReconnecting(true);
    try {
      const result = await authClient.getSession();
      if (result.error || !result.data?.user || result.data.user.id !== sessionMember.id || isSuperadmin(result.data.user)) {
        toast("Iniciá sesión nuevamente para sincronizar. Los borradores permanecen en este dispositivo.");
        return;
      }
      setSessionMember(result.data.user);
      setOfflineMode(false);
      toast("Conexión restablecida. Revisá las mesas pendientes.");
    } catch { toast("No se pudo conectar. Los borradores permanecen en este dispositivo."); }
    finally { setReconnecting(false); }
  };
  const savePreferences = (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    window.setTimeout(() => {
      setSaving(false);
      toast("Preferencias actualizadas en esta vista de demostración.");
    }, 650);
  };
  const sellableProducts = productsWithStock(products, stock);
  const visiblePage = offlineMode ? "Punto de venta" : isSuperadmin(sessionMember) ? "Superadmin" : page;
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
        ) : sessionLoading ? (
          <main className="grid min-h-dvh place-items-center" role="status">Cargando sesión…</main>
        ) : location.pathname === "/superadmin" && !isSuperadmin(sessionMember) ? (
          <SuperadminLoginPage currentUser={sessionMember} onLogin={login} onSwitchAccount={() => void logout()} />
        ) : !sessionMember ? (
          <LoginPage onLogin={login} onOpenMenu={openMenu} />
        ) : (
          <motion.div
            key="dashboard"
            className={isSuperadmin(sessionMember) ? "dashboard-frame superadmin-frame" : "dashboard-frame"}
            variants={pageVariants}
            initial="initial"
            animate="animate"
            exit="exit"
          >
            <div className="app-shell">
            <WorkspaceSidebar side={side} profileOpen={profileOpen} setProfileOpen={setProfileOpen} sessionMember={sessionMember} offlineMode={offlineMode} page={visiblePage} go={go} logout={logout} darkMode={darkMode} setDarkMode={setDarkMode} toast={toast} />
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
                <main className={visiblePage === "Punto de venta" ? "pos-page" : undefined}>
                {offlineMode && <div className="mx-4 mt-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-xs text-[var(--text)]" role="status">Sin conexión · La disponibilidad del punto de venta depende de los datos guardados en este dispositivo. <button type="button" className="ml-2 underline" disabled={reconnecting} onClick={() => void reconnect()}>{reconnecting ? "Conectando…" : "Reconectar"}</button></div>}
                <button
                  className="icon-btn mobile-toggle floating-menu"
                  aria-label="Abrir navegación"
                  onClick={() => setSide(!side)}
                >
                  <Menu size={20} />
                </button>
                <AnimatePresence mode="wait" initial={false}>
                  <motion.div
                    key={visiblePage}
                    className="page-motion"
                    variants={pageVariants}
                    initial="initial"
                    animate="animate"
                    exit="exit"
                  >
                    {visiblePage !== "Punto de venta" && <div className="page-heading">
                      <div>
                        {!["Resumen", "Productos", "Stock", "Fichaje", "Menú digital", "Reportes", "Equipo", "Superadmin"].includes(visiblePage) && <span className="eyebrow">CARMELA · TU OPERACIÓN</span>}
                        <h1>{visiblePage === "Superadmin" ? "Administración" : visiblePage}</h1>
                        <p>
                          {visiblePage === "Resumen"
                            ? "Ventas, mesas y caja."
                            : visiblePage === "Productos"
                              ? "Catálogo de productos y categorías."
                              : visiblePage === "Stock"
                                ? "Productos, insumos, recetas y proveedores."
                                : visiblePage === "Punto de venta"
                                  ? "Mesas, consumos, descuentos y cobros en un solo lugar."
                                  : visiblePage === "Menú digital"
                                    ? "Vista previa y contenido del menú público."
                                    : visiblePage === "Equipo"
                                      ? "Personas, roles y accesos del equipo."
                                    : visiblePage === "Superadmin"
                                      ? "Usuarios y accesos al sistema."
                                    : visiblePage === "Fichaje"
                                        ? "Entradas, salidas y personal en turno."
                                        : visiblePage === "Reportes"
                                          ? "Ventas, cubiertos y productos por mes."
                                          : "Todo en su lugar, para que puedas enfocarte en tu café."}
                        </p>
                      </div>
                      <div className="heading-actions">
                        {visiblePage === "Resumen" ? (
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
                        ) : visiblePage === "Menú digital" ? (
                          <button className="button primary" onClick={openMenu}>
                            Ver menú público <ExternalLink size={16} />
                          </button>
                        ) : null}
                      </div>
                    </div>}
                    {visiblePage === "Resumen" ? (
                      <OverviewPage period={period} products={products} cashExpenseTotal={cashExpenseTotal} cashPaidExpenses={cashPaidExpenses} go={go} openCash={() => { setCashMode("movements"); setCashOpen(true); }} />
                    ) : visiblePage === "Punto de venta" ? (
                      <ConnectedTablePOS
                        userId={sessionMember!.id}
                        offline={offlineMode}
                        products={sellableProducts}
                        onStockChange={setStock}
                        categories={categoryList}
                        onToast={toast}
                      />
                    ) : visiblePage === "Productos" ? (
                      <ServerCatalog key={sessionMember.id} />
                    ) : visiblePage === "Stock" ? (
                      <StockWorkspace products={products} stock={stock} onStockChange={setStock} onToast={toast} />
                    ) : visiblePage === "Menú digital" ? (
                      <MenuAdminPage products={products} categories={categoryList} openMenu={openMenu} />
                    ) : visiblePage === "Reportes" ? (
                      <SalesReports products={products} />
                    ) : visiblePage === "Equipo" ? (
                      <ServerTeamManager key={sessionMember!.id} />
                    ) : visiblePage === "Superadmin" && isSuperadmin(sessionMember) ? (
                      <SuperadminPage currentUser={sessionMember} />
                    ) : visiblePage === "Fichaje" ? (
                      <ServerAttendanceManager key={sessionMember!.id} userId={sessionMember!.id} />
                    ) : (
                      <SettingsPage userId={sessionMember.id} saving={saving} onSubmit={savePreferences} />
                    )}
                  </motion.div>
                </AnimatePresence>
              </main>
            </div>
              </div>
            {!offlineMode && !isSuperadmin(sessionMember) && <aside className="workspace-utility-rail" aria-label="Panel lateral de opciones">
              <StockAlerts products={products} stock={stock} onOpenStock={() => go("Stock")} />
              <div className="utility-rail-divider" role="separator" />
              <button className="utility-rail-button" aria-label="Abrir caja" aria-pressed={cashOpen && cashMode === "movements"} title="Caja" onClick={() => { setCashMode("movements"); setCashOpen(true); }}><Wallet size={19} /></button>
              <button className="utility-rail-button" aria-label="Abrir arqueo" aria-pressed={cashOpen && cashMode === "count"} title="Arqueo" onClick={() => { setCashMode("count"); setCashOpen(true); }}><ReceiptText size={19} /></button>
              <button className="utility-rail-button" aria-label="Mesas cobradas del día" aria-pressed={salesOpen} title="Mesas cobradas del día" onClick={() => setSalesOpen(true)}><ShoppingBag size={19} /></button>
            </aside>}
          </motion.div>
        )}
      </AnimatePresence>
      <PaidTablesDialog open={salesOpen && !publicView && Boolean(sessionMember) && !isSuperadmin(sessionMember)} onClose={() => setSalesOpen(false)} />
      {cashLegacy ? <CashRegister mode={cashMode} open={cashOpen && !publicView && Boolean(sessionMember) && !isSuperadmin(sessionMember)} onClose={() => { setCashOpen(false); setCashLegacy(false); }} onToast={toast} expenses={cashExpenses} setExpenses={setCashExpenses} /> : <ConnectedCashRegister userId={sessionMember?.id ?? ""} open={cashOpen && !publicView && Boolean(sessionMember) && !isSuperadmin(sessionMember)} onClose={() => setCashOpen(false)} onLocal={() => setCashLegacy(true)} />}
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
