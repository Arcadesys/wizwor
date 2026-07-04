import { describe, expect, it } from "vitest";
import { activeChordAtStep, isPlayableSoundtrack } from "@/lib/wizard/soundtrack";

describe("isPlayableSoundtrack", () => {
  const playable = {
    title: "Wor Dungeon Omen",
    bpm: 108,
    loopEnd: "4m",
    bassline: ["A1", "A1", "C2", "B1", "A1", "D2", "C2", "G1", "A1", "A1", "Eb2", "D2", "A1", "F1", "G1", "A1"],
    chords: ["A2 C3 E3", "F2 A2 C3", "C3 E3 G3", "E2 G#2 B2"],
    harmony: ["x", "", "x", "", "x", "", "x", "", "x", "", "x", "", "x", "", "x", ""],
    lead: ["", "E5", "", "C5", "", "Bb4", "", "F#4", "", "A5", "", "Eb5", "", "D5", "", "C#5"],
    rhythm: ["kick", "", "", "", "snare", "", "", "", "kick", "", "", "", "snare", "", "hat", ""],
  };

  it("accepts the default dungeon track shape, including its multi-pass loopEnd", () => {
    expect(isPlayableSoundtrack(playable)).toBe(true);
  });

  it("accepts rests in bassline and multi-token rhythm hits", () => {
    expect(
      isPlayableSoundtrack({ ...playable, bassline: [...playable.bassline.slice(0, 15), ""] }),
    ).toBe(true);
    expect(
      isPlayableSoundtrack({ ...playable, rhythm: [...playable.rhythm.slice(0, 15), "kick hat"] }),
    ).toBe(true);
  });

  it("rejects non-objects and missing fields", () => {
    expect(isPlayableSoundtrack(null)).toBe(false);
    expect(isPlayableSoundtrack("song")).toBe(false);
    expect(isPlayableSoundtrack({})).toBe(false);
    expect(isPlayableSoundtrack({ ...playable, rhythm: undefined })).toBe(false);
  });

  it("rejects malformed notes in bassline or lead", () => {
    expect(isPlayableSoundtrack({ ...playable, bassline: [...playable.bassline.slice(0, 15), "H2"] })).toBe(false);
    expect(isPlayableSoundtrack({ ...playable, lead: [...playable.lead.slice(0, 15), "C#x"] })).toBe(false);
    expect(isPlayableSoundtrack({ ...playable, lead: [...playable.lead.slice(0, 15), 42] })).toBe(false);
  });

  it("rejects a bassline that is not whole measures within 8-32 steps", () => {
    expect(isPlayableSoundtrack({ ...playable, bassline: playable.bassline.slice(0, 12) })).toBe(false);
    expect(isPlayableSoundtrack({ ...playable, bassline: [] })).toBe(false);
    expect(isPlayableSoundtrack({ ...playable, bassline: Array(40).fill("A1") })).toBe(false);
  });

  it("rejects harmony/lead/rhythm whose length does not match the bassline", () => {
    expect(isPlayableSoundtrack({ ...playable, harmony: playable.harmony.slice(0, 8) })).toBe(false);
    expect(isPlayableSoundtrack({ ...playable, lead: playable.lead.slice(0, 8) })).toBe(false);
    expect(isPlayableSoundtrack({ ...playable, rhythm: playable.rhythm.slice(0, 8) })).toBe(false);
  });

  it("rejects chords whose length does not match bassline.length / 4", () => {
    expect(isPlayableSoundtrack({ ...playable, chords: playable.chords.slice(0, 2) })).toBe(false);
    expect(isPlayableSoundtrack({ ...playable, chords: [...playable.chords, "A2 C3 E3"] })).toBe(false);
  });

  it("rejects chord entries with malformed notes or more than 4 notes", () => {
    expect(isPlayableSoundtrack({ ...playable, chords: ["A2 C3 E3", "F2 A2 C3", "C3 E3 G3", "Hx"] })).toBe(false);
    expect(
      isPlayableSoundtrack({ ...playable, chords: ["A2 C3 E3 G3 B3", "F2 A2 C3", "C3 E3 G3", ""] }),
    ).toBe(false);
  });

  it("rejects harmony entries other than \"\" or \"x\"", () => {
    expect(isPlayableSoundtrack({ ...playable, harmony: [...playable.harmony.slice(0, 15), "y"] })).toBe(false);
  });

  it("rejects rhythm entries with unknown drum tokens", () => {
    expect(isPlayableSoundtrack({ ...playable, rhythm: [...playable.rhythm.slice(0, 15), "cowbell"] })).toBe(false);
  });

  it("rejects a non-finite bpm or malformed loopEnd", () => {
    expect(isPlayableSoundtrack({ ...playable, bpm: Number.NaN })).toBe(false);
    expect(isPlayableSoundtrack({ ...playable, bpm: "108" })).toBe(false);
    expect(isPlayableSoundtrack({ ...playable, loopEnd: "2 measures" })).toBe(false);
    expect(isPlayableSoundtrack({ ...playable, loopEnd: "9m" })).toBe(false);
  });
});

describe("activeChordAtStep", () => {
  const track = { chords: ["A2 C3 E3", "", "C3 E3 G3", ""] };

  it("returns the chord starting at its own half-measure", () => {
    expect(activeChordAtStep(track, 0)).toEqual(["A2", "C3", "E3"]);
    expect(activeChordAtStep(track, 8)).toEqual(["C3", "E3", "G3"]);
  });

  it("carries the previous chord forward through an empty slot", () => {
    expect(activeChordAtStep(track, 4)).toEqual(["A2", "C3", "E3"]);
  });

  it("wraps around the loop when the trailing slots are empty", () => {
    expect(activeChordAtStep(track, 12)).toEqual(["C3", "E3", "G3"]);
  });

  it("returns an empty chord when the whole progression is empty", () => {
    expect(activeChordAtStep({ chords: ["", "", "", ""] }, 4)).toEqual([]);
  });

  it("returns an empty chord when there are no chord slots", () => {
    expect(activeChordAtStep({ chords: [] }, 0)).toEqual([]);
  });
});
