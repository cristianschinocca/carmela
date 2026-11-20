export type OfflineInventory = {
  cash: { id: string; version: number; expectedAmount: string } | null;
  productStock: { productId: string; quantity: number; enabled: boolean; version: number }[];
  ingredients: { id: string; name: string; quantity: string; unit: string; version: number }[];
  recipes: { id?: string; productId: string; version: number; ingredients: { ingredientId: string; quantity: string; unit: string }[] }[];
};
export type ServerAccount = {
  id: string; clientKey: string; version: number; guests: number; discount: number; billRequested: boolean;
  operator: { id: string; legacyId: number; name: string; active: boolean } | null;
  items: ServerLine[];
};
export type ServerLine = { id: string; productId: string; productLegacyId: number; quantity: number; unitPrice: number; unitDiscount: number; note: string };
export type ServerEmployee = { id: string; legacyId: number; name: string; role: string };
export type AccountOperation = { id: string; tableId: string; expectedVersion: number; guests: number; billRequested: boolean; discount: number; operatorId: string; items: Omit<ServerLine, 'productLegacyId'>[] };
const base = (workspace: string) => `/api/workspaces/${encodeURIComponent(workspace)}`;
export class AccountRequestError extends Error { constructor(message: string, public status: number) { super(message); } }
export const accountClient = {
  async list(workspace: string): Promise<ServerAccount[]> {
    const response = await fetch(`${base(workspace)}/pos/accounts`, { credentials: 'same-origin', cache: 'no-store' });
    if (!response.ok) throw new Error('No se pudieron consultar las cuentas del servidor.');
    return response.json() as Promise<ServerAccount[]>;
  },
  async offlineInventory(workspace: string): Promise<OfflineInventory> {
    const response = await fetch(`${base(workspace)}/pos/offline-snapshot`, { credentials: 'same-origin', cache: 'no-store' });
    if (!response.ok) throw new Error('No se pudo preparar la copia de caja y stock.');
    return response.json() as Promise<OfflineInventory>;
  },
  async employees(workspace: string): Promise<ServerEmployee[]> {
    const response = await fetch(`${base(workspace)}/team/attendance/status`, { credentials: 'same-origin', cache: 'no-store' });
    if (!response.ok) throw new Error('No se pudo consultar el equipo de la cafetería.');
    return response.json() as Promise<ServerEmployee[]>;
  },
  async currentShiftId(workspace: string): Promise<string> {
    const response = await fetch(`${base(workspace)}/cash/active`, { credentials: 'same-origin', cache: 'no-store' });
    if (!response.ok) throw new AccountRequestError('No se pudo verificar el turno de caja.', response.status);
    const shift = await response.json() as { id?: unknown } | null;
    if (!shift || typeof shift.id !== 'string') throw new Error('Abrí la caja antes de cobrar.');
    return shift.id;
  },
  async verify(workspace: string, employeeId: number, pin: string) {
    const response = await fetch(`${base(workspace)}/team/employees/verify-code`, { method: 'POST', credentials: 'same-origin', cache: 'no-store', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ employeeId, pin }) });
    if (!response.ok) { const data = await response.json().catch(() => null) as { error?: string } | null; throw new AccountRequestError(data?.error || 'No se pudo verificar el código.', response.status); }
  },
  async save(workspace: string, operation: AccountOperation, employeePin: string) {
    const response = await fetch(`${base(workspace)}/pos/accounts`, { method: 'PUT', credentials: 'same-origin', cache: 'no-store', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...operation, employeePin }) });
    if (!response.ok) { const data = await response.json().catch(() => null) as { error?: string } | null; throw new AccountRequestError(data?.error || 'No se pudo guardar la cuenta.', response.status); }
    return response.json() as Promise<{ version: number; replayed: boolean }>;
  },
};

export type SettlementOperation = { id: string; tableId: string; expectedVersion: number; payment: 'Efectivo' | 'Tarjeta' | 'Transferencia'; operatorId: string; tableName: string; expectedShiftId?: string };
export const settlementPrefix = (userId: string, workspace: string) => `mistro.pos.settlement.pending.${encodeURIComponent(userId)}.${encodeURIComponent(workspace)}.`;
export const settlementKey = (userId: string, workspace: string, id: string) => `${settlementPrefix(userId, workspace)}${id}`;
export function pendingSettlements(userId: string, workspace: string): string[] {
  const prefix = settlementPrefix(userId, workspace);
  return Array.from({ length: localStorage.length }, (_, index) => localStorage.key(index)).filter((key): key is string => !!key && key.startsWith(prefix));
}
// El bloqueo se comparte entre pestañas y no almacena el PIN del empleado.
export async function withSettlementLock<T>(workspace: string, action: () => Promise<T>): Promise<T> {
  if (!navigator.locks) throw new Error('Este navegador no permite coordinar cobros entre pestañas. Usá un navegador compatible.');
  return navigator.locks.request(`mistro.pos.settlement.${JSON.stringify(workspace)}`, { ifAvailable: true }, async (lock) => {
    if (!lock) throw new Error('Hay un cobro en curso en otra pestaña. Esperá a que termine antes de continuar.');
    return action();
  });
}
export async function submitSettlement(workspace: string, operation: SettlementOperation, employeePin: string) {
  const { tableName: _name, ...input } = operation;
  const response = await fetch(`${base(workspace)}/pos/settlements`, { method: 'POST', credentials: 'same-origin', cache: 'no-store', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...input, employeePin }) });
  if (!response.ok) { const data = await response.json().catch(() => null) as { error?: string } | null; throw new AccountRequestError(data?.error || 'No se pudo confirmar el cobro.', response.status); }
  return response.json() as Promise<{ saleId: string; total: string; replayed: boolean }>;
}
export async function submitOfflineSale(workspace: string, sale: import("./offline/saleJournal").OfflineSale, employeePin: string) {
  const { tableName: _name, operatorId: _operator, ...settlement } = sale.settlement;
  const response = await fetch(`${base(workspace)}/pos/offline-settlements`, { method: 'POST', credentials: 'same-origin', cache: 'no-store', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ account: sale.account, settlement, recipeVersions: sale.recipeVersions, occurredAt: sale.occurredAt, employeePin }) });
  if (!response.ok) { const data = await response.json().catch(() => null) as { error?: string } | null; throw new AccountRequestError(data?.error || 'No se pudo sincronizar el cobro.', response.status); }
  return response.json() as Promise<{ saleId: string; total: string; replayed: boolean }>;
}
export async function reconcileSettlement(workspace: string, operation: Pick<SettlementOperation, 'id' | 'tableId'>) {
  const response = await fetch(`${base(workspace)}/pos/settlements/reconcile`, { method: 'POST', credentials: 'same-origin', cache: 'no-store', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(operation) });
  if (!response.ok) { const data = await response.json().catch(() => null) as { error?: string } | null; throw new Error(data?.error || 'No se pudo verificar el cobro.'); }
  return response.json() as Promise<{ status: 'completed'; total: string } | { status: 'cancelled' }>;
}

export function formatSettlementAmount(value: string) {
  return /^\d+$/.test(value) ? `$ ${BigInt(value).toLocaleString('es-AR')}` : 'Importe no disponible';
}
