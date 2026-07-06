import fs from "node:fs";
import path from "node:path";
import { chatGptAgentAdapter, getChatGptAgentReadiness } from "../src/lib/wizard/chatgpt-agent";
import {
  initialWizardState,
  type WizardMessage,
  type WizardState,
  type WizardTerminalTheme,
  type WizardTurnResponse,
} from "../src/lib/wizard/types";

type EvalCase = {
  id: string;
  family: string;
  description: string;
  initialState?: Partial<WizardState>;
  turns: string[];
  expect: {
    profile?: Record<string, unknown>;
    profileUnset?: string[];
    revealed?: boolean;
    activeQuestionKey?: string | null;
    lastAccepted?: boolean;
    minRecommendations?: number;
    maxRecommendations?: number;
    topScoreAtLeast?: number;
    topTitle?: string;
    topPlatform?: string;
    hasShowcase?: boolean;
    maxShowcaseGames?: number;
    terminalTheme?: Partial<WizardTerminalTheme>;
    terminalThemeKeys?: Array<keyof WizardTerminalTheme>;
    memoryIncludes?: string[];
    maxAgentDataGamesAboveThreshold?: number;
    minAgentDataCurrentBestMatches?: number;
    lineIncludes?: string[];
  };
  xfail?: boolean;
};

type CaseResult = {
  id: string;
  family: string;
  status: "PASS" | "FAIL" | "XFAIL" | "XPASS";
  failures: string[];
};

loadEnvLocal();

const readiness = getChatGptAgentReadiness();
const agent = chatGptAgentAdapter;

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

async function main() {
  if (!readiness.hasApiKey) {
    console.error("OPENAI_API_KEY is required to run agent evals.");
    process.exit(1);
  }

  const cases = readCases(path.join(process.cwd(), "evals", "cases"));
  const results = await Promise.all(cases.map(runCase));
  const unexpectedFailures = results.filter((result) => result.status === "FAIL");

  for (const result of results) {
    const detail = result.failures.length ? `\n  - ${result.failures.join("\n  - ")}` : "";
    console.log(`${result.status} ${result.family}/${result.id}${detail}`);
  }

  console.log(
    `\n${results.filter((result) => result.status === "PASS").length} pass, ` +
      `${results.filter((result) => result.status === "XFAIL").length} expected fail, ` +
      `${unexpectedFailures.length} unexpected fail`,
  );

  if (unexpectedFailures.length) {
    process.exit(1);
  }
}

function readCases(directory: string): EvalCase[] {
  return fs
    .readdirSync(directory)
    .filter((file) => file.endsWith(".jsonl"))
    .flatMap((file) =>
      fs
        .readFileSync(path.join(directory, file), "utf8")
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => JSON.parse(line) as EvalCase),
    );
}

function loadEnvLocal() {
  const envPath = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) {
    return;
  }

  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const equalsIndex = trimmed.indexOf("=");
    if (equalsIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, equalsIndex).trim();
    const rawValue = trimmed.slice(equalsIndex + 1).trim();
    if (!key || process.env[key]) {
      continue;
    }

    process.env[key] = rawValue.replace(/^['"]|['"]$/g, "");
  }
}

async function runCase(testCase: EvalCase): Promise<CaseResult> {
  let state: WizardState = {
    ...initialWizardState,
    ...testCase.initialState,
    profile: {
      ...initialWizardState.profile,
      ...testCase.initialState?.profile,
    },
  };
  const messages: WizardMessage[] = [];
  let lastLines: string[] = [];
  let lastAccepted = true;
  let lastRecommendations: Awaited<ReturnType<typeof agent.runTurn>>["recommendations"] = [];
  let lastResponse: WizardTurnResponse | null = null;

  for (const command of testCase.turns) {
    if (command) {
      messages.push({ speaker: "user", text: command });
    }

    const response = await agent.runTurn({
      sessionId: `eval-${testCase.id}`,
      command,
      state,
      messages,
    });

    state = response.state;
    lastLines = response.lines;
    lastAccepted = response.accepted;
    lastRecommendations = response.recommendations;
    lastResponse = response;
    messages.push(...response.lines.map((text) => ({ speaker: "wizard" as const, text })));
  }

  const failures = checkExpectations(testCase, state, lastAccepted, lastLines, lastRecommendations, lastResponse, {
    checkExactLineText: true,
  });
  if (testCase.xfail) {
    return {
      id: testCase.id,
      family: testCase.family,
      status: failures.length ? "XFAIL" : "XPASS",
      failures: failures.length ? failures : ["Expected failure passed; review whether this should become a regression."],
    };
  }

  return {
    id: testCase.id,
    family: testCase.family,
    status: failures.length ? "FAIL" : "PASS",
    failures,
  };
}

function checkExpectations(
  testCase: EvalCase,
  state: WizardState,
  lastAccepted: boolean,
  lastLines: string[],
  recommendations: Awaited<ReturnType<typeof agent.runTurn>>["recommendations"],
  lastResponse: WizardTurnResponse | null,
  options: { checkExactLineText: boolean },
) {
  const failures: string[] = [];
  const expected = testCase.expect;

  for (const [key, value] of Object.entries(expected.profile ?? {})) {
    if ((state.profile as Record<string, unknown>)[key] !== value) {
      failures.push(`Expected profile.${key}=${String(value)}, saw ${String((state.profile as Record<string, unknown>)[key])}.`);
    }
  }

  for (const key of expected.profileUnset ?? []) {
    if ((state.profile as Record<string, unknown>)[key] !== undefined) {
      failures.push(`Expected profile.${key} to stay unset, saw ${String((state.profile as Record<string, unknown>)[key])}.`);
    }
  }

  if (expected.revealed !== undefined && state.revealed !== expected.revealed) {
    failures.push(`Expected revealed=${expected.revealed}, saw ${state.revealed}.`);
  }

  if (expected.activeQuestionKey !== undefined && state.activeQuestionKey !== expected.activeQuestionKey) {
    failures.push(`Expected activeQuestionKey=${expected.activeQuestionKey}, saw ${state.activeQuestionKey}.`);
  }

  if (expected.lastAccepted !== undefined && lastAccepted !== expected.lastAccepted) {
    failures.push(`Expected lastAccepted=${expected.lastAccepted}, saw ${lastAccepted}.`);
  }

  if (expected.minRecommendations !== undefined && recommendations.length < expected.minRecommendations) {
    failures.push(`Expected at least ${expected.minRecommendations} recommendations, saw ${recommendations.length}.`);
  }

  if (expected.maxRecommendations !== undefined && recommendations.length > expected.maxRecommendations) {
    failures.push(`Expected at most ${expected.maxRecommendations} recommendations, saw ${recommendations.length}.`);
  }

  if (expected.topScoreAtLeast !== undefined && (recommendations[0]?.score ?? 0) < expected.topScoreAtLeast) {
    failures.push(`Expected top score >= ${expected.topScoreAtLeast}, saw ${recommendations[0]?.score ?? 0}.`);
  }

  if (expected.topTitle !== undefined && recommendations[0]?.game.title !== expected.topTitle) {
    failures.push(`Expected top recommendation "${expected.topTitle}", saw "${recommendations[0]?.game.title ?? "none"}".`);
  }

  if (expected.topPlatform !== undefined && recommendations[0]?.game.platform !== expected.topPlatform) {
    failures.push(`Expected top platform "${expected.topPlatform}", saw "${recommendations[0]?.game.platform ?? "none"}".`);
  }

  if (expected.hasShowcase !== undefined) {
    const hasShowcase = Boolean(lastResponse?.showcase?.games.length);
    if (hasShowcase !== expected.hasShowcase) {
      failures.push(`Expected hasShowcase=${expected.hasShowcase}, saw ${hasShowcase}.`);
    }
  }

  if (
    expected.maxShowcaseGames !== undefined &&
    (lastResponse?.showcase?.games.length ?? 0) > expected.maxShowcaseGames
  ) {
    failures.push(
      `Expected at most ${expected.maxShowcaseGames} showcase games, saw ${lastResponse?.showcase?.games.length ?? 0}.`,
    );
  }

  for (const [key, value] of Object.entries(expected.terminalTheme ?? {})) {
    if (state.terminalTheme?.[key as keyof WizardTerminalTheme] !== value) {
      failures.push(`Expected terminalTheme.${key}=${String(value)}, saw ${String(state.terminalTheme?.[key as keyof WizardTerminalTheme])}.`);
    }
  }

  for (const key of expected.terminalThemeKeys ?? []) {
    if (!state.terminalTheme?.[key]) {
      failures.push(`Expected terminalTheme.${key} to be set.`);
    }
  }

  for (const snippet of expected.memoryIncludes ?? []) {
    if (!state.memoryMarkdown.includes(snippet)) {
      failures.push(`Expected memoryMarkdown to include "${snippet}".`);
    }
  }

  if (
    expected.maxAgentDataGamesAboveThreshold !== undefined &&
    (lastResponse?.agentData?.gamesAboveThreshold.length ?? 0) > expected.maxAgentDataGamesAboveThreshold
  ) {
    failures.push(
      `Expected agentData.gamesAboveThreshold <= ${expected.maxAgentDataGamesAboveThreshold}, saw ${
        lastResponse?.agentData?.gamesAboveThreshold.length ?? 0
      }.`,
    );
  }

  if (
    expected.minAgentDataCurrentBestMatches !== undefined &&
    (lastResponse?.agentData?.currentBestMatches.length ?? 0) < expected.minAgentDataCurrentBestMatches
  ) {
    failures.push(
      `Expected agentData.currentBestMatches >= ${expected.minAgentDataCurrentBestMatches}, saw ${
        lastResponse?.agentData?.currentBestMatches.length ?? 0
      }.`,
    );
  }

  if (options.checkExactLineText) {
    for (const snippet of expected.lineIncludes ?? []) {
      if (!lastLines.join(" ").includes(snippet)) {
        failures.push(`Expected last lines to include "${snippet}".`);
      }
    }
  }

  return failures;
}
