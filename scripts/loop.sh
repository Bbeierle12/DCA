#!/usr/bin/env bash
# Runs the DCA loop with Claude Code headless: one task per iteration until PLAN.md
# leaves IN_PROGRESS or the iteration cap is reached.
# Usage: scripts/loop.sh [max_iterations]
set -euo pipefail
cd "$(dirname "$0")/.."
MAX="${1:-10}"
ALLOWED="Read,Edit,Write,Glob,Grep,Bash(npm run *),Bash(npm install *),Bash(npx tsc *),Bash(npx vitest *),Bash(npx playwright *),Bash(git status *),Bash(git diff *),Bash(git log *),Bash(git add *),Bash(git commit *),Bash(git rev-parse *),Bash(cargo *)"
for i in $(seq 1 "$MAX"); do
  status="$(grep -m1 '^STATUS:' PLAN.md | cut -d' ' -f2)"
  if [ "$status" != "IN_PROGRESS" ]; then
    echo "PLAN.md status is $status - stopping."
    exit 0
  fi
  echo "=== DCA loop iteration $i/$MAX ($(date -Iseconds)) ==="
  claude -p "$(cat LOOP.md)" \
    --permission-mode acceptEdits \
    --allowedTools "$ALLOWED" \
    --max-turns 120 \
    --output-format text | tee -a .loop-output.log
done
echo "Reached $MAX iterations."
