import { test, expect } from "@playwright/test";

test("infinite scroll loads next page", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Browse Gallery" }).click();

  await expect(page).toHaveURL(/\/gallery$/);
  const initialCards = await page.locator("article").count();

  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));

  await page.waitForFunction((previous) => document.querySelectorAll("article").length > previous, initialCards);
});
