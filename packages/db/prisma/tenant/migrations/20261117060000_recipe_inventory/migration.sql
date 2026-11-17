CREATE TABLE inventory_ingredients (
  id UUID PRIMARY KEY,
  name VARCHAR(80) NOT NULL UNIQUE,
  unit VARCHAR(10) NOT NULL CHECK (unit IN ('unidad', 'kg', 'g', 'l', 'ml')),
  quantity DECIMAL(18,6) NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  minimum DECIMAL(18,6) NOT NULL DEFAULT 0 CHECK (minimum >= 0),
  version INTEGER NOT NULL DEFAULT 0 CHECK (version >= 0)
);
CREATE TABLE inventory_recipes (
  id UUID PRIMARY KEY,
  name VARCHAR(80) NOT NULL,
  product_id UUID NOT NULL UNIQUE REFERENCES catalog_products(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  version INTEGER NOT NULL DEFAULT 0 CHECK (version >= 0)
);
CREATE TABLE inventory_recipe_lines (
  recipe_id UUID NOT NULL REFERENCES inventory_recipes(id) ON DELETE CASCADE ON UPDATE CASCADE,
  ingredient_id UUID NOT NULL REFERENCES inventory_ingredients(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  quantity DECIMAL(18,6) NOT NULL CHECK (quantity > 0),
  unit VARCHAR(10) NOT NULL CHECK (unit IN ('unidad', 'kg', 'g', 'l', 'ml')),
  PRIMARY KEY (recipe_id, ingredient_id)
);
