import { createHmac, randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { config } from "../config.js";
const scrypt = promisify(scryptCallback);
const roles = ["Cajero", "Mozo", "Barista", "Encargado", "Propietario"] as const;
const timePattern = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
type Day = { day: number; start: string; end: string };
type Pay = { basis: "hour" | "day"; rate: number; schedule: Day[] };
export type EmployeeInput = { name: string; role: typeof roles[number]; active: boolean; pay: Pay | null; pin?: string };
export function parseEmployee(value: unknown, requirePin: boolean): EmployeeInput | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  if (typeof v.name !== "string" || v.name.trim().length < 2 || v.name.trim().length > 120 || typeof v.role !== "string" || !(roles as readonly string[]).includes(v.role) || typeof v.active !== "boolean") return null;
  if ((requirePin || v.pin !== undefined) && (typeof v.pin !== "string" || !/^\d{4}$/.test(v.pin))) return null;
  let pay: Pay | null = null;
  if (v.pay !== null && v.pay !== undefined) {
    if (typeof v.pay !== "object") return null;
    const p = v.pay as Record<string, unknown>;
    if ((p.basis !== "hour" && p.basis !== "day") || typeof p.rate !== "number" || !Number.isSafeInteger(p.rate) || p.rate < 0 || p.rate > 2147483647 || !Array.isArray(p.schedule) || p.schedule.length > 7) return null;
    const schedule: Day[] = [];
    for (const item of p.schedule) {
      if (!item || typeof item !== "object") return null;
      const d = item as Record<string, unknown>;
      if (typeof d.day !== "number" || !Number.isInteger(d.day) || d.day < 0 || d.day > 6 || typeof d.start !== "string" || typeof d.end !== "string" || !timePattern.test(d.start) || !timePattern.test(d.end) || d.start >= d.end || schedule.some((entry) => entry.day === d.day)) return null;
      schedule.push({ day: d.day, start: d.start, end: d.end });
    }
    pay = { basis: p.basis, rate: p.rate, schedule };
  }
  return { name: v.name.trim(), role: v.role as EmployeeInput["role"], active: v.active, pay, ...(typeof v.pin === "string" ? { pin: v.pin } : {}) };
}
/** La clave de búsqueda separa cafeterías y evita guardar el PIN en claro. */
export function pinLookup(pin: string, workspaceId: string) {
  const pepper = process.env.EMPLOYEE_PIN_PEPPER || (process.env.NODE_ENV === "development" ? config.authSecret : "");
  if (pepper.length < 32) throw new Error("Falta configurar EMPLOYEE_PIN_PEPPER con al menos 32 caracteres.");
  return createHmac("sha256", pepper).update("mistro:employee-pin:v1\0").update(workspaceId).update("\0").update(pin).digest("hex");
}
export async function hashPin(pin: string) {
  const salt = randomBytes(16);
  const hash = await scrypt(pin, salt, 64) as Buffer;
  return `scrypt:${salt.toString("hex")}:${hash.toString("hex")}`;
}

export async function verifyPin(pin: string, encoded?: string) {
  const parts = encoded?.split(":");
  const valid = parts?.length === 3 && parts[0] === "scrypt" && /^[0-9a-f]{32}$/.test(parts[1]) && /^[0-9a-f]{128}$/.test(parts[2]);
  const salt = valid ? Buffer.from(parts[1], "hex") : Buffer.alloc(16);
  const expected = valid ? Buffer.from(parts[2], "hex") : Buffer.alloc(64);
  const actual = await scrypt(pin, salt, 64) as Buffer;
  return Boolean(valid && timingSafeEqual(actual, expected));
}
