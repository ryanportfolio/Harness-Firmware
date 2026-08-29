---
name: adopt-repo
description: "Mirror an existing external repo privately under the user's account and overlay the firmware: clone upstream, strip template-only files, privacy-sweep, run init-project. Use on /adopt-repo <url> or 'pull this repo into our firmware'."
---

# adopt-repo: overlay the firmware onto an existing repo

The generator (`bootstrap/new-claude-project.*`) spawns empty projects. This skill is the other entry point: a repo that already exists elsewhere (a take-home exercise, a client codebase, a fork target) becomes a harness-equipped copy under the user's account, with upstream history preserved as the root.

## Inputs

Ask only for what the invocation left out: upstream URL, target repo name (default: upstream's name), visibility (default: private). Confirm the target name is free (`gh repo view <owner>/<name>` should fail) before creating anything.

## Steps

1. **Clone upstream** to a short path. Not a session scratchpad or other deep temp directory: Windows checkouts lose files past 260 chars when `core.longpaths` is off, and the loss is silent if clone output is piped. After cloning, compare `git ls-files | wc -l` against the upstream tree count.
2. **Create and push the mirror.** `gh repo create <owner>/<name> --private`, `git remote set-url origin <new-url>`, add the source as an `upstream` remote, `git push -u origin <default-branch>`. Upstream history stays intact as the root; reviewers and future diffs read the adopted work against the original base.
3. **Overlay the firmware.** Shallow-clone the template (also to a short path). Read `TEMPLATE_ONLY_PATHS` from `bootstrap/new-claude-project.sh` in that clone and strip those paths plus the template `README.md` and any `.tmp*` directories; do not keep a private copy of the list, the script is the source of truth. Copy the rest over with these collision rules: the adopted repo's own files always win (`README.md`, manifests, configs); `.gitignore` is merged by appending the template's entries under a `# Harness` comment; report any other collision instead of resolving it silently.
4. **Privacy sweep before committing.** The overlay may travel to reviewers or clients. Grep it for email addresses, personal names, client or project identifiers, and key/secret/token patterns; exclude generic prose hits. Anything real stays out and gets reported.
5. **Commit the overlay** as its own commit (subject notes the template and that template-only files were stripped), push. Honor any commit-tagging convention the adopted repo's context imposes.
6. **Run the `init-project` skill.** It fills CLAUDE.md's FILL IN sections from the detected stack, seeds `.claude/reference/`, applies the skill profile, syncs Codex adapters, and wires the `starter` remote.
7. **Verify.** No `FILL IN` markers remain; tracked file count equals upstream's plus the overlay; upstream's own files byte-identical to their origin (`git diff upstream/<branch> -- <their paths>` is empty).

## Hard rules

- Never force-push; never rewrite the upstream history that forms the base.
- Never modify upstream-pinned dependencies or build config during adoption; adoption adds the harness, nothing else.
- Fork only when the user explicitly wants the public upstream link and accepts that a fork of a public repo cannot be private; otherwise this clone-and-push flow is the default.
