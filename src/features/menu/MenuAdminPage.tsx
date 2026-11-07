import { motion } from "motion/react";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { photos, type Product } from "../../data";
import { press, subtleHover } from "../../motion";

type Props = {
  products: Product[];
  categories: string[];
  openMenu: () => void;
};

export function MenuAdminPage({ products, categories: categoryList, openMenu }: Props) {
  return (
    <div className="menu-admin">
      <section className="panel">
        <span className="eyebrow">TU VIDRIERA DIGITAL</span>
        <h2>
          El sabor de Carmela,
          <br />a un escaneo de distancia.
        </h2>
        <p>
          Una carta pensada para descubrir desde el celular.
          Con tus productos, tus colores y toda tu esencia.
        </p>
        <div className="menu-setting">
          <span>Nombre del establecimiento</span>
          <strong>Carmela</strong>
        </div>
        <div className="menu-setting">
          <span>Identidad visual</span>
          <strong>
            <i className="color-dot" /> Rosa
          </strong>
        </div>
        <div className="menu-setting">
          <span>Productos visibles</span>
          <strong>
            {products.filter(
              (item) => item.available && item.onlineVisible !== false,
            ).length}{" "}
            productos · {categoryList.length} categorías
          </strong>
        </div>
        <button className="button primary" onClick={openMenu}>
          Explorar menú público <ArrowUpRight size={17} />
        </button>
        <p className="help-copy">
          Vista previa local. La publicación y el QR se
          conectarán en la próxima etapa.
        </p>
      </section>
      <motion.button
        whileHover={subtleHover}
        whileTap={press}
        className="menu-preview"
        onClick={openMenu}
      >
        <img src={photos.shop} alt="Café de Carmela" />
        <div>
          <span>Carmela.</span>
          <h2>Tu pausa favorita.</h2>
          <p>Café con origen. Hecho con cariño.</p>
          <span className="preview-cta">
            Conocé nuestra carta <ArrowRight size={18} />
          </span>
        </div>
      </motion.button>
    </div>
  );
}
