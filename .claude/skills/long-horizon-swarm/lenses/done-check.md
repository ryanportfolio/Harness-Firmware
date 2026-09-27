# Lens: done-check

**Question:** can this round's done-check pass while the step is still wrong?

Use at Plan, before the executor is dispatched. The done-check freezes then, so a weak one
found later costs a whole round.

## Inspect

- The Current round block: Step, Done-check, Write scope.
- The contract's Acceptance list and the Dead ends.
- The code or files the done-check actually exercises. Read them; do not trust the check's
  name.

## A finding is

- A concrete wrong implementation that would still pass, e.g. a stub returning the expected
  value, a test that never reaches the changed path, or a check that reads a file the
  executor can write.
- A check that cannot run as written: wrong cwd, missing fixture, command absent on this
  machine.
- A gap between the check and Acceptance: part of the step's acceptance that no command
  verifies.

"Could be stronger" without a passing wrong implementation is not a finding.

## Return

For each finding: the wrong implementation or failure, the command that would pass anyway,
and a tightened check. End with `no findings` when none survive, so the host can end the
cycle.
