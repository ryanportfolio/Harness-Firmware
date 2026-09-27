---
name: long-horizon-swarm
description: 'Peer swarm on a long-horizon run: Opus, Sol and Astra contribute ideas, critique and code throughout; disagreements are flagged to the user, never blocking. Use on /long-horizon-swarm or to bring Sol/Astra into long-horizon.'
---

# long-horizon-swarm: peers working a long-horizon run

This is the `long-horizon` contract plus a swarm. Read `.claude/skills/long-horizon/SKILL.md`
(or `long-horizon-workflows` when that engine is in use) and follow it: state file, rounds,
baseline, fresh auditor, stagnation and completion all apply unchanged. This file adds who
contributes and how their work flows in. Discussing or editing this skill does not activate it.

## Attach or start

Look for `.tmp/long-horizon/*/state.md` in this checkout before anything else.

- One run matches the task: attach to it. Add `Swarm: on` under its Contract, create
  `swarm.md` beside it, and continue from its current phase. Never start a second state file
  for the same task.
- Several could match: ask which one.
- None: start a long-horizon run per its contract, with `Swarm: on` from round one.
- A round in phase `executing`: let that executor finish before any swarm member writes.

Only this checkout's `.tmp` is visible. A run in another worktree or clone is invisible
unless the user points at it or a `session-hub` hub records it.

## Peers

| Peer | Route | Default |
|---|---|---|
| Opus | `Agent` tool, fresh context | Opus, the latest Fable, or higher; never `sonnet` or `haiku` |
| Sol | `codex exec`, one new process per contribution | the Sol id `codex-review` pins, `high` effort |
| Astra | `codex exec`, one new process per contribution | `gpt-6-astra`, `medium` effort |

Preflight once: `codex login status` must report a ChatGPT (subscription) login, and flags
come from local `codex exec --help`. Logged out, API-key login, or unclear billing: tell the
user, run with Opus peers only, and label the run as single-vendor. Never switch Codex to an
API key or paid credits, and never bypass its approvals or sandbox. Honor explicit user
model choices.

This session is the **host**. It exists because only it can spawn agents, launch
`codex exec`, keep the state file across compaction, and talk to the user. It dispatches and
keeps the record; its ideas carry no more weight than any peer's. Long-horizon still forbids
it from executing a round's step itself.

## Contributing

Any peer may contribute anything useful at any phase: ideas, critique of a plan or diff,
alternative approaches, code, tests, a reproduction, a counterexample. The host decides
who to ask and when, by where a second model is likely to see something the first did not.
Useful moments: attacking the decomposition and done-checks before round one, reviewing a
round's work in progress, proposing a new approach after an audit fails. None is required.

- **Code** is written in the contributor's own copy: an `isolation: "worktree"` agent, or a
  copy under `.tmp/long-horizon/<slug>/swarm/<entry-id>/` passed to `codex exec -C <dir>`
  with a sandbox that allows writing only there. Copies are made from the current workspace,
  not HEAD, because rounds do not commit. The round's executor, or one fresh agent the host
  names integrator, applies the chosen result to the workspace within Write scope. Swarm
  copies sit outside Write scope and the auditor ignores them.
- **Review** passes the artifact first (diff, plan, file paths) and the author's reasoning
  only if the reviewer asks. Critique aimed at the artifact finds more than critique aimed at
  the justification.
- **Brief** each Codex peer with the contract, dead ends, and the artifact paths it needs.
  It shares no memory with this session, so the brief is all it knows.

A contribution cycle ends when a pass adds nothing new: no new finding, idea or code.
There is no fixed cap. If peers start agreeing without citing new evidence, run one more
pass with a fresh peer on the bare artifact; if that adds nothing, stop.

## The audit stays cold

The auditor brief is written at Plan, before any swarm work on the round, and dispatched
byte for byte as long-horizon requires. It never contains `swarm.md`, a peer's critique, or
a peer's opinion of the work. Swarm agreement is not evidence; only the auditor's own
inspection moves work into Verified progress. A swarm finding that should become a check
goes into a later round's Plan.

## Log

`.tmp/long-horizon/<slug>/swarm.md`, appended by the host:

```markdown
# Contributions
- S<n> round <N> | <peer> <model>/<effort> | <agent id or codex session id> | idea / critique / code / alternative
  target: <plan, step, file or entry id>   artifact: <path>
  outcome: taken / partly taken / left, with the reason

# Disagreements
- D<n> round <N> | <topic> | status: open / decided by user
  positions: <peer>: <claim + evidence>; <peer>: <claim + evidence>
  following: <which position the work follows now, and why>
  user decision: <verbatim or pointer, once given>

# Codex runs
<count per model, updated every entry>
```

## Disagreements

Flag, never block. When peers disagree after each has seen the other's evidence, record it
under Disagreements, continue on the position with the stronger evidence (tie: the one
cheaper to reverse), and keep the other side's artifact. Report open disagreements to the
user in every progress update and in the final handover, with each position's evidence and
what changes if they pick the other side.

A user decision that changes Goal or Acceptance is a long-horizon amendment. A disagreement
that touches an irreversible action (publish, deploy, delete, migrate) stops that action
until the user decides; the rest of the work continues.

## Spend

Every `codex exec` run bills the user's subscription. Log each under Codex runs and state the
counts in every progress update. Explicit user budgets for runs, rounds or time are binding;
checkpoint before exceeding one.

## Handover

Long-horizon's completion rules apply. Add: the Codex run counts, every open disagreement
with both positions, and which peer's work each Verified progress claim came from. The
kernel's `codex-review` before merge still applies; swarm review does not replace it.
