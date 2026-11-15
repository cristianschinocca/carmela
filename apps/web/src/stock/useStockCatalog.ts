import { useEffect, useRef, useState } from "react";
import { emptyStockCatalog, type StockCatalog } from "./types";
import { localStockCatalogRepository, STOCK_CATALOG_CHANGED, STOCK_CATALOG_STORAGE, type StockCatalogRepository } from "./repository";

export function useStockCatalog(repository: StockCatalogRepository = localStockCatalogRepository) {
  const [catalog, setCatalog] = useState<StockCatalog>(emptyStockCatalog);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [readFailed, setReadFailed] = useState(false);
  const saving = useRef(false);
  useEffect(() => {
    let active = true;
    setLoading(true);
    repository.load().then((data) => { if (active) setCatalog(data); }).catch(() => {
      if (active) { setReadFailed(true); setError("No se pudieron leer los datos de stock guardados en este navegador."); }
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [repository]);
  useEffect(() => {
    if (repository !== localStockCatalogRepository) return;
    let active = true;
    const refresh = () => { repository.load().then((data) => { if (active) { setCatalog(data); setError(""); setReadFailed(false); } }).catch(() => { if (active) { setReadFailed(true); setError("No se pudieron leer los datos de stock guardados en este navegador."); } }); };
    const onStorage = (event: StorageEvent) => { if (event.key === STOCK_CATALOG_STORAGE) refresh(); };
    window.addEventListener(STOCK_CATALOG_CHANGED, refresh);
    window.addEventListener("storage", onStorage);
    return () => { active = false; window.removeEventListener(STOCK_CATALOG_CHANGED, refresh); window.removeEventListener("storage", onStorage); };
  }, [repository]);
  const update = async (next: StockCatalog): Promise<boolean> => {
    if (readFailed || loading || saving.current) return false;
    saving.current = true;
    try {
      await repository.save(next);
      setCatalog(next);
      setError("");
      return true;
    } catch {
      setError("No se pudieron guardar los cambios. Revisá el almacenamiento del navegador.");
      return false;
    } finally {
      saving.current = false;
    }
  };
  return { catalog, update, error, loading, readFailed };
}
