# Codex Skill Compatibility

## Skill ownership

Codex reads maintained native skills directly from `.agents/skills/<name>/SKILL.md`. They do not import Claude workflow bodies. `.agents/skill-modes.json` declares `native`, `adapter`, or `disabled`; omitted names retain legacy adapter behavior. Legacy `skillOverrides: off` remains disabled. The sync script validates native metadata and local Markdown references, preserves native files, and edits only marked generated adapters. Move a maintained skill outside discovery explicitly before disabling it.

The table below describes runtime capability, not file ownership or current enablement. Native workflows can still require tools or explicit action authorization. Resolve native resources from the real native skill directory; resolve adapter resources from the Claude source. Use the built-in `skill-creator` for Codex skill authoring; `writing-skills` is disabled for Codex.


`.claude/skills/` remains Claude's source. An adapter exposes a workflow; it does not prove every runtime capability exists.

`long-horizon` is a standalone Codex skill maintained in `.agents/skills/long-horizon/SKILL.md`.
It does not load Claude's workflow. The synchronizer explicitly preserves it; edit it directly.
Its capability-gated classification still requires fresh independent agents.

- **Native**: direct mapping.
- **Adapted**: Codex paths, approvals, or UI substitutions.
- **Capability-gated**: requires a currently exposed tool.
- **Claude-only**: no faithful Codex implementation.
- **Dangerous**: explicit authorization required for Git, deploy, migration, publish, or persistent side effects.

| Status | Skills |
|---|---|
| Native | `babysit-ci`, `brainstorming`, `bro`, `caveman`, `enhance-prompt`, `forge-repo-ui-skill`, `handoff-audit`, `recall`, `refine`, `session-hub`, `unslop`, `verify-this`, `writing`, `writing-plans` |
| Adapted | `addskill`, `astra-review`, `automate-me`, `claude-review`, `codex-review`, `fable-mode`, `init-project`, `lab`, `optimize-context`, `sync-starter`, `writing-skills` |
| Capability-gated | `advocate`, `arena`, `dare`, `impartial-review`, `long-horizon`, `why`, `wow-loop` |
| Dangerous | `adopt-repo`, `merge` |
| Claude-only | None in the starter source set. |

`advocate`, `arena`, `dare`, `impartial-review`, `long-horizon`, and `why` require fresh independent context; do not replace them with self-review and call it equivalent. `automate-me` from Codex mines `~/.codex/sessions/` instead of `~/.claude/projects/`, scoped to the current project only. `wow-loop` additionally requires screenshot capture; without it, say so rather than substituting a code read for a visual verdict. `merge` becomes session-wide only after explicit `$merge` or an unambiguous auto-merge request. `claude-review` is cross-vendor only from Codex; it must fail closed unless Claude CLI proves subscription routing and it never opts into paid usage. `codex-review` and `astra-review` from the Codex runtime lose their cross-vendor property (reviewer shares the author's vendor); it still provides fresh context, but say so instead of claiming vendor independence. The native `impartial-review` uses exposed collaboration tools and fits its reviewer coverage to actual capacity; if those tools are unavailable, it reports the missing independent check. Reviewers remain read-only leaves. Current system, developer, sandbox, approval, and user instructions win. Resolve canonical resources from `.claude/skills/<name>/` and never claim a gated workflow ran unless its tools were used.

`node .claude/scripts/test-codex-contract.mjs` verifies that every active skill has exactly one classification and that Codex routing metadata stays within its context budget.
