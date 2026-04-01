import { expect, test } from "@playwright/test";

test("demo mode can create a protocol and build a document-style entry", async ({
  page,
}) => {
  const nonce = Date.now();
  const protocolTitle = `Demo protocol ${nonce}`;
  const entryTitle = `Demo entry ${nonce}`;

  await page.goto("/api/demo-login");
  await expect(page).toHaveURL("/");

  await page.goto("/protocols");
  await page.getByLabel("Title").fill(protocolTitle);
  await page.getByLabel("Summary").fill("Reusable protocol created in e2e.");
  await page
    .getByLabel("Steps")
    .fill("1. Add reagents.\n2. Mix gently.\n3. Incubate.");
  await page.getByRole("button", { name: "Create protocol draft" }).click();

  await expect(page.locator("body")).toContainText(protocolTitle);

  await page.goto("/entries");
  await page.getByRole("button", { name: "Create new entry" }).click();

  await expect(page).toHaveURL(/\/entries\/.+/);
  await page.getByLabel("Entry title").fill(entryTitle);
  await page.getByRole("button", { name: "Save entry version" }).click();

  await expect(page.locator("body")).toContainText("v2");
  await expect(page.locator("body")).toContainText(entryTitle);

  await page.reload();
  await expect(page.getByLabel("Entry title")).toHaveValue(entryTitle);
});
