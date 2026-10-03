# Maintaining Codex skills

The `native` entries in `.agents/skill-modes.json` declare workflows maintained directly
in `.agents/skills/<name>/`. These own their Codex instructions. Every Claude skill in
`.claude/skills/` must be registered either `native`, with a maintained port, or `disabled`;
sync generates nothing, and `--check` warns about an unregistered name or mode `adapter`.
A skill's source ownership is separate from whether it requires agents or explicit
authorization.

Native entries do not require a Claude counterpart. Existing `skillOverrides: off` settings
remain respected for compatibility. Move a maintained skill outside discovery explicitly
before disabling it. `writing-skills` and `unslop` entrypoints are retired in both runtimes.
Use `addskill` for create/import/update/install; it uses built-in `skill-creator` as the
Codex authoring mechanism.

## Repository changes

Read the existing skill and its references. Edit the source for the intended runtime;
preserve the other runtime unless its behavior is also in scope. Register new standalone
names and classify each active Codex skill in `.agents/CODEX-SKILL-COMPATIBILITY.md`.
Keep the initial catalog within its checked budget.
`.agents/skill-sources.json` records a hash of each covered Claude skill folder, over the
files git would commit, so ignored files such as `Thumbs.db` never count. After a
change to a `native` skill's Claude source, update its Codex port to match, then run
`node .claude/scripts/sync-codex-skills.mjs --baseline <name>`; `--check` warns until you do.
`--check` exits 1 only on broken input: unreadable or malformed JSON, a skill without
frontmatter or a description, an invalid skill name or mode, or a deletion that would leave
the repository. `disabled` skills have no port and no entry; run `--check` only.

Run:

```text
node .claude/scripts/sync-codex-skills.mjs --write
node .claude/scripts/sync-codex-skills.mjs --check
node .claude/scripts/test-codex-contract.mjs
node --test .claude/scripts/test-sync-codex-skills.mjs .claude/scripts/test-codex-skill-sync.mjs .claude/scripts/test-codex-skill-copies.mjs
```

Sync warns about missing or still-generated standalone entry points. It preserves handwritten
content and never silently replaces it with a pointer. Validate referenced resources and
meaningful decision scenarios separately; metadata checks cannot establish workflow quality.

## Personal copies

The repository standalone skill is the distribution source. Personal customizations must
be reconciled explicitly rather than overwritten. Only install into the requested discovery
root; never create copies in multiple roots by default. Same-named copies can be independently
discoverable, so a matching name is not proof that the intended version was loaded.

1. Inspect the actual personal path and compare its contents with the repository source.
2. Resolve material differences within the user's scope. Preserve explicit user preferences.
3. Before replacing an existing file, back it up outside the skill discovery directory and
   record its original path and hash. Check it has not changed since inspection.
4. Copy the approved skill and required supporting resources. Preserve unrelated personal
   files. Verify source and destination bytes; report the backup location.
5. Verify the intended path in the target client after reload. Do not claim that editing
   files proves a running session has loaded the new instructions.

Use the read-only drift check against explicitly named roots:

```text
node .claude/scripts/check-codex-skill-copies.mjs <personal-skills-root>
```

It compares existing copies of registered standalone skills and required source resources;
it installs nothing and treats extra destination files as possible customizations. Comparisons
use exact bytes, including line endings. Links and unreadable resources are reported as
unverified while other copies are still checked. It does not scan chats, change settings,
or automatically publish updates. A restore uses the
recorded backup after verifying the exact destination and intervening changes.

Repository edits, personal installation, and Git publication are separate scopes. An
authorization can cover several, but completing one does not implicitly authorize the rest.

## Missing skills and selective propagation

Missing and retired skills are warnings; the checks exit 0. A project that deletes a skill on
purpose lists it in `.agents/removed-skills.json`, which silences the missing-skill warning.
`.agents/template-manifest.json` names the skills the template expects every project to keep
(`skills.required`) and the skills that need others (`skills.dependencies`);
`.claude/scripts/removed-skills.mjs` warns when a project breaks either. See [add or remove skills](https://github.com/ryanportfolio/Harness-Firmware/blob/main/GUIDE.md#add-or-remove-skills).
A retired name that regains a SKILL.md in `.claude/skills/` produces a sync warning naming its
replacement.

For selective updates, inspect the diff before choosing paths:

```text
git diff HEAD starter/main -- .agents/skills/<name> .agents/skill-modes.json
git checkout starter/main -- .agents/skills/<name>/SKILL.md .agents/skills/<name>/references/<resource>
```

Merge selected registry entries from `git show starter/main:.agents/skill-modes.json`;
preserve unrelated entries and explicit disabled choices. Never
replace a customized kernel or `.claude/reference/` as a side effect. Reconcile changed
resources with their native body, re-baseline any Claude skill whose port you updated,
and run the checks above.
An inherited `"writing-skills": "disabled"` entry may remain as an inert migration
record; retired names cannot be registered `native` or regain a SKILL.md entrypoint.
For this migration, explicitly remove `.agents/skills/unslop/SKILL.md` and
`.claude/skills/writing-skills/SKILL.md`, plus any retired counterpart left by a
partial sync, and drop the `unslop` ownership entry before running sync. Checkout
does not remove paths absent upstream. Inspect and back up customizations first,
preserving useful behavior in replacements or outside discovery; keep resources
and licenses. Validate that neither retired name has a SKILL.md in either root.

## Skill locks

A project keeps chosen skills exactly as they are by listing them in
`.agents/skill-locks.json`, each name with the reason it is locked:

```json
{
  "version": 1,
  "locks": {
    "writing": "Custom Codex version written for this project"
  }
}
```

The file is optional; when it is missing, nothing is locked. Harness Console's skill sync and
the `sync-starter` pull from the template never update, replace, or remove a locked skill's
`.claude/skills/<name>/` or `.agents/skills/<name>/` folder or its entries in
`.agents/skill-modes.json` and `.agents/skill-sources.json`, and they list each skipped skill
with its reason. `addskill` imports and updates, `init-project` profiles, and `adopt-repo`
follow the same rule, and `sync-codex-skills.mjs --write` never deletes a locked skill's
generated adapter. A lock file that exists but cannot be read or parsed stops those tools
with the error; none of them treats it as empty. Editing a locked skill by hand is still
allowed, and a lock does not affect pushing a change back to the template. The file belongs
to the project: the template ships none, and template cleanup never removes it because
`.agents` is a project path in `.agents/template-manifest.json`.
