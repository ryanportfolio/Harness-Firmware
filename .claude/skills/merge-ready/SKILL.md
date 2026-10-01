---
name: merge-ready
description: "Review loop that brings an open PR to merge-ready: /codex-fullreview and /codex-review in parallel, fix confirmed findings, then rerun /codex-review until clean (3 reruns max). Use on /merge-ready or when /merge calls it. Does not merge."
---

# Merge-ready review loop

Bring one open PR to merge-ready through cross-vendor review. This skill reviews, fixes, commits, and pushes to the PR branch. It never merges, never enables auto-merge, and grants no merge authority; the caller (the user, or a personal `/merge` skill) decides that.

## Authorization

Invoking this skill, directly or through `/merge`, authorizes:

- the two first-round Codex runs and up to 3 `/codex-review` reruns, each billed to the user's Codex subscription;
- fixes for confirmed findings inside the PR's scope, committed and pushed to the PR branch.

The review skills' rule that a review does not authorize fixes is lifted here for in-scope fixes only. Scope growth, design changes the PR did not make, force-pushes, and merging stay unauthorized.

## Preconditions

- An open PR whose head is pushed, and no uncommitted changes that belong to it. Record the PR number, target branch, and head SHA.
- Codex is reachable by a route the review skills accept: `codex login status` reports a ChatGPT login, or `config.toml` in `$CODEX_HOME` (default `~/.codex`) sets `model_provider` to a gateway. If neither holds, stop and report it. Never substitute a self-review and call the gate passed.

## Round 1: two reviews in parallel

Run `git fetch origin <target>` and scope both runs to the PR's branch diff against `origin/<target>` at the recorded head SHA.

Launch `/codex-fullreview` and `/codex-review` on that scope at the same time. Each skill's contract applies in full: preflight, background launch, its own run directory, its one automatic retry, and verification of every finding. Keep each run's evidence tied to its own run ID and Codex session ID, because both runs write to the same Codex sessions folder at once.

If either run still fails after its retry, stop and ask. The gate does not pass on the other run alone.

A run that exits cleanly can still be incomplete, and an incomplete run does not count toward the gate. Each round's run needs verified scope identity, as its skill defines it. `/codex-fullreview` also needs at least one spawned sub-reviewer: zero means the Manager reviewed alone, which is a single-context review, not the full one. Treat an incomplete run like a failed one: keep its verified findings, then stop and ask.

## Triage

Edit nothing while any review in the round is still running. Reviewers read the working tree as well as the diff, so a fix made mid-review changes what a still-running reviewer sees and breaks its scope. Verify findings as each run finishes, but hold every fix until the last run in the round has finished; then the round's fixes go in one commit and one rerun.

Merge the two verified finding lists and drop duplicates (same location, same defect). Then:

- Confirmed 🔴 or 🟡: fix.
- Kept with caveat: fix when the residual risk is real; otherwise record why it stays.
- Confirmed 🟢: fix when the fix is small and inside scope, but only in a round that already needs a rerun. In a round with no 🔴 or 🟡 to fix, list the 🟢 findings in the report and leave the head unchanged; they never trigger a rerun on their own.
- Refuted: drop, and list under "checked and fine".
- A fix that needs a user decision (behavior change, tradeoff, scope growth): ask. The user may waive the finding; record the waiver.

Fix each finding at its cause, run the project's relevant local checks, commit with a message that names the findings, and push. Leave unrelated work alone.

## Rerun loop

The PR is merge-ready when the latest review round, run on the current head, confirmed no 🔴 or 🟡 finding (waived findings excluded). When round 1 meets that bar, no rerun is needed.

Any commit this loop pushes, including a caveat fix, moves the head and needs another round. After pushing the fixes, run `/codex-review` alone on the full PR diff at the new head, not only the fix delta. Triage, fix, push, and repeat.

- Cap: 3 reruns after round 1. Check the remaining budget before any fix or review. Once the 3rd rerun has run, push no more commits and start no more reviews; if anything still calls for a fix (🔴, 🟡, or a caveat with real risk) or the head has moved, report `blocked` with the open items. The user can fix by hand, waive, or authorize more reruns.
- Commits this loop did not make (another session, a teammate) are reviewed by the next round, which counts toward the cap.
- If the head moves after a clean round, the verdict no longer holds; run another `/codex-review` round if the budget allows, otherwise report `blocked`.

## Report

For each round: source attribution as the review skill presents it, findings that survived verification, fix commit SHAs, and waived findings with reasons. End with one line: `merge-ready at <head SHA>`, or `blocked` with the open findings. The verdict covers review only; the caller still checks CI before merging.
