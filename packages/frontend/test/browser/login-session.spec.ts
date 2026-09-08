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

test("logs in, persists only the token in the tab, and logs out", async ({ page }) => {
  await mockHealth(page);
  const accessToken = "header.payload.signature";
  await page.route("**/auth/login", async (route) => {
    expect(JSON.parse(route.request().postData() ?? "{}")).toEqual({
      email: "user@example.com",
      password: "correct-password"
    });
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ accessToken })
    });
  });

  await page.goto("/");
  await page.getByRole("button", { name: "Log in", exact: true }).first().click();
  await page.getByLabel("Email").fill("user@example.com");
  await page.getByLabel("Password").fill("correct-password");
  await page.getByRole("form", { name: "Log in" }).getByRole("button", { name: "Log in" }).click();

  await expect(page.getByRole("heading", { name: "You're signed in" })).toBeVisible();
  await expect.poll(() => page.evaluate(() => Object.keys(sessionStorage))).toEqual(["capstone.accessToken"]);
  expect(await page.evaluate(() => sessionStorage.getItem("capstone.accessToken"))).toBe(accessToken);

  await page.reload();
  await expect(page.getByRole("heading", { name: "You're signed in" })).toBeVisible();

  await page.evaluate(() => localStorage.setItem("capstone.accessToken", "legacy-token"));
  await page.getByRole("button", { name: "Log out" }).click();
  await expect(page.getByRole("button", { name: "Log in", exact: true }).first()).toBeVisible();
  expect(await page.evaluate(() => sessionStorage.length)).toBe(0);
  expect(await page.evaluate(() => localStorage.getItem("capstone.accessToken"))).toBeNull();
});

test("shows generic login failure, clears the password, and stores no session", async ({ page }) => {
  await mockHealth(page);
  await page.route("**/auth/login", async (route) => {
    await route.fulfill({
      status: 401,
      contentType: "application/json",
      body: JSON.stringify({ message: "invalid email or password" })
    });
  });

  await page.goto("/");
  await page.getByRole("button", { name: "Log in", exact: true }).first().click();
  await page.getByLabel("Email").fill("user@example.com");
  await page.getByLabel("Password").fill("wrong-password");
  await page.getByRole("form", { name: "Log in" }).getByRole("button", { name: "Log in" }).click();

  await expect(page.getByRole("alert")).toHaveText("invalid email or password");
  await expect(page.getByLabel("Password")).toHaveValue("");
  await expect(page.getByRole("alert")).not.toContainText("wrong-password");
  expect(await page.evaluate(() => sessionStorage.length)).toBe(0);
});
