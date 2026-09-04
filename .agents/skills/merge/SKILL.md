---
name: merge
description: "Commit, push, and merge completed work when requested. Session-wide auto-merge requires an explicit request for that persistent mode."
---

# Merge verified work

Determine whether authorization covers this change only or every completed task in this session. A one-time "merge when ready" does not enable a persistent mode. Announce session mode plainly when explicitly enabled; "stop merge" disables it. Preserve existing authorization without asking again.

## Prepare the exact change

Inspect working changes, branch, HEAD, remote and applicable verification. Preserve unrelated files. Resolve the remote default branch rather than assuming its name. Refresh the remote base before integration.

From detached HEAD or the default branch, create a feature branch using the repository's prefix. After a previous squash merge, keep that old branch and start the next change from the updated remote base; do not merge main back into stale squash history. Preserve uncommitted work while changing bases. If moving it would overwrite user changes, stop and explain the concrete conflict.

Run the checks relevant to the actual changes and project requirements. If the base moves or conflict resolution changes the result, rerun affected checks. Resolve clear mechanical conflicts; ask about genuinely ambiguous competing behavior. Do not claim a check ran from a reviewer's summary alone.

Stage exact paths and inspect the staged diff before committing. Verify destination identity and access before pushing. Use the configured repository and existing credentials; never change remotes or access controls to bypass a denial. Write multiline PR text to a file and pass --body-file. The PR describes final behavior, validation, and material limits.

## Close the merge gate

Record the candidate head SHA. Inspect the PR's base, head, review requirements, mergeability and checks. MERGEABLE establishes absence of merge conflicts, not CI success. Wait for applicable checks to finish and require their successful outcomes. Missing or pending required evidence keeps this gate open. Fix scoped failures when authorized; report external or permission blockers. Do not bypass protections with --admin.

Use a squash merge unless the user or project specifies otherwise, binding it to the verified head with gh pr merge NUMBER --squash --match-head-commit SHA. Recheck a changed head before retrying. Do not force-push, push directly to the default branch, or delete branches/worktrees as part of merging.

After success, query the PR's merged state and merge commit, fetch the remote base and verify the intended files landed. Report the PR link and actual checks. A frontend build does not imply a packaged release or deployment. No automatic release follows a merge.
