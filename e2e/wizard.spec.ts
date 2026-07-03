import { expect, test } from "@playwright/test";

test("summons and accepts a custom typed answer", async ({ page }) => {
  await page.route("**/api/wizard", async (route) => {
    const payload = route.request().postDataJSON() as { command: string };
    const command = payload.command.trim().toLowerCase();
    const response = command.includes("spooky")
      ? {
          adapter: "chatgpt",
          accepted: true,
          lines: ["I read that as Ominous."],
          recommendations: [],
          suggestions: [],
          state: {
            started: true,
            needsName: false,
            activeQuestionKey: "playStyle",
            awaitingFocus: false,
            revealed: false,
            profile: { name: "Ada", mood: "ominous" },
          },
        }
      : command === "ada"
        ? {
            adapter: "chatgpt",
            accepted: true,
            lines: ["Name the air you want around the cartridge."],
            recommendations: [],
            suggestions: [],
            state: {
              started: true,
              needsName: false,
              activeQuestionKey: "mood",
              awaitingFocus: false,
              revealed: false,
              profile: { name: "Ada" },
            },
          }
        : {
            adapter: "chatgpt",
            accepted: true,
            lines: ["Tell me the name I should carve into this session."],
            recommendations: [],
            suggestions: [],
            state: {
              started: true,
              needsName: true,
              activeQuestionKey: null,
              awaitingFocus: false,
              revealed: false,
              profile: { name: "" },
            },
          };

    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(response),
    });
  });

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
