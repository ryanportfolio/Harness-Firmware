# Harness Firmware guide

Harness Firmware can add a skill library to an existing repository or create a project with the complete operating layer. This guide covers the detailed setup and maintenance paths. The [README](README.md) stays focused on evaluation and quick installation.

## full template

Use the full template when a project needs the rule kernel, hooks, committed memory, skills, and starter synchronization.

- GitHub UI: select **Use this template**, create a repository, clone it, open it in Claude Code, then run `/init-project`.
- macOS or Linux: `bash bootstrap/new-claude-project.sh --name my-app --dest ~/code`
- Windows one-click: double-click `bootstrap/New-ClaudeProject.cmd`.
- Windows CLI: `.\bootstrap\new-claude-project.ps1 -Name my-app -Dest C:\code`
- Windows visual launcher: download and extract [`New-ClaudeProject-UI.zip`](https://github.com/ryanportfolio/Harness-Firmware/releases/latest/download/New-ClaudeProject-UI.zip), then double-click `New-ClaudeProject-UI.cmd`.

Keep the extracted Windows launcher, PowerShell module, and `template/` folder together. The bundled snapshot supports local-only project creation without GitHub access.

`/init-project` detects the stack, asks a short set of unresolved questions, fills the verification and deployment sections, seeds reference files, prunes irrelevant skills, removes spawn-only files, and prepares the result for verification.

Two setup choices affect every later session:

- **Prose mode:** `caveman ultra` is the template default. Choose `normal`, `lite`, or `full` during setup to change it.
- **Skill preset:** `full` keeps every skill. `minimal` keeps the core loop and quality disciplines, then asks before removing situational tools.

Git writes still follow the active runtime's safety rules and the user's authorization.

## Codex

1. Open the repository in Codex.
2. Let Codex read `AGENTS.md` as its instruction boundary.
3. Use `.claude/reference/` for shared project knowledge.
4. Let Codex discover generated adapters under `.agents/skills/`.
5. Do not run Claude hooks or inherit Claude automatic Git behavior unless the user explicitly asks in the current Codex session.

For a new project, ask Codex to initialize the starter or select the `init-project` skill. Its adapter delegates to the same canonical workflow used by Claude Code.

## prose mode

The template answers in terse `caveman ultra` by default. Replies drop filler while code, commands, identifiers, and error strings stay intact. Security warnings and irreversible confirmations use plain prose.

Two files assert the default and must agree:

- `CLAUDE.md`, under `## Default prose mode: caveman ultra`.
- `.claude/hooks/session-start.sh`, in the three marked caveman blocks.

To change the default later, replace `ultra` with `lite` or `full` in both files. To remove the default, delete the marked section and hook blocks. The `caveman` skill remains available on demand.

For one session, say `stop caveman` or `normal mode`.

Check both files afterward:

```bash
grep -rn caveman CLAUDE.md .claude/hooks/session-start.sh
```

Either nothing returns or the same level appears everywhere.

## check the installation

Run:

```bash
node .claude/scripts/doctor.mjs
```

The doctor checks hook wiring, skill frontmatter, generated Codex adapters, the reference library, plugin manifests, leftover `FILL IN` markers, and always-loaded context weight.

## measure the always-loaded layer

Run:

```bash
bash .claude/scripts/context-weight.sh
```

The script measures the repository kernel, machine-global Claude instructions, and every injected skill name and description. It estimates tokens at four characters each. The result is a source-file trend measure, not runtime billing.

Skill bodies and reference files stay outside the always-loaded layer. They load only when a task routes to them. MCP tool definitions, marketplace descriptions, and machine auto-memory also sit outside the script's measurement.

The `minimal` preset physically removes confirmed skills. `skillOverrides` changes discovery but does not change the script's file count.

## work loop

The repository carries the loop:

1. `recall` reads the relevant project facts and dated pitfalls.
2. A matching skill supplies the longer workflow only when needed.
3. Project-specific verification records evidence.
4. `refine` maps observed friction to the smallest rule, memory, or workflow change that could prevent a repeat.
5. `sync-starter` can move a reviewed generic improvement into the template or pull a template improvement into a spawned project.

`optimize-context` removes guidance that no longer earns its per-turn cost.

## runtime boundaries

| Runtime | Entry point | Responsibility |
|---|---|---|
| Claude Code | `CLAUDE.md`, `.claude/settings.json`, `.claude/hooks/`, `.claude/skills/` | Kernel rules, slash skills, project memory, session hook, plugin path, and Claude-specific workflow rules. |
| Codex | `AGENTS.md`, `.agents/skills/` | Explicit safety boundary and generated skill discovery adapters backed by canonical playbooks. |

Codex adapters delegate to `.claude/skills/`, so maintainers update one source. `AGENTS.md` defines the Codex safety boundary. Codex does not run Claude SessionStart hooks. Workflows that need unavailable tools remain capability-gated.

## repository map

| Path | Purpose |
|---|---|
| `CLAUDE.md` | Claude Code kernel loaded every turn. Spawned projects fill its verification and deployment sections. |
| `AGENTS.md` | Codex instruction and safety boundary. |
| `.claude/skills/` | Canonical workflow playbooks. |
| `.agents/skills/` | Generated Codex discovery adapters. |
| `.claude/reference/` | Committed project memory for architecture, commands, deployment, pitfalls, secrets, and technology choices. |
| `.claude/hooks/session-start.sh` | Claude Code startup checks and reminders. |
| `.claude/scripts/context-weight.sh` | Always-loaded source weight measurement. |
| `.claude/scripts/doctor.mjs` | Installation health check. |
| `.claude/settings.json` | Claude hook wiring and Bash permission allowlist. |
| `.claude-plugin/` | Claude plugin and marketplace manifests used by the template. |
| `bootstrap/` | Project creation, fork retargeting, machine setup, and Windows launcher release files. |

## fork the template

Retarget functional upstream references to a fork:

```bash
bash bootstrap/retarget-fork.sh <you>/<your-fork>
```

Review the diff before committing. License attribution remains unchanged.

## machine-level Claude files

Files under `~/.claude` do not travel with a repository. Keep personal bootstrap copies under `bootstrap/machine/home-claude/` in a fork, then run:

```powershell
.\bootstrap\setup-machine.ps1
```

The script copies missing files. `-Force` overwrites. `-DryRun` previews.

## requirements

- Claude Code for the plugin workflow. The full template supports Claude Code or Codex.
- Codex reads `AGENTS.md` and `.agents/skills/`; it does not run Claude SessionStart hooks.
- Node for the doctor, README generator, and Codex adapter synchronization.
- `gh` CLI is optional for project creators.
- PowerShell bootstrap runs on Windows.
- POSIX bootstrap runs on macOS and Linux.
- The Claude session hook uses Bash and is validated on Ubuntu in CI.

## contributing and releases

[CONTRIBUTING.md](CONTRIBUTING.md) defines the change process and verification checklist. [CHANGELOG.md](CHANGELOG.md) records released changes. Bug and skill-proposal templates live under `.github/ISSUE_TEMPLATE/`.

## provenance and license

Harness Firmware is MIT licensed. See [LICENSE](LICENSE).

Several skills are forks of upstream work. Two are concept ports that copy no upstream code or text: `refine` from Prime Intellect's Continual Harness and `long-horizon` from AMAP-ML's LongHorizon-Harness. `.claude/skills/PROVENANCE.md` records origins, licenses, and local changes.
