# Codex long-horizon implementation plan

> **For agentic workers:** Implement this plan task-by-task, in order. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Make `.agents/skills/long-horizon/SKILL.md` a standalone Codex workflow while preserving Claude's skill.

**Architecture:** Explicitly register long-horizon as hand-authored in the adapter synchronizer. Validate its own metadata and preserve its bytes in both sync modes. Keep other adapters generated.

**Tech Stack:** Markdown, Node.js built-in test runner and filesystem APIs.

## Tasks

- [x] Capture current workflow decisions with fresh agents before changing the skill.
- [x] Add isolated sync regression coverage in `.claude/scripts/test-sync-codex-skills.mjs`: preserve a standalone skill through repeated sync, keep ordinary adapter generation, reject missing or still-generated standalone content, and reject accidental handwritten adapter replacement. Run with `node --test .claude/scripts/test-sync-codex-skills.mjs`; expect preservation to fail before implementation.
- [x] Update `.claude/scripts/sync-codex-skills.mjs` with an explicit standalone registry and validate registered content before mutations. Remove the superseded long-horizon adapter note.
- [x] Replace `.agents/skills/long-horizon/SKILL.md` with Codex instructions for fresh rounds, scoped gates, auditor baselines, state recovery, amendments, and final acceptance. Keep the Claude file unchanged.
- [x] Update `AGENTS.md`, `.agents/CODEX-SKILL-COMPATIBILITY.md`, and `.claude/scripts/test-codex-contract.mjs` to describe and validate the exception. Wire regression coverage into `.github/workflows/validate-template.yml`.
- [x] Run the same workflow scenarios with fresh agents and resolve concrete failures.
- [x] Run sync regression tests, sync write/check, Codex contract checks, relevant README checks, and `git diff --check`. Inspect the final diff and confirm the Claude workflow is unchanged.

Git publication is separate from this local implementation; no automatic merge mode is enabled.

## Verification results

- Before implementation, sync preservation failed and write mode recreated missing/generated long-horizon adapters. All 10 isolated sync cases now pass.
- Fresh-context inspection found absent resume/amendment procedures and ambiguous gate scope. The initial application scenario inferred sensible recovery without explicit rules; it did not demonstrate a behavioral failure. The standalone workflow made those decisions explicit.
- A fresh agent applied the updated workflow to local versus final checks, stale revisions, requirement amendments, interrupted writers, absent baselines, unavailable gates, vendor routing, and missing agent capability. Its decisions preserved the intended acceptance boundaries. These are scenario checks, not a live multi-round endurance run.
- Codex sync write/check and contract validation pass. README checks pass after regeneration. Initial README failures came from CRLF-sensitive comparisons; initial regeneration produced no semantic Git diff. README source and generated labels were then updated for the standalone skill.
- Claude's long-horizon skill is unchanged.
