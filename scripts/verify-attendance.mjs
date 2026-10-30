import { chromium } from "@playwright/test";

const base = process.env.BASE_URL || "http://127.0.0.1:5198";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });

try {
  await page.goto(base);
  await page.getByRole("button", { name: "Fichaje", exact: true }).click();
  await page.locator(".attendance-page").waitFor();
  if (await page.getByText("Actividad reciente").count()) throw new Error("Recent activity is still visible");
  await page.screenshot({ path: "artifacts/attendance-page.png", fullPage: true });
  await page.evaluate(() => document.documentElement.setAttribute("data-theme", "dark"));
  await page.waitForTimeout(350);
  await page.screenshot({ path: "artifacts/attendance-page-dark.png", fullPage: true });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(350);
  if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)) {
    throw new Error("Attendance page has horizontal overflow on mobile");
  }
  await page.screenshot({ path: "artifacts/attendance-page-mobile.png", fullPage: true });

  await page.getByRole("button", { name: "Abrir fichador", exact: true }).click();
  await page.waitForTimeout(350);
  await page.screenshot({ path: "artifacts/attendance-pin-mobile.png" });
  const before = await page.evaluate(() => JSON.parse(localStorage.getItem("carmela.clock.v1") || "[]").length);
  await page.keyboard.type("4829");
  await page.keyboard.press("Enter");
  await page.getByRole("heading", { name: /Salida|Entrada/ }).waitFor();
  await page.keyboard.press("Enter");
  const after = await page.evaluate(() => JSON.parse(localStorage.getItem("carmela.clock.v1") || "[]").length);
  if (after !== before + 1) throw new Error("A single PIN submission created multiple entries");
  console.log("PASS: compact attendance page is responsive and keyboard clock-in records once.");
} finally {
  await browser.close();
}
