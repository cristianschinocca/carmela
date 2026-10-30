import { useEffect, useMemo, useState, type FormEvent } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  Clock3,
  CalendarDays,
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
  schedule: [1, 2, 3, 4, 5].map((day) => ({ day, start: "08:00", end: "16:00" })),
};
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
    <div className="team-page">
      <div className="team-metrics">
        <section>
          <span className="round-icon">
            <Users size={19} />
          </span>
          <div>
            <small>Personas activas</small>
            <strong>{team.filter((item) => item.active).length}</strong>
          </div>
        </section>
        <section>
          <span className="round-icon">
            <Clock3 size={19} />
          </span>
          <div>
            <small>Trabajando ahora</small>
            <strong>{onShift}</strong>
          </div>
        </section>
        <section>
          <span className="round-icon">
            <Wallet size={19} />
          </span>
          <div>
            <small>Sueldos estimados este mes</small>
            <strong>{configured.length ? money(monthlyTotal) : "Sin configurar"}</strong>
          </div>
        </section>
      </div>
      <div className="team-layout">
        <section className="panel team-manager">
          <div className="manager-toolbar">
            <label className="search">
              <Search size={18} />
              <input
                aria-label="Buscar equipo"
                placeholder="Buscar por nombre o rol…"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </label>
            <div className="manager-actions">
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
                <Plus size={17} /> Nueva persona
              </button>
            </div>
          </div>
          <div className="manager-summary">
            <span>{visible.length} {visible.length === 1 ? "persona" : "personas"}</span>
            <span>Estimación según días y horario configurados. No incluye ausencias ni feriados.</span>
          </div>
          <div className="team-list-head" aria-hidden="true">
            <span>Persona</span><span>Jornada</span><span>Tarifa</span><span>Estimado del mes</span><span>Estado</span><span />
          </div>
          <motion.div
            className="team-list"
            variants={staggerContainer}
            initial="hidden"
            animate="visible"
          >
            {visible.map((member) => (
              <motion.article
                layout
                variants={fadeUp}
                className="team-row"
                key={member.id}
              >
                <span className="team-avatar">{initials(member.name)}</span>
                <div className="team-copy">
                  <strong>{member.name}</strong>
                  <span>{member.role}</span>
                </div>
                <div className="team-schedule">
                  {member.pay ? <><strong>{scheduleLabel(member.pay)}</strong><small>{scheduleTimesLabel(member.pay)}</small></> : <span>Sin horario</span>}
                </div>
                <div className="team-rate">{member.pay?.rate ? <><strong>{money(member.pay.rate)}</strong><small>por {member.pay.basis === "hour" ? "hora" : "día"}</small></> : <span>Sin configurar</span>}</div>
                <div className="team-estimate">{member.pay?.rate ? <strong>{money(monthlyPayEstimate(member.pay))}</strong> : <span>—</span>}</div>
                <div className="team-status"><i className={member.clockedIn && member.active ? "online" : ""} /><span>{!member.active ? "Inactivo" : member.clockedIn ? "En turno" : "Fuera de turno"}</span></div>
                <motion.button
                  whileTap={press}
                  className="edit-product"
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
          <p className="help-copy">
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
  const [section, setSection] = useState<"access" | "pay">("access");
  const updateDraft = (next: TeamMember) => { setError(""); setDraft(next); };
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!draft.name.trim()) {
      setSection("access");
      setError("Ingresá el nombre de la persona.");
      return;
    }
    if (!/^\d{4}$/.test(draft.pin)) {
      setSection("access");
      setError("Ingresá un código de exactamente 4 números.");
      return;
    }
    if (team.some((item) => item.id !== draft.id && item.pin === draft.pin)) {
      setSection("access");
      setError("Ese código ya pertenece a otra persona.");
      return;
    }
    if (draft.pay && (!Number.isFinite(draft.pay.rate) || draft.pay.rate <= 0 || !draft.pay.schedule.length || draft.pay.schedule.some((day) => !Number.isFinite(workHoursPerDay(day)) || workHoursPerDay(day) <= 0))) {
      setSection("pay");
      setError("Completá una tarifa mayor a cero y una entrada y salida válidas por cada día seleccionado.");
      return;
    }
    onSave({ ...draft, id: draft.id || Date.now(), name: draft.name.trim() });
  };
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
        className={`product-modal member-modal member-modal-${section}`}
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
        <div className="editor-heading">
          <span className="eyebrow">EQUIPO</span>
          <h2 id="member-title">
            {draft.id ? "Editar persona" : "Nueva persona"}
          </h2>
          <p>Configurá el acceso, la jornada y el sueldo estimado.</p>
        </div>
        <div className="member-form-sections" role="group" aria-label="Secciones de la persona">
          <button type="button" aria-pressed={section === "access"} className={section === "access" ? "active" : ""} onClick={() => { setSection("access"); setError(""); }}>Datos y acceso</button>
          <button type="button" aria-pressed={section === "pay"} className={section === "pay" ? "active" : ""} onClick={() => { setSection("pay"); setError(""); }}>Pago y jornada</button>
        </div>
        <form className="product-form" onSubmit={submit} noValidate>
          <div className="member-form-body">
          {section === "access" ? <>
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
          <div className="field-row">
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
          <label className="availability-control">
            <input
              type="checkbox"
              checked={draft.active}
              onChange={(event) => updateDraft({ ...draft, active: event.target.checked })}
            />
            <span><strong>Usuario activo</strong><small>Puede ingresar al sistema y registrar fichajes.</small></span>
          </label>
          </> : <>
          <div className="team-pay-editor">
            <div className="team-pay-head">
              <span className="round-icon"><CalendarDays size={17} /></span>
              <div><strong>Tarifa y horario</strong><small>Estimación para el mes actual.</small></div>
              {draft.pay && <div className="team-pay-head-estimate"><small>Estimado</small><strong>{money(monthlyPayEstimate(draft.pay))}</strong></div>}
              {!draft.pay && <button type="button" className="button" onClick={() => updateDraft({ ...draft, pay: { ...defaultPay, schedule: defaultPay.schedule.map((day) => ({ ...day })) } })}>Configurar</button>}
            </div>
            {draft.pay && <>
              <div className="team-pay-fields">
                <label className="field">Tipo de pago
                  <select value={draft.pay.basis} onChange={(event) => updateDraft({ ...draft, pay: { ...draft.pay!, basis: event.target.value as TeamPay["basis"] } })}>
                    <option value="hour">Por hora</option><option value="day">Por día</option>
                  </select>
                </label>
                <label className="field">Importe ($)
                  <input type="number" min="1" step="1" inputMode="numeric" value={draft.pay.rate || ""} placeholder="0" onChange={(event) => updateDraft({ ...draft, pay: { ...draft.pay!, rate: Number(event.target.value) } })} />
                </label>
              </div>
              <fieldset className="team-pay-days">
                <legend>Días de trabajo</legend>
                <div>{weekdays.map(({ day, label }) => {
                  const selected = draft.pay!.schedule.some((item) => item.day === day);
                  return <button type="button" aria-pressed={selected} className={selected ? "selected" : ""} key={day} onClick={() => updateDraft({ ...draft, pay: { ...draft.pay!, schedule: selected ? draft.pay!.schedule.filter((item) => item.day !== day) : [...draft.pay!.schedule, { day, start: "08:00", end: "16:00" }] } })}>{label}</button>;
                })}</div>
              </fieldset>
              <div className="team-day-schedules" aria-label="Horarios por día">
                <div className="team-day-schedules-head" aria-hidden="true"><span>Día</span><span>Entrada</span><span>Salida</span></div>
                {weekdays.filter(({ day }) => draft.pay!.schedule.some((item) => item.day === day)).map(({ day, label }) => {
                  const workday = draft.pay!.schedule.find((item) => item.day === day)!;
                  const updateTime = (field: "start" | "end", value: string) => updateDraft({ ...draft, pay: { ...draft.pay!, schedule: draft.pay!.schedule.map((item) => item.day === day ? { ...item, [field]: value } : item) } });
                  return <div className="team-day-schedule" key={day}>
                    <strong>{label}</strong>
                    <input type="time" aria-label={`Entrada ${label}`} value={workday.start} onChange={(event) => updateTime("start", event.target.value)} />
                    <input type="time" aria-label={`Salida ${label}`} value={workday.end} onChange={(event) => updateTime("end", event.target.value)} />
                  </div>;
                })}
                {!draft.pay.schedule.length && <p>Elegí al menos un día de trabajo.</p>}
              </div>
              <button type="button" className="team-pay-remove" onClick={() => updateDraft({ ...draft, pay: undefined })}>Quitar configuración de sueldo</button>
            </>}
          </div>
          </>}
          </div>
          {error && (
            <motion.p
              className="form-error"
              initial={{ opacity: 0, y: 3 }}
              animate={{ opacity: 1, y: 0 }}
            >
              {error}
            </motion.p>
          )}
          <div className="form-actions">
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
                  {draft.id ? "Guardar cambios" : "Crear usuario"}
                </button>
              </>
            )}
          </div>
        </form>
      </motion.section>
    </motion.div>
  );
}
