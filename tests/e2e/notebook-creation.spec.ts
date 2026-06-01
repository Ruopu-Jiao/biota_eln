import { expect, test } from "@playwright/test";

test("demo mode can create a protocol and build a document-style entry", async ({
  page,
}) => {
  const nonce = Date.now();
  const protocolTitle = `Demo protocol ${nonce}`;
  const entryTitle = `Demo entry ${nonce}`;

  await page.goto("/api/demo-login");
  await expect(page).toHaveURL(/\/entries(\/.+)?$/);

  await page.goto("/protocols");
  await page.getByLabel("Title").fill(protocolTitle);
  await page.getByLabel("Summary").fill("Reusable protocol created in e2e.");
  await page
    .getByLabel("Steps")
    .fill("1. Add reagents.\n2. Mix gently.\n3. Incubate.");
  await page.getByRole("button", { name: "Create protocol draft" }).click();

  await expect(page.locator("body")).toContainText(protocolTitle);

  await page.goto("/entries/new");

  await expect(page).toHaveURL(/\/entries\/.+/);
  await page.getByLabel("Entry title").fill(entryTitle);
  const insertTableButton = page.getByRole("button", { name: "Insert table" });
  const firstTableCell = page.getByLabel("Table 1 row 1 column 1");
  await insertTableButton.click();
  await expect(firstTableCell).toBeVisible();
  await firstTableCell.fill("3");
  await page.getByLabel("Table 1 row 1 column 2").fill("4");
  await page.getByLabel("Table 1 row 2 column 1").fill("=SUM(A1:B1)   ");
  await page.getByLabel("Table 1 row 2 column 2").fill("=ROUND(A1/B1, 1)");
  await page.getByLabel("Entry title").click();
  await expect(page.getByLabel("Table 1 row 2 column 1")).toHaveValue("7");
  await expect(page.getByLabel("Table 1 row 2 column 2")).toHaveValue("0.8");
  await expect(page.locator("body")).toContainText("=SUM(A1:B1)");
  await expect(page.locator("body")).toContainText("=ROUND(A1/B1, 1)");
  await page.getByRole("button", { name: "Save entry version" }).click();

  await expect(page.locator("body")).toContainText("v2");
  await expect(page.locator("body")).toContainText(entryTitle);

  await page.reload();
  await expect(page.getByLabel("Entry title")).toHaveValue(entryTitle);
  await expect(page.getByLabel("Table 1 row 2 column 1")).toHaveValue("7");
  await expect(page.getByLabel("Table 1 row 2 column 2")).toHaveValue("0.8");
});
