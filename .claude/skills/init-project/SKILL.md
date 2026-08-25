---
description: Use once in a spawned starter repo when the user asks to initialize or configure it, or when FILL IN markers remain; never auto-run in a claude-starter template checkout.
---

# init-project — configure a freshly spawned starter project

The starter template ships with placeholder sections that MUST be configured before the kernel rules are trustworthy. This skill is the guided path: detect what's detectable, ask only what isn't, write it down, and verify the setup.

Run it ONCE per spawned project. If `grep -c "FILL IN" CLAUDE.md` returns 0, the project is already configured — say so and exit.

## Step 0: Confirm this is a spawned project

Check `git remote get-url origin` before changing files. If it points to `ryanportfolio/Harness-Firmware` (or the old name `ryanportfolio/claude-starter`), this is the canonical template: do not initialize, delete template assets, prune skills, or rewrite its generic defaults. Explain that the markers are intentional and stop.

If the repo still has a canonical template README (`# Harness Firmware`, or `# Agent firmware` in a checkout made before the rename) plus both `bootstrap/` and `.claude-plugin/`, ask whether this is a template checkout or maintenance fork versus a spawned project, regardless of its origin name. Do not delete those assets until the user confirms it is spawned. Their answer is authoritative; repository names alone are ambiguous.

## Step 1: Detect the stack (no questions yet)

Look before asking. Gather from the repo itself:

- `ls` the root — what scaffold exists? (`package.json`, `pyproject.toml`, `Cargo.toml`, `go.mod`, `*.csproj`, nothing yet?)
- If `package.json` exists: read `scripts` (build/dev/test/check commands), `dependencies` (framework, router, query lib, ORM), `devDependencies` (bundler, test runner).
- Equivalent manifest reads for other ecosystems.
- `git remote get-url origin` — the repo path for PR links.

If the repo is EMPTY (fresh spawn, no app code yet), either configure honest undecided defaults now or defer initialization without changing files until after scaffolding. Do not partially initialize and then promise a second run; configured projects intentionally exit on rerun.

## Step 2: Ask what detection can't answer

Plain chat, numbered (popup tools are banned). Only ask what's actually unknown — skip questions the scaffold already answered:

1. **Profile:** which best describes this project — **web-app** (has UI), **backend/CLI/library** (code, no UI), **data/notebooks**, or **writing/docs**? Lead with the guess detection supports ("scaffold says web-app — confirm?"), only truly ask when the repo is empty.
2. **Direction:** in one or two sentences, what is this product and who is it for? Anything you refuse to compromise on (performance, openness, a platform that must always work)? This fills the "What this project is" section; a directionally briefed model suggests changes that fit instead of changes that merely run.
3. **Deploy target:** where will this run? (host/platform, database, where secrets live)
4. **Sandbox capabilities:** can sessions in this environment run installs, builds, type-checks, tests meaningfully? Can the user reach a dev server the session starts? Is there a browser?
5. **Authoritative verification:** what's the final word that a change works — local test suite, CI, a deploy log?
6. **Hard lines:** anything that must ALWAYS go through the user (installs, migrations, deploys, destructive ops)?
7. **Prose mode:** how should replies read: the `caveman` compression at **ultra** (default, inherited from the template), **full**, **lite**, or **normal** prose? Say what ultra means in one line -- terse, articles dropped, code and error strings verbatim, security and irreversible-action confirmations still plain -- so a first-time user can choose knowingly. Keep ultra if the user has no preference.
8. **Skill preset:** **full** (every starter skill, minus the profile pruning below) or **minimal** (drops the situational extras; the core-loop and discipline skills stay)? Default full. Offer minimal when the user cares about per-turn context weight.

If the user doesn't know yet (brand-new project), write the honest default: "not yet decided — ask before installs/migrations/deploys" and move on. Don't stall setup on undecided infrastructure.

## Step 3: Fill in CLAUDE.md

- Replace the **What this project is** FILL IN section with the Step 2 direction answer: two or three sentences, the "won't compromise on" list, optional glossary, ~10 lines cap. If the user has no answer yet, delete the section; an empty always-loaded section steers nothing, and a later direct edit can add it back once the product takes shape.
- Replace the **verification** FILL IN section with the real answer from Step 2 (what this sandbox can/can't verify, what the authoritative signal is, what to flag-as-risk instead of claim).
- Replace the **Environment & Deploy Target** FILL IN section with the deploy target, install policy, migration policy, and hard lines.
- Delete the `STARTER TEMPLATE NOTE` comment block and every `FILL IN` comment.
- Delete the template-only paths — they maintain, document, or distribute the template itself and must not ship as if they were this project's own history, process, or support links:
  `.claude-plugin/`, `bootstrap/`, `.github/workflows/validate-template.yml`, `.github/ISSUE_TEMPLATE/`, `CHANGELOG.md`, `CONTRIBUTING.md`.
  Then remove `.github/workflows/` and `.github/` if those deletions left them empty (a project that ships its own workflows keeps them).
  This list is mirrored in `bootstrap/new-claude-project.sh` (`TEMPLATE_ONLY_PATHS`) and `bootstrap/NewProjectCore.psm1` (`$script:TemplateOnlyPaths`); the three must agree.
- Keep the section structure — future sessions navigate by those headings.

## Step 3b: Apply the prose mode (two files, keep them agreeing)

The prose default is asserted twice: `CLAUDE.md` (project memory) and `.claude/hooks/session-start.sh` (injected context at session start). A mismatch is a bug: the hook wins in practice while the user reads CLAUDE.md, so they argue forever.

The hook's caveman parts are wrapped in three marked blocks: `caveman:directive` (the `print_caveman_directive` function), `caveman:reminder` (its bullet inside `print_skill_reminders`), and `caveman:call` (the call near the bottom). Each is `# >>> <id>:begin ... # <<< <id>:end`.

- **ultra** (default): both files already ship this. Change nothing.
- **lite / full**: keep both places and rewrite the level in both: the CLAUDE.md heading plus its first line, and in the hook the `caveman ultra` text, the `args: "ultra"` argument, and the `/caveman ultra` in the reminder bullet. The shipped descriptor ("terse, abbreviated, arrows for causality") describes ultra, so match it to the chosen level (see `.claude/skills/caveman/SKILL.md` intensity table).
- **normal**: delete the `## Default prose mode: caveman ultra` section from `CLAUDE.md`, and delete all three marked hook blocks, marker comments included. Leave the `caveman` skill installed unless Step 5 prunes it; the user can still invoke it on demand, it just isn't the default.

Verify: `grep -rn "caveman" CLAUDE.md .claude/hooks/session-start.sh` returns either nothing (normal) or the same level everywhere. Then `bash -n .claude/hooks/session-start.sh`.

## Step 4: Seed the reference files

- `commands.md` — the detected scripts/commands, verbatim and runnable.
- `tech-stack.md` — detected framework + any non-default picks the user names (and WHY, if they say).
- `deployment.md` — the deploy answers from Step 2.
- Leave `pitfalls.md` / `architecture.md` / `secrets.md` skeletal — they fill organically via `/recall save`.

## Step 5: Apply the profile — prune skills

**Skill pruning.** The profile from Step 2 disables skills that will never fire in this project, via `skillOverrides` in committed `.claude/settings.json` (`"off"` = hidden from the picker AND the per-turn skills list; re-enable any time by removing the key). Project skills use the bare directory name as the key:

| Profile | Disable (`"off"`) |
|---|---|
| web-app | — (full set) |
| backend / CLI / library | `forge-repo-ui-skill`, `lab` |
| data / notebooks | `forge-repo-ui-skill`, `lab` |
| writing / docs | `forge-repo-ui-skill`, `lab` |

The table is a floor, not a ceiling — offer obvious extras ("no frontend planned, also drop `humanizer`? it's for prose deliverables"). Each `off` saves its description from every turn (`bash .claude/scripts/context-weight.sh` shows per-skill weight); takes effect next session.

**Skill preset.** The Step 2 answer decides how much survives the profile pruning:

- **full**: keep everything the profile table left; nothing further to do.
- **minimal**: delete the situational extras from `.claude/skills/` and keep the core-loop and discipline tiers. The extras are `advocate`, `enhance-prompt`, `fable-mode`, `forge-repo-ui-skill`, `handoff-audit`, `humanizer`, `lab`, `purposeful-writing`, `why`, plus `caveman` unless Step 2 chose a caveman prose mode (delete it otherwise). These are the same three tiers `README.md` lists; keep the wording in both places agreeing.

Do not delete past the extras. The core-loop and discipline skills are named by the always-loaded layer, so cutting into them reproduces the bug Step 3b exists to prevent.

Deletion is the same mechanism as the template-asset removal in Step 3: remove the skill directory outright. It is stronger than `"off"`: the folder is gone, so drop the now-dead `skillOverrides` keys instead of leaving them pointing at nothing. Say the two consequences out loud before deleting: the weekly drift check will count the removed files as template drift, and getting a skill back means `/sync-starter` (recoverable, not permanent).

Confirm the list with the user before deleting: minimal is a taste call, and a skill they wanted back mid-project is friction.

**Keep the always-loaded files honest.** Two files name skills every turn and must not point at a deleted folder:

- `.claude/hooks/session-start.sh` — `print_skill_reminders` lists `recall`, `brainstorming`, `impartial-review` (all survive minimal), plus the `caveman` bullet Step 3b already manages. If the profile table or an extra offer removed any of those, delete its bullet too.
- `CLAUDE.md` — the "Welcome correction" line ends with `/why`. `why` is an extra, so minimal deletes it: drop that `/why` reference in the same pass.

Verify: `grep -rn "/why" CLAUDE.md` returns nothing, and for each other deleted skill `grep -rn "<name>" CLAUDE.md .claude/hooks/session-start.sh` turns up no line telling a session to invoke it. Read the hits rather than counting them — names like `lab` also occur as ordinary words. Then `bash -n .claude/hooks/session-start.sh`.

## Step 6: README

If `README.md` is the spawn stub (`# <name>` only) or still starts with a canonical template heading (`# Harness Firmware`, or the pre-rename `# Agent firmware`), ask the user for a one-line project description and replace it minimally: name, one-liner, how to run (from `commands.md`). Don't write aspirational docs for code that doesn't exist.

## Step 6b: Sync Codex skill adapters

Run `node .claude/scripts/sync-codex-skills.mjs --write` after applying the
profile and the preset. The generator mirrors active skill metadata into thin
`.agents/skills/` adapters while leaving the canonical Claude skills unchanged.
Disabled skills are omitted according to `skillOverrides`; skills deleted by the
preset lose their adapters in the same pass.

## Step 7: Wire the starter remote

```
git remote get-url starter || git remote add starter https://github.com/ryanportfolio/Harness-Firmware.git
```

This pre-wires `/sync-starter` and lets the session-start hook surface template drift ("starter differs on N files"). Remotes are local git config, not committed — mention that a new clone on another machine needs this line re-run (or the hook's URL-fallback fetch covers it when credentials allow).

## Step 8: Finish and optionally ship

Verify that no `FILL IN` markers or template-only paths from Step 3 remain. In Claude Code, follow the project's configured Git rule. In Codex, initialization alone does not authorize commit, push, PR, or merge: perform only the Git actions the user explicitly requested, otherwise leave the verified setup uncommitted and report it.

## Anti-patterns

- Don't invent deploy facts or sandbox capabilities — wrong kernel rules are worse than FILL IN markers. Ask, or write the honest "undecided" default.
- Don't run installs just to probe the stack — read manifests instead.
- Don't leave any `FILL IN` marker behind. `grep -n "FILL IN" CLAUDE.md` must return nothing at the end.
- Don't initialize a canonical or forked `Harness-Firmware` (formerly `AI-Firmware`, originally `claude-starter`) template checkout; its markers and template assets are intentional.
- Don't leave template CI or distribution files in a spawned project.
- Don't let `CLAUDE.md` and the session-start hook disagree about prose mode; half-removed caveman is worse than either setting.
- Don't silently drop caveman: ultra is the inherited default and stays unless the user picks another level. Equally, don't keep it without offering the choice -- an unexplained terse agent reads as broken to a first-time user.
- Don't delete skills past the minimal list to look tidy, and don't run the preset without confirming the list first. A deleted skill that `CLAUDE.md` or the session-start hook still names is an every-turn instruction to invoke something that isn't there.
- Don't pad the reference files with boilerplate prose — they're lookup tables for future sessions, not documentation theater.
- Don't copy full skills into `.agents/skills/` — generated adapters keep
  `.claude/skills/` as the single source of truth for both runtimes.
- Don't run this twice. Configured projects evolve via `/recall save` and direct CLAUDE.md edits, not re-initialization.
