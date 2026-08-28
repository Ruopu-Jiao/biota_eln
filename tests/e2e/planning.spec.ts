import { expect, test } from "@playwright/test";

test("demo mode can create and schedule planning work", async ({ page }) => {
  const nonce = Date.now();
  const projectTitle = `Planning project ${nonce}`;
  const experimentTitle = `Planning experiment ${nonce}`;
  const taskTitle = `Planning task ${nonce}`;

  await page.goto("/api/demo-login");
  await expect(page).toHaveURL(/\/entries(\/.+)?$/);

  await page.getByRole("button", { name: "Planning" }).click();
  await expect(page).toHaveURL(/\/planning\/.+/);

  await page.getByPlaceholder("New project").fill(projectTitle);
  await page.getByRole("button", { name: "Add project" }).click();
  await expect(page.locator(`input[value="${projectTitle}"]`)).toBeVisible();

  await page.getByPlaceholder("New experiment").last().fill(experimentTitle);
  await page.getByRole("button", { name: "Add experiment" }).last().click();
  await expect(page.locator(`input[value="${experimentTitle}"]`)).toBeVisible();

  const experimentSection = page
    .locator(`section:has(input[value="${experimentTitle}"])`)
    .last();

  await experimentSection.getByPlaceholder("New task").first().fill(taskTitle);
  await experimentSection.getByRole("button", { name: "Add task" }).first().click();
  await expect(page.locator("body")).toContainText(taskTitle);

  const taskCard = experimentSection.locator("article").filter({ hasText: taskTitle });
  await taskCard.getByText("Edit").click();
  await taskCard.getByRole("checkbox").first().check();
  await taskCard.locator('select[name="status"]').selectOption("SCHEDULED");
  await taskCard.getByRole("button", { name: "Save task" }).click();
  const scheduledLane = experimentSection
    .locator("section")
    .filter({ hasText: /^Scheduled/ })
    .first();
  await expect(scheduledLane).toContainText(taskTitle);
  await expect(scheduledLane.locator("article").filter({ hasText: taskTitle })).toContainText(
    "1 links",
  );

  await page.getByRole("button", { name: "Timeline" }).click();
  await expect(page.locator("body")).toContainText(projectTitle);
  await expect(page.locator("body")).toContainText(taskTitle);

  await page.reload();
  await page.getByRole("button", { name: "Timeline" }).click();
  await expect(page.locator("body")).toContainText(projectTitle);
  await expect(page.locator("body")).toContainText(taskTitle);
});
