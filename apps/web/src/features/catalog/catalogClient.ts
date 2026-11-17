/** Acceso al catálogo de una cafetería; el servidor valida la membresía en cada petición. */
export type CatalogWorkspace = { id: string; name: string; status: string };
export type CatalogCategory = { id: string; name: string; position: number };
export type CatalogProduct = { id: string; legacyId: number; categoryId: string; name: string; description: string; price: number; image: string; available: boolean; onlineVisible: boolean; position: number };
export type ProductData = Omit<CatalogProduct, "id" | "legacyId">;

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(path, { credentials: "same-origin", cache: "no-store", ...options });
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { error?: string } | null;
    throw new Error(body?.error || "No se pudo acceder al catálogo. Intentá nuevamente.");
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

const base = (workspaceId: string) => `/api/workspaces/${encodeURIComponent(workspaceId)}/catalog`;
const json = (method: string, data: unknown): RequestInit => ({ method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });

export const catalogClient = {
  workspaces: () => request<CatalogWorkspace[]>("/api/workspaces"),
  categories: (workspaceId: string) => request<CatalogCategory[]>(`${base(workspaceId)}/categories`),
  async products(workspaceId: string) {
    const items: CatalogProduct[] = [];
    let offset: number | null = 0;
    do {
      const page: { items: CatalogProduct[]; nextOffset: number | null } = await request(`${base(workspaceId)}/products?offset=${offset}`);
      if (page.nextOffset !== null && (!Number.isSafeInteger(page.nextOffset) || page.nextOffset <= offset)) throw new Error("La paginación del catálogo no es válida.");
      items.push(...page.items);
      offset = page.nextOffset;
    } while (offset !== null);
    return items;
  },
  saveCategory: (workspaceId: string, data: Pick<CatalogCategory, "name" | "position">, id?: string) => request<CatalogCategory>(`${base(workspaceId)}/categories${id ? `/${encodeURIComponent(id)}` : ""}`, json(id ? "PUT" : "POST", data)),
  deleteCategory: (workspaceId: string, id: string) => request<void>(`${base(workspaceId)}/categories/${encodeURIComponent(id)}`, { method: "DELETE" }),
  saveProduct: (workspaceId: string, data: ProductData, id?: string) => request<CatalogProduct>(`${base(workspaceId)}/products${id ? `/${encodeURIComponent(id)}` : ""}`, json(id ? "PUT" : "POST", data)),
  deleteProduct: (workspaceId: string, id: string) => request<void>(`${base(workspaceId)}/products/${encodeURIComponent(id)}`, { method: "DELETE" }),
  reorder: (workspaceId: string, kind: "products" | "categories", ids: string[]) => request<void>(`${base(workspaceId)}/order/${kind}`, json("PUT", { ids })),
};
