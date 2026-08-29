---
description: 'Use for work too big for one context window: long multi-step tasks, progress lost to compaction or failed retries, work spanning hours or sessions, or when the user says /long-horizon or asks to run a task in verified rounds.'
---

# long-horizon: run big tasks in audited rounds

Manager, Executor, Auditor. You (this context) are the Manager: hold the goal, keep the state
file true, and delegate every round. Executors and auditors are fresh subagents; a fresh context
per round is what keeps quality flat while the task grows.

## State file

`.tmp/long-horizon/<task-slug>/state.md` (gitignored scratch), created before round one:

```markdown
# Contract  (written before round one, never edited after)
Goal: <one paragraph>
Acceptance: <the checks that prove it done, as a list>

# Verified progress
- <claim> — evidence: <file/command/output the auditor saw>

# Remaining
1. <step sized for one fresh context>

# Dead ends  (approaches that failed audit; do not retry without new evidence)
- <approach>: <why it failed, one line>

# Audit log
- round N: <step> — <status>/<integrity>/<contract>, <one-line evidence>
```

Only audit-passed results enter **Verified progress**. An existing state file for this task
wins: resume from it; that file plus the workspace is the whole truth.

Dead ends are memory too. A failed approach that never gets written down gets re-proposed a
few rounds later, and re-walking it costs a full round.

## Context boundary

Fresh means the round receives no Manager conversation history. The state file, workspace and
a standalone brief carry every fact the round needs. Give the executor only its bounded brief;
give the auditor only the acceptance checks, done-check and workspace paths. The auditor never
receives the executor's turns or report. If a runtime cannot start without inherited context,
inherit the smallest recent slice that supplies otherwise unrecoverable data and record why in
the audit log.

## Round loop

1. **Plan** — read the state file, pick ONE remaining step, write a brief: contract excerpt,
   the step, its done-check, only the verified facts that step needs, and every dead end that
   touches this step.
2. **Execute** — spawn a fresh subagent with the brief alone and no Manager conversation
   history. It does the step and reports what changed and how to check it.
3. **Audit** — spawn a second fresh subagent given only the contract's acceptance checks, the
   step's done-check, and workspace paths. It inspects the real environment (files, tests,
   logs) and returns three verdicts with evidence:
   - status: complete / incomplete / blocked
   - integrity: clean / suspect / violation — clean only when its own inspection explicitly
     supports it (artifacts exist, edits stayed in the step's scope); unclear evidence = suspect
   - contract: aligned / drifted — justified against the frozen acceptance checks
   The executor's report is a claim; the auditor's inspection is the evidence. Only
   complete + clean + aligned enters Verified progress.
4. **Integrate** — pass: move the step into Verified progress with the auditor's evidence.
   Fail: Verified progress stays intact; append the audit findings, add the approach that
   failed to Dead ends, and schedule rework with those findings in the next brief.

Update the state file every round. Three rounds without a state-file write means drift: stop
and rebuild the file from the real workspace.

## Stagnation

A round cap stops a stalled run; it does not unstick one. Rounds can fail the same way
repeatedly while the cap is still far off, so watch for it directly:

- Same step fails audit twice in a row → the next brief must change approach, not retry the
  old one. Move the failed approach to Dead ends first.
- Three rounds with nothing new entering Verified progress → stop spawning and rewrite
  Remaining. The decomposition itself is the suspect, not the executor.

Either trigger optionally escalates to a cross-vendor supervisor. Manager, executor, and
auditor are all Claude, so they share blindspots, and a shared blindspot is exactly what a
plateau looks like from the inside. Codex is a different model family that never saw this
session:

```bash
codex login status
```

Logged in → one `codex exec` run (custom prompt, no scope selector) carrying the contract, the
audit log, and Dead ends, asking for a plateau diagnosis and a different strategy. See the
`codex-review` skill for the CLI mechanics and its Windows sandbox-helper caveat. Its answer is
an opinion: check the proposal against the frozen acceptance checks before it rewrites
Remaining, and drop anything that drifts. Not logged in or the run fails → skip it, the rewrite
rules above stand on their own.

One consult per trigger. Each run bills the user's Codex subscription, which is why this hangs
off a stagnation trigger instead of running every round.

## Completion

Answer from Verified progress alone. Unfinished is a valid report: state what is verified and
what remains.

## Guardrails

- Subagents run Opus or Sol or above, never Sonnet, Haiku, or Luna; inheriting the session
  model is fine when it already meets that floor.
- Size each step so one fresh context finishes it: one slice, one migration, one bug.
- Audit independence is the point — verdicts come from the auditor's own inspection in a
  fresh subagent, never from this Manager context.
- Executors and auditors follow fable-mode discipline inside their round; fable-mode governs
  one context, this skill governs work spanning many.
- Under ~3 dependent steps: skip the harness, run fable-mode directly.
- Cap rounds at 2× the initial Remaining count (floor 5). Cap hit → stop and report Verified
  vs Remaining honestly.
- Auditor blocked or a step needs a decision only the user owns → stop and ask; a guessed
  answer poisons every later round's verified state.
