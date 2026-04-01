import { expect, test } from "@playwright/test";

test("demo mode can open the workspace without a database", async ({ page }) => {
  await page.goto("/sign-in?demo=1");

  await page.getByRole("link", { name: "Continue with demo workspace" }).click();

  await expect(page).toHaveURL("/");
  await expect(page.locator("body")).toContainText(/Demo workspace/i);
  await expect(page.locator("body")).toContainText(/Demo Researcher/i);
});
