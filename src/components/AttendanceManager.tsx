import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  Check,
  Clock3,
  LogIn,
  LogOut,
  ShieldCheck,
  UserCheck,
  Users,
  X,
} from "lucide-react";
import { modalVariants, overlayVariants, press } from "../motion";
import {
  CLOCK_STORAGE,
  TEAM_STORAGE,
  loadClockEntries,
  loadTeamMembers,
  timeNow,
  type ClockEntry,
  type TeamMember,
} from "../stores/team";

export function AttendanceManager() {
  const [team, setTeam] = useState<TeamMember[]>(loadTeamMembers);
  const [entries, setEntries] = useState<ClockEntry[]>(loadClockEntries);
  const [showClock, setShowClock] = useState(false);

  useEffect(() => localStorage.setItem(TEAM_STORAGE, JSON.stringify(team)), [team]);
  useEffect(
    () => localStorage.setItem(CLOCK_STORAGE, JSON.stringify(entries)),
    [entries],
  );

  const activeTeam = team.filter((member) => member.active);
  const onShift = activeTeam.filter((member) => member.clockedIn);
  const offShift = activeTeam.filter((member) => !member.clockedIn);

  const clock = (member: TeamMember) => {
    const now = timeNow();
    const type: ClockEntry["type"] = member.clockedIn ? "Salida" : "Entrada";
    setTeam((current) =>
      current.map((item) =>
        item.id === member.id
          ? { ...item, clockedIn: !item.clockedIn, lastClock: now }
          : item,
      ),
    );
    setEntries((current) =>
      [
        {
          id: Date.now(),
          memberId: member.id,
          name: member.name,
          type,
          at: `Hoy · ${now}`,
        },
        ...current,
      ].slice(0, 30),
    );
    return type;
  };

  return (
    <div className="attendance-page">
      <div className="team-metrics attendance-metrics">
        <section>
          <span className="round-icon"><UserCheck size={19} /></span>
          <div><small>Trabajando ahora</small><strong>{onShift.length}</strong></div>
        </section>
        <section>
          <span className="round-icon"><Users size={19} /></span>
          <div><small>Fuera de turno</small><strong>{offShift.length}</strong></div>
        </section>
        <section>
          <span className="round-icon"><ShieldCheck size={19} /></span>
          <div><small>Personal habilitado</small><strong>{activeTeam.length}</strong></div>
        </section>
      </div>

      <div className="attendance-layout">
        <section className="panel attendance-kiosk">
          <div className="attendance-kiosk-copy">
            <span className="attendance-kiosk-icon"><Clock3 size={28} /></span>
            <span className="eyebrow">CONTROL DE TURNO</span>
            <h2>Registrá tu entrada o salida</h2>
            <p>Ingresá con tu código personal. El sistema detecta automáticamente el movimiento correspondiente.</p>
            <motion.button
              whileTap={press}
              className="button primary attendance-open"
              onClick={() => setShowClock(true)}
            >
              <Clock3 size={18} /> Abrir fichaje
            </motion.button>
          </div>
          <div className="on-shift-list">
            <div className="panel-heading">
              <div><h2>En turno</h2><p>Personal trabajando en este momento.</p></div>
              <span className="live"><i /> {onShift.length} activos</span>
            </div>
            {onShift.length ? onShift.map((member) => (
              <div className="on-shift-person" key={member.id}>
                <span>{member.name.split(" ").map((part) => part[0]).slice(0, 2).join("")}</span>
                <div><strong>{member.name}</strong><small>{member.role} · Desde {member.lastClock}</small></div>
              </div>
            )) : (
              <div className="empty compact"><Clock3 size={25} /><h3>No hay personas en turno</h3></div>
            )}
          </div>
        </section>

        <aside className="panel attendance-panel attendance-history-panel">
          <div className="panel-heading">
            <div><h2>Actividad reciente</h2><p>Entradas y salidas registradas.</p></div>
          </div>
          {entries.length ? (
            <div className="clock-history">
              {entries.slice(0, 10).map((entry) => (
                <motion.div layout key={entry.id}>
                  <span className={`clock-kind ${entry.type === "Entrada" ? "in" : "out"}`}>
                    {entry.type === "Entrada" ? <LogIn size={15} /> : <LogOut size={15} />}
                  </span>
                  <div><strong>{entry.name}</strong><small>{entry.type} · {entry.at}</small></div>
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="empty compact">
              <Clock3 size={26} />
              <h3>Todavía no hay movimientos</h3>
              <p>Los próximos fichajes aparecerán acá.</p>
            </div>
          )}
        </aside>
      </div>

      <AnimatePresence>
        {showClock && (
          <ClockModal team={team} onClose={() => setShowClock(false)} onClock={clock} />
        )}
      </AnimatePresence>
    </div>
  );
}

function ClockModal({
  team,
  onClose,
  onClock,
}: {
  team: TeamMember[];
  onClose: () => void;
  onClock: (member: TeamMember) => "Entrada" | "Salida";
}) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ name: string; type: "Entrada" | "Salida"; time: string } | null>(null);

  const submit = () => {
    const member = team.find((item) => item.active && item.pin === pin);
    if (!member) {
      setError("Código incorrecto o usuario inactivo.");
      setPin("");
      return;
    }
    const type = onClock(member);
    setResult({ name: member.name, type, time: timeNow() });
  };
  const digit = (value: string) => {
    if (result) return;
    setError("");
    setPin((current) => (current + value).slice(0, 4));
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      else if (/^\d$/.test(event.key)) digit(event.key);
      else if (event.key === "Backspace") setPin((current) => current.slice(0, -1));
      else if (event.key === "Enter" && pin.length === 4) submit();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  });

  return (
    <motion.div className="modal-backdrop" variants={overlayVariants} initial="hidden" animate="visible" exit="exit" onClick={onClose}>
      <motion.section className="product-modal clock-modal" variants={modalVariants} onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="clock-title">
        <button className="icon-btn close-modal" aria-label="Cerrar fichaje" onClick={onClose}><X size={20} /></button>
        {result ? (
          <div className="clock-result">
            <span className="success-ring"><Check size={28} /></span>
            <span className="eyebrow">FICHAJE REGISTRADO</span>
            <h2>{result.type} · {result.time}</h2>
            <p>{result.name}, tu movimiento quedó guardado en este dispositivo.</p>
            <button className="button primary full" onClick={onClose}>Listo</button>
          </div>
        ) : (
          <>
            <div className="clock-heading">
              <span className="round-icon"><Clock3 size={21} /></span>
              <span className="eyebrow">FICHAJE</span>
              <h2 id="clock-title">Ingresá tu código</h2>
              <p>Usá tu PIN personal de cuatro números.</p>
            </div>
            <div className="pin-dots" aria-label={`${pin.length} números ingresados`}>
              {[0, 1, 2, 3].map((index) => <i className={pin.length > index ? "filled" : ""} key={index} />)}
            </div>
            {error && <motion.p className="pin-error" initial={{ opacity: 0, y: 3 }} animate={{ opacity: 1, y: 0 }}>{error}</motion.p>}
            <div className="pin-pad">
              {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((value) => (
                <motion.button whileTap={press} key={value} onClick={() => digit(value)}>{value}</motion.button>
              ))}
              <button className="pin-clear" onClick={() => setPin("")}>Borrar</button>
              <motion.button whileTap={press} onClick={() => digit("0")}>0</motion.button>
              <button aria-label="Confirmar fichaje" className="pin-submit" disabled={pin.length !== 4} onClick={submit}><Check size={19} /></button>
            </div>
            <p className="clock-demo">Demo: Camila 4829 · Tomás 2468</p>
          </>
        )}
      </motion.section>
    </motion.div>
  );
}
