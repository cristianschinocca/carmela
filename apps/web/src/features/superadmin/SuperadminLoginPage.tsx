import { ArrowLeft, ShieldCheck } from "lucide-react";
import { motion } from "motion/react";
import { Button } from "@/components/ui/button";
import { LoginForm } from "@/features/auth/LoginForm";
import type { SessionUser } from "@/features/auth/authClient";
import { pageVariants } from "../../motion";

type Props = {
  currentUser: SessionUser | null;
  onLogin: (user: SessionUser) => void;
  onSwitchAccount: () => void;
};

export function SuperadminLoginPage({ currentUser, onLogin, onSwitchAccount }: Props) {
  return (
    <motion.main
      key="superadmin-login"
      className="superadmin-login !m-0 flex min-h-dvh !w-full !max-w-none flex-col !bg-[#f5f5f4] !p-0 !text-[#18181b] [body:has(&)]:!bg-[#f5f5f4] [body:has(&)]:!p-0"
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
    >
      <header className="border-b border-[#e4e4e7] bg-white">
        <div className="mx-auto flex min-h-[72px] w-[min(calc(100%-48px),1120px)] items-center justify-between gap-4 max-sm:w-[calc(100%-36px)]">
          <span className="inline-flex items-center gap-3"><span className="text-[18px] font-bold tracking-[-.03em]">Mistro.</span><span className="h-5 w-px bg-[#d4d4d8]" aria-hidden="true" /><span className="text-xs font-medium text-[#52525b]">Administración</span></span>
          <a href="/" className="inline-flex min-h-10 items-center gap-2 rounded-md px-3 py-2 text-xs font-medium text-[#3f3f46] hover:bg-[#f4f4f5] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#18181b]">
            <ArrowLeft size={15} aria-hidden="true" /> Volver al inicio
          </a>
        </div>
      </header>

      <div className="flex flex-1 items-center justify-center px-5 py-12">
        <section aria-labelledby="admin-login-title" className="w-full max-w-[420px] rounded-2xl border border-[#e4e4e7] bg-white px-8 py-9 shadow-[0_14px_40px_-28px_#18181b55] max-sm:px-6 max-sm:py-7">
          <div className="mb-7 grid size-11 place-items-center rounded-xl bg-[#18181b] text-white">
            <ShieldCheck size={21} strokeWidth={1.8} aria-hidden="true" />
          </div>
          <h1 id="admin-login-title" className="!text-[26px] !font-semibold !tracking-[-.03em] !text-[#18181b]">Superadmin</h1>
          {currentUser ? (
            <>
              <p className="mt-2 text-[13px] leading-relaxed text-[#52525b]">
                La sesión de {currentUser.email} no tiene acceso de administrador. Cerrá esa sesión para usar otra cuenta.
              </p>
              <Button type="button" onClick={onSwitchAccount} className="!mt-7 !min-h-11 !w-full !rounded-lg !bg-[#18181b] !text-sm !font-semibold !text-white hover:!bg-[#3f3f46] focus-visible:!outline-[#18181b]">
                Cambiar de cuenta
              </Button>
            </>
          ) : (
            <>
              <p className="!mt-1.5 !text-[13px] !leading-normal !text-[#52525b]">Ingresá con tu cuenta de administrador.</p>
              <LoginForm adminOnly onLogin={onLogin} />
            </>
          )}
        </section>
      </div>
      <footer className="!m-0 !block !w-full !border-0 !p-0">
        <p className="px-5 pb-6 text-center text-[11px] text-[#71717a]">Mistro · Acceso reservado</p>
      </footer>
    </motion.main>
  );
}
