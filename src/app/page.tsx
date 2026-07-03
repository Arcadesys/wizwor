"use client";

import { FormEvent, KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import type { Recommendation, UserProfile } from "@/lib/recommender";
import { answeredPreferenceCount, getRecommendations, recommendationThreshold } from "@/lib/recommender";
import type { FeedbackRating } from "@/lib/feedback";
import { isResetCommand } from "@/lib/wizard/interpreter";
import { focusQuestion, getQuestionByKey } from "@/lib/wizard/questions";
import type {
  WizardFocusQuestion,
  WizardMessage,
  WizardQuestion,
  WizardState,
  WizardTurnResponse,
} from "@/lib/wizard/types";
import { blankProfile } from "@/lib/wizard/types";

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

const samSampleRate = 22050;
const storageKey = "wyrm-terminal-profile";
const arrowKeys = new Set(["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"]);

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
  const [hydrated, setHydrated] = useState(false);
  const [started, setStarted] = useState(false);
  const [needsName, setNeedsName] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "cold-screen",
      speaker: "system",
      text: "CRT SIGNAL DORMANT. PRESS ENTER TO SUMMON A GUIDE.",
    },
  ]);
  const [command, setCommand] = useState("");
  const [activeQuestion, setActiveQuestion] = useState<WizardQuestion | null>(null);
  const [activeFocusQuestion, setActiveFocusQuestion] = useState<WizardFocusQuestion | null>(null);
  const [suggestionIndex, setSuggestionIndex] = useState(0);
  const [isSuggestionBrowsing, setIsSuggestionBrowsing] = useState(false);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [soundOn, setSoundOn] = useState(false);
  const [samReady, setSamReady] = useState(false);
  const [feedbackRating, setFeedbackRating] = useState<FeedbackRating | null>(null);
  const [feedbackNote, setFeedbackNote] = useState("");
  const [feedbackNoteSent, setFeedbackNoteSent] = useState(false);

  const profileRef = useRef(profile);
  const startedRef = useRef(started);
  const needsNameRef = useRef(needsName);
  const activeQuestionRef = useRef(activeQuestion);
  const activeFocusQuestionRef = useRef(activeFocusQuestion);
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

  const suggestions = useMemo(() => {
    if (!started) {
      return [];
    }

    if (activeQuestion) {
      return activeQuestion.options;
    }

    if (activeFocusQuestion) {
      return activeFocusQuestion.options;
    }

    return [];
  }, [activeFocusQuestion, activeQuestion, started]);

  const answeredCount = answeredPreferenceCount(profile);
  const topScore = useMemo(() => getRecommendations(profile)[0]?.score ?? 0, [profile]);

  useEffect(() => {
    queueMicrotask(() => {
      try {
        const saved = sessionStorage.getItem(storageKey);
        if (saved) {
          const restored = { ...blankProfile, ...JSON.parse(saved) } as UserProfile;
          setProfile(restored);
          profileRef.current = restored;
        }
      } catch {
        sessionStorage.removeItem(storageKey);
      } finally {
        setHydrated(true);
      }
    });
  }, []);

  useEffect(() => {
    profileRef.current = profile;
  }, [profile]);

  useEffect(() => {
    startedRef.current = started;
  }, [started]);

  useEffect(() => {
    needsNameRef.current = needsName;
  }, [needsName]);

  useEffect(() => {
    activeQuestionRef.current = activeQuestion;
  }, [activeQuestion]);

  useEffect(() => {
    activeFocusQuestionRef.current = activeFocusQuestion;
  }, [activeFocusQuestion]);

  useEffect(() => {
    recommendationsRef.current = recommendations;
  }, [recommendations]);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, activeQuestion, activeFocusQuestion, recommendations]);

  useEffect(() => {
    inputRef.current?.focus();
  }, [started, activeQuestion, activeFocusQuestion, isStreaming]);

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

  function currentWizardState(): WizardState {
    return {
      started: startedRef.current,
      needsName: needsNameRef.current,
      activeQuestionKey: activeQuestionRef.current?.key ?? null,
      awaitingFocus: Boolean(activeFocusQuestionRef.current),
      revealed: recommendationsRef.current.length > 0,
      profile: profileRef.current,
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
      throw new Error(`Wizard turn failed with ${response.status}`);
    }

    return (await response.json()) as WizardTurnResponse;
  }

  function applyWizardResponse(response: WizardTurnResponse) {
    persistProfile(response.state.profile);
    setStarted(response.state.started);
    startedRef.current = response.state.started;
    setNeedsName(response.state.needsName);
    needsNameRef.current = response.state.needsName;
    const nextQuestion = getQuestionByKey(response.state.activeQuestionKey);
    setActiveQuestion(nextQuestion);
    activeQuestionRef.current = nextQuestion;
    const nextFocusQuestion = response.state.awaitingFocus ? focusQuestion : null;
    setActiveFocusQuestion(nextFocusQuestion);
    activeFocusQuestionRef.current = nextFocusQuestion;
    setRecommendations(response.recommendations);
    recommendationsRef.current = response.recommendations;
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
    const coldMessages: Message[] = [
      {
        id: makeId("cold-screen"),
        speaker: "system",
        text: "CRT SIGNAL DORMANT. PRESS ENTER TO SUMMON A GUIDE.",
      },
    ];
    setMessages(coldMessages);
    messagesRef.current = coldMessages;
    setCommand("");
    setActiveQuestion(null);
    activeQuestionRef.current = null;
    setActiveFocusQuestion(null);
    activeFocusQuestionRef.current = null;
    setSuggestionIndex(0);
    setIsSuggestionBrowsing(false);
    setRecommendations([]);
    recommendationsRef.current = [];
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
    setActiveQuestion(null);
    activeQuestionRef.current = null;
    setActiveFocusQuestion(null);
    activeFocusQuestionRef.current = null;
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
    } catch {
      await streamWizard(["The signal cracked before the guide could enter. Try the summoning again."]);
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
    } catch {
      await streamWizard(["The agent wire hums, but no answer returns. Try again."]);
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
      onClick={() => inputRef.current?.focus()}
      onKeyDown={(event) => {
        if (event.target !== inputRef.current && !arrowKeys.has(event.key)) {
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
                onClick={(event) => {
                  event.stopPropagation();
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
                  </article>
                ))}
              </div>
            ) : null}

            {recommendations.length ? (
              <div
                className="feedback-bar"
                onClick={(event) => event.stopPropagation()}
                onKeyDown={(event) => event.stopPropagation()}
              >
                {!feedbackRating ? (
                  <>
                    <p className="feedback-prompt">Was this reading true?</p>
                    <div className="feedback-options">
                      {feedbackOptions.map((option) => (
                        <button
                          key={option.rating}
                          type="button"
                          className="feedback-chip"
                          onClick={(event) => {
                            event.stopPropagation();
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
                      <button type="submit" className="feedback-note-submit" disabled={!feedbackNote.trim()}>
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
                    onClick={(event) => {
                      event.stopPropagation();
                      setIsSuggestionBrowsing(true);
                      setCommand(option.label);
                      submitCommand(option.label);
                    }}
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
