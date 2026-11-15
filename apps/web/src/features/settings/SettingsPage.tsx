import type { FormEvent } from "react";
import { ExternalLink, Instagram, LoaderCircle } from "lucide-react";
import { business } from "../../config/business";

type Props = {
  saving: boolean;
  onSubmit: (event: FormEvent) => void;
};

const fieldClass = "mb-[22px] flex flex-col gap-2 text-xs text-[#8d9981]";
const inputClass = "w-full rounded-lg border border-[#e5eadc] bg-white p-2.5 text-xs text-[#516345]";

export function SettingsPage({ saving, onSubmit }: Props) {
  return (
    <section className="panel !max-w-[650px]">
      <h2>La identidad de tu local</h2>
      <p className="!mt-2.5 !mb-[25px]">Datos principales de Carmela.</p>
      <form onSubmit={onSubmit}>
        <label className={fieldClass}>
          Nombre del local
          <input className={inputClass} defaultValue={business.name} required />
        </label>
        <div className={fieldClass}>
          <span>Dirección</span>
          <a
            className="flex items-center justify-between gap-[15px] rounded-[10px] border border-[var(--border)] bg-[var(--surface)] px-[13px] py-3 !text-inherit hover:border-[#c52f704d] in-data-[theme=dark]:border-[#3a3537] in-data-[theme=dark]:bg-[#1f1d1e] in-data-[theme=dark]:!text-[#f0ecee]"
            href={business.mapsUrl}
            target="_blank"
            rel="noreferrer"
            aria-label="Abrir dirección de Carmela en Google Maps"
          >
            <span>
              <strong className="block text-[11px]">{business.address}</strong>
              <small className="mt-1 block text-[9px] text-[var(--muted)]">{business.addressRegion}</small>
            </span>
            <ExternalLink size={16} className="text-[var(--brand)]" />
          </a>
          <small className="text-[8px] text-[var(--muted)]">
            Dirección vinculada con Google Maps.
          </small>
        </div>
        <label className={fieldClass}>
          Horario de atención
          <input
            className={inputClass}
            defaultValue="Lun., mié., jue., vie. y sáb. · 08:00–20:00 · Dom. 12:00–20:00 · Mar. cerrado"
            required
          />
        </label>
        <div className={fieldClass}>
          <span>Instagram</span>
          <div className="grid grid-cols-[auto_1fr_auto] items-center gap-2.5 rounded-[10px] border border-[var(--border)] bg-white px-[11px] text-[#a29294] in-data-[theme=dark]:border-[#3a3537] in-data-[theme=dark]:bg-[#1f1d1e] in-data-[theme=dark]:text-[#f0ecee]">
            <Instagram size={17} />
            <input
              className="w-full !border-0 !bg-transparent !px-0 !py-[11px] text-xs !text-inherit"
              aria-label="Instagram"
              defaultValue={business.instagram}
              required
            />
            <a
              className="grid place-items-center p-1 !text-[var(--brand)]"
              href={business.instagramUrl}
              target="_blank"
              rel="noreferrer"
              aria-label="Abrir Instagram de Carmela"
            >
              <ExternalLink size={16} />
            </a>
          </div>
        </div>
        <button className="button primary" disabled={saving}>
          {saving ? (
            <>
              <LoaderCircle className="spinner" size={16} />{" "}
              Guardando…
            </>
          ) : (
            "Guardar cambios"
          )}
        </button>
      </form>
    </section>
  );
}
