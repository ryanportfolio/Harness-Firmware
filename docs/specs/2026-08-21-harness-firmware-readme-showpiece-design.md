# Harness Firmware README showpiece design

## Status

Approved on 2026-08-21. Full-tier README showpiece.

## Goal

Turn the Harness Firmware project README into a generated, GitHub-native front door that explains the repository feedback loop visually while keeping installation and usage copyable.

## Audience

Primary: developers deciding whether to adopt Harness Firmware in an existing or new repository.

Secondary: recruiters and technical peers evaluating the system design and execution quality.

## README job

This is a project README. A reader must answer these questions quickly:

1. What is Harness Firmware?
2. How do I install or start it?
3. How does the repository improve future work?
4. What runs in Claude Code and Codex?
5. What proof shows the template is maintained?

The boot trace and primary feedback circuit occupy the top third. Supporting runtime and skill diagrams stay beside the sections they explain; the large skill map is collapsed by default. Advanced operation moves to `GUIDE.md`.

## Repository truth at design time

Baseline revision: `2094fa7b0aef3aaa92b70db5c7c296f5bfbecbdc`.

- 30 canonical skill directories under `.claude/skills/`.
- 30 generated Codex adapter directories under `.agents/skills/`.
- Three skill groups: 8 core workflows, 8 quality disciplines, 14 specialist tools.
- Six committed project-memory files under `.claude/reference/`.
- Two documented runtime boundaries: Claude Code and Codex.
- The existing README still reports 23 skills and older context figures.
- CI parses PowerShell and shell entry points, verifies generated Codex adapters, validates the Codex contract, checks JSON, and runs the Windows project-generator smoke test.

All counts shown in generated art must be recomputed from repository files. `scripts/readme/items.json` owns skill grouping and labels, while the verifier requires a one-to-one match with canonical skill directories.

## Load-bearing visual idea

Harness Firmware appears as a real firmware diagnostic console. The visual vocabulary comes from the repository's actual behavior:

- boot trace for startup and routing;
- signal paths for runtime boundaries;
- memory cells for on-demand skills and committed project knowledge;
- a closed local feedback circuit for recall, work, verification, refinement, and the next task;
- a separate, human-gated starter-sync branch for generic improvements.

The feedback circuit is the main story. Other panels explain the parts that make the loop possible.

## Narrative

The README tells one causal story:

1. The repository loads a small rule kernel.
2. The agent recalls only the project knowledge relevant to the task.
3. A matching skill supplies the longer workflow on demand.
4. Verification produces evidence.
5. `refine` converts observed friction into a small, reviewable improvement.
6. The next task recalls the improved local repository.
7. After human review, `sync-starter` can optionally carry a generic improvement into future projects.

The solid visual loop must return to the next task in the same repository. A separate dotted branch reaches future repositories only after a visible human-review gate.

## Visual contract

- GitHub page colors provide the base. Transparent SVG backgrounds prevent theme seams.
- One phosphor-green accent means the active signal or currently selected memory cell.
- Neutral ink means stable repository structure.
- Muted ink means dormant, optional, or contextual information.
- Solid lines mean tracked repository flow.
- Dotted lines mean an optional propagation path that requires user choice.
- Rounded corners are limited to status chips and memory cells.
- System sans and system monospace are the only font stacks.
- Every panel uses the same 12-second linear timeline.
- Motion loops because GitHub cannot trigger animation on scroll.
- Reduced motion restores the complete final state with all labels and paths visible.
- No scripts, external fonts, external images, hover requirements, gradients, filters, or decorative fake data.
- Wide panels target an 880-pixel README column.
- Narrow panels use a separate stacked composition for a 390-pixel viewport.

## Generated panels

### Feedback circuit

Primary panel. Largest visual after the masthead.

Wide composition places six nodes around a routed local circuit:

`RECALL -> WORK -> VERIFY -> REFINE -> REVIEWED CHANGE -> NEXT TASK`

A signal advances one node every two seconds. Verification emits a persistent evidence packet. The local loop closes from `NEXT TASK` back to `RECALL`. A dotted branch leaves `REVIEWED CHANGE`, passes through `HUMAN REVIEW`, and reaches `FUTURE REPOS` only through `SYNC`; `KEEP LOCAL` remains the default.

Narrow composition becomes a vertical board with alternating left and right nodes. The return path runs down the outer edge. Every label remains visible without motion.

### Boot trace

Compact masthead panel. It contains the project name, one plain description, and a boot log derived from facts:

- rule kernel loaded;
- 30 skills indexed;
- 6 project-memory files mounted;
- Claude Code and Codex boundaries ready;
- validation workflow present.

The animation advances a cursor through the log and ends in `READY` before restarting.

### Runtime bus

Shows `.claude/skills/` as the canonical source. One direct path reaches Claude Code. A generated-adapter step reaches `.agents/skills/` and Codex. Both runtimes connect to the same `.claude/reference/` memory bank. Safety-boundary labels come from `AGENTS.md` and the compatibility matrix.

### Skill memory map

Draws exactly 30 cells. The cells are grouped as 8 core, 8 discipline, and 14 specialist. Cell area may follow `SKILL.md` byte size, but every cell retains a readable short label. A scan signal highlights cells in deterministic order. Wide mode uses three horizontal banks. Narrow mode stacks the banks.

## README structure

1. Generated-file marker.
2. Boot-trace picture with four variants.
3. One-sentence project definition.
4. Feedback-circuit picture and short prose explaining how lessons become repository changes.
5. Copyable plugin and full-template quickstart commands.
7. Runtime-bus picture and two compact runtime bullets.
8. Collapsed skill-memory-map picture and generated skill-group lists.
9. Plain validation proof linked to the GitHub Actions workflow.
10. Links to `GUIDE.md`, `CONTRIBUTING.md`, `CHANGELOG.md`, and `LICENSE`.

## Documentation split

`GUIDE.md` receives material that currently makes the README perform as a manual:

- full-template installation variants;
- Codex operating notes;
- prose-mode configuration;
- install doctor details;
- context-weight measurement details;
- detailed work-loop commands;
- runtime-boundary reference;
- repository path inventory;
- fork retargeting;
- machine-level Claude files;
- complete requirements.

The first implementation commit must perform this content move without adding the new visual system.

## File architecture

- `README.md`: generated artifact.
- `GUIDE.md`: advanced operation and configuration.
- `assets/readme/*.svg`: generated panel variants.
- `scripts/readme/items.json`: skill labels and group assignments.
- `scripts/readme/lib.mjs`: paths, escaping, frontmatter parsing, themes, and SVG helpers.
- `scripts/readme/facts.mjs`: repository fact collection and integrity checks.
- `scripts/readme/panels.mjs`: deterministic SVG generation.
- `scripts/readme/readme.mjs`: README assembly and content invariants.
- `scripts/readme/build.mjs`: ordered build entry point.
- `scripts/readme/verify.mjs`: clean-check mode used by CI.
- `scripts/readme/readme.test.mjs`: focused Node tests for facts, variants, accessibility, links, and generated freshness.
- `.github/workflows/validate-template.yml`: runs the README test and freshness gate.

No runtime dependency or package manager is added. All scripts use Node built-ins.

## Accessibility

- Every SVG has `role="img"`, a sentence-level `aria-label`, and a `<title>`.
- Every Markdown `<img>` has equivalent alt text.
- Meaning never depends on color or animation alone.
- Reduced-motion output exposes every path, node, and label.
- Narrow compositions keep a minimum 12-pixel rendered text size at a 390-pixel viewport.
- Quickstart commands remain text, never pixels inside an image.

## Verification

Local gates:

- `node --test scripts/readme/readme.test.mjs`
- `node scripts/readme/build.mjs`
- `node scripts/readme/verify.mjs`
- existing `node .claude/scripts/sync-codex-skills.mjs --check`
- existing `node .claude/scripts/test-codex-contract.mjs`
- `git diff --check`

Render gates:

- GitHub Markdown API returns the expected `<picture>` and image markup.
- Playwright captures 880-pixel light, 880-pixel dark, and 390-pixel narrow specimens.
- Every capture displays the quickstart before the long-form manual material.
- Feedback-loop labels remain readable at all three sizes.
- Reduced-motion capture shows a complete static circuit.
- Live GitHub verification is required after publication because the Markdown API can reject markup that the repository page preserves.

## Review gates

Full-tier review uses rendered specimens plus this contract and the locked fact list. Lenses:

- developer adoption and install findability;
- information design and typography;
- animation and reduced-motion integrity;
- factual and countable honesty;
- generic-template and AI-writing pattern detection.

The closing pass requires zero contract violations and zero factual errors. Optional refinements may remain logged.

## Exclusions

- No interactive controls inside the README.
- No hosted screenshots or remote badge services.
- No generated raster hero art.
- No change to bootstrap behavior, skill behavior, runtime permissions, or release packaging.
- No change to the fullbuild.ai Harness Firmware page in this unit of work.
