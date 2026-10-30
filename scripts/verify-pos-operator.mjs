import { chromium } from "@playwright/test";

const base = process.env.BASE_URL || "http://127.0.0.1:5198";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });

try {
  await page.goto(base);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByRole("button", { name: "Punto de venta", exact: true }).click();

  // A free table asks who will work on it, but leaving without a command is immediate.
  await page.locator('.floor-sector[data-sector-id="salon"]').getByRole("button", { name: /^Abrir Mesa 1,/ }).click();
  await page.getByRole("button", { name: "Trabajar como Tomás Vega" }).click();
  await page.keyboard.press("Escape");
  await page.getByRole("dialog", { name: "¿Quién va a gestionar esta mesa?" }).waitFor();
  await page.keyboard.press("Escape");
  await page.getByRole("dialog", { name: /Cuenta de Mesa 1/ }).waitFor({ state: "detached" });
  await page.waitForFunction(() => !document.querySelector(".modal-scrim.account-scrim"));
  if (await page.getByRole("dialog", { name: /Código de/ }).count()) {
    throw new Error("A table without a command requested a PIN on exit");
  }

  // The first commanded product assigns the table to the selected employee.
  await page.locator('.floor-sector[data-sector-id="salon"]').getByRole("button", { name: /^Abrir Mesa 1,/ }).click();
  await page.getByRole("button", { name: "Trabajar como Tomás Vega" }).click();
  await page.locator(".covers-modal").getByRole("button", { name: "Abrir mesa", exact: true }).click();
  await page.getByRole("button", { name: "Agregar Flat white", exact: true }).click();
  await page.keyboard.press("Escape");
  await page.getByRole("dialog", { name: "Código de Tomás Vega" }).waitFor();
  await page.getByRole("textbox", { name: "Código de Tomás Vega" }).fill("2468");
  await page.getByRole("button", { name: /Confirmar y salir/ }).click();
  await page.getByRole("dialog", { name: /Cuenta de Mesa 1/ }).waitFor({ state: "detached" });

  const assignedOperator = await page.evaluate(() => {
    const tables = JSON.parse(localStorage.getItem("carmela.pos.floor.v2") || "[]");
    return tables.find((table) => table.id === "table-1")?.operatorId;
  });
  if (assignedOperator !== 2) throw new Error("The command was not assigned to Tomás Vega");

  // Assignment survives reload and protects entry, not exit.
  await page.reload();
  await page.getByRole("button", { name: "Punto de venta", exact: true }).click();
  await page.locator('.floor-sector[data-sector-id="salon"]').getByRole("button", { name: /^Abrir Mesa 1,/ }).click();
  const pinDialog = page.getByRole("dialog", { name: "Código de Tomás Vega" });
  await pinDialog.waitFor();
  if (await page.getByRole("dialog", { name: /Cuenta de Mesa 1/ }).count()) {
    throw new Error("The commanded table opened before PIN verification");
  }

  await page.getByRole("textbox", { name: "Código de Tomás Vega" }).fill("0000");
  await page.getByRole("button", { name: /Verificar y entrar/ }).click();
  await page.getByText("El código no corresponde al empleado seleccionado.").waitFor();
  await page.getByRole("textbox", { name: "Código de Tomás Vega" }).fill("2468");
  await page.getByRole("button", { name: /Verificar y entrar/ }).click();
  await page.getByRole("dialog", { name: /Cuenta de Mesa 1/ }).waitFor();

  // Legacy occupied tables without an owner must also be protected before entry.
  await page.keyboard.press("Escape");
  await page.evaluate(() => {
    const key = "carmela.pos.floor.v2";
    const tables = JSON.parse(localStorage.getItem(key) || "[]");
    const table = tables.find((item) => item.id === "table-1");
    delete table.operatorId;
    localStorage.setItem(key, JSON.stringify(tables));
  });
  await page.reload();
  await page.getByRole("button", { name: "Punto de venta", exact: true }).click();
  await page.locator('.floor-sector[data-sector-id="salon"]').getByRole("button", { name: /^Abrir Mesa 1,/ }).click();
  await page.getByRole("button", { name: "Trabajar como Camila López" }).click();
  await page.getByRole("dialog", { name: "Código de Camila López" }).waitFor();
  if (await page.getByRole("dialog", { name: /Cuenta de Mesa 1/ }).count()) {
    throw new Error("An ownerless occupied table opened before PIN verification");
  }
  await page.getByRole("textbox", { name: "Código de Camila López" }).fill("4829");
  await page.getByRole("button", { name: /Verificar y entrar/ }).click();
  await page.getByRole("dialog", { name: /Cuenta de Mesa 1/ }).waitFor();

  await page.screenshot({ path: "artifacts/pos-commanded-table-access.png", fullPage: true });
  console.log("PASS: first command requires PIN on exit; assigned and ownerless occupied tables require PIN before entry.");
} finally {
  await browser.close();
}
