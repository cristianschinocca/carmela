function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Falta la variable ${name}`);
  return value;
}

export const config = {
  port: Number(process.env.PORT ?? 3001),
  authUrl: required("BETTER_AUTH_URL"),
  authSecret: required("BETTER_AUTH_SECRET"),
  frontendOrigin: required("FRONTEND_ORIGIN"),
};

if (!Number.isInteger(config.port) || config.port < 1 || config.port > 65535) {
  throw new Error("PORT inválido");
}
if (config.authSecret.length < 32) throw new Error("BETTER_AUTH_SECRET debe tener al menos 32 caracteres");
for (const origin of [config.authUrl, config.frontendOrigin]) {
  const url = new URL(origin);
  if (!['http:', 'https:'].includes(url.protocol) || url.origin !== origin) {
    throw new Error(`Origen inválido: ${origin}`);
  }
}

