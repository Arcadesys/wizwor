import { describe, expect, it } from "vitest";
import { isResetCommand } from "@/lib/wizard/commands";

describe("isResetCommand", () => {
  it("recognizes reset phrasing", () => {
    expect(isResetCommand("clear your context and start over")).toBe(true);
    expect(isResetCommand("reset")).toBe(true);
    expect(isResetCommand("restart")).toBe(true);
    expect(isResetCommand("new session")).toBe(true);
  });

  it("does not treat an ordinary game request as a reset command", () => {
    // "new game" is common phrasing in a game-recommendation app and must not
    // be read as a request to wipe the session.
    expect(isResetCommand("I want a new game")).toBe(false);
    expect(isResetCommand("any new game ideas?")).toBe(false);
  });

  it("returns false for empty or symbol-only input", () => {
    expect(isResetCommand("")).toBe(false);
    expect(isResetCommand("!?!")).toBe(false);
  });
});
