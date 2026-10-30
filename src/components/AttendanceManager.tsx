import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  Check,
  Clock3,
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
      <section className="panel attendance-action">
        <span className="attendance-action-icon"><Clock3 size={23} /></span>
        <div className="attendance-action-copy">
          <span className="eyebrow">CONTROL DE TURNO</span>
          <h2>Marcá tu entrada o salida</h2>
          <p>Usá tu PIN personal de cuatro números. El fichador registra el movimiento según tu turno.</p>
        </div>
        <motion.button whileTap={press} className="button primary attendance-open" onClick={() => setShowClock(true)}>
          <Clock3 size={17} /> Abrir fichador
        </motion.button>
      </section>

      <section className="panel attendance-team">
        <div className="attendance-team-head">
          <div>
            <h2>Personal en turno</h2>
            <p>Quiénes están trabajando ahora</p>
          </div>
          <span className="attendance-count"><i /> {onShift.length} de {activeTeam.length}</span>
        </div>
        {onShift.length ? <div className="attendance-roster-list">{onShift.map((member) => (
          <div className="attendance-roster-person" key={member.id}>
            <span className="attendance-avatar">{member.name.split(" ").map((part) => part[0]).slice(0, 2).join("")}</span>
            <strong>{member.name}</strong>
            <small>Desde {member.lastClock}</small>
          </div>
        ))}</div> : <p className="attendance-roster-empty">Todavía no hay personas en turno.</p>}
      </section>

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
  const submitted = useRef(false);
  const modalRef = useRef<HTMLElement>(null);

  useEffect(() => { modalRef.current?.focus(); }, []);

  const submit = () => {
    if (submitted.current) return;
    const member = team.find((item) => item.active && item.pin === pin);
    if (!member) {
      setError("Código incorrecto o usuario inactivo.");
      setPin("");
      return;
    }
    submitted.current = true;
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
      else if (result) return;
      else if (/^\d$/.test(event.key)) digit(event.key);
      else if (event.key === "Backspace") setPin((current) => current.slice(0, -1));
      else if (event.key === "Enter" && pin.length === 4) { event.preventDefault(); submit(); }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  });

  return (
    <motion.div className="modal-backdrop" variants={overlayVariants} initial="hidden" animate="visible" exit="exit" onClick={onClose}>
      <motion.section ref={modalRef} tabIndex={-1} className="product-modal clock-modal" variants={modalVariants} onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="clock-title">
        <button className="icon-btn close-modal" aria-label="Cerrar fichaje" onClick={onClose}><X size={20} /></button>
        {result ? (
          <div className="clock-result">
            <span className="success-ring"><Check size={28} /></span>
            <span className="eyebrow">FICHAJE REGISTRADO</span>
            <h2 id="clock-title">{result.type} · {result.time}</h2>
            <p>{result.name}, tu movimiento quedó guardado en este dispositivo.</p>
            <button className="button primary full" onClick={onClose}>Listo</button>
          </div>
        ) : (
          <>
            <div className="clock-heading">
              <span className="round-icon"><Clock3 size={21} /></span>
              <span className="eyebrow">FICHAJE</span>
              <h2 id="clock-title">Ingresá tu PIN</h2>
              <p>Cuatro números para registrar tu turno.</p>
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
          </>
        )}
      </motion.section>
    </motion.div>
  );
}
