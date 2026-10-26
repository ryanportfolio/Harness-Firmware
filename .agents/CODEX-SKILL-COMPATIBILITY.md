# Codex Skill Compatibility

`.claude/skills/` is Claude's source; `.agents/skills/` holds Codex's own maintained versions. Every skill has a native Codex version or is disabled; there are no generated adapters. A Codex skill exposes a workflow; it does not prove every runtime capability exists.

`.agents/skill-modes.json` declares `native` or `disabled` for every skill; `adapter` is no
longer valid, and the sync check warns about an unregistered Claude skill. Maintain native skills directly in `.agents/skills/<name>/`;
they do not load Claude workflow bodies. Sync preserves native content and validates
metadata and local references. Legacy `skillOverrides: off` remains disabled. Move a
maintained skill outside discovery explicitly before disabling it. Ownership is separate
from the capability classifications below. `writing-skills` and `unslop` entrypoints are
retired in both runtimes. Use `addskill` for create/import/update/install; it uses built-in
`skill-creator` as the Codex authoring mechanism.

Personal installations are explicit copies of these sources. See `docs/codex-skills.md`
for comparison, backup, reconciliation, and discovery checks.

- **Native**: direct mapping.
- **Adapted**: Codex paths, approvals, or UI substitutions.
- **Capability-gated**: requires a currently exposed tool.
- **Claude-only**: no faithful Codex implementation.
- **Dangerous**: explicit authorization required for Git, deploy, migration, publish, or persistent side effects.

| Status | Skills |
|---|---|
| Native | `addskill`, `babysit-ci`, `brainstorming`, `bro`, `caveman`, `enhance-prompt`, `external-review`, `fable-mode`, `forge-repo-ui-skill`, `handoff-audit`, `recall`, `refine`, `servers`, `session-hub`, `showpiece`, `wrapup`, `writing`, `writing-plans` |
| Adapted | `apply-firmware`, `astra-review`, `claude-review`, `codex-review`, `deep-plan`, `init-project`, `lab`, `optimize-context`, `opus-fullreview`, `sync-starter` |
| Capability-gated | `advocate`, `arena`, `cache-loop`, `conversion-ux`, `dare`, `design-prototypes`, `impartial-review`, `long-horizon`, `motion-design`, `perf-loop`, `product-walkthrough`, `redesign-concepts`, `security-loop`, `seo-loop`, `ui-quality`, `why`, `wow-loop` |
| Dangerous | `adopt-repo`, `merge` |
| Claude-only | `astra-fullreview`, `codex-fullreview`, `codex-image-gen`, `coordinate`, `gauntlet`, `long-horizon-workflows` |

`advocate`, `arena`, `dare`, `impartial-review`, `long-horizon`, and `why` require fresh independent context; do not replace them with self-review and call it equivalent. `wow-loop` is maintained as a native Codex skill with durable review state and fresh-context critics; its capability-gated classification remains unchanged. It additionally requires screenshot capture for visual work; without it, say so rather than substituting a code read for a visual verdict. `claude-review` and `opus-fullreview` are cross-vendor only from Codex; `opus-fullreview` runs the Claude `impartial-review` as Manager through Claude CLI and is Codex-only, since a Claude session uses `impartial-review` directly; it must fail closed unless Claude CLI proves subscription routing and it never opts into paid usage. `codex-review` and `astra-review` from the Codex runtime lose their cross-vendor property (reviewer shares the author's vendor); it still provides fresh context, but say so instead of claiming vendor independence. `impartial-review` dispatched from Codex has the same limit; when that session exposes no agent tools, separate read-only `codex exec` processes with bounded concurrency are the fallback that keeps reviewer context fresh, and self-review is not; read its gate as agent tools or an authenticated Codex CLI. Those child processes are leaf reviewers and must not dispatch a review of their own. `external-review` is a Codex-only, single-context leaf review invoked explicitly by the `codex-review` and `astra-review` launchers in both runtimes; it needs no agent tools, and one reviewer's fresh context is its designed coverage, not a gap. `codex-fullreview` and `astra-fullreview` are Claude launchers that run `impartial-review` inside `codex exec`; Claude-only rows are disabled for Codex and need no port, so from Codex use `impartial-review` directly. `gauntlet` is Claude-only: it stops for Claude's `/merge`, and run from Codex its arena judge would share the orchestrator's vendor. `coordinate` is Claude-only because it reads and messages other Claude Code sessions through the desktop app's session tools. Current system, developer, sandbox, approval, and user instructions win. Resolve resources from the Codex skill directory and never claim a gated workflow ran unless its tools were used.

`conversion-ux` audits need a way to render the screen at phone and desktop widths and capture it; without one, audit from supplied screenshots or code and list what could not be seen, never claim a visual verdict.

`ui-quality` audits need headed Chrome and Node with `axe-core` and `playwright-core` installable for the probe; without them, audit from code and supplied screenshots, label each finding as not measured, and list what could not be checked.

`motion-design` and `product-walkthrough` verify motion in headed Chrome on the real GPU with `playwright` or `playwright-core` installable, plus process and network approval for the local server and browser launches. Without a browser, say that motion, stills and exports were not checked rather than judging them from code. `product-walkthrough` builds chapters with parallel agents when the session exposes agent tools; without them it builds one chapter after another in the main thread and says so.

`merge` is user-invoked only (`$merge`) and pushes, opens PRs and squash-merges, so it is classified Dangerous. Its Codex version swaps the Claude version's Codex loop for Claude Opus through Claude CLI: `opus-fullreview` for round one, then `opus-review` reruns (or `claude-review` with Opus when `opus-review` is not installed), each under its own fail-closed subscription preflight. Its self-review uses three fresh agents where the Claude version uses four; with no exposed agent tools it says so and skips to the Opus loop, which still runs in full.

`design-prototypes` and `redesign-concepts` need an exposed image generation tool; without one, say so and offer the prompts instead of drawing images in code. `codex-image-gen` is Claude-only: it drives Codex's image tool through `codex exec` from Claude Code, while a Codex session calls its built-in image tool directly.

`perf-loop` is a standalone Codex skill requiring fresh independent measurement and regression reviewers, plus a working measurement path for each performance claim. Benchmarks and competing resource-heavy work run serially on shared hardware. Missing capabilities permit scoped progress but leave the full verification gate incomplete.

`seo-loop` needs Node 20 or newer, network access to the site being measured, and `npx` access to GitHub for willaicite. It keeps a round only after fresh independent integrity and regression reviewers; without agent tools it reports that gap and does not count self-review as the gate. Visual regression checks need headed Chrome; without it, say rendered pages were not checked.

`security-loop` is a standalone Codex skill that needs exposed agent tools for every hunter, critic, and verifier; without them it stops after collecting signals rather than substituting self-review. Its cross-vendor check runs through Claude CLI under `claude-review`'s fail-closed subscription preflight and is reported as unavailable when that preflight fails. Owner-local checks run only first-party code in a fresh worktree with an empty environment; untrusted code stays source-only on this machine.

`cache-loop` can inspect build output and HTTP responses without a browser. Claims about browser reuse require a working measurement method for the stated browser. It keeps browser and CDN evidence separate and does not authorize publishing, deployment, or destructive cache purges.

`node .claude/scripts/test-codex-contract.mjs` verifies that every active skill has exactly one classification and that Codex routing metadata stays within its context budget.

`unslop` and `writing-skills` are retired from both discovery catalogs. Route cleanup to
Caveman/Writing and authoring to addskill. Their leftover resource folders are no longer shipped.
`node .claude/scripts/sync-codex-skills.mjs --check` warns when a retired name regains a
`SKILL.md`.
