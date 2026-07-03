import { expect, test } from "@playwright/test";

test("summons and accepts a custom typed answer", async ({ page }) => {
  await page.goto("/test");

  const prompt = page.getByLabel("Terminal command prompt");
  await prompt.press("Enter");
  await expect(page.getByText(/Tell me the name/i)).toBeVisible();

  await prompt.fill("Ada");
  await prompt.press("Enter");
  await expect(page.getByText(/Name the air/i)).toBeVisible();

  await prompt.fill("spooky haunted machinery");
  await prompt.press("Enter");
  await expect(page.getByText(/I read that as Ominous/i)).toBeVisible();
});

test("desktop and mobile keep the terminal prompt visible", async ({ page }) => {
  await page.goto("/test");
  await expect(page.locator(".terminal-window")).toBeVisible();
  await expect(page.getByLabel("Terminal command prompt")).toBeVisible();
});
