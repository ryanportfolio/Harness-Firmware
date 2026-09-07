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

# Current round  (written at Plan, before the executor starts; frozen until Integrate)
Step: <the one Remaining step this round works>
Done-check: <commands the auditor runs itself; their output is the evidence>
Write scope: <paths the executor may change; any change outside them is an integrity violation>
Baseline: <workspace snapshot taken at Plan; the auditor diffs against this, not against HEAD>

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
give the auditor only the acceptance checks, the Current round block and the workspace root.
The auditor never receives the executor's turns or report.

The leak that matters is not the executor's file list, which the auditor recovers from the
workspace anyway; it is the executor's narrative ("works, checked X, Y was out of scope"),
which the Manager has read by the time it writes the auditor brief and can paraphrase without
noticing. So the auditor brief is composed only from artifacts that existed before the executor
started: the frozen Contract, the Current round block as written at Plan, and the executor's
own input brief. Nothing the Manager learned during Execute goes in. Provenance is checkable;
"do not paraphrase" is not.

Never spawn a round with `subagent_type: fork` or any option that inherits the Manager
context. If a runtime cannot start without inherited context, inherit the smallest recent
slice that supplies otherwise unrecoverable data and record why in the audit log.

## Round loop

1. **Plan** — read the state file, pick ONE remaining step, and write the Current round block
   (step, done-check, write scope, baseline) into the state file before anything is spawned.
   The baseline is what the workspace looked like before this executor ran: in a git
   workspace, the SHA from `git stash create` (a snapshot commit that touches neither the
   tree nor the index; empty output means the tree is clean, so record HEAD) plus the
   `git status --porcelain --untracked-files=all` listing; elsewhere, a file list with sizes
   and mtimes. Rounds do not commit between themselves, so HEAD is the wrong reference:
   it would attribute every earlier round's verified edits, and any pre-existing user
   changes, to this executor. Then write
   the executor brief: contract excerpt, the Current round block, only the verified facts that
   step needs, and every dead end that touches this step. The done-check is frozen from this
   point; a done-check that turns out wrong is fixed in the next round's Plan, never after
   reading the executor's report.
2. **Execute** — spawn a fresh subagent with the brief alone and no Manager conversation
   history. It does the step and reports what changed and how to check it.
3. **Audit** — spawn a second fresh subagent given only the contract's acceptance checks, the
   Current round block as written at Plan, and the workspace root. It runs the done-check
   itself and returns three verdicts with evidence:
   - status: complete / incomplete / blocked, from the auditor's own run of the done-check.
     A log or test output the auditor did not produce this round is a claim, not evidence.
   - integrity: clean / suspect / violation — clean only when its own inspection explicitly
     supports it: artifacts exist, and the diff between the Baseline and the workspace now
     (`git diff <baseline-sha> --stat` plus new entries in the untracked listing, or the
     file-list comparison outside git) touches nothing outside Write scope. Compare against
     the Baseline, never against HEAD or a bare `git status`; unclear evidence = suspect
   - contract: aligned / drifted — justified against the frozen acceptance checks
   The executor's report is a claim; the auditor's inspection is the evidence. Only
   complete + clean + aligned enters Verified progress.
4. **Integrate** — pass: move the step into Verified progress with the auditor's evidence.
   Fail: Verified progress stays intact; append the audit findings, add the approach that
   failed to Dead ends, and schedule rework with those findings in the next brief. Either
   way, clear the Current round block; a stale one would feed the next auditor the wrong
   done-check.

Update the state file every round. Three rounds without a state-file write means drift: stop
and rebuild the file from the real workspace.

The Manager compacts too. After any context compaction or session restart, the first act is
to re-read the state file and treat it as the whole truth: a step you remember planning but
that is not in the file did not happen, and a step in Verified progress you do not remember
did. Never reconstruct progress from memory of the conversation.

## Stagnation

A round cap stops a stalled run; it does not unstick one. Rounds can fail the same way
repeatedly while the cap is still far off, so watch for it directly:

- Same step fails audit twice in a row → the next brief must change approach, not retry the
  old one. Move the failed approach to Dead ends first.
- Three rounds with nothing new entering Verified progress → stop spawning and rewrite
  Remaining. The decomposition itself is the suspect, not the executor. A rewritten
  Remaining re-derives the round cap from its new count, once; rounds already spent still
  count against it.

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
- Cap rounds at 2× the Remaining count (floor 5), taken when Remaining is first written and
  again if Stagnation rewrites it. Cap hit → stop and report Verified vs Remaining honestly.
- Auditor blocked or a step needs a decision only the user owns → stop and ask; a guessed
  answer poisons every later round's verified state.
