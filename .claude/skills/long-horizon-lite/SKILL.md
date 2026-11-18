---
description: "long-horizon, lighter: one step per round, a commit per round as baseline, Codex auditors (Sol each round, Astra at the end of each major section). Use: /long-horizon-lite. Parallel rounds, writes outside the repo, or no Codex → long-horizon."
disable-model-invocation: true
---

# long-horizon-lite: sequential rounds, Codex as auditor

Roles: Manager (this ctx) holds goal + state file. Executor = fresh Claude subagent, one step per round. Auditor = Codex, never Claude. Lighter than `long-horizon` in three ways: a Git commit per round replaces hash manifests; one round at a time, no round worktrees; auditor is another vendor that never saw this session, so its prompt needs no hash check. Discussing/editing this skill does not activate it.

## Use the full skill instead

`long-horizon` when any holds:

- steps should run in parallel;
- a step writes outside the repo, or its deliverable is a gitignored file (round commit can't hold it);
- workspace is not a Git repo;
- Codex is unavailable.

Under ~3 dependent steps → `fable-mode` directly.

## Guardrails

- Typing `/long-horizon-lite` is the user's OK for this task's Codex runs: one Sol run per round and one Astra run per major section. Each run bills the user's Codex subscription, so before round one tell the user the expected count (steps + sections), and keep a running count in the state file.
- Astra runs only at the end of a major section. Never spend an Astra run on a round, a draft, or a stalled step.
- Codex unavailable, or an audit run fails twice → stop and tell the user. Never count a Claude subagent's review or the Manager's own reading as the audit.
- Models: round auditor = Sol, exact id + newest-Sol check per `codex-review` Step 1. Section auditor = Astra, exact id + newer-Astra check per `astra-review`. Both run at `model_reasoning_effort=high`, which overrides `astra-review`'s medium default. An explicit user model or effort choice wins. Rejected model → never drop `-m`; handle per `codex-review` Step 4.
- Explicit user round/time/cost limits binding; checkpoint before exceeding. Never weaken acceptance just to make a round pass.
- Invocation does not authorize publication, installation, deployments, or external messages.

## Start

1. Contract: goal, numbered acceptance checks, steps (each sized so one fresh ctx finishes it: one slice, one migration, one bug), major sections. Section = contract milestone, or unit the user wants shipped as one PR; the user may regroup them. None named → whole task = one section.
2. Work on the task branch. `git status --porcelain` must print nothing before round one. Uncommitted user work → ask the user to commit it or set it aside; never stash, reset, or discard it yourself.
3. State file `.tmp/long-horizon-lite/<task-slug>/state.md`. Template + audit prompts: `references/state-and-prompts.md`; read it before creating the file and before the first audit. `.tmp/` not gitignored in this repo → add it to `.git/info/exclude` first, else round commits swallow state + evidence.

Resume after compaction/restart: read state, compare recorded SHAs w/ `git log`, confirm recorded worker stopped. State file changed in last 30 min by another session → ask the user before touching it. Continue the recorded round from its first unfinished stage, never from Execute again:

- no Round SHA → Execute's scope check + commit;
- Round SHA, no done-check log for it → Done-check;
- log, no accepted report → Audit. Look at the recorded audit run first: still running → wait for it; finished for this Round SHA → use its report. A second paid run only when the recorded one failed.

## Round loop

1. **Plan.** One ready step (deps all in Verified progress). Write Current round block: step, Step base, done-check (command, cwd, expected result), Write scope. Step base = `git rev-parse HEAD` before the step's first attempt; a recovery round keeps it, so every audit reads the step's whole diff, not only the repair. Then write the audit prompt file from the template, using contract + block only. It is written before the executor exists, so no executor claim can reach it. After Execute it gains three facts and nothing else: Step base SHA, Round SHA, done-check log path. Wrong done-check → fixed at next Plan, never after reading the executor's report. Then executor brief: contract excerpt, block, verified facts the step needs, dead ends touching it. Write these w/ file-edit tool; shell string layers drop backslashes + backticks.
2. **Execute.** Fresh subagent, brief alone, never `subagent_type: fork`. It follows `fable-mode`. Brief says: no commits, no state-file edits. Returns w/o promised work, or says it waits on helpers → resume it by message (SendMessage), not a new round. Once it stopped writing, scope check before any commit: `git status --porcelain --untracked-files=all` vs Write scope.
   - A changed path outside Write scope → commit nothing and spend no audit. Show the user the paths and ask whose they are. The user's → they commit them or set them aside. The executor's → round fails w/ integrity `violation`; recovery brief tells the executor to restore them, or next Plan widens Write scope when the step needs them.
   - All inside → `git add -A`, commit `lh-lite round <N>: <step>` → Round SHA.
   - `Step base..HEAD` empty → `incomplete`, no audit spent.
3. **Done-check.** Manager runs the frozen command from recorded cwd; complete stdout, stderr, exit code → `evidence/round-<N>/done-check.log`. Manager runs it b/c the auditor's sandbox is read-only. Manager records, never judges. Then `git status --porcelain` must print nothing. Check changed or created non-ignored files → `invalid check` (Plan defect), no audit spent: save `git diff` + the new files under `evidence/round-<N>/check-writes/`, then restore the tree to Round SHA. Check output never gets a commit. Generated files the step needs (snapshots, lockfiles) are the executor's work, inside Write scope.
4. **Audit.** One Sol run per template: custom-prompt `codex exec -s read-only`, prompt on stdin, background + poll. Record run dir + process ID in the block before waiting. Preflight, run metadata, model + effort from `run.log` header: per `codex-review` Steps 1, 3, 4. Accept a report only when its process exited 0, it is non-empty, it carries every verdict line, and HEAD still equals the SHA named in its prompt. Else failed run: one retry in a new run dir, same prompt, then stop.
   - `STATUS` complete / incomplete / blocked. `incomplete` adds `REPAIRABLE` yes (mechanical fault, approach survives it) or no (approach itself failed). Broken check → `blocked: invalid check` = Plan defect.
   - `INTEGRITY` clean / suspect / violation. Diff outside Write scope, or touching test or gate definitions the step didn't own → `suspect` at best.
   - `CONTRACT` aligned / drifted.
5. **Integrate.** complete + clean + aligned → Verified progress w/ Round SHA + report path. Anything else: findings → next executor brief as claims to reproduce or refute; Manager never fixes or verifies them in its own ctx. Executor refutes a finding w/ reproducible output → the Manager cannot overrule the auditor: show the user both and let the user decide. Archive block → Audit log, clear it, write state. Next round by verdict:
   - `REPAIRABLE: yes` → one recovery round, same approach, same Step base.
   - `REPAIRABLE: no` → approach to Dead ends, `git revert --no-edit <Step base>..HEAD` (never reset, never force-push), new approach from a new Step base.
   - `invalid check` → neither. Next Plan corrects the check from the auditor's diagnostic or the check-writes evidence, not from the executor's report. Step's work already committed → no executor: rerun Done-check, then a new audit of the same Round SHA.

## Section end

Last step of a section enters Verified progress → Manager runs every acceptance check of that section, logs → `evidence/section-<S>/`, then one Astra run per template over `<section base SHA>..HEAD`. Its questions differ from Sol's: do the steps work together, did a later round regress an earlier one, did the work drift from the contract. Last section's run covers the whole task: every acceptance check, `<task base SHA>..HEAD`. Same acceptance rule as a round audit: exit 0, non-empty, every verdict line, HEAD still equal to the head SHA named in its prompt. HEAD moved → verdict covers the old SHA only: not a pass for the section.

Fail → each finding = new step in that section's Remaining, through normal rounds. One Astra re-audit per section after the fixes land; a further one needs the user's OK.

Section shipped as a PR → commit, push, PR per repo rules; other repo-required pre-merge reviews still run. Record `Waiting: merge of <PR>`; next section starts from the merged default branch.

## Stagnation

Count from Audit log, never memory.

- Same step fails audit twice in a row → next brief changes approach; failed one → Dead ends first.
- Three rounds in a row, nothing new in Verified progress → stop spawning, rewrite Remaining, report to the user w/ Codex runs spent.
- At `max(5, 2 * initial step count)` rounds → reassess remaining work, report run count. Reassessment threshold only, not a completion rule.

## Completion

Answer from Verified progress alone, after the last section's Astra run passes. Unfinished = valid report: verified + remaining + missing checks. Bind the result to the head SHA that run audited; later commits need revalidation. Report Sol + Astra run counts, observed model + effort per run (or "requested, resolution unverified"), and evidence paths.
