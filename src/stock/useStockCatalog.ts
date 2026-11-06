import { useEffect, useRef, useState } from "react";
import { emptyStockCatalog, type StockCatalog } from "./types";
import { localStockCatalogRepository, type StockCatalogRepository } from "./repository";

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
