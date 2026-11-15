import { loadSales } from "./sales";

const LEGACY_COUNTER_SEQUENCE_KEY = "carmela.pos.counter.sequence.v1";
const COUNTER_SEQUENCE_KEY = "carmela.pos.counter.sequence.v2";

const lastClosedCounterNumber = () => Math.max(0, ...loadSales()
  .filter((sale) => sale.id.startsWith("counter-"))
  .map((sale) => Number(sale.tableName.match(/^Mesa (\d+)$/)?.[1]) || 0));

export const previewCounterTableNumber = (activeNumbers: number[]) =>
  Math.max(Number(localStorage.getItem(COUNTER_SEQUENCE_KEY)) || 0, lastClosedCounterNumber(), ...activeNumbers, 0) + 1;

export const allocateCounterTableNumber = (activeNumbers: number[]) => {
  const next = previewCounterTableNumber(activeNumbers);
  localStorage.setItem(COUNTER_SEQUENCE_KEY, String(next));
  return next;
};

export const ensureCounterTableSequenceAtLeast = (number: number) => {
  const saved = Number(localStorage.getItem(COUNTER_SEQUENCE_KEY)) || 0;
  if (number > saved) localStorage.setItem(COUNTER_SEQUENCE_KEY, String(number));
};

export const resetCounterTableSequence = () => {
  localStorage.removeItem(COUNTER_SEQUENCE_KEY);
  localStorage.removeItem(LEGACY_COUNTER_SEQUENCE_KEY);
};
