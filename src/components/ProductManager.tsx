import { useEffect, useMemo, useRef, useState, type DragEvent, type FormEvent } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  Check,
  ChevronDown,
  ChevronUp,
  GripVertical,
  Pencil,
  Plus,
  Search,
  Tags,
  Trash2,
  X,
} from "lucide-react";
import { money, photos, type Product } from "../data";
import {
  fadeUp,
  modalVariants,
  overlayVariants,
  press,
  staggerContainer,
} from "../motion";

type Props = {
  products: Product[];
  categories: string[];
  onSave: (product: Product) => void;
  onDelete: (id: number) => void;
  onReorder: (fromId: number, toId: number) => void;
  onAddCategory: (name: string) => boolean;
  onRenameCategory: (current: string, next: string) => boolean;
  onDeleteCategory: (name: string) => boolean;
};

const emptyProduct = (categories: string[]): Product => ({
  id: 0,
  name: "",
  category: categories[0] ?? "",
  description: "",
  price: 0,
  image: photos.coffee,
  available: true,
  onlineVisible: true,
});

export function ProductManager({
  products,
  categories,
  onSave,
  onDelete,
  onReorder,
  onAddCategory,
  onRenameCategory,
  onDeleteCategory,
}: Props) {
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("Todas");
  const [filterOpen, setFilterOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [showCategories, setShowCategories] = useState(false);
  const [dragging, setDragging] = useState<number | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const categoryFilterRef = useRef<HTMLDivElement>(null);
  const visible = useMemo(
    () =>
      products.filter(
        (product) =>
          product.name.toLowerCase().includes(query.toLowerCase()) ||
          product.category.toLowerCase().includes(query.toLowerCase()),
      ).filter(
        (product) =>
          categoryFilter === "Todas" || product.category === categoryFilter,
      ),
    [products, query, categoryFilter],
  );
  useEffect(() => {
    if (categoryFilter !== "Todas" && !categories.includes(categoryFilter))
      setCategoryFilter("Todas");
  }, [categories, categoryFilter]);
  useEffect(() => {
    if (!filterOpen) return;
    const closeOutside = (event: PointerEvent) => {
      if (!categoryFilterRef.current?.contains(event.target as Node))
        setFilterOpen(false);
    };
    const closeWithEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setFilterOpen(false);
    };
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeWithEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", closeWithEscape);
    };
  }, [filterOpen]);
  const startCreate = () => {
    setConfirmDelete(false);
    setEditing(emptyProduct(categories));
  };
  const startEdit = (product: Product) => {
    setConfirmDelete(false);
    setEditing({ ...product });
  };
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!editing) return;
    onSave({
      ...editing,
      id: editing.id || Date.now(),
      name: editing.name.trim(),
      description: editing.description.trim(),
      image: editing.image.trim() || photos.coffee,
    });
    setEditing(null);
  };
  const drop = (event: DragEvent, id: number) => {
    event.preventDefault();
    if (dragging !== null && dragging !== id) onReorder(dragging, id);
    setDragging(null);
  };
  return (
    <>
      <section className="panel product-manager">
        <div className="manager-toolbar">
          <label className="search">
            <Search size={18} />
            <input
              aria-label="Buscar productos"
              placeholder="Buscar por nombre o categoría…"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
          <div className="manager-actions">
            <div className="manager-category-filter" ref={categoryFilterRef}>
              <button
                type="button"
                aria-haspopup="listbox"
                aria-expanded={filterOpen}
                aria-label={`Filtrar por categoría: ${categoryFilter === "Todas" ? "Todas las categorías" : categoryFilter}`}
                onClick={() => setFilterOpen((open) => !open)}
              >
                <Tags size={15} />
                <span>
                  {categoryFilter === "Todas"
                    ? "Todas las categorías"
                    : categoryFilter}
                </span>
                <ChevronDown size={14} />
              </button>
              <AnimatePresence>
                {filterOpen && (
                  <motion.div
                    className="manager-category-menu"
                    role="listbox"
                    aria-label="Categorías de productos"
                    initial={{ opacity: 0, y: -5, scale: 0.985 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -4, scale: 0.985 }}
                    transition={{ duration: 0.16 }}
                  >
                    {["Todas", ...categories].map((category) => {
                      const selected = categoryFilter === category;
                      return (
                        <button
                          type="button"
                          role="option"
                          aria-selected={selected}
                          key={category}
                          onClick={() => {
                            setCategoryFilter(category);
                            setFilterOpen(false);
                          }}
                        >
                          <span>
                            {category === "Todas"
                              ? "Todas las categorías"
                              : category}
                          </span>
                          {selected && <Check size={15} />}
                        </button>
                      );
                    })}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            <button className="button" onClick={() => setShowCategories(true)}>
              <Tags size={16} /> Categorías{" "}
              <span className="count-pill">{categories.length}</span>
            </button>
            <button className="button primary" onClick={startCreate}>
              <Plus size={17} /> Nuevo producto
            </button>
          </div>
        </div>
        <div className="manager-summary">
          <span>
            {visible.length} de {products.length} productos
          </span>
          <span>Arrastrá las filas o usá las flechas para ordenar.</span>
        </div>
        <motion.div
          className="catalog manager-catalog"
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
        >
          <AnimatePresence mode="popLayout">
            {visible.map((product, index) => (
              <motion.article
                layout
                variants={fadeUp}
                key={product.id}
                className={
                  "catalog-row manager-row " +
                  (dragging === product.id ? "dragging" : "")
                }
                draggable
                onDragStart={() => setDragging(product.id)}
                onDragEnd={() => setDragging(null)}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => drop(event, product.id)}
              >
                <button
                  className="drag-handle"
                  aria-label={`Mover ${product.name}`}
                  title="Arrastrar para ordenar"
                >
                  <GripVertical size={18} />
                </button>
                <img src={product.image} alt="" />
                <span className="manager-product-copy">
                  <strong>{product.name}</strong>
                  <small>
                    {product.category} · {product.description}
                  </small>
                </span>
                <span
                  className={"badge " + (product.available ? "ready" : "done")}
                >
                  {product.available ? "Disponible" : "Oculto"}
                </span>
                <div className="product-online-control">
                  <span>{product.onlineVisible === false ? "Oculto" : "Online"}</span>
                  <motion.button
                    whileTap={press}
                    type="button"
                    role="switch"
                    aria-checked={product.onlineVisible !== false}
                    aria-label={`${product.onlineVisible === false ? "Publicar" : "Ocultar"} ${product.name} en el menú digital`}
                    className="product-online-switch"
                    onClick={() =>
                      onSave({
                        ...product,
                        onlineVisible: product.onlineVisible === false,
                      })
                    }
                  >
                    <i />
                  </motion.button>
                </div>
                <b>{money(product.price)}</b>
                <div className="order-controls">
                  <button
                    aria-label={`Subir ${product.name}`}
                    disabled={index === 0}
                    onClick={() => onReorder(product.id, visible[index - 1].id)}
                  >
                    <ChevronUp size={15} />
                  </button>
                  <button
                    aria-label={`Bajar ${product.name}`}
                    disabled={index === visible.length - 1}
                    onClick={() => onReorder(product.id, visible[index + 1].id)}
                  >
                    <ChevronDown size={15} />
                  </button>
                </div>
                <motion.button
                  whileTap={press}
                  className="edit-product"
                  aria-label={`Editar ${product.name}`}
                  onClick={() => startEdit(product)}
                >
                  <Pencil size={16} />
                  <span>Editar</span>
                </motion.button>
              </motion.article>
            ))}
          </AnimatePresence>
        </motion.div>
        {!visible.length && (
          <motion.div
            className="empty"
            variants={fadeUp}
            initial="hidden"
            animate="visible"
          >
            <Search size={28} />
            <h3>No encontramos productos</h3>
            <p>Probá con otro término o creá uno nuevo.</p>
          </motion.div>
        )}
        <p className="help-copy">
          Los cambios se guardan en este navegador y se reflejan en el POS y el
          menú digital.
        </p>
      </section>

      <AnimatePresence>
        {editing && (
          <motion.div
            className="modal-backdrop"
            variants={overlayVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            onClick={() => setEditing(null)}
          >
            <motion.section
              className="product-modal editor-modal"
              variants={modalVariants}
              onClick={(event) => event.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-labelledby="product-editor-title"
            >
              <button
                className="icon-btn close-modal"
                aria-label="Cerrar editor"
                onClick={() => setEditing(null)}
              >
                <X size={20} />
              </button>
              <div className="editor-heading">
                <span className="eyebrow">CATÁLOGO</span>
                <h2 id="product-editor-title">
                  {editing.id ? "Editar producto" : "Nuevo producto"}
                </h2>
                <p>Esta información se mostrará también en el menú público.</p>
              </div>
              <form className="product-form" onSubmit={submit}>
                <label className="field">
                  Nombre
                  <input
                    autoFocus
                    required
                    value={editing.name}
                    onChange={(event) =>
                      setEditing({ ...editing, name: event.target.value })
                    }
                  />
                </label>
                <div className="field-row">
                  <label className="field">
                    Categoría
                    <select
                      required
                      value={editing.category}
                      onChange={(event) =>
                        setEditing({ ...editing, category: event.target.value })
                      }
                    >
                      {categories.map((item) => (
                        <option key={item}>{item}</option>
                      ))}
                    </select>
                  </label>
                  <label className="field">
                    Precio
                    <input
                      required
                      min="0"
                      step="100"
                      type="number"
                      value={editing.price || ""}
                      onChange={(event) =>
                        setEditing({
                          ...editing,
                          price: Number(event.target.value),
                        })
                      }
                    />
                  </label>
                </div>
                <label className="field">
                  Descripción
                  <textarea
                    required
                    rows={3}
                    value={editing.description}
                    onChange={(event) =>
                      setEditing({
                        ...editing,
                        description: event.target.value,
                      })
                    }
                  />
                </label>
                <label className="field">
                  URL de la imagen
                  <input
                    required
                    type="url"
                    value={editing.image}
                    onChange={(event) =>
                      setEditing({ ...editing, image: event.target.value })
                    }
                  />
                </label>
                <label className="availability-control">
                  <input
                    type="checkbox"
                    checked={editing.available}
                    onChange={(event) =>
                      setEditing({
                        ...editing,
                        available: event.target.checked,
                      })
                    }
                  />
                  <span>
                    <strong>Disponible para la venta</strong>
                    <small>Disponible para cargar en el POS.</small>
                  </span>
                </label>
                <label className="availability-control">
                  <input
                    type="checkbox"
                    checked={editing.onlineVisible !== false}
                    onChange={(event) =>
                      setEditing({
                        ...editing,
                        onlineVisible: event.target.checked,
                      })
                    }
                  />
                  <span>
                    <strong>Visible en el menú digital</strong>
                    <small>También podés cambiarlo directamente desde la lista.</small>
                  </span>
                </label>
                <div className="form-actions">
                  {editing.id > 0 && !confirmDelete && (
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
                      <span>¿Eliminar definitivamente?</span>
                      <button
                        type="button"
                        onClick={() => setConfirmDelete(false)}
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          onDelete(editing.id);
                          setEditing(null);
                        }}
                      >
                        Sí, eliminar
                      </button>
                    </div>
                  ) : (
                    <>
                      <button
                        type="button"
                        className="button"
                        onClick={() => setEditing(null)}
                      >
                        Cancelar
                      </button>
                      <button className="button primary">
                        {editing.id ? "Guardar cambios" : "Crear producto"}
                      </button>
                    </>
                  )}
                </div>
              </form>
            </motion.section>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showCategories && (
          <CategoryManager
            categories={categories}
            products={products}
            onClose={() => setShowCategories(false)}
            onAdd={onAddCategory}
            onRename={onRenameCategory}
            onDelete={onDeleteCategory}
          />
        )}
      </AnimatePresence>
    </>
  );
}

function CategoryManager({
  categories,
  products,
  onClose,
  onAdd,
  onRename,
  onDelete,
}: {
  categories: string[];
  products: Product[];
  onClose: () => void;
  onAdd: (name: string) => boolean;
  onRename: (current: string, next: string) => boolean;
  onDelete: (name: string) => boolean;
}) {
  const [newName, setNewName] = useState("");
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const add = (event: FormEvent) => {
    event.preventDefault();
    if (onAdd(newName.trim())) {
      setNewName("");
      setMessage("Categoría creada.");
    } else setMessage("Ese nombre ya existe.");
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
        className="product-modal category-modal"
        variants={modalVariants}
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="category-title"
      >
        <button
          className="icon-btn close-modal"
          aria-label="Cerrar categorías"
          onClick={onClose}
        >
          <X size={20} />
        </button>
        <div className="editor-heading">
          <span className="eyebrow">ORGANIZACIÓN</span>
          <h2 id="category-title">Categorías</h2>
          <p>Creá y ordená la estructura que usan el POS y el menú.</p>
        </div>
        <form className="new-category" onSubmit={add}>
          <input
            aria-label="Nueva categoría"
            required
            placeholder="Ej. Bebidas frías"
            value={newName}
            onChange={(event) => setNewName(event.target.value)}
          />
          <button className="button primary">
            <Plus size={16} /> Crear
          </button>
        </form>
        <div className="category-list">
          {categories.map((category) => {
            const used = products.filter(
              (product) => product.category === category,
            ).length;
            return (
              <div className="category-editor-row" key={category}>
                <input
                  aria-label={`Nombre de ${category}`}
                  value={drafts[category] ?? category}
                  onChange={(event) =>
                    setDrafts({ ...drafts, [category]: event.target.value })
                  }
                />
                <span>
                  {used} producto{used === 1 ? "" : "s"}
                </span>
                <button
                  className="icon-btn"
                  aria-label={`Guardar categoría ${category}`}
                  disabled={(drafts[category] ?? category).trim() === category}
                  onClick={() => {
                    const next = (drafts[category] ?? category).trim();
                    if (onRename(category, next)) {
                      setDrafts({});
                      setMessage("Categoría actualizada.");
                    } else setMessage("Ese nombre ya existe.");
                  }}
                >
                  <Pencil size={15} />
                </button>
                <button
                  className="icon-btn danger-icon"
                  aria-label={`Eliminar categoría ${category}`}
                  disabled={used > 0 || categories.length === 1}
                  title={
                    used > 0
                      ? "Mové primero sus productos"
                      : "Eliminar categoría"
                  }
                  onClick={() => {
                    onDelete(category);
                    setMessage("Categoría eliminada.");
                  }}
                >
                  <Trash2 size={15} />
                </button>
              </div>
            );
          })}
        </div>
        <AnimatePresence mode="wait">
          {message && (
            <motion.p
              key={message}
              className="inline-message"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
            >
              {message}
            </motion.p>
          )}
        </AnimatePresence>
        <p className="help-copy">
          Una categoría con productos no puede eliminarse.
        </p>
      </motion.section>
    </motion.div>
  );
}
