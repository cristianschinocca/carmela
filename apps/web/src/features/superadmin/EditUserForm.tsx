import { useState, type FormEvent } from "react";
import { Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Props = { user: { id: string; name: string; email: string }; onCancel: () => void; onSaved: () => void };

export function EditUserForm({ user, onCancel, onSaved }: Props) {
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setSaving(true);
    try {
      const response = await fetch(`/api/admin/accounts/${encodeURIComponent(user.id)}`, {
        method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, email }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => null) as { error?: string } | null;
        setError(data?.error ?? "No se pudo actualizar la cuenta.");
        return;
      }
      onSaved();
    } catch { setError("No pudimos conectar con el servidor."); }
    finally { setSaving(false); }
  };
  return (
    <form onSubmit={submit} className="admin-create-form mt-4 grid gap-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 sm:grid-cols-2" aria-label={`Editar cuenta de ${user.name}`}>
      <div className="grid gap-1.5"><Label htmlFor={`edit-name-${user.id}`}>Nombre completo</Label><Input id={`edit-name-${user.id}`} value={name} onChange={(event) => setName(event.target.value)} minLength={2} maxLength={120} required /></div>
      <div className="grid gap-1.5"><Label htmlFor={`edit-email-${user.id}`}>Correo electrónico</Label><Input id={`edit-email-${user.id}`} type="email" value={email} onChange={(event) => setEmail(event.target.value)} maxLength={254} required /></div>
      <p className="text-xs text-[var(--muted)] sm:col-span-2">Si cambiás el correo, se cerrarán las sesiones de esta cuenta.</p>
      {error && <p role="alert" className="text-sm text-[var(--text)] sm:col-span-2">{error}</p>}
      <div className="flex flex-wrap justify-end gap-2 sm:col-span-2"><Button type="button" variant="outline" onClick={onCancel} disabled={saving}>Cancelar</Button><Button type="submit" className="admin-primary" disabled={saving}><Save />{saving ? "Guardando…" : "Guardar cambios"}</Button></div>
    </form>
  );
}
