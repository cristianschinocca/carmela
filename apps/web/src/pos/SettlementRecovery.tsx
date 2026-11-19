import { useRef, useState } from 'react';
import { formatSettlementAmount, pendingSettlements, reconcileSettlement, type SettlementOperation } from './serverAccountClient';

export function SettlementRecovery({ userId, workspace, onResolved }: { userId: string; workspace: string; onResolved: () => void }) {
  const [keys, setKeys] = useState(() => pendingSettlements(userId, workspace));
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const verify = async () => {
    if (lock.current || !keys.length) return;
    lock.current = true; setBusy(true); setError('');
    try {
      const raw = localStorage.getItem(keys[0]);
      if (!raw) throw new Error('El registro pendiente ya no está disponible.');
      const operation = JSON.parse(raw) as SettlementOperation;
      const result = await reconcileSettlement(workspace, { id: operation.id, tableId: operation.tableId });
      localStorage.removeItem(keys[0]);
      setKeys(pendingSettlements(userId, workspace));
      setMessage(result.status === 'completed' ? `Cobro confirmado: ${operation.tableName} · ${formatSettlementAmount(result.total)}.` : `El intento de cobro de ${operation.tableName} no se realizó. La cuenta permanece abierta.`);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'No se pudo verificar el cobro.'); }
    finally { lock.current = false; setBusy(false); }
  };
  return <section className="panel grid gap-4 !p-6" aria-labelledby="settlement-recovery-title">
    <h2 id="settlement-recovery-title">Verificar cobro pendiente</h2>
    <p className="text-sm text-[var(--muted)]">Se interrumpió la confirmación. Verificá el resultado antes de continuar para evitar cobrar dos veces.</p>
    {message && <p role="status" className="text-sm">{message}</p>}
    {error && <p role="alert" className="text-sm text-red-500">{error}</p>}
    {keys.length ? <button type="button" className="button primary w-fit" disabled={busy} onClick={() => void verify()}>Verificar cobro</button> : <button type="button" className="button w-fit" onClick={onResolved}>Continuar</button>}
  </section>;
}
