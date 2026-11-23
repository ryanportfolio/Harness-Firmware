# codex-run

One launcher for every skill that runs OpenAI Codex CLI. Skills call this; never hand-build `codex exec` lines. Pattern copied from HarnessC `apps/server/src/textGeneration/CodexTextGeneration.ts`. Checked on codex-cli 0.171.0.

```bash
node .claude/scripts/codex-run/codex-run.mjs --preflight            # version, login, gateway, model roles (JSON); exit 1 = not ready
node .claude/scripts/codex-run/codex-run.mjs --out <new dir> --role sol [opts] < prompt.md
```

Run from target repo root (or pass `--cd`). Long runs: start in background, poll `<out>/status.json` / stdout progress line (every 30 s), read `<out>/result.json` after exit. Foreground Bash tool dies at 10 min.

## Models

`models.json` = only model pins. Roles: `sol` (newest Sol, high), `sol-prev` (previous Sol, high), `astra` (newest Astra, medium). `--role` picks model + default effort; `--model <id>` / `--effort` override (explicit user choice). No role/model → refused: never inherits `config.toml` default. New model ships → edit `models.json` only.

## Options

| Flag | Effect |
|---|---|
| `--out DIR` | required; new or empty dir; all files land here |
| `--role R` / `--model ID`, `--effort E` | model + reasoning effort |
| `--sandbox S` | `read-only` (default), `workspace-write`, `danger-full-access`; always passed explicitly, checked in rollout |
| `--prompt-file F` | prompt from file; else stdin. Always stdin to codex (`-`), so `$` and backticks safe |
| `--review` | `codex exec review` (review mode, `ExitedReviewMode` findings) |
| `--base B` / `--commit SHA` / `--uncommitted` | review selector; implies no prompt (CLI rejects selector + prompt) |
| `--schema F` | `--output-schema`; final message parsed → `output.json`, bad JSON = failure |
| `--image F` (repeat) | `-i`; placed before `-` |
| `--cd DIR`, `--add-dir DIR`, `--skip-git-repo-check`, `--ephemeral` | pass-through. `--ephemeral` → no rollout → model/sandbox unverified |
| `--config k=v` (repeat) | extra `-c` (e.g. per-run MCP server for live browser, `model_provider=openai` for image gen) |
| `--keep-hooks`, `--keep-plugins`, `--keep-mcp` | default OFF: user hooks, plugins/apps, user MCP servers disabled per run (no config.toml edits) |
| `--timeout-min N` | default 30; kills process tree, reason `timeout` |
| `--expect-diff "BASE HEAD"` | count reviewer `git diff BASE HEAD` reads (scope identity); one SHA = uncommitted vs head |
| `--expect-read PATH` | count reviewer commands reading PATH (skill-load evidence), skips rg/grep/find/ls |
| `--label L` | free text in run.json |

## Output files

- `run.json`: requested model/effort/sandbox, selector, disabled MCP names, exact command.
- `events.jsonl` (`--json` stream), `stderr.log`, `pid`, `status.json`, `prompt.md`.
- `last.md`: final message (`-o`). `output.json` with `--schema`. `review-output.json`: `ExitedReviewMode.review_output` (findings array) in review mode.
- `result.json`: `ok`, `reason`, `exitCode`, `timedOut`, `durationSec`, `threadId`, `requested`, `observed` {model, effort, sandbox from rollout `turn_context`}, `usage` tokens, `errors`, `notices`, `evidence` {rollout, reviewRollout, reviewSiblings, exitedReviewMode, toolCalls, spawnCalls, diffReads, untrackedListed, expectedReads}.

`usage` = tokens from `turn.completed`. Review mode: Codex reports all zeros there (reviewer runs in sibling thread), so treat review `usage` as unknown, not free. `--expect-diff BASE HEAD` also counts `git show HEAD` only when BASE is HEAD's parent (single-commit scope), never `git show HEAD:<path>`. Review mode: `observed` comes only from the single review sibling; no sibling → `observed` null (unverified), never the launcher's settings.

Preflight `gatewayProvider` = the provider Codex uses without `--profile`: top-level `model_provider`, or the `[profiles.<name>]` one when top-level `profile = "<name>"`; other profiles ignored.

`reason` values: `mcp_isolation_failed` (`codex mcp list` failed or unreadable, so the user's MCP servers could not be turned off; Codex not started; `--keep-mcp` runs anyway), `prompt_not_delivered` (Codex closed stdin before reading the whole prompt), `timeout`, `model_rejected`, `nonzero_exit`, `empty_report`, `schema_output_not_json`, `review_not_finished`, `model_mismatch`, `sandbox_mismatch`, `effort_mismatch` (each mismatch checked only when the rollout records the value). Exit 0 = ok, 1 = run failed, 2 = bad arguments.

Model check reads the session rollout (`$CODEX_HOME/sessions/YYYY/MM/DD/rollout-*-<threadId>.jsonl`), not `run.log` headers (`--json` prints none). Review mode: reviewer's tool calls live in sibling rollout (`parent_thread_id` = thread, `subagent: review`); runner finds it.

## Retry rule (skills keep it)

`model_rejected` → `codex debug models`, newer pin → update `models.json` only with user OK. Other failure → one retry, new `--out`. Second failure → stop, report both.
