import { betterAuth } from "better-auth";
import { prismaAdapter } from "@better-auth/prisma-adapter";
import { admin } from "better-auth/plugins";
import { centralDb } from "@carmela/db/central";
import { config } from "./config.js";

export const auth = betterAuth({
  database: prismaAdapter(centralDb, { provider: "postgresql" }),
  baseURL: config.authUrl,
  secret: config.authSecret,
  trustedOrigins: [config.frontendOrigin],
  emailAndPassword: { enabled: true, disableSignUp: true },
  plugins: [admin()],
  rateLimit: { enabled: true, window: 60, max: 60 },
});
