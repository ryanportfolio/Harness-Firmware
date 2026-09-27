# Claude Code Guidelines

> Kernel rules. Read first. Cross-cutting only. Topical detail lives in `.claude/reference/`.

<!-- STARTER TEMPLATE: run /init-project to configure the FILL IN sections, then delete this note. -->

## What this project is

<!-- FILL IN (via /init-project): two or three sentences — what this is and who it serves; a short "won't compromise on" list; optional glossary of terms the team uses. Cap ~10 lines: this file loads every turn, and direction earns its weight only while it stays short. A model that knows what the product refuses to compromise on tests for it without being told. -->

## Default prose mode: caveman ultra

Invoke the `caveman` skill at **ultra** at session start. Applies to all prose replies, this and every future session.

- Code, commits, PRs, file contents, symbols, API names, error strings stay normal, never abbreviated.
- Honor the skill's auto-clarity carve-outs: security warnings, irreversible-action confirmations, ambiguous multi-step sequences → plain prose, then resume.

## Always-on cleanup

Caveman covers chat replies only. Anything written to a file or for another reader (docs, READMEs, UI copy, emails, commit messages, PR text) uses the `writing` skill in normal prose. Preserve facts, caveats, exact quotations, code and identifiers.

## CRITICAL: Verification

<!-- FILL IN (via /init-project): what can this sandbox verify? Installs/builds/type-checks meaningful? Can the user reach a dev server you start? What is the AUTHORITATIVE signal (CI, deploy log, local tests)? -->

Defaults until configured:

- Inspect logs / run scripts / read code yourself before claiming anything works.
- Never claim visual/UI verification you didn't actually perform.
- Can't run the authoritative check → flag the risk plainly, don't claim it passes.
- Visual/UI checks: headed Chrome on the real GPU, launched through `launchPlacedChrome()` (`scripts/lib/launch-chrome.mjs`). Never headless (WebGL falls back to the CPU), never minimized (rAF drops to 1 fps). Pass this rule into every subagent prompt that does browser work.
- Parallel or subagent browser work: each agent opens its own browser through `mcp__playwright-iso__*` (`--isolated`, any number at once) or `launchPlacedChrome()`. Never the shared playwright plugin or the app's Browser pane, which hold one browser and deadlock a second user. Detail: `.claude/reference/pitfalls.md`.

## Core principles

- Plan before acting. Break large refactors into atomic steps.
- Reproduce bugs before fixing them.
- Scope discipline: No unrequested refactors, features, abstractions, or extra coding. Minimum complexity for the task at hand; don't regress performance.
- Solve generally. Never hard-code to pass specific tests. If a test or requirement is wrong, say so rather than work around it.
- Scratch work → `.tmp/` (gitignored). Promote to `scripts/` if reusable; otherwise delete.
- Durable project knowledge → `.claude/reference/` via `/recall save` (committed, travels to every machine and sandbox). Standing truths only: moments (PR numbers, branch names, task status, tool-version snapshots) rot and don't get saved. `/recall` and `.claude/reference/` replace Claude Code's built-in auto memory, which stays off (`"autoMemoryEnabled": false` in `.claude/settings.json`).
- Welcome correction. Confident-sounding mistakes happen; don't defend wrong answers. The user can challenge a recommendation with `/why`.
- Restraint is a feature. New kernel rules, skills, and reference entries must earn their place; prefer pruning stale content over accreting. More ≠ better; complex ≠ complicated. This file loads every turn: keep cross-cutting safety and process rules here, move area-specific detail to `.claude/reference/`, and never restate what the harness already injects (skills list, environment block, tool docs). See `/optimize-context`.

## Subagents

- Omit `model` on subagent calls unless the user names one. The default is `CLAUDE_CODE_SUBAGENT_MODEL` when set, else the session model.

## Git: push on completion

- "Complete" = the requested change finished and verified to this environment's limits. On Complete: commit, push, and open or update the PR. Mid-task or exploratory work is NOT a commit trigger.
- Stage intentionally. Never blanket-commit unrelated changes.
- Before opening a PR, check for an existing one (`gh pr list --head <branch>`) and push to that instead.
- Merge PRs with **squash** by default (`gh pr merge --squash`); merge-commit or rebase only when the user explicitly asks.
- Never force-push or run destructive git operations without an explicit request.
- End commit messages with the standard `Co-Authored-By:` trailer.
- PowerShell quoting trap: embedded `"` inside a here-string argument gets mangled en route to native exes (git/gh) and splits the argument. For multiline commit messages / PR bodies, write the text to a `.tmp/` file and use `git commit -F <file>` / `gh pr create --body-file <file>`, or keep the message free of double quotes.

## Environment & deploy target

<!-- FILL IN (via /init-project): where the app runs (host, DB, secrets); install policy (can sessions run npm/pip for app-runtime deps?); migration policy; anything that ALWAYS requires user action. -->

Defaults until configured: ask before installing app-runtime dependencies; provide migrations as copy/paste-ready artifacts rather than running them blind.

## Project reference library

Topical reference lives in `.claude/reference/`. Consult BEFORE non-trivial work in an unfamiliar area: `/recall <topic>` or read directly.

| File | Covers |
|---|---|
| `secrets.md` | Env var names + purpose |
| `architecture.md` | System flow, auth, state |
| `pitfalls.md` | Accumulated gotchas |
| `commands.md` | Build / dev / test commands |
| `tech-stack.md` | Non-default picks + why |
| `deployment.md` | Deploy target, artifacts |

New quirk bites → save it to `.claude/reference/pitfalls.md` before the task ends, without asking, when it cost a retry, a backed-out change, or a user correction and its cause is confirmed. Amend an existing entry over adding one. Other reference edits stay behind `/recall save`.

## Codex compatibility

Every skill in `.claude/skills/` has a standalone Codex version in `.agents/skills/`, registered `native` in `.agents/skill-modes.json`, or is registered `disabled` when it needs Claude-only tools. Adding or editing a skill updates its Codex version in the same change, with tools translated per `.agents/codex-tools.md`; never ship a generated adapter. Then run `node .claude/scripts/sync-codex-skills.mjs --baseline <name>` to record the reviewed Claude source, and `node .claude/scripts/sync-codex-skills.mjs --check` (CI fails on drift or a missing registration). `AGENTS.md` owns Codex runtime safety.
