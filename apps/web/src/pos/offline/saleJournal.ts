import type { AccountOperation, OfflineInventory, SettlementOperation } from "../serverAccountClient";
import { draftStoreName, openDatabase, scopeKey, type Scope } from "./accountJournal";
import type { Snapshot } from "./snapshot";

export type OfflineSale = { userId: string; workspace: string; sequence: number; name: string; operatorName: string; occurredAt: string; productNames: Record<string, string>; account: AccountOperation; settlement: SettlementOperation; recipeVersions: { productId: string; recipeId: string | null; version: number | null }[] };
const SCALE = 1_000_000n;
const factors: Record<string, bigint> = { unidad: 1n, kg: 1000n, g: 1n, l: 1000n, ml: 1n };
const group = (unit: string) => unit === "kg" || unit === "g" ? "mass" : unit === "l" || unit === "ml" ? "volume" : unit === "unidad" ? "unit" : "invalid";
function decimal(value: string): bigint {
  if (!/^\d+(?:\.\d{1,6})?$/.test(value)) throw new Error("La copia de stock no tiene cantidades válidas. Conectate para actualizarla.");
  const [whole, fraction = ""] = value.split(".");
  return BigInt(whole) * SCALE + BigInt(fraction.padEnd(6, "0"));
}
function format(value: bigint): string {
  const whole = value / SCALE, fraction = (value % SCALE).toString().padStart(6, "0").replace(/0+$/, "");
  return fraction ? `${whole}.${fraction}` : whole.toString();
}

/** Aplica una venta a la copia: los insumos compartidos se suman antes de descontarse. */
export function projectSale(inventory: OfflineInventory, account: AccountOperation, payment: SettlementOperation["payment"]) {
  const totals = new Map<string, number>();
  for (const item of account.items) totals.set(item.productId, (totals.get(item.productId) ?? 0) + item.quantity);
  const usage = new Map<string, bigint>();
  const recipeVersions = [...totals].map(([productId, count]) => {
    const recipe = inventory.recipes.find((entry) => entry.productId === productId);
    if (!recipe) return { productId, recipeId: null, version: null };
    if (!recipe.id) throw new Error("La copia de recetas es antigua. Conectate para actualizarla antes de cobrar.");
    for (const line of recipe.ingredients) {
      const ingredient = inventory.ingredients.find((entry) => entry.id === line.ingredientId);
      if (!ingredient || !factors[line.unit] || !factors[ingredient.unit] || group(line.unit) !== group(ingredient.unit)) throw new Error("La copia de recetas está incompleta. Conectate para actualizarla.");
      const amount = decimal(line.quantity) * factors[line.unit] * BigInt(count);
      usage.set(line.ingredientId, (usage.get(line.ingredientId) ?? 0n) + amount);
    }
    return { productId, recipeId: recipe.id, version: recipe.version };
  });
  for (const [id, amount] of usage) {
    const ingredient = inventory.ingredients.find((entry) => entry.id === id)!;
    const factor = factors[ingredient.unit];
    const available = decimal(ingredient.quantity) * factor;
    if (amount > available) throw new Error(`Stock insuficiente: ${ingredient.name}.`);
    if (amount % factor) throw new Error(`La receta de ${ingredient.name} supera la precisión admitida.`);
    ingredient.quantity = format((available - amount) / factor);
  }
  for (const [id, count] of totals) {
    const stock = inventory.productStock.find((entry) => entry.productId === id && entry.enabled);
    if (stock) { if (stock.quantity < count) throw new Error("No hay suficiente stock del producto."); stock.quantity -= count; }
  }
  const total = account.items.reduce((sum, line) => sum + BigInt(line.quantity) * BigInt(line.unitPrice - line.unitDiscount), 0n) - BigInt(account.discount);
  if (!inventory.cash || total < 0n) throw new Error("No hay una caja abierta en la última copia.");
  if (payment === "Efectivo") inventory.cash.expectedAmount = (BigInt(inventory.cash.expectedAmount) + total).toString();
  return recipeVersions;
}

export const saleJournal = {
  async hasOtherUser(userId: string, workspace: string): Promise<boolean> {
    const db = await openDatabase();
    try { return await new Promise((resolve, reject) => {
      const tx = db.transaction("offline-sales", "readonly"), request = tx.objectStore("offline-sales").getAll();
      tx.oncomplete = () => resolve((request.result as OfflineSale[]).some((sale) => sale.workspace === workspace && sale.userId !== userId));
      tx.onabort = () => reject(tx.error ?? new Error("No se pudieron consultar los cobros pendientes."));
    }); } finally { db.close(); }
  },
  async list(userId: string, workspace: string): Promise<OfflineSale[]> {
    const db = await openDatabase();
    try { return await new Promise((resolve, reject) => {
      const tx = db.transaction("offline-sales", "readonly"), request = tx.objectStore("offline-sales").getAll();
      tx.oncomplete = () => resolve((request.result as OfflineSale[]).filter((sale) => sale.userId === userId && sale.workspace === workspace).sort((a, b) => a.sequence - b.sequence));
      tx.onabort = () => reject(tx.error ?? new Error("No se pudieron consultar los cobros pendientes."));
    }); } finally { db.close(); }
  },
  async queue(scope: Scope, name: string, account: AccountOperation, payment: SettlementOperation["payment"], expectedDraft: string | null): Promise<void> {
    const db = await openDatabase();
    try { await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(["snapshots", "offline-sales", "account-operations", draftStoreName], "readwrite");
      const snapshots = tx.objectStore("snapshots"), drafts = tx.objectStore(draftStoreName), operations = tx.objectStore("account-operations"), sales = tx.objectStore("offline-sales");
      const key = JSON.stringify([scope.userId, scope.workspace]), tableKey = scopeKey(scope);
      const snapshotRequest = snapshots.get(key), draftRequest = drafts.get(tableKey), pendingRequest = sales.getAll(), operationRequest = operations.get(tableKey);
      let reason: Error | null = null;
      operationRequest.onsuccess = () => {
        try {
          const snapshot = snapshotRequest.result as Snapshot | undefined;
          if ((pendingRequest.result as OfflineSale[]).some((sale) => sale.workspace === scope.workspace && sale.userId !== scope.userId)) throw new Error("Hay cobros de otra sesión pendientes en esta PC. Sincronizalos antes de continuar.");
          if (!snapshot?.inventory?.cash) throw new Error("Necesitás una copia de una caja abierta para cobrar sin conexión.");
          if (operationRequest.result !== undefined) throw new Error("Hay una operación pendiente de confirmar en esta mesa.");
          if ((draftRequest.result ?? null) !== expectedDraft) throw new Error("El borrador cambió en otra pestaña. Reabrí la mesa.");
          const current = snapshot.accounts.find((entry) => entry.id === scope.tableId);
          if (!current || current.version !== account.expectedVersion || account.tableId !== scope.tableId || current.operator && current.operator.id !== account.operatorId) throw new Error("La mesa cambió en otra pestaña. Reabrila antes de cobrar.");
          const versions = projectSale(snapshot.inventory, account, payment);
          const sequence = (snapshot.offlineSequence ?? 0) + 1;
          const settlement: SettlementOperation = { id: crypto.randomUUID(), tableId: account.tableId, expectedVersion: account.expectedVersion + 1, expectedShiftId: snapshot.inventory.cash.id, operatorId: account.operatorId, tableName: name, payment };
          const operator = snapshot.employees.find((entry) => entry.id === account.operatorId);
          if (!operator) throw new Error("El responsable no está en la copia local del equipo.");
          if (Date.now() < snapshot.savedAt) throw new Error("El reloj de esta PC es anterior a la última conexión. Ajustalo antes de cobrar.");
          const productNames = Object.fromEntries(account.items.map((line) => [line.productId, snapshot.products.find((product) => product.id === line.productId)?.name ?? "Producto no disponible"]));
          const sale: OfflineSale = { userId: scope.userId, workspace: scope.workspace, sequence, name, operatorName: operator.name, occurredAt: new Date().toISOString(), productNames, account, settlement, recipeVersions: versions };
          snapshot.offlineSequence = sequence;
          Object.assign(current, { version: account.expectedVersion + 2, guests: 0, discount: 0, billRequested: false, operator: null, items: [] });
          const table = snapshot.floor.tables.find((entry) => entry.id === current.clientKey); if (table) table.hasAccount = false;
          snapshots.put(snapshot, key); sales.add(sale, settlement.id); if (expectedDraft !== null) drafts.delete(tableKey);
        } catch (error) { reason = error instanceof Error ? error : new Error("No se pudo registrar el cobro local."); tx.abort(); }
      };
      tx.oncomplete = () => resolve(); tx.onabort = () => reject(reason ?? tx.error ?? new Error("No se pudo registrar el cobro local."));
    }); } finally { db.close(); }
  },
  async remove(sale: OfflineSale): Promise<void> {
    const db = await openDatabase();
    try { await new Promise<void>((resolve, reject) => {
      const tx = db.transaction("offline-sales", "readwrite"), store = tx.objectStore("offline-sales"), request = store.get(sale.settlement.id);
      request.onsuccess = () => { if (JSON.stringify(request.result) === JSON.stringify(sale)) store.delete(sale.settlement.id); };
      tx.oncomplete = () => resolve(); tx.onabort = () => reject(tx.error ?? new Error("No se pudo actualizar el cobro pendiente."));
    }); } finally { db.close(); }
  },
};
