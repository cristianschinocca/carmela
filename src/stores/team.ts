export const TEAM_ROLES = [
  "Cajero",
  "Mozo",
  "Barista",
  "Encargado",
  "Propietario",
] as const;

export type TeamRole = (typeof TEAM_ROLES)[number];

export type TeamMember = {
  id: number;
  name: string;
  role: TeamRole;
  pin: string;
  active: boolean;
  clockedIn: boolean;
  lastClock?: string;
};

export type ClockEntry = {
  id: number;
  memberId: number;
  name: string;
  type: "Entrada" | "Salida";
  at: string;
};

export const TEAM_STORAGE = "carmela.team.v1";
export const CLOCK_STORAGE = "carmela.clock.v1";

export const defaultTeam: TeamMember[] = [
  { id: 1, name: "Camila López", role: "Propietario", pin: "4829", active: true, clockedIn: true, lastClock: "08:02" },
  { id: 2, name: "Tomás Vega", role: "Barista", pin: "2468", active: true, clockedIn: true, lastClock: "08:07" },
  { id: 3, name: "Micaela Ruiz", role: "Mozo", pin: "1357", active: true, clockedIn: true, lastClock: "09:01" },
  { id: 4, name: "Julián Paz", role: "Cajero", pin: "2580", active: true, clockedIn: false, lastClock: "Ayer · 16:04" },
  { id: 5, name: "Sofía Castro", role: "Encargado", pin: "8642", active: true, clockedIn: false, lastClock: "Ayer · 17:12" },
];

const load = <T,>(key: string, fallback: T): T => {
  try {
    const saved = localStorage.getItem(key);
    return saved ? (JSON.parse(saved) as T) : fallback;
  } catch {
    return fallback;
  }
};

export const loadTeamMembers = () => load(TEAM_STORAGE, defaultTeam);
export const loadClockEntries = () => load<ClockEntry[]>(CLOCK_STORAGE, []);

export const timeNow = () =>
  new Intl.DateTimeFormat("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date());
