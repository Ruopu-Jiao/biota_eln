import { expect, test } from "@playwright/test";

test("home page loads", async ({ page }) => {
  await page.goto("/");

  await expect(page).toHaveURL("/");
  await expect(page).toHaveTitle(/Create Next App|Biota|ELN/i);
  await expect(page.locator("body")).toContainText(
    /Create Next App|Biota|Entries|Entities|Protocols|Graph|Settings/i
  );
});
