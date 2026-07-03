import type { PreferenceKey, UserProfile } from "@/lib/recommender";
import {
  answeredPreferenceCount,
  getRecommendations,
  recommendationThreshold,
  shouldRevealRecommendations,
} from "@/lib/recommender";
import type { WizardAgent } from "@/lib/wizard/agent";
import {
  extractNameFromIntro,
  extractProfileSignals,
  inferDirectAskProfile,
  interpretFocusAnswer,
  interpretQuestionAnswer,
} from "@/lib/wizard/interpreter";
import { focusQuestion, getQuestionByKey, questions } from "@/lib/wizard/questions";
import type { WizardOption, WizardState, WizardTurnResponse } from "@/lib/wizard/types";
import { blankProfile, initialWizardState } from "@/lib/wizard/types";

function describeProfileValue(key: PreferenceKey, value: string) {
  const question = getQuestionByKey(key);
  return question?.options.find((option) => option.value === value)?.label ?? value;
}

function getSuggestions(state: WizardState): WizardOption[] {
  if (state.activeQuestionKey) {
    return getQuestionByKey(state.activeQuestionKey)?.options ?? [];
  }

  if (state.awaitingFocus) {
    return focusQuestion.options;
  }

  return [];
}

function response(lines: string[], state: WizardState, accepted = true, notes?: string[]): WizardTurnResponse {
  const recommendations = state.revealed ? getRecommendations(state.profile).slice(0, 3) : [];
  return {
    lines,
    state,
    suggestions: getSuggestions(state),
    recommendations,
    accepted,
    adapter: "mock",
    notes,
  };
}

/**
 * Re-evaluated from the current profile on every turn — reveal is not a one-way
 * door reached at a fixed point in the questionnaire. As soon as the rubric clears
 * (see shouldRevealRecommendations), share, but keep offering whichever question is
 * still unanswered so the user can keep refining instead of hitting a dead end.
 */
function nextStateForProfile(profile: UserProfile): WizardState {
  const revealed = shouldRevealRecommendations(profile);
  const nextQuestion = questions.find((question) => !profile[question.key]);

  if (revealed) {
    return {
      ...initialWizardState,
      started: true,
      profile,
      revealed: true,
      activeQuestionKey: nextQuestion?.key ?? null,
    };
  }

  if (nextQuestion) {
    return {
      ...initialWizardState,
      started: true,
      profile,
      activeQuestionKey: nextQuestion.key,
    };
  }

  return {
    ...initialWizardState,
    started: true,
    profile,
    awaitingFocus: true,
  };
}

function linesForNextState(state: WizardState) {
  if (state.revealed) {
    return ["The reading steadies.", "Three cartridges rise from the dark."];
  }

  if (state.activeQuestionKey) {
    const question = getQuestionByKey(state.activeQuestionKey);
    return question ? [question.prompt] : ["The shelf mutters, but the question is missing."];
  }

  if (state.awaitingFocus) {
    return [focusQuestion.prompt];
  }

  return [];
}

/**
 * Used once every question has already been answered and the shelf is open — lets
 * the user keep refining ("actually, make it harder") by re-matching the reply
 * against any question's options, not just whichever was last active.
 */
function interpretRevision(command: string) {
  for (const question of questions) {
    const option = interpretQuestionAnswer(question, command);
    if (option) {
      return { key: question.key, option };
    }
  }
  return null;
}

function withProfilePatch(state: WizardState, patch: Partial<UserProfile>) {
  return {
    ...state,
    profile: {
      ...state.profile,
      ...patch,
    },
  };
}

export const mockWizardAgent: WizardAgent = {
  async runTurn(request) {
    const command = request.command.trim();
    const state = {
      ...initialWizardState,
      ...request.state,
      profile: {
        ...blankProfile,
        ...request.state.profile,
      },
    };

    if (!state.started) {
      const startedState: WizardState = state.profile.name.trim()
        ? nextStateForProfile(state.profile)
        : {
            ...state,
            started: true,
            needsName: true,
          };
      const intro = state.profile.name.trim()
        ? [
            "SIGNAL FOUND IN THE GLASS.",
            `${state.profile.name.toUpperCase()}, your session sigil still burns.`,
            "Let us return to the shelf of old thunder.",
            ...linesForNextState(startedState),
          ]
        : [
            "THE CURSOR WAKES.",
            "I am the Keeper Beneath the Screen, and I will guide you through these ancient tomes.",
            "Tell me the name I should carve into this session.",
          ];
      return response(intro, startedState);
    }

    const directAskProfile = inferDirectAskProfile(command, state.profile);
    if (directAskProfile) {
      const nextState: WizardState = {
        ...initialWizardState,
        started: true,
        profile: directAskProfile,
        revealed: true,
      };
      return response(
        [
          "Specific cartridge omen received.",
          "M.U.L.E. rises: Danielle Bunten Berry's multiplayer landmark, remembered in gaming history and trans game-history circles.",
          ...linesForNextState(nextState),
        ],
        nextState,
      );
    }

    if (state.needsName) {
      if (!command) {
        return response(["The name cannot be blank. Feed the cursor a sigil."], state, false);
      }

      const name = extractNameFromIntro(command) ?? command;
      const bonusSignals = extractProfileSignals(command, state.profile);
      const namedState = withProfilePatch(
        {
          ...state,
          needsName: false,
        },
        { name, ...bonusSignals },
      );
      const nextState = nextStateForProfile(namedState.profile);
      const bonusKeys = Object.keys(bonusSignals) as PreferenceKey[];
      const bonusLine = bonusKeys.length
        ? [`It also names ${bonusKeys.map((key) => describeProfileValue(key, namedState.profile[key] as string)).join(" and ")}.`]
        : [];
      const hesitationLine = nextState.revealed ? [] : ["Now answer plainly. The cartridge hears hesitation."];
      return response(
        [`${name.toUpperCase()} is written in green fire.`, ...bonusLine, ...hesitationLine, ...linesForNextState(nextState)],
        nextState,
      );
    }

    if (state.activeQuestionKey) {
      const question = getQuestionByKey(state.activeQuestionKey);
      if (!question) {
        return response(["The active question has slipped between scanlines. Start again."], state, false);
      }

      const option = interpretQuestionAnswer(question, command);
      const bonusSignals = extractProfileSignals(command, state.profile);
      if (!option && Object.keys(bonusSignals).length === 0) {
        return response(["That answer will not bind. Type it another way, or press TAB to copy the lit rune."], state, false);
      }

      const nextProfile = {
        ...state.profile,
        ...bonusSignals,
        ...(option ? { [question.key]: option.value } : {}),
      } as UserProfile;
      const nextState = nextStateForProfile(nextProfile);
      const bonusKeys = (Object.keys(bonusSignals) as PreferenceKey[]).filter((key) => key !== question.key);
      const bonusDescriptions = bonusKeys.map((key) => describeProfileValue(key, nextProfile[key] as string));
      const headline = option
        ? `I read that as ${option.label}.`
        : `That names ${bonusDescriptions.join(" and ")}, so I'll carry it forward.`;
      const bonusLine = option && bonusDescriptions.length ? [`It also names ${bonusDescriptions.join(" and ")}.`] : [];
      return response([headline, ...bonusLine, ...linesForNextState(nextState)], nextState);
    }

    if (state.awaitingFocus) {
      const option = interpretFocusAnswer(focusQuestion, command);
      if (!option) {
        return response(["Name the ruling omen another way, or press TAB to copy the lit rune."], state, false);
      }

      const nextProfile = {
        ...state.profile,
        focus: option.value as PreferenceKey,
      };
      const nextState: WizardState = {
        ...initialWizardState,
        started: true,
        profile: nextProfile,
        revealed: true,
      };
      return response(["The ruling omen locks into place.", "The shelf yields.", ...linesForNextState(nextState)], nextState);
    }

    if (state.revealed) {
      const revision = interpretRevision(command);
      if (!revision) {
        return response(
          [
            "The shelf is already open. Name a trait to reshape the reading — mood, style, difficulty, story, shelf position, or romhacks — or start over.",
          ],
          state,
        );
      }

      const nextProfile = {
        ...state.profile,
        [revision.key]: revision.option.value,
      } as UserProfile;
      const nextState = nextStateForProfile(nextProfile);
      return response(
        [`I read that as ${revision.option.label}. Reshaping the reading.`, ...linesForNextState(nextState)],
        nextState,
      );
    }

    const recovered = nextStateForProfile(state.profile);
    return response(linesForNextState(recovered), recovered, true, [
      `Recovered from idle state with ${answeredPreferenceCount(state.profile)}/6 answers and top ${Math.round(
        (getRecommendations(state.profile)[0]?.score ?? 0) * 100,
      )}%. Need ${Math.round(recommendationThreshold * 100)}%.`,
    ]);
  },
};
