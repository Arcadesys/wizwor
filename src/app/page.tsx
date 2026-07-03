"use client";

import { FormEvent, KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import type { PreferenceKey, Recommendation, UserProfile } from "@/lib/recommender";
import {
  answeredPreferenceCount,
  getRecommendations,
  recommendationThreshold,
  shouldRevealRecommendations,
} from "@/lib/recommender";

type Message = {
  id: string;
  speaker: "system" | "wizard" | "user";
  text: string;
};

type Option = {
  value: string;
  label: string;
  detail: string;
};

type Question = {
  key: PreferenceKey;
  prompt: string;
  options: Option[];
};

type FocusQuestion = {
  key: "focus";
  prompt: string;
  options: Array<Option & { value: PreferenceKey }>;
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

const blankProfile: UserProfile = {
  name: "",
};

const questions: Question[] = [
  {
    key: "mood",
    prompt: "Name the air you want around the cartridge.",
    options: [
      { value: "ominous", label: "Ominous", detail: "Dungeons, dread, haunted machinery." },
      { value: "heroic", label: "Heroic", detail: "A quest with a torch held high." },
      { value: "weird", label: "Weird", detail: "Odd, cursed, difficult to explain." },
      { value: "arcade", label: "Arcade", detail: "Fast, bright, score-chasing energy." },
      { value: "contemplative", label: "Quiet", detail: "Mystery, wandering, and thinking." },
    ],
  },
  {
    key: "playStyle",
    prompt: "Choose the shape of the trial.",
    options: [
      { value: "side-scroller", label: "Side scroller", detail: "Move left to right through danger." },
      { value: "top-down", label: "Top down", detail: "Mazes, rooms, maps, corridors." },
      { value: "action-adventure", label: "Adventure", detail: "Exploration with weapons and secrets." },
      { value: "platformer", label: "Platformer", detail: "Jumps, timing, strange terrain." },
      { value: "puzzle", label: "Puzzle", detail: "Rooms that want to be solved." },
    ],
  },
  {
    key: "difficulty",
    prompt: "How sharp should the teeth be?",
    options: [
      { value: "casual", label: "Casual", detail: "A friendly evening spell." },
      { value: "fair", label: "Fair", detail: "Push back, but no cruelty." },
      { value: "difficult", label: "Difficult", detail: "The old ways. The hard ways." },
    ],
  },
  {
    key: "story",
    prompt: "How much story should glow in the walls?",
    options: [
      { value: "low", label: "Little", detail: "Play first. Lore later, if ever." },
      { value: "some", label: "Some", detail: "A quest shape and a few secrets." },
      { value: "rich", label: "Rich", detail: "Myth, place, and a reason to continue." },
    ],
  },
  {
    key: "obscurity",
    prompt: "Where on the shelf should I reach?",
    options: [
      { value: "classic", label: "Classic", detail: "Known power. Proven cartridge." },
      { value: "hidden-gem", label: "Hidden gem", detail: "A side passage with good dust." },
      { value: "strange", label: "Strange", detail: "The off-road, the altered, the muttering." },
    ],
  },
  {
    key: "romhack",
    prompt: "Will you cross into altered cartridges?",
    options: [
      { value: "no", label: "Original NES", detail: "Unmodified releases only." },
      { value: "curious", label: "Curious", detail: "Show me one if the omen is strong." },
      { value: "yes", label: "Romhacks", detail: "Open the forbidden drawer." },
    ],
  },
];

const focusQuestion: FocusQuestion = {
  key: "focus",
  prompt: "The omens conflict. Which answer rules all others?",
  options: [
    { value: "mood", label: "Mood", detail: "The feeling matters most." },
    { value: "playStyle", label: "Controls", detail: "The way it plays matters most." },
    { value: "difficulty", label: "Difficulty", detail: "The bite must be right." },
    { value: "obscurity", label: "Discovery", detail: "The shelf position matters most." },
  ],
};

export default function Home() {
  const [profile, setProfile] = useState<UserProfile>(blankProfile);
  const [hydrated, setHydrated] = useState(false);
  const [started, setStarted] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "cold-screen",
      speaker: "system",
      text: "CRT SIGNAL DORMANT. PRESS ENTER TO SUMMON A GUIDE.",
    },
  ]);
  const [command, setCommand] = useState("");
  const [activeQuestion, setActiveQuestion] = useState<Question | null>(null);
  const [activeFocusQuestion, setActiveFocusQuestion] = useState<FocusQuestion | null>(null);
  const [suggestionIndex, setSuggestionIndex] = useState(0);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [soundOn, setSoundOn] = useState(false);
  const [samReady, setSamReady] = useState(false);

  const profileRef = useRef(profile);
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

  function resetSession() {
    streamTokenRef.current += 1;
    streamChainRef.current = Promise.resolve();
    sessionStorage.removeItem(storageKey);
    setProfile(blankProfile);
    profileRef.current = blankProfile;
    setStarted(false);
    setMessages([
      {
        id: makeId("cold-screen"),
        speaker: "system",
        text: "CRT SIGNAL DORMANT. PRESS ENTER TO SUMMON A GUIDE.",
      },
    ]);
    setCommand("");
    setActiveQuestion(null);
    setActiveFocusQuestion(null);
    setSuggestionIndex(0);
    setRecommendations([]);
    setIsStreaming(false);
    window.setTimeout(() => inputRef.current?.focus(), 0);
  }

  function streamWizard(lines: string[]) {
    streamChainRef.current = streamChainRef.current.then(async () => {
      const token = streamTokenRef.current;
      setIsStreaming(true);
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

  async function beginSummoning() {
    if (started || isStreaming) {
      return;
    }

    setStarted(true);
    setRecommendations([]);
    setActiveQuestion(null);
    setActiveFocusQuestion(null);
    await startMusic();
    await loadSam();

    const currentProfile = profileRef.current;
    const intro = currentProfile.name.trim()
      ? [
          "SIGNAL FOUND IN THE GLASS.",
          `${currentProfile.name.toUpperCase()}, your session sigil still burns.`,
          "Let us return to the shelf of old thunder.",
        ]
      : [
          "THE CURSOR WAKES.",
          "I am the Keeper Beneath the Screen, and I will guide you through these ancient tomes.",
          "Tell me the name I should carve into this session.",
        ];

    await streamWizard(intro);

    if (currentProfile.name.trim()) {
      await continueInquiry(currentProfile);
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
      await beginSummoning();
      return;
    }

    if (!profileRef.current.name.trim()) {
      if (!value) {
        playKeyTone("deny");
        return;
      }

      setCommand("");
      appendUser(value);
      const nextProfile = { ...profileRef.current, name: value };
      persistProfile(nextProfile);
      await streamWizard([
        `${value.toUpperCase()} is written in green fire.`,
        "Now answer plainly. The cartridge hears hesitation.",
      ]);
      await continueInquiry(nextProfile);
      return;
    }

    if (activeQuestion) {
      const option = interpretQuestionAnswer(activeQuestion, value);
      if (!option) {
        playKeyTone("deny");
        if (value) {
          setCommand("");
          appendUser(value);
          await streamWizard(["That answer will not bind. Type it another way, or press TAB to copy the lit rune."]);
        }
        return;
      }

      setCommand("");
      await chooseOption(activeQuestion, option, value);
      return;
    }

    if (activeFocusQuestion) {
      const option = interpretFocusAnswer(activeFocusQuestion, value);
      if (!option) {
        playKeyTone("deny");
        if (value) {
          setCommand("");
          appendUser(value);
          await streamWizard(["Name the ruling omen another way, or press TAB to copy the lit rune."]);
        }
        return;
      }

      setCommand("");
      await chooseFocus(option, value);
      return;
    }

    setCommand("");
    if (value) {
      appendUser(value);
      await streamWizard(["The shelf is already open. Read the three tomes below."]);
    }
  }

  async function chooseOption(question: Question, option: Option, rawAnswer = option.label) {
    setActiveQuestion(null);
    appendUser(rawAnswer);
    const nextProfile = {
      ...profileRef.current,
      [question.key]: option.value,
    } as UserProfile;

    persistProfile(nextProfile);
    await streamWizard([`I read that as ${option.label}.`]);
    await continueInquiry(nextProfile);
  }

  async function chooseFocus(option: FocusQuestion["options"][number], rawAnswer = option.label) {
    setActiveFocusQuestion(null);
    appendUser(rawAnswer);
    const nextProfile = {
      ...profileRef.current,
      focus: option.value,
    };

    persistProfile(nextProfile);
    await streamWizard(["The ruling omen locks into place.", "The shelf yields."]);
    reveal(nextProfile);
  }

  async function continueInquiry(nextProfile: UserProfile) {
    if (shouldRevealRecommendations(nextProfile)) {
      reveal(nextProfile);
      return;
    }

    const nextQuestion = questions.find((question) => !nextProfile[question.key]);
    if (nextQuestion) {
      await streamWizard([nextQuestion.prompt]);
      setActiveQuestion(nextQuestion);
      return;
    }

    await streamWizard([focusQuestion.prompt]);
    setActiveFocusQuestion(focusQuestion);
  }

  async function reveal(nextProfile: UserProfile) {
    const topThree = getRecommendations(nextProfile).slice(0, 3);
    setRecommendations(topThree);
    await streamWizard([
      "The reading reaches ninety percent resonance.",
      "Three cartridges rise from the dark.",
    ]);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    submitCommand();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      event.preventDefault();
      moveSuggestion(-1);
      playKeyTone("move");
      return;
    }

    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      event.preventDefault();
      moveSuggestion(1);
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

  function moveSuggestion(direction: 1 | -1) {
    if (!suggestions.length) {
      return;
    }

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
      output[index] = (Math.random() * 2 - 1) * envelope * envelope;
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
    <main className="min-h-screen overflow-hidden bg-[#050505] text-[#f7f7f7]" onClick={() => inputRef.current?.focus()}>
      <div className="crt-shell relative flex min-h-screen w-screen flex-col p-2 sm:p-3">
        <section className="terminal-stage z-10">
          <div className="terminal-window min-h-0 overflow-y-auto">
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
            ) : (
              <div className="chat-hud">
                <div className="status-line">
                  ANS {answeredCount}/6 TOP {Math.round(topScore * 100)} NEED{" "}
                  {Math.round(recommendationThreshold * 100)} SAM {samReady ? "OK" : "--"}
                </div>
              </div>
            )}

            {suggestions.length ? (
              <div className="suggestion-row" aria-label="Suggestions">
                {suggestions.map((option, index) => (
                  <button
                    key={option.value}
                    type="button"
                    className={`suggestion-chip ${
                      index === getSafeSuggestionIndex(suggestions.length, suggestionIndex) ? "is-active" : ""
                    }`}
                    onMouseEnter={() => setSuggestionIndex(index)}
                    onClick={(event) => {
                      event.stopPropagation();
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

function matchOption<T extends Option>(options: T[], rawValue: string) {
  const normalized = normalize(rawValue);
  if (!normalized) {
    return null;
  }

  return (
    options.find((option) => normalize(option.label) === normalized || normalize(option.value) === normalized) ??
    options.find((option) => normalize(option.label).startsWith(normalized) || normalize(option.value).startsWith(normalized)) ??
    options.find((option) => normalize(option.label).includes(normalized))
  );
}

function interpretQuestionAnswer(question: Question, rawValue: string) {
  const matched = matchOption(question.options, rawValue);
  if (matched) {
    return matched;
  }

  const normalized = normalize(rawValue);
  if (!normalized) {
    return null;
  }

  const inferredValue = inferPreferenceValue(question.key, normalized);
  return inferredValue ? question.options.find((option) => option.value === inferredValue) ?? null : null;
}

function interpretFocusAnswer(question: FocusQuestion, rawValue: string) {
  const matched = matchOption(question.options, rawValue);
  if (matched) {
    return matched;
  }

  const normalized = normalize(rawValue);
  if (!normalized) {
    return null;
  }

  const inferredValue = inferFocusValue(normalized);
  return inferredValue ? question.options.find((option) => option.value === inferredValue) ?? null : null;
}

function inferPreferenceValue(key: PreferenceKey, normalized: string) {
  const hints: Record<PreferenceKey, Record<string, string[]>> = {
    mood: {
      ominous: ["ominous", "dark", "spooky", "scary", "horror", "haunted", "creepy", "gothic", "grim", "dread"],
      heroic: ["hero", "heroic", "quest", "epic", "brave", "fantasy", "save", "adventure"],
      weird: ["weird", "strange", "odd", "bizarre", "surreal", "experimental", "wild", "mutant"],
      arcade: ["arcade", "fast", "score", "action", "twitch", "quick", "bright", "simple"],
      contemplative: ["quiet", "slow", "mystery", "mysterious", "explore", "moody", "atmosphere", "thoughtful"],
    },
    playStyle: {
      "side-scroller": ["sidescroller", "sidescrolling", "lefttoright", "scrolling", "runandgun"],
      "top-down": ["topdown", "overhead", "maze", "mazes", "rooms", "dungeon"],
      "action-adventure": ["adventure", "exploration", "explore", "zelda", "quest", "secrets"],
      platformer: ["platform", "platformer", "jump", "jumping", "mario", "precision"],
      puzzle: ["puzzle", "puzzles", "brain", "logic", "solve", "thinking"],
    },
    difficulty: {
      casual: ["casual", "easy", "chill", "relaxed", "forgiving", "simple", "cozy", "nottoohard", "notbrutal"],
      fair: ["fair", "medium", "balanced", "normal", "moderate", "somechallenge", "challenge"],
      difficult: ["difficult", "hard", "brutal", "punishing", "tough", "nasty", "mean", "teeth", "challenge"],
    },
    story: {
      low: ["low", "little", "none", "nostory", "gameplay", "arcade", "minimal"],
      some: ["some", "bit", "littlelore", "lightstory", "quest", "context"],
      rich: ["rich", "story", "lore", "myth", "narrative", "world", "plot", "deep"],
    },
    obscurity: {
      classic: ["classic", "known", "famous", "popular", "essential", "canon", "mainstream"],
      "hidden-gem": ["hidden", "gem", "underrated", "overlooked", "lesserknown", "deepcut"],
      strange: ["strange", "obscure", "weird", "offbeat", "offthebeatenpath", "odd", "rare"],
    },
    romhack: {
      no: ["no", "original", "official", "vanilla", "nesonly", "nothacks", "unmodified"],
      curious: ["curious", "maybe", "open", "fine", "ifgood", "possibly"],
      yes: ["yes", "romhack", "romhacks", "hack", "hacks", "mod", "mods", "altered", "forbidden"],
    },
  };

  const scores = Object.entries(hints[key]).map(([value, words]) => ({
    value,
    score: words.reduce((sum, word) => sum + (normalized.includes(word) ? word.length : 0), 0),
  }));
  const best = scores.sort((left, right) => right.score - left.score)[0];
  return best && best.score > 0 ? best.value : null;
}

function inferFocusValue(normalized: string): FocusQuestion["options"][number]["value"] | null {
  const focusHints: Partial<Record<PreferenceKey, string[]>> = {
    mood: ["mood", "vibe", "feel", "feeling", "tone", "atmosphere"],
    playStyle: ["controls", "play", "plays", "style", "genre", "movement"],
    difficulty: ["difficulty", "hard", "easy", "challenge", "bite"],
    obscurity: ["discovery", "obscure", "hidden", "weird", "shelf", "unknown"],
  };
  const scores = Object.entries(focusHints).map(([value, words]) => ({
    value: value as PreferenceKey,
    score: (words ?? []).reduce((sum, word) => sum + (normalized.includes(word) ? word.length : 0), 0),
  }));
  const best = scores.sort((left, right) => right.score - left.score)[0];
  return best && best.score > 0 ? best.value : null;
}

function getSafeSuggestionIndex(length: number, index: number) {
  if (length <= 0) {
    return 0;
  }

  return ((index % length) + length) % length;
}

function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function isResetCommand(value: string) {
  const normalized = normalize(value);
  if (!normalized) {
    return false;
  }

  return [
    "clearcontext",
    "clearyourcontext",
    "startover",
    "restart",
    "reset",
    "newsession",
    "newgame",
  ].some((command) => normalized === command || normalized.includes(command));
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
    output[index] = (Math.random() * 2 - 1) * (1 - index / output.length);
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
