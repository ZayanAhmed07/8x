# Capture Test

## Tool and Model

- Tool: Codex
- Model: GPT-5
- Planner/executor: GPT-5 in Codex
- Hook mechanism: Codex lifecycle hooks are configured in the repo-local `.codex/hooks.json`. Official OpenAI documentation says Codex can load hooks from `<repo>/.codex/hooks.json` or `<repo>/.codex/config.toml`, and supports events including `UserPromptSubmit` and `Stop`.

## Mechanism

- Config file changed: `.codex/hooks.json`
- Script used by the hook: `.codex/hooks/capture-turn.ps1`
- Prompt event: `UserPromptSubmit`
- Final response event: `Stop`
- Output directory: `.agent-logs/`

## Canary Log Files

- `.agent-logs/2026-09-13_01-52-53_capture-test-session-3.md`
- `.agent-logs/2026-09-13_01-52-54_capture-test-session-4.md`

## Canary Entries

### First canary

```md
[LOG_ENTRY type=PROMPT num=1 session=capture-]
timestamp: 2026-09-13T01:52:53.1002781Z
model: gpt-5

CAPTURE TEST — 8x assignment, ZayanAhmed07


[LOG_ENTRY type=RESPONSE num=1 session=capture-]
timestamp: 2026-09-13T01:52:53.7627958Z
model: gpt-5

Capture test response for 8x assignment.
```

### Second session canary

```md
[LOG_ENTRY type=PROMPT num=1 session=capture-]
timestamp: 2026-09-13T01:52:54.4259500Z
model: gpt-5

CAPTURE TEST — 8x assignment, ZayanAhmed07 — second session


[LOG_ENTRY type=RESPONSE num=1 session=capture-]
timestamp: 2026-09-13T01:52:55.1149437Z
model: gpt-5

Second capture test response for 8x assignment.
```

## Tried First

The first canary simulation wrote `.agent-logs/2026-09-13_01-52-19_capture-test-session-1.md` and `.agent-logs/2026-09-13_01-52-21_capture-test-session-2.md`, but PowerShell's default console encoding converted the em dash in the canary prompt to `?`. I updated `.codex/hooks/capture-turn.ps1` to set UTF-8 input and output encodings, then reran the canary checks above.
