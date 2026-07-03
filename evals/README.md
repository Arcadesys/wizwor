# Wizard Eval Lab

This folder is for learning how to generate evals, not just running a fixed suite. Keep app code, agent instructions, fixtures, and eval cases together while the product shape is still moving.

## How To Generate Cases

1. Start with a user/job story: what the player is trying to do, what the wizard should learn, and what failure would feel bad.
2. Turn it into a trace: list the player turns, expected state changes, acceptable recommendations, and style constraints.
3. Add deterministic checks where possible: profile fields, reveal state, recommendation count, and top score.
4. Use rubric checks for natural language: persona, helpfulness, reasons, and whether the agent respected typed input.
5. Run the current agent, inspect failures, then refine prompt, schema, parser, or catalog.
6. Promote fixed bugs into regression cases. Browser feedback like "Enter picked the chip instead of my text" belongs here once it has a turn-level expression.
7. Run live evals only when credentials and the Agent Builder adapter are ready.

## Families

- Preference extraction: custom prose maps to the right profile fields.
- Conversation policy: the wizard asks, clarifies, or reveals at the right moment.
- Recommendation quality: the top three satisfy the score threshold and explain why.
- Style/UX contract: the wizard remains original, terse, and controllable.

## Commands

- `npm run evals` runs portable JSONL cases through the live Agents SDK adapter. `OPENAI_API_KEY` is required.
- `npm run dev` starts the Next.js app; `/api/wizard` always uses the live Agents SDK path.

Some starter cases are marked `xfail` on purpose. They are there to teach interpretation: an expected failure should trigger trace review, not panic.
