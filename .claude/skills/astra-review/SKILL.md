---
description: "Cross-vendor review pinned to gpt-6-astra at medium reasoning. Same codex exec review workflow as codex-review (PR, branch, commit, or uncommitted diff; every finding verified). Trigger: /astra-review, \"have Astra review this\"."
---

# Astra review — codex-review on gpt-6-astra, medium reasoning

Same skill as `codex-review`, different model pin. Read `.claude/skills/codex-review/SKILL.md` and follow it end to end (preflight, scope, launch, collect, verify, present, common mistakes, anti-patterns), with these substitutions and nothing else changed:

| In `codex-review` | Here |
|---|---|
| `-m gpt-5.6-sol` | `-m gpt-6-astra` |
| `-c model_reasoning_effort=high` | `-c model_reasoning_effort=medium` |
| "Effort by diff size" paragraph (high for small diffs, medium for large) | Skip. Effort is `medium` regardless of diff size. |
| Attribution `Codex (gpt-5.6-sol, high reasoning) reviewed <scope>` | `Codex (gpt-6-astra, medium reasoning) reviewed <scope>` |
| Common-mistakes row "model rejected / unknown: `gpt-5.6-sol` renamed" | Same fix, for `gpt-6-astra`: drop `-m`/`-c` to inherit `~/.codex/config.toml`, tell the user |

Launch command after substitution (branch scope shown; `--uncommitted` and `--commit <SHA>` map exactly as in `codex-review`):

```bash
mkdir -p .tmp
codex exec review --base origin/main -m gpt-6-astra -c model_reasoning_effort=medium -o .tmp/astra-review.md > .tmp/astra-run.log 2>&1
```

Use the `astra-` file names so a leftover `codex-review.md` from an earlier `codex-review` run cannot be read back as this run's report.

`$ARGUMENTS` carries the scope the same way it does for `codex-review`.

## Anti-patterns

- Don't raise effort to `high` because the diff is small; the model pin is the point of this skill. The user picks `codex-review` when they want Sol at high.
- Don't fork the workflow here. Behavior changes belong in `codex-review`; this file only carries the model and effort overrides.
- Everything under `codex-review`'s anti-patterns applies unchanged.
