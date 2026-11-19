CREATE TABLE "offline_terminal" (
  "id" TEXT PRIMARY KEY DEFAULT 'terminal',
  "device_id" UUID NOT NULL,
  "token_hash" CHAR(64) NOT NULL,
  "registered_by" VARCHAR(120) NOT NULL,
  "registered_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "offline_terminal_singleton" CHECK ("id" = 'terminal')
);
