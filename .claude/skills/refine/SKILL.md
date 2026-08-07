---
description: Use when a session or major task is wrapping up ("wrap up", "that's everything", "done for today"), when the user invokes /refine, or right after any task where friction occurred: wasted tool calls rediscovering a fact, a skill that fired wrongly or never fired, or a correction from the user.
---

# refine: post-task harness pass

The harness (skills, reference, memory, kernel) is state you can edit. When a task ends, mine the trajectory for friction and apply the smallest evidence-backed edit that would have prevented it. Self-improvement means explicit, persisted, reversible edits, never vague intent.

## Step 1: Mine the trajectory

Re-read this session's actual events, not your summary of them. List every friction event under these classes:

| Class | Symptom in trajectory | Edit surface |
|---|---|---|
| Rediscovery | Tool calls burned re-learning a fact no file records | `.claude/reference/` via recall |
| Skill misfire | A skill fired and the user backed you out, or the right skill never fired | That skill's `description:` line |
| Correction | User corrected your process | CLAUDE.md kernel, only if no rule exists |
| Stale state | A reference or memory entry proved wrong during the task | Replace or delete the entry |

Completion bar: every user correction and every backed-out action in the trajectory is either listed as friction or explicitly ruled out with a reason.

## Step 2: Smallest edit per friction

- One friction → one smallest edit → one commit. The commit message quotes the trajectory evidence. The commit is the rollback snapshot.
- A skill that misfired is a description bug, not a one-off judgment error. Judgment executes descriptions; fix the trigger surface. **REQUIRED SUB-SKILL** for any skill edit: writing-skills; its test loop applies.
- Rediscoveries route through recall; its format and commit rules apply.
- A correction whose rule already exists → no edit. Attention failure is not a documentation gap; duplicating the rule weakens the kernel.
- Zero edits is a valid outcome. Say so and stop.

## Red flags

- "One-off judgment error" about a skill misfire → it is a description bug; fix it.
- Several frictions bundled into one commit → rollback granularity lost.
- New kernel rule for something area-specific → reference file instead.
- An edit without quoted evidence → not evidence-backed; don't make it.
