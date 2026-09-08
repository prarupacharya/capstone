import { expect, test } from "@playwright/test";

test("renders the application shell and reports the configured backend health", async ({ page }) => {
  let healthRequestUrl = "";
  await page.route("**/health", async (route) => {
    healthRequestUrl = route.request().url();
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ status: "up", backend: "up", database: "up" })
    });
  });

  await page.goto("/");

  await expect(page.getByRole("heading", { name: "LF-Chat", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Create your account" })).toBeVisible();
  await expect(page.getByRole("status")).toHaveText("Backend connected.");
  expect(healthRequestUrl).toBe("http://localhost:3000/health");
});
