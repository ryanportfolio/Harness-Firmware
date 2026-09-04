---
name: merge
description: "Use when the user explicitly requests a merge or enables session-wide automatic commit, push, PR, and merge. A one-shot request does not enable persistent publication."
---

# Merge verified work

Determine authorization first. A plain merge request applies to the current work only.
Enable persistent auto-merge only when explicitly requested as a session-wide mode; announce
that scope in plain prose. Stop it when the user asks or the session ends. A skill mentioning
merge does not grant publication authority. Reading or editing this skill does not activate it.

## Integration

1. Inspect repository, remote, branch, working changes, and existing PR. Confirm the target
   branch from the task or repository default. Preserve unrelated work. For detached HEAD
   or work on the target branch, create a task branch before committing; respect any branch
   explicitly chosen by the user. Do not modify another checkout without authorization.
2. Complete relevant local checks. Stage explicit paths, inspect the staged diff, commit,
   and push. Never bypass hooks. Reuse the branch's open PR; create one if needed with a
   description of final behavior and validation. Pass multiline bodies through a file or
   structured argument. Verify PR base, head, and remote before continuing.
3. Fetch the target branch and inspect mergeability. Resolve unambiguous conflicts while
   preserving both changes' intent. Investigate semantic conflicts; ask only when resolution
   needs a missing user decision. Reverify affected behavior and push before checking CI.
4. Inspect **all PR checks** with `gh pr checks --json name,bucket,state,workflow,link` or
   the current equivalent. Wait for pending checks with bounded monitoring. Diagnose failed
   checks and fix in scope; do not rely only on branch protection or MERGEABLE. Verify the
   expected workflows actually ran. Explain absent, skipped, or unavailable required checks;
   they do not count as passing.
   Defer merging while a required check is absent, skipped, or unavailable unless the
   established verification contract explicitly permits that outcome.
   A repository with no CI can use its established local verification contract, with that
   limit reported. Never bypass checks with admin options.
5. Re-read the PR head after checks. If it changed, verify the new content and checks again.
   Squash is this repository's default unless the user or target repository specifies
   otherwise. Use `gh pr merge <number> --squash --match-head-commit <verified-head>` when
   supported. If no atomic head guard exists, disclose that limitation and use a supported
   guarded API or defer; do not silently merge unverified new commits.
6. Verify the PR is merged and fetch the target ref to confirm the merge commit. Report
   the PR and observed result. Keep the branch unless cleanup was requested. After squash, start the next change on a new
   task branch from the updated target while preserving uncommitted work. Never reset
   unrelated work, force-push, or push directly to the target branch.

Use current tool help for unavailable options. On interruption, inspect actual Git and PR
state before retrying; a lost command response does not mean the write failed. Pause only
the blocked action, finish independent authorized work, and report the exact blocker.
