const COUNTER_SEQUENCE_KEY = "carmela.pos.counter.sequence.v1";

export const allocateCounterTableNumber = (activeNumbers: number[]) => {
  const saved = Number(localStorage.getItem(COUNTER_SEQUENCE_KEY)) || 0;
  const next = Math.max(saved, ...activeNumbers, 0) + 1;
  localStorage.setItem(COUNTER_SEQUENCE_KEY, String(next));
  return next;
};

export const ensureCounterTableSequenceAtLeast = (number: number) => {
  const saved = Number(localStorage.getItem(COUNTER_SEQUENCE_KEY)) || 0;
  if (number > saved) localStorage.setItem(COUNTER_SEQUENCE_KEY, String(number));
};

export const resetCounterTableSequence = () => {
  localStorage.removeItem(COUNTER_SEQUENCE_KEY);
};
