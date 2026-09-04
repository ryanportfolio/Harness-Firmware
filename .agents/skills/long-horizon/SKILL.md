---
name: long-horizon
description: "Use when work spans context windows or sessions, progress is lost after compaction or retries, or the user invokes $long-horizon or asks to work in verified rounds."
---

# Long-horizon for Codex

Run substantial work in bounded rounds with fresh executors and independent auditors.
Manager owns the goal, decisions, and durable state. Maintain this standalone Codex skill
directly. Discussing or editing the skill does not activate it. For a small task that fits
one context, use ordinary execution and verification.

## Start and resume

Inspect currently exposed agent tools. This workflow requires fresh independent agents;
self-review cannot replace an auditor. If unavailable, report the capability gap and
continue useful work that does not depend on an independent verdict.

Create `.tmp/long-horizon/<task-slug>/state.md` before execution. Manager alone updates it.
Store bulky output and per-round briefs alongside it, outside the active summary.

| Field | Required content |
|---|---|
| Contract | Goal, authorized scope, constraints, numbered final acceptance checks |
| Amendments | Version, explicit user instruction, changed checks, affected steps |
| Workspace | Absolute root, branch/revision if Git, existing edits, baseline artifact paths |
| Round | Step ID, phase, agent/process IDs, allowed edits, local checks, dependencies |
| Verified progress | Claim, contract version, inspected revision or file fingerprints, evidence path |
| Remaining | Bounded steps, dependencies, pending final checks, invalidated claims |
| Dead ends | Failed approach, observed cause, evidence needed before retrying |
| Audit log | Round verdicts, evidence, decisions, blockers, recovery actions |

Phases: `planned`, `executing`, `awaiting-audit`, `accepted`, `needs-rework`, `blocked`.
Write state before dispatch, after execution, and after audit. Save before yielding or
ending a turn; never depend on noticing compaction in time.

On resume, reconcile state with the actual workspace and latest user instructions.
Check root, revision, dirty files, artifacts, and recorded workers/processes. HEAD alone
does not identify uncommitted content. Keep old evidence as history; mark affected claims
stale and recheck before dependent work. Recover partial edits instead of blindly repeating
execution. Confirm old writers have finished or stopped before replacing them. Missing
process IDs after restart do not prove execution completed.

Preserve the original contract. Explicit user changes become amendments; reassess affected
steps and evidence against the new version. Manager must not weaken acceptance to make
work pass. Carry existing authorization forward within its scope; ask only for missing
user-owned decisions or authority. Skill invocation does not itself authorize Git
publication, deployments, migrations, installation, or external messages.

## Each round

1. **Plan one step.** Define allowed paths/actions, dependencies, local done-checks, and
   relevant task constraints. Capture a pre-round baseline, including dirty and untracked
   files, sufficient to distinguish this round's changes from existing work.
2. **Execute.** Spawn a fresh agent with `fork_turns: "none"` when that parameter is exposed.
   Supply a standalone brief: step, scope, checks, necessary verified facts, relevant dead
   ends, absolute workspace/artifact paths, current permissions and style instructions.
   Keep the brief sufficient without Manager conversation history. Use the exposed runtime's
   equivalent if names differ. If only inherited context is possible, record the limitation;
   do not claim a fresh independent audit. Inherit the session model unless explicitly directed
   otherwise. Executor implements and verifies only its step, then returns changed paths,
   commands/results, and blockers. It cannot edit Manager state or dispatch more agents.
3. **Audit after execution stops.** Spawn a separate fresh agent. Give it the contract and
   amendments, authorized step scope, local checks, baseline, and workspace paths. Exclude
   executor reports, turns, and verdicts. Auditor inspects actual changes and runs relevant
   checks itself. It does not fix implementation or write Manager state. Keep other writers
   off the audited files until the verdict is integrated.
4. **Integrate.** Accept only `complete + clean + aligned` backed by evidence. Otherwise
   record findings, schedule repair, and invalidate prior claims affected by failed changes.
   Preserve unrelated verified claims. Persist state before the next round.

Use native subagents for rounds; creating sidebar tasks is not a substitute. Wait for
results with exposed wait tools and bounded waits. Inspect live status before retrying
dispatch. Respect available concurrency; release completed agents when supported. Manager
may inspect evidence and organize work while waiting, without editing the executor's scope.

## Audit contract

Auditor returns:

- `status`: complete / incomplete / blocked.
- `integrity`: clean / suspect / violation. Clean requires observed artifacts and changes
  within scope, established against the baseline; missing evidence means suspect.
- `contract`: aligned / drifted, justified against the current contract version.
- Each applicable check: passed / failed / unavailable, command or inspection, actual
  result, and evidence location. Record the inspected revision and dirty-file fingerprints.

Step acceptance requires every required **local** check to pass and task constraints to
remain satisfied. Future final checks stay pending; they do not block a prerequisite step.
For example, verified database work can precede an unbuilt UI when the database's checks
pass. It cannot establish that the completed user flow works.

Failed or unavailable checks required for the current step block its acceptance and
dependent work, regardless of confident labels or time spent. Identify the missing check
or authority, complete independent authorized work, and obtain necessary user input.
Never convert an unavailable required check into a pass.

Before declaring the task complete, run a fresh final audit of the integrated workspace
against **all current final acceptance checks**, including affected earlier guarantees.
Any failed or unavailable required final check leaves the task unfinished. Bind that verdict
to the inspected workspace; later relevant edits require revalidation.

## Stagnation and stopping

- Same step fails twice: record the cause and change approach based on evidence.
- Three rounds produce no new verified progress: pause dispatch and reconsider the
  decomposition. A blocked tool or missing authority needs recovery, not repeated code edits.
- At `max(5, 2 * initial step count)` rounds, reassess scope and remaining work. Record a
  changed strategy before continuing; a numeric cap alone is not completion or a reason to
  abandon feasible authorized work. Honor explicit user limits and runtime stop rules.

For an unresolved plateau, optionally consult a different vendor once per trigger. From
Codex, use an available Claude review workflow with its authentication and permission
checks. Another Codex agent offers fresh context, not vendor independence. If unavailable,
record that limitation and continue evidence-driven replanning. A consultation is a proposal;
verify it against the contract before adopting it.

At handoff or a genuine blocker, save the state path, last verified result, exact unfinished
check, and next action. Report only currently valid verified claims. A saved checkpoint
does not schedule a future run; arrange wakeups only when the user requests them.
