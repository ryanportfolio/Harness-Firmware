# Claude Code Guidelines

> Kernel rules. Read first. Cross-cutting only. Topical detail lives in `.claude/reference/`.

<!-- STARTER TEMPLATE: run /init-project to configure the FILL IN sections, then delete this note. -->

## What this project is

<!-- FILL IN (via /init-project): two or three sentences — what this is and who it serves; a short "won't compromise on" list; optional glossary of terms the team uses. Cap ~10 lines: this file loads every turn, and direction earns its weight only while it stays short. A model that knows what the product refuses to compromise on tests for it without being told. -->

## Default prose mode: caveman ultra

Invoke the `caveman` skill at **ultra** at session start. Applies to all prose replies, this and every future session.

- Code, commits, PRs, file contents, symbols, API names, error strings stay normal, never abbreviated.

## Always-on cleanup

Caveman covers chat replies only. Anything written to a file or for another reader (docs, READMEs, UI copy, emails, commit messages, PR text) uses the `writing` skill in normal prose. Preserve facts, caveats, exact quotations, code and identifiers. No jargon, in chat or in files: say what a thing does in plain words instead of coining labels, internal codes or shorthand the reader hasn't seen. If a new term is unavoidable, define it the first time.

## CRITICAL: Verification

<!-- FILL IN (via /init-project): what can this sandbox verify? Installs/builds/type-checks meaningful? Can the user reach a dev server you start? What is the AUTHORITATIVE signal (CI, deploy log, local tests)? -->

Defaults until configured:

- Inspect logs / run scripts / read code yourself before claiming anything works.
- Never claim visual/UI verification you didn't actually perform.
- Can't run the authoritative check → flag the risk plainly, don't claim it passes.
- Visual/UI checks: headed Chrome on the real GPU, launched through `launchPlacedChrome()` (`scripts/lib/launch-chrome.mjs`). Never headless (WebGL falls back to the CPU), never minimized (rAF drops to 1 fps). Pass this rule into every subagent prompt that does browser work.
- Any number of subagents can run browsers in parallel: each launches its own Chrome through `launchPlacedChrome()` (needs `playwright` or `playwright-core` installed). The `mcp__playwright-iso__*` tools are one browser per session, shared by the main session and all its subagents (`--isolated` only keeps the profile in memory): use them from the main session or one subagent at a time. Never the shared playwright plugin or the app's Browser pane, which hold one browser and deadlock a second user.

## Core principles

- Plan before acting. Break large refactors into atomic steps.
- Reproduce bugs before fixing them.
- Scope discipline: No unrequested refactors, features, abstractions, or extra coding. Minimum complexity for the task at hand; don't regress performance.
- Reuse before writing: code already in this repo first, then the standard library or a platform feature, then an installed dependency, and only then new code. Never add a dependency to save a few lines.
- Bug fixes: find every caller of the function before editing, then fix the root cause once in the shared code instead of patching each caller.
- When two fixes in a row fail to clear the same failure (same test, same error), stop. Write down in one sentence the assumption both fixes share and test it directly before a third attempt. Never switch to a weaker check to get a pass. If the assumption is false, start the next fix from what is true. Loop skills with their own rule for repeated failures follow theirs.
- Code you move or merge keeps its error handling and validation.
- Never make a change smaller by cutting validation at trust boundaries, error handling that prevents data loss, security, or accessibility.
- No unit tests or type tests unless the user asks.
- A test or check that would still pass if the code returned nothing proves nothing. Before trusting one you wrote or have never seen fail, run it once on a case it must reject and watch it fail: missing or empty output, or, for a check that looks for something absent (a linter, secret scan or brand gate), a planted bad case.
- Don't silence the compiler, type checker or linter to make an error or warning go away: no `@ts-ignore`, `@ts-nocheck`, `as any`, `eslint-disable`, `#[allow(...)]`, `# type: ignore` or `# noqa`, and no turning a rule or strict mode off in config. Fix the cause. A suppression is right only when the tool is wrong about this code (a false positive, or a gap in third-party types); then scope it to the smallest unit the tool allows and name the tool's mistake in its comment or `reason`.
- Solve generally. Never hard-code to pass specific tests. If a test or requirement is wrong, say so rather than work around it. Never fake success: no placeholder results, and no fallback added only to silence an error. Fallbacks the product needs (older browsers, offline, missing media) are fine.
- Scratch work → `.tmp/` (gitignored). Promote to `scripts/` if reusable; otherwise delete.
- Durable project knowledge → `.claude/reference/` via `/recall save` (committed, travels to every machine and sandbox). Standing truths only: moments (PR numbers, branch names, task status, tool-version snapshots) rot and don't get saved. `/recall` and `.claude/reference/` replace Claude Code's built-in auto memory, which stays off (`"autoMemoryEnabled": false` in `.claude/settings.json`).
- Welcome correction. Confident-sounding mistakes happen; don't defend wrong answers. Weighty recommendations get a `/why` pressure-test before they're presented (caveman skill); the user can also run `/why` on any recommendation.
- Restraint is a feature. New kernel rules, skills, and reference entries must earn their place; prefer pruning stale content over accreting. More ≠ better; complex ≠ complicated. This file loads every turn: keep cross-cutting safety and process rules here, move area-specific detail to `.claude/reference/`, and never restate what the harness already injects (skills list, environment block, tool docs). See `/optimize-context`.

## Subagents

- Run independent work in parallel: when parts don't depend on each other's results or edit the same files (research across areas, separate reviews, changes to separate modules), start their subagents in one message instead of one after another. Keep dependent or overlapping work sequential, and give parallel writers separate files or worktrees.
- Pick the subagent model by task. A model the user names overrides this list.
  - Default: omit `model`. The subagent runs on `CLAUDE_CODE_SUBAGENT_MODEL` when set, else the session model. Use it for code changes that need design decisions, debugging, reviews, verification, browser or visual checks, security work, plans, and writing for people. When unsure, use this.
  - `sonnet`: scoped work that needs some reasoning and is easy to check. Web research and digests, triage of logs or test output, edits that repeat an existing pattern across files.
  - `haiku`: mechanical work with an exact spec. File and code searches, bulk renames and reformats, summaries of long output, extraction into a fixed format, counts and inventories. Haiku does what the prompt literally says, so spell out the scope.
  - A Sonnet or Haiku result that looks incomplete or wrong gets rerun with `model` omitted, not patched by hand.

## Git: push on completion

- "Complete" = the requested change finished and verified to this environment's limits. On Complete: commit, push, and open or update the PR. Mid-task or exploratory work is NOT a commit trigger.
- Stage intentionally. Never blanket-commit unrelated changes.
- Before opening a PR, check for an existing one (`gh pr list --head <branch>`) and push to that instead. Before opening or updating one, re-check the reference entries the change may have made stale (`recall`: `memory-audit.mjs --diff`).
- Merge PRs with **squash** by default (`gh pr merge --squash`); merge-commit or rebase only when the user explicitly asks.
- Never force-push or run destructive git operations without an explicit request.
- End commit messages with the standard `Co-Authored-By:` trailer.
- PowerShell quoting trap: embedded `"` inside a here-string argument gets mangled en route to native exes (git/gh) and splits the argument. For multiline commit messages / PR bodies, write the text to a `.tmp/` file and use `git commit -F <file>` / `gh pr create --body-file <file>`, or keep the message free of double quotes.

## Codex review on every PR

Nothing merges until the PR has been through `/codex-review` and its surviving findings are fixed or explicitly waived by the user. This applies to every merge path: a manual merge, `/merge`, `gh pr merge`, and squash-merges done by agents.

- **Run it automatically.** Opening or updating a PR is itself the trigger: run `/codex-review` in the same turn, without asking and without waiting for a merge request. Naming it as a next step and stopping does not count. In merge mode the `/merge` loop replaces this trigger; don't run a separate `/codex-review` on top of it.
- Sequence: open PR → `/codex-review` on the full PR diff against the default branch → verify each finding → fix confirmed BLOCKING and SHOULD-FIX findings → push → merge. Rerun only on the user's OK, because each run bills their Codex subscription. Typing `/merge` is that OK for every PR in the rest of the session.
- If Codex is unavailable (not logged in, CLI broken), say so and stop before merging. Never substitute a self-review and call it done.
- The review result goes in the handover: source attribution, findings that survived verification, and what was fixed.

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

Every skill in `.claude/skills/` has a standalone Codex version in `.agents/skills/`, registered `native` in `.agents/skill-modes.json`, or is registered `disabled` when it needs Claude-only tools. Adding or editing a skill updates its Codex version in the same change, with tools translated per `.agents/codex-tools.md`; never ship a generated adapter. For a `native` skill, once its port matches, run `node .claude/scripts/sync-codex-skills.mjs --baseline <name>` to record the reviewed Claude source; `disabled` skills skip this step. Then run `node .claude/scripts/sync-codex-skills.mjs --check`; it warns on drift or a missing registration, locally and in CI, and fails only on unreadable input. `AGENTS.md` owns Codex runtime safety.
