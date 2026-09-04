---
name: addskill
description: "Use when installing, adding, or registering a repository or personal Codex skill, including a standalone replacement for a generated adapter."
---

# Install a Codex skill

Identify the requested source, target, and runtime from the task. Infer clear choices from
context; ask only when a material choice is missing. Read an existing target before editing
it. Preserve unrelated files and user customizations.

For this repository:

1. A standalone Codex workflow lives in `.agents/skills/<name>/SKILL.md`. Register its name
   in `.agents/skill-sources.json` under `standalone`; that file is its source-ownership list.
2. A shared Claude workflow keeps its source in `.claude/skills/<name>/SKILL.md` and uses a
   generated Codex adapter. Edit that source only when changing Claude behavior is authorized.
3. Classify every active Codex skill once in `.agents/CODEX-SKILL-COMPATIBILITY.md`. Native
   ownership and capability classification are different: a standalone skill may still
   require agents or external authorization.
4. Run `node .claude/scripts/sync-codex-skills.mjs --write`, its `--check` mode, and
   `node .claude/scripts/test-codex-contract.mjs`. Run relevant sync regression cases after
   changing registration logic. Preserve the 240-character description and catalog budgets.

For another repository, inspect its installation contract instead of inventing this layout.
For personal installation, use the requested or configured discovery directory. Do not
install extra copies into multiple roots. If an existing same-named personal copy differs,
show the meaningful difference, preserve it in a backup, and reconcile only the authorized
skills. Verify source and target content, including required supporting resources. Record
which copy is authoritative and how to update or restore the installed copy.

Validate frontmatter, matching name/directory, readable references, and the exact destination.
Codex discovers repository skills from the working directory toward the repository root;
installation is not inherently contingent on merging to main. Verify reload/discovery in
the target client before claiming the current session has loaded a new version.

Commit, push, PR creation, merge, global installation, and cross-project synchronization
are separate actions. Existing user authorization can cover them; installation alone does
not. Never activate persistent auto-merge as an installation side effect.
