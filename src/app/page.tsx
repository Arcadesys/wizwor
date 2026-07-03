"use client";

import { CSSProperties, FormEvent, KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import type { Recommendation, UserProfile } from "@/lib/recommender";
import { answeredPreferenceCount, getRecommendations, recommendationThreshold } from "@/lib/recommender";
import type { FeedbackRating } from "@/lib/feedback";
import { isResetCommand } from "@/lib/wizard/interpreter";
import type {
  AgentData,
  WizardMessage,
  WizardOption,
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
  timer: number;
  musicGain: GainNode;
};

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
const arrowKeys = new Set(["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"]);
const recommendationButtonSelector = "[data-recommendation-button='true']";

const feedbackOptions: Array<{ rating: FeedbackRating; label: string }> = [
  { rating: "nailed", label: "\u{1F44D} Nailed it" },
  { rating: "sort_of", label: "\u{1F914} Sort of" },
  { rating: "not_even_haunted", label: "\u{1F44E} Not even haunted" },
];

type WizardTerminalProps = {
  fastMode?: boolean;
};

export function WizardTerminal({ fastMode = false }: WizardTerminalProps) {
  const [profile, setProfile] = useState<UserProfile>(blankProfile);
  const [memoryMarkdown, setMemoryMarkdown] = useState(defaultMemoryMarkdown);
  const [terminalTheme, setTerminalTheme] = useState<WizardTerminalTheme | undefined>();
  const [hydrated, setHydrated] = useState(false);
  const [started, setStarted] = useState(false);
  const [needsName, setNeedsName] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [command, setCommand] = useState("");
  const [suggestions, setSuggestions] = useState<WizardOption[]>([]);
  const [suggestionIndex, setSuggestionIndex] = useState(0);
  const [isSuggestionBrowsing, setIsSuggestionBrowsing] = useState(false);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [agentData, setAgentData] = useState<AgentData | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [agentDataExpanded, setAgentDataExpanded] = useState(false);
  const [soundOn, setSoundOn] = useState(false);
  const [samReady, setSamReady] = useState(false);
  const [feedbackRating, setFeedbackRating] = useState<FeedbackRating | null>(null);
  const [feedbackNote, setFeedbackNote] = useState("");
  const [feedbackNoteSent, setFeedbackNoteSent] = useState(false);

  const profileRef = useRef(profile);
  const memoryMarkdownRef = useRef(memoryMarkdown);
  const terminalThemeRef = useRef(terminalTheme);
  const startedRef = useRef(started);
  const needsNameRef = useRef(needsName);
  const recommendationsRef = useRef(recommendations);
  const messagesRef = useRef(messages);
  const sessionIdRef = useRef(makeId("session"));
  const audioRef = useRef<AudioRig | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const streamChainRef = useRef(Promise.resolve());
  const streamTokenRef = useRef(0);
  const samRef = useRef<InstanceType<SamConstructor> | null>(null);
  const gamepadFrameRef = useRef<number | null>(null);
  const lastGamepadRef = useRef<GamepadState>({ left: false, right: false, submit: false });
  const suppressFocusRef = useRef(false);

  const answeredCount = answeredPreferenceCount(profile);
  const topScore = useMemo(() => getRecommendations(profile)[0]?.score ?? 0, [profile]);
  const visibleAgentData = useMemo(() => buildVisibleAgentData(agentData, profile), [agentData, profile]);
  const terminalStyle = useMemo(() => themeToCssVariables(terminalTheme), [terminalTheme]);

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
      } catch {
        sessionStorage.removeItem(storageKey);
        getPersistentStorage()?.removeItem(themeStorageKey);
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
    return () => {
      if (audioRef.current) {
        window.clearInterval(audioRef.current.timer);
        audioRef.current.context.close();
        audioRef.current = null;
      }
    };
  }, []);

  function persistProfile(nextProfile: UserProfile) {
    setProfile(nextProfile);
    profileRef.current = nextProfile;
    sessionStorage.setItem(storageKey, JSON.stringify(nextProfile));
  }

  function persistMemory(nextMemoryMarkdown?: string, nextTerminalTheme?: WizardTerminalTheme) {
    const safeMemory = nextMemoryMarkdown?.trim() ? nextMemoryMarkdown : memoryMarkdownRef.current || defaultMemoryMarkdown;
    const safeTheme = sanitizeTheme(nextTerminalTheme);
    setMemoryMarkdown(safeMemory);
    memoryMarkdownRef.current = safeMemory;
    const persistentStorage = getPersistentStorage();
    persistentStorage?.setItem(memoryStorageKey, safeMemory);
    setTerminalTheme(safeTheme);
    terminalThemeRef.current = safeTheme;
    if (safeTheme) {
      persistentStorage?.setItem(themeStorageKey, JSON.stringify(safeTheme));
    } else {
      persistentStorage?.removeItem(themeStorageKey);
    }
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
    persistProfile(response.state.profile);
    persistMemory(response.state.memoryMarkdown, response.state.terminalTheme);
    setStarted(response.state.started);
    startedRef.current = response.state.started;
    setNeedsName(response.state.needsName);
    needsNameRef.current = response.state.needsName;
    setSuggestions(response.suggestions);
    setRecommendations(response.recommendations);
    recommendationsRef.current = response.recommendations;
    setAgentData(response.agentData ?? null);
    setSuggestionIndex(0);
    setIsSuggestionBrowsing(false);
    setFeedbackRating(null);
    setFeedbackNote("");
    setFeedbackNoteSent(false);
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
    setNeedsName(false);
    needsNameRef.current = false;
    const coldMessages: Message[] = [];
    setMessages(coldMessages);
    messagesRef.current = coldMessages;
    setCommand("");
    setSuggestions([]);
    setSuggestionIndex(0);
    setIsSuggestionBrowsing(false);
    setRecommendations([]);
    recommendationsRef.current = [];
    setAgentData(null);
    setIsStreaming(false);
    setFeedbackRating(null);
    setFeedbackNote("");
    setFeedbackNoteSent(false);
    window.setTimeout(() => inputRef.current?.focus(), 0);
  }

  function streamWizard(lines: string[]) {
    streamChainRef.current = streamChainRef.current.then(async () => {
      const token = streamTokenRef.current;
      setIsStreaming(true);

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
        if (token === streamTokenRef.current) {
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

      if (token === streamTokenRef.current) {
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

  async function beginSummoning(initialCommand = "") {
    if (started || isStreaming) {
      return;
    }

    setIsStreaming(true);
    setRecommendations([]);
    recommendationsRef.current = [];
    setSuggestions([]);
    setAgentData(null);
    setFeedbackRating(null);
    setFeedbackNote("");
    setFeedbackNoteSent(false);
    if (!fastMode) {
      await startMusic();
      await loadSam();
    }

    try {
      const response = await requestWizardTurn(initialCommand);
      applyWizardResponse(response);
      await streamWizard(response.lines);
    } catch (error) {
      appendSystem(formatWizardError(error));
      setIsStreaming(false);
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
      if (value) {
        appendUser(value);
      }
      await beginSummoning(value);
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
      startSuggestionBrowsing();
      playKeyTone("move");
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setIsSuggestionBrowsing(false);
      playKeyTone("move");
      return;
    }

    if (event.key === "ArrowLeft") {
      if (isSuggestionBrowsing) {
        event.preventDefault();
        moveSuggestion(-1);
        playKeyTone("move");
      }
      return;
    }

    if (event.key === "ArrowRight") {
      if (isSuggestionBrowsing) {
        event.preventDefault();
        moveSuggestion(1);
        playKeyTone("move");
      }
      return;
    }

    if (event.key === "Escape") {
      setIsSuggestionBrowsing(false);
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

  async function toggleSound() {
    if (soundOn) {
      stopMusic();
      setSoundOn(false);
      return;
    }

    await startMusic();
    await loadSam();
  }

  async function startMusic() {
    if (audioRef.current) {
      await audioRef.current.context.resume();
      setSoundOn(true);
      return audioRef.current;
    }

    try {
      const AudioContextClass =
        window.AudioContext ||
        (window as typeof window & { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const context = new AudioContextClass();
      const master = context.createGain();
      const filter = context.createBiquadFilter();
      const musicGain = context.createGain();
      master.gain.value = 0.055;
      musicGain.gain.value = 0.7;
      filter.type = "lowpass";
      filter.frequency.value = 1150;
      filter.connect(master);
      master.connect(context.destination);
      musicGain.connect(filter);

      let step = 0;
      const timer = window.setInterval(() => {
        const now = context.currentTime;
        const bass = [55, 55, 82.41, 73.42, 55, 98, 82.41, 49];
        const high = [220, 0, 196, 0, 164.82, 0, 146.83, 0];
        playTone(context, musicGain, bass[step % bass.length], now, 0.18, "square", 0.42);

        if (high[step % high.length]) {
          playTone(context, musicGain, high[step % high.length], now + 0.04, 0.08, "triangle", 0.16);
        }

        if (step % 4 === 0) {
          playNoise(context, musicGain, now + 0.02);
        }

        step += 1;
      }, 230);

      audioRef.current = { context, timer, musicGain };
      setSoundOn(true);
      return audioRef.current;
    } catch {
      setSoundOn(false);
      return null;
    }
  }

  function stopMusic() {
    if (!audioRef.current) {
      return;
    }

    window.clearInterval(audioRef.current.timer);
    audioRef.current.context.close();
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
      setSamReady(true);
      return samRef.current;
    } catch {
      setSamReady(false);
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

  return (
    <main
      className="min-h-screen overflow-hidden bg-[#050505] text-[#f7f7f7]"
      style={terminalStyle}
      onClick={(event) => {
        if (event.target instanceof Element && event.target.closest(recommendationButtonSelector)) {
          suppressFocusRef.current = true;
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
              <button
                type="button"
                className="reset-button"
                onClick={() => {
                  resetSession();
                }}
                aria-label="Start over"
                title="Start over"
              >
                X
              </button>
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
              <div className="recommendation-grid">
                {recommendations.map((recommendation, index) => (
                  <article key={recommendation.game.id} className="recommendation-card">
                    <div className="recommendation-meta">
                      <p>TOME {index + 1}</p>
                      <p>{Math.round(recommendation.score * 100)}%</p>
                    </div>
                    <h2>{recommendation.game.title}</h2>
                    <p className="recommendation-kind">
                      {recommendation.game.kind === "romhack" ? "ROMHACK" : "NES"} / {recommendation.game.year}
                    </p>
                    <p>{recommendation.game.pitch}</p>
                    <p className="recommendation-reasons">{recommendation.reasons.join(" / ")}</p>
                    <a
                      className="playthrough-link"
                      href={recommendation.game.playthroughUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      data-recommendation-button="true"
                    >
                      Watch Playthrough
                    </a>
                  </article>
                ))}
              </div>
            ) : null}

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
                          className="feedback-chip"
                          data-recommendation-button="true"
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

            {!recommendations.length ? (
              <div className="chat-hud">
                <div className="status-line">
                  ANS {answeredCount}/6 TOP {Math.round(topScore * 100)} NEED{" "}
                  {Math.round(recommendationThreshold * 100)} SAM {samReady ? "OK" : "--"}
                </div>
              </div>
            ) : null}

            <section
              className={`agent-data-panel ${agentDataExpanded ? "is-expanded" : ""}`}
              aria-label="Agent data"
              onKeyDown={(event) => event.stopPropagation()}
              data-recommendation-button="true"
            >
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  setAgentDataExpanded((value) => !value);
                }}
                className={`magnify-button ${agentDataExpanded ? "is-on" : "is-off"}`}
                aria-label={agentDataExpanded ? "Collapse agent data" : "Expand agent data"}
                aria-expanded={agentDataExpanded}
                title={agentDataExpanded ? "Collapse agent data" : "Expand agent data"}
              >
                <span className="magnify-glyph" aria-hidden="true">
                  <span className="magnify-lens" />
                  <span className="magnify-handle" />
                </span>
                <span className="sr-only">{agentDataExpanded ? "Collapse agent data" : "Expand agent data"}</span>
              </button>
              <div className="agent-data-summary">
                <span>AGENT DATA</span>
                <span>
                  ABOVE {visibleAgentData.gamesAboveThreshold.length} / THRESHOLD{" "}
                  {visibleAgentData.thresholdPercent}%
                </span>
              </div>
              <div className="agent-data-body">
                <div>
                  <h2>Games Above Threshold</h2>
                  {visibleAgentData.gamesAboveThreshold.length ? (
                    <ol className="agent-game-list">
                      {visibleAgentData.gamesAboveThreshold.map((game) => (
                        <li key={game.id}>
                          <strong>{game.title}</strong> {game.matchPercent}%
                          {game.reasons.length ? <span> / {game.reasons.join(" / ")}</span> : null}
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <p>No games clear the threshold yet.</p>
                  )}
                </div>
                <div>
                  <h2>Data Consumed And Generated</h2>
                  <pre>{JSON.stringify(visibleAgentData, null, 2)}</pre>
                </div>
              </div>
            </section>

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

            <form className="prompt-line" onSubmit={handleSubmit}>
              <label className="prompt-label" htmlFor="wizard-command">
                &gt;
              </label>
              <div className="prompt-display" aria-hidden="true">
                <span>{command}</span>
                <span className="terminal-cursor prompt-cursor" />
              </div>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  toggleSound();
                  inputRef.current?.focus();
                }}
                className={`sound-button ${soundOn ? "is-on" : "is-off"}`}
                aria-label={soundOn ? "Audio on. Disable sound" : "Audio off. Enable sound"}
                title={soundOn ? "Audio on" : "Audio off"}
              >
                <span className="audio-glyph" aria-hidden="true">
                  <span className="audio-core" />
                  <span className="audio-wave audio-wave-1" />
                  <span className="audio-wave audio-wave-2" />
                  <span className="audio-slash" />
                </span>
                <span className="sr-only">{soundOn ? "Audio on" : "Audio off"}</span>
              </button>
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
      </div>
    </main>
  );
}

export default function Home() {
  return <WizardTerminal />;
}

function buildVisibleAgentData(agentData: AgentData | null, profile: UserProfile) {
  if (agentData) {
    return agentData;
  }

  const recommendations = getRecommendations(profile);
  const gamesAboveThreshold = recommendations
    .filter((recommendation) => recommendation.score >= recommendationThreshold)
    .map((recommendation) => ({
      id: recommendation.game.id,
      title: recommendation.game.title,
      matchPercent: Math.round(recommendation.score * 100),
      reasons: recommendation.reasons,
      pitch: recommendation.game.pitch,
      tags: recommendation.game.tags,
    }));

  return {
    thresholdPercent: Math.round(recommendationThreshold * 100),
    maxQualifyingMatches: 3,
    qualifyingMatchCount: gamesAboveThreshold.length,
    recommendationWindowOpen: gamesAboveThreshold.length > 0 && gamesAboveThreshold.length <= 3,
    gamesAboveThreshold,
    currentBestMatches: recommendations.slice(0, 5).map((recommendation) => ({
      id: recommendation.game.id,
      title: recommendation.game.title,
      matchPercent: Math.round(recommendation.score * 100),
      clearsThreshold: recommendation.score >= recommendationThreshold,
      reasons: recommendation.reasons,
      pitch: recommendation.game.pitch,
      tags: recommendation.game.tags,
    })),
    consumed: {
      profile,
      note: "Local preview before the agent returns live turn data.",
    },
    generated: {},
  } satisfies AgentData;
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

function playNoise(context: AudioContext, destination: AudioNode, start: number) {
  const buffer = context.createBuffer(1, context.sampleRate * 0.08, context.sampleRate);
  const output = buffer.getChannelData(0);
  for (let index = 0; index < output.length; index += 1) {
    output[index] = pseudoNoise(index, "n") * (1 - index / output.length);
  }

  const source = context.createBufferSource();
  const gain = context.createGain();
  source.buffer = buffer;
  gain.gain.setValueAtTime(0.15, start);
  gain.gain.exponentialRampToValueAtTime(0.001, start + 0.08);
  source.connect(gain);
  gain.connect(destination);
  source.start(start);
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
