import type { Dispatch, SetStateAction } from "react";
import { motion } from "motion/react";
import { Boxes, ChartNoAxesCombined, ChevronDown, Clock3, LayoutDashboard, LifeBuoy, LogOut, MessageSquareText, Moon, Package, QrCode, Settings, ShoppingBag, Sun, UsersRound } from "lucide-react";
import type { TeamMember } from "../../stores/team";
import { press } from "../../motion";

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
  sessionMember: TeamMember;
  page: string;
  go: (page: string) => void;
  logout: () => void;
  darkMode: boolean;
  setDarkMode: Dispatch<SetStateAction<boolean>>;
  toast: (message: string) => void;
};

export function WorkspaceSidebar({ side, profileOpen, setProfileOpen, sessionMember, page, go, logout, darkMode, setDarkMode, toast }: Props) {
  return (
    <motion.aside className={side ? "sidebar visible" : "sidebar"}>
      <button
        className="workspace profile-workspace"
        aria-expanded={profileOpen}
        aria-controls="profile-menu"
        onClick={() => setProfileOpen((open) => !open)}
      >
        <div className="avatar">{sessionMember.name.split(" ").map((part) => part[0]).slice(0, 2).join("")}</div>
        <span>
          <strong>{sessionMember.name}</strong>
          <small>{sessionMember.role}</small>
        </span>
        <ChevronDown size={15} />
      </button>
      {profileOpen && (
        <div id="profile-menu" className="mx-1 -mt-5 mb-5 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-1.5 shadow-lg">
          <button className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-xs hover:bg-[var(--brand-soft)]" onClick={() => go("Configuración")}><Settings size={15} /> Configuración</button>
          <button className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-xs text-[var(--brand)] hover:bg-[var(--brand-soft)]" onClick={logout}><LogOut size={15} /> Cerrar sesión</button>
        </div>
      )}
      <span className="nav-label">TU ESPACIO DE TRABAJO</span>
      <nav>
        {nav.map(([label, Icon], i) => (
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
          <button
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
          </button>
          <button
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
          </button>
        </div>
      </div>
    </motion.aside>
  );
}
