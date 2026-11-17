CREATE TABLE "product_stock" (
  "product_id" UUID NOT NULL PRIMARY KEY REFERENCES "catalog_products"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "quantity" INTEGER NOT NULL DEFAULT 0 CHECK ("quantity" >= 0),
  "minimum" INTEGER NOT NULL DEFAULT 0 CHECK ("minimum" >= 0),
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "version" INTEGER NOT NULL DEFAULT 0 CHECK ("version" >= 0)
);
CREATE TABLE "product_stock_movements" (
  "id" UUID NOT NULL PRIMARY KEY,
  "payload_hash" VARCHAR(64) NOT NULL,
  "product_id" UUID NOT NULL REFERENCES "catalog_products"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "kind" VARCHAR(16) NOT NULL CHECK ("kind" IN ('entrada', 'salida', 'ajuste')),
  "amount" INTEGER NOT NULL CHECK ("amount" >= 0),
  "balance" INTEGER NOT NULL CHECK ("balance" >= 0),
  "note" VARCHAR(500) NOT NULL DEFAULT '',
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "product_stock_movements_product_id_created_at_idx" ON "product_stock_movements" ("product_id", "created_at");
