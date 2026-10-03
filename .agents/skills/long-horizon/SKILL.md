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
Baseline identity must include path/content hashes for relevant dirty, staged, untracked,
and ignored generated artifacts; record deletions and unavailable coverage. A Git revision
alone cannot identify the actual working state. `scripts/manifest.mjs` in this skill's
directory builds it (`<root> <out.json> --ref <ref> [Write scope and ignored paths]`) and
diffs it for the audit (`--diff <out.json>`).

| Field | Required content |
|---|---|
| Contract | Goal, authorized scope, constraints, numbered final acceptance checks |
| Amendments | Version, explicit user instruction, changed checks, affected steps |
| Workspace | Absolute root, branch/revision if Git, existing edits, baseline artifact paths, other workspaces the round reads (read-only) |
| Rounds | One entry per active round: step ID, batch, phase, workspace, agent/process IDs, allowed edits, local checks, dependencies |
| Verified progress | Claim, contract version, inspected revision or file fingerprints, evidence path |
| Remaining | Bounded steps, dependencies, write paths, pending final checks, invalidated claims |
| Dead ends | Failed approach, observed cause, evidence needed before retrying |
| Method notes | Rules later rounds must follow (such as how to measure), source round, unconfirmed / confirmed / dropped |
| Audit log | Round verdicts, evidence, decisions, blockers, recovery actions |

Phases: `planned`, `executing`, `awaiting-audit`, `accepted`, `needs-rework`, `blocked`.
Write state before dispatch, after execution, and after audit. Save before yielding or
ending a turn; never depend on noticing compaction in time.

On resume, reconcile state with the actual workspace and latest user instructions.
Check root, revision, dirty files, artifacts, and recorded workers/processes. HEAD alone
does not identify uncommitted content. Keep old evidence as history; mark affected claims
stale and recheck before dependent work. Recover partial edits instead of blindly repeating
execution. Confirm old writers have finished or stopped before replacing them, and stop
processes in `processes.log` whose worker no longer runs. Missing process IDs after restart
do not prove execution completed.

Before resuming a run this session did not start, check whether another session still
manages it: if the state file changed in the last 30 minutes or it lists a worker still
running, ask the user whether to take over (they stop the other session first) or stay out.
Two Managers writing one state file corrupt it.

Preserve the original contract. Explicit user changes become amendments; reassess affected
steps and evidence against the new version. Manager must not weaken acceptance to make
work pass. Carry existing authorization forward within its scope; ask only for missing
user-owned decisions or authority. Skill invocation does not itself authorize Git
publication, deployments, migrations, installation, or external messages.

## Parallel rounds

Run as many rounds at once as is safe. At every Plan, take every ready step that can run
beside the others, give each its own round, and dispatch them together as one batch. A ready
step waits for a later batch only when a rule below forbids it; note the rule in its
Remaining entry. A sequential run is a series of batches of one.

A step is ready when every step it depends on is verified. Ready steps share a batch only
when:

- their write scopes do not overlap, and neither reads a path the other writes;
- no two executions or done-checks contend for one resource: a port, dev server, browser
  profile, database, GPU, or a timing or performance measurement that parallel load would skew;
- available concurrency covers them, counting Manager and every executor, auditor and other
  worker. When it runs short, smaller batches or sequential rounds are valid.

Each round in a batch keeps the whole contract: its own state entry, workspace, baseline,
briefs, executor and auditor. Parallel executors never share a workspace: one writer's edits
land in the other's baseline diff and leave both audits `suspect`. Build each round's
workspace from the main one before its baseline: `git stash create` in the main workspace
(empty output: use HEAD), `git worktree add --detach <path> <sha>`, then copy in the main
workspace's untracked files and any ignored artifacts the step needs (dependencies, build
output); or make a plain copy. Never a worktree at HEAD: it drops earlier rounds'
uncommitted verified work. Take the round's baseline inside its own workspace.

Dispatch every executor in the batch before waiting on any. Each round's auditor starts as
soon as that round's executor stops, without waiting for the rest of the batch. Integrate
once every round in the batch is audited:

1. For each accepted round, apply its manifest diff to the main workspace verbatim: copy each
   added or modified path from the round's workspace and delete each deleted path. A main
   workspace file that no longer matches the round's baseline (or exists where the baseline
   had none) is a conflict; that step returns to Remaining for a later batch and is not a
   dead end.
2. Verdicts from separate workspaces do not prove the steps work together. When more than
   one round was applied, one fresh auditor runs every applied round's done-checks in the
   main workspace before any of them counts as verified. A step that fails there returns to
   Remaining with that output, and its applied paths are recorded with a revert-or-keep
   decision.
3. A rejected round's delta stays out of the main workspace. Save it as a patch under
   `evidence/round-<N>/`, which a recovery brief may cite, and record it as not applied.

Then remove the batch's workspaces (`git worktree remove`). Inside a round, the executor runs
independent reads, searches and commands at once and may use read-only helpers when the
runtime allows. Work that needs parallel writers is several steps: split it in Remaining and
run the steps as parallel rounds.

## Each round

1. **Plan one step per round.** Define allowed paths/actions, dependencies, local done-checks, and
   relevant task constraints. Capture a pre-round baseline, including dirty and untracked
   files, sufficient to distinguish this round's changes from existing work. Save a
   versioned auditor brief now (pre-register it), before spawning the executor, from the contract, scope,
   checks, baseline identity and raw artifact paths. Record its path and content hash.
   Write and edit state and briefs with the file-edit tool; shell and script string layers
   drop backslashes and backticks. Re-read each saved brief before dispatch. Every brief
   asks its worker to append each long-lived process it starts (pid, port, command) to
   `processes.log` in the task directory. A brief for hours-long jobs has the executor check
   between batches that its workspaces are still whole (`git worktree list`, a sentinel
   file) and stop and report a mismatch instead of rebuilding. Evidence taken on another
   revision (line numbers, a patch map) names that revision, and the executor finds cited
   code by anchor text, not line number.

   A round whose execution or done-check costs hours (browser work, GPU timing, long
   batches) gets a draft review after its scope and checks are drafted and before the
   baseline and auditor brief freeze them. One fresh read-only peer, preferably another
   vendor (a custom-prompt Claude CLI run with the `claude-review` skill's authentication
   and launch checks; else a fresh agent with `fork_turns: "none"`, which gives fresh context
   but not vendor independence), reads the draft step and done-checks and the code the
   checks exercise, and answers one question: can this check pass while the work is wrong,
   fail while it is right, or not run as written? It returns concrete findings only: a wrong
   implementation that passes (a stub returning the expected value, a test that never
   reaches the changed path, a check that reads a file the executor can write), a correct
   result that fails the check read literally, or the command that fails as written, with its
   cwd and output. "Could be stronger" is not a finding. Manager fixes the draft, asks for at
   most one follow-up review of the changed wording, then freezes. The peer sees only the
   draft and the code, never an executor report; the auditor brief carries only the frozen
   checks, never the peer's critique. Cheap rounds skip this; an auditor verdict of
   `blocked` for a broken check covers them.
2. **Execute.** Spawn a fresh agent with `fork_turns: "none"` when that parameter is exposed.
   Supply a standalone brief: step, scope, checks, necessary verified facts, relevant dead
   ends, Method notes, absolute workspace/artifact paths, current permissions and style instructions.
   Keep the brief sufficient without Manager conversation history. Use the exposed runtime's
   equivalent if names differ. If only inherited context is possible, record the limitation;
   do not claim a fresh independent audit. Honor explicit user model choices; otherwise
   inherit the session model. If a requested model is unavailable, disclose the gap rather
   than silently substituting. Executor implements and verifies only its step, then returns changed paths,
   commands/results, and blockers. It cannot edit Manager state or dispatch more agents.
3. **Audit after execution stops.** Spawn a separate fresh agent with the prewritten
   auditor brief byte for byte, or by path when the agent first checks it against the
   recorded hash. Do not rewrite it after reading executor output. A Plan
   defect belongs in the next round. An explicit user amendment requires reconciling
   workers, retaining old briefs/baseline, and freezing a new version from the amended
   contract and raw artifacts without executor assessments. Exclude
   executor reports, turns, and verdicts. If a report is itself the requested deliverable,
   the auditor must inspect it as an artifact, without receiving the executor's assessment.
   Auditor inspects actual changes and runs relevant
   checks itself. It does not fix implementation or write Manager state. Keep other writers
   off the audited files until the verdict is integrated.
4. **Integrate.** Batches follow the order in Parallel rounds. Accept only
   `complete + clean + aligned` backed by evidence. Otherwise
   record findings, invalidate prior claims affected by failed changes, and schedule the
   next round by the auditor's `repairable` verdict: `yes` earns one recovery round on the
   same approach with the auditor's diagnostic in its brief, counted as the step's second
   attempt; `no` sends the approach to Dead ends and the next brief changes approach. One
   recovery per step: a failed recovery is the second failure and Stagnation applies.
   Preserve unrelated verified claims. On acceptance, copy cited result files that live
   outside the task directory into its `evidence/round-<N>/`, since a workspace can vanish.
   Rules for later rounds that the executor's report states go into Method notes,
   unconfirmed until a later done-check covers them. Persist state before the next round.

A round that builds or changes a verification tool (a harness, probe, diff or measurement
script) that later rounds will use as evidence gets one cross-vendor code review of that
tool after it is accepted, before any later done-check depends on it: `claude-review`, or
`opus-fullreview` for a large tool, run between rounds on the uncommitted work that holds
it. The audit judged the round's step; it did not ask whether the tool measures correctly.
Confirmed findings in the tool become the next round's step; others go to Remaining.

At the end of each phase (a contract milestone, or the unit the user asked to ship as one
PR), run `opus-fullreview` on the phase's diff, or `claude-review` when the diff is small.
Surviving findings are fixed in an accepted round before merge, never patched by Manager
directly. Any other review the repo requires before merge still runs. When the user asked
for one PR per phase, a phase ends after its last accepted round: commit, open the PR, run
these reviews, and record `Waiting: merge of <PR>` in state.
The next phase plans its first round in a fresh workspace from the merged default branch and
takes its baseline there.

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
- `repairable`: yes / no, on `incomplete` only, with the diagnostic from the auditor's own
  check run. Yes means a mechanical fault the approach survives (build error, missing
  dependency, harness or resource failure); no means the approach itself failed. A
  diagnostic that exists only in the executor's report is a claim and does not count.
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

- Same step fails twice: record the cause and change approach based on evidence. A failed
  recovery round is the second failure.
- Three batches in a row produce no new verified progress: pause dispatch and reconsider the
  decomposition. A blocked tool or missing authority needs recovery, not repeated code edits.
- Count both triggers from the Audit log, never from memory. A rewrite may route the stuck
  step through `arena` (parallel candidates, pick, graft) inside the executor agent; the
  Manager never reads candidates, picks or grafts, and the auditor sees only the workspace
  result. Candidates need Contract and Dead ends copied in, and a worktree starts from HEAD,
  so use `.tmp/arena-*` copies or commit a WIP first or earlier uncommitted edits are lost.
- At `max(5, 2 * initial step count)` rounds, reassess scope and remaining work. Tag every
  Remaining item continue, reserve, or close with a one-line reason; a reserved item reopens
  only through the final audit's failed checks or a user instruction. Record a changed
  strategy before continuing; a numeric cap alone is not completion or a reason to abandon
  feasible authorized work. Honor explicit user limits and runtime stop rules.

Track executor attempts and auditor invocations, including retries. A user-stated budget
or a bound agreed with the user is binding; checkpoint before exceeding it. Distinguish
that limit from the default strategy reassessment threshold. Preserve evidence and report
remaining work when a binding limit is reached; it does not establish completion.

For an unresolved plateau, optionally consult a different vendor once per trigger. From
Codex, use an available Claude review workflow with its authentication and permission
checks. Another Codex agent offers fresh context, not vendor independence. If unavailable,
record that limitation and continue evidence-driven replanning. A consultation is a proposal;
verify it against the contract before adopting it.

At handoff or a genuine blocker, save the state path, last verified result, exact unfinished
check, and next action. Report only currently valid verified claims. A saved checkpoint
does not schedule a future run; arrange wakeups only when the user requests them.
