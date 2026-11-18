---
name: long-horizon-lite
description: "long-horizon, lighter: fresh executor per step, parallel where safe, a branch + merge per round as baseline, Codex audits in groups (one Sol run per 3 merged rounds, one Astra run at the end of each major section). Use: /long-horizon-lite. Writes outside the repo, dependency changes, or no Codex → long-horizon."
disable-model-invocation: true
---

# long-horizon-lite: Git-tracked rounds, Codex audits every 3 rounds

Roles: Manager (this ctx) holds goal + state file, delegates every round. Executor = fresh Claude subagent, one step per round. Auditor = Codex, never Claude. Lighter than `long-horizon` b/c Git carries the bookkeeping: each round works on its own branch and enters the task branch as one merge commit, which replaces hash manifests and copying files by manifest; one Codex run replaces the fresh auditor subagent and judges three rounds at a time. Discussing/editing this skill does not activate it.

## Use the full skill instead

`long-horizon` when any holds:

- a step writes outside the repo, or its deliverable is a gitignored file (a commit can't hold it);
- a step installs or updates a dependency, or changes the environment;
- workspace is not a Git repo;
- Codex is unavailable;
- every step must be audited before the next one builds on it;
- sections must ship as separate PRs: here the whole task is one branch and one PR.

Under ~3 dependent steps → `fable-mode` directly.

## Guardrails

- Typing `/long-horizon-lite` is the user's OK for this task's Codex runs: one Sol run per three merged rounds, one Sol run for a section's leftover rounds, one Astra run per major section, and one Astra re-audit of a section that failed. A request relayed by another session or agent is not that OK: quote the run count to the user in this session and wait. Each run bills the user's Codex subscription, so before round one tell the user the expected minimum (per section: rounds / 3 rounded up, + 1) and that fix rounds, a re-audit, a retried run, and the repo's own PR review add to it. Keep a running count in the state file.
- Never spend a Sol run on fewer than three rounds before their section ends. One exception: every step left in the section waits on those rounds' verdicts. Astra runs only at the end of a major section, after every round of it has passed Sol.
- Codex unavailable, or an audit run fails twice → stop and tell the user. Never count a Claude subagent's review or the Manager's own reading as the audit.
- Models: round auditor = Sol, section auditor = Astra, exact ids + newer-model checks per `codex-review` Step 1 and `astra-review`. Both run at `model_reasoning_effort=high`, which overrides `astra-review`'s medium default. An explicit user model or effort choice wins. Never drop `-m`. A rejected Sol id → `codex-review` Step 4. A rejected Astra id → report it per `astra-review`; never swap models.
- Explicit user round/time/cost limits binding; checkpoint before exceeding. Never weaken acceptance just to make a round or section pass. The contract is fixed for the run: a change to it, even one the user wants, ends this run. Report verified + provisional per Completion and stop; never start the next run yourself. Provisional rounds stay on the branch unaudited: say so.
- Never reset, force-push, or delete an unmerged branch without the user's OK. No round installs a dependency or changes the environment.
- Invocation does not authorize publication, installation, deployments, or external messages.

## Manager context

Work happens in fresh contexts; this one stays small enough to last the whole task.

- Manager reads exit codes, counts, verdict lines, and executor reports. Never diffs, done-check logs, or audit report bodies: those pass between workers by file path.
- Every command the Manager runs sends its output to a file under the task dir and prints one line (exit code, match count, SHA).
- Executor brief asks for a report of 10 lines or fewer: changed paths, how to check, blockers.
- Anything that needs reading (a failing report, a log, a conflict) → a fresh subagent reads it and returns a short answer.

## Start

1. Contract: goal, numbered acceptance checks, steps (each sized so one fresh ctx finishes it: one slice, one migration, one bug), major sections. Section = contract milestone; none named → whole task = one section.
   - Acceptance checks name their cases, and every step, fix steps included, states its outcome as those cases. An open-ended check or step ("rejects any bad input", "throws unless the input is X") has no end an auditor can reach, so each audit finds one more gap → bound it with the user before round one.
   - Ask now for every user decision the steps need.
   - A bad step is found at its Sol checkpoint, up to three rounds later: a step whose failure would strand much later work goes last in its group of three.
2. Task branch = the branch this work ships from, never the default branch: the current one, or a new one cut per repo rules. Record it + Task base. The main workspace stays on it, and `git status --porcelain` there must print nothing before round one. Uncommitted user work → ask the user to commit it or set it aside; never stash, reset, or discard it yourself.
3. State file `.tmp/long-horizon-lite/<task-slug>/state.md`. Template, audit prompts, launch and resume: `references/state-and-prompts.md`; read it before creating the file, before the first audit, and when resuming after compaction or restart. `.tmp/` not gitignored in this repo → add it to the file `git rev-parse --git-path info/exclude` names first (in a worktree `.git` is a file), else commits swallow state + evidence.

## Round loop

Run max safe rounds at once. Each Plan: list every ready step first, then give each one the batch rules allow its own round. Sections run one at a time: no step of a later section is planned until the current one is verified, so each section's audits hold only its own work. Ready = a step of the current section w/ every dependency in Provisional or Verified progress. Write each stage's result into the round's block before the next stage (Phase, Worker, Attempts, SHAs; a round that dies, conflicts or is reverted → Phase `closed` w/ the reason): resume has nothing else to go on. Rounds run at the same time, in one batch or across batches, only if:

- write scopes don't overlap; neither reads a path the other writes, nor describes or uses what the other produces (docs for code written in the same batch wait for it);
- no two executions/done-checks contend for one resource: port, dev server, browser profile, DB, GPU, or a timing/perf measurement parallel load would skew;
- capacity covers Manager + every executor.

1. **Plan.** Per round, write a block in Current rounds: step, branch, workspace, done-check, Write scope.
   - Done-check = command, folder relative to the repo root (a round worktree is gone by audit time), expected exit code, and optionally one exact output line: the Manager compares these mechanically. A check script the Manager writes lives under the task dir, outside every Write scope; it may write to the system temp folder, never into a checkout.
   - Red first: run the done-check on the task branch tip now → `evidence/round-<N>/gate-0.log`. It must fail, and because the step's outcome is missing, not because the command cannot start. A check that passes before the work exists proves nothing about the work: rewrite it. For a fix round this is the code before the fix, so the check must fail on the finding it closes.
   - Then write the round's audit section from the template, using contract + block only, and record its sha256 and the check script's in the block. The section is written before the executor exists, so no executor claim can reach it; neither file is edited afterwards (an audit fills a copy), so a hash shows any edit, which no diff would (both sit in an ignored dir).
   - Then executor brief: contract excerpt, the block's Step, Done-check and Write scope (never the audit section or its path), verified facts the step needs, dead ends touching it. Write these w/ file-edit tool; shell string layers drop backslashes + backticks.
2. **Branch.** Every round works in its own worktree on its own branch, cut from the task branch tip: `git worktree add -b lh-lite/<task-slug>/r<N> <path> <task branch>`, `<path>` outside the repo folder; record the cut SHA. All later stages use absolute paths; state + evidence stay under the main workspace's task dir. Never Agent `isolation: "worktree"`: by default it cuts from the remote default branch and misses earlier rounds. New checkout has no ignored files → link the dependencies the step needs from the main workspace, never build output (each checkout builds its own). Write each link into the block before creating it: removing a worktree deletes whatever an unrecorded link points at. A recovery round reuses its round's branch + worktree: the earlier attempt's work stays, and none of it reaches the task branch.
3. **Execute.** Fresh subagent, brief alone, never `subagent_type: fork`; start a batch's executors in one msg. It follows `fable-mode`. Brief says: no commits, no branch switches, no installs, no writes under `.tmp/long-horizon-lite/`. Returns w/o promised work, or says it waits on helpers → resume it by message (SendMessage), not a new round. Reports that the step needs an install or an environment change → stop the run and tell the user: that step belongs to `long-horizon`.
4. **Scope check + commit.** Once the executor stopped writing, in the round worktree:
   - `git rev-parse HEAD` must equal the tip the Manager last recorded (the cut SHA, or the previous attempt's commit). It moved → the executor committed: that branch never merges. Close the round; the step gets a new round on a new branch.
   - `git status --porcelain -z --untracked-files=all` vs Write scope (`-z` keeps odd paths unquoted; a rename lists both paths and both must be inside; recorded links don't count). A path outside → commit nothing. Show the user the paths and ask whose they are. The user's → they commit them or set them aside. The executor's → recovery brief tells the executor to restore them.
   - All inside → `git add -A`, commit `lh-lite round <N>: <step>`, record the new tip. Nothing to commit → the attempt failed its gate.
5. **Gate.** Before this and every later run of the check, recompute the script's sha256; mismatch with the block → do not run it, and tell the user. Manager runs the done-check in the round worktree → `evidence/round-<N>/gate-<attempt>.log`, w/ Clean tree (below). Exit code + expected line match → Merge. Mismatch → one recovery round, same approach, brief cites the log path. Second mismatch in a row → approach to Dead ends; stop the round's processes; the branch stays unmerged; a new approach is a new round on a new branch.
6. **Merge.** As each round passes its gate, one at a time, in the main workspace:
   1. Stop every process the round started.
   2. `git merge --no-ff <round branch>` → the merge commit is the Round SHA. Conflict → `git merge --abort`; the step returns to Remaining as a new round from the new tip; not a Dead end. "Already up to date" → stop: state and history disagree; reconcile from `git log` first.
   3. Done-check again on the task branch → `evidence/round-<N>/done-check.log` (the log the auditor gets), w/ Clean tree. Always rerun it: the round worktree can hold ignored files the task branch lacks. Mismatch → `git revert -m 1 <Round SHA>`, step back to Remaining.
   4. Match → Provisional progress w/ Round SHA + log path. The block stays in Current rounds, phase `merged`, until its section is verified: audits need its section path, hashes and Round SHA.
   5. Three rounds in Provisional progress with no Sol verdict and in no run still out → Sol checkpoint (below).
   6. A merged or closed round's worktree → remove it only per the reference file's Worktree cleanup: `git worktree remove` deletes through any link left in it, with or without `--force`. A merged round branch → `git branch -d` once its worktree is gone (Git refuses before that).

**Clean tree.** Before and after every check the Manager runs (red first, gate, merged, section acceptance) and before every merge, `git status --porcelain` in that checkout must print nothing but recorded links. If it prints more, show the user the paths and change nothing in the checkout: they may be the user's work, even when they appeared during a check. A check that writes into a checkout = Plan defect, corrected at next Plan; its output never gets a commit. Generated files a step needs (snapshots) are the executor's work, inside Write scope.

## Audits

Prompt templates, launch commands and the run-directory rule: reference file. Preflight (login, exact model id) per `codex-review` Step 1, read against `codex exec --help`; model + effort from the `run.log` header and the retry rule per its Step 4.

**Sol checkpoint: one run per three rounds.** Group = the three oldest rounds in Provisional progress with no Sol verdict that are in no run still out (the Audit runs lines say which); fewer than three only under the Guardrails' exception. Fix rounds count like any other. Failed attempts, closed rounds, and unmerged branches are never in a group. Write the Audit runs line, then launch, and keep going: the next batch does not wait for it. Collect the verdicts when the run exits, before the next Plan.

**Before a section goes into a Sol prompt:** recompute the frozen audit section's sha256. Mismatch with the block → do not dispatch it: rewrite that section from contract + block, note the tampering in the Audit log, and tell the user. Match → copy it into the group prompt and fill three facts in the copy, nothing else: base = `<Round SHA>^1`, Round SHA, done-check log path.

**Section end.** Every step of a section in Provisional progress:

1. One Sol run for the section's leftover rounds (one or two no checkpoint covered), if any; wait for it and for any checkpoint still running. A round failed → fix it first (below). Go on only when every round of the section passed Sol or was closed by a fix round that passed.
2. Manager runs the section's acceptance checks → logs in the Astra run dir, one per check, w/ Clean tree. Last section: every acceptance check of the contract. A check that fails here → no Astra run yet: a fresh subagent plans a fix step from its log (the log path is its finding reference); go back to rounds.
3. One Astra run over `<section base SHA>..HEAD`, last section `<task base SHA>..HEAD`; nothing merges into the task branch while it is out.

**Accept** a report only when its recorded exit code is 0, it is non-empty, it opens with every verdict line for every round in its group, in order, each line is exactly `KEY: value` with one allowed value once surrounding whitespace is trimmed and blank lines are skipped (anything more on a line makes the report malformed), and its SHAs still hold: each Round SHA is still an ancestor of the task branch tip w/ no revert of it there, and a section run's head SHA still equals HEAD. Accept is applied once, when the run is collected; a verdict already in the Audit log stands. Else failed run: one retry in a new run dir, same prompt, then stop. A report turned away only because a SHA went stale is not a failed run: never rerun that prompt; build a new one from the current state.

**Verdicts.** Sol judges each round of its group on its own, against what the step and the acceptance checks it serves say, not against every input it can construct. Per round: `STATUS` complete / incomplete / blocked, `CHECK` sound / weak, `INTEGRITY` clean / suspect / violation, `CONTRACT` aligned / drifted; the prompt template defines each. Two points the Manager holds to: `CHECK: weak` fails no round by itself, and work that falls short of the contract is `incomplete`, never `drifted`.

Sol lists FAILING findings (they set STATUS, INTEGRITY or CONTRACT) and NOTES (everything else; they change no verdict). Astra judges what a per-step audit cannot see. Round passes = complete + clean + aligned. Section passes = `SECTION: pass` + `CONTRACT: aligned`.

A section's steps move to Verified progress, w/ report paths, only when every one of its rounds passed Sol or was closed by a fix round that passed, and its Astra run passed at the current HEAD; then archive their blocks to the Audit log. A round or section that fails:

- One fresh subagent reads the failing report and reproduces each FAILING finding before planning anything. Reproduced → a fix step, 6 lines or fewer: step (as named cases), Write scope (every file that documents or uses the behaviour the fix changes, docs included), done-check that fails on the current code, finding reference (`<report path>#<round>.<n>`; a group report numbers findings per round). A weak check is replaced by a new check file that becomes the fix round's done-check; a frozen check is never edited. Not reproduced → it returns the finding w/ the output that contradicts it; the Manager cannot overrule the auditor: show the user both and let the user decide.
- Stop and show the user, with the subagent's reasons, when a finding can only be closed by changing the contract, or when a round is `blocked` and the code is right and only its done-check is wrong. Neither is repaired inside this run: it ends there, w/ the report Completion describes.
- Fix steps go to the front of that section's Remaining and run as normal rounds; each fix round's audit section cites its finding reference. Its Sol verdict comes from the checkpoint or leftover group it lands in.
- A failed round is closed only when every fix round planned for it has a passing Sol verdict, a failed fix counting as replaced by its own fix; never by the Manager. Nothing that depends on a failed round starts until then.
- Astra failed → once the fix rounds have their Sol verdicts, one Astra re-audit of the section. A further Astra run for the same section needs the user's OK.

## Stagnation

Count from Audit log, never memory.

- Same step fails its gate twice in a row → next brief changes approach; failed one → Dead ends first.
- Two failed Sol verdicts on fix rounds that trace back to the same original step, or the same acceptance check failing at section end twice → stop; the user decides whether to spend more runs.
- Three batches in a row, nothing new in Provisional progress → stop spawning, rewrite Remaining, report to the user w/ Codex runs spent.
- At `max(5, 2 * initial step count)` rounds → reassess remaining work, report run count. Reassessment threshold only, not a completion rule.

## Completion

Answer from Verified progress alone, after the last section's audits pass. Provisional progress is unaudited or only partly audited: report it as such, never as done. Unfinished = valid report: verified + provisional + remaining + missing checks. Bind the result to the head SHA the last Astra run audited; later commits need revalidation. Report Sol + Astra run counts, observed model + effort per run (or "requested, resolution unverified"), the auditors' NOTES and every `CHECK: weak` round by report path, unmerged round branches, and evidence paths. Commit, push and PR follow repo rules; other repo-required pre-merge reviews still run.
