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

test("sends the tab session token to protected requests exactly once", async ({ page }) => {
  const accessToken = "header.payload.signature";
  let authorization;

  await mockHealth(page);
  await page.addInitScript((token) => {
    window.sessionStorage.setItem("capstone.accessToken", token);
  }, accessToken);
  await page.route("**/auth/me", async (route) => {
    authorization = route.request().headers().authorization;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ id: "user-123", email: "user@example.com", userType: "generaluser" })
    });
  });
  await page.route("**/chatrooms", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
  });

  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Welcome to LF-Chat" })).toBeVisible();
  await expect.poll(() => authorization).toBe(`Bearer ${accessToken}`);
  expect(await page.evaluate(() => Object.keys(sessionStorage))).toEqual(["capstone.accessToken"]);
});

test("keeps public login requests free of session authorization", async ({ page }) => {
  let authorization;
  let requestSeen = false;

  await mockHealth(page);
  await page.addInitScript(() => {
    window.sessionStorage.setItem("capstone.accessToken", "old.header.signature");
  });
  await page.route("**/auth/login", async (route) => {
    requestSeen = true;
    authorization = route.request().headers().authorization;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ accessToken: "new.header.signature" })
    });
  });
  await page.route("**/auth/me", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
  });
  await page.route("**/chatrooms", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
  });

  await page.goto("/");
  await page.getByRole("button", { name: "Log out" }).click();
  await page.getByRole("button", { name: "Log in", exact: true }).first().click();
  await page.getByLabel("Email").fill("user@example.com");
  await page.getByLabel("Password").fill("correct-password");
  await page.getByRole("form", { name: "Log in" }).getByRole("button", { name: "Log in" }).click();

  await expect(page.getByRole("heading", { name: "Welcome to LF-Chat" })).toBeVisible();
  expect(requestSeen).toBe(true);
  expect(authorization).toBeUndefined();
});
