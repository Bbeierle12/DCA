You are one iteration of the DCA loop. Do exactly ONE task, prove it, record it, commit it, stop.

1. Read `PLAN.md` (status, completion goal, decisions, tasks), `CLAUDE.md` (commands,
   conventions) and the last 5 entries of `LOG.md`.
2. If `STATUS:` is not `IN_PROGRESS`, print the status and stop without changing anything.
3. Pick the task: the first `[ ]` or `[~]` task in the lowest unfinished phase whose
   dependencies and decisions are satisfied. A task waiting on an OPEN decision follows that
   decision's rule in PLAN.md (use the stated default, or mark `[!]` with the reason). A task
   that needs UPBGE when this machine has no UPBGE (no `tools/upbge.json`, or its path does
   not exist) gets `[!] needs Brandon's PC` and you pick the next task. If a phase's tasks are
   all `[x]` but its Exit line is not yet proven, the task is "prove the phase exit".
4. Mark it `[~]`. Read the code it touches before changing anything.
5. Implement the smallest change that meets the task's AC. Write or extend tests first where
   practical. Keep every file under ~400 lines; split instead of growing.
6. Run the gate: `python scripts/verify.py` (plus `--upbge` when UPBGE is available here),
   `npm run verify` in `web/` if you touched `web/`, and `cargo test --workspace` in `server/`
   once it exists. Before A3 lands, the gate is `npm run verify` for the web prototype.
   It must be green. If it fails, fix the cause. After 3 failed fix attempts: revert your
   changes, mark the task `[!]` with what you learned, log it, commit the plan/log only, stop.
7. Never weaken, skip or delete a test or threshold to get green. Never edit the completion
   goal or an AC; if one is wrong, write the proposed change under Decisions as OPEN and
   pick another task.
8. Mark the task `[x]` with evidence in parentheses: short commit hash after committing, plus
   any metric the AC names (e.g. `avg 72 fps, 1%-low 51 fps at Oxford Circus`).
9. Append to `LOG.md`: date, task id, what changed, verify result, metrics, anything the next
   iteration must know.
10. Commit on the current branch: `<task id>: <summary>` with the attribution trailer from
   CLAUDE.md. Do not push.
11. If every phase Exit through Phase G is proven and completion items 1-6 hold, set
   `STATUS: READY_FOR_PLAY_CHECK`, log it, commit, and stop. If no task can be picked, set
   `STATUS: BLOCKED`, explain in `LOG.md`, commit, and stop.
