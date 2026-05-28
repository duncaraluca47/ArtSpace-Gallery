import { expect, test } from "@playwright/test";

test("newly added artwork appears first in newest order", async ({ page }) => {
  await page.goto("/add-artwork");

  const title = `Newest Order ${Date.now()}`;
  await page.getByLabel("Title").fill(title);
  await page.getByLabel("Artist").fill("Order Tester");
  await page.getByLabel("Year").fill("2026");
  await page.getByLabel("Price").fill("4200");
  await page.getByLabel("Category").fill("Test");
  await page
    .getByLabel("Description")
    .fill("A description long enough to satisfy validation for newest-order testing.");
  await page.getByLabel("Artwork Image URL").fill("https://example.com/newest-order.jpg");
  await page.getByRole("button", { name: "Save Artwork" }).click();

  await expect(page.getByRole("heading", { name: title })).toBeVisible();
  await page.goto("/gallery");

  await expect(page.locator("article").first()).toContainText(title);
});
