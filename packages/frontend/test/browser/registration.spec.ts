import { expect, test, type Page } from "@playwright/test";

async function mockHealth(page: Page) {
  await page.route("**/health", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ status: "up", backend: "up", database: "up" })
    });
  });
}

test("registers a user and clears the password after success", async ({ page }) => {
  await mockHealth(page);
  let requestCount = 0;
  await page.route("**/auth/register", async (route) => {
    requestCount += 1;
    expect(JSON.parse(route.request().postData() ?? "{}")).toEqual({
      email: "new@example.com",
      password: "correct-password"
    });
    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({
        id: "user-123",
        email: "new@example.com",
        username: null,
        createdDateTime: "2026-01-01T00:00:00.000Z",
        userType: "generaluser"
      })
    });
  });

  await page.goto("/");
  await page.getByLabel("Email").fill("new@example.com");
  await page.getByLabel("Password").fill("correct-password");
  await page.getByRole("button", { name: "Create account" }).click();

  await expect(page.getByText("Account created for new@example.com.")).toBeVisible();
  await expect(page.getByLabel("Password")).toHaveValue("");
  expect(requestCount).toBe(1);
});

test("shows duplicate-email feedback and clears the password after failure", async ({ page }) => {
  await mockHealth(page);
  await page.route("**/auth/register", async (route) => {
    await route.fulfill({
      status: 400,
      contentType: "application/json",
      body: JSON.stringify({ message: ["email is already registered"] })
    });
  });

  await page.goto("/");
  await page.getByLabel("Email").fill("used@example.com");
  await page.getByLabel("Password").fill("correct-password");
  await page.getByRole("button", { name: "Create account" }).click();

  await expect(page.getByRole("alert")).toHaveText("email is already registered");
  await expect(page.getByLabel("Password")).toHaveValue("");
  await expect(page.getByRole("alert")).not.toContainText("correct-password");
});
