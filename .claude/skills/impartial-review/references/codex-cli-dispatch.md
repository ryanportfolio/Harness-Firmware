# Codex CLI dispatch commands

Loaded from `SKILL.md` Step 3 when reviewers run as Codex CLI processes (no multi-agent tools). Launch only through the repo's shared runner `node .claude/scripts/codex-run/codex-run.mjs` (docs: `.claude/scripts/codex-run/README.md`); never a hand-built `codex exec` line.

```bash
node .claude/scripts/codex-run/codex-run.mjs --preflight   # JSON; exit 1 = not ready: report the gap, stop the CLI route
mkdir -p .tmp
RUN=$(mktemp -d "$PWD/.tmp/impartial-review-XXXXXXXX")
# write $RUN/prompt-A.txt (standalone bucket prompt), then, Bash run_in_background: true:
node .claude/scripts/codex-run/codex-run.mjs --out "$RUN/A" --role sol --sandbox read-only \
  --prompt-file "$RUN/prompt-A.txt" --timeout-min 30 --label impartial-review-A > "$RUN/A.log" 2>&1
```

- Run from the target repo root (or pass `--cd <repo>`). Use an absolute `$RUN` path: the Bash cwd may reset between calls.
- One runner call per reviewer group: its own new `--out "$RUN/<group>"` (the runner refuses a non-empty directory), `--sandbox read-only` explicit, `--role sol`. The pin lives only in `.claude/scripts/codex-run/models.json`; no model ids here. Explicit user model: `--model <id>` (plus `--effort`).
- Prompt via `--prompt-file` (or stdin). The runner always feeds Codex on stdin, so diffs, backticks and `$` stay intact; never pass the prompt as an argument.
- Uncommitted or branch scope: add `--expect-diff "BASE HEAD"` (or `"HEAD"` for uncommitted) to get `evidence.diffReads`.
- The prompt passes the exact scope, forbids nested review (no codex exec, no agents), and forbids edits.
- Never pass `--ephemeral` (no rollout, so the model is unverified). Never pass `--keep-hooks`, `--keep-plugins` or `--keep-mcp`: the runner turns user hooks, plugins/apps and user MCP servers off per run by default.
- Bounded batches (for example 3 at once), each in the background; poll each `<out>/status.json` (`running`, `elapsedSec`, `events`, `last`, every 30 s) and wait for exit before starting more. A foreground Bash call dies at 10 min and takes the run with it. Redirect runner stdout to the log file; never pipe it through `head` or `tail`.
- Accept a reviewer only when its `<out>/result.json` has `ok: true` (exit 0, non-empty `last.md`, observed model/sandbox = requested). Report = `<out>/last.md`. Record report hash, `observed` model/effort/sandbox and `evidence.rollout`; recheck source identity. `observed` null means the model is unverified. `evidence.spawnCalls` > 0 means the reviewer was not a leaf; disclose it. Exit 0 with missing required inspection is incomplete coverage.
- Failure by `reason`: `model_rejected` gets no automatic model fallback; ask the user (a newer pin goes into `models.json` only with the user's OK). Other reasons (`timeout`, `nonzero_exit`, `empty_report`, `*_mismatch`) get at most one retry with a new `--out`, and only with existing explicit authorization or user agreement, because each retry consumes usage. Second failure: stop and report both.
- Never change the provider, keys or paid credits yourself, and never print credentials.
