# Harness Firmware

[![validate-template](https://github.com/ryanportfolio/Harness-Firmware/actions/workflows/validate-template.yml/badge.svg)](https://github.com/ryanportfolio/Harness-Firmware/actions/workflows/validate-template.yml)

A portable operating layer for AI coding agents: standing rules, on-demand
skills, committed memory, session hooks, and sync scripts. Claude Code gets the
full system. Codex gets a safe boundary in `AGENTS.md` and the same playbooks.
It compounds: when work hits a gotcha, one command saves the lesson as
committed project memory, and every later session starts with it loaded.

## 60-second quickstart

### skills only (start here)

Adds the skill set to a project you already have. Nothing else changes.

```text
/plugin marketplace add ryanportfolio/Harness-Firmware
/plugin install claude-starter@claude-starter
```

Plugin skills are namespaced, for example `/claude-starter:recall`. The plugin
id stays `claude-starter` so existing installs keep working. This path needs the
repository to be public.

### full template

Use this when you want the whole system: kernel, hooks, memory, skills, and
starter sync. Projects spawned this way get the skills without the namespace.

- GitHub UI: **Use this template -> Create a new repository**, clone it, open it
  in Claude Code, then run `/init-project`.
- macOS / Linux: `bash bootstrap/new-claude-project.sh --name my-app --dest ~/code`
- Windows one-click: double-click `bootstrap/New-ClaudeProject.cmd`.
- Windows CLI: `.\bootstrap\new-claude-project.ps1 -Name my-app -Dest C:\code`
- Windows visual launcher: download and extract
  [`New-ClaudeProject-UI.zip`](https://github.com/ryanportfolio/Harness-Firmware/releases/latest/download/New-ClaudeProject-UI.zip),
  then double-click `New-ClaudeProject-UI.cmd`. Keep the extracted launcher,
  PowerShell module, and `template/` folder together; the bundled snapshot makes
  local-only creation work without GitHub access.

`/init-project` detects the stack, asks a short Q&A, fills the verification and
deploy sections, seeds reference files, prunes irrelevant skills, removes
spawn-only template files, and commits the setup. Two of its questions matter
early:

- **prose mode.** Default is terse `caveman ultra`, inherited from the template.
  Pick `normal` at the prompt for ordinary prose. See
  [prose mode](#prose-mode) to change it later.
- **skill preset.** `full` ships everything. `minimal` keeps the core loop and
  the discipline skills and drops the extras.

### Codex

1. Open the repo in Codex.
2. Let Codex read `AGENTS.md` as the authoritative Codex instruction boundary.
3. Use `.claude/reference/` for shared project memory.
4. Let Codex discover the generated repo skills under `.agents/skills/`.
5. Do not run Claude hooks or inherit Claude auto-commit/auto-merge rules unless
   the user explicitly asks in the current Codex session.

For a fresh project, ask Codex to initialize the starter or select the
`init-project` skill. Its adapter delegates to the same workflow Claude Code
uses.

## prose mode

The template answers in terse `caveman ultra` by default: replies drop articles
and filler, code and error strings stay word for word, and security warnings and
irreversible-action confirmations drop back to plain prose automatically.

Two files assert it, and they must agree:

- `CLAUDE.md`, the `## Default prose mode: caveman ultra` section.
- `.claude/hooks/session-start.sh`, three blocks marked
  `# >>> caveman:directive:begin` / `caveman:reminder` / `caveman:call`.

To change it:

- **At setup:** answer `normal`, or `lite` / `full` / `ultra`, when
  `/init-project` asks. It edits both files for you.
- **Later, softer level:** replace `ultra` with `lite` or `full` in both files.
  The intensity table in `.claude/skills/caveman/SKILL.md` describes each.
- **Later, off entirely:** delete that `CLAUDE.md` section and the three marked
  hook blocks, marker comments included. The `caveman` skill stays installed, so
  `/caveman` still works on demand; it just isn't the default.
- **For one session only:** say "stop caveman" or "normal mode".

Check the two files agree afterward:

```bash
grep -rn caveman CLAUDE.md .claude/hooks/session-start.sh
```

Either nothing comes back, or the same level everywhere.

## check your install

```bash
node .claude/scripts/doctor.mjs
```

It reports whether hooks are wired, skills parse, Codex adapters are in sync,
and any `FILL IN` markers survived `/init-project`.

## what the always-loaded layer costs

Measured on this template with `bash .claude/scripts/context-weight.sh`:

| Always-loaded piece | Per turn |
|---|---|
| `CLAUDE.md` kernel (5.5 KB) | ~1,400 tokens |
| 20 skill descriptions in the available-skills list | ~800 tokens |
| **Total (file-measurable)** | **~2,200 tokens** |

`doctor.mjs` reports the same measure over repo files only; `context-weight.sh`
also counts your machine-global `~/.claude/CLAUDE.md`. MCP tool lists,
marketplace skill descriptions, and per-machine auto-memory are not measured by
either; check those in session. Run it in your own project before deciding a
rule deserves the kernel. The `minimal` preset drops the extras tier, cutting
the skill description line item by about half.

## why this exists

Everything you put in the prompt makes every turn heavier. Everything you leave
out, a project relearns the hard way. And Claude-specific automation that leaks
into Codex turns useful defaults into unsafe commands.

So the work is split: the kernel stays small and always loaded, skills hold the
long playbooks until a task calls for them, reference files keep project memory
out of the transcript, hooks handle cheap startup checks, and sync scripts move
reusable improvements between projects.

## work loop

The loop is the point. An agent with no durable memory relearns the same
gotcha in every session; here you write it down once and it stays fixed. Each
lesson gets a named home (`.claude/reference/` for project facts, the
`CLAUDE.md` kernel for cross-cutting rules), travels with the repo, and is
loaded before the work that needs it. Use the template while you work, then
feed the useful parts back into it:

- `/recall save <text>` records a project gotcha in the right reference file.
- `/sync-starter` moves a generic improvement back to the template, so every
  future project starts with it, or pulls a template improvement into a
  spawned project.
- `bash .claude/scripts/context-weight.sh` shows what the always-loaded layer
  costs per turn.
- `/optimize-context` is the playbook for cutting context that no longer earns
  its place.

The last two keep the loop honest: every saved rule costs tokens on every
turn, so lessons that stop earning their place get pruned instead of piling
up.

## runtime boundary

| Runtime | Entry point | Use it for |
|---|---|---|
| Claude Code | `CLAUDE.md`, `.claude/settings.json`, `.claude/hooks/`, `.claude/skills/` | The full template: kernel rules, slash skills, project memory, session hook, plugin path, and Claude-specific workflow rules. |
| Codex | `AGENTS.md`, `.agents/skills/` | A safe compatibility layer plus native skill discovery, backed by the same Claude workflows, unchanged. |

Codex discovers thin adapters under `.agents/skills/`. Each adapter delegates to
the matching `.claude/skills/` workflow, so both runtimes use one source of
truth. `AGENTS.md` defines the safety boundary. Codex does not run
Claude SessionStart hooks. The template intentionally has no project Codex hook:
`AGENTS.md` already loads natively, while command hooks add a separate trust and
platform-failure surface.

## what's inside

| Path | Purpose |
|---|---|
| `CLAUDE.md` | Claude Code kernel rules loaded every turn: verification, git workflow, subagent discipline, and context restraint. Two placeholder sections are filled per project by `/init-project`. |
| `AGENTS.md` | Codex boundary. Inherits project facts without inheriting Claude-only hooks or automatic git behavior. |
| `.claude/skills/` | The Markdown playbooks themselves, used by Claude Code and Codex. |
| `.agents/skills/` | Generated Codex-native adapters; metadata only, no duplicated workflow bodies. |
| `.claude/reference/` | Durable project memory: secrets, architecture, pitfalls, commands, tech stack, and deployment notes. |
| `.claude/hooks/session-start.sh` | Claude Code SessionStart hook for drift checks, overlap warnings, and Claude-specific defaults. |
| `.claude/scripts/context-weight.sh` | Prints always-loaded context weight, including a per-skill breakdown. |
| `.claude/scripts/doctor.mjs` | Install health check: hooks, skills, adapter sync, leftover markers. |
| `.claude/settings.json` | Claude Code hook wiring plus a Bash permission allowlist. |
| `.claude-plugin/` | Claude plugin and marketplace manifests. Template-only for spawned projects. |
| `bootstrap/` | Project creation, fork retargeting, and machine setup scripts. |

## skill set

Three tiers. The `minimal` preset in `/init-project` keeps the first two and
drops the extras listed below.

- **Core loop** (project lifecycle and shipping): `init-project`, `recall`,
  `sync-starter`, `optimize-context`, `addskill`, `merge`.
- **Discipline** (how work gets done): `brainstorming`, `writing-plans`,
  `impartial-review`, `writing-skills`.
- **Extras** (situational): `advocate`, `caveman`, `enhance-prompt`,
  `fable-mode`, `forge-repo-ui-skill`, `handoff-audit`, `humanizer`, `lab`,
  `purposeful-writing`, `why`.

`.claude/skills/PROVENANCE.md` records where the forked skills came from, their
licenses, and what changed here.

## safety model

This template is supposed to travel, so defaults must stay safe outside one
person's machine.

- Runtime-specific rules stay runtime-specific. Claude hooks and Claude popup
  constraints do not become Codex standing orders.
- Template files must not ship private checkout paths, maintainer-only workflow
  mandates, secrets, tokens, or local-machine assumptions.
- Git automation stages explicit paths and protects against direct pushes to
  `main`, force-pushes, secret files, and unverified completion claims.
- Installs, migrations, deploys, deletes, branch merges, and edits outside the
  current workspace require explicit user authority for the current session.
- Verification claims must name the check that actually ran. If the real signal
  is CI, deploy logs, or the user's machine, say that instead of pretending.

## forking this template

One command retargets functional upstream references to your fork:

```bash
bash bootstrap/retarget-fork.sh <you>/<your-fork>
```

Review the diff and commit. LICENSE attribution is intentionally left untouched.

## dotfiles for Claude

Machine-level `~/.claude` files do not travel with any repo. Keep your copies in
`bootstrap/machine/home-claude/` in your fork, then on a new machine run:

```powershell
.\bootstrap\setup-machine.ps1
```

The script copies missing files only. `-Force` overwrites. `-DryRun` previews.

## requirements

- Claude Code for the full template and plugin workflow.
- Codex uses `AGENTS.md` and native `.agents/skills/` adapters. It does not run
  Claude SessionStart hooks or need a project hook to load repository guidance.
- Node for `doctor.mjs` and the Codex adapter sync script.
- `gh` CLI is optional for the project creators. Without it,
  `new-claude-project.sh` still clones the template over the network; only the
  Windows launcher's bundled snapshot (and `-LocalOnly`) works with no GitHub
  access.
- Bootstrap ships PowerShell for Windows and a POSIX script for macOS and Linux.
  The Claude session hook is Bash and is validated under Ubuntu CI.

## contributing

See `CONTRIBUTING.md` for the change process, what belongs in the kernel versus
a skill, and how to run validation before opening a PR. Bug reports and skill
proposals have templates under `.github/ISSUE_TEMPLATE/`. Released changes are
listed in `CHANGELOG.md`.

## provenance and license

MIT. See `LICENSE`.

Several skills are forked from upstream work, notably Jesse Vincent's
`superpowers` skills (MIT). `.claude/skills/PROVENANCE.md` tracks forked origins,
licenses, and local changes. Per-skill LICENSE and NOTICE files ship in
third-party skill folders when required.
