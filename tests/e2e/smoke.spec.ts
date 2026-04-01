import { expect, test } from "@playwright/test";

test("unauthenticated users are sent to sign-in", async ({ page }) => {
  await page.goto("/");

  await expect(page).toHaveURL("/sign-in");
  await expect(page).toHaveTitle(/Create Next App|Biota|ELN/i);
  await expect(page.locator("body")).toContainText(
    /Biota|Welcome back|Create account|Sign in/i
  );
});
