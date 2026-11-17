import { strict as assert } from "node:assert";
import { test } from "node:test";
import { menuSlugBase, menuSlugWithSuffix } from "./menuSlug.js";

test("genera identificadores válidos a partir de nombres de marca", () => {
  assert.equal(menuSlugBase("Café de la Esquina"), "cafe-de-la-esquina");
  assert.equal(menuSlugBase("123 Café"), "marca-123-cafe");
  assert.equal(menuSlugBase("Admin"), "marca-admin");
  for (const name of ["!!", "é", "A".repeat(120), "東京"]) {
    assert.match(menuSlugBase(name), /^[a-z][a-z0-9-]{1,46}[a-z0-9]$/);
  }
  assert.match(menuSlugWithSuffix("a".repeat(48)), /^[a-z][a-z0-9-]{1,46}[a-z0-9]$/);
});
