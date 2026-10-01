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
- `codex login status` succeeds. If Codex is unavailable, stop and report it. Never substitute a self-review and call the gate passed.

## Round 1: two reviews in parallel

Run `git fetch origin <target>` and scope both runs to the PR's branch diff against `origin/<target>` at the recorded head SHA.

Launch `/codex-fullreview` and `/codex-review` on that scope at the same time. Each skill's contract applies in full: preflight, background launch, its own run directory, its one automatic retry, and verification of every finding. Keep each run's evidence tied to its own run ID and Codex session ID, because both runs write to the same Codex sessions folder at once.

If either run still fails after its retry, stop and ask. The gate does not pass on the other run alone.

## Triage

Merge the two verified finding lists and drop duplicates (same location, same defect). Then:

- Confirmed 🔴 or 🟡: fix.
- Kept with caveat: fix when the residual risk is real; otherwise record why it stays.
- Confirmed 🟢: fix when the fix is small and inside scope. A round with only 🟢 findings never triggers a rerun.
- Refuted: drop, and list under "checked and fine".
- A fix that needs a user decision (behavior change, tradeoff, scope growth): ask. The user may waive the finding; record the waiver.

Fix each finding at its cause, run the project's relevant local checks, commit with a message that names the findings, and push. Leave unrelated work alone.

## Rerun loop

The PR is merge-ready when the latest review round, run on the current head, confirmed no 🔴 or 🟡 finding (waived findings excluded). When round 1 meets that bar, no rerun is needed.

Otherwise, after pushing the fixes, run `/codex-review` alone on the full PR diff at the new head, not only the fix delta. Triage, fix, push, and repeat.

- Cap: 3 reruns after round 1. If the 3rd rerun still confirms a 🔴 or 🟡, stop before fixing it and report the open findings. The user can fix by hand, waive, or authorize more reruns.
- Commits this loop did not make (another session, a teammate) are reviewed by the next round, which counts toward the cap.
- If the head moves after a clean round, the verdict no longer holds; run another `/codex-review` round.

## Report

For each round: source attribution as the review skill presents it, findings that survived verification, fix commit SHAs, and waived findings with reasons. End with one line: `merge-ready at <head SHA>`, or `blocked` with the open findings. The verdict covers review only; the caller still checks CI before merging.
