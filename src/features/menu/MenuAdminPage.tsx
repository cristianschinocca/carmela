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
    <div className="grid grid-cols-[1.1fr_1fr] gap-7 max-[1000px]:grid-cols-1">
      <section className="panel !p-[35px] max-[1000px]:!p-[25px]">
        <span className="eyebrow">TU VIDRIERA DIGITAL</span>
        <h2 className="!my-3.5 !text-[29px] !leading-[1.4] max-[760px]:!text-[25px]">
          El sabor de Carmela,
          <br />a un escaneo de distancia.
        </h2>
        <p className="max-w-[400px]">
          Una carta pensada para descubrir desde el celular.
          Con tus productos, tus colores y toda tu esencia.
        </p>
        <div className="flex justify-between gap-[15px] border-b border-[var(--border)] py-5 text-[11px] text-[#8a977e] [&_strong]:font-medium [&_strong]:text-[#50633f]">
          <span>Nombre del establecimiento</span>
          <strong>Carmela</strong>
        </div>
        <div className="flex justify-between gap-[15px] border-b border-[var(--border)] py-5 text-[11px] text-[#8a977e] [&_strong]:font-medium [&_strong]:text-[#50633f]">
          <span>Identidad visual</span>
          <strong>
              <i className="mr-[5px] inline-block size-[9px] rounded-full bg-[var(--brand)]" /> Rosa
          </strong>
        </div>
        <div className="flex justify-between gap-[15px] border-b border-[var(--border)] py-5 text-[11px] text-[#8a977e] [&_strong]:font-medium [&_strong]:text-[#50633f]">
          <span>Productos visibles</span>
          <strong>
            {products.filter(
              (item) => item.available && item.onlineVisible !== false,
            ).length}{" "}
            productos · {categoryList.length} categorías
          </strong>
        </div>
        <button className="button primary !mt-[26px]" onClick={openMenu}>
          Explorar menú público <ArrowUpRight size={17} />
        </button>
        <p className="help-copy max-w-[400px]">
          Vista previa local. La publicación y el QR se
          conectarán en la próxima etapa.
        </p>
      </section>
      <motion.button
        whileHover={subtleHover}
        whileTap={press}
        className="relative min-h-[470px] overflow-hidden rounded-3xl !text-white after:absolute after:inset-0 after:[background:linear-gradient(0deg,#681d40e8,#681d4033)] max-[1000px]:min-h-[350px]"
        onClick={openMenu}
      >
        <img className="absolute inset-0 size-full object-cover" src={photos.shop} alt="Café de Carmela" />
        <div className="absolute right-8 bottom-[35px] left-8 z-[1]">
          <span className="text-[34px] font-extrabold">Carmela.</span>
          <h2 className="!my-3.5 !text-[29px] !leading-[1.4] max-[760px]:!text-[25px]">Tu pausa favorita.</h2>
          <p className="!text-[#d2ddce] in-data-[theme=dark]:!text-[#a9a3a5]">Café con origen. Hecho con cariño.</p>
          <span className="mt-7 flex items-center gap-3 text-xs text-[var(--brand)]">
            Conocé nuestra carta <ArrowRight size={18} />
          </span>
        </div>
      </motion.button>
    </div>
  );
}
