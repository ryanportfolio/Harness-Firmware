---
name: verify-this
description: "Verify a claim with fresh local evidence and return VERIFIED, NOT VERIFIED, or INCONCLUSIVE. Use for $verify-this, 'prove it works', 'did this fix it', or 'show me the evidence'."
---

# Verify a claim

Restate the claim as an observable condition and acceptance criterion. Infer these from
the request and context when clear. Investigate discoverable facts before asking; ask only
when a material criterion remains unresolved. Do not invent a threshold for a vague claim.

Choose the smallest surface that can disprove the claim, then select the evidence needed:

- **Current state:** inspect actual output or behavior against the criterion. An export's
  dimensions or a command's current result needs no historical baseline.
- **Change:** capture baseline and treatment using comparable commands, data, warmup,
  and environment. A passing current-state check alone cannot establish improvement.
- **Causation:** also isolate the proposed cause, using a controlled change, rollback/reapply,
  or another justified design. A before/after difference with plausible competing causes
  supports a change, not the stronger causal claim.

Verify at the claimed layer: focused tests or a repro for code behavior, real command output
for CLI behavior, HTTP responses for APIs, rendered evidence for layout, and measurements
for performance or memory. Confirm that a UI under test serves the intended current code.
Prefer text capture for textual facts and screenshots for visual facts. Do not substitute
a code read for observed behavior or a screenshot for a performance measurement.

For a multi-check report or before/after presentation, read the packaged
[evidence report](references/evidence-report.md). Keep small current-state checks brief.

Keep commands, outputs, and artifact paths sufficient to reproduce consequential findings.
When useful, save minimal evidence under `.tmp/verify-this/<claim-slug>/<run-id>/`;
identify the inspected source/output with content hashes and record the command and environment; avoid retaining
sensitive payloads unnecessarily. Work within existing authorization and storage constraints.
Do not alter unrelated state to manufacture a baseline.

Return one verdict with the claim, evidence, and material limits:

- `VERIFIED`: current-state evidence meets the criterion, or a valid comparison supports
  the claimed change without an evident confound. A causal verdict additionally needs
  evidence isolating the proposed cause from plausible competing explanations.
- `NOT VERIFIED`: valid evidence contradicts the claim or misses its criterion.
- `INCONCLUSIVE`: evidence is unavailable, noisy, or invalid; a required comparative
  baseline is missing; or the acceptance criterion remains unresolved.

For comparisons, report baseline, treatment, and the relevant difference. For current-state
claims, report the observed result and criterion. Preserve uncertainty; missing evidence
is not proof of failure. Once sufficient checks pass, repeat or broaden only for relevant
changes, failures, or unresolved concerns. Report unavailable required checks honestly.
