import { describe, expect, it } from "vitest";
import { interpretFocusAnswer, interpretQuestionAnswer, isResetCommand } from "@/lib/wizard/interpreter";
import { focusQuestion, getQuestionByKey } from "@/lib/wizard/questions";

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
});
