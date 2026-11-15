export const TEAM_ROLES = [
  "Cajero",
  "Mozo",
  "Barista",
  "Encargado",
  "Propietario",
] as const;

export type TeamRole = (typeof TEAM_ROLES)[number];

export type TeamPay = {
  basis: "hour" | "day";
  rate: number;
  schedule: TeamWorkday[];
};

export type TeamWorkday = {
  day: number;
  start: string;
  end: string;
};

type LegacyTeamPay = Omit<TeamPay, "schedule"> & { days: number[]; start: string; end: string };
type StoredTeamMember = Omit<TeamMember, "pay"> & { pay?: TeamPay | LegacyTeamPay };

export type TeamMember = {
  id: number;
  name: string;
  role: TeamRole;
  pin: string;
  active: boolean;
  clockedIn: boolean;
  lastClock?: string;
  pay?: TeamPay;
};

export const workHoursPerDay = ({ start, end }: TeamWorkday) => {
  const [startHour, startMinute] = start.split(":").map(Number);
  const [endHour, endMinute] = end.split(":").map(Number);
  return ((endHour * 60 + endMinute) - (startHour * 60 + startMinute)) / 60;
};

export const monthlyPayEstimate = (pay: TeamPay | undefined, month = new Date()) => {
  if (!pay || pay.rate <= 0 || !pay.schedule.length) return 0;
  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const dayCount = new Date(year, monthIndex + 1, 0).getDate();
  let total = 0;
  for (let day = 1; day <= dayCount; day++) {
    const workday = pay.schedule.find((item) => item.day === new Date(year, monthIndex, day).getDay());
    if (!workday) continue;
    const hours = workHoursPerDay(workday);
    if (!Number.isFinite(hours) || hours <= 0) return 0;
    total += pay.rate * (pay.basis === "hour" ? hours : 1);
  }
  return Math.round(total);
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

const normalizePay = (pay: TeamPay | LegacyTeamPay | undefined): TeamPay | undefined => {
  if (!pay || "schedule" in pay) return pay;
  return {
    basis: pay.basis,
    rate: pay.rate,
    schedule: pay.days.map((day) => ({ day, start: pay.start, end: pay.end })),
  };
};

export const loadTeamMembers = (): TeamMember[] =>
  load<StoredTeamMember[]>(TEAM_STORAGE, defaultTeam).map((member) => ({ ...member, pay: normalizePay(member.pay) }));
export const loadClockEntries = () => load<ClockEntry[]>(CLOCK_STORAGE, []);

export const timeNow = () =>
  new Intl.DateTimeFormat("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date());
