/** Las operaciones administrativas con cookies solo aceptan solicitudes del frontend configurado. */
export function isTrustedAdminOrigin(origin: string | undefined, frontendOrigin: string, development: boolean): boolean {
  if (!origin) return false;
  if (origin === frontendOrigin) return true;
  if (!development) return false;
  const configured = new URL(frontendOrigin);
  if (configured.hostname !== "localhost" && configured.hostname !== "127.0.0.1") return false;
  configured.hostname = configured.hostname === "localhost" ? "127.0.0.1" : "localhost";
  return origin === configured.origin;
}
