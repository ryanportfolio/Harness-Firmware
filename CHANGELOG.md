# changelog

All notable changes to this project are documented here.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and
this project aims at [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Version boundaries before 1.2.0 are reconstructed from git history rather than
release tags, so the grouping is approximate. Anything older than 1.0.0 is
condensed.

## [1.2.0] - 2026-07-25

### Changed

- Renamed the project to **Harness Firmware**. The name describes what the
  layer configures: the agent harness (Claude Code, Codex), not a model. The
  repository URL is unchanged. Machine identifiers (plugin `name`, skill
  namespaces) are unchanged so existing installs keep working.
- Restructured `README.md` around what the layer is, how to install it, and
  what it costs to keep loaded.
- `/init-project` now asks before turning on a prose mode instead of assuming
  one, and offers a minimal skill preset for projects that want a small
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
