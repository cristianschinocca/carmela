import { createAuthClient } from "better-auth/react";
import { adminClient } from "better-auth/client/plugins";

export const authClient = createAuthClient({ plugins: [adminClient()] });

export type SessionUser = { id: string; name: string; email: string; role?: string | null };

export const isSuperadmin = (user: SessionUser | null) =>
  user?.role?.split(",").includes("admin") ?? false;
