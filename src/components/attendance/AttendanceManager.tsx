import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  Check,
  Clock3,
  X,
} from "lucide-react";
import { modalVariants, overlayVariants, press } from "../../motion";
import {
  CLOCK_STORAGE,
  TEAM_STORAGE,
  loadClockEntries,
  loadTeamMembers,
  timeNow,
  type ClockEntry,
  type TeamMember,
} from "../../stores/team";

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
    <div className="attendance-page grid grid-cols-[minmax(290px,.86fr)_minmax(0,1.4fr)] items-stretch gap-4 max-[900px]:grid-cols-1">
      <section className="panel !flex min-h-[315px] !flex-col items-start !rounded-[18px] !p-[30px] ![background:linear-gradient(145deg,var(--brand-soft),var(--surface)_60%)] max-[900px]:min-h-0 max-[900px]:gap-[18px] max-[900px]:!p-6">
        <span className="grid size-12 place-items-center rounded-[13px] bg-[var(--brand-soft)] text-[var(--brand)]"><Clock3 size={23} /></span>
        <div className="mt-[22px] max-[900px]:mt-0">
          <span className="eyebrow">CONTROL DE TURNO</span>
          <h2 className="!my-2 !text-[23px] !leading-[1.2] max-[760px]:!text-xl">Marcá tu entrada o salida</h2>
          <p className="max-w-[340px] !text-[11px] !text-[var(--muted)]">Usá tu PIN personal de cuatro números. El fichador registra el movimiento según tu turno.</p>
        </div>
        <motion.button whileTap={press} className="button primary !mt-auto min-w-[180px] !px-4 !py-3 max-[900px]:!mt-0 max-[760px]:w-full max-[760px]:justify-center" onClick={() => setShowClock(true)}>
          <Clock3 size={17} /> Abrir fichador
        </motion.button>
      </section>

      <section className="panel min-h-[315px] !rounded-[18px] !px-[30px] !py-[26px] max-[900px]:min-h-0 max-[900px]:!px-6 max-[900px]:!py-[22px]">
        <div className="flex items-center justify-between gap-4 border-b border-[var(--border)] pb-[18px] max-[760px]:items-start">
          <div>
            <h2 className="!text-[17px]">Personal en turno</h2>
            <p className="!mt-1 !text-[10px] !text-[var(--muted)]">Quiénes están trabajando ahora</p>
          </div>
          <span className="flex shrink-0 items-center gap-[7px] rounded-full bg-[var(--brand-soft)] px-2.5 py-[7px] text-[10px] font-semibold text-[var(--brand-deep)]"><i className="size-1.5 rounded-full bg-current" /> {onShift.length} de {activeTeam.length}</span>
        </div>
        {onShift.length ? <div className="grid">{onShift.map((member) => (
          <div className="flex min-w-0 items-center gap-3 border-b border-[var(--border)] py-[13px] last:border-b-0" key={member.id}>
            <span className="grid size-[34px] shrink-0 place-items-center rounded-[10px] bg-[var(--brand-soft)] text-[10px] font-bold text-[var(--brand-deep)]">{member.name.split(" ").map((part) => part[0]).slice(0, 2).join("")}</span>
            <strong className="min-w-0 truncate text-[11px]">{member.name}</strong>
            <small className="ml-auto text-[10px] whitespace-nowrap text-[var(--muted)] max-[760px]:text-[9px]">Desde {member.lastClock}</small>
          </div>
        ))}</div> : <p className="!mt-[18px] !text-[11px] !text-[var(--muted)]">Todavía no hay personas en turno.</p>}
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
      <motion.section ref={modalRef} tabIndex={-1} className="product-modal !max-w-[350px] !bg-[rgba(255,255,255,.97)] !px-6 !py-[22px] in-data-[theme=dark]:!bg-[rgba(27,25,26,.96)] max-[760px]:!max-h-[calc(100dvh-32px)] max-[760px]:!w-[calc(100vw-32px)] max-[760px]:!overflow-y-auto max-[760px]:!px-5" variants={modalVariants} onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="clock-title">
        <button className="icon-btn close-modal" aria-label="Cerrar fichaje" onClick={onClose}><X size={20} /></button>
        {result ? (
          <div className="!px-0 !pt-3.5 !pb-0.5 text-center">
            <span className="mx-auto mb-[17px] grid size-[60px] place-items-center rounded-full bg-[#edf4e8] text-[#668459]"><Check size={28} /></span>
            <span className="eyebrow">FICHAJE REGISTRADO</span>
            <h2 id="clock-title" className="!my-2 !text-[23px]">{result.type} · {result.time}</h2>
            <p className="!mb-[23px]">{result.name}, tu movimiento quedó guardado en este dispositivo.</p>
            <button className="button primary full" onClick={onClose}>Listo</button>
          </div>
        ) : (
          <>
            <div className="!p-0 text-center">
              <span className="round-icon !mx-auto !mb-[9px] !size-[38px]"><Clock3 size={21} /></span>
              <span className="eyebrow">FICHAJE</span>
              <h2 id="clock-title" className="!mt-[5px] !mb-[3px] !text-xl">Ingresá tu PIN</h2>
              <p className="!text-[10px]">Cuatro números para registrar tu turno.</p>
            </div>
            <div className="!mt-5 !mb-4 flex justify-center gap-2.5 !p-0" aria-label={`${pin.length} números ingresados`}>
              {[0, 1, 2, 3].map((index) => <i className={`size-2.5 rounded-full border transition-[background,transform] motion-reduce:transition-none ${pin.length > index ? "scale-[1.08] border-[var(--brand)] bg-[var(--brand)]" : "border-[#ddd5d3] bg-[#ece7e5]"}`} key={index} />)}
            </div>
            {error && <motion.p className="!-mt-[5px] !mb-3 !text-center !text-[10px] !text-[#a54452]" initial={{ opacity: 0, y: 3 }} animate={{ opacity: 1, y: 0 }}>{error}</motion.p>}
            <div className="grid grid-cols-3 gap-1.5 !p-0">
              {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((value) => (
                <motion.button className="!grid h-[43px] place-items-center rounded-[11px] !border !border-[#e9e2df] !bg-white !text-center !text-base !font-semibold hover:!bg-[#fff8fa] in-data-[theme=dark]:!border-[#3b3638] in-data-[theme=dark]:!bg-[#242123] in-data-[theme=dark]:!text-[var(--text)] in-data-[theme=dark]:hover:!bg-[#2d282a]" whileTap={press} key={value} onClick={() => digit(value)}>{value}</motion.button>
              ))}
              <button className="!grid h-[43px] place-items-center rounded-[11px] !border !border-[#e9e2df] !bg-white !text-center !text-[9px] !font-semibold !text-[#8d7b80] hover:!bg-[#fff8fa] in-data-[theme=dark]:!border-[#3b3638] in-data-[theme=dark]:!bg-[#242123] in-data-[theme=dark]:!text-[var(--text)] in-data-[theme=dark]:hover:!bg-[#2d282a]" onClick={() => setPin("")}>Borrar</button>
              <motion.button className="!grid h-[43px] place-items-center rounded-[11px] !border !border-[#e9e2df] !bg-white !text-center !text-base !font-semibold hover:!bg-[#fff8fa] in-data-[theme=dark]:!border-[#3b3638] in-data-[theme=dark]:!bg-[#242123] in-data-[theme=dark]:!text-[var(--text)] in-data-[theme=dark]:hover:!bg-[#2d282a]" whileTap={press} onClick={() => digit("0")}>0</motion.button>
              <button aria-label="Confirmar fichaje" className="!grid h-[43px] place-items-center rounded-[11px] !border !border-[var(--brand)] !bg-[var(--brand)] !text-center !text-white in-data-[theme=dark]:!border-[#3b3638] in-data-[theme=dark]:!bg-[#242123] in-data-[theme=dark]:!text-[var(--text)]" disabled={pin.length !== 4} onClick={submit}><Check size={19} /></button>
            </div>
          </>
        )}
      </motion.section>
    </motion.div>
  );
}
