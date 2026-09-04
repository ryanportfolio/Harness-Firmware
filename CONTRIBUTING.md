# contributing

Harness Firmware is a small layer that other repos depend on, so changes are
judged on what they cost to keep loaded, not just on whether they work.

## dev loop

Shared workflows are authored in `.claude/skills/` and exposed through generated Codex
adapters. Native entries in `.agents/skill-modes.json` are authored directly in
`.agents/skills/`; sync preserves them. See [Codex skill maintenance](docs/codex-skills.md).

```sh
# 1. edit the source for the intended runtime
# Use .agents/skills/<skill>/SKILL.md for a registered standalone Codex skill.
$EDITOR .claude/skills/<skill>/SKILL.md

# 2. regenerate the Codex adapters
node .claude/scripts/sync-codex-skills.mjs --write

# 3. check the adapters still satisfy the contract
node .claude/scripts/test-codex-contract.mjs

# 4. check the token tax
bash .claude/scripts/context-weight.sh
```

Step 4 is the one people skip. Every always-loaded byte is paid on every turn
in every repo that installs this. If your change adds weight, say so in the PR
and say what it buys.

## pull requests

- One open PR per unit of work. Update the existing PR rather than opening a
  second.
- Squash merge.
- Shipped files are ASCII-only. Validation fails on anything else.
- No secrets, tokens, private checkout paths, or maintainer-only assumptions in
  shipped files. See the safety rules below.
- Claude skill authoring uses `writing-skills`; Codex uses built-in `skill-creator`.
  Keep descriptions precise, omit filler, and state how to verify useful behavior.
- Update `CHANGELOG.md` under an unreleased or upcoming version heading when
  the change is user-visible.

## safety rules for shipped files

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

## submitting a new skill

A good skill PR contains:

- `SKILL.md` under the intended runtime's source directory, with a description that names the
  trigger conditions, not the topic. If an agent cannot tell from the
  description when to load it, the skill will not fire.
- A row in `.claude/skills/PROVENANCE.md` if the skill is forked or adapted
  from a third party, plus that upstream's LICENSE or NOTICE file kept inside
  the skill folder. Record what you changed.
- Regenerated adapters alongside shared sources, or a registered standalone Codex entry
  with its capability classification. Include sync and contract verification.
- The context-weight number before and after, when the skill is large.

Skills earn their place. Prefer improving an existing one over adding a
neighbor to it, and prefer pruning stale content over accreting.

## reporting problems

Use the issue templates. A bug report that names the harness (Claude Code or
Codex), the skill involved, and what the agent actually did is worth more than
a long description of what it should have done.
