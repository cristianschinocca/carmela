import { defaultCategories, products as seedProducts, type Product } from "../data";
import type { CashExpense } from "./cash";
import { loadTeamMembers, type TeamMember } from "./team";

// Keep storage keys stable so existing demo data survives this reorganization.
export const PRODUCT_STORAGE = "carmela.products.v1";
export const CATEGORY_STORAGE = "carmela.categories.v1";
export const CASH_EXPENSE_STORAGE = "carmela.cash.expenses.v1";
const DEMO_SESSION_KEY = "carmela.demo.member.v2";

export function loadProducts(): Product[] {
  try {
    const saved = localStorage.getItem(PRODUCT_STORAGE);
    return saved ? (JSON.parse(saved) as Product[]) : seedProducts;
  } catch {
    return seedProducts;
  }
}

export function loadCategories(): string[] {
  try {
    const saved = localStorage.getItem(CATEGORY_STORAGE);
    return saved ? (JSON.parse(saved) as string[]) : defaultCategories;
  } catch {
    return defaultCategories;
  }
}

export function loadCashExpenses(): CashExpense[] {
  try {
    const saved = localStorage.getItem(CASH_EXPENSE_STORAGE);
    return saved ? (JSON.parse(saved) as CashExpense[]) : [];
  } catch {
    return [];
  }
}

export function loadDemoMember(): TeamMember | null {
  try {
    const id = Number(sessionStorage.getItem(DEMO_SESSION_KEY));
    return loadTeamMembers().find((member) => member.id === id && member.active) ?? null;
  } catch {
    return null;
  }
}

export function saveDemoMember(member: TeamMember): void {
  sessionStorage.setItem(DEMO_SESSION_KEY, String(member.id));
}

export function clearDemoMember(): void {
  sessionStorage.removeItem(DEMO_SESSION_KEY);
}
