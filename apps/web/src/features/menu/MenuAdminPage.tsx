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
        <h2 className="!mb-2 !text-[22px] !leading-[1.3]">Menú público</h2>
        <p className="max-w-[400px]">Consultá la carta que ven tus clientes.</p>
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
          Ver menú público <ArrowUpRight size={17} />
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
        <img className="absolute inset-0 size-full object-cover" src={photos.shop} alt="" />
        <div className="absolute right-8 bottom-[35px] left-8 z-[1]">
          <span className="text-[34px] font-extrabold">Carmela.</span>
          <h2 className="!my-3.5 !text-[25px] !leading-[1.3]">Menú digital</h2>
          <span className="mt-7 flex items-center gap-3 text-xs !text-white">
            Ver menú público <ArrowRight size={18} />
          </span>
        </div>
      </motion.button>
    </div>
  );
}
