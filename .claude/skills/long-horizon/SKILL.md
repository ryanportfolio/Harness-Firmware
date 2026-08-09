---
description: Use for work too big for one context window: long multi-step tasks, progress lost to compaction or failed retries, work spanning hours or sessions, or when the user says /long-horizon or asks to run a task in verified rounds.
---

# long-horizon: run big tasks in audited rounds

Manager, Executor, Auditor. You (this context) are the Manager: hold the goal, keep the state
file true, and delegate every round. Executors and auditors are fresh subagents; a fresh context
per round is what keeps quality flat while the task grows.

## State file

`.tmp/long-horizon/<task-slug>/state.md` (gitignored scratch), created before round one:

```markdown
# Goal
<one paragraph + the check that proves it done>

# Verified progress
- <claim> — evidence: <file/command/output the auditor saw>

# Remaining
1. <step sized for one fresh context>

# Audit log
- round N: <step> — pass/fail, <one-line evidence>
```

Only audit-passed results enter **Verified progress**. If a state file already exists for this
task, resume from it; the workspace plus that file is the whole truth, whatever any earlier
session claimed.

## Round loop

1. **Plan** — read the state file, pick ONE remaining step, write a brief: goal excerpt, the
   step, its done-check, and only the verified facts that step needs.
2. **Execute** — spawn a fresh subagent with the brief alone. It does the step and reports what
   changed and how to check it.
3. **Audit** — spawn a second fresh subagent given only the done-check and workspace paths. It
   inspects the real environment (files, tests, logs) and returns pass/fail with evidence. The
   executor's report is a claim; the auditor's inspection is the evidence.
4. **Integrate** — pass: move the step into Verified progress with the auditor's evidence.
   Fail: Verified progress stays intact; append the audit findings and schedule rework with
   those findings in the next brief.

Update the state file every round. Three rounds without a state-file write means drift: stop
and rebuild the file from the real workspace.

## Completion

Answer from Verified progress alone. Unfinished is a valid report: state what is verified and
what remains.

## Guardrails

- Subagents inherit the session model or run Sonnet; the kernel's no-Haiku floor applies.
- Size each step so one fresh context finishes it: one slice, one migration, one bug.
- Audit independence is the point — pass/fail comes from the auditor's own inspection, and
  auditing runs in a fresh subagent, never in this Manager context.
- Executors and auditors follow fable-mode discipline inside their round; fable-mode governs
  one context, this skill governs work spanning many.
- Under ~3 dependent steps: skip the harness, run fable-mode directly.
