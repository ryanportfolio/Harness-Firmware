---
name: astra-review
description: "Cross-vendor review configured for gpt-6-astra at medium reasoning. Same verified CLI lifecycle as codex-review. Use for /astra-review or 'have Astra review this'."
---

# Astra review

Read `.claude/skills/codex-review/SKILL.md` and follow its complete execution contract: current local preflight, exact scope, unique run directory, source manifest, process completion, report identity, finding verification, and honest attribution. This entrypoint changes only the defaults:

| Setting | Astra default |
|---|---|
| Model | `gpt-6-astra` |
| Effort | `medium`, regardless of diff size |
| Run directory prefix | `.tmp/astra-review-` |

Skip the newest-Sol check in `codex-review` Step 1; this entrypoint never swaps Astra for Sol. Honor an explicit user model/effort choice. Confirm supported local options before inference; a model identifier in this file is not proof of availability. `$ARGUMENTS` carries scope as in `codex-review`.

Example after creating a fresh `$RUN` directory (POSIX shell):

```bash
mkdir -p .tmp
RUN=$(mktemp -d .tmp/astra-review-XXXXXXXX)
codex exec review --base origin/main -m gpt-6-astra -c model_reasoning_effort=medium -o "$RUN/report.md" < /dev/null > "$RUN/run.log" 2>&1
```

On PowerShell use a GUID-named directory and supported stdin/output redirection as described in `codex-review`. Distinct prefixes do not prevent collisions between two Astra invocations; every run must still be unique.

If Astra is unavailable, report that outcome. Do not silently inherit another model or attribute a fallback to Astra. Any authorized retry uses a new directory and reports its observed model/effort, or explicitly marks model resolution unverified. Keep lifecycle fixes in `codex-review` rather than forking them here.
