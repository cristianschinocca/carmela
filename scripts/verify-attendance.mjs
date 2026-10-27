import { chromium } from "@playwright/test";

const base = process.env.BASE_URL || "http://127.0.0.1:5198";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });

try {
  await page.goto(base);
  await page.getByRole("button", { name: "Fichaje", exact: true }).click();
  await page.locator(".attendance-page").waitFor();
  await page.screenshot({ path: "artifacts/attendance-page.png", fullPage: true });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(350);
  if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)) {
    throw new Error("Attendance page has horizontal overflow on mobile");
  }
  await page.screenshot({ path: "artifacts/attendance-page-mobile.png", fullPage: true });

  await page.getByRole("button", { name: "Abrir fichaje", exact: true }).click();
  await page.keyboard.type("4829");
  await page.keyboard.press("Enter");
  await page.getByRole("heading", { name: /Salida|Entrada/ }).waitFor();
  console.log("PASS: standalone attendance page is responsive and supports keyboard clock-in.");
} finally {
  await browser.close();
}
