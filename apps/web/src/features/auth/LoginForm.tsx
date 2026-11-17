import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, Eye, EyeOff } from "lucide-react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient, isSuperadmin, type SessionUser } from "./authClient";
import { clearPendingSignOut, saveOfflineAccess, unlockOfflineAccess } from "./offlineAccess";
import { loginSchema, type LoginValues } from "./loginSchema";

const inputWrapClass = "relative flex min-h-12 items-center rounded-lg border border-[#d9d1d1] bg-white transition-[border-color,box-shadow] focus-within:border-[#bd2d69] focus-within:shadow-[0_0_0_3px_#bd2d6920] data-[invalid=true]:border-[#a72f55] motion-reduce:transition-none";
const adminInputWrapClass = "relative flex min-h-12 items-center rounded-lg border border-[#d4d4d8] bg-white transition-[border-color,box-shadow] focus-within:border-[#18181b] focus-within:shadow-[0_0_0_3px_#18181b15] data-[invalid=true]:border-[#52525b] motion-reduce:transition-none";
const inputClass = "!min-h-[46px] !w-full !border-0 !bg-transparent !px-3.5 !py-0 !text-sm !text-[#282427] !shadow-none !outline-none placeholder:!text-[#82797c] focus:!border-0 focus-visible:!ring-0";
const errorClass = "!text-xs !leading-[1.4] !text-[#a72f55]";

export function LoginForm({ onLogin, adminOnly = false }: { onLogin: (user: SessionUser, offline?: boolean) => void; adminOnly?: boolean }) {
  const [showPassword, setShowPassword] = useState(false);
  const {
    register,
    handleSubmit,
    setError,
    clearErrors,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const submit = async ({ email, password }: LoginValues) => {
    if (!navigator.onLine) {
      if (adminOnly) {
        setError("root.credentials", { message: "El acceso de administración requiere conexión a Internet." });
        return;
      }
      const user = await unlockOfflineAccess(email, password);
      if (user) onLogin(user, true);
      else setError("root.credentials", { message: "Sin conexión. Iniciá sesión online una vez en este dispositivo para habilitar el POS sin Internet, o revisá tus datos." });
      return;
    }
    try {
      const result = await authClient.signIn.email({ email, password });
      if (result.error) {
        setError("root.credentials", { message: "No pudimos iniciar sesión. Revisá el correo y la contraseña." });
        return;
      }
      const session = await authClient.getSession();
      if (!session.data?.user) throw new Error("Sesión no disponible");
      if (isSuperadmin(session.data.user) !== adminOnly) {
        try {
          const signOut = await authClient.signOut();
          if (signOut.error) throw new Error(signOut.error.message);
        } catch {
          setError("root.credentials", { message: "No se pudo cerrar esta sesión. Actualizá la página e intentá nuevamente." });
          return;
        }
        setError("root.credentials", { message: adminOnly ? "Esta cuenta no tiene acceso de administración." : "Para esta cuenta, ingresá desde el acceso de administración." });
        return;
      }
      clearPendingSignOut();
      if (!adminOnly) {
        try { await saveOfflineAccess(email, password, session.data.user); } catch { /* El login online sigue disponible si el navegador bloquea el almacenamiento. */ }
      }
      onLogin(session.data.user);
    } catch {
      if (adminOnly) {
        setError("root.credentials", { message: "No pudimos conectar con el servidor. Intentá nuevamente cuando haya conexión." });
        return;
      }
      const user = await unlockOfflineAccess(email, password);
      if (user) onLogin(user, true);
      else setError("root.credentials", { message: "No pudimos conectar con el servidor. El POS sin conexión requiere un inicio de sesión online previo en este dispositivo." });
    }
  };

  return (
    <>
      <form onSubmit={handleSubmit(submit)} className="mt-7 grid gap-5" noValidate>
        <div className="grid gap-2">
          <Label htmlFor="login-email" className={`!text-[13px] !font-semibold ${adminOnly ? "!text-[#27272a]" : "!text-[#393235]"}`}>Correo electrónico</Label>
          <div className={adminOnly ? adminInputWrapClass : inputWrapClass} data-invalid={Boolean(errors.email || errors.root?.credentials)}>
            <Input
              id="login-email"
              type="email"
              autoComplete="username"
              placeholder={adminOnly ? "Correo de administrador" : "nombre@tucafe.com"}
              className={`${inputClass} ${adminOnly ? "!text-[#18181b] placeholder:!text-[#71717a]" : ""}`}
              aria-invalid={Boolean(errors.email || errors.root?.credentials)}
              aria-describedby={errors.email ? "login-email-error" : errors.root?.credentials ? "login-error" : undefined}
              {...register("email", { onChange: () => clearErrors("root") })}
            />
          </div>
          {errors.email && <p id="login-email-error" className={adminOnly ? "!text-xs !leading-[1.4] !text-[#3f3f46]" : errorClass} role="alert">{errors.email.message}</p>}
        </div>

        <div className="grid gap-2">
          <Label htmlFor="login-password" className={`!text-[13px] !font-semibold ${adminOnly ? "!text-[#27272a]" : "!text-[#393235]"}`}>Contraseña</Label>
          <div className={adminOnly ? adminInputWrapClass : inputWrapClass} data-invalid={Boolean(errors.password || errors.root?.credentials)}>
            <Input
              id="login-password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              placeholder="Ingresá tu contraseña"
              className={`${inputClass} ${adminOnly ? "!text-[#18181b] placeholder:!text-[#71717a]" : ""}`}
              aria-invalid={Boolean(errors.password || errors.root?.credentials)}
              aria-describedby={errors.password ? "login-password-error" : errors.root?.credentials ? "login-error" : undefined}
              {...register("password", { onChange: () => clearErrors("root") })}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className={`!mr-1 !grid !size-10 !shrink-0 !place-items-center !rounded-md !p-0 focus-visible:!outline-offset-[-2px] ${adminOnly ? "!text-[#52525b] hover:!bg-[#f4f4f5] focus-visible:!outline-[#18181b]" : "!text-[#756b70] hover:!bg-[#f4efef] focus-visible:!outline-[#bd2d69]"}`}
              onClick={() => setShowPassword((current) => !current)}
              aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
              aria-pressed={showPassword}
            >
              {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
            </Button>
          </div>
          {errors.password && <p id="login-password-error" className={adminOnly ? "!text-xs !leading-[1.4] !text-[#3f3f46]" : errorClass} role="alert">{errors.password.message}</p>}
        </div>

        {errors.root?.credentials && (
          <p id="login-error" className={`!-mt-1 !text-xs !leading-normal ${adminOnly ? "!text-[#3f3f46]" : "!text-[#a72f55]"}`} role="alert">{errors.root.credentials.message}</p>
        )}

        <Button type="submit" size="lg" disabled={isSubmitting} className={`!mt-1 !flex !min-h-12 !items-center !justify-center !gap-2 !rounded-lg !text-center !text-sm !font-semibold !text-white hover:![filter:none] focus-visible:!outline-offset-[3px] ${adminOnly ? "!bg-[#18181b] hover:!bg-[#3f3f46] focus-visible:!outline-[#18181b]" : "!bg-[#b92c68] hover:!bg-[#9f2258] focus-visible:!outline-[#bd2d69]"}`}>
          {isSubmitting ? "Ingresando…" : adminOnly ? "Entrar a administración" : "Ingresar al panel"} <ArrowRight size={17} />
        </Button>
      </form>
    </>
  );
}
