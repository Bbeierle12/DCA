# DCA - working notes for agents

Web game: React 19 + three.js + Vite + TypeScript. Plan and loop: `PLAN.md`, `LOOP.md`,
`LOG.md`. The owner (Brandon) directs architecture; check `PLAN.md` Decisions before choosing.

## Commands

- `npm run dev` - dev server on :3000
- `npm run typecheck` - `tsc --noEmit`
- `npm test` - vitest with coverage thresholds
- `npm run build` - production build, then `npm run size` prints gzip size
- `npm run e2e` - Playwright (starts the dev server). In a sandbox without Playwright's own
  browser, set `PW_CHROMIUM_PATH` to a Chromium binary.
- `npm run verify` - everything above in order; the loop's gate

## Conventions

- Units: 1 three.js unit = 1 metre. Y is up. The world spans x, z in [0, 800].
- Gameplay state lives in plain TS modules under `services/`; React components only render
  and send intents. No per-frame React state updates.
- `window.__dca` is the debug/test API (see `services/debug/DebugApi.ts`); e2e tests read the
  game through it rather than through pixels.
- Feature flags in `services/features.ts`.
- Keep files under ~400 lines. Pure logic gets unit tests; scene code gets e2e coverage.
- Do not commit `coverage/`, `test-results/`, `playwright-report/`, `dist/`.
- Commit messages: `<task id>: <summary>`, then a blank line and the trailers
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` (adjust to the model in use).
