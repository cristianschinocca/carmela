import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, Eye, EyeOff } from "lucide-react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient, type SessionUser } from "./authClient";
import { loginSchema, type LoginValues } from "./loginSchema";

const inputWrapClass = "relative flex min-h-12 items-center rounded-lg border border-[#d9d1d1] bg-white transition-[border-color,box-shadow] focus-within:border-[#bd2d69] focus-within:shadow-[0_0_0_3px_#bd2d6920] data-[invalid=true]:border-[#a72f55] motion-reduce:transition-none";
const inputClass = "!min-h-[46px] !w-full !border-0 !bg-transparent !px-3.5 !py-0 !text-sm !text-[#282427] !shadow-none !outline-none placeholder:!text-[#82797c] focus:!border-0 focus-visible:!ring-0";
const errorClass = "!text-xs !leading-[1.4] !text-[#a72f55]";

export function LoginForm({ onLogin }: { onLogin: (user: SessionUser) => void }) {
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
    try {
      const result = await authClient.signIn.email({ email, password });
      if (result.error) {
        setError("root.credentials", { message: "No pudimos iniciar sesión. Revisá el correo y la contraseña." });
        return;
      }
      const session = await authClient.getSession();
      if (!session.data?.user) throw new Error("Sesión no disponible");
      onLogin(session.data.user);
    } catch {
      setError("root.credentials", { message: "No pudimos conectar con el servidor. Intentá nuevamente." });
    }
  };

  return (
    <>
      <form onSubmit={handleSubmit(submit)} className="mt-7 grid gap-5" noValidate>
        <div className="grid gap-2">
          <Label htmlFor="login-email" className="!text-[13px] !font-semibold !text-[#393235]">Correo electrónico</Label>
          <div className={inputWrapClass} data-invalid={Boolean(errors.email || errors.root?.credentials)}>
            <Input
              id="login-email"
              type="email"
              autoComplete="username"
              placeholder="nombre@tucafe.com"
              className={inputClass}
              aria-invalid={Boolean(errors.email || errors.root?.credentials)}
              aria-describedby={errors.email ? "login-email-error" : errors.root?.credentials ? "login-error" : undefined}
              {...register("email", { onChange: () => clearErrors("root") })}
            />
          </div>
          {errors.email && <p id="login-email-error" className={errorClass} role="alert">{errors.email.message}</p>}
        </div>

        <div className="grid gap-2">
          <Label htmlFor="login-password" className="!text-[13px] !font-semibold !text-[#393235]">Contraseña</Label>
          <div className={inputWrapClass} data-invalid={Boolean(errors.password || errors.root?.credentials)}>
            <Input
              id="login-password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              placeholder="Ingresá tu contraseña"
              className={inputClass}
              aria-invalid={Boolean(errors.password || errors.root?.credentials)}
              aria-describedby={errors.password ? "login-password-error" : errors.root?.credentials ? "login-error" : undefined}
              {...register("password", { onChange: () => clearErrors("root") })}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="!mr-1 !grid !size-10 !shrink-0 !place-items-center !rounded-md !p-0 !text-[#756b70] hover:!bg-[#f4efef] focus-visible:!outline-[#bd2d69] focus-visible:!outline-offset-[-2px]"
              onClick={() => setShowPassword((current) => !current)}
              aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
              aria-pressed={showPassword}
            >
              {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
            </Button>
          </div>
          {errors.password && <p id="login-password-error" className={errorClass} role="alert">{errors.password.message}</p>}
        </div>

        {errors.root?.credentials && (
          <p id="login-error" className="!-mt-1 !text-xs !leading-normal !text-[#a72f55]" role="alert">{errors.root.credentials.message}</p>
        )}

        <Button type="submit" size="lg" disabled={isSubmitting} className="!mt-1 !flex !min-h-12 !items-center !justify-center !gap-2 !rounded-lg !bg-[#b92c68] !text-center !text-sm !font-semibold !text-white hover:!bg-[#9f2258] hover:![filter:none] focus-visible:!outline-[#bd2d69] focus-visible:!outline-offset-[3px]">
          {isSubmitting ? "Ingresando…" : "Ingresar al panel"} <ArrowRight size={17} />
        </Button>
      </form>
    </>
  );
}
