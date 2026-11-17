import type { Dispatch, SetStateAction } from "react";
import { motion } from "motion/react";
import { Boxes, ChartNoAxesCombined, ChevronDown, Clock3, LayoutDashboard, LifeBuoy, LogOut, MessageSquareText, Moon, Package, QrCode, Settings, ShieldCheck, ShoppingBag, Sun, UsersRound } from "lucide-react";
import { isSuperadmin, type SessionUser } from "../auth/authClient";
import { press } from "../../motion";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../../components/ui/dropdown-menu";

const nav = [
  ["Resumen", LayoutDashboard],
  ["Punto de venta", ShoppingBag],
  ["Productos", Package],
  ["Stock", Boxes],
  ["Fichaje", Clock3],
  ["Menú digital", QrCode],
  ["Reportes", ChartNoAxesCombined],
  ["Equipo", UsersRound],
  ["Configuración", Settings],
] as const;

type Props = {
  side: boolean;
  profileOpen: boolean;
  setProfileOpen: Dispatch<SetStateAction<boolean>>;
  sessionMember: SessionUser;
  offlineMode: boolean;
  page: string;
  go: (page: string) => void;
  logout: () => void;
  darkMode: boolean;
  setDarkMode: Dispatch<SetStateAction<boolean>>;
  toast: (message: string) => void;
};

export function WorkspaceSidebar({ side, profileOpen, setProfileOpen, sessionMember, offlineMode, page, go, logout, darkMode, setDarkMode, toast }: Props) {
  return (
    <motion.aside className={side ? "sidebar visible" : "sidebar"}>
      <DropdownMenu modal={false} open={profileOpen} onOpenChange={setProfileOpen}>
        <DropdownMenuTrigger asChild>
          <button type="button" className="workspace profile-workspace">
            <div className="avatar">{sessionMember.name.split(" ").map((part) => part[0]).slice(0, 2).join("")}</div>
            <span><strong>{sessionMember.name}</strong><small>{sessionMember.email}</small></span>
            <ChevronDown size={15} />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" sideOffset={6} className="!z-[100] w-[var(--radix-dropdown-menu-trigger-width)] !rounded-xl !border-[var(--border)] !bg-[var(--surface)] !p-1.5 !text-[var(--text)] shadow-lg">
          {!offlineMode && !isSuperadmin(sessionMember) && <DropdownMenuItem className="!min-h-10 !cursor-pointer !rounded-lg !px-3 !text-xs focus:!bg-[var(--brand-soft)] focus:!text-[var(--text)]" onSelect={() => go("Configuración")}><Settings size={15} />Configuración</DropdownMenuItem>}
          <DropdownMenuItem className={`!min-h-10 !cursor-pointer !rounded-lg !px-3 !text-xs ${isSuperadmin(sessionMember) ? "!text-[var(--text)] focus:!bg-neutral-500/15 focus:!text-[var(--text)]" : "!text-[var(--brand)] focus:!bg-[var(--brand-soft)] focus:!text-[var(--brand)]"}`} onSelect={logout}><LogOut size={15} />Cerrar sesión</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <span className="nav-label">{offlineMode ? "SIN CONEXIÓN" : isSuperadmin(sessionMember) ? "ADMINISTRACIÓN" : "TU ESPACIO DE TRABAJO"}</span>
      <nav>
        {!isSuperadmin(sessionMember) && (offlineMode ? nav.filter(([label]) => label === "Punto de venta") : nav).map(([label, Icon]) => (
          <motion.button
            layout
            whileTap={press}
            key={label}
            onClick={() => go(label)}
            className={page === label ? "active" : ""}
          >
            <Icon size={19} />
            <span>{label}</span>
          </motion.button>
        ))}
        {isSuperadmin(sessionMember) && <motion.button layout whileTap={press} onClick={() => go("Superadmin")} className={page === "Superadmin" ? "active" : ""}><ShieldCheck size={19} /><span>Usuarios</span></motion.button>}
      </nav>
      <div className="sidebar-bottom">
        <div className="sidebar-help">
          <button
            className="theme-toggle"
            aria-pressed={darkMode}
            onClick={() => setDarkMode((value) => !value)}
          >
            {darkMode ? <Sun size={17} /> : <Moon size={17} />}
            <span>
              <strong>{darkMode ? "Modo claro" : "Modo oscuro"}</strong>
              <small>
                {darkMode
                  ? "Cambiar a tema claro"
                  : "Cambiar a tema oscuro"}
              </small>
            </span>
            <i className="theme-switch">
              <b />
            </i>
          </button>
          {!isSuperadmin(sessionMember) && <button
            onClick={() =>
              toast(
                "El centro de ayuda estará disponible próximamente.",
              )
            }
          >
            <LifeBuoy size={17} />
            <span>
              <strong>Ayuda y soporte</strong>
              <small>Centro de ayuda</small>
            </span>
          </button>}
          {!isSuperadmin(sessionMember) && <button
            onClick={() =>
              toast(
                "Gracias. Pronto vas a poder enviarnos tus sugerencias desde acá.",
              )
            }
          >
            <MessageSquareText size={17} />
            <span>
              <strong>Enviar sugerencia</strong>
              <small>Ayudanos a mejorar</small>
            </span>
          </button>}
        </div>
      </div>
    </motion.aside>
  );
}
