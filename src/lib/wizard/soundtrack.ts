import type { WizardSoundtrack } from "@/lib/wizard/types";

// Scientific pitch the frontend's Tone.js voices accept, e.g. "A1", "Eb2", "F#5".
export const soundtrackNotePattern = /^[A-G](?:#|b)?[0-8]$/;

export const rhythmTokens = ["kick", "snare", "hat"] as const;
export type RhythmToken = (typeof rhythmTokens)[number];

// chords/rhythm entries pack multiple tokens into one space-separated string
// (a chord stack of notes, or a set of drum hits on the same step).
export function parseChord(entry: string): string[] {
  return entry.trim().length ? entry.trim().split(/\s+/) : [];
}

export function parseRhythm(entry: string): string[] {
  return entry.trim().length ? entry.trim().split(/\s+/) : [];
}

export function isValidChordEntry(entry: unknown): entry is string {
  if (typeof entry !== "string") {
    return false;
  }
  if (entry === "") {
    return true;
  }
  const notes = parseChord(entry);
  return notes.length <= 4 && notes.every((note) => soundtrackNotePattern.test(note));
}

export function isValidRhythmEntry(entry: unknown): entry is string {
  if (typeof entry !== "string") {
    return false;
  }
  if (entry === "") {
    return true;
  }
  const tokens = parseRhythm(entry);
  return tokens.length > 0 && tokens.every((token) => (rhythmTokens as readonly string[]).includes(token));
}

// Soundtracks cross a trust boundary twice: the frontend sends its playing
// track up as state.soundtrack for set_soundtrack to merge partial edits
// against, and restores saved tracks from localStorage. Both are arbitrary
// client JSON — anything that fails this check must be discarded rather than
// merged or fed to Tone.js triggerAttackRelease, which throws on malformed
// notes mid-playback.
export function isPlayableSoundtrack(value: unknown): value is WizardSoundtrack {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  const { title, bpm, loopEnd, bassline, chords, harmony, lead, rhythm } = candidate;

  if (typeof title !== "string") {
    return false;
  }
  if (typeof bpm !== "number" || !Number.isFinite(bpm)) {
    return false;
  }
  // The transport loop may span multiple passes of the sequence, so only the
  // format is checked, not equality with bassline.length / 8.
  if (typeof loopEnd !== "string" || !/^[1-8]m$/.test(loopEnd)) {
    return false;
  }

  if (
    !Array.isArray(bassline) ||
    bassline.length < 8 ||
    bassline.length > 32 ||
    bassline.length % 8 !== 0
  ) {
    return false;
  }
  const steps = bassline.length;
  if (!bassline.every((note) => note === "" || (typeof note === "string" && soundtrackNotePattern.test(note)))) {
    return false;
  }

  if (!Array.isArray(chords) || chords.length !== steps / 4) {
    return false;
  }
  if (!chords.every(isValidChordEntry)) {
    return false;
  }

  if (!Array.isArray(harmony) || harmony.length !== steps) {
    return false;
  }
  if (!harmony.every((entry) => entry === "" || entry === "x")) {
    return false;
  }

  if (!Array.isArray(lead) || lead.length !== steps) {
    return false;
  }
  if (!lead.every((note) => note === "" || (typeof note === "string" && soundtrackNotePattern.test(note)))) {
    return false;
  }

  if (!Array.isArray(rhythm) || rhythm.length !== steps) {
    return false;
  }
  return rhythm.every(isValidRhythmEntry);
}

// The chord in effect at a given step: the last non-empty chords[] entry at
// or before floor(step / 4), wrapping around the loop if every earlier slot
// (including the current one) is "". Returns [] if the whole progression is
// empty — harmony then has nothing to strike.
export function activeChordAtStep(track: Pick<WizardSoundtrack, "chords">, step: number): string[] {
  const slots = track.chords.length;
  if (slots === 0) {
    return [];
  }
  const start = Math.floor(step / 4) % slots;
  for (let offset = 0; offset < slots; offset += 1) {
    const index = (start - offset + slots) % slots;
    const entry = track.chords[index];
    if (entry) {
      return parseChord(entry);
    }
  }
  return [];
}
