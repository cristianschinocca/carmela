import { useEffect, useState } from "react";
import { catalogClient, type CatalogProduct } from "../features/catalog/catalogClient";
import { money } from "../data";
import type { RemoteFloor } from "./floorClient";
import { accountClient, type ServerAccount, type ServerEmployee } from "./serverAccountClient";
import { ServerAccountEditor } from "./ServerAccountEditor";

export function ServerAccountsPreview({ workspace, userId, floor, onRefresh }: { workspace: string; userId: string; floor: RemoteFloor; onRefresh: () => void }) {
  const [accounts, setAccounts] = useState<ServerAccount[] | null>(null);
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [employees, setEmployees] = useState<ServerEmployee[]>([]);
  const [editing, setEditing] = useState<ServerAccount | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    void Promise.all([accountClient.list(workspace), catalogClient.products(workspace), accountClient.employees(workspace)])
      .then(([data, catalog, team]) => { if (active) { setAccounts(data.filter((account) => account.items.length || account.guests || account.billRequested)); setProducts(catalog); setEmployees(team); } })
      .catch(() => { if (active) setError("No se pudieron consultar las cuentas, los productos o el equipo del servidor."); });
    return () => { active = false; };
  }, [workspace]);
  const tableName = (account: ServerAccount) => {
    const table = floor.tables.find((item) => item.id === account.clientKey);
    const sector = floor.sectors.find((item) => item.id === table?.area);
    return `${sector?.label ?? "Sector"} · ${table?.name ?? account.clientKey}`;
  };
  return <section className="panel grid gap-4 !p-6" aria-labelledby="server-accounts-title">
    <div><h2 id="server-accounts-title">Cuentas abiertas en el servidor</h2><p className="mt-2 text-sm text-[var(--muted)]">Podés editar y cobrar estas cuentas con el código del responsable. Las cuentas de este navegador se conservan por separado.</p></div>
    {error && <p role="alert">{error}</p>}
    {!accounts && !error && <p role="status">Cargando cuentas…</p>}
    {accounts?.map((account) => {
      const total = Math.max(0, account.items.reduce((sum, item) => sum + item.quantity * (item.unitPrice - item.unitDiscount), 0) - account.discount);
      return <article key={account.clientKey} className="rounded-xl border border-[var(--border)] p-4 text-sm">
        <div className="flex flex-wrap items-baseline justify-between gap-2"><strong>{tableName(account)}</strong><strong>{money(total)}</strong></div>
        <p className="mt-1 text-xs text-[var(--muted)]">{account.guests} cubiertos · {account.operator ? `${account.operator.name}${account.operator.active ? "" : " (inactivo)"}` : "Sin responsable asignado"}{account.billRequested ? " · Cuenta solicitada" : ""}</p>
        <ul className="mt-3 grid gap-1 text-xs text-[var(--muted)]">{account.items.map((item) => <li key={item.id}>{item.quantity} × {products.find((product) => product.id === item.productId)?.name ?? "Producto no disponible"}</li>)}</ul>
        <button type="button" className="button mt-3" aria-label={`Editar ${tableName(account)}`} onClick={() => setEditing(account)}>Editar cuenta</button>
      </article>;
    })}
    <button type="button" className="button w-fit" onClick={onRefresh}>Actualizar</button>
    {editing && <ServerAccountEditor account={editing} workspace={workspace} userId={userId} name={tableName(editing)} employees={employees} products={products} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); onRefresh(); }} />}
  </section>;
}
