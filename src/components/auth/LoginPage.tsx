import { motion } from "motion/react";
import { Coffee, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
      className="login-page !m-0 flex min-h-dvh !w-full !max-w-none flex-col !p-0 !text-[#292327] !bg-[#f7f5f5] [background-image:radial-gradient(ellipse_58%_48%_at_50%_45%,#f7eaf0_0%,transparent_80%)] [body:has(&)]:!p-0 [body:has(&)]:!bg-[#f7f5f5]"
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
    >
      <header className="w-full border-b border-[#e9e0e4] bg-[#ffffffa8]">
        <div className="mx-auto flex min-h-[76px] w-[min(calc(100%-48px),1120px)] items-center justify-between gap-4 max-[600px]:min-h-[68px] max-[600px]:w-[calc(100%-36px)]">
          <span className="inline-flex items-center gap-[11px]" aria-label="Carmela, salumería y café">
            <span className="grid size-9 place-items-center rounded-[11px] bg-[#c52f70] text-white"><Coffee size={19} strokeWidth={2.2} /></span>
            <span className="grid gap-0.5">
              <strong className="text-[19px] leading-none font-[750] tracking-[-.07em] text-[#292327] max-[600px]:text-[17px]">Carmela<span className="text-[#c52f70]">.</span></strong>
              <small className="text-[8px] leading-[1.2] font-[650] tracking-[.13em] text-[#9a8e95] max-[600px]:text-[7px]">SALUMERÍA Y CAFÉ</small>
            </span>
          </span>
          <Button type="button" variant="outline" className="!inline-flex !h-auto items-center !gap-[9px] !rounded-[9px] !border !border-[#e8dbe1] !bg-white !px-3 !py-[9px] !text-[11px] !font-[650] !text-[#923057] whitespace-nowrap transition-[border-color,background] hover:!border-[#dcbdca] hover:!bg-[#fff8fb] hover:!text-[#a5245b] hover:![filter:none] focus-visible:!outline-[#c52f70] focus-visible:!outline-offset-[3px] max-[600px]:!gap-1.5 max-[600px]:!px-[9px] max-[600px]:!py-2 max-[600px]:!text-[10px]" onClick={onOpenMenu}>
            Menú público <ExternalLink size={15} aria-hidden="true" />
          </Button>
        </div>
      </header>

      <Card className="!m-auto !block !w-[min(calc(100%-36px),460px)] !rounded-[20px] !border !border-[#eadfe2] !bg-white !p-[38px] !text-[#292327] !shadow-[0_28px_85px_#56324512,0_3px_15px_#56324508] max-[600px]:!rounded-[17px] max-[600px]:!px-[23px] max-[600px]:!py-7" role="region" aria-labelledby="login-title">
        <span className="text-[10px] font-bold tracking-[.16em] text-[#b02d65]">ESPACIO DE TRABAJO</span>
        <h1 id="login-title" className="!mt-[13px] !mb-1.5 !text-[32px] !leading-[1.15] !font-[750] !tracking-[-.055em] max-[600px]:!text-[29px]">Iniciá sesión</h1>
        <p className="!text-[13px] !leading-normal !text-[#777076]">Gestioná tu café desde un solo lugar.</p>
        <LoginForm onLogin={onLogin} />
      </Card>

      <footer className="!m-0 !block !w-full !border-0 !border-t !border-solid !border-[#e9e0e4] !bg-[#ffffffa8] !p-0">
        <div className="mx-auto flex min-h-16 w-[min(calc(100%-48px),1120px)] items-center justify-between gap-4 text-[10px] text-[#887e84] max-[600px]:min-h-[76px] max-[600px]:w-[calc(100%-36px)] max-[600px]:flex-col max-[600px]:justify-center max-[600px]:gap-1.5 max-[600px]:text-center">
          <span className="font-medium">© 2026 Carmela <span className="mx-[5px] text-[#bdafb6]" aria-hidden="true">·</span> Villa Madero, Buenos Aires</span>
          <span className="inline-flex items-center gap-[3px] text-[#8c8087]"><i className="mr-[5px] size-1.5 rounded-full bg-[#c52f70]" aria-hidden="true" /> Versión de prueba <span className="mx-[5px] text-[#bdafb6]" aria-hidden="true">·</span> Datos guardados en este navegador</span>
        </div>
      </footer>
    </motion.main>
  );
}
