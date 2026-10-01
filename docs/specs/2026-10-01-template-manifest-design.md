# Template manifest design

Date: 2026-10-01. Status: implemented in the template (part A). Harness-Console and
HarnessFirmware.com adopt it in their own repositories.

## Problem

Four programs create a project from this template: `bootstrap/new-claude-project.sh`,
`bootstrap/NewProjectCore.psm1` (behind the Windows launchers), Harness-Console and the
HarnessFirmware.com creator. Each kept its own list of the files that belong to the
template and must not reach a new project, and its own list of files a new project must
have. The `init-project` skill repeated the list in prose, and `adopt-repo` parsed it out of
the shell script. The lists were incomplete: by 2026-10-01 the scripts stripped 6 paths and
replaced the README with a stub, while the template's guide, license, README build scripts
and assets, diagram assets and research notes still reached every new project, along with
instructions to run scripts the project did not need. Skill groups for the two creator UIs lived in a third place,
`scripts/readme/items.json`, and the required skills and dependencies in a fourth,
`.claude/scripts/removed-skills.mjs`.

## Decision

One file, `.agents/template-manifest.json`, holds all of it. Every creator reads it from the
tree it is about to strip. It ships into every new project, for two reasons: the creators
that strip a clone (`gh repo create --template`, a plain clone, the HarnessFirmware.com
generated repository) read it from that clone, and `removed-skills.mjs` in the project
reads the required skills and dependencies from it. The manifest is itself a required file.

## Schema (version 1)

```json
{
  "version": 1,
  "template": "ryanportfolio/Harness-Firmware",
  "requiredFiles": [".agents/template-manifest.json", "AGENTS.md", "..."],
  "projectPaths": [".agents", ".claude", "..."],
  "templateOnly": [".claude-plugin", "README.md", "bootstrap", "..."],
  "readmeStub": "# {name}\n",
  "skills": {
    "groups": [
      { "id": "core", "label": "Core workflows", "description": "...", "skills": ["..."] }
    ],
    "required": ["external-review", "init-project"],
    "dependencies": { "codex-review": ["external-review"] },
    "presets": { "minimal": { "omit": ["advocate", "..."] } }
  }
}
```

- `requiredFiles`: files that must exist in a new project after the strip.
- `projectPaths` and `templateOnly`: together they cover every file in the template.
  `projectPaths` ship; `templateOnly` paths are removed at creation.
- `readmeStub`: the new project's `README.md`, with `{name}` replaced by the project name.
- `skills.groups`: the groups the creator UIs show, with their ids, labels and descriptions.
  Per-skill labels and descriptions stay in each UI.
- `skills.required`, `skills.dependencies`, `skills.presets`: the skills every project should
  keep, the skills that need others to work, and named presets of skills to leave out.

## Semantics

- Path entries are repo-relative, use `/`, have no trailing slash and no glob. Entry E
  matches file F when `F === E` or F starts with `E + "/"`.
- In the template, every repository file matches exactly one entry across `projectPaths` and
  `templateOnly`, entries do not repeat or nest, and every entry matches at least one file.
- At creation, every `templateOnly` path is removed, then `README.md` is written from
  `readmeStub` with each consumer's usual line endings (LF from the shell script, CRLF from
  the PowerShell module). Creators also remove `.tmp*` folders and parent folders the strip
  leaves empty, such as `.github/` and `assets/`.
- A creator fails when a `requiredFiles` path is missing after the strip.
- Every folder under `.claude/skills/` or `.agents/skills/` that holds a `SKILL.md` appears in
  exactly one group, and every name in a group, in `skills.required`, in
  `skills.dependencies` and in a preset is such a folder.
- A `version` other than 1 or an unknown top-level key stops every consumer with a message
  naming the file. No consumer falls back to a built-in list when the template has no
  manifest. The one exception is `removed-skills.mjs`, which also runs in projects created
  before the manifest existed; there it applies no required or dependency rule.

## Consumers

1. `bootstrap/new-claude-project.sh` reads the manifest with `node`, which is now a stated
   prerequisite; without it the script stops with a message. In gh mode it reads the
   manifest of the new repository's clone; in clone mode, of the shallow clone.
   `HARNESS_TEMPLATE_URL` overrides the clone source, for mirrors and tests.
2. `bootstrap/NewProjectCore.psm1` reads it with `ConvertFrom-Json`: from the clone in gh
   mode, from the copied snapshot in local mode. Its offline `robocopy` copy excludes the
   source's `templateOnly` paths by full path. `Get-NewProjectTemplateOnlyPath -Root <tree>`
   keeps serving `Build-NewClaudeProjectUIRelease.ps1`, which strips the release snapshot
   with the snapshot's own manifest. `bootstrap/tests/Test-NewProjectGenerator.ps1` takes its
   required and forbidden lists from the manifest.
3. Harness-Console (`harness.mjs`, separate repository) reads the groups from the template's
   default branch for its skill picker and strips a new repository by the clone's own
   manifest.
4. HarnessFirmware.com (`site/github-creator.mjs`, separate repository) reads the manifest
   from the generated repository's tree, deletes every `templateOnly` file, and writes
   `README.md` from `readmeStub`, along with its existing skill removals.

Skill and script readers in the template:

- `.claude/scripts/removed-skills.mjs` takes `REQUIRED` and `DEPENDENCIES` from
  `skills.required` and `skills.dependencies`; the named exports keep working.
- `.claude/scripts/test-codex-contract.mjs` rejects an unusable manifest, checks the
  `bootstrap/` creators only where `bootstrap/` exists, and no longer checks template-only
  paths itself, so it passes in a new project.
- `init-project` and `adopt-repo` read the template-only paths and the `minimal` preset from
  the manifest, and `sync-starter` never pulls a `templateOnly` path into a project.

## Checks

- `bootstrap/tests/check-template-manifest.mjs` enforces the partition, entry format,
  required files, skill coverage and rule names against the template. Repository files are
  the tracked files plus untracked files Git does not ignore, limited to files on disk, so
  an added or deleted file counts before it is committed. CI runs it as a failing step.
- `bootstrap/tests/check-template-manifest.test.mjs` proves the check fails on an unlisted
  file, a listed path that does not exist, overlapping entries, an ungrouped skill folder and
  an unknown skill name in each rule.
- `bootstrap/tests/smoke-new-claude-project.sh` runs the shell creator in clone mode on Linux
  CI from a local copy of the commit, with `gh` replaced by a stub that always fails, and
  checks the project for template-only paths, required files and the README stub.
- The Windows `generator-smoke` job runs `Test-NewProjectGenerator.ps1`, now driven by the
  manifest.

Both checks live in `bootstrap/`, which is template-only, so a new project neither receives
them nor fails when its own files differ from the template's lists. An earlier skill
capability manifest was removed because copies of the template failed whenever it drifted
from their skill folders; this design keeps the strict checks in the template only.
