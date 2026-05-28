import { expect, test } from "@playwright/test";

test("auth validation and cookie monitoring", async ({ page }) => {
  await page.goto("/login");

  await page.getByRole("button", { name: "Login" }).click();
  await expect(page.getByText("Email is required.")).toBeVisible();
  await expect(page.getByText("Password is required.")).toBeVisible();

  await page.getByLabel("Email").fill("user@example.com");
  await page.getByLabel("Password").fill("password123");
  await page.getByRole("button", { name: "Login" }).click();
  await expect(
    page.getByText("Form is valid. Authentication backend is not part of this assignment."),
  ).toBeVisible();

  await page.goto("/register");
  await page.getByLabel("Username").fill("artistUser");
  await page.getByLabel("Email").fill("artist@example.com");
  await page.getByLabel(/^Password$/).fill("password123");
  await page.getByLabel(/^Confirm Password$/).fill("mismatch");
  await page.getByRole("button", { name: "Register" }).click();
  await expect(page.getByText("Passwords do not match.")).toBeVisible();

  await page.getByLabel(/^Confirm Password$/).fill("password123");
  await page.getByRole("button", { name: "Register" }).click();
  await expect(
    page.getByText("Registration data is valid. Authentication backend is not part of this assignment."),
  ).toBeVisible();

  await page.goto("/gallery");
  await page.getByRole("button", { name: /Show Filters/i }).click();
  await page.getByPlaceholder("Title, artist, category...").fill("Sarah");
  await page.getByRole("button", { name: "Apply Filters" }).click();

  const cookies = await page.context().cookies();
  const activityCookie = cookies.find((cookie) => cookie.name === "artspace_activity");
  const preferencesCookie = cookies.find((cookie) => cookie.name === "artspace_preferences");

  expect(activityCookie).toBeTruthy();
  expect(preferencesCookie).toBeTruthy();

  const activity = JSON.parse(decodeURIComponent(activityCookie?.value ?? "{}")) as {
    routeVisits?: Record<string, number>;
    actions?: Record<string, number>;
  };
  const preferences = JSON.parse(decodeURIComponent(preferencesCookie?.value ?? "{}")) as {
    gallerySearchTerm?: string;
  };

  expect(activity.routeVisits?.["/gallery"]).toBeGreaterThan(0);
  expect(activity.actions?.login_attempt).toBeGreaterThan(0);
  expect(activity.actions?.register_attempt).toBeGreaterThan(0);
  expect(activity.actions?.gallery_search_applied).toBeGreaterThan(0);
  expect(preferences.gallerySearchTerm).toBe("Sarah");
});
