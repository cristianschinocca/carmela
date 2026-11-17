export type ProductStock = { productId: string; quantity: number; minimum: number; enabled: boolean; version: number };
export type StockRecord = { productId: string; legacyId: number; stock: ProductStock | null };
export type StockChange = { id: string; productId: string; kind: "entrada" | "salida" | "ajuste"; amount: number; minimum: number; enabled: boolean; expectedVersion: number; note: string };

export class InventoryRequestError extends Error { constructor(message: string, public readonly status: number) { super(message); } }

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, { credentials: "same-origin", cache: "no-store", ...options });
  if (!response.ok) {
    const result = await response.json().catch(() => null) as { error?: string } | null;
    throw new InventoryRequestError(result?.error || "No se pudo acceder al stock. Intentá nuevamente.", response.status);
  }
  return response.json() as Promise<T>;
}
const base = (workspaceId: string) => `/api/workspaces/${encodeURIComponent(workspaceId)}/inventory`;

export const inventoryClient = {
  async products(workspaceId: string) {
    const items: StockRecord[] = [];
    let offset: number | null = 0;
    do {
      const page: { items: StockRecord[]; nextOffset: number | null } = await request(`${base(workspaceId)}/products?offset=${offset}`);
      if (page.nextOffset !== null && (!Number.isSafeInteger(page.nextOffset) || page.nextOffset <= offset)) throw new Error("La paginación del stock no es válida.");
      items.push(...page.items);
      offset = page.nextOffset;
    } while (offset !== null);
    return items;
  },
  // El llamador conserva el mismo ID y los mismos datos si debe reintentar.
  move: (workspaceId: string, change: StockChange) => request<{ balance: number; replayed: boolean }>(`${base(workspaceId)}/movements`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(change),
  }),
};
