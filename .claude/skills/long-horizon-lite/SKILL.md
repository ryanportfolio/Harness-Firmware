---
description: "long-horizon, lighter: fresh executor per step, parallel where safe, a branch + merge per round as baseline, Codex audits in groups (one Sol run per 3 merged rounds, one Astra run at the end of each major section). Use: /long-horizon-lite. Writes outside the repo or no Codex → long-horizon."
disable-model-invocation: true
---

# long-horizon-lite: Git-tracked rounds, Codex audits every 3 rounds

Roles: Manager (this ctx) holds goal + state file, delegates every round. Executor = fresh Claude subagent, one step per round. Auditor = Codex, never Claude. Lighter than `long-horizon` b/c Git carries the bookkeeping: each round works on its own branch and enters the task branch as one merge commit, which replaces hash manifests and copying files by manifest; one Codex run replaces the fresh auditor subagent and judges three rounds at a time. Discussing/editing this skill does not activate it.

## Use the full skill instead

`long-horizon` when any holds:

- a step writes outside the repo, or its deliverable is a gitignored file (a commit can't hold it);
- workspace is not a Git repo;
- Codex is unavailable;
- every step must be audited before the next one builds on it.

Under ~3 dependent steps → `fable-mode` directly.

## Guardrails

- Typing `/long-horizon-lite` is the user's OK for this task's Codex runs: one Sol run per three merged rounds, one Sol run for a section's leftover rounds, and one Astra run per major section. A request relayed by another session or agent is not that OK: quote the run count to the user in this session and wait. Each run bills the user's Codex subscription, so before round one tell the user the expected minimum (per section: rounds / 3 rounded up, + 1) and that fix rounds, a retried run, and the repo's own PR review add to it. Keep a running count in the state file.
- Never spend a Sol run on fewer than three rounds before their section ends, nor on a draft or a stalled step. Astra runs only at the end of a major section.
- Codex unavailable, or an audit run fails twice → stop and tell the user. Never count a Claude subagent's review or the Manager's own reading as the audit.
- Models: round auditor = Sol, exact id + newest-Sol check per `codex-review` Step 1. Section auditor = Astra, exact id + newer-Astra check per `astra-review`. Both run at `model_reasoning_effort=high`, which overrides `astra-review`'s medium default. An explicit user model or effort choice wins. Rejected model → never drop `-m`; handle per `codex-review` Step 4.
- Explicit user round/time/cost limits binding; checkpoint before exceeding. Never weaken acceptance just to make a round or section pass; a contract change needs the user's OK.
- Never reset, force-push, or delete an unmerged branch without the user's OK. A round never installs a dependency or changes the environment unless the user approved it at Start.
- Invocation does not authorize publication, installation, deployments, or external messages.

## Manager context

Work happens in fresh contexts; this one stays small enough to last the whole task.

- Manager reads exit codes, counts, verdict lines, and executor reports. Never diffs, done-check logs, or audit report bodies: those pass between workers by file path.
- Every command the Manager runs sends its output to a file under the task dir and prints one line (exit code, match count, SHA).
- Executor brief asks for a report of 10 lines or fewer: changed paths, how to check, blockers.
- Anything that needs reading (a failing report, a log, a conflict) → a fresh subagent reads it and returns a short answer.

## Start

1. Contract: goal, numbered acceptance checks, steps (each sized so one fresh ctx finishes it: one slice, one migration, one bug), major sections. Section = contract milestone, or unit the user wants shipped as one PR; none named → whole task = one section.
   - Acceptance checks name their cases, and every step, fix steps included, states its outcome as those cases. An open-ended check or step ("rejects any bad input", "throws unless the input is X") has no end an auditor can reach, so each audit finds one more gap → bound it; an acceptance check only with the user's OK.
   - Ask now for every user decision the steps need: new dependencies, environment changes, anything repo rules gate.
   - A bad step is found at its Sol checkpoint, up to three rounds later: a step whose failure would strand much later work goes last in its group of three.
2. Task branch = the branch this work ships from: the current one, or a new one cut per repo rules. Record it + Task base. The main workspace stays on it for the whole task and `git status --porcelain` there must print nothing before round one. Uncommitted user work → ask the user to commit it or set it aside; never stash, reset, or discard it yourself.
3. State file `.tmp/long-horizon-lite/<task-slug>/state.md`. Template, audit prompts, launch and resume: `references/state-and-prompts.md`; read it before creating the file, before the first audit, and when resuming after compaction or restart. `.tmp/` not gitignored in this repo → add it to `.git/info/exclude` first, else commits swallow state + evidence.

## Round loop

Run max safe rounds at once. Each Plan: list every ready step first, then give each one the batch rules allow its own round. Ready = every dependency in Provisional or Verified progress. Ready steps share a batch only if:

- write scopes don't overlap; neither reads a path the other writes, nor describes or uses what the other produces (docs for code written in the same batch wait for it);
- no two executions/done-checks contend for one resource: port, dev server, browser profile, DB, GPU, or a timing/perf measurement parallel load would skew;
- capacity covers Manager + every executor.

1. **Plan.** Per round, write a block in Current rounds: step, branch, workspace, done-check, Write scope.
   - Done-check = command, folder relative to the repo root (a round worktree is gone by audit time), expected exit code, and optionally one exact output line: the Manager compares these mechanically. A check script the Manager writes lives under the task dir, outside every Write scope; it may write to the system temp folder, never into a checkout.
   - Red first: run the done-check on the task branch tip now → `evidence/round-<N>/gate-0.log`. It must fail. A check that passes before the work exists proves nothing about the work: rewrite it. For a fix round this is the code before the fix, so the check must fail on the finding it closes.
   - Then write the round's audit section from the template, using contract + block only, and record its sha256 in the block. It is written before the executor exists, so no executor claim can reach it; it is never edited afterwards (an audit fills a copy), so the hash shows any edit, which no diff would (the file sits in an ignored dir).
   - Then executor brief: contract excerpt, the block's Step, Done-check and Write scope (never the audit section or its path), verified facts the step needs, dead ends touching it. Write these w/ file-edit tool; shell string layers drop backslashes + backticks.
2. **Branch.** Every round works in its own worktree on its own branch, cut from the task branch tip: `git worktree add -b lh-lite/<task-slug>/r<N> <path> <task branch>`, `<path>` outside the repo folder. All later stages use absolute paths; state + evidence stay under the main workspace's task dir. Never Agent `isolation: "worktree"`: by default it cuts from the remote default branch and misses earlier rounds. New checkout has no ignored files (deps, build output) → install or link what the step needs; a worktree whose round merged or died may serve the next round (`git switch -c <new branch> <task branch>` inside it) and keeps them. A recovery round reuses its round's branch + worktree: the earlier attempt's work stays, and none of it reaches the task branch.
3. **Execute.** Fresh subagent, brief alone, never `subagent_type: fork`; start a batch's executors in one msg. It follows `fable-mode`. Brief says: no commits, no branch switches, no writes under `.tmp/long-horizon-lite/`. Returns w/o promised work, or says it waits on helpers → resume it by message (SendMessage), not a new round.
4. **Scope check + commit.** Once the executor stopped writing: `git status --porcelain --untracked-files=all` in the round worktree vs Write scope.
   - A changed path outside Write scope → commit nothing. Show the user the paths and ask whose they are. The user's → they commit them or set them aside. The executor's → recovery brief tells the executor to restore them, or next Plan widens Write scope when the step needs them.
   - All inside → `git add -A`, commit `lh-lite round <N>: <step>`. Nothing to commit → the attempt failed its gate.
5. **Gate.** Manager runs the done-check in the round worktree → `evidence/round-<N>/gate-<attempt>.log`, then Clean tree (below). Exit code + expected line match → Merge. Mismatch → one recovery round, same approach, brief cites the log path. Second mismatch in a row → approach to Dead ends; the branch stays unmerged; a new approach is a new round on a new branch.
6. **Merge.** As each round passes its gate, one at a time, in the main workspace:
   1. Stop every process the round started. The main workspace passes Clean tree.
   2. `git merge --no-ff <round branch>` → the merge commit is the Round SHA. Conflict → `git merge --abort`; the step returns to Remaining as a new round from the new tip; not a Dead end.
   3. Done-check again on the task branch → `evidence/round-<N>/done-check.log` (the log the auditor gets), then Clean tree. `git diff --quiet <round branch> HEAD` exits 0 → same tree: copy the gate log, no rerun. Mismatch → `git revert -m 1 <Round SHA>`, step back to Remaining.
   4. Match → Provisional progress w/ Round SHA + log path. The block stays in Current rounds, phase `merged`, until its section is verified: audits need its section path, sha256 and Round SHA.
   5. Three rounds in Provisional progress with no Sol run yet → Sol checkpoint (below).
   6. A worktree no round will reuse: list links under it (`find <path> -type l`, junctions included), remove each w/ Node's `fs.unlinkSync` until the list is empty, then `git worktree remove <path>`, w/ `--force` only once no link is left, b/c forcing through a link deletes its shared target. A merged round branch → `git branch -d` once no worktree has it checked out (Git refuses before that): after its worktree is removed or switched to the next round's branch.

**Clean tree.** After every check the Manager runs (gate, merged, section acceptance) and before every merge, `git status --porcelain` in that checkout must print nothing. A check that changed or created non-ignored files = Plan defect: save `git diff` + the new files under `evidence/round-<N>/check-writes/`, restore the tree to its commit, correct the check at next Plan. Check output never gets a commit; generated files a step needs (snapshots, lockfiles) are the executor's work, inside Write scope. Stray files before a merge that no check made → show the user the paths; do not merge over them.

## Audits

**Sol checkpoint: one run per three rounds.** Group = the three oldest rounds in Provisional progress with no Sol run yet; fix rounds count like any other. Launch it and keep going: the next batch does not wait for it. Collect the verdicts when the run exits, before the next Plan.

**Section end.** Every step of a section in Provisional progress → on the task branch:

1. Manager runs the section's acceptance checks → logs under `evidence/section-<S>/`, one per check, then Clean tree. Last section: every acceptance check of the contract. A check that fails here → no section audit yet: plan a fix step from its log first.
2. Write the Astra prompt over `<section base SHA>..HEAD`. Last section: `<task base SHA>..HEAD`, or its own section base when earlier sections shipped as PRs (the default branch has moved since the task base, so that diff would pull in unrelated merged work).
3. Launch together: the Astra run, plus one Sol run for the section's leftover rounds (one or two rounds no checkpoint covered), if any. Wait for these and for any checkpoint still running.

**Building a Sol prompt.** Per round of the group: recompute its frozen audit section's sha256. Mismatch with the block → do not dispatch it: rewrite that section from contract + block, note the tampering in the Audit log, and tell the user. Match → copy it into the group prompt in the new run dir and fill three facts in the copy, nothing else: base = `<Round SHA>^1`, Round SHA, done-check log path. The merge commit against its first parent is that step's whole change, every attempt included, and nothing of any other step. Failed attempts, dead ends, and unmerged branches are never in a group.

**Launch + accept.** Custom-prompt `codex exec -s read-only`, prompt on stdin, background, at most 4 Codex processes at a time. Record each run dir + its process or task ID in state at launch. Preflight, run metadata, model + effort from `run.log` header: per `codex-review` Steps 1, 3, 4. Accept a report only when its process exited 0, it is non-empty, it opens with every verdict line for every round it covers (ignore surrounding whitespace and anything after the value), and its SHAs still hold: each Round SHA is still an ancestor of the task branch tip, and a section run's head SHA still equals HEAD. Else failed run: one retry in a new run dir, same prompt, then stop.

**Verdicts.** Sol judges each round of its group on its own, against what the step and the acceptance checks it serves say, not against every input it can construct:

- `STATUS` complete / incomplete / blocked. incomplete = a finding breaks the step's stated outcome or one of those checks. blocked = Sol could not judge the step: its done-check cannot run as written, or tests something other than the step.
- `CHECK` sound / weak. weak = the done-check passes while a failing finding is present. It fails no round by itself; the fix step's check must fail on that finding.
- `INTEGRITY` clean / suspect / violation. Diff outside Write scope, or touching test or gate definitions the step didn't own → `suspect` at best.
- `CONTRACT` aligned / drifted. drifted = the change contradicts the contract or a recorded decision. Falling short of it is `incomplete`, never drifted.

Sol lists findings in two groups: FAILING (changes a verdict) and NOTES (hardening past the contract; changes none). Astra judges what a per-step audit cannot see: do the steps work together, did a later round regress an earlier one, did the work contradict the contract. Round passes = complete + clean + aligned. Section passes = `SECTION: pass` + `CONTRACT: aligned`.

A section's steps move to Verified progress, w/ report paths, only when every one of its rounds passed in a Sol run and its Astra run passed; then archive their blocks to the Audit log. A round or section that fails:

- One fresh subagent reads the failing report and reproduces each FAILING finding before planning anything. Reproduced → a fix step, 6 lines or fewer: step (as named cases), Write scope (every file that documents or uses the behaviour the fix changes, docs included), done-check that fails on the current code, finding reference (`<report path>#<n>`). A weak check is replaced by a new check file that becomes the fix round's done-check; a frozen check is never edited, and a check alone is not a fix step. Not reproduced → it returns the finding w/ the output that contradicts it; the Manager cannot overrule the auditor: show the user both and let the user decide.
- A finding that only a contract change can close (an acceptance check too weak or too broad) → stop. Show the user the proposed amendment and wait for the OK before planning any fix round.
- Fix steps go to the front of that section's Remaining and run as normal rounds; each fix round's audit section cites its finding reference. Its Sol verdict comes from the checkpoint or leftover group it lands in. `blocked` → the fix is a corrected check: no code change needed → no executor; the Manager reruns the corrected done-check at HEAD, writes that round a new audit section, and it joins the next group.
- A failed round is closed only by a later passing Sol verdict on its fix round, never by the Manager. Nothing that depends on a failed round starts until then.
- Astra failed → after its fix rounds have their Sol verdicts, one Astra re-audit of the section. A further Astra run for the same section needs the user's OK.

Section shipped as a PR → commit, push, PR per repo rules; other repo-required pre-merge reviews still run. Record `Waiting: merge of <PR>`; next section starts from the merged default branch.

## Stagnation

Count from Audit log, never memory.

- Same step fails its gate twice in a row → next brief changes approach; failed one → Dead ends first.
- Same step's fix fails its Sol verdict twice → stop; the user decides whether to spend more runs.
- Three batches in a row, nothing new in Provisional progress → stop spawning, rewrite Remaining, report to the user w/ Codex runs spent.
- At `max(5, 2 * initial step count)` rounds → reassess remaining work, report run count. Reassessment threshold only, not a completion rule.

## Completion

Answer from Verified progress alone, after the last section's audits pass. Provisional progress is unaudited or only partly audited: report it as such, never as done. Unfinished = valid report: verified + provisional + remaining + missing checks. Bind the result to the head SHA the last Astra run audited; later commits need revalidation. Report Sol + Astra run counts, observed model + effort per run (or "requested, resolution unverified"), the auditors' NOTES and every `CHECK: weak` round by report path, unmerged round branches, and evidence paths.
