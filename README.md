# Wizwor

An 8-bit terminal recommender prototype built with Next.js.

The app presents an arcade-CRT wizard interface that interviews the player, stores preferences in session storage, speaks with SAM-style synthesized speech, plays generated chiptune audio, and reveals three NES or romhack recommendations once the scoring rubric has enough signal.

## Run Locally

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## Scripts

```bash
npm run lint
npm run build
```

## Stack

- Next.js App Router
- TypeScript
- Tailwind CSS
- `sam-js` for browser-based retro TTS
- Web Audio for generated music and key tones
