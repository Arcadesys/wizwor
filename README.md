# Wizwor

An 8-bit terminal recommender prototype built with Next.js and the OpenAI Agents SDK.

The app presents an arcade-CRT wizard interface that interviews the player through a live agent, stores preferences in session storage, speaks with SAM-style synthesized speech, plays generated chiptune audio, and reveals NES or romhack recommendations from the local catalog.

## Engineering highlights

- Live recommendation agent built with the OpenAI Agents SDK and explicit session state
- Eval cases generated from user and job stories, then expressed as turn-level traces
- Deterministic checks for state, reveal behavior, recommendation count, and scoring
- Rubric checks for persona, helpfulness, explanations, and typed-input handling
- Expected-failure cases plus a regression workflow that promotes fixed bugs into the suite
- Preference-extraction, conversation-policy, recommendation-quality, and UX-contract eval families

### Architecture

```text
Player → Agent interview → Session preferences → Catalog scoring → Recommendation reveal
                    ↘ Eval traces → Deterministic checks + rubric checks
```


## Run Locally

```bash
npm install
npm run dev
```

Open http://localhost:3000.

`OPENAI_API_KEY` is required for wizard turns; put it in `.env.local` for local development.

## Scripts

```bash
npm run lint
npm run build
npm run evals
```

## Stack

- Next.js App Router
- TypeScript
- OpenAI Agents SDK
- Tailwind CSS
- `sam-js` for browser-based retro TTS
- Web Audio for generated music and key tones
