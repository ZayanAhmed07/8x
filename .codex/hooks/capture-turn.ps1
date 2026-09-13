$ErrorActionPreference = "Stop"
[Console]::InputEncoding = [System.Text.Encoding]::UTF8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$raw = [Console]::In.ReadToEnd()
if ([string]::IsNullOrWhiteSpace($raw)) {
  exit 0
}

$event = $raw | ConvertFrom-Json
$repoRoot = $event.cwd
try {
  $gitRoot = (& git -C $event.cwd rev-parse --show-toplevel 2>$null)
  if ($LASTEXITCODE -eq 0 -and -not [string]::IsNullOrWhiteSpace($gitRoot)) {
    $repoRoot = $gitRoot.Trim()
  }
} catch {
}

$logDir = Join-Path $repoRoot ".agent-logs"
New-Item -ItemType Directory -Force -Path $logDir | Out-Null

$sessionId = if ($event.session_id) { [string]$event.session_id } else { "unknown-session" }
$shortSession = if ($sessionId.Length -ge 8) { $sessionId.Substring(0, 8) } else { $sessionId }
$sessionSlug = ($sessionId -replace '[^A-Za-z0-9_.-]', '-')
$stateDir = Join-Path $repoRoot ".codex\hooks\state"
New-Item -ItemType Directory -Force -Path $stateDir | Out-Null
$statePath = Join-Path $stateDir ".capture-state-$sessionSlug.json"

$now = (Get-Date).ToUniversalTime().ToString("o")
$today = (Get-Date).ToUniversalTime().ToString("yyyy-MM-dd")
$model = if ($event.model) { [string]$event.model } else { "unknown-model" }
$tool = "codex"
$project = Split-Path -Leaf $repoRoot
$author = "ZayanAhmed07"

if (Test-Path -LiteralPath $statePath) {
  $state = Get-Content -Raw -LiteralPath $statePath | ConvertFrom-Json
} else {
  $stamp = (Get-Date).ToUniversalTime().ToString("yyyy-MM-dd_HH-mm-ss")
  $logName = "${stamp}_${sessionSlug}.md"
  $state = [pscustomobject]@{
    session_id = $sessionId
    log_file = $logName
    total_exchanges = 0
    first_prompt_time = $null
    last_prompt_time = $null
  }
}

$logPath = Join-Path $logDir $state.log_file
if (-not (Test-Path -LiteralPath $logPath)) {
  $header = @"
---
session_id: $sessionId
date: $today
author: $author
model: $model
tool: $tool
project: $project
total_exchanges: 0
first_prompt_time:
last_prompt_time:
---

# Session Log - $today

Session: ``$shortSession`` | Project: ``$project`` | Author: ``$author``

---

"@
  Set-Content -LiteralPath $logPath -Value $header -Encoding UTF8
}

function Update-Header {
  param(
    [string]$Path,
    [object]$State,
    [string]$Model
  )

  $content = Get-Content -Raw -LiteralPath $Path
  $content = $content -replace '(?m)^total_exchanges:.*$', "total_exchanges: $($State.total_exchanges)"
  $content = $content -replace '(?m)^first_prompt_time:.*$', "first_prompt_time: $($State.first_prompt_time)"
  $content = $content -replace '(?m)^last_prompt_time:.*$', "last_prompt_time: $($State.last_prompt_time)"
  $content = $content -replace '(?m)^model:.*$', "model: $Model"
  Set-Content -LiteralPath $Path -Value $content -Encoding UTF8
}

if ($event.hook_event_name -eq "UserPromptSubmit") {
  $state.total_exchanges = [int]$state.total_exchanges + 1
  if (-not $state.first_prompt_time) {
    $state.first_prompt_time = $now
  }
  $state.last_prompt_time = $now
  $entry = @"
[LOG_ENTRY type=PROMPT num=$($state.total_exchanges) session=$shortSession]
timestamp: $now
model: $model

$($event.prompt)


"@
  Add-Content -LiteralPath $logPath -Value $entry -Encoding UTF8
  Update-Header -Path $logPath -State $state -Model $model
  $state | ConvertTo-Json | Set-Content -LiteralPath $statePath -Encoding UTF8
  exit 0
}

if ($event.hook_event_name -eq "Stop") {
  $num = [int]$state.total_exchanges
  if ($num -lt 1) {
    $num = 1
  }
  $message = if ($event.last_assistant_message) { [string]$event.last_assistant_message } else { "" }
  $entry = @"
[LOG_ENTRY type=RESPONSE num=$num session=$shortSession]
timestamp: $now
model: $model

$message


"@
  Add-Content -LiteralPath $logPath -Value $entry -Encoding UTF8
  Update-Header -Path $logPath -State $state -Model $model
  $state | ConvertTo-Json | Set-Content -LiteralPath $statePath -Encoding UTF8
  Write-Output '{"continue":true}'
  exit 0
}

exit 0



