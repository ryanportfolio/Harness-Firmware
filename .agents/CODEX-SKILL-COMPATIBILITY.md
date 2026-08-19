# Codex Skill Compatibility

`.claude/skills/` remains Claude's source. An adapter exposes a workflow; it does not prove every runtime capability exists.

- **Native**: direct mapping.
- **Adapted**: Codex paths, approvals, or UI substitutions.
- **Capability-gated**: requires a currently exposed tool.
- **Claude-only**: no faithful Codex implementation.
- **Dangerous**: explicit authorization required for Git, deploy, migration, publish, or persistent side effects.

| Status | Skills |
|---|---|
| Native | `brainstorming`, `caveman`, `enhance-prompt`, `forge-repo-ui-skill`, `handoff-audit`, `humanizer`, `purposeful-writing`, `recall`, `refine`, `unslop`, `writing-plans` |
| Adapted | `addskill`, `codex-review`, `fable-mode`, `init-project`, `lab`, `optimize-context`, `sync-starter`, `writing-skills` |
| Capability-gated | `advocate`, `impartial-review`, `long-horizon`, `why`, `wow-loop` |
| Dangerous | `merge` |
| Claude-only | None in the starter source set. |

`advocate`, `impartial-review`, `long-horizon`, and `why` require fresh independent context; do not replace them with self-review and call it equivalent. `wow-loop` additionally requires screenshot capture; without it, say so rather than substituting a code read for a visual verdict. `merge` becomes session-wide only after explicit `$merge` or an unambiguous auto-merge request. `codex-review` from the Codex runtime loses its cross-vendor property (reviewer shares the author's vendor); it still provides fresh context, but say so instead of claiming vendor independence. Current system, developer, sandbox, approval, and user instructions win. Resolve canonical resources from `.claude/skills/<name>/` and never claim a gated workflow ran unless its tools were used.

`node .claude/scripts/test-codex-contract.mjs` verifies that every active skill has exactly one classification and that Codex routing metadata stays within its context budget.
