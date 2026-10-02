---
name: merge
description: "Merge PRs through a Codex review loop: /codex-fullreview, fix, then /codex-review reruns (3 max) until clean, then CI and squash-merge. Runs only when the user types /merge; from then on, every PR in the session goes through the same loop and merges."
disable-model-invocation: true
---

# Merge through the Codex review loop

Take a PR from finished work to merged: commit, push, open or reuse the PR, run the Codex review loop, check CI, and squash-merge. The same file lives in a repository at `.claude/skills/merge/SKILL.md` and globally at `~/.claude/skills/merge/SKILL.md`; the two copies are identical.

## Merge mode

Only the user starts this skill, by typing `/merge`. Never start it on your own initiative, even when a PR looks ready.

Typing `/merge` turns on merge mode for the rest of the session. Say so in plain prose when it turns on ("Merge mode is on for this session: every PR goes through the Codex loop and merges when clean"), so the mode is still on record after the conversation is summarized. While it is on:

- The PR in front of you when the user typed `/merge` goes through every step below.
- Every later PR the session opens or updates goes through the same steps and merges without another prompt. Before each one, read this file again; after a summary, its text may no longer be in context.
- Each PR gets its own review loop and its own rerun budget.

Merge mode ends when the user says so ("stop merging", "stop merge mode", "don't merge this one"), when the user switches to `/main`, or when the session ends. A request to hold one PR holds only that PR.

## Authorization

Merge mode authorizes, for each PR:

- committing the finished work, pushing it, and opening or reusing its PR;
- one `/codex-fullreview` run and up to 3 `/codex-review` reruns, each billed to the user's Codex subscription;
- fixes for confirmed findings inside the PR's scope, committed and pushed to the PR branch;
- the squash-merge, once the review loop and CI both pass at the same head.

The review skills' rule that a review does not authorize fixes is lifted here for in-scope fixes only. Scope growth, design changes the PR did not make, force-pushes, admin bypasses, and direct pushes to the target branch stay unauthorized. A reached rerun cap blocks that PR only; merge mode stays on for the others.

## Requirements

- The `codex-review` and `codex-fullreview` skills, from the repository's `.claude/skills/` or from `~/.claude/skills/`. If either is missing, stop and say so.
- Codex reachable by a route the review skills accept: `codex login status` reports a ChatGPT login, or `config.toml` in `$CODEX_HOME` (default `~/.codex`) sets `model_provider` to a gateway. If neither holds, stop before merging and report it. Never substitute a self-review and call the gate passed.

## Step 1: Integrate

1. Inspect the repository, remote, branch, working changes, and any existing PR. Take the target branch from the task or the repository default. Preserve unrelated work. On a detached HEAD or on the target branch, create a task branch before committing; respect a branch the user chose. Do not modify another checkout without authorization.
2. Run the relevant local checks. Stage explicit paths, inspect the staged diff, commit, and push. Never bypass hooks. Reuse the branch's open PR (`gh pr list --head <branch>`); otherwise create one whose description covers final behavior and validation. Pass multiline bodies through a file. Verify the PR's base, head, and remote.
3. Fetch the target branch and check mergeability. Resolve unambiguous conflicts, keeping both changes' intent. Investigate semantic conflicts; ask only when a resolution needs a decision the user has not made. Reverify affected behavior and push.

Record the PR number, target branch, and head SHA.

## Step 2: Review loop

Run `git fetch origin <target>` before each round and scope every run to the PR's full branch diff against `origin/<target>` at the current head SHA. Each review skill's contract applies in full: preflight, background launch, its own run directory, its one automatic retry, and verification of every finding.

**Round 1: `/codex-fullreview`.** One run on the full PR diff. It must spawn at least one sub-reviewer; zero means the Manager reviewed alone, which is a single-context review, not the full one. A run that fails after its retry, or that lacks verified scope identity as its skill defines it, does not count: keep its verified findings, then stop and ask.

**Reruns: `/codex-review`.** After any round that pushed a commit, run `/codex-review` alone on the full PR diff at the new head, not only on the fix delta. Same counting rule: a failed or incomplete run stops the loop and asks.

**Triage, after each round finishes.** Edit nothing while a review is running: reviewers read the working tree as well as the diff, so a mid-review fix changes what they see. Then:

- Confirmed 🔴 or 🟡: fix.
- Kept with caveat: fix when the residual risk is real; otherwise record why it stays.
- Confirmed 🟢: fix when the fix is small and inside scope, but only in a round that already needs a rerun. In a round with no 🔴 or 🟡 to fix, list the 🟢 findings in the report and leave the head unchanged; they never trigger a rerun on their own.
- Refuted: drop, and list under "checked and fine".
- A fix that needs a user decision (behavior change, tradeoff, scope growth): ask. The user may waive the finding; record the waiver.

Fix each finding at its cause, run the relevant local checks, commit the round's fixes in one commit whose message names the findings, and push. Leave unrelated work alone.

**When the loop ends.** The review passes when the latest round, run on the current head, confirmed no 🔴 or 🟡 finding (waived findings excluded). If round 1 passes, no rerun is needed.

- Cap: 3 `/codex-review` reruns after round 1. Check the remaining budget before any fix or review. Once the 3rd rerun has run, push no more commits and start no more reviews; if anything still calls for a fix (🔴, 🟡, or a caveat with real risk) or the head has moved, the PR is `blocked`: stop, report the open items, and leave the PR unmerged. The user can fix by hand, waive, or authorize more reruns.
- Commits this loop did not make (another session, a teammate) are reviewed by the next round, which counts toward the cap.
- If the head moves after a passing round, the verdict no longer holds: run another `/codex-review` if the budget allows, otherwise the PR is `blocked`.

## Step 3: CI

Inspect **all PR checks** with `gh pr checks <number> --json name,bucket,state,workflow,link` or the current equivalent. Wait for pending checks with bounded monitoring. Diagnose failed checks and fix them in scope; a CI fix moves the head, so it goes back through a `/codex-review` round within the same budget. Do not rely only on branch protection or `MERGEABLE`. Verify the expected workflows actually ran. Absent, skipped, or unavailable required checks do not count as passing: explain them and hold the merge unless the repository's established verification contract allows that outcome. A repository with no CI can use its local verification contract, with that limit reported. Never bypass checks with admin options.

## Step 4: Merge

1. Re-read the PR head. If it differs from the head the review loop and CI both passed at, go back to Step 2: the verdict covers only the head it saw.
2. Squash-merge unless the user or the repository says otherwise: `gh pr merge <number> --squash --match-head-commit <verified-head>`. If no head guard is available, say so and use a guarded API or hold the merge; never merge commits nobody reviewed.
3. Confirm the PR shows as merged and fetch the target branch to see the merge commit. Keep the branch unless the user asked for cleanup. Start the next change on a new task branch from the updated target, keeping uncommitted work.

Never reset unrelated work, force-push, or push directly to the target branch. On an interruption, inspect the real Git and PR state before retrying; a lost command response does not mean the write failed. Pause only the blocked action, finish independent authorized work, and report the exact blocker.

## Report

For each PR: each review round with source attribution as the review skill presents it, the findings that survived verification, fix commit SHAs, waived findings with reasons, and the CI result. End with one line: `merged <PR URL> at <head SHA>`, or `blocked` with the open items.
