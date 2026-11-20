import type { AccountOperation } from "../serverAccountClient";

const databaseName = "mistro-pos-journal";
const storeName = "account-operations";
export const draftStoreName = "account-drafts";
export type Scope = { userId: string; workspace: string; tableId: string };
export const scopeKey = ({ userId, workspace, tableId }: Scope) => JSON.stringify([userId, workspace, tableId]);

export function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(databaseName, 4);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(storeName)) request.result.createObjectStore(storeName);
      if (!request.result.objectStoreNames.contains(draftStoreName)) request.result.createObjectStore(draftStoreName);
      if (!request.result.objectStoreNames.contains("snapshots")) request.result.createObjectStore("snapshots");
      if (!request.result.objectStoreNames.contains("offline-sales")) request.result.createObjectStore("offline-sales");
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("No se pudo abrir el almacenamiento local."));
    request.onblocked = () => reject(new Error("Cerrá las otras pestañas para actualizar el almacenamiento local."));
  });
}

/** Una operación inmutable por mesa; la transacción impide que dos pestañas la sobrescriban. */
async function update(scope: Scope, operation: string | null, action: "read" | "queue" | "remove"): Promise<string | null> {
  const db = await openDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const transaction = db.transaction(action === "queue" ? [storeName, draftStoreName] : [storeName], action === "read" ? "readonly" : "readwrite");
      const store = transaction.objectStore(storeName);
      const key = scopeKey(scope);
      const request = store.get(key);
      let result: string | null = null;
      let reason: Error | null = null;
      request.onsuccess = () => {
        result = typeof request.result === "string" ? request.result : null;
        if (action === "queue") {
          if (result !== null && result !== operation) { reason = new Error("Hay un guardado pendiente en esta mesa. Reintentá antes de hacer otros cambios."); transaction.abort(); return; }
          if (result === null) {
            const draft = transaction.objectStore(draftStoreName).get(key);
            draft.onsuccess = () => {
              if (draft.result !== undefined) { reason = new Error("Hay un borrador local pendiente. Revisalo antes de guardar."); transaction.abort(); return; }
              store.add(operation!, key); result = operation;
            };
          }
        }
        if (action === "remove" && result === operation) { store.delete(key); result = null; }
      };
      transaction.oncomplete = () => resolve(result);
      transaction.onabort = () => reject(reason ?? transaction.error ?? new Error("No se pudo guardar la operación local."));
      transaction.onerror = () => { /* El rechazo se resuelve al abortar. */ };
    });
  } finally { db.close(); }
}

export const accountJournal = {
  async list(userId: string, workspace: string): Promise<string[]> {
    const db = await openDatabase();
    try {
      return await new Promise((resolve, reject) => {
        const tx = db.transaction([storeName, draftStoreName], "readonly");
        const ids = new Set<string>();
        for (const name of [storeName, draftStoreName]) {
          const request = tx.objectStore(name).openKeyCursor();
          request.onsuccess = () => {
            const cursor = request.result;
            if (!cursor) return;
            try { const key = JSON.parse(String(cursor.key)) as unknown; if (Array.isArray(key) && key.length === 3 && key[0] === userId && key[1] === workspace && typeof key[2] === "string") ids.add(key[2]); } catch { /* Las claves desconocidas se conservan. */ }
            cursor.continue();
          };
        }
        tx.oncomplete = () => resolve([...ids]);
        tx.onabort = () => reject(tx.error ?? new Error("No se pudieron consultar los pendientes."));
      });
    } finally { db.close(); }
  },
  read: (scope: Scope) => update(scope, null, "read"),
  queue: (scope: Scope, operation: AccountOperation) => update(scope, JSON.stringify(operation), "queue"),
  remove: (scope: Scope, serialized: string) => update(scope, serialized, "remove"),
  async migrateLegacy(scope: Scope, key: string) {
    const legacy = localStorage.getItem(key);
    if (!legacy) return this.read(scope);
    let value: AccountOperation;
    try {
      value = JSON.parse(legacy) as AccountOperation;
      const allowed = ["id", "tableId", "expectedVersion", "guests", "billRequested", "discount", "operatorId", "items"];
      if (!value || value.tableId !== scope.tableId || !Array.isArray(value.items) || Object.keys(value).some((field) => !allowed.includes(field)) || value.items.some((item) => Object.keys(item).some((field) => !["id", "productId", "quantity", "unitPrice", "unitDiscount", "note"].includes(field)))) throw new Error();
    } catch { throw new Error("No se pudo migrar el guardado pendiente. Los datos originales se conservaron."); }
    const saved = await this.queue(scope, value);
    if (localStorage.getItem(key) === legacy) localStorage.removeItem(key);
    return saved;
  },
};
