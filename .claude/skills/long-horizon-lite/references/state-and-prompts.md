# long-horizon-lite: state file, audit prompts, launch

Read before creating the state file and before the first audit of a run.

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

# Verified progress
- <claim> — round <N>, commit <SHA>, audit report <path>

# Remaining
1. <step sized for one fresh context>; section: <S>; depends on: <step numbers or none>

# Current round  (scope and done-check fixed at Plan)
Round: <N>   Phase: planned | executing | awaiting-audit | audited
Step: <the one Remaining step this round works>
Step base: <SHA before this step's first attempt; a recovery round keeps it>
Done-check: <command, cwd, expected result>
Write scope: <paths the executor may change; test and gate definitions only if the step is about them>
Audit prompt: <path, written at Plan>
Worker: <agent ID, last observed status>
Round SHA: <filled after Execute's commit>
Audit run: <run dir, process ID, running | exited <code>; filled at launch>

# Dead ends  (approaches that failed audit; do not retry without new evidence)
- <approach>: <why it failed, one line>

# Audit log
- round <N>: <step> — <status>/<integrity>/<contract>, <report path>, <observed model and effort>
- section <S>: <pass or fail>, <report path>, <observed model and effort>

# Codex runs
Sol: <count>   Astra: <count>   Expected at start: <steps> + <sections>
```

## Round audit prompt (Sol)

Write to `evidence/round-<N>/prompt.md` at Plan. Fill only from the contract and the Current round block. After Execute, fill the three `<after Execute>` fields and change nothing else.

```markdown
You are the independent auditor for one step of a larger task. You did not write this code and
have seen none of the author's explanations. Work read-only: no edits, no agents, no nested reviews.

Contract (version <version>):
<goal paragraph>
Acceptance checks this step serves: <numbers and text>

Step: <step text>
Write scope: <paths>
Done-check: <command>, run from <cwd>, expected: <expected result>

Base commit: <after Execute: Step base SHA>
Round commit: <after Execute: Round SHA>
Done-check output, captured by the task manager after the round commit: <after Execute: log path>

Do this in order:
1. Read the change with `git diff <base> <round>` and `git diff --stat <base> <round>`. That diff is
   the author's whole work for this step, every attempt included.
2. Read the done-check log. If the command is safe to run without writing files, run it yourself
   and compare; if not, say that you relied on the log.
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

Write to `evidence/section-<S>/prompt.md` when the section's last step enters Verified progress. The Manager first runs each acceptance check listed for the section and saves each output under `evidence/section-<S>/`. For the last section, list every acceptance check and use the task base.

```markdown
You are the independent auditor for a finished section of a larger task. Each step in it passed its
own audit separately. You did not write this code. Work read-only: no edits, no agents, no nested reviews.

Contract (version <version>):
<goal paragraph>
Acceptance checks for this section: <numbers and text>
Steps in this section: <step texts>

Base commit: <section base SHA, or task base SHA for the last section>
Head commit: <HEAD SHA>
Acceptance check outputs, captured by the task manager at the head commit: <log paths>

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

A section passes only on `SECTION: pass` + `CONTRACT: aligned` from a run that meets the acceptance rule in SKILL.md (exit 0, non-empty, HEAD still equal to the head commit in the prompt). The pass belongs to that head commit, not to a later one.

## Launch

One new directory per run, never reused: a retry or a re-audit takes the next free number (`audit-2`, `audit-3`). `mkdir` without `-p` fails on an existing directory, and `&&` then keeps Codex from starting and overwriting an earlier run's log. `$MODEL` = exact id resolved per SKILL.md Guardrails. Prompt goes on stdin (`-`), so no shell quoting touches it.

```bash
EV=.tmp/long-horizon-lite/<task-slug>/evidence/round-<N>     # or evidence/section-<S>
RUN="$EV/audit-1"
mkdir "$RUN" && codex exec -s read-only -m "$MODEL" -c model_reasoning_effort=high -o "$RUN/report.md" - < "$EV/prompt.md" > "$RUN/run.log" 2>&1
```

Run it in the background and poll `run.log` + exit status; a foreground tool call dies at the harness's 10-minute ceiling and takes the audit with it. Before launch record in `$RUN/meta.md`: workspace, Base and round (or head) SHAs, CLI version, command, requested model + effort, start time. After exit add: exit code, end time, and the `model:`, `reasoning effort:` and `session id:` lines from the `run.log` header. A header that does not show the model → report it as requested, resolution unverified.
