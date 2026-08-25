---
description: "Cross-vendor second-opinion review. Drives OpenAI Codex CLI (codex exec review, gpt-5.6-sol, high reasoning) over a PR, branch, commit, or uncommitted diff, then verifies each finding. Trigger: /codex-review, \"have Codex/Sol review this\"."
---

# Codex review — cross-vendor second opinion

Codex CLI runs on the user's ChatGPT/Codex subscription and ships a purpose-built non-interactive review mode: `codex exec review`. This skill drives it as an independent reviewer — a different model family that did not write the code and shares none of this session's context — then applies the same precision stage as `impartial-review`: every finding gets verified here before it reaches the human. No API key; billing rides the user's subscription.

Complementary to `impartial-review` (fresh-context Claude subagents): use that for bucketed multi-agent coverage, this for a cross-vendor opinion. They compose — run both on high-stakes diffs.

## Step 1: Preflight

```bash
codex --version && codex login status
```

Expect `Logged in using ChatGPT`. Not logged in → STOP and ask the user to run `codex login` (browser OAuth) in their own terminal. Never handle credentials yourself.

## Step 2: Identify scope

Use `$ARGUMENTS` if the user named a scope; otherwise infer from recent work. Map to the matching `codex exec review` selector:

| Scope | Selector |
|---|---|
| Uncommitted work (staged + unstaged + untracked) | `--uncommitted` |
| Branch / PR diff | `--base origin/<default-branch>` |
| Single commit | `--commit <SHA>` |

For `--base`, fetch first (`git fetch origin <default-branch>`) and pass the **remote-tracking ref** (`origin/main`, not `main`) — fetch updates only the remote-tracking ref, so a local branch name can silently compare against a stale base. State the scope in your first sentence so the user can redirect.

## Step 3: Launch the review

Run from the repo root. `-o` makes the CLI itself write the agent's final report to a file (written by the CLI, not the sandboxed agent). The `review` subcommand exposes no `-s` flag — it runs under Codex's default sandbox. Never pass `--dangerously-bypass-approvals-and-sandbox` or similar: a reviewer needs no extra access.

```bash
mkdir -p .tmp
codex exec review --base origin/main -m gpt-5.6-sol -c model_reasoning_effort=high -o .tmp/codex-review.md > .tmp/codex-run.log 2>&1
```

Redirect stdout to a file, never pipe it through `head`/`tail`. A pipe buffers, so a backgrounded run leaves its captured output empty and there is no way to tell a working review from a dead one. `.tmp/codex-run.log` is the progress signal; `.tmp/codex-review.md` is the result.

Effort by diff size: `high` for a small diff, `medium` above roughly ten files or eight hundred changed lines. High reasoning on a large diff runs 40 minutes or more before it produces anything, which is also the window a dropped stream hides in.

The scope selectors (`--uncommitted`, `--base`, `--commit`) are **mutually exclusive with a custom `[PROMPT]`** — the CLI rejects the combination. Prefer the selector and Codex's built-in review rubric: deterministic scope beats a custom output format, and Step 5/6 normalize the report anyway. With a selector, the rubric *is* the prompt: say so if the user expects to see prompt text, rather than leaving it looking like a step was skipped. Pass custom instructions (as the `[PROMPT]` argument, no selector flag) only when the user asks for a focus the rubric won't cover, and then state the exact diff scope inside the prompt.

Launch it in the background if the runtime supports that. Process exit is the completion signal, but it is not the only one worth watching: poll `.tmp/codex-run.log` for growth. A log that has not grown for about ten minutes while the process is alive and no `-o` file exists is a stalled stream, not a long think. Kill it and report the stall rather than waiting it out; two 40-minute stalls cost more of the user's day than one honest "it hung".

Codex reruns the repo's gates inside its own sandbox, which is `workspace-write` over the workdir and temp only. Anything that writes outside the workspace fails there, `npm`/`npx` first: their cache lives under `%LOCALAPPDATA%` or `~/.npm`, so an `npx --yes <tool>` fetch cannot work and its gate comes back as a permission error rather than a result. State the gate results you already have in your handover to the user, and treat a sandboxed gate failure as an artefact of the sandbox until proven otherwise. The durable fix belongs in the repo: a tool the tests need is a devDependency and a script, not an `npx --yes` fetch.

While it runs you may pre-gather verification targets (diff stat, changed files).

## Step 4: Collect

On exit: exit code 0 and `.tmp/codex-review.md` exists non-empty → read it. Nonzero exit or missing/empty file → surface the command's stderr verbatim and stop. Do not fabricate a review, and do not silently rerun (each run burns real subscription tokens — rerun only with the user's OK).

## Step 5: Verify every finding (precision stage)

Cross-vendor does not mean correct — Codex hallucinates too, and it reviewed without this session's context. Before surfacing, run a real check (`grep` call sites, read the cited lines) on **every** finding, all severities. Each one gets:

- **Confirmed** — evidence found, pass it through
- **Refuted** — checked and not real, drop it (optionally note under "checked and fine")
- **Kept with caveat** — one-line note on the residual uncertainty

Drop only on evidence, never because a finding "seems minor". Treat BLOCKING findings adversarially — try to refute each before accepting.

## Step 6: Present

Use the `impartial-review` presentation format: findings severity-ordered globally (🔴 BLOCKING, 🟡 SHOULD-FIX, 🟢 NITPICK), each with `path:line`, concrete description, and a specific fix. Map Codex's native labels onto that scheme during verification (e.g. P1/critical → 🔴, P2/major → 🟡, P3/minor → 🟢), re-ranking where your verification disagrees; then "Things I checked and verified fine" (merge Codex's list with your verification results); then a "Recommendation" that is concrete about merge readiness. Attribute the source: "Codex (gpt-5.6-sol, high reasoning) reviewed <scope>; N of M findings survived verification."

Zero findings from Codex + your spot-check of the highest-risk hunks agrees → say that plainly and recommend merge.

## Common mistakes

| Symptom | Cause → fix |
|---|---|
| `cannot be used with '[PROMPT]'` | scope selector combined with custom instructions → drop one; default to the selector |
| no `.tmp/codex-review.md` after exit 0 | wrong `-o` path or ran from wrong directory → run from repo root, check the path you passed |
| model rejected / unknown | `gpt-5.6-sol` renamed in a newer CLI → drop `-m`/`-c` to inherit the user's `~/.codex/config.toml` defaults, tell the user |
| review of stale diff | `--base` given a local branch name → fetch, then pass `origin/<default-branch>` |
| `windows sandbox: orchestrator_helper_launch_failed` errors in output | standalone Codex CLI release is missing its sandbox helper exes → review still completes but diff-only (no exploration commands); fix by copying `codex-windows-sandbox-setup.exe` and `codex-command-runner.exe` from the Codex desktop app's bin dir into the active `releases/<version>/bin/` dir |
| every exec exits -1 in 0ms with `windows sandbox: helper_unknown_error: apply deny-read ACLs`; review "completes" with an empty low-confidence report | `~/.codex/.sandbox/deny_read_acl_state.json` corrupted to NUL bytes by a torn write (crash/power loss; upstream openai/codex#28248, unresolved) → confirm `parse deny-read ACL state` lines in `~/.codex/.sandbox/sandbox.<date>.log`, rename the state file to `.corrupt-backup`, rerun; the helper regenerates it. Machine-global: breaks every Codex sandboxed exec in every repo until repaired |
| run never returns; log frozen, process alive, CPU flat | dropped stream at high reasoning on a large diff; the CLI does not retry → kill it, report the stall, rerun only with the user's OK and at `medium` effort |
| backgrounded run shows no output at all | launched through a `head`/`tail` pipe, which buffers → redirect to `.tmp/codex-run.log` instead |
| `npm error ... permissions ... npm-cache` in Codex's gate runs | its sandbox is workspace-write only and npm's cache is outside the workspace → not a code defect; report your own gate results, and move the tool from `npx --yes` into a devDependency plus a script |
| surprise subscription burn | rerunning or widening scope without asking → one run per request, confirm before rerun |

## Anti-patterns

- Don't pass Codex findings through unverified — Step 5 is the point of running this from Claude at all.
- Don't loosen the sandbox (`-s workspace-write`, bypass flags). The `-o` file needs no write access.
- Don't rerun on failure without surfacing the error and getting an OK — each run costs real subscription tokens.
- Don't present Codex's opinion as ground truth or as your own; attribute it and mark what you confirmed vs. refuted.
- Don't substitute this for `impartial-review` when the user asked for that skill, or vice versa — different independence models (cross-vendor vs. fresh-context multi-agent).
- Don't paste the diff into the prompt — Codex reads the repo itself; the selector flags define the diff.
