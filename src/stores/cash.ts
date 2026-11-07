// Demo values shared by the cash dialog and the dashboard summary.
export const CASH_BASE_EXPECTED = 164500;
export const CASH_SALES = 114500;
export const OTHER_PAYMENTS = 170000;

export type CashMovementKind = "proveedor" | "empleado" | "gasto" | "ajuste";

export type CashExpense = {
  kind?: CashMovementKind;
  direction?: "in" | "out";
  id: number;
  time: string;
  supplier: string;
  concept: string;
  category: string;
  amount: number;
  payment: "Efectivo" | "Transferencia" | "Tarjeta";
  receipt: string;
};
