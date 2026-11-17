CREATE TABLE "floor_sectors" (
  "id" UUID NOT NULL PRIMARY KEY,
  "name" VARCHAR(120) NOT NULL,
  "position" INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE "dining_tables" (
  "id" UUID NOT NULL PRIMARY KEY,
  "sector_id" UUID NOT NULL REFERENCES "floor_sectors"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "number" INTEGER NOT NULL CHECK ("number" > 0),
  "guests" INTEGER NOT NULL DEFAULT 0 CHECK ("guests" >= 0),
  "bill_requested" BOOLEAN NOT NULL DEFAULT false,
  "version" INTEGER NOT NULL DEFAULT 0 CHECK ("version" >= 0)
);
CREATE UNIQUE INDEX "dining_tables_sector_id_number_key" ON "dining_tables" ("sector_id", "number");
CREATE TABLE "dining_table_items" (
  "id" UUID NOT NULL PRIMARY KEY,
  "table_id" UUID NOT NULL REFERENCES "dining_tables"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "product_id" UUID NOT NULL REFERENCES "catalog_products"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "quantity" INTEGER NOT NULL CHECK ("quantity" > 0),
  "unit_price" INTEGER NOT NULL CHECK ("unit_price" >= 0),
  "unit_discount" INTEGER NOT NULL DEFAULT 0 CHECK ("unit_discount" >= 0 AND "unit_discount" <= "unit_price"),
  "note" VARCHAR(500) NOT NULL DEFAULT ''
);
CREATE INDEX "dining_table_items_table_id_idx" ON "dining_table_items" ("table_id");
