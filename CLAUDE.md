@AGENTS.md

# Testing conventions

- Unit tests use Vitest (`npm run test`), colocated with the source as `*.test.ts`/`*.test.tsx`.
- E2E tests use Playwright (`npm run test:e2e`), living in `e2e/*.spec.ts`. They run against the `/test` route (`WizardTerminal fastMode`), which skips SAM speech synthesis and generated audio so tests aren't flaky on sound.
- CI (`.github/workflows/ci.yml`) gates PRs in order: lint → `tsc --noEmit` → unit tests → e2e (desktop + mobile projects, Chromium + WebKit).
- When an e2e test takes a screenshot to prove behavior, attach it with `testInfo.attach(name, { body, contentType: "image/png" })` instead of `page.screenshot({ path: testInfo.outputPath(...) })`. Attached screenshots embed directly in the `playwright-report/` HTML bundle that CI uploads as an artifact, so a reviewer can see the proof by opening the report. Screenshots written only to `path` land in the gitignored `test-results/` directory and aren't visible in that artifact. See the `attachScreenshot` helper at the top of `e2e/wizard.spec.ts`.
