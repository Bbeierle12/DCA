# DCA loop log

Newest entries at the bottom. Each entry: date, task id, change, verify result, metrics, notes.

## 2026-10-01 - plan
Wrote PLAN.md, LOOP.md, CLAUDE.md and the loop runners. Baseline metrics are in PLAN.md.

## 2026-10-01 - Phase 0 (P0.1-P0.5)
- P0.1: untracked coverage/test output, removed AI Studio leftovers, fixed the test-setup type
  error, coverage thresholds now enforced (lines 52 / statements 52 / functions 83 / branches 91).
  A deliberate 99% threshold failed the run, so enforcement is real.
- P0.2: `window.__dca` (ready, frames, player, renderInfo, zone, money, teleport). Player
  values are reported in metres even though gameplay still uses old units until P1.3.
- P0.3: Playwright uses `PW_CHROMIUM_PATH` + SwiftShader flags, one worker, 90 s timeout.
  Every test fails on page errors or console errors. Missing favicon was a console 404; fixed
  with an inline SVG favicon.
- P0.4: `npm run verify` = typecheck, unit + coverage, build, size budget (350 KB gzip), e2e.
  Green in 95 s.
- P0.5: measured with the real renderer (frustum culling on), 1280x720:
  spawn 74 calls / 1.4k tris (camera faces the corner forest);
  Oxford Circus 2,968 calls / 75.9k tris; Trafalgar Square 1,977 calls / 57.6k tris.
  18 lights (16 point + hemisphere + sun), 9 programs, 99 textures, 4,081 geometries, 4,523 meshes.
  Bundle 331 KB gzip. The budget (<= 300 calls) is about 10x away at Oxford Circus.
- Note for next iterations: SwiftShader runs ~2 fps, so e2e asserts on frame counts and
  positions, never on wall-clock speed. Use `waitForFrames`, not timeouts.
