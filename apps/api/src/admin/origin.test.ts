import { strict as assert } from "node:assert";
import { test } from "node:test";
import { isTrustedAdminOrigin } from "./origin.js";

test("las operaciones administrativas solo aceptan el origen configurado", () => {
  assert.equal(isTrustedAdminOrigin("https://mistro.example", "https://mistro.example", false), true);
  for (const origin of [undefined, "null", "https://mistro.example.attacker.test", "http://mistro.example"]) {
    assert.equal(isTrustedAdminOrigin(origin, "https://mistro.example", false), false);
  }
  assert.equal(isTrustedAdminOrigin("http://127.0.0.1:5174", "http://localhost:5174", true), true);
  assert.equal(isTrustedAdminOrigin("http://127.0.0.1:5175", "http://localhost:5174", true), false);
  assert.equal(isTrustedAdminOrigin("http://127.0.0.1:5174", "http://localhost:5174", false), false);
});
