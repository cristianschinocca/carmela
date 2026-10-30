import { chromium } from "@playwright/test";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const base = process.env.BASE_URL || "http://127.0.0.1:5198";

try {
  await page.goto(base);
  await page.getByRole("button", { name: "Equipo", exact: true }).click();
  await page.locator(".team-page").waitFor();
  await page.evaluate(() => document.documentElement.setAttribute("data-theme", "dark"));
  await page.waitForTimeout(300);
  await page.screenshot({ path: "artifacts/team-desktop.png", fullPage: true });

  await page.getByRole("button", { name: "Nueva persona" }).click();
  const dialog = page.getByRole("dialog", { name: "Nueva persona" });
  await dialog.getByLabel("Nombre completo").fill("Prueba Sueldo");
  await dialog.getByLabel("Código de fichaje").fill("9876");
  await page.screenshot({ path: "artifacts/team-access-editor.png" });
  await dialog.getByRole("button", { name: "Pago y jornada" }).click();
  await dialog.getByRole("button", { name: "Configurar" }).click();
  await dialog.getByRole("button", { name: "Crear usuario" }).click();
  await dialog.getByText("Completá una tarifa mayor a cero").waitFor();
  if ((await dialog.getByRole("button", { name: "Pago y jornada" }).getAttribute("aria-pressed")) !== "true") throw new Error("Pay validation did not keep the correct section open");
  await dialog.getByLabel("Importe ($)").fill("1000");
  if (await dialog.locator(".form-error").count()) throw new Error("Validation error did not clear after correction");

  const now = new Date();
  let days = 0;
  let tuesdays = 0;
  for (let day = 1; day <= new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate(); day++) {
    const weekday = new Date(now.getFullYear(), now.getMonth(), day).getDay();
    if ([1, 2, 3, 4, 5].includes(weekday)) days++;
    if (weekday === 2) tuesdays++;
  }
  await dialog.getByLabel("Entrada Mar").fill("10:00");
  await dialog.getByLabel("Salida Mar").fill("14:00");
  const expected = `$ ${new Intl.NumberFormat("es-AR").format((days * 8 - tuesdays * 4) * 1000)}`;
  if ((await dialog.locator(".team-pay-head-estimate strong").innerText()) !== expected) {
    throw new Error(`Expected monthly estimate ${expected}`);
  }
  await page.screenshot({ path: "artifacts/team-pay-editor.png" });
  await dialog.getByRole("button", { name: "Crear usuario" }).click();
  await page.getByText("Prueba Sueldo").waitFor();
  await page.reload();
  await page.getByRole("button", { name: "Equipo", exact: true }).click();
  await page.getByText("Prueba Sueldo").waitFor();
  if (!(await page.locator(".team-list").innerText()).includes(expected)) throw new Error("Monthly estimate did not persist");

  await page.getByRole("button", { name: "Editar Prueba Sueldo" }).click();
  const editDialog = page.getByRole("dialog", { name: "Editar persona" });
  await editDialog.getByRole("button", { name: "Pago y jornada" }).click();
  if (await editDialog.getByLabel("Entrada Mar").inputValue() !== "10:00") throw new Error("Tuesday start time did not persist");
  if (await editDialog.getByLabel("Salida Mar").inputValue() !== "14:00") throw new Error("Tuesday end time did not persist");
  await editDialog.getByLabel("Tipo de pago").selectOption("day");
  await editDialog.getByLabel("Importe ($)").fill("20000");
  const dailyExpected = `$ ${new Intl.NumberFormat("es-AR").format(days * 20000)}`;
  if ((await editDialog.locator(".team-pay-head-estimate strong").innerText()) !== dailyExpected) throw new Error("Daily pay estimate is incorrect");
  await editDialog.getByRole("button", { name: "Guardar cambios" }).click();
  if (!(await page.locator(".team-list").innerText()).includes(dailyExpected)) throw new Error("Updated daily rate was not saved");

  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(250);
  if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)) throw new Error("Team page overflows mobile width");
  await page.screenshot({ path: "artifacts/team-mobile.png", fullPage: true });
  await page.getByRole("button", { name: "Editar Prueba Sueldo" }).click();
  const mobileDialog = page.getByRole("dialog", { name: "Editar persona" });
  await mobileDialog.getByRole("button", { name: "Pago y jornada" }).click();
  await page.screenshot({ path: "artifacts/team-pay-editor-mobile.png" });
  await mobileDialog.getByRole("button", { name: "Guardar cambios" }).click();
  await page.evaluate(() => {
    const team = JSON.parse(localStorage.getItem("carmela.team.v1"));
    const member = team.find((item) => item.name === "Prueba Sueldo");
    member.pay = { basis: "hour", rate: 1000, days: [1, 2], start: "09:00", end: "15:00" };
    localStorage.setItem("carmela.team.v1", JSON.stringify(team));
  });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.reload();
  await page.getByRole("button", { name: "Equipo", exact: true }).click();
  await page.getByRole("button", { name: "Editar Prueba Sueldo" }).click();
  const migratedDialog = page.getByRole("dialog", { name: "Editar persona" });
  await migratedDialog.getByRole("button", { name: "Pago y jornada" }).click();
  if (await migratedDialog.getByLabel("Entrada Lun").inputValue() !== "09:00") throw new Error("Legacy schedule was not migrated");
  if (await migratedDialog.getByLabel("Salida Mar").inputValue() !== "15:00") throw new Error("Legacy schedule end was not migrated");
  console.log("PASS: per-day pay estimate, persistence, legacy migration, and responsive layout.");
} finally {
  await browser.close();
}
