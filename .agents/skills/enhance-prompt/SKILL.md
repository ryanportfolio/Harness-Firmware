---
name: enhance-prompt
description: "Rewrite a rough request into a self-contained prompt for another agent, without executing the prompt or changing its intended scope."
---

# Rewrite a prompt

Extract the intended outcome, target, constraints, available context and acceptance criteria. Preserve whether the user wants advice, review or implementation. Do not add approval stages merely because the subject includes UI copy or code.

Verify useful local facts such as paths when available. A cold receiver needs relevant facts, not a transcript or a dump of project rules. State genuine unknowns; ask only when one materially changes the requested prompt. Never invent constraints, permissions, tools, or facts.

Write clear normal prose, even when chat uses compressed language. Specify what to produce and how success will be checked. Keep the prompt platform-neutral unless a particular runtime is part of the user's request. Carry only authorization actually given; don't prohibit necessary tests or demand screenshots by default.

Return one copyable fenced block and a short explanation of material changes. Do not execute the rewritten request or edit project files unless separately asked.
