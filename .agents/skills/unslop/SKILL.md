---
name: unslop
description: "Clean up prose or a code diff when cleanup is requested. Routine session replies already use Caveman’s built-in Unslop; user-facing deliverables use Writing."
---

# Clear writing and focused diffs

This is a focused cleanup workflow. Caveman already embeds the chat Unslop rules; do not load this skill for every reply. Writing remains the editorial workflow for user-facing deliverables. An explicit Unslop request can target either existing prose or a scoped code diff without changing those standing roles.

For prose, preserve every factual claim, caveat and quoted artifact. Lead with the point; replace vague praise, filler and invented jargon with concrete statements. Follow current user preferences, then project voice, then general style guidance. Keep code, identifiers and error strings exact.

Do not restate the whole standing style policy or load another writing skill for a short answer. For an explicit prose review, identify concrete defects and fix them; ordinary drafting needs no PASS/FAIL appendix. A distinctive voice is not a defect.

When asked to clean a code diff, inspect the scoped changes and nearby conventions. Remove only redundant comments, unnecessary scaffolding or similar noise you can justify. Preserve behavior and useful validation; do not delete defensive code merely because it looks generated. Run checks appropriate to meaningful changes. Do not publish the edits unless authorized.
