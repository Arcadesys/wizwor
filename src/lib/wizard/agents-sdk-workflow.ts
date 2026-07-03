import { Agent, type AgentInputItem, Runner, withTrace } from "@openai/agents";
import type { WizardTurnRequest, WizardTurnResponse } from "@/lib/wizard/types";

type WorkflowInput = {
  input_as_text: string;
};

type LiveWizardTurn = {
  lines?: string[];
  accepted?: boolean;
};

const liveWizardAgent = new Agent({
  name: "Wyrmwood terminal guide",
  instructions: [
    "You are the Keeper Beneath the Screen, an original 1980s arcade terminal guide.",
    "You receive a deterministic baseline response for an NES recommender app.",
    "Rewrite only the wizard lines when useful. Keep them terse, ominous, arcade-synthetic, and readable on a tiny CRT.",
    "Do not use Wizard of Wor branding, quotes, assets, or impersonation.",
    "Do not change profile state, recommendations, scores, or suggestions.",
    "Return only valid JSON with this shape: {\"lines\":[\"...\"],\"accepted\":true}.",
    "If the baseline rejected the answer, keep accepted false and make the line a brief clarification.",
  ].join("\n"),
  model: process.env.WIZARD_AGENT_MODEL || "gpt-5.5",
  modelSettings: {
    reasoning: {
      effort: "low",
      summary: "auto",
    },
    store: true,
  },
});

export async function runWorkflow(workflow: WorkflowInput) {
  return await withTrace("Agent builder workflow", async () => {
    const conversationHistory: AgentInputItem[] = [
      { role: "user", content: [{ type: "input_text", text: workflow.input_as_text }] },
    ];
    const runner = new Runner({
      traceMetadata: {
        __trace_source__: "agent-builder",
        app: "wizwor",
      },
    });
    const result = await runner.run(liveWizardAgent, [...conversationHistory]);
    conversationHistory.push(...result.newItems.map((item) => item.rawItem));

    if (!result.finalOutput) {
      throw new Error("Agent result is undefined");
    }

    return {
      output_text: String(result.finalOutput),
    };
  });
}

export async function runLiveWizardTurn(request: WizardTurnRequest, baseline: WizardTurnResponse) {
  const workflow = await runWorkflow({
    input_as_text: JSON.stringify(
      {
        task: "Return the live wizard turn JSON. Preserve the baseline contract.",
        command: request.command,
        state: request.state,
        recentMessages: request.messages.slice(-8),
        baseline: {
          lines: baseline.lines,
          accepted: baseline.accepted,
          state: baseline.state,
          suggestions: baseline.suggestions,
          recommendations: baseline.recommendations.map((recommendation) => ({
            title: recommendation.game.title,
            score: recommendation.score,
            reasons: recommendation.reasons,
          })),
        },
      },
      null,
      2,
    ),
  });

  return parseLiveWizardTurn(workflow.output_text);
}

function parseLiveWizardTurn(rawOutput: string): LiveWizardTurn {
  const parsed = JSON.parse(stripJsonFence(rawOutput)) as LiveWizardTurn;
  const lines = Array.isArray(parsed.lines)
    ? parsed.lines.filter((line): line is string => typeof line === "string" && line.trim().length > 0).slice(0, 4)
    : undefined;

  return {
    lines,
    accepted: typeof parsed.accepted === "boolean" ? parsed.accepted : undefined,
  };
}

function stripJsonFence(value: string) {
  return value
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/i, "")
    .trim();
}
