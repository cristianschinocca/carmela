import { strict as assert } from "node:assert";
import { test } from "node:test";
process.env.CONTROL_DATABASE_URL ??= "postgresql://test:test@localhost:5432/test";
process.env.BETTER_AUTH_URL ??= "http://localhost:3001";
process.env.BETTER_AUTH_SECRET ??= "a-test-secret-with-more-than-32-characters";
process.env.FRONTEND_ORIGIN ??= "http://localhost:5174";
process.env.EMPLOYEE_PIN_PEPPER ??= "a-distinct-test-pepper-with-more-than-32-characters";
const { parseEmployee, hashPin, pinLookup } = await import("./employee.js");
test("valida PIN, rol y horarios sin turnos repetidos", () => {
  const input = { name: "Ana Pérez", role: "Mozo", active: true, pin: "1234", pay: { basis: "hour", rate: 2000, schedule: [{ day: 1, start: "08:00", end: "16:00" }] } };
  assert.ok(parseEmployee(input, true));
  assert.equal(parseEmployee({ ...input, pin: "123" }, true), null);
  assert.equal(parseEmployee({ ...input, role: "admin" }, true), null);
  assert.equal(parseEmployee({ ...input, pay: { ...input.pay, schedule: [...input.pay.schedule, ...input.pay.schedule] } }, true), null);
  assert.ok(parseEmployee({ ...input, pin: undefined }, false));
});
test("no guarda el código en claro y separa cafeterías", async () => {
  const first = await hashPin("1234"), second = await hashPin("1234");
  assert.notEqual(first, second);
  assert.match(first, /^scrypt:[0-9a-f]{32}:[0-9a-f]{128}$/);
  assert.notEqual(pinLookup("1234", "a"), pinLookup("1234", "b"));
});
