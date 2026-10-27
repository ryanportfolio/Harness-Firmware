---
name: "merge"
description: "$merge only: self-review, Opus loop, CI, squash-merge."
---

# Merge via Opus review loop

Codex port of Claude `merge` skill. Finished work → merged PR: commit, push, open/reuse PR, self-review, Opus loop through Claude CLI, CI, squash-merge. Reviewer = Claude Opus → cross-vendor from Codex; say so in report. Same file at repo `.agents/skills/merge/SKILL.md` + global `~/.codex/skills/merge/SKILL.md`; copies identical.

## Merge mode

User-only start: user types `$merge`. Never self-start, even if PR looks ready.

`$merge` → merge mode ON for rest of session. Announce in plain prose ("Merge mode is on for this session: every PR gets a self-review, then the Opus review loop, and merges when clean") so mode survives compaction. While ON:

- Immediately: every still-open PR this session opened or pushed to → all steps below, one PR at a time. Finished work w/o PR → Step 1 opens one. PRs session never touched → untouched unless user names them.
- After: every PR session opens/updates → same steps → merge, no further prompt. Re-read this file before each; post-compaction, text may be gone from context.
- Each PR: own loop, own rerun budget.

Mode OFF when: user says so ("stop merging", "stop merge mode", "don't merge this one") or session ends. Hold on one PR → holds that PR only.

## Authorization

Per PR, mode authorizes:

- commit finished work, push, open/reuse PR;
- 3 self-review agents before Opus round 1 (Step 2), plus again before a rerun when Step 3's large-fix rule applies;
- 1× `$opus-fullreview` + ≤3 Opus reruns (`$opus-review`), each billed to user's Claude subscription or Max account pool; mode = user's OK for these reruns, which review skills otherwise ask for;
- sending scoped PR diff + needed context to Anthropic, as review skills already describe;
- in-scope fixes for confirmed findings, committed + pushed to PR branch;
- squash-merge once review loop + CI both pass at same head.

Review skills' "review ≠ fix authority" rule lifted for in-scope fixes only. Still NOT authorized: scope growth, design changes PR didn't make, force-push, admin bypass, direct push to target, paid usage credits, ultrareview, model fallback. Cap hit → that PR blocked; mode stays ON for others. Host or managed-policy rejection stays binding: report it, don't route around it.

## Requirements

- `opus-fullreview` skill: repo `.agents/skills/` copy wins over `~/.codex/skills/`. Missing → stop, say so. It also needs `.claude/skills/impartial-review/SKILL.md` in the reviewed repo: check before Step 1, missing → stop, say so (round 1 can't run).
- Rerun reviewer: `opus-review` (repo `.agents/skills/` first, then `~/.codex/skills/`). Not installed → `$claude-review` with `--model opus --effort high`, the repo's standing Opus review; say which ran. Fallback extra check: `ANTHROPIC_DEFAULT_OPUS_MODEL` absent from child env (presence only, never print value), since `claude-review`'s preflight checks only the Fable override; present → stop, say so. Fallback's resolved model stays unverified: report it that way. Neither reviewer → stop, say so.
- Named review skills are invoked from this skill, not typed by user: open each one's `SKILL.md` and follow it in full; don't rely on the `$name` mention loading it.
- Each review skill's own fail-closed preflight passes (subscription routing proven, no provider overrides, no billing prompt). Fails → stop before merge, report. Never substitute self-review + call gate passed.
- Multi-agent tools for Step 2: inspect current tools; `multi_agent = true` alone ≠ proof. None exposed, or no fresh-context spawn option → say so, skip to Step 3; Opus loop still runs in full. Never replace the 3 reviewers with main-thread self-review and call Step 2 done.

## Step 1: Integrate

1. Inspect repo, remote, branch, working changes, existing PR. Target = task's or repo default. Keep unrelated work. Detached HEAD / on target → task branch before commit; respect user-chosen branch. Don't touch other checkouts w/o authorization.
2. Run relevant local checks. Stage explicit paths, inspect staged diff, commit, push. Never bypass hooks. Reuse branch's open PR (`gh pr list --head <branch>`); else create one, description = final behavior + validation. PR changes flows, boundaries, data model or state → description adds short Mermaid diagram of changed structure (GitHub renders it), so owner reads diagram instead of diff; repo keeps `.claude/reference/architecture.md` → same diagram there, same PR. No structural change (copy, styling, docs, config) → no diagram. Multiline bodies via file. Verify PR base, head, remote.
3. Fetch target, check mergeability. Resolve unambiguous conflicts, keep both sides' intent. Semantic conflicts → investigate; ask only if resolution needs user decision not yet made. Reverify affected behavior, push.

**Destination trust**, before session's first push to this repo. Print no credentials:

- Push remote: `git remote get-url --push --all origin | sed -E 's#://[^/@]*@#://#'`. Pipe strips a token embedded as `https://<token>@github.com/...` before output reaches transcript; never run it unpiped. More than 1 URL → stop, ask: `git push origin` sends to every URL, check covers only one.
- Active GitHub login only: `gh api user --jq .login`.
- Destination: `gh repo view --json nameWithOwner,visibility,viewerPermission,url`.
- Push remote must normalize to returned `nameWithOwner`; `viewerPermission` must be `WRITE`, `MAINTAIN`, or `ADMIN`.
- Include verified login, repo, visibility, permission, and `gh repo view` URL in every `git push` approval request. Generic "push the branch" not enough: approver can't infer destination owner or privacy.
- Every push names checked remote + PR head branch: `git push origin HEAD:refs/heads/<branch>`, `-u` only on branch's first push. Bare `git push` can follow `remote.pushDefault` or `branch.<name>.pushRemote` to an unchecked remote; refspec w/o destination (`HEAD`) can follow `remote.origin.push` or local branch name to wrong branch.
- Later pushes this session reuse the evidence only while push URL list unchanged.
- Remote not GitHub, queried repo does not match push remote, write permission absent, or check can't run → stop, ask user. Never weaken approvals or route around denial.

Record PR number, target, head SHA.

## Step 2: Self-review

Goal: find + fix what Opus would find, so Opus rounds come back clean more often. Extra layer before Opus, never replaces it: Step 3 runs in full whatever self-review found. Reviewers share author's vendor → fresh context, not vendor independence.

**Areas.** Split change into 3 areas from what PR + session actually involve. Each area = distinct code paths or concerns, little overlap. Examples:

- crawler/CLI: fetching + IO; parsing + rule logic; comparison/diff output + docs.
- UI: behavior + states + edge cases; accessibility + layout; docs + tests.
- docs/skill-only PR: changed files or contracts a reviewer can check against the rest of the repo, grouped into 3.

More files or concerns than 3 → group them. Fewer distinct areas than 3 (tiny PR) → split whole diff by lens instead: false success; common real inputs + error paths; docs vs code.

**Launch.** Spawn 3 agents concurrently with the exposed multi-agent tools, then wait for all 3 results. Fresh context each: spawn with `fork_turns: "none"` or the runtime's fresh-context equivalent. Omitting `fork_turns`, or `"all"`, forks full history → reviewer shares author's reasoning, no longer fresh. Each brief standalone, reviewer has no session context:

- scope: repo path, base = `git merge-base origin/<target> <head>` SHA (not `origin/<target>` tip: once target moves, two-dot diff from tip shows target's new commits as PR reverts), head SHA, `git diff <base>..<head>` as the diff;
- files to read + area to cover; other 2 areas named, running in parallel, so it stays in its own;
- browser work (if any): own headed Chrome per reviewer (repo's `launchPlacedChrome()` or `--window-position=-2400,-2400`), `--mute-audio`; never share one browser between reviewers;
- bug classes in priority order: false success (reports pass/clean/done when it isn't), then wrong results on common real inputs, then crashes;
- what earlier rounds already fixed (this session's fix commits + findings), so it hunts new bugs;
- rules: reproduce every bug before reporting it; fixtures + scratch only under `.tmp/selfreview/<area>/`; never edit repo files, never commit, never push, no nested agents or reviews;
- return: confirmed findings, each w/ severity (BLOCKING / SHOULD-FIX / NITPICK), file:line, reproduction (command + observed vs expected), suggested fix; then separate list of unconfirmed suspicions.

**While running.** No edits, commits, or pushes: reviewers read working tree. Wait for all 3. Reviewer errors, returns nothing, or report cut off → relaunch that area once, same Launch settings; fails again → area uncovered: say so in report, never count it as clean.

**Triage.** Session verifies each reported finding itself (rerun reproduction or read code); reviewer's word ≠ proof. Then:

- Confirmed, in scope → fix at cause, any severity.
- Unconfirmed suspicion → quick check; confirmed → fix, else note in report.
- Refuted → drop, list under "checked and fine".
- Fix needs user decision (behavior change, tradeoff, scope growth) → ask.

All self-review fixes = 1 commit naming findings. Rerun relevant existing local checks for each fix, push. Record head SHA → next Opus round reviews it (round 1, or the rerun a mid-loop self-review precedes). 0 confirmed → no commit, go to that round.

Self-review costs no Opus budget. Doesn't count as an Opus round.

## Step 3: Opus review loop

Each round: `git fetch origin <target>`, scope = full PR branch diff from `git merge-base origin/<target> <head>` to current head SHA; state that base in each review's scope. Each review skill's contract applies in full: preflight, own run dir, monitoring, verify every finding. Opus review skills have no automatic retry: failed, empty, or incomplete run → keep verified findings, stop loop, report whether inference started, ask.

**Round 1: `$opus-fullreview`.** 1 run, full PR diff. Counts only when its Step 4 evidence verifies the impartial-review skill read and ≥1 sub-reviewer completed (final report delivered), not just started. 0 completed = Manager alone = single-context, not full review. "completion/count unverified", plain custom-prompt attribution, `Background tasks still running after … terminating` in its log, or lacks verified scope identity (per its skill) → doesn't count: keep verified findings, stop, ask.

**Reruns: `$opus-review`** (or `$claude-review` with Opus per Requirements). After any round that pushed a commit → 1 rerun alone, full PR diff at new head, not just fix delta. Same rule: failed/incomplete → stop loop, ask.

**Triage, after round finishes.** No edits while review runs: reviewer reads working tree too, mid-review fix changes what it sees. Then:

- Confirmed BLOCKING / SHOULD-FIX → fix.
- Kept w/ caveat → fix if residual risk real; else record why it stays.
- Confirmed NITPICK → fix if small + in scope, only in round already needing rerun. Round w/o BLOCKING / SHOULD-FIX → list NITPICKs in report, head unchanged; NITPICK never triggers rerun alone.
- Refuted → drop, list under "checked and fine".
- Fix needs user decision (behavior change, tradeoff, scope growth) → ask. User may waive; record waiver.

Fix at cause, run relevant local checks, round's fixes = 1 commit naming findings, push. Leave unrelated work alone.

**Self-check before each rerun.** Opus round found something → after fixing, before push: session itself checks for related cases of same bug kind (same input class, same pattern in sibling code paths, same missing guard elsewhere). Reproduce each one found, fix in same commit. Goal: rerun doesn't find the sibling of a bug just fixed. Full 3-reviewer self-review (Step 2) only before round 1, plus again before a rerun when fixes are large (new module or code path, rewrite of a core function, or fix delta bigger than the original change in that area). Then: commit round's fixes locally, no push; run Step 2 on that head so reviewers see the fixes; its fixes = 2nd commit; push both together. Rerun budget unchanged.

**Loop end.** Pass = latest round, on current head, confirmed 0 BLOCKING / SHOULD-FIX (waived excluded). Round 1 passes → no rerun.

- Cap: 3 reruns after round 1. Check budget before any fix/review. After 3rd rerun: no more commits, no more reviews; anything still needing fix (BLOCKING, SHOULD-FIX, real-risk caveat) or head moved → PR `blocked`: stop, report open items, leave unmerged. User can hand-fix, waive, or authorize more reruns.
- Commits loop didn't make (other session, teammate) → reviewed by next round, counts toward cap.
- Head moves after passing round → verdict void: another rerun if budget allows, else `blocked`.

## Step 4: CI

Inspect **all PR checks**: `gh pr checks <number> --json name,bucket,state,workflow,link` or current equivalent. Pending → bounded wait. Failed → diagnose, fix in scope; CI fix moves head → back through a rerun round, same budget. Don't trust branch protection or `MERGEABLE` alone. Verify expected workflows actually ran. Absent/skipped/unavailable required check ≠ pass: explain, hold merge unless repo's established verification contract allows. No-CI repo → local verification contract, report that limit. Never admin-bypass checks.

## Step 5: Merge

1. Re-read PR head. ≠ head where loop + CI both passed → back to Step 3; verdict covers only head it saw.
2. Squash unless user/repo says otherwise: `gh pr merge <number> --squash --match-head-commit <verified-head>`. No head guard available → say so, use guarded API or hold; never merge unreviewed commits.
3. Confirm PR merged, fetch target, see merge commit. Keep branch unless user asked cleanup. Next change → new task branch from updated target, keep uncommitted work.

Never reset unrelated work, force-push, or push direct to target. Interrupted → inspect real Git + PR state before retry; lost response ≠ failed write. Pause only blocked action, finish independent authorized work, report exact blocker.

## Report

Per PR: self-review first: areas that returned a usable report (N of 3; name any uncovered area, or "skipped: no agent tools"), confirmed findings (severity + 1 line each), fix commit SHA (or "0 confirmed"), suspicions left unconfirmed; any later full self-review same way, and each pre-rerun self-check's extra fixes in that round's line. Then each Opus round w/ source attribution as review skill presents it (cross-vendor: Claude reviewed Codex-written code), which skill ran reruns, surviving findings, fix commit SHAs, waivers + reasons, CI result. End w/ 1 line: `merged <PR URL> at <head SHA>`, or `blocked` + open items.

After merges land (each time no PR in flight is still pending), close w/ **ELI5 recap**: super-short bullets, plain words a 5-year-old gets, no jargon/SHAs/skill names, not caveman. One bullet per merged PR = what it's for; one bullet = what session did overall. Example:

- PR #12: the save button works again.
- PR #13: the page loads faster.
- Overall: fixed two things people kept tripping on.
