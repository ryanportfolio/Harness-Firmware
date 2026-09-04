# Native Codex skills implementation plan

Convert the reviewed top-used skills and installation workflow into maintained Codex entry points. Keep Claude workflows unchanged. Preserve the user's current style preferences when reconciling personal copies.

- [x] Author and check writing-plans and addskill. Evaluate writing-skills, then retain main's disabled choice in favor of built-in skill-creator as agreed by the user.
- [x] Author and check impartial-review, refine, recall, and merge.
- [x] Author and check fable-mode, enhance-prompt, brainstorming, caveman, and writing; reconcile long-horizon details.
- [x] Reconcile ownership with main's existing skill-modes registry; preserve legacy disabled choices and native source independence. Test preservation, missing sources, and invalid metadata.
- [x] Update repository guidance and generated README statements.
- [x] Back up and reconcile the four existing personal copies of caveman, writing, refine, and long-horizon; verify exact content matches.
- [x] Run independent scenarios, static checks, sync regressions, and README checks. Record limits; leave publication separate.

## Verification before integration

- All 26 automated tests passed: 15 sync regression cases, one copy-comparison case with multiple assertions, and 10 README tests.
- Sync and contract checks passed for 33 skills, including 13 standalone entries; the discovery catalog is 6,146 characters.
- README generated output is current; Git whitespace checks passed. Claude skill sources have no changes.
- Doctor reported no failures and one expected warning for the template's unconfigured project placeholders.
- Fresh independent scenario reviewers checked authoring, workflow authority, design, style, review capacity, and long-horizon decisions. Required-CI blocking and explicit writing-style override ambiguities were corrected and rechecked.
- A separate independent script review found no actionable issues in source ownership, sync, contract checks, or personal-copy comparison.
- Four existing personal copies match their repository sources. Originals and link metadata were backed up outside discovery roots; the linked main checkout was preserved.

## Integration with current main

PR #108 independently introduced native workflows and the skill-modes registry. The merged
implementation uses that registry and its existing sync safeguards, rather than adding a
second registry. Main's native why, bro, handoff-audit, init-project, and unslop remain
unchanged. The user chose to keep writing-skills disabled and use built-in skill-creator.

- All 33 integrated tests passed: 20 sync cases, two copy-check cases, and 11 README cases.
- Sync and contract checks passed for 17 native skills and 16 adapters; catalog size is
  5,955 characters. Generated README output is current.
- Independent integration review found no introduced defects. A stale init-project adapter
  description was corrected in the guide.
- The four reconciled personal copies retain matching instruction content; Git checkout
  changed repository line endings, which the byte-level checker reports as drift.
  Linked personal skills require separate inspection and are reported as unverified.

Scenario responses validate decisions, not live end-to-end execution. No interrupted
long-horizon run was used to establish recovery. A new client session must confirm loaded
skill discovery paths. Publication was separately authorized after the recommendation review.
