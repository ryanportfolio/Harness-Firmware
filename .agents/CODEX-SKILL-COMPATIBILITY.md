# Codex Skill Compatibility

`.claude/skills/` remains Claude's source. An adapter exposes a workflow; it does not prove every runtime capability exists.

Standalone Codex ownership is declared in `.agents/skill-sources.json`. Maintain those
skills directly in `.agents/skills/<name>/`; they do not load Claude's workflow. Sync
preserves them independently of Claude's source and settings. Other skills remain generated
adapters. Ownership is separate from the capability classifications below.

Personal installations are explicit copies of these sources. See `docs/codex-skills.md`
for comparison, backup, reconciliation, and discovery checks.

- **Native**: direct mapping.
- **Adapted**: Codex paths, approvals, or UI substitutions.
- **Capability-gated**: requires a currently exposed tool.
- **Claude-only**: no faithful Codex implementation.
- **Dangerous**: explicit authorization required for Git, deploy, migration, publish, or persistent side effects.

| Status | Skills |
|---|---|
| Native | `addskill`, `babysit-ci`, `brainstorming`, `bro`, `caveman`, `enhance-prompt`, `fable-mode`, `forge-repo-ui-skill`, `handoff-audit`, `recall`, `refine`, `session-hub`, `verify-this`, `writing`, `writing-plans`, `writing-skills` |
| Adapted | `astra-review`, `automate-me`, `claude-review`, `codex-review`, `init-project`, `lab`, `optimize-context`, `sync-starter` |
| Capability-gated | `advocate`, `arena`, `dare`, `impartial-review`, `long-horizon`, `why`, `wow-loop` |
| Dangerous | `adopt-repo`, `merge` |
| Claude-only | None in the starter source set. |

`advocate`, `arena`, `dare`, `impartial-review`, `long-horizon`, and `why` require fresh independent context; do not replace them with self-review and call it equivalent. `automate-me` from Codex mines `~/.codex/sessions/` instead of `~/.claude/projects/`, scoped to the current project only. `wow-loop` additionally requires screenshot capture; without it, say so rather than substituting a code read for a visual verdict. `merge` becomes session-wide only after an explicit request for persistent auto-merge. A plain merge request, including `$merge` without that intent, applies to the current work only. `claude-review` is cross-vendor only from Codex; it must fail closed unless Claude CLI proves subscription routing and it never opts into paid usage. `codex-review` and `astra-review` from the Codex runtime lose their cross-vendor property (reviewer shares the author's vendor); it still provides fresh context, but say so instead of claiming vendor independence. `impartial-review` dispatched from Codex has the same limit; when that session exposes no agent tools, separate read-only `codex exec` processes with bounded concurrency are the fallback that keeps reviewer context fresh, and self-review is not; read its gate as agent tools or an authenticated Codex CLI. Those child processes are leaf reviewers and must not dispatch a review of their own. Current system, developer, sandbox, approval, and user instructions win. Resolve generated-adapter resources from `.claude/skills/<name>/` and standalone resources from their Codex skill directory and never claim a gated workflow ran unless its tools were used.

`node .claude/scripts/test-codex-contract.mjs` verifies that every active skill has exactly one classification and that Codex routing metadata stays within its context budget.
