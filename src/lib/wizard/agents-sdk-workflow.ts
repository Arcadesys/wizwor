import {
  Agent,
  type AgentInputItem,
  ModelBehaviorError,
  type RunContext,
  Runner,
  tool,
  withTrace,
} from "@openai/agents";
import { z } from "zod";
import { catalogPlatforms, type Platform } from "@/data/games";
import type { Recommendation, UserProfile } from "@/lib/recommender";
import {
  getRecommendations,
  qualifyingRecommendations,
  recommendationGate,
  recommendationThreshold,
  maxQualifyingRecommendations,
  suggestNextQuestion,
} from "@/lib/recommender";
import { emptyAgentData } from "@/lib/wizard/agent-data";
import type { WizardTurnRequest, WizardTurnResponse } from "@/lib/wizard/types";
import { blankProfile, initialWizardState } from "@/lib/wizard/types";

const FlexibleScalarSchema = z.union([z.string(), z.number(), z.boolean()]);

// Two levels of nesting, manually unrolled (no z.lazy) — the agent occasionally
// mirrors nested objects like { inferredProfile: { traits: { confidence: 0.8 } } }
// into agentData, but a truly recursive schema makes the SDK's JSON-schema
// serializer choke on the cyclic Zod reference.
const FlexibleLeafSchema = z.union([
  FlexibleScalarSchema,
  z.array(FlexibleScalarSchema),
  z.record(z.string(), FlexibleScalarSchema),
]);

const FlexibleValueSchema = z.union([
  FlexibleLeafSchema,
  z.array(FlexibleLeafSchema),
  z.record(z.string(), FlexibleLeafSchema),
]);

const ProfileUpdateSchema = z.object({
  name: z.string().trim().optional(),
}).catchall(FlexibleValueSchema);

const CandidateProfileSchema = ProfileUpdateSchema.omit({ name: true });

type WizardRunContext = {
  enabledPlatforms: readonly Platform[];
  profile: UserProfile;
  showcaseRequest: { gameIds: string[] } | null;
};

// This tool is a capability the agent chooses to call. The fixed workflow is
// gone; scoring is exposed so the agent can decide whether the recommendation
// window is open and which real catalog entries to name. It must score against
// the same enabledPlatforms as the rest of the turn — otherwise a hypothetical
// lookup can surface ids from shelves the player has disabled, which
// resolveRecommendations then silently drops, leaving revealed: true with no cards.
const lookupRecommendationsTool = tool({
  name: "lookup_recommendations",
  description:
    "Score the real catalog (whichever platforms the player currently has enabled) against a candidate profile (any subset of fields). Returns each game's id, title, match percent, whether it clears the reveal threshold, why it matched, its pitch, and its tags. Reveal only when 1 to 3 games clear the configured threshold.",
  parameters: CandidateProfileSchema,
  execute: async (input, runContext?: RunContext<WizardRunContext>) => {
    const profile = { name: "", ...input } as UserProfile;
    const enabledPlatforms = runContext?.context.enabledPlatforms ?? [...catalogPlatforms];
    const options = scoringOptions(enabledPlatforms);
    const gate = recommendationGate(profile, options);
    return {
      thresholdPercent: Math.round(gate.threshold * 100),
      maxQualifyingMatches: gate.maxQualifying,
      qualifyingMatchCount: gate.qualifyingCount,
      recommendationWindowOpen: gate.isOpen,
      matches: getRecommendations(profile, options)
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

// Never trust the agent's ids blindly — mirrors resolveRecommendations,
// which re-scores recommendedGameIds against the real catalog rather than
// displaying whatever the model claims. Exported so the filtering/capping
// behavior is unit-testable without spinning up the full Agents SDK runner.
export function resolveShowcaseIds(
  profile: UserProfile,
  gameIds: string[],
  enabledPlatforms: readonly Platform[],
): string[] {
  const gate = recommendationGate(profile, scoringOptions(enabledPlatforms));
  const qualifyingIds = new Set(gate.recommendations.map((recommendation) => recommendation.game.id));
  return gameIds.filter((id) => qualifyingIds.has(id)).slice(0, maxQualifyingRecommendations);
}

const OpenGameShowcaseSchema = z.object({
  gameIds: z.array(z.string()).min(1).max(maxQualifyingRecommendations),
});

// The literal reveal mechanism: setting revealed/recommendedGameIds on the
// output is bookkeeping only. This tool is what the frontend actually reacts
// to (via the showcaseRequest captured on the run context, read back out in
// buildResponse), so calling it is what puts a game in front of the player.
const openGameShowcaseTool = tool({
  name: "open_game_showcase",
  description:
    "Opens the showcase window that displays 1 to 3 games to the player, each with a gameplay video, name/year/console, and why it matched. This is the only thing that actually shows a reveal — setting revealed/recommendedGameIds alone displays nothing. Call it with the winning game id(s) from currentBestMatches or a lookup_recommendations result, ranked best first, at the same moment you decide to reveal (recommendationGate.recommendationWindowOpen is true). Ids that no longer clear the reveal threshold are dropped.",
  parameters: OpenGameShowcaseSchema,
  execute: async (input, runContext?: RunContext<WizardRunContext>) => {
    const profile = runContext?.context.profile ?? blankProfile;
    const enabledPlatforms = runContext?.context.enabledPlatforms ?? [...catalogPlatforms];
    const gameIds = resolveShowcaseIds(profile, input.gameIds, enabledPlatforms);

    if (runContext) {
      runContext.context.showcaseRequest = gameIds.length ? { gameIds } : null;
    }

    return gameIds.length
      ? { opened: true, gameIds }
      : { opened: false, reason: "none of the supplied ids currently clear the reveal threshold" };
  },
});

const AgentGeneratedDataSchema = z.record(z.string(), FlexibleValueSchema).default({});

export const WizardTurnOutputSchema = z.object({
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

const liveWizardAgent = new Agent<WizardRunContext, typeof WizardTurnOutputSchema>({
  name: "Wyrmwood terminal guide",
  instructions: [
    "You are the Keeper Beneath the Screen, an ominous 1980s arcade terminal guide helping a player find a classic-console game.",
    "Do not use Wizard of Wor branding, quotes, assets, or impersonation.",
    "Have a natural, unscripted conversation. There is no fixed question order and no single 'current question' — never reject a reply just because it named something other than whatever you last asked about.",
    "The player profile is flexible. From their message and recent conversation, return any fields or generated dimensions you believe are useful. Prefer concise string or number values. Do not force the player into canned choices.",
    "When you want the built-in catalog scorer to help, you may use these compatible catalog fields with these values: mood=ominous|heroic|weird|arcade|contemplative; playStyle=side-scroller|top-down|action-adventure|platformer|puzzle; difficulty=casual|fair|difficult; story=low|some|rich; obscurity=classic|hidden-gem|strange; romhack=no|curious|yes. These are compatibility handles for scoring, not UI choices the player must see.",
    "The catalog is now the full NES/Famicom library (~2000 titles), so those six coarse fields alone can leave dozens of games tied. Also return profile.keywords: an array of lowercase free-text descriptor words pulled from what the player actually said — named games, genres, designers, specific mechanics or vibes (e.g. ['gothic', 'branching paths'] for a Castlevania III-like request). These are matched against each game's tags and pitch to break ties the coarse fields can't.",
    "Do not require the player's name for anything. If they offer a name, remember it in memoryMarkdown and optionally include it in profile.name; otherwise omit profile.name.",
    "You maintain the player's durable MEMORY.md. Every turn receives the current Markdown memory. Return memoryMarkdown only when you learned something durable: name, preferences, terminal color wishes, games previously played, games rejected, accessibility/audio/style preferences, or useful notes. Keep the Markdown compact, preserving the headings: Player, Preferences, Games Previously Played, Notes.",
    "If the player asks to change terminal colors, update memoryMarkdown and return terminalTheme with CSS hex colors for the requested palette. Use background, foreground, green, amber, red, and blue keys when relevant.",
    `After the player answers what system they are questing on, messages include recommendationGate: the real catalog scored against the profile as currently known. Reveal only when recommendationGate.recommendationWindowOpen is true, meaning 1 to ${maxQualifyingRecommendations} games score at least ${Math.round(recommendationThreshold * 100)}%. Call the lookup_recommendations tool only when you want to test a hypothetical profile different from the known one (e.g. 'what if difficulty were X'); you don't need it just to see the current picture.`,
    "Only ever recommend real games from currentBestMatches or a tool result — copy their exact id into recommendedGameIds (at most 3, ranked by how well they fit). Never invent, describe, or score a game yourself. If revealed is false, leave recommendedGameIds empty.",
    "Setting revealed: true and recommendedGameIds does not by itself display anything to the player — it's bookkeeping. To actually show a reveal, call the open_game_showcase tool with the same id(s) (at most 3, ranked best first) at the same moment you set revealed: true. That tool call is what opens the showcase window; skipping it means the player sees nothing even though you decided to reveal.",
    "When too many games qualify, every message includes suggestedNextQuestion: computed like a well-played round of 20 Questions or Guess Who — the unanswered field+value that splits the current candidate pool closest to 50/50, so whichever way the player answers eliminates the most ground. When it's present, build your next question around that exact field (e.g. if it's {key: \"playStyle\", value: \"puzzle\"}, ask something like whether they want a puzzle game or something else) — phrase it naturally, don't recite the field name. When it's null (pool is already small, or nothing left discriminates), fall back to your own judgment from currentBestMatches.",
    "Commit when it's time — do not stall. Two situations require revealed: true this turn, using your best current pick, even with fields still unknown or the match imperfect: (1) the player explicitly hands you the decision — 'I don't care', 'you choose', 'whatever's best', 'just pick one', 'are you going to choose?' or similar — reveal immediately, do not ask yet another clarifying question first; (2) the conversation has already gone several exchanges without revealing and currentBestMatches already has a reasonably strong option — stop circling and commit rather than asking for one more detail.",
    "If a request names something very specific — a genre, a designer, a historical or cultural detail — check pitch/tags for a strong, specific match worth calling out by name and inference (e.g. a request for a notable multiplayer board-game-style NES title should lead you to feature what you find, tags and pitch included, if it's a clear fit).",
    "If the player asks for games with trans creators or trans influence, answer from catalog evidence only. Treat creative influence broadly: designers, programmers, writers, artists, translators, localizers, and fan-translation contributors can count when the catalog evidence supports it. Do not confuse the word 'translation' with trans identity, and do not invent identities or credits not present in pitch/tags. In the current catalog, M.U.L.E. is the known trans-history match through Danielle Bunten Berry.",
    "Use agentData for any extra data you generated or consumed mentally: category scores, inferred traits, uncertainty notes, rejected options, scoring rationale, or other compact debug fields. Keep every agentData value shallow: strings, numbers, booleans, arrays of those, or at most one nested object of those (e.g. inferredProfile: { mood: \"heroic\", confidence: 0.8 }). Never nest an object inside another object or inside an array entry.",
    "If their message gives you nothing usable for any field, set accepted to false and warmly ask, in your own words, for whatever still seems missing.",
    "Keep lines terse, arcade-synthetic, readable on a tiny CRT — 1 to 3 short lines.",
    "The very first reply of a session always ends with 'Greetings Gamer! What console are you questing on today?' (added automatically) — don't ask about platform/system yourself on turn one. The catalog now spans NES, SNES, Genesis, PC Engine, Neo Geo, Atari 7800/5200, SMS, and romhacks — after the player names a system, currentBestMatches and gamesAboveThreshold are filtered to whichever platforms the player has enabled in Catalog Shelves, so acknowledge whatever system they name in-character and let those filtered lists guide your pick rather than assuming NES.",
  ].join("\n"),
  model: process.env.WIZARD_AGENT_MODEL || "gpt-5.5",
  modelSettings: {
    reasoning: {
      effort: "low",
      summary: "auto",
    },
    store: true,
  },
  tools: [lookupRecommendationsTool, openGameShowcaseTool],
  outputType: WizardTurnOutputSchema,
});

function scoringOptions(enabledPlatforms: readonly Platform[]) {
  return { enabledPlatforms };
}

function currentBestMatches(profile: UserProfile, enabledPlatforms: readonly Platform[]) {
  return getRecommendations(profile, scoringOptions(enabledPlatforms))
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

function gamesAboveThreshold(profile: UserProfile, enabledPlatforms: readonly Platform[]) {
  // qualifyingRecommendations is unbounded by count (unlike lookup_recommendations'
  // .slice(0, 8) below), so a broad, single-dimension profile against the ~2000-game
  // catalog could otherwise serialize hundreds of matches into the agent's context
  // and the client-facing agentData payload on every turn.
  return qualifyingRecommendations(profile, scoringOptions(enabledPlatforms))
    .slice(0, 8)
    .map((recommendation) => ({
      id: recommendation.game.id,
      title: recommendation.game.title,
      matchPercent: Math.round(recommendation.score * 100),
      reasons: recommendation.reasons,
      pitch: recommendation.game.pitch,
      tags: recommendation.game.tags,
    }));
}

const MAX_OUTPUT_SCHEMA_ATTEMPTS = 2;

// The Agents SDK throws the same ModelBehaviorError class for very different
// problems: bad tool-call input, no final response, malformed model output
// items, and (what we're targeting here) the final assistant JSON failing
// WizardTurnOutputSchema. Its message is always "Invalid output type: ..." and,
// for Zod failures, embeds the first invalid field's path (see
// formatFinalOutputTypeError in @openai/agents-core's turnResolution.js). Only
// treat it as recoverable when that path is under agentData — agentData is
// diagnostic-only and not load-bearing for the recommendation, but a failure
// anywhere else (e.g. a malformed `lines` array) is a real problem and must
// still propagate instead of being silently swallowed.
export function isAgentDataSchemaError(error: unknown): error is ModelBehaviorError {
  return (
    error instanceof ModelBehaviorError &&
    error.message.startsWith("Invalid output type:") &&
    /at "agentData(\.[^"]*)?"/.test(error.message)
  );
}

// Retry once (the model's nesting mistakes aren't fully deterministic), then
// fall back to an in-character line rather than propagating a 503.
async function runAgentTurnResilient(
  runner: Runner,
  agent: typeof liveWizardAgent,
  conversationHistory: AgentInputItem[],
  runContext: WizardRunContext,
) {
  for (let attempt = 1; attempt <= MAX_OUTPUT_SCHEMA_ATTEMPTS; attempt++) {
    // Reset per attempt: a retry re-runs the agent from scratch, so a
    // showcase request captured during a failed attempt must not leak into
    // the retry's result.
    runContext.showcaseRequest = null;
    try {
      return await runner.run(agent, conversationHistory, {
        context: runContext,
      });
    } catch (error) {
      if (!isAgentDataSchemaError(error) || attempt === MAX_OUTPUT_SCHEMA_ATTEMPTS) {
        throw error;
      }
    }
  }
  throw new Error("unreachable");
}

function fallbackTurnOutput(): WizardTurnOutput {
  return {
    lines: ["The signal broke up in the deep circuitry. Say that again?"],
    accepted: false,
    profile: {},
    revealed: false,
    recommendedGameIds: [],
    agentData: {},
  };
}

export function isFirstWizardTurn(request: WizardTurnRequest) {
  return !request.messages.some((message) => message.speaker === "wizard");
}

export function buildConsumedTurnContext(request: WizardTurnRequest, knownProfile: UserProfile) {
  const enabledPlatforms = request.state.enabledPlatforms ?? [...catalogPlatforms];
  const consumed: Record<string, unknown> = {
    command: request.command,
    knownProfile,
    enabledPlatforms,
    memoryMarkdown: request.state.memoryMarkdown,
    terminalTheme: request.state.terminalTheme,
    exchangesSoFar: request.messages.length,
    recentMessages: request.messages.slice(-8),
  };

  if (isFirstWizardTurn(request)) {
    return consumed;
  }

  const options = scoringOptions(enabledPlatforms);
  const gate = recommendationGate(knownProfile, options);
  return {
    ...consumed,
    recommendationGate: {
      thresholdPercent: Math.round(recommendationThreshold * 100),
      maxQualifyingMatches: maxQualifyingRecommendations,
      qualifyingMatchCount: gate.qualifyingCount,
      recommendationWindowOpen: gate.isOpen,
    },
    gamesAboveThreshold: gamesAboveThreshold(knownProfile, enabledPlatforms),
    currentBestMatches: currentBestMatches(knownProfile, enabledPlatforms),
    suggestedNextQuestion: suggestNextQuestion(knownProfile, options),
  };
}

async function runWizardConversationTurn(request: WizardTurnRequest, knownProfile: UserProfile) {
  return withTrace("Wizard live turn", async () => {
    const enabledPlatforms = request.state.enabledPlatforms ?? [...catalogPlatforms];
    const consumed = buildConsumedTurnContext(request, knownProfile);
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
    const runContext: WizardRunContext = {
      enabledPlatforms,
      profile: knownProfile,
      showcaseRequest: null,
    };
    let result;
    try {
      result = await runAgentTurnResilient(runner, liveWizardAgent, conversationHistory, runContext);
    } catch (error) {
      if (isAgentDataSchemaError(error)) {
        return { output: fallbackTurnOutput(), consumed, showcaseRequest: null };
      }
      throw error;
    }

    if (!result.finalOutput) {
      throw new Error("Agent result is undefined");
    }

    return {
      output: result.finalOutput as WizardTurnOutput,
      consumed,
      showcaseRequest: runContext.showcaseRequest,
    };
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
function resolveRecommendations(profile: UserProfile, ids: string[], enabledPlatforms: readonly Platform[]): Recommendation[] {
  const gate = recommendationGate(profile, scoringOptions(enabledPlatforms));
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
  enabledPlatforms: Platform[],
  consumed: Record<string, unknown>,
  includeRecommendationContext = true,
  showcaseRequest: { gameIds: string[] } | null = null,
): WizardTurnResponse {
  const recommendations = includeRecommendationContext && output.revealed
    ? resolveRecommendations(profile, output.recommendedGameIds, enabledPlatforms)
    : [];
  const revealed = output.revealed && recommendations.length > 0;
  const gate = includeRecommendationContext ? recommendationGate(profile, scoringOptions(enabledPlatforms)) : null;
  const showcaseGames = includeRecommendationContext && showcaseRequest?.gameIds.length
    ? resolveRecommendations(profile, showcaseRequest.gameIds, enabledPlatforms)
    : [];

  return {
    lines: output.lines,
    state: {
      ...initialWizardState,
      started: true,
      profile,
      enabledPlatforms,
      revealed,
      memoryMarkdown: output.memoryMarkdown?.trim() || initialWizardState.memoryMarkdown,
      terminalTheme: output.terminalTheme,
    },
    suggestions: [],
    recommendations,
    accepted: output.accepted,
    adapter: "chatgpt",
    agentData: gate
      ? {
          thresholdPercent: Math.round(recommendationThreshold * 100),
          maxQualifyingMatches: maxQualifyingRecommendations,
          qualifyingMatchCount: gate.qualifyingCount,
          recommendationWindowOpen: gate.isOpen,
          gamesAboveThreshold: gamesAboveThreshold(profile, enabledPlatforms),
          currentBestMatches: currentBestMatches(profile, enabledPlatforms),
          consumed,
          generated: output.agentData ?? {},
        }
      : emptyAgentData(consumed, output.agentData ?? {}),
    showcase: showcaseGames.length ? { games: showcaseGames } : null,
  };
}

const FIRST_TURN_QUESTION = "Greetings Gamer! What console are you questing on today?";

// The model's own opening line is never guaranteed to ask this, so enforce it
// deterministically on turn one rather than relying purely on the prompt.
export function ensureFirstTurnQuestion(lines: string[]): string[] {
  const alreadyAsked = lines.some((line) =>
    line.toLowerCase().includes("what console are you questing on today"),
  );
  if (alreadyAsked) {
    return lines.slice(0, 4);
  }
  return [...lines.slice(0, 3), FIRST_TURN_QUESTION];
}

export async function runLiveWizardTurn(request: WizardTurnRequest): Promise<WizardTurnResponse> {
  const knownProfile: UserProfile = { ...blankProfile, ...request.state.profile };
  const { output, consumed, showcaseRequest } = await runWizardConversationTurn(request, knownProfile);
  const nextProfile = mergeProfile(knownProfile, output.profile);
  const isFirstTurn = isFirstWizardTurn(request);
  return buildResponse(
    {
      ...output,
      lines: isFirstTurn ? ensureFirstTurnQuestion(output.lines) : output.lines,
      memoryMarkdown: output.memoryMarkdown ?? request.state.memoryMarkdown,
      terminalTheme: output.terminalTheme ?? request.state.terminalTheme,
    },
    nextProfile,
    request.state.enabledPlatforms ?? [...catalogPlatforms],
    consumed,
    !isFirstTurn,
    showcaseRequest,
  );
}
