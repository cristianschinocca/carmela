import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  Clock3,
  Coffee,
  Instagram,
  Leaf,
  LogOut,
  MapPin,
  Plus,
  Search,
  Utensils,
} from "lucide-react";
import type { Product } from "../data";
import { money, photos } from "../data";
import { business } from "../config/business";
import { BusinessMap } from "./BusinessMap";
import {
  AnimatedImage,
  fadeUp,
  pageVariants,
  press,
  staggerContainer,
  subtleHover,
} from "../motion";

type PublicMenuProps = {
  products: Product[];
  categories: string[];
  onBack: () => void;
  onSelect: (product: Product) => void;
};

function WhatsAppIcon({ size = 20 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M12.04 2a9.84 9.84 0 0 0-8.42 14.92L2 22l5.22-1.54A9.9 9.9 0 1 0 12.04 2Zm0 17.98a8 8 0 0 1-4.08-1.12l-.3-.18-3.1.91.94-3.02-.2-.31a7.88 7.88 0 1 1 6.74 3.72Zm4.32-5.91c-.24-.12-1.4-.69-1.61-.77-.22-.08-.38-.12-.54.12-.16.24-.61.77-.75.93-.14.16-.28.18-.52.06-.24-.12-1-.37-1.91-1.18a7.16 7.16 0 0 1-1.32-1.64c-.14-.24-.01-.37.1-.49.11-.11.24-.28.36-.42.12-.14.16-.24.24-.4.08-.16.04-.3-.02-.42-.06-.12-.54-1.3-.73-1.78-.2-.47-.4-.4-.54-.41h-.46a.9.9 0 0 0-.65.3c-.22.24-.85.83-.85 2.02s.87 2.34.99 2.5c.12.16 1.7 2.6 4.13 3.65.58.25 1.03.4 1.38.51.58.18 1.1.16 1.52.1.46-.07 1.4-.58 1.6-1.13.2-.56.2-1.03.14-1.13-.06-.1-.22-.16-.46-.28Z" />
    </svg>
  );
}

export function PublicMenu({
  products,
  categories,
  onBack,
  onSelect,
}: PublicMenuProps) {
  const [category, setCategory] = useState("Todos");
  const [query, setQuery] = useState("");
  const filtered = useMemo(
    () =>
      products.filter(
        (product) =>
          product.available &&
          product.onlineVisible !== false &&
          (category === "Todos" || product.category === category) &&
          product.name.toLowerCase().includes(query.toLowerCase()),
      ),
    [products, category, query],
  );

  return (
    <motion.div
      key="public-menu"
      className="public-menu"
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
    >
      <header className="public-top">
        <button className="brand" onClick={onBack}>
          <span className="brand-mark">
            <Coffee size={23} />
          </span>
          Carmela<span className="brand-dot">.</span>
        </button>
        <span>CAFÉ DE ESPECIALIDAD</span>
        <button
          className="icon-btn"
          aria-label="Volver a gestión"
          onClick={onBack}
        >
          <LogOut size={19} />
        </button>
      </header>

      <section
        className="menu-hero"
        style={{
          backgroundImage: `linear-gradient(90deg,rgba(22,33,23,.8),rgba(22,33,23,.12)),url(${photos.shop})`,
        }}
      >
        <div>
          <span className="eyebrow">BUEN CAFÉ. BUENOS MOMENTOS.</span>
          <h1>Tu pausa favorita.</h1>
          <p>Café con origen, cosas ricas y un lugar para quedarte.</p>
          <span className="open-pill">
            <i /> Abierto hasta las 20:00
          </span>
        </div>
      </section>

      <main className="menu-body">
        <div className="menu-intro">
          <div>
            <span className="eyebrow">HECHO CON TIEMPO Y CARIÑO</span>
            <h2>¿Qué te tienta hoy?</h2>
          </div>
          <span className="table-label">
            <Utensils size={17} /> Disfrutá a tu ritmo
          </span>
        </div>

        <div className="menu-toolbar">
          <motion.div className="categories" layout>
            {["Todos", ...categories].map((item) => (
              <motion.button
                whileTap={press}
                key={item}
                className={category === item ? "selected" : ""}
                onClick={() => setCategory(item)}
              >
                {item === "Café" && <Coffee size={15} />} {item}
              </motion.button>
            ))}
          </motion.div>
          <label className="search">
            <Search size={17} />
            <input
              placeholder="Buscar algo rico…"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
        </div>

        <motion.div
          className="public-products"
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
          key={`${category}-${query}`}
        >
          {filtered.map((product) => (
            <motion.button
              layout
              variants={fadeUp}
              whileHover={subtleHover}
              whileTap={press}
              className="product"
              key={product.id}
              onClick={() => onSelect(product)}
            >
              <div className="product-image">
                <AnimatedImage src={product.image} alt={product.name} />
                {product.id === 1 && (
                  <span className="image-tag">El favorito</span>
                )}
                <motion.span
                  className="add-product"
                  whileHover={{ scale: 1.06 }}
                >
                  <Plus size={17} />
                </motion.span>
              </div>
              <div className="product-info">
                <small>{product.category}</small>
                <h3>{product.name}</h3>
                <p>{product.description}</p>
                <strong>{money(product.price)}</strong>
              </div>
            </motion.button>
          ))}
        </motion.div>

        <AnimatePresence>
          {!filtered.length && (
            <motion.div
              className="empty"
              variants={fadeUp}
              initial="hidden"
              animate="visible"
              exit="exit"
            >
              No encontramos ese producto. Probá con otro nombre.
            </motion.div>
          )}
        </AnimatePresence>

        <div className="public-note">
          <Leaf size={22} />
          <div>
            <strong>¿Tenés alguna preferencia o alergia?</strong>
            <p>
              Consultanos por ingredientes y opciones disponibles antes de
              pedir.
            </p>
          </div>
        </div>

        <section className="menu-business-info">
          <BusinessMap />
          <div className="business-hours">
            <span className="round-icon">
              <Clock3 size={20} />
            </span>
            <div>
              <span className="eyebrow">HORARIOS</span>
              <h3>Te esperamos</h3>
              <dl>
                <div>
                  <dt>Lunes, miércoles, jueves, viernes y sábado</dt>
                  <dd>08:00–20:00</dd>
                </div>
                <div>
                  <dt>Domingo</dt>
                  <dd>12:00–20:00</dd>
                </div>
                <div className="closed">
                  <dt>Martes</dt>
                  <dd>Cerrado</dd>
                </div>
              </dl>
            </div>
          </div>
        </section>

        <footer className="public-footer">
          <div className="footer-brand-block">
            <span className="brand">Carmela.</span>
            <small>Salumería y café</small>
          </div>
          <a
            className="footer-location"
            href={business.mapsUrl}
            target="_blank"
            rel="noreferrer"
          >
            <MapPin size={16} />
            <strong>{business.address}</strong>
          </a>
          <div className="footer-socials">
            <a
              className="footer-social-link whatsapp-link"
              href={business.whatsappUrl}
              target="_blank"
              rel="noreferrer"
              aria-label={`Escribir a Carmela por WhatsApp al ${business.whatsapp}`}
            >
              <WhatsAppIcon size={19} />
            </a>
            <a
              className="footer-social-link instagram-link"
              href={business.instagramUrl}
              target="_blank"
              rel="noreferrer"
              aria-label="Instagram de Carmela"
            >
              <Instagram size={19} />
            </a>
          </div>
        </footer>
      </main>
    </motion.div>
  );
}
