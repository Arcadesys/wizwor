import { Agent, type AgentInputItem, Runner, tool, withTrace } from "@openai/agents";
import { z } from "zod";
import type { Recommendation, UserProfile } from "@/lib/recommender";
import {
  getRecommendations,
  recommendationGate,
  recommendationThreshold,
  maxQualifyingRecommendations,
} from "@/lib/recommender";
import { questions } from "@/lib/wizard/questions";
import type { WizardTurnRequest, WizardTurnResponse } from "@/lib/wizard/types";
import { blankProfile, initialWizardState } from "@/lib/wizard/types";

function enumValuesFor(key: (typeof questions)[number]["key"]) {
  const values = questions.find((question) => question.key === key)!.options.map((option) => option.value);
  return values as [string, ...string[]];
}

const ProfileUpdateSchema = z.object({
  name: z.string().trim().min(1).optional(),
  mood: z.enum(enumValuesFor("mood")).optional(),
  playStyle: z.enum(enumValuesFor("playStyle")).optional(),
  difficulty: z.enum(enumValuesFor("difficulty")).optional(),
  story: z.enum(enumValuesFor("story")).optional(),
  obscurity: z.enum(enumValuesFor("obscurity")).optional(),
  romhack: z.enum(enumValuesFor("romhack")).optional(),
});

const CandidateProfileSchema = ProfileUpdateSchema.omit({ name: true });

// This tool is a capability the agent chooses to call. The fixed workflow is
// gone; scoring is exposed so the agent can decide whether the recommendation
// window is open and which real catalog entries to name.
const lookupRecommendationsTool = tool({
  name: "lookup_recommendations",
  description:
    "Score the real NES catalog against a candidate profile (any subset of fields). Returns each game's id, title, match percent, whether it clears the reveal threshold, why it matched, its pitch, and its tags. Reveal only when 1 to 3 games clear the configured threshold.",
  parameters: CandidateProfileSchema,
  execute: async (input) => {
    const profile = { name: "", ...input } as UserProfile;
    const gate = recommendationGate(profile);
    return {
      thresholdPercent: Math.round(gate.threshold * 100),
      maxQualifyingMatches: gate.maxQualifying,
      qualifyingMatchCount: gate.qualifyingCount,
      recommendationWindowOpen: gate.isOpen,
      matches: getRecommendations(profile)
        .slice(0, 8)
        .map((recommendation) => ({
          id: recommendation.game.id,
          title: recommendation.game.title,
          matchPercent: Math.round(recommendation.score * 100),
          clearsThreshold: recommendation.score >= gate.threshold,
          reasons: recommendation.reasons,
          pitch: recommendation.game.pitch,
          tags: recommendation.game.tags,
        })),
    };
  },
});

const WizardTurnOutputSchema = z.object({
  lines: z.array(z.string()).min(1).max(4),
  accepted: z.boolean(),
  profile: ProfileUpdateSchema,
  revealed: z.boolean(),
  recommendedGameIds: z.array(z.string()).max(3).default([]),
});

type WizardTurnOutput = z.infer<typeof WizardTurnOutputSchema>;

function buildFieldLegend() {
  return questions
    .map((question) => {
      const options = question.options.map((option) => `${option.value} (${option.label}: ${option.detail})`).join("; ");
      return `- ${question.key}: ${options}`;
    })
    .join("\n");
}

const liveWizardAgent = new Agent({
  name: "Wyrmwood terminal guide",
  instructions: [
    "You are the Keeper Beneath the Screen, an ominous 1980s arcade terminal guide helping a player find an NES game.",
    "Do not use Wizard of Wor branding, quotes, assets, or impersonation.",
    "Have a natural, unscripted conversation. There is no fixed question order and no single 'current question' — never reject a reply just because it named something other than whatever you last asked about.",
    "The player has a profile with the fields below. From their message (and the recent conversation), fill in any field it clearly supports, in any order, across one or more messages. Only ever set a field to one of its exact listed values — never invent a new value. Leave a field out entirely if you're not confident.",
    buildFieldLegend(),
    "Also capture their name whenever they state or imply it, in their own words.",
    `You decide when there's enough to recommend and when to keep talking instead. Every message includes recommendationGate: the real catalog scored against the profile as currently known. Reveal only when recommendationGate.recommendationWindowOpen is true, meaning 1 to ${maxQualifyingRecommendations} games score at least ${Math.round(recommendationThreshold * 100)}%. Call the lookup_recommendations tool only when you want to test a hypothetical profile different from the known one (e.g. 'what if difficulty were X'); you don't need it just to see the current picture.`,
    "Only ever recommend real games from currentBestMatches or a tool result — copy their exact id into recommendedGameIds (at most 3, ranked by how well they fit). Never invent, describe, or score a game yourself. If revealed is false, leave recommendedGameIds empty.",
    "Commit when it's time — do not stall. Two situations require revealed: true this turn, using your best current pick, even with fields still unknown or the match imperfect: (1) the player explicitly hands you the decision — 'I don't care', 'you choose', 'whatever's best', 'just pick one', 'are you going to choose?' or similar — reveal immediately, do not ask yet another clarifying question first; (2) the conversation has already gone several exchanges without revealing and currentBestMatches already has a reasonably strong option — stop circling and commit rather than asking for one more detail.",
    "If a request names something very specific — a genre, a designer, a historical or cultural detail — check pitch/tags for a strong, specific match worth calling out by name and inference (e.g. a request for a notable multiplayer board-game-style NES title should lead you to feature what you find, tags and pitch included, if it's a clear fit).",
    "If their message gives you nothing usable for any field, set accepted to false and warmly ask, in your own words, for whatever still seems missing.",
    "Keep lines terse, arcade-synthetic, readable on a tiny CRT — 1 to 3 short lines.",
  ].join("\n"),
  model: process.env.WIZARD_AGENT_MODEL || "gpt-5.5",
  modelSettings: {
    reasoning: {
      effort: "low",
      summary: "auto",
    },
    store: true,
  },
  tools: [lookupRecommendationsTool],
  outputType: WizardTurnOutputSchema,
});

function currentBestMatches(profile: UserProfile) {
  return getRecommendations(profile)
    .slice(0, 5)
    .map((recommendation) => ({
      id: recommendation.game.id,
      title: recommendation.game.title,
      matchPercent: Math.round(recommendation.score * 100),
      clearsThreshold: recommendation.score >= recommendationThreshold,
      reasons: recommendation.reasons,
      pitch: recommendation.game.pitch,
      tags: recommendation.game.tags,
    }));
}

async function runWizardConversationTurn(request: WizardTurnRequest, knownProfile: UserProfile) {
  return withTrace("Wizard live turn", async () => {
    const conversationHistory: AgentInputItem[] = [
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: JSON.stringify(
              {
                command: request.command,
                knownProfile,
                recommendationGate: {
                  thresholdPercent: Math.round(recommendationThreshold * 100),
                  maxQualifyingMatches: maxQualifyingRecommendations,
                  qualifyingMatchCount: recommendationGate(knownProfile).qualifyingCount,
                  recommendationWindowOpen: recommendationGate(knownProfile).isOpen,
                },
                currentBestMatches: currentBestMatches(knownProfile),
                exchangesSoFar: request.messages.length,
                recentMessages: request.messages.slice(-8),
              },
              null,
              2,
            ),
          },
        ],
      },
    ];
    const runner = new Runner({
      traceMetadata: {
        __trace_source__: "agent-builder",
        app: "wizwor",
      },
    });
    const result = await runner.run(liveWizardAgent, conversationHistory);

    if (!result.finalOutput) {
      throw new Error("Agent result is undefined");
    }

    return result.finalOutput as WizardTurnOutput;
  });
}

function mergeProfile(current: UserProfile, update: WizardTurnOutput["profile"]): UserProfile {
  return {
    ...current,
    ...(update.name ? { name: update.name } : {}),
    ...(update.mood ? { mood: update.mood as UserProfile["mood"] } : {}),
    ...(update.playStyle ? { playStyle: update.playStyle as UserProfile["playStyle"] } : {}),
    ...(update.difficulty ? { difficulty: update.difficulty as UserProfile["difficulty"] } : {}),
    ...(update.story ? { story: update.story as UserProfile["story"] } : {}),
    ...(update.obscurity ? { obscurity: update.obscurity as UserProfile["obscurity"] } : {}),
    ...(update.romhack ? { romhack: update.romhack as UserProfile["romhack"] } : {}),
  };
}

// The agent decides *whether* to reveal and *which* games to name (recommendedGameIds).
// This just looks up real score/reasons for whichever ids it picked, so the UI never
// displays a hallucinated number — the decision stays the agent's, the arithmetic is ours.
function resolveRecommendations(profile: UserProfile, ids: string[]): Recommendation[] {
  const gate = recommendationGate(profile);
  if (!gate.isOpen) {
    return [];
  }

  const scoredById = new Map(gate.recommendations.map((recommendation) => [recommendation.game.id, recommendation]));
  return ids
    .map((id) => scoredById.get(id))
    .filter((recommendation): recommendation is Recommendation => Boolean(recommendation));
}

function buildResponse(output: WizardTurnOutput, profile: UserProfile): WizardTurnResponse {
  const recommendations = output.revealed ? resolveRecommendations(profile, output.recommendedGameIds) : [];
  const revealed = output.revealed && recommendations.length > 0;

  return {
    lines: output.lines,
    state: {
      ...initialWizardState,
      started: true,
      profile,
      revealed,
    },
    suggestions: [],
    recommendations,
    accepted: output.accepted,
    adapter: "chatgpt",
  };
}

export async function runLiveWizardTurn(request: WizardTurnRequest): Promise<WizardTurnResponse> {
  const knownProfile: UserProfile = { ...blankProfile, ...request.state.profile };
  const output = await runWizardConversationTurn(request, knownProfile);
  const nextProfile = mergeProfile(knownProfile, output.profile);
  return buildResponse(output, nextProfile);
}
