import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, Eye, EyeOff, LockKeyhole, Mail } from "lucide-react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { defaultTeam, loadTeamMembers, type TeamMember } from "@/stores/team";
import { loginSchema, type LoginValues } from "./loginSchema";

const DEMO_CREDENTIALS: LoginValues = {
  email: "demo@carmela.app",
  password: "Carmela2026!",
};

const inputWrapClass = "relative flex min-h-[46px] items-center rounded-[10px] border border-[#ded6da] bg-white transition-[border-color,box-shadow] focus-within:border-[#c52f70] focus-within:shadow-[0_0_0_3px_#c52f7018] data-[invalid=true]:border-[#b83a58] data-[invalid=true]:focus-within:shadow-[0_0_0_3px_#b83a5818] motion-reduce:transition-none";
const inputClass = "!min-h-[44px] !w-full !border-0 !bg-transparent !px-[13px] !py-0 !text-[13px] !text-[#292327] !shadow-none !outline-none placeholder:!text-[#a39ba1] focus:!border-0 focus-visible:!ring-0 aria-invalid:!text-[#a33b60]";
const errorClass = "!text-[11px] !leading-[1.4] !text-[#a72f55]";

export function LoginForm({ onLogin }: { onLogin: (member: TeamMember) => void }) {
  const [showPassword, setShowPassword] = useState(false);
  const {
    register,
    handleSubmit,
    reset,
    setError,
    clearErrors,
    formState: { errors },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const submit = ({ email, password }: LoginValues) => {
    if (email.toLowerCase() !== DEMO_CREDENTIALS.email || password !== DEMO_CREDENTIALS.password) {
      setError("root.credentials", { message: "El correo o la contraseña no coinciden con la cuenta de prueba." });
      return;
    }
    const owner = loadTeamMembers().find((member) => member.role === "Propietario" && member.active) ?? defaultTeam[0];
    onLogin(owner);
  };

  return (
    <>
      <form onSubmit={handleSubmit(submit)} className="mt-[34px] grid gap-[19px]" noValidate>
        <div className="grid gap-2">
          <Label htmlFor="login-email" className="!text-xs !font-[650]">Correo electrónico</Label>
          <div className={inputWrapClass} data-invalid={Boolean(errors.email || errors.root?.credentials)}>
            <Mail size={18} className="ml-3.5 text-[#999097]" aria-hidden="true" />
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
          <Label htmlFor="login-password" className="!text-xs !font-[650]">Contraseña</Label>
          <div className={inputWrapClass} data-invalid={Boolean(errors.password || errors.root?.credentials)}>
            <LockKeyhole size={18} className="ml-3.5 text-[#999097]" aria-hidden="true" />
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
              className="!mr-1 !grid !size-[38px] !shrink-0 !place-items-center !rounded-lg !p-0 !text-[#80777e] hover:!bg-[#f8eef2] focus-visible:!outline-[#c52f70] focus-visible:!outline-offset-[3px]"
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
          <p id="login-error" className="!-mt-[5px] !text-[11px] !leading-normal !text-[#a72f55]" role="alert">{errors.root.credentials.message}</p>
        )}

        <Button type="submit" size="lg" className="!mt-1 !flex !min-h-[46px] !items-center !justify-center !gap-[9px] !rounded-[10px] !bg-[#c52f70] !text-center !text-[13px] !font-bold !text-white hover:!bg-[#ab265f] hover:![filter:none] focus-visible:!outline-[#c52f70] focus-visible:!outline-offset-[3px]">
          Ingresar al panel <ArrowRight size={17} />
        </Button>
      </form>

      <div className="mt-7 flex items-center justify-between gap-3 border-t border-[#eee7e9] pt-5 max-[600px]:flex-col max-[600px]:items-start max-[600px]:gap-1">
        <div>
          <strong className="block text-[11px] font-bold">¿Querés probar el sistema?</strong>
          <span className="mt-1 block text-[10px] text-[#8b8389]">Completá la cuenta de demostración.</span>
        </div>
        <Button type="button" variant="ghost" className="!h-auto !shrink-0 !rounded-lg !px-[9px] !py-2 !text-[10px] !font-bold !whitespace-nowrap !text-[#a72860] hover:!bg-[#f8e8ef] hover:![filter:none] focus-visible:!outline-[#c52f70] focus-visible:!outline-offset-[3px] max-[600px]:!-ml-[9px]" onClick={() => reset(DEMO_CREDENTIALS)}>
          Usar cuenta de prueba
        </Button>
      </div>
    </>
  );
}
