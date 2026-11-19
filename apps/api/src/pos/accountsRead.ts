import type { tenantDatabase } from "@mistro/db/tenant";

type Db = ReturnType<typeof tenantDatabase>;
const legacyId = (value: bigint) => {
  const result = Number(value);
  if (!Number.isSafeInteger(result) || result < 1) throw new Error("El identificador excede el rango admitido por el POS.");
  return result;
};
/** Identidades y datos necesarios para recuperar cuentas; no expone códigos ni datos salariales. */
export async function readAccounts(db: Db) {
  const tables = await db.diningTable.findMany({
    where: { clientKey: { not: null }, OR: [{ sector: { kind: { not: "counter" } } }, { guests: { gt: 0 } }, { billRequested: true }, { items: { some: {} } }] },
    orderBy: [{ sectorId: "asc" }, { number: "asc" }],
    select: { id: true, clientKey: true, version: true, guests: true, discount: true, billRequested: true,
      operator: { select: { id: true, legacyId: true, name: true, active: true, deletedAt: true } },
      items: { select: { id: true, productId: true, quantity: true, unitPrice: true, unitDiscount: true, note: true, product: { select: { legacyId: true } } } } },
  });
  return tables.map(({ operator, items, ...table }) => ({ ...table,
    operator: operator ? { id: operator.id, legacyId: legacyId(operator.legacyId), name: operator.name, active: operator.active && !operator.deletedAt } : null,
    items: items.map(({ product, ...item }) => ({ ...item, productLegacyId: legacyId(product.legacyId) })),
  }));
}
