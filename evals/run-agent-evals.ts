import fs from "node:fs";
import path from "node:path";
import { chatGptAgentAdapter, getChatGptAgentReadiness } from "../src/lib/wizard/chatgpt-agent";
import { initialWizardState, type WizardMessage, type WizardState } from "../src/lib/wizard/types";

type EvalCase = {
  id: string;
  family: string;
  description: string;
  turns: string[];
  expect: {
    profile?: Record<string, unknown>;
    revealed?: boolean;
    activeQuestionKey?: string | null;
    lastAccepted?: boolean;
    minRecommendations?: number;
    topScoreAtLeast?: number;
    topTitle?: string;
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
  let state: WizardState = initialWizardState;
  const messages: WizardMessage[] = [];
  let lastLines: string[] = [];
  let lastAccepted = true;
  let lastRecommendations: Awaited<ReturnType<typeof agent.runTurn>>["recommendations"] = [];

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
    messages.push(...response.lines.map((text) => ({ speaker: "wizard" as const, text })));
  }

  const failures = checkExpectations(testCase, state, lastAccepted, lastLines, lastRecommendations, {
    checkExactLineText: false,
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
  options: { checkExactLineText: boolean },
) {
  const failures: string[] = [];
  const expected = testCase.expect;

  for (const [key, value] of Object.entries(expected.profile ?? {})) {
    if ((state.profile as Record<string, unknown>)[key] !== value) {
      failures.push(`Expected profile.${key}=${String(value)}, saw ${String((state.profile as Record<string, unknown>)[key])}.`);
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

  if (expected.topScoreAtLeast !== undefined && (recommendations[0]?.score ?? 0) < expected.topScoreAtLeast) {
    failures.push(`Expected top score >= ${expected.topScoreAtLeast}, saw ${recommendations[0]?.score ?? 0}.`);
  }

  if (expected.topTitle !== undefined && recommendations[0]?.game.title !== expected.topTitle) {
    failures.push(`Expected top recommendation "${expected.topTitle}", saw "${recommendations[0]?.game.title ?? "none"}".`);
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
