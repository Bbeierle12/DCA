You are one iteration of the DCA revival loop. Do exactly ONE task, prove it, record it, commit it, stop.

1. Read `PLAN.md` (status, completion goal, decisions, tasks), `CLAUDE.md` (commands,
   conventions) and the last 5 entries of `LOG.md`.
2. If `STATUS:` is not `IN_PROGRESS`, print the status and stop without changing anything.
3. Pick the task: the first `[ ]` or `[~]` task in the lowest unfinished phase whose
   dependencies and decisions are satisfied. A task waiting on an OPEN decision gets `[!]`
   with the reason, and you pick the next one. If a phase's tasks are all `[x]` but its
   Exit line is not yet proven, the task is "prove the phase exit".
4. Mark it `[~]`. Read the code it touches before changing anything.
5. Implement the smallest change that meets the task's AC. Write or extend tests first where
   practical. Keep every file under ~400 lines; split instead of growing.
6. Run `npm run verify` (and `cargo test --workspace` in `server/` once it exists). It must be
   green. If it fails, fix the cause. After 3 failed fix attempts: revert your changes,
   mark the task `[!]` with what you learned, log it, commit the plan/log only, and stop.
7. Never weaken, skip or delete a test or threshold to get green. Never edit the completion
   goal or an AC; if one is wrong, write the proposed change under Decisions as OPEN and
   pick another task.
8. Mark the task `[x]` with evidence in parentheses: short commit hash after committing, plus
   any metric the AC names (e.g. `draw calls 4512 -> 287`).
9. Append to `LOG.md`: date, task id, what changed, verify result, metrics, anything the next
   iteration must know.
10. Commit on the current branch: `<task id>: <summary>` with the session attribution trailer
   from CLAUDE.md. Do not push.
11. If every phase Exit through Phase 5 is proven and completion items 1-6 hold, set
   `STATUS: READY_FOR_DEVICE_CHECK`, log it, commit, and stop. If no task can be picked,
   set `STATUS: BLOCKED`, explain in `LOG.md`, commit, and stop.
