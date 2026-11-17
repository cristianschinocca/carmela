import { isSuperadmin, type SessionUser } from './authClient';

const KEY = 'carmela.auth.offline.v1';
const PENDING_SIGNOUT_KEY = 'carmela.auth.pending-signout.v1';
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const encoder = new TextEncoder();

type SavedAccess = { email: string; salt: number[]; iv: number[]; ciphertext: number[] };

async function deriveKey(password: string, salt: Uint8Array) {
  const material = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: new Uint8Array(salt), iterations: 250_000, hash: 'SHA-256' },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

// El acceso local no reemplaza la validación del servidor: solo habilita el POS durante un corte.
export async function saveOfflineAccess(email: string, password: string, user: SessionUser) {
  if (isSuperadmin(user)) {
    clearOfflineAccess();
    return;
  }
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt);
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv }, key,
    encoder.encode(JSON.stringify({ id: user.id, name: user.name, email: user.email, savedAt: Date.now() })),
  );
  localStorage.setItem(KEY, JSON.stringify({ email: email.trim().toLowerCase(), salt: [...salt], iv: [...iv], ciphertext: [...new Uint8Array(ciphertext)] } satisfies SavedAccess));
}

export async function unlockOfflineAccess(email: string, password: string): Promise<SessionUser | null> {
  try {
    const stored = JSON.parse(localStorage.getItem(KEY) || 'null') as SavedAccess | null;
    if (!stored || stored.email !== email.trim().toLowerCase()) return null;
    const key = await deriveKey(password, new Uint8Array(stored.salt));
    const plaintext = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: new Uint8Array(stored.iv) }, key, new Uint8Array(stored.ciphertext),
    );
    const user = JSON.parse(new TextDecoder().decode(plaintext)) as SessionUser & { savedAt: number };
    if (!user.id || !user.name || !user.email || !Number.isFinite(user.savedAt) || Date.now() - user.savedAt > MAX_AGE_MS) return null;
    return { id: user.id, name: user.name, email: user.email };
  } catch {
    return null;
  }
}

export function clearOfflineAccess() {
  localStorage.removeItem(KEY);
}

export function markPendingSignOut() {
  localStorage.setItem(PENDING_SIGNOUT_KEY, '1');
}

export function hasPendingSignOut() {
  return localStorage.getItem(PENDING_SIGNOUT_KEY) === '1';
}

export function clearPendingSignOut() {
  localStorage.removeItem(PENDING_SIGNOUT_KEY);
}
