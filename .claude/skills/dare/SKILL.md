---
name: dare
description: "First-principles chain: decompose, audit assumptions, recombine surviving blocks, test against reality; each step a fresh subagent fed only the prior artifact. Use on /dare, 'first principles', or 'are we solving the right problem'."
---

# dare: first-principles chain with fresh-context steps

D.A.R.E. = Decompose, Audit, Recombine, Experiment. One problem, four steps, each run in a fresh subagent that receives only the prior step's artifact, never the conversation. Fresh context is the mechanism, not a nicety: an auditor that saw the decomposer's reasoning defends it, and an architect that read the original problem statement reaches for the standard playbook.

## When to use, when not

- Use for problems where the inherited approach may itself be the problem: strategy calls, architecture choices, "we've always done it this way" processes, stuck problems where variations on the standard answer keep failing.
- Skip for well-specified build tasks (`writing-plans`), open design exploration (`brainstorming`), or challenging a single recommendation (`why`). Never auto-fire on an ordinary task.

## Orchestration

The main session is orchestrator only: it holds the user gates, passes artifacts, and never performs a step itself. Each step is one Agent dispatch. Model floor per the kernel (Sonnet or above); give A and E, the skeptic steps, the strongest model available. Artifacts are plain markdown passed verbatim inside the dispatch prompt.

Artifact chain: problem statement, decomposition tree, audit table, surviving blocks, solution set, test plan.

### D: Decompose

Input: the user's problem statement, verbatim.

Dispatch instructions: decomposition only; advice, solutions, assumptions, and standard playbooks are out of scope and count against you. First check whether the stated problem hides a deeper objective; if so, name it in one sentence and stop there. Otherwise break the problem into its smallest useful parts: a clear hierarchy (problem, major components, elements inside each), using only dimensions that matter here (people, process steps, time, resources, costs). For each component: what it contains and how it connects upward. Stop splitting when a further cut adds no understanding. No evaluation, no fact-versus-assumption labels, no recommendations.

Gate: if a deeper problem surfaced, ask the user in plain numbered chat which problem to decompose, and do not continue until they choose. Never silently reframe. Rerun D on the chosen problem if it changed.

### A: Audit

Input: the decomposition tree only. Not the conversation, not D's reasoning.

Dispatch instructions: skeptical red team; every "obvious" block may be hiding a convention until evidence says otherwise. Produce a numbered list of the assumptions hiding in the blocks, ordered most load-bearing first. For each: name it; classify it fact, convention, or unknown from available evidence, verifying with tools where the repo or the web can actually settle it; state what breaks or opens up if it is eliminated; state what changes if it is inverted.

Gate: show the table. The user may reclassify entries before R; their overrides are recorded as such.

### R: Recombine

Input: the surviving blocks only (facts plus anything the user kept). Deliberately excluded: the original problem wording, the audit's reasoning, and any statement of how this is normally solved.

Dispatch instructions: assemble as many solutions as the blocks honestly support: structurally distinct configurations, not detail variants. One is a legal count; so is five. Never pad toward a quota or trim a genuinely distinct shape to hit one. For each: which blocks it uses, which discarded convention it refuses to obey, its single biggest point of failure. Any new block must be labeled as a new assumption. Escape hatch, a legal and complete output: if the blocks only assemble into the conventional shape, say so; "the standard answer stands, and the audit shows its assumptions are facts" is a finding, not a failure.

### E: Experiment

Input: the solutions (or the standing conventional answer) only.

Dispatch instructions: for each solution, the smallest concrete real-world test: what to do, build, or ask, spending the least time, money, effort, and social risk the problem allows. For each test: the result that rules the solution out, the result that keeps it alive, and what is learned about the problem either way. If every test would fail, name the building block to revisit first.

Handoff: tests runnable from this machine execute through `verify-this` (falsifiable restatement, baseline, verdict) rather than being described and left.

## Output

The orchestrator ends with one consolidated report: the chosen problem, the audit table, the solutions with their failure points, the test plan, and the single next action. No step's subagent addresses the user directly.

## Boundaries

- Steps never share context. A dispatch gets the specified artifact and nothing else from the conversation.
- The orchestrator never folds its own opinion into an artifact between steps; changes happen at the gates, made by the user and labeled as theirs.
