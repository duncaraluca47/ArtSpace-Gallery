import { expect, test } from "@playwright/test";

test("landing to gallery and search filter", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "ArtSpace Gallery" })).toBeVisible();
  await page.getByRole("link", { name: "Browse Gallery" }).click();

  await expect(page).toHaveURL(/\/gallery$/);
  const initialCards = await page.locator("article").count();
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForFunction((previous) => document.querySelectorAll("article").length > previous, initialCards);

  await page.getByRole("button", { name: /Show Filters/i }).click();
  await page.getByPlaceholder("Title, artist, category...").fill("Watercolor");
  await page.getByRole("button", { name: "Apply Filters" }).click();

  await expect(page.getByText("Watercolor Dreams")).toBeVisible();
  await expect(page.getByText("Abstract Emotions")).toHaveCount(0);
});
