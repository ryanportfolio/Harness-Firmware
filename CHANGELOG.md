# changelog

All notable changes to this project are documented here.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and
this project aims at [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Version boundaries before 1.2.0 are reconstructed from git history rather than
release tags, so the grouping is approximate. Anything older than 1.0.0 is
condensed.

## [Unreleased]

### Added

- `scripts/lib/launch-chrome.mjs`: headed Chrome launcher that puts the
  window on a display the operator is not using and hands the keyboard
  back, so the real-GPU browser rule stops interrupting them.
- `refine` skill: post-task pass that mines the session for friction and
  commits the smallest edit that prevents a repeat (concept port of
  prime-agent's Continual Harness).
- `long-horizon` skill: Manager/Executor/Auditor rounds with audit-gated
  durable state for tasks bigger than one context window (concept port of
  AMAP-ML's LongHorizon-Harness).
- `writing` skill: one skill for text that leaves the session (docs,
  READMEs, site and UI copy, emails) and for editing or auditing a draft
  for AI tells. Adds the rhetoric patterns from petergyang/no-ai-slop
  (throat-clearing openers, faux-insight setups, colon reveals, kickers)
  and its edit-mode restraint (minimum effective edit, keep real hedges).

### Changed

- Thirteen Codex skills are maintained as standalone workflows, with native planning,
  review, authorization, and recovery rules. Claude workflows remain unchanged.
- `.agents/skill-sources.json` declares standalone ownership independently of Claude
  settings. Sync preserves authored content; a read-only copy checker detects drift
  in explicitly selected personal skill roots.

- `README.md`: the safety model section became "what's different here", the
  template's differentiators; the safety rules moved to `CONTRIBUTING.md`
  beside the PR checklist that enforces them.
- `CLAUDE.md`, `caveman`, `session-start.sh`: the always-on core-tells
  digest now points at `writing/patterns.md` instead of the removed
  `unslop` skill.

### Removed

- `humanizer`, `purposeful-writing`, `unslop` skills and the
  `bootstrap/machine/home-claude/skills/writing` copy, folded into
  `writing`. The always-on digest in `CLAUDE.md` and `caveman` is
  unchanged.

## [1.2.0] - 2026-07-25

### Changed

- Renamed the project to **Harness Firmware**. The name describes what the
  layer configures: the agent harness (Claude Code, Codex), not a model. The
  repository URL is unchanged. Machine identifiers (plugin `name`, skill
  namespaces) are unchanged so existing installs keep working.
- Restructured `README.md` around what the layer is, how to install it, and
  what it costs to keep loaded.
- `/init-project` now asks which prose mode a project wants instead of assuming
  silently. `caveman ultra` remains the inherited default; `lite`, `full`, and
  `normal` are one answer away, and `README.md` documents changing it later.
  The skill also offers a minimal skill preset for projects that want a small
  always-loaded surface.

### Added

- POSIX bootstrap script, so setup works from a plain shell without PowerShell.
- `doctor.mjs`, a preflight check for a checkout: the SessionStart hook is
  wired, skill frontmatter parses, generated Codex adapters are in sync, the
  reference library is complete, plugin manifests parse, no `FILL IN` markers
  survived, and the always-loaded context weight is reported.
- Community files: `CHANGELOG.md`, `CONTRIBUTING.md`, and GitHub issue
  templates for bug reports and skill proposals.

### Fixed

- Frontmatter parsers in `sync-codex-skills.mjs` and `test-codex-contract.mjs`
  did not recognize `>-` block scalars, which made the `perf` skill
  undiscoverable in Codex and hid its description-length violation from CI.
  Both parsers are fixed and the `perf` description now fits the 240-char
  contract limit.

## [1.1.3]

### Fixed

- `/sync-starter` guards the spawn-critical surface (`bootstrap/`,
  `.claude/hooks/`, `settings.json`) from direct-to-main commits and ships the
  post-squash branch re-sync fix to plugin installs.

## [1.1.2]

### Added

- `perf` skill: a measurement rig for web performance work, so changes to
  bundling, preload hints, and lazy loading get measured instead of assumed.
- Steering levers adopted from `mattpocock/skills` across the core skills.
- PASS/FAIL verdict step in the `writing` skill.
- The global `writing` skill is now tracked by the home-claude bootstrap.

### Fixed

- The `merge` skill re-syncs the session branch after each squash merge, so a
  commit pushed after a merge is no longer stranded off `main`.
- The bootstrap `writing` skill is ASCII-only, which unbreaks validation on
  `main`.
- Restored the squash-merge default and the one-open-PR reuse rule in the
  `merge` skill.

### Changed

- `CLAUDE.md` allows plan-mode popups (`ExitPlanMode`, `AskUserQuestion`).

## [1.1.0]

### Added

- Unified project generator for spawning a configured repo.
- Visual project creator UI (`new-claude-project-ui`).
- Codex hardening for spawned projects: `AGENTS.md` owns Codex runtime safety
  and tool translation, and generated adapters live in `.agents/skills/`.
- Pitfall entry: verify local preview servers before trusting them.

### Changed

- Trimmed the `CLAUDE.md` kernel down to cross-cutting rules; topical detail
  moved to `.claude/reference/`.
- Pointed template references at the renamed repository.

## [1.0.0]

### Added

- `fable-mode` skill for layered work with dependent steps and
  verification-sensitive handoff.
- `purposeful-writing` skill, folding in the best of `humanizer`.

### Fixed

- `addskill` lands a new skill on `main` via the merge flow instead of leaving
  it on a branch.

## [0.x]

Earlier history condensed: the initial kernel, the on-demand skill system,
committed project memory under `.claude/reference/`, session hooks, the Codex
skill sync scripts, and the first pass at context-weight accounting.
