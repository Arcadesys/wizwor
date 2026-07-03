import { describe, expect, it } from "vitest";
import {
  extractNameFromIntro,
  extractProfileSignals,
  interpretFocusAnswer,
  interpretQuestionAnswer,
  isResetCommand,
} from "@/lib/wizard/interpreter";
import { focusQuestion, getQuestionByKey } from "@/lib/wizard/questions";
import { blankProfile } from "@/lib/wizard/types";

describe("wizard preference interpretation", () => {
  it("maps custom prose into preference options", () => {
    expect(interpretQuestionAnswer(getQuestionByKey("mood")!, "spooky haunted machinery")?.value).toBe("ominous");
    expect(interpretQuestionAnswer(getQuestionByKey("difficulty")!, "chill, not too brutal")?.value).toBe("casual");
    expect(interpretQuestionAnswer(getQuestionByKey("playStyle")!, "rooms and dungeon mazes")?.value).toBe("top-down");
    expect(interpretQuestionAnswer(getQuestionByKey("romhack")!, "yes, forbidden altered carts")?.value).toBe("yes");
  });

  it("maps focus prose and reset commands", () => {
    expect(interpretFocusAnswer(focusQuestion, "the vibe matters most")?.value).toBe("mood");
    expect(isResetCommand("clear your context and start over")).toBe(true);
  });

  it("does not treat an ordinary game request as a reset command", () => {
    // "new game" is common phrasing in a game-recommendation app and must not
    // be read as a request to wipe the session.
    expect(isResetCommand("I want a new game")).toBe(false);
    expect(isResetCommand("any new game ideas?")).toBe(false);
    expect(isResetCommand("reset")).toBe(true);
    expect(isResetCommand("restart")).toBe(true);
  });

  it("does not let short hint words match inside unrelated words", () => {
    // "no" is a romhack hint; it must not fire just because it's a substring of "know".
    expect(interpretQuestionAnswer(getQuestionByKey("romhack")!, "you know, I'm not sure")?.value).toBeUndefined();
  });

  it("prefers the option the reply actually names over an incidental hint word", () => {
    // "story" is itself a hint word for the "rich" story option, and it out-scores
    // "some" by raw length — but the reply is naming "some" directly, so that must win.
    expect(interpretQuestionAnswer(getQuestionByKey("story")!, "some story")?.value).toBe("some");
  });

  it("extracts incidental signal for keys the user isn't being asked about", () => {
    const signals = extractProfileSignals("I want to play the best board game the console ever created.", blankProfile);
    expect(signals.playStyle).toBe("puzzle");
  });

  it("does not extract signal for keys the profile has already answered", () => {
    const signals = extractProfileSignals("a puzzle box of secrets", { ...blankProfile, playStyle: "top-down" });
    expect(signals.playStyle).toBeUndefined();
  });

  it("pulls a name out of a full self-introduction instead of keeping the whole sentence", () => {
    expect(extractNameFromIntro("I'm Joanne and I want something ominous")).toBe("Joanne");
    expect(extractNameFromIntro("call me Ash")).toBe("Ash");
    expect(extractNameFromIntro("my name is Sam, show me something weird")).toBe("Sam");
    expect(extractNameFromIntro("Marcus, I'm after a heroic side-scroller")).toBe("Marcus");
  });

  it("does not mistake filler continuations after 'I'm' for a name", () => {
    expect(extractNameFromIntro("I'm after a heroic side-scroller")).toBeNull();
    expect(extractNameFromIntro("I'm looking for something weird")).toBeNull();
  });

  it("returns null for plain single-word replies, leaving the caller to use the raw command", () => {
    expect(extractNameFromIntro("Ada")).toBeNull();
  });

  it("handles accented and non-Latin names instead of treating them as delimiters", () => {
    expect(extractNameFromIntro("I'm José and I want something ominous")).toBe("José");
    expect(extractNameFromIntro("Zoë, give me something weird")).toBe("Zoë");
    expect(interpretQuestionAnswer(getQuestionByKey("mood")!, "très spooky et haunted")?.value).toBe("ominous");
  });
});
