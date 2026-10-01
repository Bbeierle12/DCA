# DCA

A one-or-two-player web game set on a living West End street map: earn money, buy plots and
buildings, build and furnish them with a Blender-made kit, and walk into any building.

Built with React, three.js, Vite and TypeScript, with a Rust co-op server planned.

## Run

```bash
npm install
npm run dev        # http://localhost:3000
npm run verify     # typecheck, unit tests, build, end-to-end tests
```

## How work happens

Development runs as a loop: `PLAN.md` holds the completion goal and the task list,
`LOOP.md` is the per-iteration protocol, `LOG.md` records each iteration.
`scripts/loop.sh` (or `scripts/loop.ps1` on Windows) runs Claude Code headless through it.
