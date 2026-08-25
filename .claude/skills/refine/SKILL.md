---
description: "Use when a session or task is wrapping up (\"wrap up\", \"that's everything\", \"done for today\"), when the user invokes /refine, or after any task with friction: calls wasted rediscovering a fact, a skill that misfired, a user correction."
---

# refine: post-task harness pass

The harness (skills, reference, memory, kernel) is state you can edit. When a task ends, mine the trajectory for friction and apply the smallest evidence-backed edit that would have prevented it. Self-improvement means explicit, persisted, reversible edits, never vague intent.

## Step 1: Mine the trajectory

Re-read this session's actual events, not your summary of them. List every friction event under these classes:

| Class | Symptom in trajectory | Edit surface |
|---|---|---|
| Rediscovery | Tool calls burned re-learning a fact no file records | The repo's durable notes: `.claude/reference/` via recall where both exist, else the always-loaded instruction file |
| Skill misfire | A skill fired and the user backed you out, or the right skill never fired | That skill's `description:` line |
| Correction | User corrected your process | The always-loaded instruction file (CLAUDE.md, AGENTS.md, equivalent), only if no rule exists |
| Stale state | A reference or memory entry proved wrong during the task | Replace or delete the entry |

Mine through three lenses, in order, so one reading style doesn't hide a friction class: judgment (wrong calls, missed checks, corrections), tooling (calls wasted on work a script, permission, or recorded fact would have skipped), divergent (what would a session that took a different approach have avoided; which friction repeats across sessions, not just here).

For the tooling lens, where `.claude/scripts/memory-audit.mjs` exists, run it: it counts writes against reads for every reference file, memory file, and skill from this machine's session transcripts. Never-read files, dated entries older than six months, and never-invoked skills are pruning candidates to weigh, not automatic deletions; counts are floor estimates and per-machine.

Read the surface before editing it. This skill installs globally, so the repo in front of you may have none of the files named above.

Completion bar: every user correction and every backed-out action in the trajectory is either listed as friction or explicitly ruled out with a reason.

## Step 2: Smallest edit per friction

- One friction → one smallest edit → one commit. The commit message quotes the trajectory evidence. The commit is the rollback snapshot. Stage only the harness files that edit touched; the task's own in-flight work never rides along.
- If a code or config change would remove the friction outright, propose that instead of documenting the workaround. A note telling the next session to pass a flag is worse than the flag being unnecessary.
- Structural enforcement check, before any prose edit lands: a rule a lint, hook, script, or permission entry can enforce beats prose stating it. Prefer the structural encoding; if it's too big for this pass, note it as the follow-up instead of writing the prose rule.
- A skill that misfired is a description bug, not a one-off judgment error. Judgment executes descriptions; fix the trigger surface. Where writing-skills exists it governs the edit and its test loop applies. Without it, still verify: hand a fresh subagent the descriptions plus the scenario that misfired, confirm it now routes correctly, and confirm a neighbouring scenario does not over-fire.
- Where recall exists, rediscoveries route through it and its format and commit rules apply.
- A correction whose rule already exists → no edit. Attention failure is not a documentation gap; duplicating the rule weakens the kernel.
- Edits landing outside a git repo (global skills, memory files) have no commit standing behind them. Name what you changed and where, so it can be reversed by hand.
- Zero edits is a valid outcome. Say so and stop.

## Red flags

- "One-off judgment error" about a skill misfire → it is a description bug; fix it.
- Several frictions bundled into one commit → rollback granularity lost.
- New kernel rule for something area-specific → reference file instead. Repo has no reference file → create one or accept the kernel line, but do not stall.
- An edit without quoted evidence → not evidence-backed; don't make it.
