import { expect, test } from "@playwright/test";

test("create, edit, and delete artwork", async ({ page }) => {
  await page.goto("/add-artwork");

  await page.getByLabel("Title").fill("Playwright Sunset");
  await page.getByLabel("Artist").fill("E2E Artist");
  await page.getByLabel("Year").fill("2026");
  await page.getByLabel("Price").fill("5500");
  await page.getByLabel("Category").fill("Impressionist");
  await page
    .getByLabel("Description")
    .fill("A sufficiently descriptive artwork text used for Playwright CRUD scenario.");
  await page.getByLabel("Artwork Image URL").fill("https://example.com/playwright-sunset.jpg");
  await page.getByRole("button", { name: "Save Artwork" }).click();

  await expect(page.getByRole("heading", { name: "Playwright Sunset" })).toBeVisible();

  await page.getByRole("link", { name: "Edit Artwork" }).click();
  await page.getByLabel("Title").fill("Playwright Sunset Updated");
  await page.getByRole("button", { name: "Save Changes" }).click();

  await expect(page.getByRole("heading", { name: "Playwright Sunset Updated" })).toBeVisible();

  await page.getByRole("button", { name: "Delete" }).click();
  await expect(page.getByRole("heading", { name: "Delete Artwork" })).toBeVisible();
  await page.getByRole("button", { name: "Delete Permanently" }).click();

  await expect(page).toHaveURL(/\/gallery$/);
  await expect(page.getByText("Playwright Sunset Updated")).toHaveCount(0);
});
