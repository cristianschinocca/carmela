const idPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const validId = (value: unknown): value is string => typeof value === "string" && idPattern.test(value);

export function categoryInput(value: unknown) {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  if (typeof v.name !== "string" || !v.name.trim() || v.name.trim().length > 120 || !Number.isInteger(v.position) || (v.position as number) < 0 || (v.position as number) > 2147483647) return null;
  return { name: v.name.trim(), position: v.position as number };
}

export function productInput(value: unknown) {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  if (typeof v.name !== "string" || !v.name.trim() || v.name.trim().length > 120 || !validId(v.categoryId) ||
      typeof v.description !== "string" || v.description.length > 2000 ||
      typeof v.price !== "number" || !Number.isSafeInteger(v.price) || v.price < 0 || v.price > 2147483647 ||
      typeof v.image !== "string" || v.image.length > 2048 || typeof v.available !== "boolean" || typeof v.onlineVisible !== "boolean" ||
      typeof v.position !== "number" || !Number.isInteger(v.position) || v.position < 0 || v.position > 2147483647) return null;
  if (v.image) {
    try { if (!["https:", "http:"].includes(new URL(v.image).protocol)) return null; } catch { return null; }
  }
  return { name: v.name.trim(), categoryId: v.categoryId, description: v.description, price: v.price, image: v.image, available: v.available, onlineVisible: v.onlineVisible, position: v.position };
}

export function importInput(value: unknown) {
  if (!value || typeof value !== "object") return null;
  const input = value as Record<string, unknown>;
  if (!Array.isArray(input.categories) || !Array.isArray(input.products) || input.categories.length > 200 || input.products.length > 500) return null;
  const names = new Set<string>();
  const categories: { name: string; position: number }[] = [];
  for (const [position, value] of input.categories.entries()) {
    if (typeof value !== "string") return null;
    const category = categoryInput({ name: value, position });
    if (!category || names.has(category.name.toLocaleLowerCase("es"))) return null;
    names.add(category.name.toLocaleLowerCase("es"));
    categories.push(category);
  }
  const ids = new Set<number>();
  const products: Array<NonNullable<ReturnType<typeof productInput>> & { legacyId: number; categoryName: string }> = [];
  for (const [position, value] of input.products.entries()) {
    if (!value || typeof value !== "object") return null;
    const v = value as Record<string, unknown>;
    if (typeof v.id !== "number" || !Number.isSafeInteger(v.id) || v.id <= 0 || v.id >= 1000000000000000 || ids.has(v.id) || typeof v.category !== "string") return null;
    const category = categories.find((item) => item.name === v.category);
    if (!category) return null;
    const product = productInput({ ...v, categoryId: "550e8400-e29b-41d4-a716-446655440000", position, onlineVisible: v.onlineVisible ?? true });
    if (!product) return null;
    ids.add(v.id);
    products.push({ ...product, legacyId: v.id, categoryName: category.name });
  }
  return { categories, products };
}
