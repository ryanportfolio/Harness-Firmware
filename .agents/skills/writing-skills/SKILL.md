---
name: writing-skills
description: "Use when authoring or updating a reusable skill, or checking whether its instructions route and behave correctly. Reviewing a skill does not activate its workflow."
---

# Author Codex skills

Write instructions that change useful decisions. Preserve the user's goal, existing
authorization, and the distinction between reviewing a workflow and executing it.
Read the existing skill, its dependencies, and applicable repository rules first.

Put a discriminating name and description in YAML frontmatter. Keep the entry point short:
when to use it, essential decisions, evidence needed for completion, and meaningful limits.
Keep ordinary instructions in normal prose. Avoid repeating rules the runtime already
enforces. Use supporting references for genuinely shared or conditional detail; link them
with a clear loading condition. A standalone Codex skill must not depend on another
runtime's workflow for its basic execution rules.

Preserve non-obvious invariants before shortening a skill. Use actual exposed tools and
capability checks for agents, input, browser control, and external services. Provide an
honest unavailable path. Fresh review requires fresh context; self-review is not equivalent.
Respect current model choices and capacity. Scope permissions to the requested work.

## Choose verification by the change

- Metadata, paths, packaging, or small wording corrections: validate structure, references,
  and relevant sync behavior. Test scripts through meaningful input/output cases.
- Material routing or decision changes: use realistic scenarios, including a nearby request
  that should not trigger the workflow, a blocker, and previously authorized work.
- Complex or consequential workflows: use fresh independent agents when available. This
  skill requests bounded validation agents for that purpose. Supply the request, skill, and
  minimum raw artifacts, without the expected answer or prior conclusions. Keep side effects
  in disposable fixtures. Publishing or paid-provider calls need their own authorization.

A passing baseline is evidence; never force a failure to justify an edit. Distinguish
static checks, hypothetical scenario responses, and actual execution. Only a real interrupted
run can establish interruption recovery. Record failures, narrow the fix, and recheck the
affected scenario. Avoid tests that merely repeat headings or expected wording.

Use the repository's installation workflow to register source ownership, validate discovery,
and preserve authored content during sync. Adding or testing a skill does not imply
publication. Report changed paths, observed verification, and remaining limits.
