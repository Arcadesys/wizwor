import type { PreferenceKey, UserProfile } from "@/lib/recommender";
import {
  answeredPreferenceCount,
  getRecommendations,
  recommendationThreshold,
  shouldRevealRecommendations,
} from "@/lib/recommender";
import type { WizardAgent } from "@/lib/wizard/agent";
import { interpretFocusAnswer, interpretQuestionAnswer } from "@/lib/wizard/interpreter";
import { focusQuestion, getQuestionByKey, questions } from "@/lib/wizard/questions";
import type { WizardOption, WizardState, WizardTurnResponse } from "@/lib/wizard/types";
import { blankProfile, initialWizardState } from "@/lib/wizard/types";

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

function nextStateForProfile(profile: UserProfile): WizardState {
  if (shouldRevealRecommendations(profile)) {
    return {
      ...initialWizardState,
      started: true,
      profile,
      revealed: true,
    };
  }

  const nextQuestion = questions.find((question) => !profile[question.key]);
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
    return ["The reading reaches ninety percent resonance.", "Three cartridges rise from the dark."];
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

    if (state.needsName) {
      if (!command) {
        return response(["The name cannot be blank. Feed the cursor a sigil."], state, false);
      }

      const namedState = withProfilePatch(
        {
          ...state,
          needsName: false,
        },
        { name: command },
      );
      const nextState = nextStateForProfile(namedState.profile);
      return response(
        [`${command.toUpperCase()} is written in green fire.`, "Now answer plainly. The cartridge hears hesitation.", ...linesForNextState(nextState)],
        nextState,
      );
    }

    if (state.activeQuestionKey) {
      const question = getQuestionByKey(state.activeQuestionKey);
      if (!question) {
        return response(["The active question has slipped between scanlines. Start again."], state, false);
      }

      const option = interpretQuestionAnswer(question, command);
      if (!option) {
        return response(["That answer will not bind. Type it another way, or press TAB to copy the lit rune."], state, false);
      }

      const nextProfile = {
        ...state.profile,
        [question.key]: option.value,
      } as UserProfile;
      const nextState = nextStateForProfile(nextProfile);
      return response([`I read that as ${option.label}.`, ...linesForNextState(nextState)], nextState);
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
      return response(["The shelf is already open. Read the three tomes below."], state);
    }

    const recovered = nextStateForProfile(state.profile);
    return response(linesForNextState(recovered), recovered, true, [
      `Recovered from idle state with ${answeredPreferenceCount(state.profile)}/6 answers and top ${Math.round(
        (getRecommendations(state.profile)[0]?.score ?? 0) * 100,
      )}%. Need ${Math.round(recommendationThreshold * 100)}%.`,
    ]);
  },
};
