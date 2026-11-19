import type { AccountOperation } from "../serverAccountClient";
import { draftStoreName, openDatabase, scopeKey, type Scope } from "./accountJournal";

/** El borrador solo es editable hasta que se transforma, atómicamente, en operación de envío. */
async function change(scope: Scope, action: "read" | "save" | "stage" | "remove", expected: string | null, next?: string): Promise<string | null> {
  const db = await openDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction([draftStoreName, "account-operations"], action === "read" ? "readonly" : "readwrite");
      const drafts = tx.objectStore(draftStoreName), operations = tx.objectStore("account-operations"), key = scopeKey(scope);
      const read = drafts.get(key);
      let result: string | null = null;
      let reason: Error | null = null;
      read.onsuccess = () => {
        result = typeof read.result === "string" ? read.result : null;
        if (action === "read") return;
        if (result !== expected) { reason = new Error("El borrador cambió en otra pestaña. Reabrí la mesa para revisarlo."); tx.abort(); return; }
        const pending = operations.get(key);
        pending.onsuccess = () => {
          if (pending.result !== undefined) { reason = new Error("Hay una operación pendiente de confirmar. Reabrí la mesa."); tx.abort(); return; }
          if (action === "save") { drafts.put(next!, key); result = next!; }
          else if (action === "stage" && result !== null) { operations.add(result, key); drafts.delete(key); }
          else if (action === "remove" && result !== null) { drafts.delete(key); result = null; }
          else { reason = new Error("El borrador ya no está disponible."); tx.abort(); }
        };
      };
      tx.oncomplete = () => resolve(result);
      tx.onabort = () => reject(reason ?? tx.error ?? new Error("No se pudo guardar el borrador local."));
    });
  } finally { db.close(); }
}
export const accountDraft = {
  read: (scope: Scope) => change(scope, "read", null),
  save: (scope: Scope, operation: AccountOperation, expected: string | null) => change(scope, "save", expected, JSON.stringify(operation)),
  stage: (scope: Scope, expected: string) => change(scope, "stage", expected),
  remove: (scope: Scope, expected: string) => change(scope, "remove", expected),
};
