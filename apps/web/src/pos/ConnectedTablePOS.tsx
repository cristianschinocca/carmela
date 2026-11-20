import { useEffect, useState } from "react";
import type { Product } from "../data";
import type { Stock } from "../stores/inventory";
import { catalogClient, type CatalogWorkspace } from "../features/catalog/catalogClient";
import TablePOS from "../components/pos/TablePOS";
import { accountClient, type ServerAccount, type ServerEmployee, type OfflineInventory } from "./serverAccountClient";
import type { CatalogProduct } from "../features/catalog/catalogClient";
import { posSnapshot } from "./offline/snapshot";
import { accountJournal } from "./offline/accountJournal";
import { SettlementRecovery } from "./SettlementRecovery";
import { pendingSettlements } from "./serverAccountClient";
import { loadPosTeam, type PosTeam } from "../features/team/posTeamClient";
import { KEY, SECTORS_KEY, loadInitialFloor, loadSectors, type Sector, type Table } from "./floorModel";
import { floorClient, type RemoteFloor } from "./floorClient";
import { saleJournal, type OfflineSale } from "./offline/saleJournal";
import { OfflineSalesRecovery } from "./OfflineSalesRecovery";

type Props = { userId: string; offline: boolean; products: Product[]; categories: string[]; onToast: (message: string) => void; onStockChange: (stock: Stock) => void };
const offlineTeam: PosTeam = {
  members: [],
  verify: async () => { throw new Error("Conectate para verificar el código del empleado."); },
};
const cashAmount = (value: string) => /^-?\d+$/.test(value) ? `$ ${BigInt(value).toLocaleString("es-AR")}` : "no disponible";
type Ready = { workspace: string; floorKey: string; sectorsKey: string; tables: Table[]; sectors: Sector[]; version: number; dirty: boolean; localOnly: boolean; serverView?: { userId: string; workspace: string; accounts: ServerAccount[]; products: CatalogProduct[]; employees: ServerEmployee[]; offline?: boolean; pendingIds: string[]; pendingSales?: number; snapshotAt?: number; inventory?: OfflineInventory | null } };
export function ConnectedTablePOS({ userId, offline, products, categories, onToast, onStockChange }: Props) {
  const [workspaces, setWorkspaces] = useState<CatalogWorkspace[]>([]);
  const [workspace, setWorkspace] = useState("");
  const [team, setTeam] = useState<PosTeam | null>(null);
  const [teamError, setTeamError] = useState("");
  const [ready, setReady] = useState<Ready | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [networkOffline, setNetworkOffline] = useState(false);
  const [revision, setRevision] = useState(0);
  const [openCounterKey, setOpenCounterKey] = useState<string | null>(null);
  const [offlineSales, setOfflineSales] = useState<OfflineSale[] | null>(null);
  const lastKey = `mistro.pos.workspace.${userId}`;
  useEffect(() => {
    let active = true;
    if (offline) { const last = localStorage.getItem(lastKey); if (last) setWorkspace(last); else { setError("No hay una copia local del punto de venta. Conectate una vez antes de operar sin internet."); setLoading(false); } return; }
    setLoading(true); setNetworkOffline(false);
    void catalogClient.workspaces().then((items) => {
      if (!active) return;
      const available = items.filter((item) => item.status === "active"); setWorkspaces(available);
      const last = localStorage.getItem(lastKey);
      if (available.length === 1) setWorkspace(available[0].id);
      else if (last && available.some((item) => item.id === last)) setWorkspace(last);
      else if (!available.length) setError("No hay una cafetería activa vinculada a esta cuenta.");
    }).catch((reason: unknown) => { if (active) { const last = localStorage.getItem(lastKey); if (reason instanceof TypeError && last) { setNetworkOffline(true); setWorkspace(last); } else setError("No se pudieron cargar las cafeterías."); } }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [userId, offline, lastKey, revision]);
  useEffect(() => {
    let active = true;
    if (!workspace) return;
    const floorKey = `${KEY}.${userId}.${workspace}`;
    const sectorsKey = `${SECTORS_KEY}.${userId}.${workspace}`;
    const versionKey = `${floorKey}.version`;
    const dirtyKey = `${floorKey}.pending`;
    const serverModeKey = `${floorKey}.server-accounts`;
    localStorage.setItem(lastKey, workspace);
    const prepare = async (remote: RemoteFloor | null, localOnly = false) => {
      if (!active) return;
      if (await saleJournal.hasOtherUser(userId, workspace)) { if (active) { setError("Hay cobros de otra sesión pendientes en esta PC. Iniciá esa sesión y sincronizalos antes de continuar."); setLoading(false); } return; }
      if (!active) return;
      if (localOnly) {
        try {
          const snapshot = await posSnapshot.load(userId, workspace);
          if (!active) return;
          if (!snapshot) { setError("No hay una copia local del punto de venta. Conectate una vez antes de operar sin internet."); setLoading(false); return; }
          const [pendingIds, sales] = await Promise.all([accountJournal.list(userId, workspace), saleJournal.list(userId, workspace)]);
          if (!active) return;
          const tables = snapshot.floor.tables.map((table) => ({ ...table, guests: 2, discount: 0, billRequested: false, items: [], slot: table.slot ?? undefined }));
          setReady({ workspace, floorKey: `${floorKey}.offline-view`, sectorsKey: `${sectorsKey}.offline-view`, tables, sectors: snapshot.floor.sectors, version: snapshot.floor.version, dirty: false, localOnly: true,
            serverView: { userId, workspace, accounts: snapshot.accounts, products: snapshot.products, employees: snapshot.employees, offline: true, pendingIds, pendingSales: sales.length, snapshotAt: snapshot.savedAt, inventory: snapshot.inventory } });
          setError(""); setLoading(false); return;
        } catch { if (active) { setError("No se pudo acceder a la copia local. Los datos se conservaron."); setLoading(false); } return; }
      }
      if (!localStorage.getItem(floorKey) && !remote?.initialized) {
        const legacyOwnerKey = `${KEY}.legacy-owner`;
        const legacyOwner = localStorage.getItem(legacyOwnerKey);
        if ((!legacyOwner || legacyOwner === workspace) && workspaces.length <= 1) {
          const previous = localStorage.getItem(KEY), previousSectors = localStorage.getItem(SECTORS_KEY);
          if (previous) {
            localStorage.setItem(floorKey, previous); if (previousSectors) localStorage.setItem(sectorsKey, previousSectors);
            localStorage.setItem(`${floorKey}.sector-numbers.v1`, "1"); localStorage.setItem(`${floorKey}.seed.128.v1`, "1");
            localStorage.setItem(legacyOwnerKey, workspace);
          }
        }
      }
      const localTables = loadInitialFloor(floorKey, sectorsKey), localSectors = loadSectors(sectorsKey);
      let tables = localTables, sectors = localSectors;
      const dirty = localStorage.getItem(dirtyKey) === "1" || !!localStorage.getItem(`${floorKey}.request`);
      let serverView: Ready["serverView"];
      if (remote?.initialized && !dirty && !localOnly) {
        localStorage.setItem(serverModeKey, "1");
        if (localTables.some((table) => table.items.length || table.billRequested)) {
          setError("Hay cuentas locales pendientes. Se conservaron en este dispositivo y deben resolverse antes de usar las cuentas del servidor."); setLoading(false); return;
        }
        const [accounts, serverProducts, employees, inventory] = await Promise.all([accountClient.list(workspace), catalogClient.products(workspace), accountClient.employees(workspace), accountClient.offlineInventory(workspace).catch(() => null)]);
        if (!active) return;
        const byKey = new Map(accounts.map((account) => [account.clientKey, account]));
        if (byKey.size !== accounts.length || remote.tables.some((table) => {
          const account = byKey.get(table.id);
          return !account || table.hasAccount !== Boolean(account.items.length || account.guests || account.billRequested);
        })) throw new Error("El plano cambió durante la carga. Volvé a intentar.");
        const pendingIds = await accountJournal.list(userId, workspace);
        if (!active) return;
        serverView = { userId, workspace, accounts, products: serverProducts, employees, pendingIds };
        try { await posSnapshot.save(userId, workspace, { floor: remote, accounts, products: serverProducts, employees, inventory, savedAt: Date.now() }); } catch { const pending = await saleJournal.list(userId, workspace); if (pending.length) { if (active) { setOfflineSales(pending); setLoading(false); } return; } onToast("No se pudo actualizar la copia para trabajar sin conexión."); }
        if (!active) return;
        const remoteIds = new Set(remote.tables.map((table) => table.id));
        if (localTables.some((table) => table.area !== "counter" && (table.items.length || table.billRequested) && !remoteIds.has(table.id))) { setError("Hay cuentas locales que no están en el plano del servidor. Se conservaron en este dispositivo; no se reemplazó el plano."); setLoading(false); return; }
        sectors = remote.sectors;
        tables = [...remote.tables.map((table) => ({ ...table, guests: 2, discount: 0, billRequested: false, items: [], id: table.id, area: table.area, name: table.name, x: table.x, y: table.y, slot: table.slot ?? undefined })), ...localTables.filter((table) => table.area === "counter" && !serverView)];
      }
      const version = dirty ? Number(localStorage.getItem(versionKey) ?? 0) : remote?.version ?? Number(localStorage.getItem(versionKey) ?? 0);
      if (!dirty && remote) localStorage.setItem(versionKey, String(version));
      setReady({ workspace, floorKey, sectorsKey, tables, sectors, version, dirty, localOnly, serverView }); setError(""); setLoading(false);
    };
    setReady(null); setLoading(true); setError("");
    if (offline || networkOffline) void prepare(null, true);
    else void floorClient.load(workspace).then(async (remote) => { const pending = await saleJournal.list(userId, workspace); if (!active) return; if (pending.length) { setOfflineSales(pending); setLoading(false); return; } setOfflineSales(null); if (remote.initialized) localStorage.setItem(serverModeKey, "1"); if (remote.initialized && (localStorage.getItem(dirtyKey) === "1" || localStorage.getItem(`${floorKey}.request`))) throw new Error("Hay cambios locales del plano pendientes. Resolvélos antes de abrir las cuentas del servidor."); return prepare(remote); }).catch((reason: unknown) => { if (active) { if (reason instanceof TypeError) void prepare(null, true); else { setError(reason instanceof Error ? reason.message : "No se pudo cargar el plano."); setLoading(false); } } });
    return () => { active = false; };
  }, [workspace, offline, networkOffline, userId, lastKey, revision, workspaces.length]);
  useEffect(() => {
    let active = true;
    setTeam(null); setTeamError("");
    if (!ready || ready.localOnly) return;
    void loadPosTeam(ready.workspace).then((result) => { if (active) setTeam(result); }).catch(() => { if (active) setTeamError("No se pudo cargar el equipo. Comprobá la conexión y volvé a intentar."); });
    return () => { active = false; };
  }, [ready?.workspace, ready?.localOnly, revision]);
  if (workspace && pendingSettlements(userId, workspace).length) return <SettlementRecovery key={`${workspace}-${revision}`} userId={userId} workspace={workspace} onResolved={() => setRevision((v) => v + 1)} />;
  if (offlineSales && !offline && !networkOffline) return <OfflineSalesRecovery key={`${workspace}-${revision}`} initial={offlineSales} onResolved={() => { setOfflineSales(null); setRevision((v) => v + 1); }} />;
  return <div className="grid gap-2">
    {!offline && workspaces.length > 1 && <label className="text-sm">Cafetería <select value={workspace} onChange={(event) => { setReady(null); setWorkspace(event.target.value); }}><option value="">Seleccionar cafetería</option>{workspaces.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>}
    {loading && <p role="status">Cargando plano…</p>}
    {error && <p role="alert">{error} {!offline && <button type="button" className="button" onClick={() => setRevision((v) => v + 1)}>Reintentar</button>}</p>}
    {teamError && <p role="alert">{teamError} <button type="button" className="button" onClick={() => setRevision((v) => v + 1)}>Reintentar</button></p>}
    {ready && !ready.localOnly && !team && !teamError && <p role="status">Cargando equipo…</p>}
    {ready && (ready.localOnly || team) && <>{ready.localOnly && !ready.serverView && !offline && <p role="status" className="text-xs text-amber-500">Sin conexión: podés consultar el plano, pero todavía no es posible verificar los códigos del equipo del servidor.</p>}{ready.dirty && !ready.localOnly && <p role="status" className="text-xs text-amber-500">Hay cambios locales pendientes. Abrí las opciones y guardá el plano para sincronizarlos.</p>}<p className="text-xs text-[var(--muted)]">{ready.serverView?.offline ? `Sin conexión · Copia del ${new Date(ready.serverView.snapshotAt!).toLocaleString("es-AR")}. Los cobros quedan pendientes de verificación y sincronización; el plano puede no reflejar otras terminales.` : ready.serverView ? `${ready.serverView.pendingIds.length ? `${ready.serverView.pendingIds.length} mesa(s) con cambios pendientes. ` : ""}Las cuentas y los cobros se guardan en el servidor.` : "Las cuentas y los cobros permanecen en este dispositivo."}</p>{ready.serverView?.offline && <p className="text-xs text-[var(--muted)]">{ready.serverView.inventory ? ready.serverView.inventory.cash ? `Efectivo esperado en esta PC: ${cashAmount(ready.serverView.inventory.cash.expectedAmount)}. ${ready.serverView.pendingSales ?? 0} cobro(s) pendiente(s) de sincronizar. Las existencias pueden haber cambiado en el servidor.` : "La última copia no tenía una caja abierta." : "No hay una copia reciente de caja y stock; conectate para actualizarla."}</p>}{ready.serverView?.offline && !offline && <button type="button" className="button w-fit" onClick={() => setRevision((v) => v + 1)}>Reconectar</button>}<TablePOS openCounterKey={openCounterKey} onCounterOpened={(key) => { setOpenCounterKey(key); setRevision((v) => v + 1); }} onCounterHandled={() => setOpenCounterKey(null)} serverView={ready.serverView && { ...ready.serverView, onRefresh: () => { setReady(null); setRevision((v) => v + 1); } }} teamAccess={ready.localOnly ? offlineTeam : team ?? undefined} key={`${ready.workspace}-${ready.localOnly}`} products={products} categories={categories} onToast={onToast} onStockChange={onStockChange} floorKey={ready.floorKey} sectorsKey={ready.sectorsKey} initialTables={ready.tables} initialSectors={ready.sectors} initialFloorVersion={ready.version} initialUnsynced={ready.dirty && !ready.localOnly} serverWorkspace={ready.localOnly ? undefined : ready.workspace} onLocalFloorSave={(version) => { localStorage.setItem(`${ready.floorKey}.version`, String(version)); if (ready.localOnly) localStorage.setItem(`${ready.floorKey}.pending`, "1"); else localStorage.removeItem(`${ready.floorKey}.pending`); if (ready.serverView) setRevision((v) => v + 1); }} /></>}
  </div>;
}
