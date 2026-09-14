# Skill Provenance

Where each skill came from, its license, and what this repo changed. Not loaded
into context; it is reference for maintainers and public users.

**Maintenance rule:** when you materially change a forked skill, update its
"Our deltas" cell here. When adding a third-party skill, add a row and keep its
LICENSE/NOTICE files in the skill folder.

## Forked / third-party

| Skill | Upstream | License | Our deltas |
|---|---|---|---|
| `brainstorming` | [obra/superpowers](https://github.com/obra/superpowers) (Jesse Vincent) | MIT (in folder) | Two-lane scope calibration, authorization-safe artifacts, optional visual companion |
| `writing-plans` | obra/superpowers | MIT (in folder) | Proportionate plans, useful interfaces and checks, authorized continuation; removed mandatory complete-code duplication and execution-choice gate. Native Codex implementation retained. |
| `writing-skills` (retired entrypoint) | obra/superpowers | MIT (in both legacy folders) | SKILL.md retired; legacy manuals, examples and scripts retained outside discovery in both runtime folders. Condensed authoring/evaluation guidance moved into addskill with copied MIT license; universal failure-first and automatic publication requirements removed. |
| `addskill` authoring resource | obra/superpowers writing-skills | MIT (`references/LICENSE` in both runtime folders) | Adapted discovery, structure and behavioral evaluation guidance into optional local authoring references; end-to-end addskill workflow remains homegrown. |
| `caveman` | Community token-compression pattern (viral skill, author attribution unclear) | Reimplemented here | Intensity tiers, clarity carve-outs, persistence and built-in session cleanup; removed unsupported savings claim and duplicated kernel digest. Explicit prose and scoped code-diff cleanup remain available through existing routes. |
| `writing` | Wikipedia "Signs of AI writing" tell catalog (CC BY-SA 4.0); `unslop` in [cursor/plugins pstack](https://github.com/cursor/plugins/tree/main/pstack) (Lauren Tan, MIT); Hermes Agent `purposeful-writing` (Nous Research, MIT); [petergyang/no-ai-slop](https://github.com/petergyang/no-ai-slop) (Peter Yang, MIT); [ItsssssJack/SlopMonster](https://github.com/ItsssssJack/SlopMonster) (MIT) | Notices in folder (`NOTICE.md`); our text MIT | Consolidated outward-facing prose and explicit cleanup, preserving optional pattern/provenance resources; patterns 35-45 and edit restraint from no-ai-slop, pattern 31 rulings from Corewise.Academy plain-words (2026-07-18). User voice overrides style defaults; ordinary chat uses Caveman, drafting needs no review verdict. Kernel now routes to skills instead of duplicating the digest. |
| `refine` | Concept from [PrimeIntellect-ai/prime-agent](https://github.com/PrimeIntellect-ai/prime-agent) Continual Harness `/refine` (MIT); no code or text vendored | Reimplemented here | Cause-specific diagnosis, narrow scope, static validation for nonbehavioral fixes and baseline/candidate evaluation for material changes; delegates to recall/addskill, with separate publication authority. Material-change record informed by [RSI survey](https://arxiv.org/html/2609.11873v1), in original wording. Local acceptance, later use and measured benefit remain distinct; both runtime evaluation resources stay identical and self-contained. |
| `long-horizon` | Concept from [AMAP-ML/LongHorizon-Harness](https://github.com/AMAP-ML/LongHorizon-Harness) (MIT); no code or text vendored | Reimplemented here | Durable manager/executor/auditor rounds, frozen pre-dispatch audit brief, actual dirty/untracked artifact identity, verdict triple, fresh context and final integrated audit. Default thresholds trigger reassessment; explicit budgets bind. Runtime model/tool exposure and user choices govern dispatch; no inherited-context substitute for independent audit. |

## Homegrown (this repo)

`addskill`, `enhance-prompt`,
`forge-repo-ui-skill`, `handoff-audit`, `impartial-review`, `init-project`, `lab`,
`merge`, `optimize-context`, `recall`, `sync-starter`,
`why`.

Homegrown skills are MIT, same as the repo (see the root `LICENSE`).

`perf-loop` now has a Claude entrypoint adapted from the repository's native Codex workflow,
with the same three domain references and measurement gates. Dispatch remains runtime-specific.
The full 36-name maintenance ledger and retained behaviors are in
[`docs/research/2026-09-14-skill-parity-changes.md`](../../docs/research/2026-09-14-skill-parity-changes.md).

`forge-repo-ui-skill` is an original synthesis workflow. It researches linked
third-party sources as untrusted inputs but does not vendor their skill text,
scripts, datasets, licenses, or configuration.
