import { betterAuth } from "better-auth";
import { prismaAdapter } from "@better-auth/prisma-adapter";
import { admin } from "better-auth/plugins";
import { centralDb } from "@mistro/db/central";
import { config } from "./config.js";

const trustedOrigins = [config.frontendOrigin];
if (process.env.NODE_ENV === "development") {
  const localOrigin = new URL(config.frontendOrigin);
  if (localOrigin.hostname === "localhost" || localOrigin.hostname === "127.0.0.1") {
    localOrigin.hostname = localOrigin.hostname === "localhost" ? "127.0.0.1" : "localhost";
    trustedOrigins.push(localOrigin.origin);
  }
}

export const auth = betterAuth({
  database: prismaAdapter(centralDb, { provider: "postgresql" }),
  baseURL: config.authUrl,
  secret: config.authSecret,
  trustedOrigins,
  emailAndPassword: { enabled: true, disableSignUp: true, minPasswordLength: 12 },
  plugins: [admin()],
  rateLimit: { enabled: true, window: 60, max: 60 },
});
