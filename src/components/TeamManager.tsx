import { useEffect, useMemo, useState, type FormEvent } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  Clock3,
  CalendarDays,
  ChevronRight,
  Pencil,
  Plus,
  Search,
  Trash2,
  Users,
  Wallet,
  X,
} from "lucide-react";
import {
  fadeUp,
  modalVariants,
  overlayVariants,
  press,
  staggerContainer,
} from "../motion";
import {
  TEAM_ROLES,
  TEAM_STORAGE,
  loadTeamMembers,
  monthlyPayEstimate,
  workHoursPerDay,
  type TeamMember,
  type TeamPay,
  type TeamRole,
  type TeamWorkday,
} from "../stores/team";

export { loadTeamMembers, type TeamMember } from "../stores/team";
const initials = (name: string) =>
  name
    .split(" ")
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
const money = (value: number) => `$ ${new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 }).format(value)}`;
const weekdays = [
  { day: 1, label: "Lun" }, { day: 2, label: "Mar" }, { day: 3, label: "Mié" },
  { day: 4, label: "Jue" }, { day: 5, label: "Vie" }, { day: 6, label: "Sáb" }, { day: 0, label: "Dom" },
];
const scheduleLabel = (pay: TeamPay) =>
  pay.schedule.length === 5 && [1, 2, 3, 4, 5].every((day) => pay.schedule.some((item) => item.day === day))
    ? "Lun a Vie"
    : weekdays.filter(({ day }) => pay.schedule.some((item) => item.day === day)).map(({ label }) => label).join(" · ");
const scheduleTimesLabel = (pay: TeamPay) => {
  const [first] = pay.schedule;
  return first && pay.schedule.every(({ start, end }) => start === first.start && end === first.end)
    ? `${first.start}–${first.end}`
    : "Horarios por día";
};
const defaultPay: TeamPay = {
  basis: "hour", rate: 0,
  schedule: [],
};
const teamColumns = "grid grid-cols-[44px_minmax(135px,1.5fr)_minmax(130px,1.15fr)_minmax(105px,.9fr)_minmax(130px,1fr)_minmax(95px,.85fr)_76px] items-center gap-3";
const metricClass = "flex min-h-[106px] items-center gap-[15px] rounded-2xl border border-[var(--border)] bg-white px-[23px] py-5 max-[760px]:min-h-[86px] max-[760px]:p-[15px]";
const modalClass = "product-modal member-modal !flex !max-h-[calc(100dvh-32px)] !max-w-[570px] !flex-col !overflow-hidden !bg-[rgba(255,255,255,.97)] in-data-[theme=dark]:!bg-[rgba(27,25,26,.96)]";
const modalFormClass = "product-form !flex min-h-0 flex-1 flex-col !p-0";
const modalBodyClass = "member-form-body min-h-0 flex-1 overflow-y-auto px-[30px] py-[23px] [scrollbar-color:var(--border)_transparent] [scrollbar-width:thin] max-[760px]:p-5";
const modalActionsClass = "form-actions !min-h-[68px] shrink-0 !border-t !border-[var(--border)] !bg-[var(--surface)] !px-[30px] !pt-[13px] !pb-[18px] max-[760px]:!px-5 max-[760px]:!pt-3 max-[760px]:!pb-4 max-[420px]:!gap-1.5 max-[420px]:[&_.button]:!p-[9px] max-[420px]:[&_.button]:!text-[10px] max-[420px]:[&_.danger-text]:!mr-auto max-[420px]:[&_.danger-text]:!gap-[3px] max-[420px]:[&_.danger-text]:!px-0 max-[420px]:[&_.danger-text]:!py-[5px] max-[420px]:[&_.danger-text]:!text-[9px]";
const scheduleColumns = "grid grid-cols-[minmax(72px,1fr)_minmax(0,1.3fr)_minmax(0,1.3fr)] items-center gap-[9px]";
export function TeamManager() {
  const [team, setTeam] = useState<TeamMember[]>(() =>
    loadTeamMembers(),
  );
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<TeamMember | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  useEffect(
    () => localStorage.setItem(TEAM_STORAGE, JSON.stringify(team)),
    [team],
  );
  const visible = useMemo(
    () =>
      team.filter(
        (member) =>
          member.name.toLowerCase().includes(query.toLowerCase()) ||
          member.role.toLowerCase().includes(query.toLowerCase()),
      ),
    [team, query],
  );
  const onShift = team.filter(
    (member) => member.clockedIn && member.active,
  ).length;
  const configured = team.filter((member) => member.active && member.pay?.rate);
  const monthlyTotal = configured.reduce((total, member) => total + monthlyPayEstimate(member.pay), 0);
  const save = (member: TeamMember) => {
    setTeam((current) =>
      current.some((item) => item.id === member.id)
        ? current.map((item) => (item.id === member.id ? member : item))
        : [...current, member],
    );
    setEditing(null);
  };
  const remove = (id: number) => {
    setTeam((current) => current.filter((member) => member.id !== id));
    setConfirmDelete(false);
    setEditing(null);
  };
  return (
    <div className="team-page grid gap-4">
      <div className="team-metrics grid grid-cols-3 gap-3.5 max-[760px]:grid-cols-2">
        <section className={metricClass}>
          <span className="round-icon !size-[38px]">
            <Users size={19} />
          </span>
          <div>
            <small className="mb-1 block text-[10px] text-[var(--muted)]">Personas activas</small>
            <strong className="block text-[24px] font-[650] tracking-[-.6px] max-[760px]:text-xl">{team.filter((item) => item.active).length}</strong>
          </div>
        </section>
        <section className={metricClass}>
          <span className="round-icon !size-[38px]">
            <Clock3 size={19} />
          </span>
          <div>
            <small className="mb-1 block text-[10px] text-[var(--muted)]">Trabajando ahora</small>
            <strong className="block text-[24px] font-[650] tracking-[-.6px] max-[760px]:text-xl">{onShift}</strong>
          </div>
        </section>
        <section className={`${metricClass} max-[760px]:col-span-full`}>
          <span className="round-icon !size-[38px]">
            <Wallet size={19} />
          </span>
          <div>
            <small className="mb-1 block text-[10px] text-[var(--muted)]">Sueldos estimados este mes</small>
            <strong className="block text-[21px] font-[650] tracking-[-.6px] max-[760px]:text-[19px]">{configured.length ? money(monthlyTotal) : "Sin configurar"}</strong>
          </div>
        </section>
      </div>
      <div>
        <section className="panel team-manager !overflow-hidden !rounded-[18px] !p-0">
          <div className="manager-toolbar !px-6 !py-[21px] max-[760px]:!flex-wrap max-[760px]:!p-4">
            <label className="search max-[760px]:!w-full">
              <Search size={18} />
              <input
                aria-label="Buscar equipo"
                placeholder="Buscar por nombre o rol…"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </label>
            <div className="manager-actions max-[760px]:!w-full max-[760px]:[&_.button]:!w-full">
              <button
                className="button primary"
                onClick={() => {
                  setConfirmDelete(false);
                  setEditing({
                    id: 0,
                    name: "",
                    role: "Mozo",
                    pin: "",
                    active: true,
                    clockedIn: false,
                  });
                }}
              >
                <Plus size={17} /> Nuevo empleado
              </button>
            </div>
          </div>
          <div className="manager-summary !bg-[var(--surface)] !px-6 !py-[11px] !text-[var(--muted)] max-[760px]:!px-4 max-[760px]:!py-2.5 max-[760px]:[&>span:last-child]:hidden">
            <span>{visible.length} {visible.length === 1 ? "persona" : "personas"}</span>
            <span>Estimación según días y horario configurados. No incluye ausencias ni feriados.</span>
          </div>
          <div className={`team-list-head ${teamColumns} border-b border-[var(--border)] px-6 pt-[13px] pb-[9px] text-[9px] text-[var(--muted)] max-[1150px]:hidden`} aria-hidden="true">
            <span className="col-span-2">Persona</span><span>Jornada</span><span>Tarifa</span><span>Estimado del mes</span><span>Estado</span><span />
          </div>
          <motion.div
            className="team-list px-6 max-[760px]:px-4"
            variants={staggerContainer}
            initial="hidden"
            animate="visible"
          >
            {visible.map((member) => (
              <motion.article
                layout
                variants={fadeUp}
                className={`team-row ${teamColumns} border-b border-[var(--border)] py-3.5 last:border-b-0 max-[1150px]:grid-cols-[42px_minmax(0,1fr)_auto] max-[1150px]:gap-x-3 max-[1150px]:gap-y-1.5`}
                key={member.id}
              >
                <span className="team-avatar grid size-[42px] place-items-center rounded-[13px] bg-[var(--brand-soft)] text-[11px] font-bold text-[var(--brand-deep)] max-[1150px]:col-start-1 max-[1150px]:row-span-2 max-[1150px]:row-start-1">{initials(member.name)}</span>
                <div className="team-copy min-w-0 max-[1150px]:col-start-2 max-[1150px]:row-start-1">
                  <strong className="mb-1 block text-[11px] font-[650]">{member.name}</strong>
                  <span className="text-[10px] text-[var(--muted)]">{member.role}</span>
                </div>
                <div className="team-schedule max-[1150px]:col-start-2 max-[1150px]:row-start-2">
                  {member.pay?.schedule.length ? <><strong className="block text-[11px] font-semibold">{scheduleLabel(member.pay)}</strong><small className="mt-1 block text-[9px] text-[var(--muted)]">{scheduleTimesLabel(member.pay)}</small></> : <span className="text-[10px] text-[var(--muted)]">Sin horario</span>}
                </div>
                <div className="team-rate max-[1150px]:col-start-2 max-[1150px]:row-start-3">{member.pay?.rate ? <><strong className="block text-[11px] font-semibold">{money(member.pay.rate)}</strong><small className="mt-1 block text-[9px] text-[var(--muted)]">por {member.pay.basis === "hour" ? "hora" : "día"}</small></> : <span className="text-[10px] text-[var(--muted)]">Sin configurar</span>}</div>
                <div className="team-estimate max-[1150px]:col-start-3 max-[1150px]:row-start-2 max-[1150px]:text-right">{member.pay?.rate ? <strong className="text-[11px] font-semibold">{money(monthlyPayEstimate(member.pay))}</strong> : <span className="text-[10px] text-[var(--muted)]">—</span>}</div>
                <div className="team-status flex items-center gap-[7px] text-[9px] whitespace-nowrap text-[var(--muted)] max-[1150px]:col-start-3 max-[1150px]:row-start-3 max-[1150px]:justify-end"><i className={`size-1.5 shrink-0 rounded-full ${member.clockedIn && member.active ? "bg-[#5caa72]" : "bg-[var(--muted)]"}`} /><span>{!member.active ? "Inactivo" : member.clockedIn ? "En turno" : "Fuera de turno"}</span></div>
                <motion.button
                  whileTap={press}
                  className="edit-product !flex !items-center !gap-1.5 !text-[10px] !text-[var(--brand)] max-[1150px]:col-start-3 max-[1150px]:row-start-1"
                  aria-label={`Editar ${member.name}`}
                  onClick={() => {
                    setConfirmDelete(false);
                    setEditing({ ...member });
                  }}
                >
                  <Pencil size={16} />
                  <span>Editar</span>
                </motion.button>
              </motion.article>
            ))}
          </motion.div>
          {!visible.length && (
            <div className="empty">
              <Users size={28} />
              <h3>No encontramos personas</h3>
              <p>Probá con otro nombre o rol.</p>
            </div>
          )}
          <p className="help-copy !border-t !border-[var(--border)] !px-6 !pt-3.5 !pb-[19px] !text-[9px] max-[760px]:!px-4 max-[760px]:!py-3">
            Datos de demostración guardados únicamente en este navegador.
          </p>
        </section>
      </div>
      <AnimatePresence>
        {editing && (
          <MemberEditor
            member={editing}
            team={team}
            confirmDelete={confirmDelete}
            setConfirmDelete={setConfirmDelete}
            onClose={() => setEditing(null)}
            onSave={save}
            onDelete={remove}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
function MemberEditor({
  member,
  team,
  confirmDelete,
  setConfirmDelete,
  onClose,
  onSave,
  onDelete,
}: {
  member: TeamMember;
  team: TeamMember[];
  confirmDelete: boolean;
  setConfirmDelete: (value: boolean) => void;
  onClose: () => void;
  onSave: (member: TeamMember) => void;
  onDelete: (id: number) => void;
}) {
  const [draft, setDraft] = useState(member);
  const [error, setError] = useState("");
  const [setup, setSetup] = useState<"schedule" | "rate" | null>(null);
  const updateDraft = (next: TeamMember) => { setError(""); setDraft(next); };
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!draft.name.trim()) {
      setError("Ingresá el nombre de la persona.");
      return;
    }
    if (!/^\d{4}$/.test(draft.pin)) {
      setError("Ingresá un código de exactamente 4 números.");
      return;
    }
    if (team.some((item) => item.id !== draft.id && item.pin === draft.pin)) {
      setError("Ese código ya pertenece a otra persona.");
      return;
    }
    onSave({ ...draft, id: draft.id || Date.now(), name: draft.name.trim() });
  };
  if (setup) {
    return <TeamSetupDialog key={setup} mode={setup} pay={draft.pay} onCancel={() => setSetup(null)} onApply={(pay) => { updateDraft({ ...draft, pay }); setSetup(null); }} />;
  }
  return (
    <motion.div
      className="modal-backdrop"
      variants={overlayVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      onClick={onClose}
    >
      <motion.section
        className={`${modalClass} member-modal-access !h-auto`}
        variants={modalVariants}
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="member-title"
      >
        <button
          className="icon-btn close-modal"
          aria-label="Cerrar integrante"
          onClick={onClose}
        >
          <X size={20} />
        </button>
        <div className="editor-heading !shrink-0 !px-[30px] !pt-7 !pb-1 max-[760px]:!px-5 max-[760px]:!pt-6">
          <span className="eyebrow">EQUIPO</span>
          <h2 id="member-title">
            {draft.id ? "Editar empleado" : "Nuevo empleado"}
          </h2>
          <p>Configurá el acceso, la jornada y el sueldo estimado.</p>
        </div>
        <form className={modalFormClass} onSubmit={submit} noValidate>
          <div className={`${modalBodyClass} !flex-[0_1_auto] !pt-3 !pb-4 [&_.field]:!mb-3 [&_.field_input]:!border-[var(--border)] [&_.field_input]:!bg-[var(--surface)] [&_.field_input]:!text-[var(--text)] [&_.field_select]:!border-[var(--border)] [&_.field_select]:!bg-[var(--surface)] [&_.field_select]:!text-[var(--text)]`}>
          <label className="field">
            Nombre completo
            <input
              autoFocus
              required
              value={draft.name}
              onChange={(event) =>
                updateDraft({ ...draft, name: event.target.value })
              }
            />
          </label>
          <div className="field-row !grid-cols-2 max-[349px]:!grid-cols-1">
            <label className="field">
              Rol
              <select
                value={draft.role}
                onChange={(event) =>
                  updateDraft({ ...draft, role: event.target.value as TeamRole })
                }
              >
                {TEAM_ROLES.map((role) => (
                  <option key={role}>{role}</option>
                ))}
              </select>
            </label>
            <label className="field">
              Código de fichaje
              <input
                aria-describedby="pin-help"
                required
                inputMode="numeric"
                autoComplete="off"
                maxLength={4}
                pattern="[0-9]{4}"
                type="password"
                value={draft.pin}
                onChange={(event) => {
                  updateDraft({
                    ...draft,
                    pin: event.target.value.replace(/\D/g, "").slice(0, 4),
                  });
                }}
              />
              <small id="pin-help">4 números, sin repetir.</small>
            </label>
          </div>
          <label className="availability-control !m-0 !items-center !px-3 !py-2.5">
            <input
              type="checkbox"
              checked={draft.active}
              onChange={(event) => updateDraft({ ...draft, active: event.target.checked })}
            />
            <span><strong>Usuario activo</strong><small>Puede ingresar al sistema y registrar fichajes.</small></span>
          </label>
          <div className="mt-3 grid grid-cols-1 gap-2 min-[521px]:grid-cols-2">
            <button type="button" className="flex w-full min-w-0 items-center gap-[11px] rounded-[10px] !border !border-[var(--border)] !bg-[var(--surface)] p-2.5 text-left transition-colors hover:!border-[var(--brand)] focus-visible:!border-[var(--brand)]" onClick={() => setSetup("schedule")}>
              <span className="round-icon !size-[34px] shrink-0"><CalendarDays size={17} /></span>
              <span className="grid min-w-0 flex-1 gap-1"><strong className="!text-[11px] !text-[var(--text)]">Jornada semanal</strong><small className="text-[9px] text-[var(--muted)]">{draft.pay?.schedule.length ? scheduleLabel(draft.pay) + " · " + scheduleTimesLabel(draft.pay) : "Elegí los días y horarios de trabajo"}</small></span>
              <ChevronRight size={17} className="shrink-0 text-[var(--muted)]" />
            </button>
            <button type="button" className="flex w-full min-w-0 items-center gap-[11px] rounded-[10px] !border !border-[var(--border)] !bg-[var(--surface)] p-2.5 text-left transition-colors hover:!border-[var(--brand)] focus-visible:!border-[var(--brand)]" onClick={() => setSetup("rate")}>
              <span className="round-icon !size-[34px] shrink-0"><Wallet size={17} /></span>
              <span className="grid min-w-0 flex-1 gap-1"><strong className="!text-[11px] !text-[var(--text)]">Tarifa de pago</strong><small className="text-[9px] text-[var(--muted)]">{draft.pay?.rate ? money(draft.pay.rate) + " por " + (draft.pay.basis === "hour" ? "hora" : "día") : "Configurá el importe de pago"}</small></span>
              <ChevronRight size={17} className="shrink-0 text-[var(--muted)]" />
            </button>
            {draft.pay?.rate && !!draft.pay.schedule.length && <p className="col-span-full !m-0 flex items-center justify-between gap-3 rounded-[9px] bg-[var(--brand-soft)] px-3 py-2.5 text-[10px]">Estimado este mes <strong className="!text-[10px] !text-[var(--text)]">{money(monthlyPayEstimate(draft.pay))}</strong></p>}
            <small className="col-span-full mt-0.5 text-[9px] text-[var(--muted)]">La jornada y la tarifa se guardan junto con el empleado.</small>
          </div>
          </div>
          {error && (
            <motion.p
              className="form-error !mx-[30px] !mt-0 !mb-2.5 shrink-0 max-[760px]:!mx-5 max-[760px]:!mb-2"
              initial={{ opacity: 0, y: 3 }}
              animate={{ opacity: 1, y: 0 }}
            >
              {error}
            </motion.p>
          )}
          <div className={modalActionsClass}>
            {draft.id > 0 && !confirmDelete && (
              <button
                type="button"
                className="danger-text"
                onClick={() => setConfirmDelete(true)}
              >
                <Trash2 size={15} /> Eliminar
              </button>
            )}
            {confirmDelete ? (
              <div className="delete-confirm">
                <span>¿Eliminar esta persona?</span>
                <button type="button" onClick={() => setConfirmDelete(false)}>
                  Cancelar
                </button>
                <button type="button" onClick={() => onDelete(draft.id)}>
                  Sí, eliminar
                </button>
              </div>
            ) : (
              <>
                <button type="button" className="button" onClick={onClose}>
                  Cancelar
                </button>
                <button className="button primary">
                  {draft.id ? "Guardar cambios" : "Crear empleado"}
                </button>
              </>
            )}
          </div>
        </form>
      </motion.section>
    </motion.div>
  );
}

function TeamSetupDialog({ mode, pay, onCancel, onApply }: {
  mode: "schedule" | "rate";
  pay?: TeamPay;
  onCancel: () => void;
  onApply: (pay: TeamPay | undefined) => void;
}) {
  const [draft, setDraft] = useState<TeamPay>(() => pay ? { ...pay, schedule: pay.schedule.map((day) => ({ ...day })) } : { ...defaultPay, schedule: [] });
  const [error, setError] = useState("");
  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => { if (event.key === "Escape") { event.stopPropagation(); onCancel(); } };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onCancel]);
  const updateSchedule = (schedule: TeamWorkday[]) => { setError(""); setDraft((current) => ({ ...current, schedule })); };
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (mode === "rate" && (!Number.isFinite(draft.rate) || draft.rate <= 0)) {
      setError("Ingresá un importe mayor a cero.");
      return;
    }
    if (mode === "schedule" && draft.schedule.some((day) => !Number.isFinite(workHoursPerDay(day)) || workHoursPerDay(day) <= 0)) {
      setError("Revisá que cada salida sea posterior a la entrada.");
      return;
    }
    onApply(draft.rate || draft.schedule.length ? draft : undefined);
  };
  return <motion.div className="modal-backdrop" variants={overlayVariants} initial="hidden" animate="visible" exit="exit" onClick={onCancel}>
    <motion.section className={`${modalClass} team-setup-modal ${mode === "schedule" ? "!h-[min(690px,calc(100dvh-32px))]" : "!h-[min(420px,calc(100dvh-32px))]"}`} variants={modalVariants} onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="team-setup-title">
      <button type="button" className="icon-btn close-modal" aria-label="Volver al empleado" onClick={onCancel}><X size={20} /></button>
      <div className="editor-heading !shrink-0 !px-[30px] !pt-7 !pb-[18px] max-[760px]:!px-5 max-[760px]:!pt-6 max-[760px]:!pb-[15px]">
        <span className="eyebrow">EQUIPO</span>
        <h2 id="team-setup-title">{mode === "schedule" ? "Jornada semanal" : "Tarifa de pago"}</h2>
        <p>{mode === "schedule" ? "Elegí los días y definí el horario de cada uno." : "Configurá cuánto cobra el empleado."}</p>
      </div>
      <form className={modalFormClass} onSubmit={submit} noValidate>
        <div className={`${modalBodyClass} [&_.field_input]:!border-[var(--border)] [&_.field_input]:!bg-[var(--surface)] [&_.field_input]:!text-[var(--text)] [&_.field_select]:!border-[var(--border)] [&_.field_select]:!bg-[var(--surface)] [&_.field_select]:!text-[var(--text)]`}>
          {mode === "schedule" ? <>
            <fieldset className="m-0 min-w-0 border-0 p-0">
              <legend className="mb-[9px] text-[10px] text-[var(--muted)]">Días de trabajo</legend>
              <div className="grid grid-cols-7 gap-1.5">{weekdays.map(({ day, label }) => {
                const selected = draft.schedule.some((item) => item.day === day);
                return <button type="button" aria-pressed={selected} className={`min-h-9 rounded-lg !border !text-center !text-[10px] ${selected ? "!border-[var(--brand)] !bg-[var(--brand-soft)] !font-[650] !text-[var(--brand-deep)]" : "!border-[var(--border)] !bg-[var(--surface)] !text-[var(--muted)]"}`} key={day} onClick={() => updateSchedule(selected ? draft.schedule.filter((item) => item.day !== day) : [...draft.schedule, { day, start: "08:00", end: "16:00" }])}>{label}</button>;
              })}</div>
            </fieldset>
            <div className="mt-3.5 grid gap-[7px]" aria-label="Horarios por día">
              {!!draft.schedule.length && <div className={`${scheduleColumns} px-2.5 text-[9px] text-[var(--muted)]`} aria-hidden="true"><span>Día</span><span>Entrada</span><span>Salida</span></div>}
              {weekdays.filter(({ day }) => draft.schedule.some((item) => item.day === day)).map(({ day, label }) => {
                const workday = draft.schedule.find((item) => item.day === day)!;
                const updateTime = (field: "start" | "end", value: string) => updateSchedule(draft.schedule.map((item) => item.day === day ? { ...item, [field]: value } : item));
                return <div className={`${scheduleColumns} rounded-[9px] border border-[var(--border)] bg-[var(--surface)] px-2.5 py-[7px]`} key={day}>
                  <strong className="!text-[11px]">{label}</strong>
                  <input className="h-[34px] w-full min-w-0 rounded-[7px] border border-[var(--border)] bg-[var(--surface)] px-2 !text-[11px] text-[var(--text)] [color-scheme:light] in-data-[theme=dark]:[color-scheme:dark]" type="time" aria-label={`Entrada ${label}`} value={workday.start} onChange={(event) => updateTime("start", event.target.value)} />
                  <input className="h-[34px] w-full min-w-0 rounded-[7px] border border-[var(--border)] bg-[var(--surface)] px-2 !text-[11px] text-[var(--text)] [color-scheme:light] in-data-[theme=dark]:[color-scheme:dark]" type="time" aria-label={`Salida ${label}`} value={workday.end} onChange={(event) => updateTime("end", event.target.value)} />
                </div>;
              })}
              {!draft.schedule.length && <p className="!m-0 !py-[9px] !text-[10px] !text-[var(--muted)]">Seleccioná los días que trabaja el empleado.</p>}
            </div>
          </> : <>
            <div className="grid grid-cols-2 gap-3 max-[760px]:gap-[9px]">
              <label className="field !m-0">Tipo de pago
                <select value={draft.basis} onChange={(event) => setDraft({ ...draft, basis: event.target.value as TeamPay["basis"] })}>
                  <option value="hour">Por hora</option><option value="day">Por día</option>
                </select>
              </label>
              <label className="field !m-0">Importe ($)
                <input className="[appearance:textfield] [&::-webkit-inner-spin-button]:m-0 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:m-0 [&::-webkit-outer-spin-button]:appearance-none" autoFocus type="number" min="1" step="1" inputMode="numeric" value={draft.rate || ""} placeholder="0" onChange={(event) => { setError(""); setDraft({ ...draft, rate: Number(event.target.value) }); }} />
              </label>
            </div>
            <div className="team-setup-estimate mt-[18px] flex items-center justify-between gap-3 rounded-[9px] bg-[var(--brand-soft)] px-3 py-2.5 text-[10px] text-[var(--text)]"><span className="grid gap-[5px]">Estimado este mes<small className="text-[9px] text-[var(--muted)]">{draft.schedule.length ? "Según la jornada configurada" : "Configurá la jornada para calcularlo"}</small></span><strong className="!text-[17px]">{draft.schedule.length ? money(monthlyPayEstimate(draft)) : "—"}</strong></div>
          </>}
        </div>
        {error && <p className="form-error !mx-[30px] !mt-0 !mb-2.5 shrink-0 max-[760px]:!mx-5 max-[760px]:!mb-2" role="alert">{error}</p>}
        <div className={modalActionsClass}>
          {mode === "rate" && draft.rate > 0 && <button type="button" className="danger-text" onClick={() => onApply(draft.schedule.length ? { ...draft, rate: 0 } : undefined)}>Quitar tarifa</button>}
          <button type="button" className="button" onClick={onCancel}>Cancelar</button>
          <button className="button primary">Aplicar cambios</button>
        </div>
      </form>
    </motion.section>
  </motion.div>;
}
