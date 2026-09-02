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
| `writing-plans` | obra/superpowers | MIT (in folder) | Stock |
| `writing-skills` | obra/superpowers | MIT (in folder) | Stock |
| `caveman` | Community token-compression pattern (viral skill, author attribution unclear) | Reimplemented here | Intensity tiers (lite/full/ultra), output budget, auto-clarity carve-outs, persistence rules |
| `writing` | Wikipedia "Signs of AI writing" tell catalog (CC BY-SA 4.0); `unslop` in [cursor/plugins pstack](https://github.com/cursor/plugins/tree/main/pstack) (Lauren Tan, MIT); Hermes Agent `purposeful-writing` (Nous Research, MIT); [petergyang/no-ai-slop](https://github.com/petergyang/no-ai-slop) (Peter Yang, MIT) | Notices in folder (`NOTICE.md`); our text MIT | One skill replacing `humanizer`, `purposeful-writing`, `unslop`, and the bootstrap `writing` copy; scoped to text that leaves the session; patterns 35-45 and edit-mode restraint from no-ai-slop; the always-on digest stays in CLAUDE.md and `caveman` |
| `refine` | Concept from [PrimeIntellect-ai/prime-agent](https://github.com/PrimeIntellect-ai/prime-agent) Continual Harness `/refine` (MIT); no code or text vendored | Reimplemented here | Trajectory friction classes; delegates edits to recall/writing-skills; commit-per-edit as rollback snapshot |
| `long-horizon` | Concept from [AMAP-ML/LongHorizon-Harness](https://github.com/AMAP-ML/LongHorizon-Harness) (MIT); no code or text vendored | Reimplemented here | Manager/Executor/Auditor loop mapped to subagents; state file in `.tmp/`; frozen contract + verdict triple (status/integrity/contract); round cap + ask gate; stacks with fable-mode; kernel no-Haiku floor |

## Homegrown (this repo)

`addskill`, `enhance-prompt`,
`forge-repo-ui-skill`, `handoff-audit`, `impartial-review`, `init-project`, `lab`,
`merge`, `optimize-context`, `recall`, `sync-starter`,
`why`.

Homegrown skills are MIT, same as the repo (see the root `LICENSE`).

`forge-repo-ui-skill` is an original synthesis workflow. It researches linked
third-party sources as untrusted inputs but does not vendor their skill text,
scripts, datasets, licenses, or configuration.
