import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import Home from "@/app/page";
import type { WizardTurnResponse } from "@/lib/wizard/types";

vi.mock("sam-js", () => ({
  default: class MockSam {
    buf32() {
      return new Float32Array(0);
    }
  },
}));

function response(body: WizardTurnResponse) {
  return Promise.resolve(new Response(JSON.stringify(body), { status: 200 }));
}

describe("wizard terminal UI", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    sessionStorage.clear();
  });

  it("submits custom typed text on Enter instead of the highlighted suggestion", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockImplementationOnce(() =>
        response({
          adapter: "mock",
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
          adapter: "mock",
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
          adapter: "mock",
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
          adapter: "mock",
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

    fireEvent.click(screen.getByText(/CRT SIGNAL DORMANT/i));
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
    await screen.findByText("I'm Joanne and I want a board game experience.");
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

    await screen.findByText("Hello indeed.");
    await waitFor(() => expect(input).toBeEnabled());
  });

  it("returns focus to the input on any keydown except arrow keys", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementationOnce(() =>
      response({
        adapter: "mock",
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
