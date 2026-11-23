---
name: astra-fullreview
description: "Full multi-agent Codex review on newest Astra (codex-run role astra, medium). Same lifecycle as codex-fullreview. Use: /astra-fullreview, 'full Astra review with sub-reviewers'."
disable-model-invocation: true
---

# Astra full review

Read `.claude/skills/codex-fullreview/SKILL.md` and its `references/launch-prompts.md`, and follow the complete execution contract: runner `--preflight`, the required `.agents/skills/impartial-review/SKILL.md` check (when it is absent, stop and point to `astra-review`, not `codex-review`), exact scope, unique run directory, source manifest, the author brief (written to `$RUN/brief.md` and named in the prompt unless the user asks for a fully blind review), plain exec launch through the runner with the prompt in `$RUN/prompt.md` that reads `.agents/skills/impartial-review/SKILL.md` by file and acts as its Manager, background launch with `status.json` polling, `result.json` evidence, report identity, the sub-reviewer spawn count, finding verification, and honest attribution. Launch Codex only through `node .claude/scripts/codex-run/codex-run.mjs` from the repository root; never hand-build a `codex exec` line. This entrypoint changes only the defaults:

| Setting | Astra default |
|---|---|
| Runner role | `--role astra` (model and effort from `.claude/scripts/codex-run/models.json` `roles.astra`), for the Manager and every sub-reviewer |
| Effort | role default (`medium`), regardless of diff size; the prompt says `reasoning_effort medium` |
| Run directory | `RUN=$(mktemp -d "$PWD/.tmp/astra-fullreview-XXXXXXXX")`, runner `--out "$RUN/codex"` |

The commands are codex-fullreview's `references/launch-prompts.md` with three swaps:

- `MODEL=$(node -p "require('./.claude/scripts/codex-run/models.json').roles.astra.model")`
- `--role astra` in place of `--role sol`, and `--label astra-fullreview`
- prompt text `reasoning_effort medium` in place of `reasoning_effort high`

Skip the newest-Sol check in `codex-fullreview` Step 1; this entrypoint never swaps Astra for Sol. Check for a newer Astra instead: when `codex debug models` lists an Astra slug newer than `roles.astra.model`, run with `--model <newer id> --effort medium` and the same id in the prompt, and tell the user the pin is stale. Update `models.json` only with the user's OK. Honor an explicit user model/effort choice (`--model`, `--effort`, same values in the prompt). A model id in `models.json` is not proof of availability. `$ARGUMENTS` carries scope as in `codex-fullreview`.

Commit and uncommitted prompts, the root-commit base, the file-named skill invocation, the session-file checks for skill load and spawned children, the scope-line check, and attribution follow `codex-fullreview`. Zero spawned children is reported as "no sub-reviewers ran", never hidden.

Distinct prefixes do not prevent collisions between two Astra invocations; every run directory must still be new.

If Astra is unavailable, report that outcome. Do not silently inherit another model or attribute a fallback to Astra. `reason: model_rejected` is reported, never retried on another model. Any other failed `reason` gets the one automatic retry from `codex-fullreview` in a new run directory; changed source gets none. Attribute the result to the `result.json` `observed` model/effort, or explicitly mark model resolution unverified. Keep lifecycle fixes in `codex-fullreview` rather than forking them here.
