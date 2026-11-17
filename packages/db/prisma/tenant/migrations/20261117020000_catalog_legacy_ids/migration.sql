-- El rango automático queda por encima de los IDs temporales basados en Date.now().
CREATE SEQUENCE "catalog_product_legacy_id_seq" AS BIGINT START 1000000000000000 MAXVALUE 9007199254740991;
ALTER TABLE "catalog_products" ADD COLUMN "legacy_id" BIGINT NOT NULL DEFAULT nextval('catalog_product_legacy_id_seq');
ALTER SEQUENCE "catalog_product_legacy_id_seq" OWNED BY "catalog_products"."legacy_id";
ALTER TABLE "catalog_products" ADD CONSTRAINT "catalog_products_legacy_id_check" CHECK ("legacy_id" > 0 AND "legacy_id" <= 9007199254740991);
CREATE UNIQUE INDEX "catalog_products_legacy_id_key" ON "catalog_products"("legacy_id");
