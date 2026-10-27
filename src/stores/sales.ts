export type SaleLineRecord = {
  productId: number;
  name: string;
  category: string;
  quantity: number;
  unitPrice: number;
};

export type SaleRecord = {
  id: string;
  tableName: string;
  closedAt: string;
  guests: number;
  subtotal: number;
  discount: number;
  total: number;
  payment: string;
  items: SaleLineRecord[];
};

export const SALES_STORAGE = "carmela.sales.history.v1";

export const loadSales = (): SaleRecord[] => {
  try {
    const saved = localStorage.getItem(SALES_STORAGE);
    return saved ? (JSON.parse(saved) as SaleRecord[]) : [];
  } catch {
    return [];
  }
};

export const saveSale = (sale: SaleRecord) => {
  const sales = loadSales();
  localStorage.setItem(SALES_STORAGE, JSON.stringify([sale, ...sales]));
};
