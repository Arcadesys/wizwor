"use client";

import { CSSProperties, FormEvent, KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import type * as ToneNamespace from "tone";
import { catalogPlatforms, platformLabels, sanitizeEnabledPlatforms, type Platform } from "@/data/games";
import type { Recommendation, UserProfile } from "@/lib/recommender";
import type { FeedbackRating } from "@/lib/feedback";
import { isResetCommand } from "@/lib/wizard/interpreter";
import { WIZARD_RESPONSE_TOO_LONG_ERROR } from "@/lib/wizard/response-guard";
import type {
  WizardMessage,
  WizardOption,
  WizardSoundtrack,
  WizardState,
  WizardTurnResponse,
} from "@/lib/wizard/types";
import { blankProfile, defaultMemoryMarkdown } from "@/lib/wizard/types";
import type { WizardTerminalTheme } from "@/lib/wizard/types";

type Message = WizardMessage & {
  id: string;
};

type AudioRig = {
  context: AudioContext;
  tone: typeof ToneNamespace;
  sequences: ToneNamespace.Sequence<number>[];
  instruments: Array<{ dispose: () => unknown }>;
  musicActive: boolean;
};

type AudioMode = "muted" | "voice" | "music";

type SamConstructor = new (options?: {
  phonetic?: boolean;
  singmode?: boolean;
  debug?: boolean;
  pitch?: number;
  speed?: number;
  mouth?: number;
  throat?: number;
}) => {
  buf32(text: string, phonetic?: boolean): Float32Array | boolean;
};

type GamepadState = {
  left: boolean;
  right: boolean;
  submit: boolean;
};

type ControlNavGroup = "topbar" | "platform-toggles" | "console-context" | "feedback";

class WizardTurnError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "WizardTurnError";
  }
}

const samSampleRate = 22050;
const storageKey = "wyrm-terminal-profile";
const memoryStorageKey = "wyrm-terminal-MEMORY.md";
const themeStorageKey = "wyrm-terminal-theme";
const platformStorageKey = "wyrm-terminal-platforms";
const arrowKeys = new Set(["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"]);
const recommendationButtonSelector = "[data-recommendation-button='true']";

const feedbackOptions: Array<{ rating: FeedbackRating; label: string }> = [
  { rating: "nailed", label: "\u{1F44D} Nailed it" },
  { rating: "sort_of", label: "\u{1F914} Sort of" },
  { rating: "not_even_haunted", label: "\u{1F44E} Not even haunted" },
];

const consoleGreeting = "Greetings Gamer! What console are you questing on today?";
const postConsolePrompt = "What plaything can I offer you today?";
const soundOnCaution = "Best with sound on. Turn your speakers down first, then let WIZ speak.";
const dungeonMusicGain = 0.12;
const dungeonSong: WizardSoundtrack = {
  title: "Wor Dungeon Omen",
  bpm: 108,
  loopEnd: "4m",
  bass: ["A1", "A1", "C2", "B1", "A1", "D2", "C2", "G1", "A1", "A1", "Eb2", "D2", "A1", "F1", "G1", "A1"],
  stabs: ["A3", "", "C4", "", "Bb3", "", "E3", "", "A3", "", "Eb4", "", "D4", "", "G3", ""],
  sparks: ["", "E5", "", "C5", "", "Bb4", "", "F#4", "", "A5", "", "Eb5", "", "D5", "", "C#5"],
  drumSteps: [0, 4, 8, 12, 14],
};

type WizardTerminalProps = {
  fastMode?: boolean;
};

function initialConsoleMessages(): Message[] {
  return [
    {
      id: makeId("wiz"),
      speaker: "wizard",
      text: consoleGreeting,
    },
  ];
}

export function WizardTerminal({ fastMode = false }: WizardTerminalProps) {
  const [profile, setProfile] = useState<UserProfile>(blankProfile);
  const [memoryMarkdown, setMemoryMarkdown] = useState(defaultMemoryMarkdown);
  const [enabledPlatforms, setEnabledPlatforms] = useState<Platform[]>([...catalogPlatforms]);
  const [terminalTheme, setTerminalTheme] = useState<WizardTerminalTheme | undefined>();
  const [hydrated, setHydrated] = useState(false);
  const [started, setStarted] = useState(false);
  const [selectedConsoles, setSelectedConsoles] = useState<Platform[]>([]);
  const [needsName, setNeedsName] = useState(false);
  const [messages, setMessages] = useState<Message[]>(() => initialConsoleMessages());
  const [command, setCommand] = useState("");
  const [suggestions, setSuggestions] = useState<WizardOption[]>([]);
  const [suggestionIndex, setSuggestionIndex] = useState(0);
  const [isSuggestionBrowsing, setIsSuggestionBrowsing] = useState(false);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [showcase, setShowcase] = useState<Recommendation[] | null>(null);
  const [showcaseIndex, setShowcaseIndex] = useState(0);
  const [isStreaming, setIsStreaming] = useState(false);
  const [audioMode, setAudioMode] = useState<AudioMode>("muted");
  const [soundtrack, setSoundtrack] = useState<WizardSoundtrack>(dungeonSong);
  const [feedbackRating, setFeedbackRating] = useState<FeedbackRating | null>(null);
  const [feedbackNote, setFeedbackNote] = useState("");
  const [feedbackNoteSent, setFeedbackNoteSent] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [controlNavGroup, setControlNavGroup] = useState<ControlNavGroup | null>(null);
  const [controlNavIndex, setControlNavIndex] = useState(0);

  const profileRef = useRef(profile);
  const memoryMarkdownRef = useRef(memoryMarkdown);
  const enabledPlatformsRef = useRef(enabledPlatforms);
  const terminalThemeRef = useRef(terminalTheme);
  const startedRef = useRef(started);
  const needsNameRef = useRef(needsName);
  const recommendationsRef = useRef(recommendations);
  const messagesRef = useRef(messages);
  const sessionIdRef = useRef(makeId("session"));
  const audioRef = useRef<AudioRig | null>(null);
  const soundtrackRef = useRef<WizardSoundtrack>(dungeonSong);
  const audioBusyRef = useRef(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const streamChainRef = useRef(Promise.resolve());
  const streamTokenRef = useRef(0);
  const samRef = useRef<InstanceType<SamConstructor> | null>(null);
  const greetingSpokenRef = useRef(false);
  const startupSoundAttemptedRef = useRef(false);
  const gamepadFrameRef = useRef<number | null>(null);
  const lastGamepadRef = useRef<GamepadState>({ left: false, right: false, submit: false });
  const suppressFocusRef = useRef(false);

  const terminalStyle = useMemo(() => themeToCssVariables(terminalTheme), [terminalTheme]);
  const soundOn = audioMode !== "muted";
  const musicOn = audioMode === "music";
  const audioStatus =
    audioMode === "music" ? `Music and voice: ${soundtrack.title}` : audioMode === "voice" ? "Voice only" : "Muted";
  const nextAudioModeLabel =
    audioMode === "music" ? "Switch to muted" : audioMode === "voice" ? "Switch to music and voice" : "Switch to voice only";

  useEffect(() => {
    queueMicrotask(() => {
      try {
        const saved = sessionStorage.getItem(storageKey);
        if (saved) {
          const restored = { ...blankProfile, ...JSON.parse(saved) } as UserProfile;
          setProfile(restored);
          profileRef.current = restored;
        }
        const persistentStorage = getPersistentStorage();
        const savedMemory = persistentStorage?.getItem(memoryStorageKey);
        if (savedMemory?.trim()) {
          setMemoryMarkdown(savedMemory);
          memoryMarkdownRef.current = savedMemory;
        }
        const savedTheme = persistentStorage?.getItem(themeStorageKey);
        if (savedTheme) {
          const restoredTheme = sanitizeTheme(JSON.parse(savedTheme));
          setTerminalTheme(restoredTheme);
          terminalThemeRef.current = restoredTheme;
        }
        const savedPlatforms = persistentStorage?.getItem(platformStorageKey);
        if (savedPlatforms) {
          const restoredPlatforms = sanitizeEnabledPlatforms(JSON.parse(savedPlatforms));
          setEnabledPlatforms(restoredPlatforms);
          enabledPlatformsRef.current = restoredPlatforms;
        }
      } catch {
        sessionStorage.removeItem(storageKey);
        getPersistentStorage()?.removeItem(themeStorageKey);
        getPersistentStorage()?.removeItem(platformStorageKey);
      } finally {
        setHydrated(true);
      }
    });
  }, []);

  useEffect(() => {
    profileRef.current = profile;
  }, [profile]);

  useEffect(() => {
    memoryMarkdownRef.current = memoryMarkdown;
  }, [memoryMarkdown]);

  useEffect(() => {
    enabledPlatformsRef.current = enabledPlatforms;
  }, [enabledPlatforms]);

  useEffect(() => {
    terminalThemeRef.current = terminalTheme;
  }, [terminalTheme]);

  useEffect(() => {
    startedRef.current = started;
  }, [started]);

  useEffect(() => {
    needsNameRef.current = needsName;
  }, [needsName]);

  useEffect(() => {
    recommendationsRef.current = recommendations;
  }, [recommendations]);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, recommendations]);

  useEffect(() => {
    if (!suppressFocusRef.current) {
      inputRef.current?.focus();
    }
  }, [started, isStreaming]);

  useEffect(() => {
    if (fastMode || !hydrated || startupSoundAttemptedRef.current) {
      return;
    }

    startupSoundAttemptedRef.current = true;
    void startMusic().then((rig) => {
      if (rig) {
        void loadSam();
      }
    });
  }, [fastMode, hydrated]);

  useEffect(() => {
    return () => {
      stopAllAudio();
    };
  }, []);

  function persistProfile(nextProfile: UserProfile) {
    setProfile(nextProfile);
    profileRef.current = nextProfile;
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(nextProfile));
    } catch (error) {
      console.warn("Failed to persist wizard profile:", error);
    }
  }

  function persistMemory(nextMemoryMarkdown?: string, nextTerminalTheme?: WizardTerminalTheme) {
    const safeMemory = nextMemoryMarkdown?.trim() ? nextMemoryMarkdown : memoryMarkdownRef.current || defaultMemoryMarkdown;
    const safeTheme = sanitizeTheme(nextTerminalTheme);
    setMemoryMarkdown(safeMemory);
    memoryMarkdownRef.current = safeMemory;
    setTerminalTheme(safeTheme);
    terminalThemeRef.current = safeTheme;
    try {
      const persistentStorage = getPersistentStorage();
      persistentStorage?.setItem(memoryStorageKey, safeMemory);
      if (safeTheme) {
        persistentStorage?.setItem(themeStorageKey, JSON.stringify(safeTheme));
      } else {
        persistentStorage?.removeItem(themeStorageKey);
      }
    } catch (error) {
      console.warn("Failed to persist wizard memory or theme:", error);
    }
  }

  function persistEnabledPlatforms(nextEnabledPlatforms: Platform[]) {
    const sanitized = sanitizeEnabledPlatforms(nextEnabledPlatforms);
    setEnabledPlatforms(sanitized);
    enabledPlatformsRef.current = sanitized;
    setRecommendations([]);
    recommendationsRef.current = [];
    try {
      getPersistentStorage()?.setItem(platformStorageKey, JSON.stringify(sanitized));
    } catch (error) {
      console.warn("Failed to persist enabled platforms:", error);
    }
  }

  function togglePlatform(platform: Platform) {
    const current = new Set(enabledPlatformsRef.current);
    if (current.has(platform)) {
      current.delete(platform);
    } else {
      current.add(platform);
    }
    persistEnabledPlatforms(catalogPlatforms.filter((entry) => current.has(entry)));
    inputRef.current?.focus();
  }

  function toggleConsoleSelection(platform: Platform) {
    setSelectedConsoles((current) =>
      current.includes(platform) ? current.filter((entry) => entry !== platform) : [...current, platform],
    );
    inputRef.current?.focus();
  }

  function beginQuestWithConsoles(platforms: Platform[]) {
    if (!platforms.length) {
      return;
    }

    const nextMessages: Message[] = [
      ...messagesRef.current,
      {
        id: makeId("user"),
        speaker: "user",
        text: platforms.map((platform) => platformLabels[platform]).join(", "),
      },
    ];
    persistEnabledPlatforms(platforms);
    setMessages(nextMessages);
    messagesRef.current = nextMessages;
    setStarted(true);
    startedRef.current = true;
    setSelectedConsoles([]);
    setCommand("");
    setSuggestions([]);
    setSuggestionIndex(0);
    setIsSuggestionBrowsing(false);
    setSettingsOpen(false);
    setControlNavGroup(null);
    window.setTimeout(() => inputRef.current?.focus(), 0);
    void streamWizard([postConsolePrompt], { instantWhenSilent: true, lockInput: false }).then(() => {
      window.setTimeout(() => inputRef.current?.focus(), 0);
    });
  }

  function selectConsoleContext(platform: Platform) {
    beginQuestWithConsoles([platform]);
  }

  function platformFromCommand(value: string) {
    const normalized = value.trim().toLowerCase();
    return catalogPlatforms.find(
      (platform) => platform === normalized || platformLabels[platform].toLowerCase() === normalized,
    );
  }

  function appendUser(text: string) {
    setMessages((current) => [
      ...current,
      {
        id: makeId("user"),
        speaker: "user",
        text,
      },
    ]);
  }

  function appendSystem(text: string) {
    setMessages((current) => {
      const last = current.at(-1);
      if (last?.speaker === "system" && last.text === text) {
        return current;
      }

      return [
        ...current,
        {
          id: makeId("system"),
          speaker: "system",
          text,
        },
      ];
    });
  }

  function currentWizardState(): WizardState {
    return {
      started: startedRef.current,
      needsName: needsNameRef.current,
      activeQuestionKey: null,
      awaitingFocus: false,
      revealed: recommendationsRef.current.length > 0,
      profile: profileRef.current,
      enabledPlatforms: enabledPlatformsRef.current,
      memoryMarkdown: memoryMarkdownRef.current,
      terminalTheme: terminalThemeRef.current,
    };
  }

  async function requestWizardTurn(turnCommand: string) {
    const response = await fetch("/api/wizard", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sessionId: sessionIdRef.current,
        command: turnCommand,
        state: currentWizardState(),
        messages: messagesRef.current.map(({ speaker, text }) => ({ speaker, text })),
      }),
    });

    if (!response.ok) {
      let message = `Wizard API returned ${response.status}.`;
      try {
        const body = (await response.json()) as { error?: unknown };
        if (typeof body.error === "string" && body.error.trim()) {
          message = body.error;
        }
      } catch {
        // Keep the status-only message if the response body is not JSON.
      }

      throw new WizardTurnError(message, response.status);
    }

    return (await response.json()) as WizardTurnResponse;
  }

  function applyWizardResponse(response: WizardTurnResponse) {
    const nextStarted =
      response.state.started ||
      startedRef.current ||
      response.recommendations.length > 0 ||
      Boolean(response.showcase?.games.length);
    persistProfile(response.state.profile);
    persistMemory(response.state.memoryMarkdown, response.state.terminalTheme);
    persistEnabledPlatforms(response.state.enabledPlatforms ?? [...catalogPlatforms]);
    setStarted(nextStarted);
    startedRef.current = nextStarted;
    setNeedsName(response.state.needsName);
    needsNameRef.current = response.state.needsName;
    setSuggestions(response.suggestions);
    setRecommendations(response.recommendations);
    recommendationsRef.current = response.recommendations;
    setShowcase(response.showcase?.games ?? null);
    if (response.soundtrack) {
      applySoundtrack(response.soundtrack);
    }
    setShowcaseIndex(0);
    setSuggestionIndex(0);
    setIsSuggestionBrowsing(false);
    setFeedbackRating(null);
    setFeedbackNote("");
    setFeedbackNoteSent(false);
    setSettingsOpen(false);
    setControlNavGroup(null);
  }

  function closeShowcase() {
    setShowcase(null);
    setShowcaseIndex(0);
  }

  function saveSession() {
    try {
      const filename = downloadSessionSnapshot({
        profile: profileRef.current,
        memoryMarkdown: memoryMarkdownRef.current,
        enabledPlatforms: enabledPlatformsRef.current,
        terminalTheme: terminalThemeRef.current,
        messages: messagesRef.current.map(({ speaker, text }) => ({ speaker, text })),
        recommendations: recommendationsRef.current,
      });
      appendSystem(`Session downloaded as ${filename}. Reload it later, or just keep questing.`);
    } catch (error) {
      console.warn("Failed to save session:", error);
      appendSystem("Couldn't save the session. Try again.");
    }
  }

  function resetSession() {
    streamTokenRef.current += 1;
    streamChainRef.current = Promise.resolve();
    sessionStorage.removeItem(storageKey);
    sessionIdRef.current = makeId("session");
    setProfile(blankProfile);
    profileRef.current = blankProfile;
    setStarted(false);
    startedRef.current = false;
    setSelectedConsoles([]);
    setNeedsName(false);
    needsNameRef.current = false;
    const coldMessages = initialConsoleMessages();
    setMessages(coldMessages);
    messagesRef.current = coldMessages;
    setCommand("");
    setSuggestions([]);
    setSuggestionIndex(0);
    setIsSuggestionBrowsing(false);
    setRecommendations([]);
    recommendationsRef.current = [];
    setShowcase(null);
    setShowcaseIndex(0);
    setIsStreaming(false);
    setFeedbackRating(null);
    setFeedbackNote("");
    setFeedbackNoteSent(false);
    setSettingsOpen(false);
    setControlNavGroup(null);
    greetingSpokenRef.current = false;
    window.setTimeout(() => inputRef.current?.focus(), 0);
  }

  function streamWizard(lines: string[], options: { instantWhenSilent?: boolean; lockInput?: boolean } = {}) {
    streamChainRef.current = streamChainRef.current.then(async () => {
      const token = streamTokenRef.current;
      const lockInput = (options.lockInput ?? true) && lines.length > 0;
      const shouldUnlock = lockInput || lines.length === 0;
      if (options.instantWhenSilent && !soundOn) {
        setMessages((current) => [
          ...current,
          ...lines.map((line) => ({
            id: makeId("wiz"),
            speaker: "wizard" as const,
            text: line,
          })),
        ]);
        await wait(0);
        if (shouldUnlock && token === streamTokenRef.current) {
          setIsStreaming(false);
        }
        return;
      }

      if (lockInput) {
        setIsStreaming(true);
      }

      if (fastMode) {
        setMessages((current) => [
          ...current,
          ...lines.map((line) => ({
            id: makeId("wiz"),
            speaker: "wizard" as const,
            text: line,
          })),
        ]);
        await wait(0);
        if (shouldUnlock && token === streamTokenRef.current) {
          setIsStreaming(false);
        }
        return;
      }

      for (const line of lines) {
        if (token !== streamTokenRef.current) {
          return;
        }

        await streamAndSpeakLine(line, token);
        await wait(180);
      }

      if (shouldUnlock && token === streamTokenRef.current) {
        setIsStreaming(false);
      }
    });

    return streamChainRef.current;
  }

  async function streamAndSpeakLine(line: string, token: number) {
    const id = makeId("wiz");
    const rendered = await renderSamLine(line);
    if (token !== streamTokenRef.current) {
      return;
    }

    const durationMs = rendered ? Math.max(520, (rendered.audio.length / samSampleRate) * 1000) : fallbackDuration(line);
    const source = rendered ? playSamBuffer(rendered.audio) : null;
    const weights = line.split("").map((character) => characterDelayWeight(character));
    const totalWeight = weights.reduce((sum, weight) => sum + weight, 0) || 1;

    setMessages((current) => [...current, { id, speaker: "wizard", text: "" }]);

    for (const index of Array.from({ length: line.length + 1 }, (_, position) => position)) {
      if (token !== streamTokenRef.current) {
        try {
          source?.stop();
        } catch {
          // The buffer may already have ended; either way the reset has won.
        }
        return;
      }

      setMessages((current) =>
        current.map((message) => (message.id === id ? { ...message, text: line.slice(0, index) } : message)),
      );

      if (!source && index > 0) {
        playFallbackSpeechTick(line[index - 1]);
      }

      if (index < line.length) {
        await wait((durationMs * weights[index]) / totalWeight);
      }
    }

    if (source) {
      await waitForSource(source, 160);
    }
  }

  async function submitCommand(rawCommand = command) {
    const value = rawCommand.trim();
    if (isStreaming) {
      return;
    }

    if (isResetCommand(value)) {
      resetSession();
      return;
    }

    if (!started) {
      setCommand("");
      const requestedPlatform = platformFromCommand(value);
      if (requestedPlatform) {
        selectConsoleContext(requestedPlatform);
        return;
      }
      appendSystem("Choose a console first. The catalog gates are the buttons below.");
      playKeyTone("deny");
      return;
    }

    setCommand("");
    if (!value) {
      playKeyTone("deny");
      return;
    }

    appendUser(value);
    setIsStreaming(true);

    try {
      const response = await requestWizardTurn(value);
      applyWizardResponse(response);
      if (!response.accepted) {
        playKeyTone("deny");
      }
      await streamWizard(response.lines);
    } catch (error) {
      appendSystem(formatWizardError(error));
      setIsStreaming(false);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    submitCommand();
  }

  async function sendFeedback(rating: FeedbackRating, note?: string) {
    try {
      await fetch("/api/feedback", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sessionId: sessionIdRef.current,
          rating,
          profile: profileRef.current,
          recommendations: recommendationsRef.current.map((recommendation) => ({
            id: recommendation.game.id,
            title: recommendation.game.title,
            score: recommendation.score,
          })),
          note,
        }),
      });
    } catch {
      // Feedback is best-effort telemetry; a dropped request shouldn't disturb the reading.
    }
  }

  function rateRecommendations(rating: FeedbackRating) {
    setFeedbackRating(rating);
    setControlNavGroup(null);
    void sendFeedback(rating);
  }

  function sendFeedbackNote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!feedbackRating || !feedbackNote.trim()) {
      return;
    }

    setFeedbackNoteSent(true);
    void sendFeedback(feedbackRating, feedbackNote.trim());
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowUp") {
      event.preventDefault();
      if (suggestions.length) {
        startSuggestionBrowsing();
      } else {
        startControlNavigation();
      }
      playKeyTone("move");
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (suggestions.length) {
        setIsSuggestionBrowsing(false);
      } else {
        setControlNavGroup(null);
      }
      playKeyTone("move");
      return;
    }

    if (event.key === "ArrowLeft") {
      if (isSuggestionBrowsing) {
        event.preventDefault();
        moveSuggestion(-1);
        playKeyTone("move");
      } else if (controlNavGroup) {
        event.preventDefault();
        moveControlNav(-1);
        playKeyTone("move");
      }
      return;
    }

    if (event.key === "ArrowRight") {
      if (isSuggestionBrowsing) {
        event.preventDefault();
        moveSuggestion(1);
        playKeyTone("move");
      } else if (controlNavGroup) {
        event.preventDefault();
        moveControlNav(1);
        playKeyTone("move");
      }
      return;
    }

    if (event.key === "Escape") {
      setIsSuggestionBrowsing(false);
      setControlNavGroup(null);
      playKeyTone("move");
      return;
    }

    if (event.key === "Tab") {
      event.preventDefault();
      const option = suggestions[suggestionIndex];
      if (option) {
        setCommand(option.label);
        playKeyTone("move");
      }
      return;
    }

    if (event.key === "Enter") {
      if (isSuggestionBrowsing && !command.trim() && suggestions.length) {
        event.preventDefault();
        submitFocusedSuggestion();
      } else if (controlNavGroup && !command.trim()) {
        event.preventDefault();
        activateControlNav();
      }
      playKeyTone("enter");
      return;
    }

    if (event.key === "Backspace") {
      playKeyTone("backspace");
      return;
    }

    if (event.key.length === 1 && !event.metaKey && !event.ctrlKey && !event.altKey) {
      playKeyTone("letter");
    }
  }

  function submitFocusedSuggestion() {
    const option = suggestions[getSafeSuggestionIndex(suggestions.length, suggestionIndex)];
    if (!option) {
      submitCommand();
      return;
    }

    setCommand(option.label);
    submitCommand(option.label);
  }

  function startSuggestionBrowsing() {
    if (!suggestions.length) {
      return;
    }

    setIsSuggestionBrowsing(true);
    setSuggestionIndex((current) => getSafeSuggestionIndex(suggestions.length, current));
  }

  function moveSuggestion(direction: 1 | -1) {
    if (!suggestions.length) {
      return;
    }

    setIsSuggestionBrowsing(true);
    setSuggestionIndex((current) => (current + direction + suggestions.length) % suggestions.length);
  }

  function getControlNavIds(group: ControlNavGroup): string[] {
    if (group === "platform-toggles") {
      return [...catalogPlatforms];
    }

    if (group === "console-context") {
      return selectedConsoles.length ? [...catalogPlatforms, "confirm"] : [...catalogPlatforms];
    }

    if (group === "feedback") {
      return feedbackOptions.map((option) => option.rating);
    }

    return ["save", "settings", "reset", "sound"];
  }

  function bestAvailableControlGroup(): ControlNavGroup {
    if (settingsOpen) {
      return "platform-toggles";
    }

    if (!started) {
      return "console-context";
    }

    if (recommendations.length && !feedbackRating) {
      return "feedback";
    }

    return "topbar";
  }

  function startControlNavigation() {
    const group = bestAvailableControlGroup();
    const ids = getControlNavIds(group);
    if (!ids.length) {
      return;
    }

    setControlNavIndex((current) => (controlNavGroup === group ? getSafeSuggestionIndex(ids.length, current) : 0));
    setControlNavGroup(group);
  }

  function moveControlNav(direction: 1 | -1) {
    if (!controlNavGroup) {
      return;
    }

    const ids = getControlNavIds(controlNavGroup);
    if (!ids.length) {
      return;
    }

    setControlNavIndex((current) => (current + direction + ids.length) % ids.length);
  }

  function activateControlNavItem(group: ControlNavGroup, id: string) {
    if (group === "topbar") {
      if (id === "save") {
        saveSession();
        inputRef.current?.focus();
        return;
      }

      if (id === "settings") {
        setSettingsOpen((value) => !value);
        setControlNavGroup(null);
        inputRef.current?.focus();
        return;
      }

      if (id === "reset") {
        resetSession();
        return;
      }

      if (id === "sound") {
        toggleSound();
        inputRef.current?.focus();
      }

      return;
    }

    if (group === "platform-toggles") {
      togglePlatform(id as Platform);
      return;
    }

    if (group === "console-context") {
      if (id === "confirm") {
        if (selectedConsoles.length) {
          beginQuestWithConsoles(selectedConsoles);
        }
        return;
      }

      toggleConsoleSelection(id as Platform);
      return;
    }

    rateRecommendations(id as FeedbackRating);
  }

  function activateControlNav() {
    if (!controlNavGroup) {
      return;
    }

    const ids = getControlNavIds(controlNavGroup);
    const id = ids[getSafeSuggestionIndex(ids.length, controlNavIndex)];
    if (!id) {
      return;
    }

    activateControlNavItem(controlNavGroup, id);
  }

  function isControlNavCursor(group: ControlNavGroup, id: string) {
    if (controlNavGroup !== group) {
      return false;
    }

    const ids = getControlNavIds(group);
    return ids[getSafeSuggestionIndex(ids.length, controlNavIndex)] === id;
  }

  async function toggleSound() {
    // The button stays enabled while the rig loads, so a double-click would
    // otherwise run two transitions concurrently — building two sets of
    // synths/sequences where the first set's references are overwritten and
    // its loops keep playing with no way to stop them.
    if (audioBusyRef.current) {
      return;
    }

    audioBusyRef.current = true;
    try {
      if (audioMode === "muted") {
        const rig = await ensureAudioRig();
        if (rig) {
          await loadSam();
          setAudioMode("voice");
        }
        return;
      }

      if (audioMode === "voice") {
        await startMusic();
        await loadSam();
        return;
      }

      stopAllAudio();
      setAudioMode("muted");
    } finally {
      audioBusyRef.current = false;
    }
  }

  async function ensureAudioRig() {
    if (audioRef.current) {
      await audioRef.current.tone.start();
      return audioRef.current;
    }

    try {
      const Tone = await import("tone");
      // stopAllAudio disposes the global Tone context (muting); a disposed
      // context can never resume, so unmuting must install a fresh one or
      // audio stays dead for the rest of the session.
      if (Tone.getContext().disposed) {
        Tone.setContext(new Tone.Context());
      }
      await Tone.start();
      const context = Tone.getContext().rawContext as Partial<AudioContext>;
      if (typeof context.createBuffer !== "function" || typeof context.createOscillator !== "function") {
        return null;
      }

      audioRef.current = {
        context: context as AudioContext,
        tone: Tone,
        sequences: [],
        instruments: [],
        musicActive: false,
      };
      return audioRef.current;
    } catch {
      return null;
    }
  }

  async function startMusic() {
    const rig = await ensureAudioRig();
    if (!rig) {
      setAudioMode("muted");
      return null;
    }

    if (rig.musicActive) {
      rig.tone.getTransport().start();
      setAudioMode("music");
      return rig;
    }

    try {
      const song = soundtrackRef.current;
      const Tone = rig.tone;
      const master = new Tone.Gain(dungeonMusicGain).toDestination();
      const dungeonFilter = new Tone.Filter({ frequency: 980, rolloff: -24, type: "lowpass" }).connect(master);
      const echo = new Tone.FeedbackDelay({ delayTime: "8n.", feedback: 0.34, wet: 0.24 }).connect(dungeonFilter);
      const bassSynth = new Tone.MonoSynth({
        oscillator: { type: "square" },
        envelope: { attack: 0.006, decay: 0.08, sustain: 0.16, release: 0.08 },
        filter: { Q: 5, type: "lowpass", rolloff: -24 },
        filterEnvelope: { attack: 0.002, decay: 0.12, sustain: 0.18, release: 0.08, baseFrequency: 90, octaves: 2.6 },
      }).connect(dungeonFilter);
      const stabSynth = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: "pulse", width: 0.26 },
        envelope: { attack: 0.01, decay: 0.1, sustain: 0.04, release: 0.16 },
      }).connect(echo);
      const sparkSynth = new Tone.Synth({
        oscillator: { type: "triangle" },
        envelope: { attack: 0.004, decay: 0.03, sustain: 0, release: 0.08 },
      }).connect(echo);
      const drumSynth = new Tone.NoiseSynth({
        noise: { type: "brown" },
        envelope: { attack: 0.001, decay: 0.075, sustain: 0, release: 0.025 },
      }).connect(dungeonFilter);

      const transport = Tone.getTransport();
      transport.stop();
      transport.cancel(0);
      transport.bpm.value = song.bpm;
      transport.loop = true;
      transport.loopStart = 0;
      transport.loopEnd = song.loopEnd;

      const accentDrumStep = song.drumSteps[song.drumSteps.length - 1];
      const steps = song.bass.map((_, index) => index);
      const bassSequence = new Tone.Sequence<number>((time, step) => {
        bassSynth.triggerAttackRelease(song.bass[step], "16n", time, 0.78);
      }, steps, "8n").start(0);
      const stabSequence = new Tone.Sequence<number>((time, step) => {
        const note = song.stabs[step];
        if (note) {
          const shadow = Tone.Frequency(note).transpose(6).toNote();
          stabSynth.triggerAttackRelease([note, shadow], "32n", time, 0.22);
        }
      }, steps, "8n").start(0);
      const sparkSequence = new Tone.Sequence<number>((time, step) => {
        const note = song.sparks[step];
        if (note) {
          sparkSynth.triggerAttackRelease(note, "64n", time, 0.13);
        }
      }, steps, "8n").start(0);
      const drumSequence = new Tone.Sequence<number>((time, step) => {
        if (song.drumSteps.includes(step)) {
          drumSynth.triggerAttackRelease("32n", time, step === accentDrumStep ? 0.18 : 0.12);
        }
      }, steps, "8n").start(0);

      transport.start();
      rig.sequences = [bassSequence, stabSequence, sparkSequence, drumSequence];
      rig.instruments = [master, dungeonFilter, echo, bassSynth, stabSynth, sparkSynth, drumSynth];
      rig.musicActive = true;
      setAudioMode("music");
      return rig;
    } catch {
      stopMusic();
      setAudioMode("voice");
      return null;
    }
  }

  function applySoundtrack(nextSoundtrack: WizardSoundtrack) {
    soundtrackRef.current = nextSoundtrack;
    setSoundtrack(nextSoundtrack);
    // Rebuild the loop only if music is already audible; otherwise the new
    // track just waits for the next time the player unmutes into music mode.
    if (audioRef.current?.musicActive) {
      stopMusic();
      void startMusic();
    }
  }

  function stopMusic() {
    if (!audioRef.current) {
      return;
    }

    const transport = audioRef.current.tone.getTransport();
    transport.stop?.();
    transport.cancel?.(0);
    for (const sequence of audioRef.current.sequences) {
      sequence.dispose();
    }
    for (const instrument of audioRef.current.instruments) {
      instrument.dispose();
    }
    audioRef.current.sequences = [];
    audioRef.current.instruments = [];
    audioRef.current.musicActive = false;
  }

  function stopAllAudio() {
    if (!audioRef.current) {
      return;
    }

    stopMusic();
    audioRef.current.tone.getContext().dispose();
    audioRef.current = null;
  }

  async function loadSam() {
    if (samRef.current) {
      return samRef.current;
    }

    try {
      const samModule = (await import("sam-js")) as { default?: SamConstructor } | SamConstructor;
      const SamJs = typeof samModule === "function" ? samModule : samModule.default;
      if (!SamJs) {
        return null;
      }

      samRef.current = new SamJs({
        pitch: 48,
        speed: 78,
        throat: 150,
        mouth: 190,
      });
      return samRef.current;
    } catch {
      return null;
    }
  }

  async function renderSamLine(line: string) {
    const sam = await loadSam();
    if (!sam || !audioRef.current) {
      return null;
    }

    const audio = sam.buf32(sanitizeForSam(line));
    if (!(audio instanceof Float32Array)) {
      return null;
    }

    return { audio };
  }

  async function speakGreeting() {
    const rendered = await renderSamLine(consoleGreeting);
    if (rendered) {
      playSamBuffer(rendered.audio);
    }
  }

  function playSamBuffer(audio: Float32Array) {
    const rig = audioRef.current;
    if (!rig) {
      return null;
    }

    const buffer = rig.context.createBuffer(1, audio.length, samSampleRate);
    const channel = buffer.getChannelData(0);
    for (const [index, sample] of audio.entries()) {
      channel[index] = sample;
    }
    const source = rig.context.createBufferSource();
    const gain = rig.context.createGain();
    gain.gain.value = 0.8;
    source.buffer = buffer;
    source.connect(gain);
    gain.connect(rig.context.destination);
    source.start();
    return source;
  }

  useEffect(() => {
    if (fastMode || started || !soundOn || greetingSpokenRef.current) {
      return;
    }

    greetingSpokenRef.current = true;
    void speakGreeting();
  }, [fastMode, started, soundOn]);

  function playKeyTone(kind: "letter" | "backspace" | "enter" | "move" | "deny") {
    const rig = audioRef.current;
    if (!rig) {
      return;
    }

    const now = rig.context.currentTime;
    const tones = {
      letter: { frequency: 880, duration: 0.025, volume: 0.055 },
      backspace: { frequency: 220, duration: 0.04, volume: 0.065 },
      enter: { frequency: 660, duration: 0.055, volume: 0.075 },
      move: { frequency: 440, duration: 0.035, volume: 0.055 },
      deny: { frequency: 120, duration: 0.08, volume: 0.075 },
    };
    const tone = tones[kind];
    playTone(rig.context, rig.context.destination, tone.frequency, now, tone.duration, "square", tone.volume);
  }

  function playFallbackSpeechTick(character: string) {
    const rig = audioRef.current;
    if (!rig || character.trim().length === 0) {
      return;
    }

    const now = rig.context.currentTime;
    const buffer = rig.context.createBuffer(1, rig.context.sampleRate * 0.022, rig.context.sampleRate);
    const output = buffer.getChannelData(0);
    for (const [index] of output.entries()) {
      const envelope = 1 - index / output.length;
      output[index] = pseudoNoise(index, character) * envelope * envelope;
    }

    const source = rig.context.createBufferSource();
    const filter = rig.context.createBiquadFilter();
    const gain = rig.context.createGain();
    filter.type = "bandpass";
    filter.frequency.value = 1800 + (character.charCodeAt(0) % 7) * 180;
    filter.Q.value = 5;
    gain.gain.setValueAtTime(0.06, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.022);
    source.buffer = buffer;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(rig.context.destination);
    source.start(now);
  }

  useEffect(() => {
    const poll = () => {
      const pad = navigator.getGamepads?.().find(Boolean);
      if (pad) {
        const left = Boolean(pad.buttons[14]?.pressed || pad.axes[0] < -0.55);
        const right = Boolean(pad.buttons[15]?.pressed || pad.axes[0] > 0.55);
        const submit = Boolean(pad.buttons[0]?.pressed || pad.buttons[1]?.pressed);
        const last = lastGamepadRef.current;

        if (left && !last.left) {
          moveSuggestion(-1);
          playKeyTone("move");
        }

        if (right && !last.right) {
          moveSuggestion(1);
          playKeyTone("move");
        }

        if (submit && !last.submit) {
          submitFocusedSuggestion();
        }

        lastGamepadRef.current = { left, right, submit };
      }

      gamepadFrameRef.current = window.requestAnimationFrame(poll);
    };

    gamepadFrameRef.current = window.requestAnimationFrame(poll);

    return () => {
      if (gamepadFrameRef.current) {
        window.cancelAnimationFrame(gamepadFrameRef.current);
      }
    };
  });

  const activeShowcaseGame =
    showcase && showcase.length ? showcase[Math.min(showcaseIndex, showcase.length - 1)] : null;

  return (
    <main
      className="min-h-screen overflow-hidden bg-[#050505] text-[#f7f7f7]"
      style={terminalStyle}
      onClick={(event) => {
        if (event.target instanceof Element && event.target.closest(recommendationButtonSelector)) {
          suppressFocusRef.current = true;
          return;
        }
        const selection = window.getSelection();
        if (selection && selection.toString().trim() !== "") {
          return;
        }
        suppressFocusRef.current = false;
        inputRef.current?.focus();
      }}
      onKeyDown={(event) => {
        if (event.target !== inputRef.current && !arrowKeys.has(event.key)) {
          suppressFocusRef.current = false;
          inputRef.current?.focus();
        }
      }}
      tabIndex={-1}
    >
      <div className="crt-shell relative flex min-h-screen w-screen flex-col p-2 sm:p-3">
        <section className="terminal-stage z-10">
          <div className="terminal-window min-h-0 overflow-y-auto">
            <p className="experimental-tag">EXPERIMENTAL &mdash; a hackathon guide, still learning the cartridges.</p>
            {hydrated ? (
              <div
                className="window-controls"
                onKeyDown={(event) => event.stopPropagation()}
                onClick={(event) => event.stopPropagation()}
              >
                <button
                  type="button"
                  className={`save-button ${isControlNavCursor("topbar", "save") ? "is-nav-cursor" : ""}`}
                  onClick={() => {
                    saveSession();
                    inputRef.current?.focus();
                  }}
                  aria-label="Save session"
                  title="Save session"
                  data-nav-item="true"
                >
                  <span aria-hidden="true">💾</span>
                  <span className="icon-button-label" aria-hidden="true">
                    Save
                  </span>
                </button>
                <button
                  type="button"
                  className={`settings-button ${isControlNavCursor("topbar", "settings") ? "is-nav-cursor" : ""}`}
                  onClick={() => {
                    setSettingsOpen((value) => !value);
                    setControlNavGroup(null);
                    inputRef.current?.focus();
                  }}
                  aria-label="Catalog settings"
                  aria-expanded={settingsOpen}
                  title="Catalog settings"
                  data-nav-item="true"
                >
                  ⚙
                </button>
                <button
                  type="button"
                  className={`reset-button ${isControlNavCursor("topbar", "reset") ? "is-nav-cursor" : ""}`}
                  onClick={() => {
                    resetSession();
                  }}
                  aria-label="Start over"
                  title="Start over"
                  data-nav-item="true"
                >
                  X
                </button>
                {settingsOpen ? (
                  <section className="platform-menu" aria-label="Catalog platform settings">
                    <h2>Catalog Shelves</h2>
                    <p>{enabledPlatforms.length} enabled</p>
                    <div className="platform-toggle-list">
                      {catalogPlatforms.map((platform) => {
                        const enabled = enabledPlatforms.includes(platform);
                        return (
                          <button
                            key={platform}
                            type="button"
                            className={`platform-toggle ${enabled ? "is-on" : "is-off"} ${
                              isControlNavCursor("platform-toggles", platform) ? "is-nav-cursor" : ""
                            }`}
                            data-platform={platform}
                            data-nav-item="true"
                            onClick={() => togglePlatform(platform)}
                            aria-pressed={enabled}
                          >
                            <span aria-hidden="true">{enabled ? "ON" : "OFF"}</span>
                            <strong>{platformLabels[platform]}</strong>
                          </button>
                        );
                      })}
                    </div>
                  </section>
                ) : null}
              </div>
            ) : null}
            <div className="message-stack">
              {messages.map((message) => (
                <div key={message.id} className={`message-${message.speaker}`}>
                  <span className="speaker">{speakerLabel(message.speaker)}</span>
                  <span>{message.text}</span>
                  {message.speaker === "wizard" && message.text === "" ? <span className="terminal-cursor" /> : null}
                </div>
              ))}
              {isStreaming ? (
                <div className="message-wizard">
                  <span className="terminal-cursor" />
                </div>
              ) : null}
              <div ref={scrollRef} />
            </div>
          </div>

          <div className="bottom-terminal z-10">
            {recommendations.length ? (
              <div className="feedback-bar" onKeyDown={(event) => event.stopPropagation()}>
                {!feedbackRating ? (
                  <>
                    <p className="feedback-prompt">Was this reading true?</p>
                    <div className="feedback-options">
                      {feedbackOptions.map((option) => (
                        <button
                          key={option.rating}
                          type="button"
                          className={`feedback-chip ${
                            isControlNavCursor("feedback", option.rating) ? "is-nav-cursor" : ""
                          }`}
                          data-recommendation-button="true"
                          data-nav-item="true"
                          onClick={() => {
                            rateRecommendations(option.rating);
                          }}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </>
                ) : feedbackNoteSent ? (
                  <p className="feedback-prompt">The ledger remembers. Thank you.</p>
                ) : (
                  <form className="feedback-note-form" onSubmit={sendFeedbackNote}>
                    <label className="feedback-prompt" htmlFor="feedback-note">
                      What did it miss? (optional)
                    </label>
                    <div className="feedback-note-row">
                      <input
                        id="feedback-note"
                        value={feedbackNote}
                        onChange={(event) => setFeedbackNote(event.target.value)}
                        maxLength={500}
                        placeholder="Too easy, wrong mood, wanted more romhacks..."
                        className="feedback-note-input"
                        data-recommendation-button="true"
                      />
                      <button
                        type="submit"
                        className="feedback-note-submit"
                        data-recommendation-button="true"
                        disabled={!feedbackNote.trim()}
                      >
                        Send
                      </button>
                    </div>
                  </form>
                )}
              </div>
            ) : null}


            {suggestions.length ? (
              <div className="suggestion-row" aria-label="Suggestions">
                {suggestions.map((option, index) => (
                  <button
                    key={option.value}
                    type="button"
                    className={`suggestion-chip ${
                      isSuggestionBrowsing && index === getSafeSuggestionIndex(suggestions.length, suggestionIndex)
                        ? "is-active"
                        : ""
                    }`}
                    aria-current={
                      isSuggestionBrowsing && index === getSafeSuggestionIndex(suggestions.length, suggestionIndex)
                        ? "true"
                        : undefined
                    }
                    onMouseEnter={() => {
                      setIsSuggestionBrowsing(true);
                      setSuggestionIndex(index);
                    }}
                    onClick={() => {
                      setIsSuggestionBrowsing(true);
                      setCommand(option.label);
                      submitCommand(option.label);
                    }}
                    data-recommendation-button="true"
                  >
                    <span>{option.label}</span>
                    <small>{option.detail}</small>
                  </button>
                ))}
              </div>
            ) : null}

            {!started ? (
              <section className="console-context-panel" aria-label="Choose console context">
                <h2>Choose Console Context</h2>
                <p className="sound-caution">{soundOnCaution}</p>
                <div className="console-context-grid">
                  {catalogPlatforms.map((platform) => {
                    const selected = selectedConsoles.includes(platform);
                    return (
                      <button
                        key={platform}
                        type="button"
                        className={`console-context-button ${selected ? "is-selected" : ""} ${
                          isControlNavCursor("console-context", platform) ? "is-nav-cursor" : ""
                        }`}
                        aria-label={`Select ${platformLabels[platform]}`}
                        aria-pressed={selected}
                        onClick={() => toggleConsoleSelection(platform)}
                        data-recommendation-button="true"
                        data-nav-item="true"
                      >
                        <strong>{platformLabels[platform]}</strong>
                      </button>
                    );
                  })}
                </div>
                <button
                  type="button"
                  className={`console-context-confirm ${
                    isControlNavCursor("console-context", "confirm") ? "is-nav-cursor" : ""
                  }`}
                  onClick={() => beginQuestWithConsoles(selectedConsoles)}
                  disabled={!selectedConsoles.length}
                  data-recommendation-button="true"
                  data-nav-item="true"
                >
                  Begin Quest{selectedConsoles.length > 1 ? ` (${selectedConsoles.length})` : ""}
                </button>
              </section>
            ) : null}

            <form className="prompt-line" onSubmit={handleSubmit}>
              <label className="prompt-label" htmlFor="wizard-command">
                &gt;
              </label>
              <div className="prompt-display" aria-hidden="true">
                <span>{command}</span>
                <span className="terminal-cursor prompt-cursor" />
              </div>
              <div className="prompt-actions">
                <span className="music-status" aria-live="polite">
                  {audioStatus}
                </span>
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    toggleSound();
                    inputRef.current?.focus();
                  }}
                  className={`prompt-icon-button sound-button ${
                    musicOn ? "is-on" : audioMode === "voice" ? "is-voice" : "is-off"
                  } ${
                    isControlNavCursor("topbar", "sound") ? "is-nav-cursor" : ""
                  }`}
                  aria-label={`Audio mode: ${audioStatus}. ${nextAudioModeLabel}`}
                  title={audioStatus}
                  data-nav-item="true"
                >
                  <span className="audio-glyph" aria-hidden="true">
                    <span className="audio-core" />
                    <span className="audio-wave audio-wave-1" />
                    <span className="audio-wave audio-wave-2" />
                    <span className="audio-slash" />
                  </span>
                  <span className="sr-only">{audioStatus}</span>
                </button>
                <button
                  type="submit"
                  className="prompt-icon-button send-button"
                  disabled={!command.trim() || isStreaming}
                  aria-label="Send command"
                  title="Send command"
                >
                  <span className="send-glyph" aria-hidden="true" />
                  <span className="sr-only">Send command</span>
                </button>
              </div>
              <input
                ref={inputRef}
                id="wizard-command"
                value={command}
                onChange={(event) => setCommand(event.target.value)}
                onKeyDown={handleKeyDown}
                className="prompt-input"
                autoComplete="off"
                autoCapitalize="off"
                spellCheck={false}
                disabled={!hydrated || isStreaming}
                aria-label="Terminal command prompt"
              />
            </form>
          </div>
        </section>

        {showcase && showcase.length && activeShowcaseGame ? (
          <div className="showcase-overlay" role="dialog" aria-modal="true" aria-label="Game showcase">
            <div className="showcase-modal">
              <div className="showcase-titlebar">
                <span className="showcase-prompt">C:\WIZWOR&gt;</span>
                <span className="showcase-exe">SHOWCASE.EXE</span>
                <span className="terminal-cursor" />
                <button
                  type="button"
                  className="showcase-close"
                  onClick={closeShowcase}
                  aria-label="Close showcase"
                  title="Close showcase"
                  data-recommendation-button="true"
                >
                  X
                </button>
              </div>

              {showcase.length > 1 ? (
                <div className="showcase-tabs" role="tablist" aria-label="Qualifying games">
                  {showcase.map((recommendation, index) => (
                    <button
                      key={recommendation.game.id}
                      type="button"
                      role="tab"
                      aria-selected={index === showcaseIndex}
                      className={`showcase-tab ${index === showcaseIndex ? "is-active" : ""}`}
                      onClick={() => setShowcaseIndex(index)}
                      data-recommendation-button="true"
                    >
                      TOME {index + 1}
                    </button>
                  ))}
                </div>
              ) : null}

              <div className="showcase-body">
                <div className="showcase-video-frame">
                  {youTubeEmbedUrl(activeShowcaseGame.game.playthroughUrl) ? (
                    <iframe
                      key={activeShowcaseGame.game.id}
                      src={youTubeEmbedUrl(activeShowcaseGame.game.playthroughUrl) ?? undefined}
                      title={`${activeShowcaseGame.game.title} gameplay`}
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  ) : (
                    <a
                      className="playthrough-link"
                      href={activeShowcaseGame.game.playthroughUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      View Source
                    </a>
                  )}
                </div>
                <h2>{activeShowcaseGame.game.title}</h2>
                <p className="showcase-meta">
                  {platformLabel(activeShowcaseGame.game.platform)} / {activeShowcaseGame.game.year}
                  {" · "}
                  {Math.round(activeShowcaseGame.score * 100)}% match
                </p>
                <p className="showcase-reasons">Why it&rsquo;s relevant: {activeShowcaseGame.reasons.join(" / ")}</p>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </main>
  );
}

export default function Home() {
  return <WizardTerminal />;
}

function downloadSessionSnapshot(payload: {
  profile: UserProfile;
  memoryMarkdown: string;
  enabledPlatforms: Platform[];
  terminalTheme: WizardTerminalTheme | undefined;
  messages: Array<{ speaker: Message["speaker"]; text: string }>;
  recommendations: Recommendation[];
}) {
  const filename = `wizwor-save-${Date.now()}.json`;
  const data = {
    savedAt: new Date().toISOString(),
    ...payload,
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 100);
  return filename;
}

function getSafeSuggestionIndex(length: number, index: number) {
  if (length <= 0) {
    return 0;
  }

  return ((index % length) + length) % length;
}

function sanitizeForSam(value: string) {
  return value
    .replace(/%/g, " percent ")
    .replace(/[^a-zA-Z0-9.,?!' -]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function fallbackDuration(line: string) {
  return Math.max(700, line.length * 72);
}

function formatWizardError(error: unknown) {
  const detail = error instanceof Error ? error.message : "Unknown error";
  if (detail === WIZARD_RESPONSE_TOO_LONG_ERROR) {
    return WIZARD_RESPONSE_TOO_LONG_ERROR;
  }
  return `SYSTEM: Wizard request failed (${detail}). Try again.`;
}

function getPersistentStorage() {
  try {
    return typeof window !== "undefined" ? window.localStorage : undefined;
  } catch {
    return undefined;
  }
}

function sanitizeTheme(theme: unknown): WizardTerminalTheme | undefined {
  if (!theme || typeof theme !== "object") {
    return undefined;
  }

  const input = theme as Record<string, unknown>;
  const output: WizardTerminalTheme = {};
  for (const key of ["background", "foreground", "green", "amber", "red", "blue"] as const) {
    const value = input[key];
    if (typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value)) {
      output[key] = value;
    }
  }

  return Object.keys(output).length ? output : undefined;
}

function themeToCssVariables(theme: WizardTerminalTheme | undefined): CSSProperties | undefined {
  if (!theme) {
    return undefined;
  }

  const style: CSSProperties & Record<`--${string}`, string> = {};
  if (theme.background) {
    style["--background"] = theme.background;
    style.backgroundColor = theme.background;
  }
  if (theme.foreground) {
    style["--foreground"] = theme.foreground;
    style.color = theme.foreground;
  }
  if (theme.green) {
    style["--terminal-green"] = theme.green;
  }
  if (theme.amber) {
    style["--terminal-amber"] = theme.amber;
  }
  if (theme.red) {
    style["--terminal-red"] = theme.red;
  }
  if (theme.blue) {
    style["--terminal-blue"] = theme.blue;
  }

  return style;
}

function characterDelayWeight(character: string) {
  if (character === "." || character === "?" || character === "!") {
    return 7;
  }

  if (character === "," || character === ";" || character === ":") {
    return 4;
  }

  if (character === " ") {
    return 1.6;
  }

  return 1;
}

function playTone(
  context: AudioContext,
  destination: AudioNode,
  frequency: number,
  start: number,
  duration: number,
  type: OscillatorType,
  volume: number,
) {
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, start);
  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime(volume, start + 0.004);
  gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
  oscillator.connect(gain);
  gain.connect(destination);
  oscillator.start(start);
  oscillator.stop(start + duration + 0.02);
}

function pseudoNoise(index: number, seed: string) {
  const value = Math.sin((index + 1) * 12.9898 + seed.charCodeAt(0) * 78.233) * 43758.5453;
  return (value - Math.floor(value)) * 2 - 1;
}

function waitForSource(source: AudioBufferSourceNode, paddingMs: number) {
  return new Promise<void>((resolve) => {
    let resolved = false;
    const finish = () => {
      if (!resolved) {
        resolved = true;
        resolve();
      }
    };

    source.onended = finish;
    window.setTimeout(finish, paddingMs);
  });
}

function platformLabel(platform: Recommendation["game"]["platform"]) {
  return platformLabels[platform] ?? platform.toUpperCase();
}

function youTubeEmbedUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.hostname === "youtu.be") {
      const id = parsed.pathname.slice(1);
      return id ? `https://www.youtube.com/embed/${id}` : null;
    }
    if (parsed.hostname.includes("youtube.com")) {
      const id = parsed.searchParams.get("v");
      return id ? `https://www.youtube.com/embed/${id}` : null;
    }
  } catch {
    return null;
  }
  return null;
}

function speakerLabel(speaker: Message["speaker"]) {
  if (speaker === "wizard") {
    return "WIZ>";
  }

  if (speaker === "user") {
    return "YOU>";
  }

  return "SYS>";
}

function makeId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function wait(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}
