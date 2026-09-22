import { expect, test, type Page, type TestInfo } from "@playwright/test";

const wizardGreeting = "Greetings Gamer! What console are you questing on today?";
const furryGreeting = "n.n Greetings, friend. I am HOWL.NET, your guide to furry video games. What console are you questing on today?";
const furryPostConsolePrompt = "What critter cart can I dig out of the crate?";
const furrySoundCaution = "Best with sound on. Turn your speakers down first, then let HOWLNET speak.";

async function attachScreenshot(page: Page, testInfo: TestInfo, name: string) {
  const body = await page.screenshot({ fullPage: true });
  await testInfo.attach(name, { body, contentType: "image/png" });
}

const bubsyRecommendation = {
  game: {
    id: "furry-e2e-mascot",
    title: "Crate Fox",
    platform: "nes",
    isRomhack: false,
    year: "1991",
    pitch: "A mascot platformer about a fox who runs faster than the level loads.",
    playthroughUrl: "https://www.youtube.com/watch?v=S7fwbZjLpXE",
    moods: ["heroic"],
    difficulty: "fair",
    story: "low",
    playStyle: "platformer",
    obscurity: "hidden-gem",
    tags: ["anthropomorphic", "mascot"],
  },
  score: 0.95,
  reasons: ["a critter lead", "mascot platforming"],
};

const furryRecommendationResponse = {
  adapter: "chatgpt",
  accepted: true,
  lines: ["Found one in the crate."],
  recommendations: [bubsyRecommendation],
  showcase: { games: [bubsyRecommendation] },
  suggestions: [],
  state: {
    started: true,
    revealed: true,
    profile: { keywords: ["anthropomorphic", "mascot"] },
  },
};

test("opens in the furry persona's voice", async ({ page }, testInfo) => {
  await page.goto("/test/furry");

  await expect(page.getByLabel("Terminal command prompt")).toBeEnabled();
  await expect(page.getByText(furryGreeting)).toBeVisible();
  await expect(page.getByText(furrySoundCaution)).toBeVisible();
  await expect(page.getByText(wizardGreeting)).toHaveCount(0);

  await attachScreenshot(page, testInfo, "furry-start");
});

test("sends the furry persona with each turn and labels the showcase in character", async ({ page }, testInfo) => {
  const personas: unknown[] = [];

  await page.route("**/api/wizard", async (route) => {
    const payload = route.request().postDataJSON() as { persona?: string };
    personas.push(payload.persona);
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(furryRecommendationResponse),
    });
  });

  await page.goto("/test/furry");
  const prompt = page.getByLabel("Terminal command prompt");
  await expect(prompt).toBeEnabled();

  await page.getByRole("button", { name: "Select NES" }).click();
  await page.getByRole("button", { name: "Begin Quest" }).click();
  await expect(page.getByText(furryPostConsolePrompt)).toBeVisible();

  await prompt.fill("something with a fox in it");
  await prompt.press("Enter");

  await expect(page.getByRole("dialog", { name: "Game showcase" })).toBeVisible();
  await expect(page.getByText("C:\\FURRYMUCK>")).toBeVisible();
  expect(personas).toContain("furry");
  expect(personas).not.toContain("wizard");

  await attachScreenshot(page, testInfo, "furry-showcase");
});

// Same origin, so a shared localStorage key would leak one persona's MEMORY.md
// and palette into the other's session.
test("keeps its saved session separate from the wizard route", async ({ page }) => {
  await page.goto("/test/furry");
  await expect(page.getByLabel("Terminal command prompt")).toBeEnabled();
  await page.getByRole("button", { name: "Select NES" }).click();
  await page.getByRole("button", { name: "Begin Quest" }).click();
  await expect(page.getByText(furryPostConsolePrompt)).toBeVisible();

  const keys = await page.evaluate(() => Object.keys(window.localStorage));
  expect(keys.some((key) => key.startsWith("wyrm-furry-"))).toBe(true);
  expect(keys.some((key) => key.startsWith("wyrm-terminal-"))).toBe(false);

  await page.goto("/test");
  await expect(page.getByText(wizardGreeting)).toBeVisible();
  await expect(page.getByRole("heading", { name: "Choose Console Context" })).toBeVisible();
});
