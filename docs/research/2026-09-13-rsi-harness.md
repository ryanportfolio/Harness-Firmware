# Applying the RSI survey to Harness Firmware

Add a compact evaluation record to the existing `refine` workflow. Harness Firmware already turns task friction into reversible instruction changes and asks for behavioral checks. A reusable record makes those checks easier to compare and revisit. The implementation adds that record to both runtime skills; its effect on future task performance remains unmeasured.

## What the paper supports

The survey distinguishes retaining and reusing a revised improvement mechanism from demonstrating that it produces better successors. The stronger claim requires comparable starting conditions, matched budgets, and independent evaluation. Reliable accumulation across generations remains open. [Section 3.6.5](https://arxiv.org/html/2609.11873v1#:~:text=3.6.5%20Evaluating%20L5%20Recursive%20Improvement)

Its software discussion describes small workflow changes evaluated through repository feedback, regression checks, and versioned reuse. It says full L5 improvement of the software-development improver has not been demonstrated. [Section 4.3.4](https://arxiv.org/html/2609.11873v1#:~:text=4.3.4%20Toward%20Recursively%20Improving%20Software-Engineering%20Agents)

The evidence mixes research and industrial disclosures. Traceable artifacts and protected evaluation are useful research directions; they do not establish general gains. The AIDE2 discussion reports no statistically significant outer-improver efficiency advantage. [Evidence scope](https://arxiv.org/html/2609.11873v1#:~:text=2.3%20Scope%20of%20Evidence), [future directions](https://arxiv.org/html/2609.11873v1#:~:text=6%20Challenges%20and%20Future%20Directions)

## Fit with the repository

The useful recommendation is narrower than building an autonomous improvement system. The repository already has most of the working parts:

| Existing mechanism | Contribution |
|---|---|
| [Codex refine](../../.agents/skills/refine/SKILL.md) and [Claude refine](../../.claude/skills/refine/SKILL.md) | Inspect actual friction, choose small edits, and check affected behavior. |
| [verify-this](../../.claude/skills/verify-this/SKILL.md) | Compare baseline and treatment, then report VERIFIED, NOT VERIFIED, or INCONCLUSIVE. |
| [Codex long-horizon](../../.agents/skills/long-horizon/SKILL.md) | Keep bounded rounds, revision evidence, and independent audit decisions. |
| [Codex recall](../../.agents/skills/recall/SKILL.md) | Retain durable, decision-relevant knowledge while excluding task status and recoverable facts. |
| [memory-audit](../../.claude/scripts/memory-audit.mjs) | Estimate local Claude usage counts, with explicit coverage limits. |

The gap was a shared record connecting the proposed change, comparable trials, retention decision, rollback, and later use. Existing instructions already supported parts of this practice. This addition makes the evidence explicit and reusable; it does not establish that earlier guidance failed.

Usage counts have a narrower role. `memory-audit` can suggest that guidance receives little attention, but a read or invocation does not prove correct execution or a better outcome. Its local Claude transcript coverage also cannot establish Codex usage. Pruning should remain a judgment informed by evidence.

## Implemented workflow

Both `refine` skills now route material changes to a local [evaluation resource](../../.agents/skills/refine/references/evaluation.md). Material means a change to routing, decisions, verification, or retained working behavior. Ordinary wording and metadata corrections keep static validation when that is sufficient.

Before trials, the record fixes the expected behavior, improvement threshold, targeted scenario, and a neighboring regression scenario. It identifies baseline, candidate, and evaluator versions and the relevant model, context, tools, input, and resource limits. Changing the candidate or criteria starts another comparison while preserving the earlier result.

The result separates three claims. Local acceptance explains why a candidate is retained. Later use needs evidence from another task and can remain pending. Demonstrated improvement needs a valid comparison against the stated threshold. A missing baseline yields an inconclusive improvement verdict, and unchanged behavior cannot become a gain merely because both versions pass.

An evaluator change needs an independent check against the original claim. Easier grading cannot establish success. Negative results and confounds remain in the record, alongside the diff or backup needed to reverse the edit.

Keep the record with task evidence and link it from the refinement report or existing task state. The [guide](../../GUIDE.md#work-loop) exposes this practice through the existing workflow. Each runtime carries the same resource inside its skill folder, preserving personal-copy portability. [Provenance](../../.claude/skills/PROVENANCE.md) assigns responsibility for keeping those copies aligned.

## Limits and deferred work

This is an instruction and documentation change. Static validation can establish valid metadata, working links, and portable resources. Scoped behavioral exercises can test whether agents make the intended decisions. Neither establishes sustained performance improvement across real tasks. Later-use evidence and future benefit remain unmeasured until those tasks occur.

Autonomous populations, task generation, model training, automatic promotion from usage counts, and self-modifying evaluators remain deferred. A separate Codex usage adapter may become useful if missing evidence repeatedly obstructs refinement. The current record works without another evaluation engine, a new skill, or a larger always-loaded instruction layer.
