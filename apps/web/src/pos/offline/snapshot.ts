import type { CatalogProduct } from "../../features/catalog/catalogClient";
import type { RemoteFloor } from "../floorClient";
import type { ServerAccount, ServerEmployee, OfflineInventory } from "../serverAccountClient";
import { openDatabase } from "./accountJournal";

export type Snapshot = { floor: RemoteFloor; accounts: ServerAccount[]; products: CatalogProduct[]; employees: ServerEmployee[]; inventory?: OfflineInventory | null; savedAt: number; offlineSequence?: number };
const keyFor = (userId: string, workspace: string) => JSON.stringify([userId, workspace]);
async function access(userId: string, workspace: string, value?: Snapshot): Promise<Snapshot | null> {
  const db = await openDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(value ? ["snapshots", "offline-sales"] : ["snapshots"], value ? "readwrite" : "readonly");
      const store = tx.objectStore("snapshots");
      let result: Snapshot | null = null;
      let reason: Error | null = null;
      if (value) {
        const pending = tx.objectStore("offline-sales").getAll();
        pending.onsuccess = () => {
          if ((pending.result as { userId: string; workspace: string }[]).some((sale) => sale.userId === userId && sale.workspace === workspace)) { reason = new Error("Hay cobros pendientes; la copia local no se reemplazó."); tx.abort(); return; }
          store.put(value, keyFor(userId, workspace));
        };
      }
      else {
        const request = store.get(keyFor(userId, workspace));
        request.onsuccess = () => { result = (request.result as Snapshot | undefined) ?? null; };
      }
      tx.oncomplete = () => resolve(result);
      tx.onabort = () => reject(reason ?? tx.error ?? new Error("No se pudo acceder a la copia local."));
    });
  } finally { db.close(); }
}
export const posSnapshot = {
  save: (userId: string, workspace: string, snapshot: Snapshot) => access(userId, workspace, snapshot),
  load: (userId: string, workspace: string) => access(userId, workspace),
};
