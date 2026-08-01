import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("has no automated WCAG A or AA violations", async ({ page }) => {
  // Arrange
  await page.goto("/");

  // Act
  const accessibilityScanResults = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();

  // Assert
  expect(accessibilityScanResults.violations).toEqual([]);
});

test("records and undoes a point in a new match", async ({ page }) => {
  // Arrange
  await page.goto("/");
  await page.getByLabel("Home player").fill("Aino");
  await page.getByLabel("Away player").fill("Kai");

  // Act
  await page.getByRole("button", { name: "Start match" }).click();
  await expect(page.getByLabel("Aino is serving")).toBeVisible();
  await page.getByRole("button", { name: "Add point for Kai" }).click();
  await expect(page.getByLabel("Kai is serving")).toBeVisible();
  await page.getByRole("button", { name: "Undo last point" }).click();

  // Assert
  await expect(page.getByRole("heading", { name: "Live match" })).toBeVisible();
  await expect(page.locator("strong")).toHaveText(["0", "0"]);
  await expect(page.getByLabel("Aino is serving")).toBeVisible();
});
