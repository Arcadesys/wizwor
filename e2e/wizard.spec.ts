import { expect, test } from "@playwright/test";

const noRecommendationsResponse = {
  adapter: "chatgpt",
  accepted: true,
  lines: ["I have the shape. Tell me the resistance and story weight."],
  recommendations: [],
  suggestions: [],
  state: {
    started: true,
    needsName: false,
    activeQuestionKey: "difficulty",
    awaitingFocus: false,
    revealed: false,
    profile: { name: "Ada", mood: "ominous", playStyle: "side-scroller" },
  },
};

const recommendationResponse = {
  adapter: "chatgpt",
  accepted: true,
  lines: ["Recommendation ready. One match clears the gate."],
  recommendations: [
    {
      game: {
        id: "metroid-mother",
        title: "Metroid: Mother",
        kind: "romhack",
        year: "romhack",
        pitch: "A friendlier, map-aware restoration of Metroid that keeps the lonely alien dread intact.",
        playthroughUrl: "https://www.youtube.com/watch?v=S7fwbZjLpXE",
        moods: ["ominous", "contemplative"],
        difficulty: "fair",
        story: "some",
        playStyle: "side-scroller",
        obscurity: "hidden-gem",
        romhack: "yes",
        tags: ["exploration", "quality of life", "lonely"],
      },
      score: 0.96,
      reasons: ["answers the ominous mood", "keeps to the side-scrolling path", "fair difficulty"],
    },
  ],
  suggestions: [],
  state: {
    started: true,
    needsName: false,
    activeQuestionKey: null,
    awaitingFocus: false,
    revealed: true,
    profile: {
      name: "Ada",
      mood: "ominous",
      playStyle: "side-scroller",
      difficulty: "fair",
      story: "some",
    },
  },
};

test("starts blank without canned mock responses", async ({ page }, testInfo) => {
  await page.goto("/test");

  await expect(page.getByLabel("Terminal command prompt")).toBeEnabled();
  await expect(page.getByText(/CRT SIGNAL DORMANT/i)).toHaveCount(0);
  await expect(page.getByText(/PRESS ENTER TO SUMMON/i)).toHaveCount(0);
  await expect(page.locator(".message-stack")).toHaveText("");

  await page.screenshot({ path: testInfo.outputPath("blank-start.png"), fullPage: true });
});

test("clicking the window focuses chat except recommendation buttons", async ({ page }, testInfo) => {
  const commands: string[] = [];

  await page.route("**/api/wizard", async (route) => {
    const payload = route.request().postDataJSON() as { command: string };
    commands.push(payload.command);
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(recommendationResponse),
    });
  });

  await page.goto("/test");
  const prompt = page.getByLabel("Terminal command prompt");
  await expect(prompt).toBeEnabled();

  await page.locator(".terminal-window").click();
  await expect(prompt).toBeFocused();

  await prompt.fill("Ada wants an ominous side-scroller with fair difficulty and some story.");
  await prompt.press("Enter");
  await expect(page.getByRole("heading", { name: "Metroid: Mother" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Watch Playthrough" })).toHaveAttribute(
    "href",
    "https://www.youtube.com/watch?v=S7fwbZjLpXE",
  );

  const feedbackButton = page.getByRole("button", { name: /Nailed it/i });
  await expect(feedbackButton).toBeVisible();
  await feedbackButton.click();
  await expect(prompt).not.toBeFocused();
  expect(commands).toEqual(["Ada wants an ominous side-scroller with fair difficulty and some story."]);

  await page.screenshot({ path: testInfo.outputPath("focus-exception.png"), fullPage: true });
});

test("the agent controls when recommendations appear at the narrowed threshold", async ({ page }, testInfo) => {
  const commands: string[] = [];

  await page.route("**/api/wizard", async (route) => {
    const payload = route.request().postDataJSON() as { command: string };
    commands.push(payload.command);
    const response = commands.length === 1 ? noRecommendationsResponse : recommendationResponse;
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(response),
    });
  });

  await page.goto("/test");
  const prompt = page.getByLabel("Terminal command prompt");
  await expect(prompt).toBeEnabled();

  await prompt.fill("Ada wants an ominous side-scroller.");
  await prompt.press("Enter");
  await expect(page.getByText(/resistance and story weight/i)).toBeVisible();
  await expect(page.getByText("Metroid: Mother")).toHaveCount(0);

  await prompt.fill("Fair difficulty, some story.");
  await prompt.press("Enter");
  await expect(page.getByRole("heading", { name: "Metroid: Mother" })).toBeVisible();
  await expect(page.getByText("96%")).toBeVisible();
  await expect(page.getByRole("link", { name: "Watch Playthrough" })).toBeVisible();

  expect(commands).toEqual(["Ada wants an ominous side-scroller.", "Fair difficulty, some story."]);
  await page.screenshot({ path: testInfo.outputPath("agent-recommendation.png"), fullPage: true });
});

test("start over returns the terminal to a blank ready state", async ({ page }) => {
  await page.route("**/api/wizard", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(recommendationResponse),
    });
  });

  await page.goto("/test");
  const prompt = page.getByLabel("Terminal command prompt");
  await expect(prompt).toBeEnabled();

  await prompt.fill("Ada wants an ominous side-scroller with fair difficulty and some story.");
  await prompt.press("Enter");
  await expect(page.getByRole("heading", { name: "Metroid: Mother" })).toBeVisible();
  await expect(page.getByText("Was this reading true?")).toBeVisible();

  await page.getByRole("button", { name: "Start over" }).click();

  await expect(prompt).toBeFocused();
  await expect(prompt).toHaveValue("");
  await expect(page.locator(".message-stack")).toHaveText("");
  await expect(page.getByRole("heading", { name: "Metroid: Mother" })).toHaveCount(0);
  await expect(page.getByText("Was this reading true?")).toHaveCount(0);
  await expect(page.locator(".status-line")).toContainText("ANS 0/6");
});

test("desktop and mobile keep the terminal prompt visible", async ({ page }) => {
  await page.goto("/test");
  await expect(page.locator(".terminal-window")).toBeVisible();
  await expect(page.getByLabel("Terminal command prompt")).toBeVisible();
});
