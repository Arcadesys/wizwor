import { expect, test, type Page, type TestInfo } from "@playwright/test";

const postConsolePrompt = "What plaything can I offer you today?";
const soundOnCaution = "Best with sound on. Turn your speakers down first, then let WIZ speak.";

async function attachScreenshot(page: Page, testInfo: TestInfo, name: string) {
  const body = await page.screenshot({ fullPage: true });
  await testInfo.attach(name, { body, contentType: "image/png" });
}

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

const metroidMotherRecommendation = {
  game: {
    id: "metroid-mother",
    title: "Metroid: Mother",
    platform: "romhack",
    isRomhack: true,
    year: "romhack",
    pitch: "A friendlier, map-aware restoration of Metroid that keeps the lonely alien dread intact.",
    playthroughUrl: "https://www.youtube.com/watch?v=S7fwbZjLpXE",
    moods: ["ominous", "contemplative"],
    difficulty: "fair",
    story: "some",
    playStyle: "side-scroller",
    obscurity: "hidden-gem",
    tags: ["exploration", "quality of life", "lonely"],
  },
  score: 0.96,
  reasons: ["answers the ominous mood", "keeps to the side-scrolling path", "fair difficulty"],
};

const castlevaniaIiiRecommendation = {
  game: {
    id: "castlevania-iii",
    title: "Castlevania III: Dracula's Curse",
    platform: "nes",
    isRomhack: false,
    year: "1989",
    pitch: "A grim side-scrolling pilgrimage with branching routes, gothic pressure, and just enough cruelty to feel cursed.",
    playthroughUrl: "https://www.youtube.com/watch?v=hFFKAl2A898",
    moods: ["ominous", "heroic"],
    difficulty: "difficult",
    story: "some",
    playStyle: "side-scroller",
    obscurity: "hidden-gem",
    tags: ["gothic", "branching paths"],
  },
  score: 0.97,
  reasons: ["gothic pilgrimage", "branching routes"],
};

const recommendationResponse = {
  adapter: "chatgpt",
  accepted: true,
  lines: ["Recommendation ready. One match clears the gate."],
  recommendations: [metroidMotherRecommendation],
  showcase: { games: [metroidMotherRecommendation] },
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

const multiGameShowcaseResponse = {
  ...recommendationResponse,
  lines: ["Two paths clear the gate. Your call."],
  recommendations: [metroidMotherRecommendation, castlevaniaIiiRecommendation],
  showcase: { games: [metroidMotherRecommendation, castlevaniaIiiRecommendation] },
};

test("starts blank without canned mock responses", async ({ page }, testInfo) => {
  await page.goto("/test");

  await expect(page.getByLabel("Terminal command prompt")).toBeEnabled();
  await expect(page.getByText(/CRT SIGNAL DORMANT/i)).toHaveCount(0);
  await expect(page.getByText(/PRESS ENTER TO SUMMON/i)).toHaveCount(0);
  await expect(page.getByText("Greetings Gamer! What console are you questing on today?")).toBeVisible();
  await expect(page.getByText(soundOnCaution)).toBeVisible();
  await expect(page.getByRole("heading", { name: "Choose Console Context" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Select NES" })).toBeVisible();

  await attachScreenshot(page, testInfo, "blank-start");
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
  await page.getByRole("button", { name: "Select Romhacks" }).click();
  await page.getByRole("button", { name: /Begin Quest/i }).click();

  await page.locator(".terminal-window").click();
  await expect(prompt).toBeFocused();

  await prompt.fill("Ada wants an ominous side-scroller with fair difficulty and some story.");
  await prompt.press("Enter");
  await expect(page.getByRole("heading", { name: "Metroid: Mother" })).toBeVisible();
  await expect(page.locator("iframe[title='Metroid: Mother gameplay']")).toHaveAttribute(
    "src",
    "https://www.youtube.com/embed/S7fwbZjLpXE",
  );

  await page.getByRole("button", { name: "Close showcase" }).click();

  const feedbackButton = page.getByRole("button", { name: /Nailed it/i });
  await expect(feedbackButton).toBeVisible();
  await feedbackButton.click();
  await expect(prompt).not.toBeFocused();
  expect(commands).toEqual(["Ada wants an ominous side-scroller with fair difficulty and some story."]);

  await attachScreenshot(page, testInfo, "focus-exception");
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
  await page.getByRole("button", { name: "Select Romhacks" }).click();
  await page.getByRole("button", { name: /Begin Quest/i }).click();

  await prompt.fill("Ada wants an ominous side-scroller.");
  await prompt.press("Enter");
  await expect(page.getByText(/resistance and story weight/i)).toBeVisible();
  await expect(page.getByRole("heading", { name: "Metroid: Mother" })).toHaveCount(0);

  await prompt.fill("Fair difficulty, some story.");
  await prompt.press("Enter");
  await expect(page.getByRole("heading", { name: "Metroid: Mother" })).toBeVisible();
  await expect(page.getByText(/96% match/)).toBeVisible();
  await expect(page.locator("iframe[title='Metroid: Mother gameplay']")).toBeVisible();

  expect(commands).toEqual(["Ada wants an ominous side-scroller.", "Fair difficulty, some story."]);
  await attachScreenshot(page, testInfo, "agent-recommendation");
});

test("the showcase modal tabs between multiple qualifying games", async ({ page }, testInfo) => {
  await page.route("**/api/wizard", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(multiGameShowcaseResponse),
    });
  });

  await page.goto("/test");
  const prompt = page.getByLabel("Terminal command prompt");
  await expect(prompt).toBeEnabled();
  await page.getByRole("button", { name: "Select Romhacks" }).click();
  await page.getByRole("button", { name: /Begin Quest/i }).click();

  await prompt.fill("Ada wants an ominous side-scroller, either pick works.");
  await prompt.press("Enter");

  await expect(page.getByRole("heading", { name: "Metroid: Mother" })).toBeVisible();
  await expect(page.getByTitle("Metroid: Mother gameplay")).toBeVisible();
  await expect(page.getByRole("tab", { name: "TOME 2" })).toBeVisible();
  await attachScreenshot(page, testInfo, "showcase-modal-first-tab");

  await page.getByRole("tab", { name: "TOME 2" }).click();
  await expect(page.getByRole("heading", { name: "Castlevania III: Dracula's Curse" })).toBeVisible();
  await expect(page.getByTitle("Castlevania III: Dracula's Curse gameplay")).toHaveAttribute(
    "src",
    "https://www.youtube.com/embed/hFFKAl2A898",
  );
  await attachScreenshot(page, testInfo, "showcase-modal-second-tab");
});

test("start over returns the terminal to a blank ready state", async ({ page }, testInfo) => {
  await page.route("**/api/wizard", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(recommendationResponse),
    });
  });

  await page.goto("/test");
  const prompt = page.getByLabel("Terminal command prompt");
  await expect(prompt).toBeEnabled();
  await page.getByRole("button", { name: "Select Romhacks" }).click();
  await page.getByRole("button", { name: /Begin Quest/i }).click();

  await prompt.fill("Ada wants an ominous side-scroller with fair difficulty and some story.");
  await prompt.press("Enter");
  await expect(page.getByRole("heading", { name: "Metroid: Mother" })).toBeVisible();

  await page.getByRole("button", { name: "Close showcase" }).click();
  await expect(page.getByText("Was this reading true?")).toBeVisible();

  await page.getByRole("button", { name: "Start over" }).click();

  await expect(prompt).toBeFocused();
  await expect(prompt).toHaveValue("");
  await expect(page.getByText("Greetings Gamer! What console are you questing on today?")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Choose Console Context" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Metroid: Mother" })).toHaveCount(0);
  await expect(page.getByText("Was this reading true?")).toHaveCount(0);
  await attachScreenshot(page, testInfo, "start-over-reset");
});

test("console context gates the prompt until a platform is chosen", async ({ page }, testInfo) => {
  await page.goto("/test");
  const prompt = page.getByLabel("Terminal command prompt");
  await expect(prompt).toBeEnabled();
  await expect(page.getByRole("heading", { name: "Choose Console Context" })).toBeVisible();
  await attachScreenshot(page, testInfo, "console-context-initial");

  await prompt.fill("Ada wants an ominous side-scroller.");
  await prompt.press("Enter");
  await expect(page.getByText(/Choose a console first/i)).toBeVisible();
  await expect(page.getByRole("heading", { name: "Choose Console Context" })).toBeVisible();
  await attachScreenshot(page, testInfo, "console-context-rejected-freetext");

  await page.getByRole("button", { name: "Select SNES" }).click();
  await page.getByRole("button", { name: /Begin Quest/i }).click();
  await expect(page.getByRole("heading", { name: "Choose Console Context" })).toHaveCount(0);
  await expect(page.getByText("SNES", { exact: true })).toBeVisible();
  await expect(page.getByText(postConsolePrompt, { exact: true })).toBeVisible();
  await expect(prompt).toBeFocused();
  await attachScreenshot(page, testInfo, "console-context-selected-snes");

  await page.getByRole("button", { name: "Catalog settings" }).click();
  const snesToggle = page.locator('[data-platform="snes"]');
  await expect(snesToggle).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator('[data-platform="nes"]')).toHaveAttribute("aria-pressed", "false");
  await attachScreenshot(page, testInfo, "console-context-settings-snes-only");
});

test("multiple consoles can be selected before beginning the quest", async ({ page }, testInfo) => {
  await page.goto("/test");
  const prompt = page.getByLabel("Terminal command prompt");
  await expect(prompt).toBeEnabled();

  const nesButton = page.getByRole("button", { name: "Select NES" });
  const snesButton = page.getByRole("button", { name: "Select SNES" });
  const beginButton = page.getByRole("button", { name: /Begin Quest/i });

  await expect(beginButton).toBeDisabled();

  await nesButton.click();
  await expect(nesButton).toHaveAttribute("aria-pressed", "true");
  await expect(beginButton).toBeEnabled();
  await expect(beginButton).toHaveText("Begin Quest");

  await snesButton.click();
  await expect(snesButton).toHaveAttribute("aria-pressed", "true");
  await expect(beginButton).toHaveText("Begin Quest (2)");
  await attachScreenshot(page, testInfo, "console-context-multi-selected");

  await nesButton.click();
  await expect(nesButton).toHaveAttribute("aria-pressed", "false");
  await expect(beginButton).toHaveText("Begin Quest");

  await beginButton.click();
  await expect(page.getByRole("heading", { name: "Choose Console Context" })).toHaveCount(0);
  await expect(page.getByText("SNES", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Catalog settings" }).click();
  await expect(page.locator('[data-platform="snes"]')).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator('[data-platform="nes"]')).toHaveAttribute("aria-pressed", "false");
  await attachScreenshot(page, testInfo, "console-context-multi-confirmed-snes-only");
});

test("typing a console name selects that console context", async ({ page }, testInfo) => {
  await page.goto("/test");
  const prompt = page.getByLabel("Terminal command prompt");
  await expect(prompt).toBeEnabled();

  await prompt.fill("genesis");
  await prompt.press("Enter");
  await expect(page.getByRole("heading", { name: "Choose Console Context" })).toHaveCount(0);
  await expect(page.getByText("Genesis / Mega Drive", { exact: true })).toBeVisible();
  await expect(page.getByText(postConsolePrompt, { exact: true })).toBeVisible();
  await attachScreenshot(page, testInfo, "console-context-typed-genesis");
});

test("desktop and mobile keep the terminal prompt visible", async ({ page }) => {
  await page.goto("/test");
  await expect(page.locator(".terminal-window")).toBeVisible();
  await expect(page.getByLabel("Terminal command prompt")).toBeVisible();
});
