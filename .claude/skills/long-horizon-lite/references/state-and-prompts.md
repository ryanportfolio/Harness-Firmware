# long-horizon-lite: state file, audit prompts, launch

Read before creating the state file and before a section's audits.

## State file

Copy into `.tmp/long-horizon-lite/<task-slug>/state.md`.

```markdown
# Contract  (original retained; explicit user changes recorded as amendments)
Goal: <one paragraph>
Acceptance: <the checks that prove it done, as a numbered list>
Sections: <S1: steps 1-3, acceptance checks 1-2; S2: ...>  (none named: one section, all steps)
Task base: <SHA before round one>
Version: <current contract version>

# Amendments
- <version, explicit user instruction, changed checks, affected steps and claims>

# Verified progress  (section audits passed)
- <claim> — round <N>, commit <SHA>, Sol report <path>, section <S> Astra report <path>

# Provisional progress  (gate passed, not audited yet)
- <step> — round <N>, commit <SHA>, done-check log <path>

# Remaining
1. <step sized for one fresh context>; section: <S>; depends on: <step numbers or none>; finding: <report path#n, for a fix step>

# Current rounds  (one block per round, kept until its section is audited; scope and done-check fixed at Plan)
Round: <N>   Batch: <B>   Phase: planned | executing | committed | gated | merged
Step: <the one Remaining step this round works>
Branch: lh-lite/<task-slug>/r<N>
Workspace: <absolute path; the main workspace for a batch of one>
Done-check: <command, folder relative to the repo root, expected exit code, expected output line if any>
Write scope: <paths the executor may change; test and gate definitions only if the step is about them>
Audit prompt: <path, written at Plan, never edited> sha256: <hash at Plan>
Worker: <agent ID, last observed status; empty until an executor is dispatched>
Attempts: <commit SHA on the round branch per attempt, gate pass | fail>
Round SHA: <the merge commit on the task branch; filled at Merge>

# Section audits  (filled at section end)
Section: <S>   Base: <SHA of the task branch tip before the section's first round>   Pass: 1 | 2   Head: <SHA>
- round <N>: <run dir>, <process ID>, running | exited <code>, <verdict lines>
- section: <run dir>, <process ID>, running | exited <code>, <verdict lines>

# Dead ends  (approaches that failed their gate twice; do not retry without new evidence)
- <approach>: <why it failed, one line>

# Audit log
- round <N> (batch <B>), attempt <k>: <step> — gate pass | fail, <log path>; merge <commit, "conflict, back to Remaining", or "reverted, back to Remaining">
- section <S> pass <1|2>: round verdicts <N: status/integrity/contract, ...>, section <pass|fail>, <observed model and effort per run>
- unmerged round branches: <branch, why it was left>

# Codex runs
Sol: <count>   Astra: <count>   Expected minimum at start: <steps> + <sections>
```

## Round audit prompt (Sol)

Write to `evidence/round-<N>/prompt.md` at Plan. Fill only from the contract and the round's block; a fix round also names its finding reference. This file is frozen: never edit it after Plan. At section end, copy it into the new run dir and fill the three `<at section end>` fields in the copy, changing nothing else.

```markdown
You are the independent auditor for one step of a larger task. You did not write this code and
have seen none of the author's explanations. Work read-only: no edits, no agents, no nested reviews.

Contract (version <version>):
<goal paragraph>
Acceptance checks this step serves: <numbers and text>

Step: <step text>
Finding this step must close: <report path#n, or none>
Write scope: <paths>
Done-check: <command>, run from <folder relative to the repository root>, expected: <exit code and output line>

Base commit: <at section end: first parent of the round commit>
Round commit: <at section end: Round SHA>
Done-check output, captured by the task manager at the round commit: <at section end: absolute log path>

The round commit is the merge commit that brought this step into the task branch, and the base
commit is its first parent. Your checkout may be at a later commit, because other steps of the
same section were merged after it. Judge this step by its own diff, and read a file as this step
left it with `git show <round>:<path>`.

Do this in order:
1. Read the change with `git diff <base> <round>` and `git diff --stat <base> <round>`. That diff is
   the author's whole work for this step, every attempt included, and no other step's work.
2. Read the done-check log. Rerun the command only if it is safe to run without writing files, and
   say that a rerun reflects the later checkout, not the round commit.
3. Read the changed code and its callers far enough to judge whether the step is done, not only
   whether the check passed. Commit messages, comments and docs in the diff are the author's claims,
   not evidence.

Answer with exactly these four lines first, then the detail:

STATUS: complete | incomplete | blocked
REPAIRABLE: yes | no | n/a
INTEGRITY: clean | suspect | violation
CONTRACT: aligned | drifted

- STATUS is complete only if the done-check result matches the expected result and the code does
  what the step says. Use `blocked: invalid check` when the check cannot run as written, passes
  while the work is wrong, or fails while the work is right.
- REPAIRABLE applies to incomplete only: yes for a mechanical fault the approach survives (build
  error, missing dependency, harness failure), no when the approach itself failed.
- INTEGRITY is clean only if the diff touches nothing outside the write scope. A diff that changes
  test or gate definitions the step did not own is suspect at best: a passing check proves nothing
  if the author could edit it. Unclear evidence is suspect.
- CONTRACT is drifted when the change conflicts with the goal or an acceptance check.

EVIDENCE: for each verdict, the `path:line` or the command and output you relied on.
FINDINGS: numbered. Each: `path:line`, what is wrong, and the observation that would show it fixed.
```

## Section audit prompt (Astra)

Write into the section's new run dir at section end, after the Manager ran each acceptance check listed for the section and saved each output under `evidence/section-<S>/`. For the last section, list every acceptance check of the contract; its base is the task base, or its own section base when earlier sections shipped as PRs. A second pass gets a new run dir and a new prompt with the new head commit.

```markdown
You are the independent auditor for a finished section of a larger task. Another auditor is judging
each step on its own at the same time. You did not write this code. Work read-only: no edits, no
agents, no nested reviews.

Contract (version <version>):
<goal paragraph>
Acceptance checks for this section: <numbers and text>
Steps in this section: <step texts>

Base commit: <section base SHA, or task base SHA for the last section>
Head commit: <HEAD SHA>
Acceptance check outputs, captured by the task manager at the head commit: <absolute log paths>

Do this in order:
1. Read the change with `git diff <base> <head>` and `git diff --stat <base> <head>`.
2. Read each acceptance check log. Rerun a check yourself when it is safe to run without writing files.
3. Look for what a per-step audit cannot see: steps that do not work together, a later step that
   broke an earlier one, work that drifted from the contract, and acceptance checks that pass while
   the goal is not met.

Answer with exactly these two lines first, then the detail:

SECTION: pass | fail
CONTRACT: aligned | drifted

EVIDENCE: for each acceptance check, pass, fail or not run, with the log path or your own command and output.
FINDINGS: numbered. Each: `path:line`, what is wrong, which acceptance check or step it breaks, and
the observation that would show it fixed. Report only what breaks the goal or an acceptance check.
```

A section passes only on `SECTION: pass` + `CONTRACT: aligned` from a run that meets the acceptance rule in SKILL.md, together with complete + clean + aligned from every round audit of that pass. The pass belongs to the head commit in the prompt, not to a later one.

## Launch

One new directory per run, never reused: a retry or a second pass takes the next free number (`audit-2`, `audit-3`). `mkdir` without `-p` fails on an existing directory: stop there and take the next number. `$MODEL` = exact id resolved per SKILL.md Guardrails. Prompt goes on stdin (`-`), so no shell quoting touches it.

```bash
EV=<absolute task dir>/evidence/round-<N>     # or evidence/section-<S>
RUN="$EV/audit-1"
mkdir "$RUN" && cp "$EV/prompt.md" "$RUN/prompt.md"     # round audit: then fill the three facts in the copy with the file-edit tool
                                                        # section audit: write the prompt straight into "$RUN/prompt.md"
```

```bash
test -s "$RUN/prompt.md" && test ! -e "$RUN/run.log" && codex exec -s read-only -m "$MODEL" -c model_reasoning_effort=high -o "$RUN/report.md" - < "$RUN/prompt.md" > "$RUN/run.log" 2>&1
```

The two `test` guards keep Codex from starting without a prompt, or into a directory that already holds a run's log.

Launch a section's runs as separate background processes from the task branch checkout, at most 4 at a time; start the next as one exits. A foreground tool call dies at the harness's 10-minute ceiling and takes the audit with it. Before launch record in `$RUN/meta.md`: workspace, the SHAs in the prompt, CLI version, command, requested model + effort, start time. After exit add: exit code, end time, and the `model:`, `reasoning effort:` and `session id:` lines from the `run.log` header. A header that does not show the model → report it as requested, resolution unverified.

Read only the verdict lines of each report into the Manager's context (the first four lines of a round report, the first two of a section report; ignore trailing whitespace, and a value may carry a suffix such as `blocked: invalid check`). Report bodies go to the subagent that plans fix steps, and to fix-round executors, by path.
