# Skill Provenance

Where each skill came from, its license, and what this repo changed. Not loaded
into context; it is reference for maintainers and public users.

**Maintenance rule:** when you materially change a forked skill, update its
"Our deltas" cell here. When adding a third-party skill, add a row and keep its
LICENSE/NOTICE files in the skill folder.

## Forked / third-party

| Skill | Upstream | License | Our deltas |
|---|---|---|---|
| `brainstorming` | [obra/superpowers](https://github.com/obra/superpowers) (Jesse Vincent) | MIT (in folder) | Two-lane scope calibration, authorization-safe artifacts, optional visual companion; added an original shared-code refactoring reference for caller compatibility and scoped design decisions. |
| `writing-plans` | obra/superpowers | MIT (in folder) | Proportionate plans, useful interfaces and checks, authorized continuation; removed mandatory complete-code duplication and execution-choice gate. Native Codex implementation retained. Added an original shared-code refactoring reference for staged changes and caller verification. |
| `writing-skills` (retired entrypoint) | obra/superpowers | MIT (in both legacy folders) | SKILL.md retired; legacy manuals, examples and scripts retained outside discovery in both runtime folders. Condensed authoring/evaluation guidance moved into addskill with copied MIT license; universal failure-first and automatic publication requirements removed. |
| `addskill` authoring resource | obra/superpowers writing-skills | MIT (`references/LICENSE` in both runtime folders) | Adapted discovery, structure and behavioral evaluation guidance into optional local authoring references; end-to-end addskill workflow remains homegrown. |
| `caveman` | Community token-compression pattern (viral skill, author attribution unclear) | Reimplemented here | Intensity tiers, clarity carve-outs, persistence and built-in session cleanup; removed unsupported savings claim and duplicated kernel digest. Explicit prose and scoped code-diff cleanup remain available through existing routes. |
| `writing` | Wikipedia "Signs of AI writing" tell catalog (CC BY-SA 4.0); `unslop` in [cursor/plugins pstack](https://github.com/cursor/plugins/tree/main/pstack) (Lauren Tan, MIT); Hermes Agent `purposeful-writing` (Nous Research, MIT); [petergyang/no-ai-slop](https://github.com/petergyang/no-ai-slop) (Peter Yang, MIT); [ItsssssJack/SlopMonster](https://github.com/ItsssssJack/SlopMonster) (MIT) | Notices in `.claude/skills/writing/NOTICE.md` (the Codex `writing` folder has no copy); our text MIT | Consolidated outward-facing prose and explicit cleanup, preserving optional pattern/provenance resources; patterns 35-45 and edit restraint from no-ai-slop, pattern 31 rulings from Corewise.Academy plain-words (2026-07-18). User voice overrides style defaults; ordinary chat uses Caveman, drafting needs no review verdict. Kernel now routes to skills instead of duplicating the digest. |
| `refine` | Concept from [PrimeIntellect-ai/prime-agent](https://github.com/PrimeIntellect-ai/prime-agent) Continual Harness `/refine` (MIT); no code or text vendored | Reimplemented here | Cause-specific diagnosis, narrow scope, static validation for nonbehavioral fixes and baseline/candidate evaluation for material changes; delegates to recall/addskill, with separate publication authority. Material-change record informed by [RSI survey](https://arxiv.org/html/2609.11873v1), in original wording. Pre-edit attribution, causal-link and active-lever checks, plus the observation-first diagnostic, informed by the `failure-mode-checklist` editor skill in [IQuestLab/ModularRSI](https://github.com/IQuestLab/ModularRSI) (CC BY-NC 4.0 for its research contributions); concept only, no text vendored. Local acceptance, later use and measured benefit remain distinct; both runtime evaluation resources stay identical and self-contained. |
| `long-horizon` | Concept from [AMAP-ML/LongHorizon-Harness](https://github.com/AMAP-ML/LongHorizon-Harness) (MIT); no code or text vendored | Reimplemented here | Durable manager/executor/auditor rounds, frozen pre-dispatch audit brief, actual dirty/untracked artifact identity, verdict triple, fresh context and final integrated audit. Default thresholds trigger reassessment; explicit budgets bind. Runtime model/tool exposure and user choices govern dispatch; no inherited-context substitute for independent audit. |
| `long-horizon-workflows` | Concept via this repo's `long-horizon` (itself a concept port of [AMAP-ML/LongHorizon-Harness](https://github.com/AMAP-ML/LongHorizon-Harness), MIT); no code or text vendored | Reimplemented here | Claude-only. Carries the `long-horizon` contract unchanged and runs each round's baseline, executor, inspector and judges as one `Workflow` tool script: audit prompts built only from script arguments, schema-enum verdicts, a run journal with resume, and a per-round judge count with rotating lenses. Added in #136. |
| `arena` | `arena` in [cursor/plugins pstack](https://github.com/cursor/plugins/tree/main/pstack) (Lauren Tan, "poteto") | MIT; attribution line in both SKILL.md files, no LICENSE file in folder | Ported in #76. Three same-model candidates from distinct angles (simplest, robustness-first, UX-first) replace the multi-vendor model table, with an optional Codex CLI candidate or judge; worktree or `.tmp/` isolation; neutral artifact-only judging that hides angle and vendor labels; explicit capacity and model choices. |
| `automate-me` | `automate-me` in cursor/plugins pstack (Lauren Tan); preference atoms and confidence scale from `workflow-from-chats` in [cursor/plugins cursor-team-kit](https://github.com/cursor/plugins/tree/main/cursor-team-kit) (Cursor) | MIT; attribution line in both SKILL.md files, no LICENSE file in folder | Ported in #76, atoms folded in via #77. Transcript mining scoped to the current project per runtime, authoring routed through addskill, `fable-mode` replaces `poteto-mode` as the output-shape example; contradicted atoms are never codified silently; explicit preference versus repetition and bounded evaluation. |
| `bro` | `bro` in cursor/plugins pstack (Lauren Tan) | MIT; attribution line in the Claude SKILL.md only, no LICENSE file in folder | Ported in #77. Added a keep-every-fact rule (facts, numbers and caveats stay; only vocabulary drops); the native Codex body also forbids redoing the task or changing standing style. |
| `babysit-ci` | `loop-on-ci` and `fix-ci` skills plus the `ci-watcher` agent in cursor/plugins cursor-team-kit (Cursor) | MIT; attribution line in both SKILL.md files, no LICENSE file in folder | Merged into one skill in #77. `gh pr checks` as source of truth, re-check after every push, never `--no-verify`; watch-only separated from fix/push authority, final green bound to the current PR head, no implied merge. |
| `verify-this` | `verify-this` in cursor/plugins cursor-team-kit (Cursor) | MIT; attribution line in the Claude SKILL.md only, no LICENSE file in folder | Ported in #77. Claim restated as an observable condition and acceptance criterion; exactly one of `VERIFIED`, `NOT VERIFIED`, `INCONCLUSIVE`; current-state, change and causal evidence rules with unique run identity and no manufactured baseline (#127); packaged `evidence-report.md` reference (#128, see below). |

## Homegrown (this repo)

`addskill`, `adopt-repo`, `advocate`, `astra-fullreview`, `astra-review`,
`claude-review`, `codex-fullreview`, `codex-review`, `dare`, `enhance-prompt`,
`external-review`, `fable-mode`, `forge-repo-ui-skill`, `handoff-audit`,
`impartial-review`, `init-project`, `lab`, `optimize-context`, `perf-loop`,
`recall`, `session-hub`, `showpiece`, `sync-starter`, `why`, `wow-loop`.

Homegrown skills are MIT, same as the repo (see the root `LICENSE`).

Runtime coverage follows `.agents/skill-capabilities.json`: `astra-fullreview`,
`codex-fullreview` and `long-horizon-workflows` are Claude-only, `external-review`
is Codex-only, and every other active skill ships in both runtimes. `recall` and
`why` share names with unrelated pstack skills; ours predate the pstack ports
(initial release, 2026-07-04) and do different jobs.

Third-party material folded into homegrown skills, all from
[cursor/plugins cursor-team-kit](https://github.com/cursor/plugins/tree/main/cursor-team-kit)
(MIT, Cursor) in #77:

- `impartial-review/strict-quality-rubric.md` (Claude only) is condensed from
  `thermo-nuclear-code-quality-review` and says so in its first paragraph.
- The `wow-loop` browser-discipline rules (Claude SKILL.md; Codex
  `references/visual-review.md`) come from `control-ui`: one structural action per
  step, a fresh screenshot before coordinate clicks, refreshed element refs, stable
  `data-*` page markers and CDP attach. The files carry no attribution line.
- The `caveman` `references/diff-cleanup.md` descends from a code-diff mode that #77
  folded into the retired `unslop` from `deslop`. #127 moved it into this reference
  in new wording; the current text shares no sentences with `deslop`.

The `evidence-report.md` references in `perf-loop`, `verify-this`, and `wow-loop`,
and the `shared-code-refactoring.md` references in `brainstorming`,
`external-review` (Codex only), `impartial-review`, and `writing-plans`, use concept-only inspiration from
[`michaelshimeles/skills` at `513f8a24aae6383b00356fa285144b1bc3730dc1`](https://github.com/michaelshimeles/skills/tree/513f8a24aae6383b00356fa285144b1bc3730dc1).
Both resources were authored here in original wording and packaged in both
runtimes. No upstream source text was copied; this attribution makes no claim
about the upstream repository's license.

`perf-loop` now has a Claude entrypoint adapted from the repository's native Codex workflow,
with the same three domain references and measurement gates. Dispatch remains runtime-specific.
The full 36-name maintenance ledger and retained behaviors are in
[`docs/research/2026-09-14-skill-parity-changes.md`](../../docs/research/2026-09-14-skill-parity-changes.md).
That ledger is a 2026-09-14 snapshot: it still lists `merge` (since removed from the
template) and predates `long-horizon-workflows` (#136), `external-review`,
`codex-fullreview` and `astra-fullreview` (#143).

`forge-repo-ui-skill` is an original synthesis workflow. It researches linked
third-party sources as untrusted inputs but does not vendor their skill text,
scripts, datasets, licenses, or configuration.

`.agents/skills/humanizer/patterns.md` is not a skill: it has no SKILL.md and no
manifest entry. It is left over from the `humanizer` skill that #103 merged into
`writing`, and its catalog derives from the Wikipedia "Signs of AI writing" guide
(CC BY-SA 4.0), the source already credited in the `writing` notice.
