CREATE TABLE "catalog_imports" (
  "key" UUID NOT NULL,
  "payload_hash" VARCHAR(64) NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "catalog_imports_pkey" PRIMARY KEY ("key")
);
