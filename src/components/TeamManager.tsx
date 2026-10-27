import { useEffect, useMemo, useState, type FormEvent } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  Clock3,
  Pencil,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
  UserRound,
  Users,
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
  type TeamMember,
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
            <ShieldCheck size={19} />
          </span>
          <div>
            <small>Roles configurados</small>
            <strong>{new Set(team.map((item) => item.role)).size}</strong>
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
            <span>{visible.length} personas</span>
            <span>Los códigos de fichaje permanecen ocultos.</span>
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
                  <span
                    className={`role-chip role-${member.role.toLowerCase()}`}
                  >
                    {member.role}
                  </span>
                </div>
                <div className="shift-state">
                  <i className={member.clockedIn ? "online" : ""} />
                  <span>
                    {member.clockedIn ? "En turno" : "Fuera de turno"}
                  </span>
                  <small>{member.lastClock ?? "Sin fichajes"}</small>
                </div>
                <span className={"badge " + (member.active ? "ready" : "done")}>
                  {member.active ? "Activo" : "Inactivo"}
                </span>
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
  const submit = (event: FormEvent) => {
    event.preventDefault();
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
        className="product-modal member-modal"
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
          <p>Configurá el rol y un código personal para fichar.</p>
        </div>
        <form className="product-form" onSubmit={submit}>
          <label className="field">
            Nombre completo
            <input
              autoFocus
              required
              value={draft.name}
              onChange={(event) =>
                setDraft({ ...draft, name: event.target.value })
              }
            />
          </label>
          <div className="field-row">
            <label className="field">
              Rol
              <select
                value={draft.role}
                onChange={(event) =>
                  setDraft({ ...draft, role: event.target.value as TeamRole })
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
                  setError("");
                  setDraft({
                    ...draft,
                    pin: event.target.value.replace(/\D/g, "").slice(0, 4),
                  });
                }}
              />
              <small id="pin-help">4 números, sin repetir.</small>
            </label>
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
          <label className="availability-control">
            <input
              type="checkbox"
              checked={draft.active}
              onChange={(event) =>
                setDraft({ ...draft, active: event.target.checked })
              }
            />
            <span>
              <strong>Usuario activo</strong>
              <small>Puede ingresar al sistema y registrar fichajes.</small>
            </span>
          </label>
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
