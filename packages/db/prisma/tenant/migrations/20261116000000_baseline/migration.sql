CREATE TABLE "workspace_identity" (
    "id" TEXT NOT NULL DEFAULT 'workspace',
    "workspace_id" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "workspace_identity_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "workspace_identity_singleton" CHECK ("id" = 'workspace')
);

CREATE UNIQUE INDEX "workspace_identity_workspace_id_key" ON "workspace_identity"("workspace_id");
