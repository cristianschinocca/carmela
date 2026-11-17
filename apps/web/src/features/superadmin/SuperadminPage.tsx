import { useEffect, useState } from "react";
import { Pencil, Plus, ShieldCheck, Trash2, UserRoundCheck, UserRoundX } from "lucide-react";
import { authClient, type SessionUser } from "../auth/authClient";
import { CreateUserForm } from "./CreateUserForm";
import { EditUserForm } from "./EditUserForm";
import { Button } from "@/components/ui/button";

type AdminUser = { id: string; name: string; email: string; role?: string | null; banned?: boolean | null };
type Brand = { id: string; name: string; status: string; ownerUserId: string | null };
const PAGE_SIZE = 20;

export function SuperadminPage({ currentUser }: { currentUser: SessionUser }) {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(true);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    void authClient.admin.listUsers({ query: { limit: PAGE_SIZE, offset, sortBy: "createdAt", sortDirection: "desc" } })
      .then(({ data, error: requestError }) => {
        if (!active) return;
        if (requestError || !data) {
          setError("No pudimos cargar los usuarios. Verificá tu sesión e intentá nuevamente.");
          return;
        }
        setUsers(data.users);
        setTotal(data.total);
      })
      .catch(() => { if (active) setError("No pudimos conectar con el servidor."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [offset, revision]);

  useEffect(() => {
    let active = true;
    void fetch("/api/admin/brands")
      .then((response) => response.ok ? response.json() as Promise<Brand[]> : Promise.reject())
      .then((data) => { if (active) setBrands(data); })
      .catch(() => { if (active) setBrands([]); });
    return () => { active = false; };
  }, [revision]);

  const toggleAccess = async (user: AdminUser) => {
    if (user.id === currentUser.id || user.role?.split(",").includes("admin")) return;
    setPendingId(user.id);
    setError("");
    setNotice("");
    try {
      const result = user.banned
        ? await authClient.admin.unbanUser({ userId: user.id })
        : await authClient.admin.banUser({ userId: user.id, banReason: "Acceso desactivado por administración" });
      if (result.error) {
        setError("No se pudo cambiar el acceso de esta cuenta.");
        return;
      }
      setNotice(user.banned ? "Cuenta reactivada." : "Cuenta pausada; sus sesiones fueron revocadas.");
      setRevision((value) => value + 1);
    } catch {
      setError("No pudimos conectar con el servidor.");
    } finally {
      setPendingId(null);
    }
  };

  const removeUser = async (user: AdminUser) => {
    if (user.id === currentUser.id || user.role?.split(",").includes("admin")) return;
    setPendingId(user.id);
    setError("");
    setNotice("");
    try {
      const response = await fetch(`/api/admin/accounts/${encodeURIComponent(user.id)}`, { method: "DELETE" });
      if (!response.ok) {
        setError("No se pudo eliminar la cuenta.");
        return;
      }
      setDeleteId(null);
      setNotice(`Se eliminó la cuenta de ${user.name}.`);
      if (users.length === 1 && offset > 0) setOffset(offset - PAGE_SIZE);
      else setRevision((value) => value + 1);
    } catch {
      setError("No pudimos conectar con el servidor.");
    } finally {
      setPendingId(null);
    }
  };

  return (
    <section className="superadmin-content grid gap-6 text-[var(--text)]">
      <div className="admin-section-heading flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold">Cuentas</h2>
          <p className="mt-1 text-xs text-[var(--muted)]">Creá usuarios y administrá su acceso.</p>
        </div>
        {!creating && <Button type="button" onClick={() => setCreating(true)} className="admin-primary"><Plus />Nuevo usuario</Button>}
      </div>

      {creating && <CreateUserForm onCancel={() => setCreating(false)} onCreated={() => { setCreating(false); setOffset(0); setRevision((value) => value + 1); setNotice("Usuario y marca creados. El acceso a la cafetería queda pendiente de activación."); }} />}

      <div className="admin-user-list overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)]">
        <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-4">
          <h3 className="text-sm font-semibold">Usuarios registrados</h3>
          <span className="text-xs text-[var(--muted)]">{total} {total === 1 ? "cuenta" : "cuentas"}</span>
        </div>
        {notice && !error && <p className="mx-5 mt-4 text-xs text-[var(--text)]" role="status">{notice}</p>}
        {loading ? <p className="px-5 py-8 text-sm text-[var(--muted)]" role="status">Cargando usuarios…</p> : error ? <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-8"><p className="text-sm text-[var(--text)]" role="alert">{error}</p><Button type="button" variant="outline" size="sm" onClick={() => setRevision((value) => value + 1)}>Reintentar</Button></div> : users.length === 0 ? <p className="px-5 py-8 text-sm text-[var(--muted)]">Todavía no hay usuarios.</p> : (
          <ul className="divide-y divide-[var(--border)]">
            {users.map((user) => {
              const admin = user.role?.split(",").includes("admin") ?? false;
              return <li key={user.id} className="admin-user-row px-5 py-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-sm font-medium">{user.name}{admin && <span title="Superadmin" className="text-[var(--brand)]"><ShieldCheck size={15} /></span>}</div>
                  <p className="truncate text-xs text-[var(--muted)]">{user.email}</p>
                  {brands.filter((brand) => brand.ownerUserId === user.id).map((brand) => <p key={brand.id} className="mt-1 text-xs text-[var(--muted)]">{brand.name} · {brand.id} · {brand.status === "pending" ? "Pendiente" : "Activa"}</p>)}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="mr-2 rounded-full bg-neutral-500/15 px-2.5 py-1 text-xs text-[var(--text)]">{user.banned ? "Pausada" : "Activa"}</span>
                  {!admin && <>
                    <Button type="button" variant="outline" size="sm" disabled={pendingId === user.id} onClick={() => { setDeleteId(null); setEditingId(user.id); }} aria-label={`Editar cuenta de ${user.name}`}><Pencil />Editar</Button>
                    <Button type="button" variant="outline" size="sm" disabled={pendingId === user.id} onClick={() => void toggleAccess(user)} aria-label={`${user.banned ? "Reactivar" : "Pausar"} cuenta de ${user.name}`}>
                      {user.banned ? <UserRoundCheck /> : <UserRoundX />}{pendingId === user.id ? "Guardando…" : user.banned ? "Reactivar" : "Pausar"}
                    </Button>
                    <Button type="button" variant="outline" size="sm" disabled={pendingId === user.id} onClick={() => setDeleteId(user.id)} aria-label={`Eliminar cuenta de ${user.name}`} className="text-[var(--text)] hover:text-[var(--text)]"><Trash2 />Eliminar</Button>
                  </>}
                </div>
                </div>
                {editingId === user.id && !admin && <EditUserForm key={user.id} user={user} onCancel={() => setEditingId(null)} onSaved={() => { setEditingId(null); setNotice("Cuenta actualizada."); setRevision((value) => value + 1); }} />}
                {deleteId === user.id && <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[var(--border)] bg-neutral-500/10 p-3" role="group" aria-label={`Confirmar eliminación de ${user.name}`}>
                  <p className="text-xs text-[var(--text)]">¿Eliminar definitivamente a <strong>{user.name}</strong> ({user.email})? Esta acción no se puede deshacer.</p>
                  <div className="flex gap-2">
                    <Button type="button" variant="outline" size="sm" disabled={pendingId === user.id} onClick={() => setDeleteId(null)}>Cancelar</Button>
                    <Button type="button" size="sm" disabled={pendingId === user.id} onClick={() => void removeUser(user)} className="bg-[var(--brand)] text-white hover:opacity-90"><Trash2 />{pendingId === user.id ? "Eliminando…" : "Eliminar cuenta"}</Button>
                  </div>
                </div>}
              </li>;
            })}
          </ul>
        )}
        {total > PAGE_SIZE && <div className="flex items-center justify-end gap-3 border-t border-[var(--border)] px-5 py-3">
          <Button type="button" variant="outline" size="sm" disabled={offset === 0 || loading} onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}>Anterior</Button>
          <span className="text-xs text-[var(--muted)]">{Math.floor(offset / PAGE_SIZE) + 1} de {Math.ceil(total / PAGE_SIZE)}</span>
          <Button type="button" variant="outline" size="sm" disabled={offset + PAGE_SIZE >= total || loading} onClick={() => setOffset(offset + PAGE_SIZE)}>Siguiente</Button>
        </div>}
      </div>
    </section>
  );
}
