import { useState, type FormEvent } from "react";
import { motion } from "motion/react";
import { ArrowRight, Coffee, ExternalLink, Eye, EyeOff, LockKeyhole, Mail } from "lucide-react";
import { pageVariants, press } from "../motion";
import { defaultTeam, loadTeamMembers, type TeamMember } from "../stores/team";
import "./login.css";

const DEMO_EMAIL = "demo@carmela.app";
const DEMO_PASSWORD = "Carmela2026!";

type LoginPageProps = {
  onLogin: (member: TeamMember) => void;
  onOpenMenu: () => void;
};

export function LoginPage({ onLogin, onOpenMenu }: LoginPageProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (email.trim().toLowerCase() !== DEMO_EMAIL || password !== DEMO_PASSWORD) {
      setError("El correo o la contraseña no coinciden con la cuenta de prueba.");
      return;
    }
    const owner = loadTeamMembers().find((member) => member.role === "Propietario" && member.active) ?? defaultTeam[0];
    onLogin(owner);
  };

  const fillDemoCredentials = () => {
    setEmail(DEMO_EMAIL);
    setPassword(DEMO_PASSWORD);
    setError("");
  };

  return (
    <motion.main
      key="login"
      className="login-page"
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
    >
      <header className="login-header">
        <div className="login-header-inner">
          <span className="login-brand" aria-label="Carmela, salumería y café">
            <span className="login-brand-icon"><Coffee size={19} strokeWidth={2.2} /></span>
            <span className="login-brand-name">
              <strong>Carmela<span className="login-brand-dot">.</span></strong>
              <small>SALUMERÍA Y CAFÉ</small>
            </span>
          </span>
          <button type="button" className="login-menu-link" onClick={onOpenMenu}>
            Menú público <ExternalLink size={15} aria-hidden="true" />
          </button>
        </div>
      </header>

      <section className="login-card" aria-labelledby="login-title">
        <span className="login-kicker">ESPACIO DE TRABAJO</span>
        <h1 id="login-title">Iniciá sesión</h1>
        <p className="login-description">Gestioná tu café desde un solo lugar.</p>

        <form onSubmit={submit} className="login-form">
          <div className="login-field">
            <label htmlFor="login-email">Correo electrónico</label>
            <span className="login-input-wrap">
              <Mail size={18} aria-hidden="true" />
              <input
                id="login-email"
                type="email"
                autoComplete="username"
                placeholder="nombre@tucafe.com"
                required
                value={email}
                onChange={(event) => { setEmail(event.target.value); setError(""); }}
                aria-invalid={Boolean(error)}
                aria-describedby={error ? "login-error" : undefined}
              />
            </span>
          </div>

          <div className="login-field">
            <label htmlFor="login-password">Contraseña</label>
            <span className="login-input-wrap">
              <LockKeyhole size={18} aria-hidden="true" />
              <input
                id="login-password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                placeholder="Ingresá tu contraseña"
                required
                value={password}
                onChange={(event) => { setPassword(event.target.value); setError(""); }}
                aria-invalid={Boolean(error)}
                aria-describedby={error ? "login-error" : undefined}
              />
              <button
                type="button"
                className="login-visibility"
                onClick={() => setShowPassword((current) => !current)}
                aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
              >
                {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </span>
          </div>

          {error && <p id="login-error" className="login-error" role="alert">{error}</p>}

          <motion.button type="submit" className="login-submit" whileTap={press}>
            Ingresar al panel <ArrowRight size={17} />
          </motion.button>
        </form>

        <div className="login-demo">
          <div>
            <strong>¿Querés probar el sistema?</strong>
            <span>Completá la cuenta de demostración.</span>
          </div>
          <button type="button" onClick={fillDemoCredentials}>Usar cuenta de prueba</button>
        </div>
      </section>

      <footer className="login-footer">
        <div className="login-footer-inner">
          <span className="login-footer-copy">© 2026 Carmela <span aria-hidden="true">·</span> Villa Madero, Buenos Aires</span>
          <span className="login-footer-demo"><i aria-hidden="true" /> Versión de prueba <span aria-hidden="true">·</span> Datos guardados en este navegador</span>
        </div>
      </footer>
    </motion.main>
  );
}
