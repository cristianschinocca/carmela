import { motion } from "motion/react";
import { ArrowUpRight, Coffee } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LoginForm } from "@/features/auth/LoginForm";
import { pageVariants } from "../../motion";
import type { TeamMember } from "../../stores/team";

type LoginPageProps = {
  onLogin: (member: TeamMember) => void;
  onOpenMenu: () => void;
};

export function LoginPage({ onLogin, onOpenMenu }: LoginPageProps) {
  return (
    <motion.main
      key="login"
      className="login-page !m-0 flex min-h-dvh !w-full !max-w-none flex-col !bg-[#faf9f7] !p-0 !text-[#282427] [body:has(&)]:!bg-[#faf9f7] [body:has(&)]:!p-0"
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
    >
      <header className="border-b border-[#e8e3e1]">
        <div className="mx-auto flex min-h-[76px] w-[min(calc(100%-48px),1120px)] items-center justify-between gap-4 max-sm:min-h-[68px] max-sm:w-[calc(100%-36px)]">
          <span className="inline-flex items-center gap-2.5" aria-label="Carmela, salumería y café">
            <span className="grid size-9 place-items-center rounded-[10px] bg-[#bd2d69] text-white"><Coffee size={19} strokeWidth={2} aria-hidden="true" /></span>
            <span className="text-[19px] font-bold tracking-[-.04em] text-[#282427]">Carmela<span className="text-[#bd2d69]">.</span></span>
          </span>
          <Button type="button" variant="ghost" className="!h-10 !gap-2 !rounded-md !px-3 !text-xs !font-semibold !text-[#574c50] hover:!bg-[#f0ebe9] hover:!text-[#a1265b] focus-visible:!outline-[#bd2d69] focus-visible:!outline-offset-2" onClick={onOpenMenu}>
            Menú público <ArrowUpRight size={15} aria-hidden="true" />
          </Button>
        </div>
      </header>

      <div className="flex flex-1 items-center px-6 py-14 max-sm:px-5 max-sm:py-10">
        <section aria-labelledby="login-form-title" className="mx-auto w-full max-w-[360px]">
          <h1 id="login-form-title" className="!text-[28px] !font-bold !tracking-[-.03em] !text-[#282427]">Iniciá sesión</h1>
          <p className="!mt-1.5 !text-[13px] !leading-normal !text-[#71686c]">Ingresá con tu correo y contraseña.</p>
          <LoginForm onLogin={onLogin} />
        </section>
      </div>

      <footer className="!m-0 !block !w-full !border-0 !border-t !border-solid !border-[#e8e3e1] !p-0">
        <div className="mx-auto flex min-h-16 w-[min(calc(100%-48px),1120px)] items-center justify-between gap-3 text-xs text-[#756c70] max-sm:min-h-[76px] max-sm:w-[calc(100%-36px)] max-sm:flex-col max-sm:items-start max-sm:justify-center max-sm:gap-1">
          <span>© 2026 Carmela · Villa Madero, Buenos Aires</span>
          <span>Versión de prueba · Datos guardados en este navegador</span>
        </div>
      </footer>
    </motion.main>
  );
}
