---
description: "long-horizon, lighter: fresh executor per step, parallel where safe, a commit per round as baseline, Codex audits at the end of each major section (Sol per round + Astra per section, run together). Use: /long-horizon-lite. Writes outside the repo or no Codex → long-horizon."
disable-model-invocation: true
---

# long-horizon-lite: Git-tracked rounds, Codex audits at section end

Roles: Manager (this ctx) holds goal + state file, delegates every round. Executor = fresh Claude subagent, one step per round. Auditor = Codex, never Claude. Lighter than `long-horizon` b/c Git carries the bookkeeping: a commit per round replaces hash manifests; a branch + merge per parallel round replaces copying files by manifest; one Codex run replaces the fresh auditor subagent; audits wait for the end of a major section and run together. Discussing/editing this skill does not activate it.

## Use the full skill instead

`long-horizon` when any holds:

- a step writes outside the repo, or its deliverable is a gitignored file (round commit can't hold it);
- workspace is not a Git repo;
- Codex is unavailable;
- every step must be audited before the next one builds on it.

Under ~3 dependent steps → `fable-mode` directly.

## Guardrails

- Typing `/long-horizon-lite` is the user's OK for this task's Codex runs: one Sol run per round and one Astra run per major section, all launched at section end. Each run bills the user's Codex subscription, so before round one tell the user the expected count (steps + sections), and keep a running count in the state file.
- No Codex run mid-section. Never spend a Sol or Astra run on a single round, a draft, or a stalled step before its section ends.
- Codex unavailable, or an audit run fails twice → stop and tell the user. Never count a Claude subagent's review or the Manager's own reading as the audit.
- Models: round auditor = Sol, exact id + newest-Sol check per `codex-review` Step 1. Section auditor = Astra, exact id + newer-Astra check per `astra-review`. Both run at `model_reasoning_effort=high`, which overrides `astra-review`'s medium default. An explicit user model or effort choice wins. Rejected model → never drop `-m`; handle per `codex-review` Step 4.
- Explicit user round/time/cost limits binding; checkpoint before exceeding. Never weaken acceptance just to make a round or section pass.
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
3. State file `.tmp/long-horizon-lite/<task-slug>/state.md`. Template + audit prompts: `references/state-and-prompts.md`; read it before creating the file and before a section's audits. `.tmp/` not gitignored in this repo → add it to `.git/info/exclude` first, else round commits swallow state + evidence.

Resume after compaction/restart: read state, compare recorded SHAs w/ `git log` and recorded workspaces w/ `git worktree list`, confirm recorded workers stopped. State file changed in last 30 min by another session → ask the user before touching it. Continue each recorded round from its first unfinished stage, never from Execute again: no Round SHA → scope check + commit; no done-check log for it → Done-check; batch checked but not merged → merge. Section audits recorded → look at each run first: still running → wait; finished for its recorded SHAs → use it. A second paid run only when the recorded one failed.

## Round loop

Run max safe rounds at once. Each Plan: every ready step the batch rules allow gets its own round. Ready = every dependency in Provisional or Verified progress.

1. **Plan.** Per round, write a Current rounds block: step, workspace, Step base, done-check, Write scope. Step base = HEAD before the step's first attempt; a recovery round keeps it. Done-check = command, cwd, expected exit code, and optionally one exact output line: the Manager compares these mechanically. Then write the round's audit prompt from the template, using contract + block only, and record its sha256 in the block. It is written before the executor exists, so no executor claim can reach it, and the hash shows an edit that no diff would (the file sits in an ignored dir). It waits for section end. Then executor brief: contract excerpt, the block's Step, Done-check and Write scope (never the audit prompt or its path), verified facts the step needs, dead ends touching it. Write these w/ file-edit tool; shell string layers drop backslashes + backticks.
2. **Execute.** Fresh subagent, brief alone, never `subagent_type: fork`. It follows `fable-mode`. Brief says: no commits, no writes under `.tmp/long-horizon-lite/`. Returns w/o promised work, or says it waits on helpers → resume it by message (SendMessage), not a new round.
3. **Scope check + commit.** Once the executor stopped writing: `git status --porcelain --untracked-files=all` vs Write scope.
   - A changed path outside Write scope → commit nothing. Show the user the paths and ask whose they are. The user's → they commit them or set them aside. The executor's → recovery brief tells the executor to restore them, or next Plan widens Write scope when the step needs them.
   - All inside → `git add -A`, commit `lh-lite round <N>: <step>` → Round SHA. `Step base..HEAD` empty → round failed.
4. **Done-check.** Manager runs the frozen command from recorded cwd; complete stdout, stderr, exit code → `evidence/round-<N>/done-check.log`. Then `git status --porcelain` must print nothing. Check changed or created non-ignored files → Plan defect: save `git diff` + the new files under `evidence/round-<N>/check-writes/`, restore the tree to Round SHA, correct the check at next Plan. Check output never gets a commit; generated files the step needs (snapshots, lockfiles) are the executor's work, inside Write scope.
5. **Gate.** Exit code + expected line match → Provisional progress w/ Round SHA + log path. Mismatch → one recovery round, same approach, same Step base, brief cites the log path. Second mismatch in a row → approach to Dead ends, `git revert --no-edit <Step base>..HEAD` (never reset, never force-push; a batch round: leave its branch unmerged), new approach from a new Step base. Archive block → Audit log, write state.

### Batches

Ready steps share a batch only if:

- write scopes don't overlap; neither reads a path the other writes;
- no two executions/done-checks contend for one resource: port, dev server, browser profile, DB, GPU, or a timing/perf measurement parallel load would skew;
- capacity covers Manager + every executor.

Batch of one → in place on the task branch. Batch of two or more → each round gets its own branch + worktree cut from the task branch HEAD, which is every round's Step base: `git worktree add -b lh-lite/<task-slug>/r<N> <path> HEAD`, `<path>` outside the repo folder. Never Agent `isolation: "worktree"`: by default it cuts from the remote default branch and misses earlier rounds' commits. New checkout has no ignored files (deps, build output) → install or link what the step needs. Stages 2-5 run there w/ absolute paths; state + evidence stay under the main workspace's task dir. Start all executors in one msg. Once every batch round passed its gate or failed:

1. Each passed round, in step order: `git merge --no-ff <round branch>` on the task branch. Conflict → `git merge --abort`, step back to Remaining for a later batch; not a Dead end.
2. Rerun each merged round's done-check on the task branch → `evidence/round-<N>/done-check-merged.log`. Mismatch → `git revert -m 1 <merge commit>`, step back to Remaining.
3. A batch step enters Provisional progress only after 1 + 2.
4. Per worktree: stop every process its round started; list links under it (`find <path> -type l`, junctions included), remove each w/ Node's `fs.unlinkSync` until the list is empty; then `git worktree remove <path>`, w/ `--force` only once no link is left, b/c forcing through a link deletes its shared target. Merged branch → `git branch -d`. Never delete an unmerged round branch without the user's OK; list those at Completion.

## Section end: all audits at once

Every step of a section in Provisional progress → on the task branch:

1. Manager runs every acceptance check of the section → logs under `evidence/section-<S>/`.
2. Per round of the section: recompute its prompt's sha256. Mismatch with the block → do not dispatch that prompt: rewrite it from contract + block, note the tampering in the Audit log, and tell the user. Match → fill its three facts and nothing else: Step base SHA, Round SHA, done-check log path. Write the Astra prompt over `<section base SHA>..HEAD`; last section: every acceptance check, `<task base SHA>..HEAD`.
3. Launch together: one Sol run per round + one Astra run for the section. Custom-prompt `codex exec -s read-only`, prompt on stdin, background + poll, at most 4 Codex processes at a time. Record each run dir + process ID in state before waiting. Preflight, run metadata, model + effort from `run.log` header: per `codex-review` Steps 1, 3, 4.
4. Accept a report only when its process exited 0, it is non-empty, it carries every verdict line, and its SHAs still hold: a round's Round SHA is still an ancestor of HEAD, and the section's head SHA still equals HEAD. Else failed run: one retry in a new run dir, same prompt, then stop.

Sol judges one step: `STATUS` complete / incomplete / blocked (`blocked: invalid check` = broken done-check), `INTEGRITY` clean / suspect / violation (diff outside Write scope, or touching test or gate definitions the step didn't own → `suspect` at best), `CONTRACT` aligned / drifted. Astra judges what a per-step audit cannot see: do the steps work together, did a later round regress an earlier one, did the work drift from the contract.

Every round complete + clean + aligned, and section pass + aligned → the section's steps move to Verified progress w/ report paths. Anything else:

- One fresh subagent reads the failing reports and returns fix steps, 6 lines or fewer each: step, Write scope, done-check, finding reference (`<report path>#<n>`). They go to that section's Remaining and run as normal rounds; each fix round's audit prompt cites its finding reference. `invalid check` → fix step = corrected check; no code change needed → Manager reruns Done-check, no executor.
- Then one more pass: Sol on the fix rounds + one Astra re-audit, together. Rounds that passed are not audited again. A further pass needs the user's OK.
- Executor refutes a finding w/ reproducible output → the Manager cannot overrule the auditor: show the user both and let the user decide.

Section shipped as a PR → commit, push, PR per repo rules; other repo-required pre-merge reviews still run. Record `Waiting: merge of <PR>`; next section starts from the merged default branch.

## Stagnation

Count from Audit log, never memory.

- Same step fails its gate twice in a row → next brief changes approach; failed one → Dead ends first.
- Three batches in a row, nothing new in Provisional progress → stop spawning, rewrite Remaining, report to the user w/ Codex runs spent.
- Section fails its second pass → stop; the user decides whether to spend more runs.
- At `max(5, 2 * initial step count)` rounds → reassess remaining work, report run count. Reassessment threshold only, not a completion rule.

## Completion

Answer from Verified progress alone, after the last section's audits pass. Provisional progress is unaudited: report it as such, never as done. Unfinished = valid report: verified + provisional + remaining + missing checks. Bind the result to the head SHA the last Astra run audited; later commits need revalidation. Report Sol + Astra run counts, observed model + effort per run (or "requested, resolution unverified"), unmerged round branches, and evidence paths.
