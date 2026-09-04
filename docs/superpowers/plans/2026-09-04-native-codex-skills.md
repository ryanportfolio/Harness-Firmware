# Native Codex skills implementation plan

Convert the reviewed top-used skills and installation workflow into maintained Codex entry points. Keep Claude workflows unchanged. Preserve the user's current style preferences when reconciling personal copies.

- [x] Author and check writing-plans, writing-skills, and addskill.
- [x] Author and check impartial-review, refine, recall, and merge.
- [x] Author and check fable-mode, enhance-prompt, brainstorming, caveman, and writing; reconcile long-horizon details.
- [x] Register standalone ownership independently of Claude settings; test preservation, missing sources, and invalid metadata.
- [x] Update repository guidance and generated README statements.
- [x] Back up and reconcile the four existing personal copies of caveman, writing, refine, and long-horizon; verify exact content matches.
- [x] Run independent scenarios, static checks, sync regressions, and README checks. Record limits; leave publication separate.

## Verification

- All 26 automated tests passed: 15 sync regression cases, one copy-comparison case with multiple assertions, and 10 README tests.
- Sync and contract checks passed for 33 skills, including 13 standalone entries; the discovery catalog is 6,146 characters.
- README generated output is current; Git whitespace checks passed. Claude skill sources have no changes.
- Doctor reported no failures and one expected warning for the template's unconfigured project placeholders.
- Fresh independent scenario reviewers checked authoring, workflow authority, design, style, review capacity, and long-horizon decisions. Required-CI blocking and explicit writing-style override ambiguities were corrected and rechecked.
- A separate independent script review found no actionable issues in source ownership, sync, contract checks, or personal-copy comparison.
- Four existing personal copies match their repository sources. Originals and link metadata were backed up outside discovery roots; the linked main checkout was preserved.

Scenario responses validate decisions, not live end-to-end execution. No live merge or interrupted long-horizon run was used to prove these workflows. A new client session must confirm loaded skill discovery paths. Changes remain local; publication is separate.