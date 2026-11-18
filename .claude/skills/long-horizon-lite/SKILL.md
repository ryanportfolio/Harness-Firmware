---
description: "long-horizon, lighter: fresh executor per step, parallel where safe, a branch + merge per round as baseline, Codex audits at the end of each major section (Sol per round + Astra per section, run together). Use: /long-horizon-lite. Writes outside the repo or no Codex → long-horizon."
disable-model-invocation: true
---

# long-horizon-lite: Git-tracked rounds, Codex audits at section end

Roles: Manager (this ctx) holds goal + state file, delegates every round. Executor = fresh Claude subagent, one step per round. Auditor = Codex, never Claude. Lighter than `long-horizon` b/c Git carries the bookkeeping: each round works on its own branch and enters the task branch as one merge commit, which replaces hash manifests and copying files by manifest; one Codex run replaces the fresh auditor subagent; audits wait for the end of a major section and run together. Discussing/editing this skill does not activate it.

## Use the full skill instead

`long-horizon` when any holds:

- a step writes outside the repo, or its deliverable is a gitignored file (a commit can't hold it);
- workspace is not a Git repo;
- Codex is unavailable;
- every step must be audited before the next one builds on it.

Under ~3 dependent steps → `fable-mode` directly.

## Guardrails

- Typing `/long-horizon-lite` is the user's OK for this task's Codex runs: one Sol run per merged round and one Astra run per major section, all launched at section end. Each run bills the user's Codex subscription, so before round one tell the user the expected minimum (steps + sections) and that a second audit pass, a retried run, and the repo's own PR review add to it. Keep a running count in the state file.
- No Codex run mid-section. Never spend a Sol or Astra run on a single round, a draft, or a stalled step before its section ends.
- Codex unavailable, or an audit run fails twice → stop and tell the user. Never count a Claude subagent's review or the Manager's own reading as the audit.
- Models: round auditor = Sol, exact id + newest-Sol check per `codex-review` Step 1. Section auditor = Astra, exact id + newer-Astra check per `astra-review`. Both run at `model_reasoning_effort=high`, which overrides `astra-review`'s medium default. An explicit user model or effort choice wins. Rejected model → never drop `-m`; handle per `codex-review` Step 4.
- Explicit user round/time/cost limits binding; checkpoint before exceeding. Never weaken acceptance just to make a round or section pass.
- Never reset, force-push, or delete an unmerged branch without the user's OK.
- Invocation does not authorize publication, installation, deployments, or external messages.

## Manager context

Work happens in fresh contexts; this one stays small enough to last the whole task.

- Manager reads exit codes, counts, verdict lines, and executor reports. Never diffs, done-check logs, or audit report bodies: those pass between workers by file path.
- Every command the Manager runs sends its output to a file under the task dir and prints one line (exit code, match count, SHA).
- Executor brief asks for a report of 10 lines or fewer: changed paths, how to check, blockers.
- Anything that needs reading (a failing report, a log, a conflict) → a fresh subagent reads it and returns a short answer.

## Start

1. Contract: goal, numbered acceptance checks, steps (each sized so one fresh ctx finishes it: one slice, one migration, one bug), major sections. Section = contract milestone, or unit the user wants shipped as one PR; the user may regroup them. None named → whole task = one section. A bad step is found only when its section ends, so keep sections small: past ~6 steps, propose a split to the user.
2. Work on the task branch. `git status --porcelain` must print nothing before round one. Uncommitted user work → ask the user to commit it or set it aside; never stash, reset, or discard it yourself.
3. State file `.tmp/long-horizon-lite/<task-slug>/state.md`. Template + audit prompts: `references/state-and-prompts.md`; read it before creating the file and before a section's audits. `.tmp/` not gitignored in this repo → add it to `.git/info/exclude` first, else commits swallow state + evidence.

Resume after compaction/restart: read state, compare it w/ `git log`, `git branch --list "lh-lite/<task-slug>/*"` and `git worktree list`. State file changed in last 30 min by another session → ask the user before touching it. Continue each round's block from its phase, never by running an executor over existing work: `planned` (no worker recorded) → Branch; `executing` → confirm the worker stopped (not established → pause that round), then Scope check; `committed` → Gate; `gated` → Merge; `merged` → waits for section end. Section audits recorded → look at each run first: still running → wait; finished for its recorded SHAs → use it. A second paid run only when the recorded one failed.

## Round loop

Run max safe rounds at once. Each Plan: every ready step the batch rules allow gets its own round. Ready = every dependency in Provisional or Verified progress. Ready steps share a batch only if:

- write scopes don't overlap; neither reads a path the other writes;
- no two executions/done-checks contend for one resource: port, dev server, browser profile, DB, GPU, or a timing/perf measurement parallel load would skew;
- capacity covers Manager + every executor.

1. **Plan.** Per round, write a block in Current rounds: step, branch, workspace, done-check, Write scope. Done-check = command, folder relative to the repo root (a round worktree is gone by section end), expected exit code, and optionally one exact output line: the Manager compares these mechanically. Then write the round's audit prompt from the template, using contract + block only, and record its sha256 in the block. It is written before the executor exists, so no executor claim can reach it; it is never edited afterwards (section end fills a copy), so the hash shows any edit, which no diff would (the file sits in an ignored dir). Then executor brief: contract excerpt, the block's Step, Done-check and Write scope (never the audit prompt or its path), verified facts the step needs, dead ends touching it. Write these w/ file-edit tool; shell string layers drop backslashes + backticks.
2. **Branch.** Every round works on its own branch `lh-lite/<task-slug>/r<N>`, cut from the task branch tip. Batch of one → `git switch -c <branch> <task branch>` in the main workspace. Batch of two or more → a worktree each: `git worktree add -b <branch> <path> <task branch>`, `<path>` outside the repo folder; all later stages use absolute paths, state + evidence stay under the main workspace's task dir. Never Agent `isolation: "worktree"`: by default it cuts from the remote default branch and misses earlier rounds. New checkout has no ignored files (deps, build output) → install or link what the step needs. A recovery round reuses its round's branch + workspace: the earlier attempt's work stays, and none of it reaches the task branch.
3. **Execute.** Fresh subagent, brief alone, never `subagent_type: fork`; start a batch's executors in one msg. It follows `fable-mode`. Brief says: no commits, no branch switches, no writes under `.tmp/long-horizon-lite/`. Returns w/o promised work, or says it waits on helpers → resume it by message (SendMessage), not a new round.
4. **Scope check + commit.** Once the executor stopped writing: `git status --porcelain --untracked-files=all` in the round workspace vs Write scope.
   - A changed path outside Write scope → commit nothing. Show the user the paths and ask whose they are. The user's → they commit them or set them aside. The executor's → recovery brief tells the executor to restore them, or next Plan widens Write scope when the step needs them.
   - All inside → `git add -A`, commit `lh-lite round <N>: <step>`. Nothing to commit → the attempt failed its gate.
5. **Gate.** Manager runs the done-check in the round workspace → `evidence/round-<N>/gate-<attempt>.log`, then Clean tree (below). Exit code + expected line match → Merge. Mismatch → one recovery round, same approach, brief cites the log path. Second mismatch in a row → approach to Dead ends; the branch stays unmerged (batch of one: `git switch <task branch>`); a new approach is a new round on a new branch.
6. **Merge.** Once every round of the batch passed or failed its gate, one passed round at a time, in step order:
   1. Stop every process the round started. Worktree round: list links under it (`find <path> -type l`, junctions included), remove each w/ Node's `fs.unlinkSync` until the list is empty, then `git worktree remove <path>`, w/ `--force` only once no link is left, b/c forcing through a link deletes its shared target. The main workspace is on the task branch and passes Clean tree.
   2. `git merge --no-ff <round branch>` → the merge commit is the Round SHA. Conflict → `git merge --abort`; the step returns to Remaining as a new round from the new tip; not a Dead end.
   3. Done-check again on the task branch → `evidence/round-<N>/done-check.log` (the log the auditor gets), then Clean tree. It runs after step 1 so no server from the round can answer. `git diff --quiet <round branch> HEAD` exits 0 → same tree: copy the gate log, no rerun. Mismatch → `git revert -m 1 <Round SHA>`, step back to Remaining.
   4. Match → Provisional progress w/ Round SHA + log path; `git branch -d <round branch>`. The block stays in Current rounds, phase `merged`, until its section is audited: section end needs its prompt path, sha256 and Round SHA.

**Clean tree.** After every check the Manager runs (gate, merged, section acceptance) and before every merge, `git status --porcelain` in that checkout must print nothing. A check that changed or created non-ignored files = Plan defect: save `git diff` + the new files under `evidence/round-<N>/check-writes/`, restore the tree to its commit, correct the check at next Plan. Check output never gets a commit; generated files a step needs (snapshots, lockfiles) are the executor's work, inside Write scope. Stray files before a merge that no check made → show the user the paths; do not merge over them.

## Section end: all audits at once

Every step of a section in Provisional progress → on the task branch:

1. Manager runs the section's acceptance checks → logs under `evidence/section-<S>/`, then Clean tree. Last section: every acceptance check of the contract.
2. Audit list = the section's rounds in Provisional progress, one Sol run each. Failed attempts, dead ends, and unmerged branches get none.
3. Per listed round: recompute its frozen prompt's sha256. Mismatch with the block → do not dispatch it: rewrite the prompt from contract + block, note the tampering in the Audit log, and tell the user. Match → copy it into the new run dir and fill three facts in the copy, nothing else: base = `<Round SHA>^1`, Round SHA, done-check log path. The merge commit against its first parent is that step's whole change, every attempt included, and nothing of any other step. Write the Astra prompt over `<section base SHA>..HEAD`. Last section: `<task base SHA>..HEAD`, or its own section base when earlier sections shipped as PRs (the default branch has moved since the task base, so that diff would pull in unrelated merged work).
4. Launch together: one Sol run per listed round + one Astra run for the section. Custom-prompt `codex exec -s read-only`, prompt on stdin, background + poll, at most 4 Codex processes at a time. Record each run dir + process ID in state before waiting. Preflight, run metadata, model + effort from `run.log` header: per `codex-review` Steps 1, 3, 4.
5. Accept a report only when its process exited 0, it is non-empty, it opens with every verdict line (ignore surrounding whitespace; a value may carry a suffix, e.g. `blocked: invalid check`), and its SHAs still hold: a Round SHA is still an ancestor of HEAD, and the section's head SHA still equals HEAD. Else failed run: one retry in a new run dir, same prompt, then stop.

Sol judges one step: `STATUS` complete / incomplete / blocked (`blocked: invalid check` = broken done-check), `INTEGRITY` clean / suspect / violation (diff outside Write scope, or touching test or gate definitions the step didn't own → `suspect` at best), `CONTRACT` aligned / drifted. Astra judges what a per-step audit cannot see: do the steps work together, did a later round regress an earlier one, did the work drift from the contract.

Every listed round complete + clean + aligned, and section pass + aligned → the section's steps move to Verified progress w/ report paths; archive their blocks to the Audit log. Anything else:

- One fresh subagent reads the failing reports and reproduces each finding before planning anything. Reproduced → a fix step, 6 lines or fewer: step, Write scope, done-check, finding reference (`<report path>#<n>`). Not reproduced → it returns the finding w/ the output that contradicts it; the Manager cannot overrule the auditor: show the user both and let the user decide.
- Fix steps go to that section's Remaining and run as normal rounds; each fix round's audit prompt cites its finding reference. `invalid check` → the fix is a corrected check: no code change needed → no executor; the Manager reruns the corrected done-check at HEAD and writes that round a new prompt.
- Then one more pass: Sol on the fix rounds and on rounds given a new prompt, + one Astra re-audit, together. Rounds that passed are not audited again. A further pass needs the user's OK.

Section shipped as a PR → commit, push, PR per repo rules; other repo-required pre-merge reviews still run. Record `Waiting: merge of <PR>`; next section starts from the merged default branch.

## Stagnation

Count from Audit log, never memory.

- Same step fails its gate twice in a row → next brief changes approach; failed one → Dead ends first.
- Three batches in a row, nothing new in Provisional progress → stop spawning, rewrite Remaining, report to the user w/ Codex runs spent.
- Section fails its second pass → stop; the user decides whether to spend more runs.
- At `max(5, 2 * initial step count)` rounds → reassess remaining work, report run count. Reassessment threshold only, not a completion rule.

## Completion

Answer from Verified progress alone, after the last section's audits pass. Provisional progress is unaudited: report it as such, never as done. Unfinished = valid report: verified + provisional + remaining + missing checks. Bind the result to the head SHA the last Astra run audited; later commits need revalidation. Report Sol + Astra run counts, observed model + effort per run (or "requested, resolution unverified"), unmerged round branches, and evidence paths.
