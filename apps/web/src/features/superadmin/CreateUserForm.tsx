import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, Save } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const schema = z.object({
  name: z.string().trim().min(2, "Ingresá el nombre completo."),
  email: z.string().trim().email("Ingresá un correo válido."),
  password: z.string().min(12, "Usá al menos 12 caracteres."),
  brandName: z.string().trim().min(2, "Ingresá el nombre de la marca."),
});

type Values = z.infer<typeof schema>;

export function CreateUserForm({ onCreated, onCancel }: { onCreated: () => void; onCancel: () => void }) {
  const [visible, setVisible] = useState(false);
  const { register, handleSubmit, reset, setError, formState: { errors, isSubmitting } } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", email: "", password: "", brandName: "" },
  });

  const submit = async (values: Values) => {
    try {
      const response = await fetch("/api/admin/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...values, email: values.email.toLowerCase() }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => null) as { error?: string } | null;
        setError("root", { message: data?.error ?? (response.status === 403 ? "No tenés permiso para crear cuentas." : "No se pudo crear la cuenta. Revisá si el correo ya está registrado.") });
        return;
      }
      reset();
      onCreated();
    } catch {
      setError("root", { message: "No pudimos conectar con el servidor." });
    }
  };

  return (
    <form onSubmit={handleSubmit(submit)} noValidate className="admin-create-form grid gap-5 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 sm:grid-cols-2">
      <div className="admin-form-heading sm:col-span-2"><h3>Nuevo usuario</h3><p>Completá los datos de acceso y de la marca.</p></div>
      <div className="grid gap-1.5">
        <Label htmlFor="admin-name">Nombre completo</Label>
        <Input id="admin-name" autoComplete="name" placeholder="Ej. Lucía Pérez" aria-invalid={!!errors.name} {...register("name")} />
        {errors.name && <p className="text-xs text-[var(--text)]" role="alert">{errors.name.message}</p>}
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="admin-email">Correo electrónico</Label>
        <Input id="admin-email" type="email" autoComplete="off" placeholder="lucia@cafeteria.com" aria-invalid={!!errors.email} {...register("email")} />
        {errors.email && <p className="text-xs text-[var(--text)]" role="alert">{errors.email.message}</p>}
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="admin-brand">Nombre de la marca</Label>
        <Input id="admin-brand" placeholder="Ej. Café de la Esquina" aria-invalid={!!errors.brandName} {...register("brandName")} />
        {errors.brandName && <p className="text-xs text-[var(--text)]" role="alert">{errors.brandName.message}</p>}
      </div>
      <div className="grid gap-1.5 sm:col-span-2">
        <Label htmlFor="admin-password">Contraseña inicial</Label>
        <div className="relative">
          <Input id="admin-password" type={visible ? "text" : "password"} autoComplete="new-password" placeholder="Mínimo 12 caracteres" className="pr-11" aria-invalid={!!errors.password} {...register("password")} />
          <Button type="button" variant="ghost" size="icon-sm" className="absolute right-1 top-0.5" onClick={() => setVisible((value) => !value)} aria-label={visible ? "Ocultar contraseña" : "Mostrar contraseña"} aria-pressed={visible}>
            {visible ? <EyeOff /> : <Eye />}
          </Button>
        </div>
        {errors.password && <p className="text-xs text-[var(--text)]" role="alert">{errors.password.message}</p>}
        <p className="text-xs text-[var(--muted)]">Compartí esta contraseña por un canal seguro. La marca queda pendiente de activación hasta configurar su base operativa.</p>
      </div>
      {errors.root && <p className="text-xs text-[var(--text)] sm:col-span-2" role="alert">{errors.root.message}</p>}
      <div className="flex flex-wrap justify-end gap-2 sm:col-span-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>Cancelar</Button>
        <Button type="submit" disabled={isSubmitting} className="admin-primary"><Save />{isSubmitting ? "Creando…" : "Crear usuario"}</Button>
      </div>
    </form>
  );
}
