---
description: "Cross-vendor second-opinion review. Drives OpenAI Codex CLI (codex exec review, gpt-6-sol, high reasoning) over a PR, branch, commit, or uncommitted diff, then verifies each finding. Trigger: /codex-review, \"have Codex/Sol review this\"."
---

# Codex review — cross-vendor second opinion

Run one fresh Codex CLI review and verify every finding locally. From Claude this supplies cross-vendor review; from Codex it supplies fresh context, not vendor independence. Keep the model-specific entrypoints separate: this defaults to Sol/high, and `astra-review` supplies Astra/medium. Honor explicit user model and effort choices rather than silently replacing them.

The requested review does not authorize fixes, publication, machine configuration changes, or paid credit purchases.

## Step 1: Preflight

Inspect `codex --version`, `codex login status`, and `codex exec review --help` locally before inference. Verify current support for the selector, model/effort configuration, and output options used below; examples are not product guarantees. Do not probe models by spending usage.

**Model: always the newest Sol, named by its exact id.** `-m` takes a literal model id; there is no "latest Sol" alias, so the command pins one. The pin is `gpt-6-sol`. Before launch, check the `model` in `~/.codex/config.toml` and the Sol entries at developers.openai.com/api/docs/models. If a newer Sol exists, run with its exact id and tell the user the pin is stale. Do not edit the pins during the review: bumping them in this skill and in the Codex example in `impartial-review` is a separate change the user authorizes. An explicit user model choice still wins. `astra-review` is exempt: it stays on Astra.

Require the intended ChatGPT/subscription authentication route. If logged out, ask the user to log in through their own terminal. If authentication or billing is ambiguous, stop before inference; never print credentials or switch to an API key or paid credits. A user-authorized alternative route must be explicit.

## Step 2: Identify scope

Use `$ARGUMENTS` if the user named a scope; otherwise infer from recent work. Map to the matching `codex exec review` selector:

| Scope | Selector |
|---|---|
| Uncommitted work (staged + unstaged + untracked) | `--uncommitted` |
| Branch / PR diff | `--base origin/<default-branch>` |
| Single commit | `--commit <SHA>` |

For `--base`, fetch first (`git fetch origin <default-branch>`) and pass the **remote-tracking ref** (`origin/main`, not `main`) — fetch updates only the remote-tracking ref, so a local branch name can silently compare against a stale base. State the scope in your first sentence so the user can redirect.

## Step 3: Launch the review

Run from the repository root. Create a new run directory atomically; never reuse one from an earlier invocation. For example in a POSIX shell:

```bash
mkdir -p .tmp
RUN=$(mktemp -d .tmp/codex-review-XXXXXXXX)
codex exec review --base origin/main -m gpt-6-sol -c model_reasoning_effort=high -o "$RUN/report.md" < /dev/null > "$RUN/run.log" 2>&1
```

Launch it as a background or detached process and poll its log and exit status; a foreground tool call is killed at the harness ceiling (10 minutes for the Claude Code Bash tool) and takes the review with it, while a background call is not (verified 2026-09-19 with a 20 s job under a 3 s cap). Adapt shell quoting and stdin closure to the active runtime. On PowerShell, create a GUID-named directory and use supported process redirection or `cmd /c` for `< NUL`; PowerShell does not support `<` redirection. Keep report/log paths inside that unique directory. Redirect complete output to a file, never through `head` or `tail`.

Before launch, write run metadata: run ID, absolute workspace, requested scope, resolved base/head SHAs, staged/unstaged diff identities and relevant untracked path/content hashes, CLI version, command, requested model/effort, and start time. Exclude task-owned report artifacts from the requested review. For uncommitted work, inventory all relevant content; a HEAD SHA alone does not identify it. Use an isolated snapshot if concurrent writers cannot stop. Do not silently expand scope to unrelated changes.

Use the installed CLI's supported selector/prompt combination. If selector plus custom prompt is unsupported, use its built-in rubric for ordinary review; for a special requested focus, use a supported prompt-only invocation with the exact source scope. Describe which rubric was actually supplied. Preserve least privilege; do not bypass approvals or sandbox protections for a reviewer.

Default effort is `high`; for a broad diff, `medium` is a planning option only when the user did not explicitly select effort. Astra retains its own medium default. State the selected setting before launch; runtime duration is not predictable from file count alone.

Monitor the task-owned process and logs with bounded waits. Log silence alone does not prove a stall. Record observed process status, elapsed time, and the agreed timeout; if stalled or timed out, terminate only this review process, preserve its partial output, and report the failed attempt. Do not start another usage-consuming run without existing explicit retry authorization or user agreement.

## Step 4: Collect and bind evidence

Accept a report only after this process exits successfully, the report is non-empty in this run's newly created directory, and the source manifest still matches the reviewed state. Record exit code, end time, report hash, and the model/effort actually reported by the process. If it does not reveal model resolution, label the model as requested but unverified; never infer a resolved model from the entrypoint title.

Nonzero exit, missing/empty report, or changed source means the review is failed or stale, not clean. Surface the relevant error with secrets redacted. A successful process that could not inspect code or run required checks has an incomplete review: retain useful findings but disclose missing coverage. Sandbox or network failures do not by themselves establish a code defect or a passing gate.

One invocation per request unless retries are already explicitly authorized. Model rejection is a failure, not permission to silently drop `-m`/`-c`. Offer a locally supported alternative, preserve an explicit model choice until the user changes it, and use a new run directory for an authorized retry. Attribute any fallback to the model actually observed, or state that resolution remains unverified.

## Step 5: Verify every finding (precision stage)

Cross-vendor does not mean correct — Codex hallucinates too, and it reviewed without this session's context. Before surfacing, run a real check (`grep` call sites, read the cited lines) on **every** finding, all severities. Each one gets:

- **Confirmed** — evidence found, pass it through
- **Refuted** — checked and not real, drop it (optionally note under "checked and fine")
- **Kept with caveat** — one-line note on the residual uncertainty

Drop only on evidence, never because a finding "seems minor". Treat BLOCKING findings adversarially — try to refute each before accepting.

## Step 6: Present

Use the `impartial-review` presentation format: findings severity-ordered globally (🔴 BLOCKING, 🟡 SHOULD-FIX, 🟢 NITPICK), each with `path:line`, concrete description, and a specific fix. Map Codex's native labels onto that scheme during verification (e.g. P1/critical → 🔴, P2/major → 🟡, P3/minor → 🟢), re-ranking where your verification disagrees; then "Things I checked and verified fine" (merge Codex's list with your verification results); then a "Recommendation" that is concrete about merge readiness. Attribute the source using recorded run metadata: "Codex (<observed model and effort, or requested setting with resolution unverified>) reviewed <scope at source identity>; N of M findings survived verification." Include material unavailable checks and the run evidence path.

Zero findings plus verified coverage and local checks supports a clean review of that scope. State merge readiness only when the relevant project gates and exact source identity also support it; the review itself does not authorize merging.

## Common mistakes

- A stale report from a previous attempt is not this process's result; unique directories plus process/source identity are required.
- Authentication, model aliases, flags, sandbox behavior, and billing may change; inspect local evidence instead of applying a historical machine repair automatically.
- A fresh same-vendor reviewer is independent context, not a cross-vendor opinion.
- Do not pass findings through unchecked, treat review agreement as proof, or hide missing evidence behind exit code 0.
- Do not widen scope, retry, downgrade a requested model, repair machine-global configuration, or publish under review-only authorization.
