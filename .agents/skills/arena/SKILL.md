---
name: "arena"
description: "Spawn N parallel candidate attempts at one task, pick the strongest as base, graft the losers' best parts in. Use when the user says $arena, \"arena this\", or when one attempt at a non-trivial artifact would lock in the wrong shape."
---

# Arena

Fan out N parallel attempts at the same task. Read every candidate end to end. Pick the strongest as the base. Graft the best ideas from the others into it. Verify the synthesized result.

Arena is a bakeoff plus synthesis: use it when the shape of the solution is the open question. `$wow-loop` iterates one implementer under adversarial critique; `$impartial-review` reviews an existing diff.

Invoking arena does not authorize commit, push, PR, merge, deploy, dependency installation, or another outward action unless that action is the user's explicit request.

## Capability gate

Candidates and the cross-judge need fresh independent context. Inspect the tools exposed in this session first; config flags are not proof. Spawn each worker through the currently exposed multi-agent tools with `fork_turns: "none"` and a self-contained brief. A separate `codex exec` process with a standalone prompt also gives fresh context when the CLI is authenticated.

If neither route is available, report the gap and stop. Do not write the candidates serially in the main thread or judge them yourself and call the result an arena.

## Start

Open an `update_plan` with one step per phase before launching anything. The arena runs autonomously and the plan keeps phases from silently disappearing.

1. Frame
2. Fan out
3. Cross-judge
4. Pick
5. Graft
6. Verify

## Phase A: Frame

The N candidates receive the same prompt, so the prompt is the contract. Get it right before spawning anything.

1. State the artifact each candidate is producing.
2. Derive the rubric. State what success looks like for this task, then turn it into 3-6 concrete gradeable criteria. Concrete: "Adds a --dry-run flag that skips writes". Vague: "code is correct". The rubric is the picker's tool in Phase D; candidates only see the task.
3. Pick the runners. Default: 3 candidates, scheduled within exposed capacity (count the parent and active workers; use batches if necessary). Honor explicit user model choices and required floors, otherwise inherit the configured session model; disclose unavailable choices rather than silently substituting. Prompt each from a distinct angle (for example simplest-thing-that-works, robustness-first, user-experience-first) so diversity comes from framing, not chance. Spawn more candidates when the arena covers multiple design directions.
4. Vendor diversity. Codex agents and `codex exec` share one vendor, so they add framing diversity only. A cross-vendor candidate from Codex means the Claude CLI under the `$claude-review` gate: use it only when the Claude CLI proves subscription routing, never opt into paid usage, and otherwise run that candidate on Codex and say so.
5. Assign output paths. Each candidate writes to its own location: a separate git worktree where possible, otherwise `.tmp/arena-<slug>/candidate-<n>/`. N candidates writing to the same path is shared mutable state and corrupts the comparison.

## Phase B: Fan out

Spawn each capacity-bounded batch with fresh context. Each brief carries the task, the path to any shared grounding, its own output path, and instructions to produce both the artifact and a short rationale.

Store each rationale separately from its judge-facing artifact. Keep angle and vendor labels and rationale paths in a parent-only record. The rationale is mandatory: without it the parent cannot tell whether a candidate's structure is principled or accidental, which makes Phase E grafting unreliable. Each rationale names the alternatives the candidate considered and what it rejected.

Wait for every candidate in the batch. If a candidate fails to produce output, proceed with N-1 and note the dropout in the synthesis record.

## Phase C: Cross-judge

After all Phase B candidates complete, spawn one fresh read-only judge. Prefer a different vendor from the candidates when the Phase A vendor gate allows it; otherwise a fresh same-vendor agent still removes the parent's authorship bias. Say which one ran.

Give the judge a separate directory containing only neutral-labeled artifact snapshots and the rubric. Exclude candidate rationales, angle and vendor metadata, revealing filenames, parent conclusions, and access instructions for the parent-only record. Remove incidental author metadata without changing the artifact being compared. Record any unavoidable recognizable content as a blinding limitation.

The judge scores each criterion and recommends a base with evidence. It runs in parallel with the parent's own reading in Phase D, not with the candidates: a judge spawned while candidates are still writing sees partial outputs and reports them as dropouts.

## Phase D: Pick a base

Read every candidate end to end before picking. Skimming N candidates surfaces only the one whose surface looks most familiar.

Score each candidate against the rubric criterion by criterion, not on holistic feel. Compare against the cross-judge. Agreement is a preference signal, not proof of correctness. Disagreement calls for checking the cited evidence and criteria; it does not prove bias. Read both assessments before deciding, and verify the artifact independently of votes.

Pick the base a future maintainer can extend most easily without breaking invariants. Prefer the cleaner boundary or smaller surface area when two feel tied.

Record the pick and the reason in a short synthesis note alongside the base artifact, including the cross-judge's verdict.

## Phase E: Graft

Walk each losing candidate once more and identify what is worth porting into the base. The signal is usually one or two things per candidate, not most of it.

Fold each graft in by hand, redesigning it to fit the base's shape. Do not paste mechanically. The result has to remain coherent under one mental model.

Record what was grafted, from which candidate, and what was rejected and why. The rejection notes are the highest-signal part of the record: future readers learn from what you considered and dropped, not only what you kept.

When candidates converge, record the shared shape and verify it against the contract; shared assumptions may still be wrong, and no graft may be needed. Divergence can expose real alternatives or an underspecified contract. Inspect it before deciding whether to reframe; do not average incompatible designs. Additional runs respect the user's budget and any CLI retry authorization.

## Phase F: Verify

The synthesized artifact faces the same scrutiny as any other output. The arena does not earn a verification pass: run the real check the artifact claims to satisfy.

If verification surfaces a problem the arena did not catch, either Phase A was wrong (reframe and rerun) or one candidate caught it and you missed the graft (return to Phase E). Do not paper over it.

## Outputs

One synthesized artifact. One short synthesis note alongside, naming the base, the grafts with source candidate, the rejections, any dropouts, which runners and judge actually ran, and the verification result. Scratch candidate outputs stay in `.tmp/` or their worktrees; only the synthesis ships.

## Anti-patterns

- Do not average divergent candidates into a hybrid nobody designed. Reframe and rerun.
- Do not let the judge see angle or vendor labels; sanitized path labels only.
- Do not skip reading a candidate because the judge scored it low; grafts hide in losers.
- Do not run an arena on trivial work; one attempt suffices when the shape is obvious.

---
Adapted from the `arena` skill in [cursor/plugins pstack](https://github.com/cursor/plugins/tree/main/pstack) (MIT, by poteto).
