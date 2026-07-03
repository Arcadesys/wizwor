import { Agent, type AgentInputItem, Runner, tool, withTrace } from "@openai/agents";
import { z } from "zod";
import type { Recommendation, UserProfile } from "@/lib/recommender";
import {
  getRecommendations,
  qualifyingRecommendations,
  recommendationGate,
  recommendationThreshold,
  maxQualifyingRecommendations,
} from "@/lib/recommender";
import type { WizardTurnRequest, WizardTurnResponse } from "@/lib/wizard/types";
import { blankProfile, initialWizardState } from "@/lib/wizard/types";

const FlexibleScalarSchema = z.union([z.string(), z.number(), z.boolean()]);

// One level of nesting only (no z.lazy) — the agent occasionally mirrors flat
// objects like recommendationGate into agentData, but a truly recursive schema
// makes the SDK's JSON-schema serializer choke on the cyclic Zod reference.
const FlexibleValueSchema = z.union([
  FlexibleScalarSchema,
  z.array(FlexibleScalarSchema),
  z.record(z.string(), FlexibleScalarSchema),
]);

const ProfileUpdateSchema = z.object({
  name: z.string().trim().optional(),
}).catchall(FlexibleValueSchema);

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

const AgentGeneratedDataSchema = z.record(z.string(), FlexibleValueSchema).default({});

const WizardTurnOutputSchema = z.object({
  lines: z.array(z.string()).min(1).max(4),
  accepted: z.boolean(),
  profile: ProfileUpdateSchema.default({}),
  memoryMarkdown: z.string().optional(),
  terminalTheme: z
    .object({
      background: z.string().optional(),
      foreground: z.string().optional(),
      green: z.string().optional(),
      amber: z.string().optional(),
      red: z.string().optional(),
      blue: z.string().optional(),
    })
    .optional(),
  revealed: z.boolean(),
  recommendedGameIds: z.array(z.string()).max(3).default([]),
  agentData: AgentGeneratedDataSchema,
});

type WizardTurnOutput = z.infer<typeof WizardTurnOutputSchema>;

const liveWizardAgent = new Agent({
  name: "Wyrmwood terminal guide",
  instructions: [
    "You are the Keeper Beneath the Screen, an ominous 1980s arcade terminal guide helping a player find an NES game.",
    "Do not use Wizard of Wor branding, quotes, assets, or impersonation.",
    "Have a natural, unscripted conversation. There is no fixed question order and no single 'current question' — never reject a reply just because it named something other than whatever you last asked about.",
    "The player profile is flexible. From their message and recent conversation, return any fields or generated dimensions you believe are useful. Prefer concise string or number values. Do not force the player into canned choices.",
    "When you want the built-in catalog scorer to help, you may use these compatible catalog fields with these values: mood=ominous|heroic|weird|arcade|contemplative; playStyle=side-scroller|top-down|action-adventure|platformer|puzzle; difficulty=casual|fair|difficult; story=low|some|rich; obscurity=classic|hidden-gem|strange; romhack=no|curious|yes. These are compatibility handles for scoring, not UI choices the player must see.",
    "The catalog is now the full NES/Famicom library (~2000 titles), so those six coarse fields alone can leave dozens of games tied. Also return profile.keywords: an array of lowercase free-text descriptor words pulled from what the player actually said — named games, genres, designers, specific mechanics or vibes (e.g. ['gothic', 'branching paths'] for a Castlevania III-like request). These are matched against each game's tags and pitch to break ties the coarse fields can't.",
    "Do not require the player's name for anything. If they offer a name, remember it in memoryMarkdown and optionally include it in profile.name; otherwise omit profile.name.",
    "You maintain the player's durable MEMORY.md. Every turn receives the current Markdown memory. Return memoryMarkdown only when you learned something durable: name, preferences, terminal color wishes, games previously played, games rejected, accessibility/audio/style preferences, or useful notes. Keep the Markdown compact, preserving the headings: Player, Preferences, Games Previously Played, Notes.",
    "If the player asks to change terminal colors, update memoryMarkdown and return terminalTheme with CSS hex colors for the requested palette. Use background, foreground, green, amber, red, and blue keys when relevant.",
    `You decide when there's enough to recommend and when to keep talking instead. Every message includes recommendationGate: the real catalog scored against the profile as currently known. Reveal only when recommendationGate.recommendationWindowOpen is true, meaning 1 to ${maxQualifyingRecommendations} games score at least ${Math.round(recommendationThreshold * 100)}%. Call the lookup_recommendations tool only when you want to test a hypothetical profile different from the known one (e.g. 'what if difficulty were X'); you don't need it just to see the current picture.`,
    "Only ever recommend real games from currentBestMatches or a tool result — copy their exact id into recommendedGameIds (at most 3, ranked by how well they fit). Never invent, describe, or score a game yourself. If revealed is false, leave recommendedGameIds empty.",
    "When picking your next question, look at currentBestMatches and ask about whatever would split that field roughly in half rather than a generic question. E.g. if the leading candidates are a side-scroller and a puzzle game (say, Contra and Batman vs. Tetris), ask about playStyle — side-scroller or puzzle — since that's the axis actually separating them, not something both share.",
    "Commit when it's time — do not stall. Two situations require revealed: true this turn, using your best current pick, even with fields still unknown or the match imperfect: (1) the player explicitly hands you the decision — 'I don't care', 'you choose', 'whatever's best', 'just pick one', 'are you going to choose?' or similar — reveal immediately, do not ask yet another clarifying question first; (2) the conversation has already gone several exchanges without revealing and currentBestMatches already has a reasonably strong option — stop circling and commit rather than asking for one more detail.",
    "If a request names something very specific — a genre, a designer, a historical or cultural detail — check pitch/tags for a strong, specific match worth calling out by name and inference (e.g. a request for a notable multiplayer board-game-style NES title should lead you to feature what you find, tags and pitch included, if it's a clear fit).",
    "Use agentData for any extra data you generated or consumed mentally: category scores, inferred traits, uncertainty notes, rejected options, scoring rationale, or other compact debug fields.",
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

function gamesAboveThreshold(profile: UserProfile) {
  return qualifyingRecommendations(profile).map((recommendation) => ({
    id: recommendation.game.id,
    title: recommendation.game.title,
    matchPercent: Math.round(recommendation.score * 100),
    reasons: recommendation.reasons,
    pitch: recommendation.game.pitch,
    tags: recommendation.game.tags,
  }));
}

async function runWizardConversationTurn(request: WizardTurnRequest, knownProfile: UserProfile) {
  return withTrace("Wizard live turn", async () => {
    const gate = recommendationGate(knownProfile);
    const consumed = {
      command: request.command,
      knownProfile,
      memoryMarkdown: request.state.memoryMarkdown,
      terminalTheme: request.state.terminalTheme,
      recommendationGate: {
        thresholdPercent: Math.round(recommendationThreshold * 100),
        maxQualifyingMatches: maxQualifyingRecommendations,
        qualifyingMatchCount: gate.qualifyingCount,
        recommendationWindowOpen: gate.isOpen,
      },
      gamesAboveThreshold: gamesAboveThreshold(knownProfile),
      currentBestMatches: currentBestMatches(knownProfile),
      exchangesSoFar: request.messages.length,
      recentMessages: request.messages.slice(-8),
    };
    const conversationHistory: AgentInputItem[] = [
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: JSON.stringify(consumed, null, 2),
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

    return { output: result.finalOutput as WizardTurnOutput, consumed };
  });
}

function mergeProfile(current: UserProfile, update: WizardTurnOutput["profile"]): UserProfile {
  return {
    ...current,
    ...update,
    ...(typeof update.name === "string" && update.name.trim() ? { name: update.name.trim() } : {}),
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

function buildResponse(
  output: WizardTurnOutput,
  profile: UserProfile,
  consumed: Record<string, unknown>,
): WizardTurnResponse {
  const recommendations = output.revealed ? resolveRecommendations(profile, output.recommendedGameIds) : [];
  const revealed = output.revealed && recommendations.length > 0;
  const gate = recommendationGate(profile);

  return {
    lines: output.lines,
    state: {
      ...initialWizardState,
      started: true,
      profile,
      revealed,
      memoryMarkdown: output.memoryMarkdown?.trim() || initialWizardState.memoryMarkdown,
      terminalTheme: output.terminalTheme,
    },
    suggestions: [],
    recommendations,
    accepted: output.accepted,
    adapter: "chatgpt",
    agentData: {
      thresholdPercent: Math.round(recommendationThreshold * 100),
      maxQualifyingMatches: maxQualifyingRecommendations,
      qualifyingMatchCount: gate.qualifyingCount,
      recommendationWindowOpen: gate.isOpen,
      gamesAboveThreshold: gamesAboveThreshold(profile),
      currentBestMatches: currentBestMatches(profile),
      consumed,
      generated: output.agentData ?? {},
    },
  };
}

export async function runLiveWizardTurn(request: WizardTurnRequest): Promise<WizardTurnResponse> {
  const knownProfile: UserProfile = { ...blankProfile, ...request.state.profile };
  const { output, consumed } = await runWizardConversationTurn(request, knownProfile);
  const nextProfile = mergeProfile(knownProfile, output.profile);
  return buildResponse(
    {
      ...output,
      memoryMarkdown: output.memoryMarkdown ?? request.state.memoryMarkdown,
      terminalTheme: output.terminalTheme ?? request.state.terminalTheme,
    },
    nextProfile,
    consumed,
  );
}
