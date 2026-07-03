import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Home from "@/app/page";
import type { WizardTurnResponse } from "@/lib/wizard/types";
import { defaultMemoryMarkdown } from "@/lib/wizard/types";

vi.mock("sam-js", () => ({
  default: class MockSam {
    buf32() {
      return new Float32Array(0);
    }
  },
}));

type MockWizardTurnResponse = Omit<WizardTurnResponse, "state"> & {
  state: Omit<WizardTurnResponse["state"], "memoryMarkdown"> & { memoryMarkdown?: string };
};

function response(body: MockWizardTurnResponse) {
  const normalized: WizardTurnResponse = {
    ...body,
    state: {
      ...body.state,
      memoryMarkdown: body.state.memoryMarkdown ?? defaultMemoryMarkdown,
    },
  };
  return Promise.resolve(new Response(JSON.stringify(normalized), { status: 200 }));
}

describe("wizard terminal UI", () => {
  beforeEach(() => {
    const storage = makeStorage();
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: storage,
    });
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: storage,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    sessionStorage.clear();
    localStorage.clear();
  });

  it("submits custom typed text on Enter instead of the highlighted suggestion", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockImplementationOnce(() =>
        response({
          adapter: "chatgpt",
          accepted: true,
          lines: [],
          recommendations: [],
          suggestions: [{ value: "ominous", label: "Ominous", detail: "Dungeons, dread, haunted machinery." }],
          state: {
            started: true,
            needsName: false,
            activeQuestionKey: "mood",
            awaitingFocus: false,
            revealed: false,
            profile: { name: "Ada" },
          },
        }),
      )
      .mockImplementationOnce(() =>
        response({
          adapter: "chatgpt",
          accepted: true,
          lines: [],
          recommendations: [],
          suggestions: [],
          state: {
            started: true,
            needsName: false,
            activeQuestionKey: "playStyle",
            awaitingFocus: false,
            revealed: false,
            profile: { name: "Ada", mood: "weird" },
          },
        }),
      );

    render(<Home />);
    const input = await screen.findByLabelText("Terminal command prompt");
    await waitFor(() => expect(input).toBeEnabled());

    fireEvent.submit(input.closest("form")!);
    await screen.findByText("Ominous");

    fireEvent.change(input, { target: { value: "make it strange and offbeat" } });
    fireEvent.keyDown(input, { key: "Enter" });
    fireEvent.submit(input.closest("form")!);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    const body = JSON.parse(String(fetchMock.mock.calls[1][1]?.body));
    expect(body.command).toBe("make it strange and offbeat");
  });

  it("captures focus and uses ArrowUp before browsing chips with left and right", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockImplementationOnce(() =>
        response({
          adapter: "chatgpt",
          accepted: true,
          lines: [],
          recommendations: [],
          suggestions: [
            { value: "ominous", label: "Ominous", detail: "Dungeons, dread, haunted machinery." },
            { value: "heroic", label: "Heroic", detail: "A quest with a torch held high." },
          ],
          state: {
            started: true,
            needsName: false,
            activeQuestionKey: "mood",
            awaitingFocus: false,
            revealed: false,
            profile: { name: "Ada" },
          },
        }),
      )
      .mockImplementationOnce(() =>
        response({
          adapter: "chatgpt",
          accepted: true,
          lines: [],
          recommendations: [],
          suggestions: [],
          state: {
            started: true,
            needsName: false,
            activeQuestionKey: "playStyle",
            awaitingFocus: false,
            revealed: false,
            profile: { name: "Ada", mood: "heroic" },
          },
        }),
      );

    render(<Home />);
    const input = await screen.findByLabelText("Terminal command prompt");
    await waitFor(() => expect(input).toBeEnabled());

    fireEvent.click(document.querySelector(".terminal-window")!);
    expect(input).toHaveFocus();

    fireEvent.submit(input.closest("form")!);
    const ominous = await screen.findByText("Ominous");
    const heroic = await screen.findByText("Heroic");
    const ominousChip = ominous.closest("button");
    const heroicChip = heroic.closest("button");

    expect(ominousChip).not.toHaveAttribute("aria-current");

    fireEvent.keyDown(input, { key: "ArrowUp" });
    expect(ominousChip).toHaveAttribute("aria-current", "true");

    fireEvent.keyDown(input, { key: "ArrowRight" });
    expect(heroicChip).toHaveAttribute("aria-current", "true");

    fireEvent.keyDown(input, { key: "Enter" });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    const body = JSON.parse(String(fetchMock.mock.calls[1][1]?.body));
    expect(body.command).toBe("Heroic");
  });

  it("dismisses suggestion browsing with ArrowDown and submits the typed fallback", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockImplementationOnce(() =>
        response({
          adapter: "chatgpt",
          accepted: true,
          lines: [],
          recommendations: [],
          suggestions: [
            { value: "ominous", label: "Ominous", detail: "Dungeons, dread, haunted machinery." },
            { value: "heroic", label: "Heroic", detail: "A quest with a torch held high." },
          ],
          state: {
            started: true,
            needsName: false,
            activeQuestionKey: "mood",
            awaitingFocus: false,
            revealed: false,
            profile: { name: "Ada" },
          },
        }),
      )
      .mockImplementationOnce(() =>
        response({
          adapter: "chatgpt",
          accepted: true,
          lines: [],
          recommendations: [],
          suggestions: [],
          state: {
            started: true,
            needsName: false,
            activeQuestionKey: "playStyle",
            awaitingFocus: false,
            revealed: false,
            profile: { name: "Ada", mood: "offbeat" },
          },
        }),
      );

    render(<Home />);
    const input = await screen.findByLabelText("Terminal command prompt");
    await waitFor(() => expect(input).toBeEnabled());

    fireEvent.submit(input.closest("form")!);
    const ominousChip = (await screen.findByText("Ominous")).closest("button");
    const heroicChip = screen.getByText("Heroic").closest("button");

    fireEvent.keyDown(input, { key: "ArrowUp" });
    expect(ominousChip).toHaveAttribute("aria-current", "true");

    fireEvent.keyDown(input, { key: "ArrowRight" });
    expect(heroicChip).toHaveAttribute("aria-current", "true");

    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(ominousChip).not.toHaveAttribute("aria-current");
    expect(heroicChip).not.toHaveAttribute("aria-current");

    fireEvent.change(input, { target: { value: "something offbeat instead" } });
    fireEvent.keyDown(input, { key: "Enter" });
    fireEvent.submit(input.closest("form")!);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    const body = JSON.parse(String(fetchMock.mock.calls[1][1]?.body));
    expect(body.command).toBe("something offbeat instead");
  });

  it("starts without a canned mock response", async () => {
    render(<Home />);
    const input = await screen.findByLabelText("Terminal command prompt");
    await waitFor(() => expect(input).toBeEnabled());

    expect(screen.queryByText(/CRT SIGNAL DORMANT/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/PRESS ENTER TO SUMMON/i)).not.toBeInTheDocument();
    expect(document.querySelector(".message-stack")?.textContent).toBe("");
  });

  it("sends what the user actually typed as the first turn, instead of a blank summon", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementationOnce(() =>
      response({
        adapter: "chatgpt",
        accepted: true,
        lines: ["JOANNE, the board unfolds."],
        recommendations: [],
        suggestions: [],
        state: {
          started: true,
          needsName: false,
          activeQuestionKey: null,
          awaitingFocus: false,
          revealed: false,
          profile: { name: "Joanne", playStyle: "puzzle" },
        },
      }),
    );

    render(<Home />);
    const input = await screen.findByLabelText("Terminal command prompt");
    await waitFor(() => expect(input).toBeEnabled());

    fireEvent.change(input, { target: { value: "I'm Joanne and I want a board game experience." } });
    fireEvent.submit(input.closest("form")!);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const body = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
    expect(body.command).toBe("I'm Joanne and I want a board game experience.");
    expect(body.state.memoryMarkdown).toContain("# MEMORY.md");
    await screen.findByText("I'm Joanne and I want a board game experience.");
  });

  it("persists agent memory and terminal theme in localStorage", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementationOnce(() =>
      response({
        adapter: "chatgpt",
        accepted: true,
        lines: ["The screen turns blue."],
        recommendations: [],
        suggestions: [],
        state: {
          started: true,
          needsName: false,
          activeQuestionKey: null,
          awaitingFocus: false,
          revealed: false,
          profile: { mood: "weird" },
          memoryMarkdown: "# MEMORY.md\n\n## Player\n- Name: Unknown\n\n## Preferences\n- Console colors: blue\n",
          terminalTheme: {
            background: "#001122",
            foreground: "#e8fbff",
            green: "#7ccfff",
          },
        },
      }),
    );

    render(<Home />);
    const input = await screen.findByLabelText("Terminal command prompt");
    await waitFor(() => expect(input).toBeEnabled());

    fireEvent.change(input, { target: { value: "make the console blue" } });
    fireEvent.submit(input.closest("form")!);

    await screen.findByText(/The screen turns/i);
    expect(localStorage.getItem("wyrm-terminal-MEMORY.md")).toContain("Console colors: blue");
    expect(localStorage.getItem("wyrm-terminal-theme")).toContain("#001122");
  });

  it("collects recommendation feedback and an optional note without refocusing the prompt", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation((input) => {
      if (String(input).endsWith("/api/feedback")) {
        return Promise.resolve(new Response(null, { status: 204 }));
      }

      return response({
        adapter: "chatgpt",
        accepted: true,
        lines: ["Recommendation ready."],
        recommendations: [
          {
            game: {
              id: "metroid-mother",
              title: "Metroid: Mother",
              kind: "romhack",
              year: "romhack",
              pitch: "A friendlier, map-aware restoration of Metroid that keeps the lonely alien dread intact.",
              playthroughUrl: "https://www.youtube.com/watch?v=S7fwbZjLpXE",
              moods: ["ominous"],
              difficulty: "fair",
              story: "some",
              playStyle: "side-scroller",
              obscurity: "hidden-gem",
              romhack: "yes",
              tags: ["exploration"],
            },
            score: 0.96,
            reasons: ["answers the ominous mood"],
          },
        ],
        suggestions: [],
        state: {
          started: true,
          needsName: false,
          activeQuestionKey: null,
          awaitingFocus: false,
          revealed: true,
          profile: { name: "Ada", mood: "ominous" },
        },
      });
    });

    render(<Home />);
    const input = await screen.findByLabelText("Terminal command prompt");
    await waitFor(() => expect(input).toBeEnabled());

    fireEvent.change(input, { target: { value: "Ada wants an ominous side-scroller." } });
    fireEvent.submit(input.closest("form")!);

    await screen.findByRole("heading", { name: "Metroid: Mother" });
    expect(screen.getByRole("link", { name: "Watch Playthrough" })).toHaveAttribute(
      "href",
      "https://www.youtube.com/watch?v=S7fwbZjLpXE",
    );
    const feedbackButton = screen.getByRole("button", { name: /Sort of/i });
    fireEvent.click(feedbackButton);

    const note = await screen.findByLabelText("What did it miss? (optional)");
    expect(input).not.toHaveFocus();

    const sendButton = screen.getByRole("button", { name: "Send" });
    expect(sendButton).toBeDisabled();

    fireEvent.change(note, { target: { value: "I wanted more exploration and less combat." } });
    expect(sendButton).toBeEnabled();
    fireEvent.submit(note.closest("form")!);

    await screen.findByText("The ledger remembers. Thank you.");
    const feedbackCalls = fetchMock.mock.calls.filter(([url]) => String(url).endsWith("/api/feedback"));
    expect(feedbackCalls).toHaveLength(2);

    const ratingBody = JSON.parse(String(feedbackCalls[0][1]?.body));
    expect(ratingBody.rating).toBe("sort_of");
    expect(ratingBody.recommendations).toEqual([{ id: "metroid-mother", title: "Metroid: Mother", score: 0.96 }]);

    const noteBody = JSON.parse(String(feedbackCalls[1][1]?.body));
    expect(noteBody.rating).toBe("sort_of");
    expect(noteBody.note).toBe("I wanted more exploration and less combat.");
  });

  it("shows a loading indicator immediately after submitting, before the reply arrives", async () => {
    let resolveFetch!: (value: Response) => void;
    const pending = new Promise<Response>((resolve) => {
      resolveFetch = resolve;
    });
    vi.spyOn(globalThis, "fetch").mockImplementationOnce(() => pending);

    const { container } = render(<Home />);
    const input = await screen.findByLabelText("Terminal command prompt");
    await waitFor(() => expect(input).toBeEnabled());

    fireEvent.change(input, { target: { value: "hello there" } });
    fireEvent.submit(input.closest("form")!);

    await waitFor(() => expect(input).toBeDisabled());
    expect(container.querySelector(".terminal-cursor")).not.toBeNull();

    resolveFetch(
      new Response(
        JSON.stringify({
          adapter: "chatgpt",
          accepted: true,
          lines: ["Hello indeed."],
          recommendations: [],
          suggestions: [],
          state: {
            started: true,
            needsName: false,
            activeQuestionKey: null,
            awaitingFocus: false,
            revealed: false,
            profile: { name: "" },
          },
        }),
        { status: 200 },
      ),
    );

    await screen.findByText(/Hello indeed/);
    await waitFor(() => expect(input).toBeEnabled());
  });

  it("shows API failures as system status instead of canned wizard replies", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockImplementationOnce(() =>
        Promise.resolve(
          new Response(JSON.stringify({ error: "OPENAI_API_KEY is required to run the wizard agent." }), {
            status: 503,
          }),
        ),
      )
      .mockImplementationOnce(() =>
        Promise.resolve(
          new Response(JSON.stringify({ error: "OPENAI_API_KEY is required to run the wizard agent." }), {
            status: 503,
          }),
        ),
      );

    render(<Home />);
    const input = await screen.findByLabelText("Terminal command prompt");
    await waitFor(() => expect(input).toBeEnabled());

    fireEvent.change(input, { target: { value: "arcade" } });
    fireEvent.submit(input.closest("form")!);

    await screen.findByText(/SYSTEM: Wizard request failed/);
    expect(screen.queryByText(/agent wire hums/i)).not.toBeInTheDocument();
    expect(screen.getAllByText(/OPENAI_API_KEY is required/)).toHaveLength(1);

    fireEvent.change(input, { target: { value: "arcade" } });
    fireEvent.submit(input.closest("form")!);
    await waitFor(() => expect(screen.getAllByText(/OPENAI_API_KEY is required/)).toHaveLength(1));
  });

  it("returns focus to the input on any keydown except arrow keys", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementationOnce(() =>
      response({
        adapter: "chatgpt",
        accepted: true,
        lines: [],
        recommendations: [],
        suggestions: [{ value: "ominous", label: "Ominous", detail: "Dungeons, dread, haunted machinery." }],
        state: {
          started: true,
          needsName: false,
          activeQuestionKey: "mood",
          awaitingFocus: false,
          revealed: false,
          profile: { name: "Ada" },
        },
      }),
    );

    render(<Home />);
    const input = await screen.findByLabelText("Terminal command prompt");
    await waitFor(() => expect(input).toBeEnabled());

    fireEvent.submit(input.closest("form")!);
    const ominous = await screen.findByText("Ominous");
    const chip = ominous.closest("button")!;

    chip.focus();
    expect(chip).toHaveFocus();

    fireEvent.keyDown(chip, { key: "ArrowLeft" });
    expect(chip).toHaveFocus();

    fireEvent.keyDown(chip, { key: "a" });
    expect(input).toHaveFocus();
  });
});

function makeStorage(): Storage {
  const entries = new Map<string, string>();
  return {
    get length() {
      return entries.size;
    },
    clear: () => entries.clear(),
    getItem: (key) => entries.get(key) ?? null,
    key: (index) => Array.from(entries.keys())[index] ?? null,
    removeItem: (key) => {
      entries.delete(key);
    },
    setItem: (key, value) => {
      entries.set(key, String(value));
    },
  };
}
