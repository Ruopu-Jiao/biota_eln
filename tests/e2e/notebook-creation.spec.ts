import { expect, test } from "@playwright/test";

test("demo mode can create a protocol and link it into an entry", async ({
  page,
}) => {
  const nonce = Date.now();
  const protocolTitle = `Demo protocol ${nonce}`;
  const entryTitle = `Demo entry ${nonce}`;
  const updatedSummary = "Updated summary after block edit.";
  const updatedPrimaryText = "Edited primary text block for the experiment.";
  const updatedSecondaryText = "Added a second notes block with follow-up observations.";

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
  await page.getByLabel("Title").fill(entryTitle);
  await page
    .getByLabel("Summary")
    .fill("Entry draft linked to a reusable protocol.");
  await page
    .getByLabel("Body")
    .fill("Observed a clear signal and linked the protocol block.");
  await page
    .getByRole("checkbox", { name: new RegExp(protocolTitle) })
    .check();
  await page.getByRole("button", { name: "Create entry draft" }).click();

  await expect(page.locator("body")).toContainText(entryTitle);
  await expect(page.locator("body")).toContainText(protocolTitle);

  await page.getByRole("link", { name: entryTitle }).click();

  await expect(page).toHaveURL(/\/entries\/.+/);
  await page.getByLabel("Entry summary").fill(updatedSummary);
  await page.getByLabel("Text block 1").fill(updatedPrimaryText);
  await page.getByRole("button", { name: "Add text block" }).click();
  await page.getByLabel("Text block 3").fill(updatedSecondaryText);
  await page.getByRole("button", { name: "Save entry version" }).click();

  await expect(page.locator("body")).toContainText("v2");
  await expect(page.locator("body")).toContainText(protocolTitle);

  await page.reload();
  await expect(page.getByLabel("Entry summary")).toHaveValue(updatedSummary);
  await expect(page.getByLabel("Text block 1")).toHaveValue(updatedPrimaryText);
  await expect(page.getByLabel("Text block 3")).toHaveValue(updatedSecondaryText);
});
