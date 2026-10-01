# Runs the DCA loop with Claude Code headless on Brandon's PC: one task per iteration until
# PLAN.md leaves IN_PROGRESS or the iteration cap is reached.
# Usage (repo root): powershell -ExecutionPolicy Bypass -File scripts\loop.ps1 [-Max 10]
param([int]$Max = 10)
Set-Location (Join-Path $PSScriptRoot "..")
$allowed = "Read,Edit,Write,Glob,Grep,Bash(.venv\Scripts\python.exe *),Bash(python *),Bash(uv *),Bash(npm run *),Bash(cargo *),Bash(git status *),Bash(git diff *),Bash(git log *),Bash(git add *),Bash(git commit *),Bash(git rev-parse *)"
for ($i = 1; $i -le $Max; $i++) {
  $status = ((Select-String -Path PLAN.md -Pattern '^STATUS:' | Select-Object -First 1).Line -split ' ')[1]
  if ($status -ne "IN_PROGRESS") { Write-Host "PLAN.md status is $status - stopping."; exit 0 }
  Write-Host "=== DCA loop iteration $i/$Max ($(Get-Date -Format o)) ==="
  $prompt = Get-Content -Raw LOOP.md
  & claude -p $prompt --permission-mode acceptEdits --allowedTools $allowed --max-turns 120 --output-format text |
    Tee-Object -FilePath .loop-output.log -Append
}
Write-Host "Reached $Max iterations."
