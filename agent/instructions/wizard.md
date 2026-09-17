# Wizard agent instructions

This file is reference documentation, not a live prompt. Nothing loads it at
runtime.

The instructions the agent actually receives are composed in code:

- `src/lib/wizard/shared-instructions.ts` — every persona-neutral rule: the
  profile contract, the catalog scoring handles, the recommendation gate and
  reveal mechanics, memory, theming, and the response budget.
- `src/lib/wizard/persona-instructions.ts` — the voice of each persona.
- `src/lib/wizard/personas.ts` — the registry each route selects from: greeting,
  UI copy, default terminal theme, and localStorage namespace.

`composePersonaInstructions` joins a persona's character lines, the shared
mechanics, and the persona's own first-turn instruction. To change what the
agent is told, edit those modules — `src/lib/wizard/shared-instructions.test.ts`
guards that no rule is dropped.

## Personas

| Route | Persona id | Character |
| --- | --- | --- |
| `/` | `wizard` | The Keeper Beneath the Screen — ominous 1980s arcade terminal |
| `/furry` | `furry` | HOWLNET — early furryMUCK oracle recommending anthro-led cartridges |

Both share the same catalog, the same scoring, and the same rule that a reveal
may only ever name real catalog entries.
