import type { WizardFocusQuestion, WizardQuestion } from "@/lib/wizard/types";

export const questions: WizardQuestion[] = [
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

export const focusQuestion: WizardFocusQuestion = {
  key: "focus",
  prompt: "The omens conflict. Which answer rules all others?",
  options: [
    { value: "mood", label: "Mood", detail: "The feeling matters most." },
    { value: "playStyle", label: "Controls", detail: "The way it plays matters most." },
    { value: "difficulty", label: "Difficulty", detail: "The bite must be right." },
    { value: "obscurity", label: "Discovery", detail: "The shelf position matters most." },
  ],
};

export function getQuestionByKey(key: string | null | undefined) {
  return questions.find((question) => question.key === key) ?? null;
}
