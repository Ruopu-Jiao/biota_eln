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
  const autosaveStatus = page.getByRole("status", {
    name: "Autosave status",
  });
  await page.getByLabel("Entry title").fill(entryTitle);
  await page.getByRole("button", { name: "Insert" }).click();
  await page.getByRole("menuitem", { name: "Table" }).click();
  const firstTableCell = page.getByLabel("Table 1 row 1 column 1");
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

  const autosavedEntryTitle = `${entryTitle} autosaved`;
  const finalAutosaveResponse = page.waitForResponse((response) => {
    if (
      response.request().method() !== "POST" ||
      !response.url().includes("/autosave")
    ) {
      return false;
    }

    return (
      (response.request().postDataJSON() as { title?: string } | null)?.title ===
      autosavedEntryTitle
    );
  });
  await page.getByLabel("Entry title").fill(autosavedEntryTitle);
  await expect(autosaveStatus).toHaveText(/Unsaved changes|Saving\.\.\./);
  await finalAutosaveResponse;
  await expect(autosaveStatus).toHaveText("Saved", { timeout: 10_000 });

  await page.reload();
  await expect(page.getByLabel("Entry title")).toHaveValue(autosavedEntryTitle);
  await expect(page.getByLabel("Table 1 row 2 column 1")).toHaveValue("7");
  await expect(page.getByLabel("Table 1 row 2 column 2")).toHaveValue("0.8");
});
