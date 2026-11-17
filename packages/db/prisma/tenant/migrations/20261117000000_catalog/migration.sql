CREATE TABLE "catalog_categories" (
  "id" UUID NOT NULL,
  "name" VARCHAR(120) NOT NULL,
  "position" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "catalog_categories_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "catalog_categories_name_key" ON "catalog_categories"("name");

CREATE TABLE "catalog_products" (
  "id" UUID NOT NULL,
  "name" VARCHAR(120) NOT NULL,
  "category_id" UUID NOT NULL,
  "description" VARCHAR(2000) NOT NULL DEFAULT '',
  "price" INTEGER NOT NULL,
  "image" VARCHAR(2048) NOT NULL DEFAULT '',
  "available" BOOLEAN NOT NULL DEFAULT true,
  "online_visible" BOOLEAN NOT NULL DEFAULT true,
  "position" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "catalog_products_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "catalog_products_price_nonnegative" CHECK ("price" >= 0),
  CONSTRAINT "catalog_products_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "catalog_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "catalog_products_category_id_position_idx" ON "catalog_products"("category_id", "position");
