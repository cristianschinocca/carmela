import { chromium } from "@playwright/test";

const base = process.env.BASE_URL || "http://127.0.0.1:5198";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });

try {
  await page.goto(base);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByRole("button", { name: "Productos", exact: true }).click();

  await page.getByRole("button", { name: "Filtrar por categoría: Todas las categorías" }).click();
  await page.screenshot({ path: "artifacts/product-category-dropdown.png", fullPage: true });
  await page.getByRole("option", { name: "Panadería" }).click();
  if (await page.locator(".manager-row").count() !== 2) {
    throw new Error("Category filter did not show the two bakery products");
  }
  await page.screenshot({ path: "artifacts/product-category-filter.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(300);
  if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)) {
    throw new Error("Product category filter has horizontal overflow on mobile");
  }
  await page.screenshot({ path: "artifacts/product-category-filter-mobile.png", fullPage: true });
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.getByRole("button", { name: "Filtrar por categoría: Panadería" }).click();
  await page.getByRole("option", { name: "Todas las categorías" }).click();

  const onlineSwitch = page.getByRole("switch", { name: "Ocultar Flat white en el menú digital" });
  await onlineSwitch.waitFor();
  await page.screenshot({ path: "artifacts/product-online-switch.png", fullPage: true });
  await onlineSwitch.click();
  await page.getByRole("switch", { name: "Publicar Flat white en el menú digital" }).waitFor();

  await page.reload();
  await page.getByRole("button", { name: "Productos", exact: true }).click();
  await page.getByRole("switch", { name: "Publicar Flat white en el menú digital" }).waitFor();

  await page.getByRole("button", { name: "Punto de venta", exact: true }).click();
  await page.getByRole("button", { name: "Abrir Mesa 1", exact: true }).click();
  await page.getByRole("button", { name: "Trabajar como Camila López" }).click();
  await page.getByRole("button", { name: "Agregar Flat white", exact: true }).waitFor();
  await page.getByRole("button", { name: "Cerrar cuenta" }).click();

  await page.getByRole("button", { name: "Menú digital", exact: true }).click();
  const menuPopup = page.waitForEvent("popup");
  await page.getByRole("button", { name: "Ver menú público" }).click();
  const menuPage = await menuPopup;
  await menuPage.locator(".public-menu").waitFor();
  if (!menuPage.url().endsWith("#menu")) {
    throw new Error("Public menu did not open in the expected tab URL");
  }
  if (await page.locator(".public-menu").count()) {
    throw new Error("Dashboard was replaced instead of staying open");
  }
  if (await menuPage.getByRole("button", { name: /Flat white/ }).count()) {
    throw new Error("Hidden product is still visible in the public menu");
  }
  await menuPage.close();

  console.log("PASS: online visibility persists, hides from public menu, and keeps the product in POS.");
} finally {
  await browser.close();
}
