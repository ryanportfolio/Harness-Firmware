# Claude and Codex skill parity review

Reviewed 14 September 2026 against repository revision `ab8330318e05bf9d690287d85d10361a918d6e45`.

## Assessment

The catalog has strong capabilities, but its two runtime versions have accumulated different policies. Some differences are necessary tool adaptations; others change what the user receives, when work stops, or whether an improvement reaches another project.

The appropriate target is equivalent user-facing capabilities and acceptance criteria, with explicit runtime-specific execution. Equal file counts or identical skill bodies would not establish that equivalence.

This is a source and maintenance review, not an execution benchmark. Scope includes all 36 active skill names, native/adapter ownership, relevant dependencies, and existing copies of registered native skills in the two known personal discovery roots. No skills, personal installations, or the existing white paper were modified. The paper remains an accurate description of its pinned snapshot.

## Highest-priority opportunities

### 1. Restore performance workflow coverage for Claude

`perf-loop` exists only in Codex. Its useful behavior is largely portable: reproducible baselines, fixed metrics and regression limits, serial benchmarking on shared hardware, one hypothesis per round, independent measurement and regression critics, and a final combined-state benchmark.

Add a Claude entrypoint and the three domain references. Adapt agent dispatch and runtime examples; preserve the measurement contract. Copying a Codex-only spawn instruction verbatim would be insufficient. Validate both runtimes on an actual improvement, a noisy inconclusive result, a quality-reduction tradeoff, and an unavailable measurement capability.

Source: [performance workflow](../../.agents/skills/perf-loop/SKILL.md), [ownership registry](../../.agents/skill-modes.json).

### 2. Make Unslop's intended role explicit

Both Caveman bodies already contain Unslop. Codex additionally exposes a standalone `unslop` command for existing prose and scoped code-diff cleanup. Therefore, the missing capability is not automatic cleanup in Codex chat; the discrepancy is the extra entrypoint and its broader role.

Honor the user's stated design: Caveman owns automatic session cleanup; Writing owns outward-facing prose. Remove the separate Codex discovery entry after preserving any desired explicit code-diff cleanup behavior in an appropriate existing workflow. Do not add a redundant Claude Unslop skill merely to equalize counts. If an explicit alias is retained for compatibility, document it as an alias rather than a separate capability.

Also reconcile the two style boundaries. Claude Caveman duplicates a core-tells digest in `CLAUDE.md`, and its description asserts approximately 75% token savings without task evidence here. Claude Writing makes its dash ban outrank the writer's sample voice; Codex Writing makes style defaults subordinate to user choices. Choose one user-approved policy and test preservation of quotations, identifiers, technical caveats, and explicitly requested voice.

Sources: [Claude Caveman](../../.claude/skills/caveman/SKILL.md), [Codex Caveman](../../.agents/skills/caveman/SKILL.md), [standalone Unslop](../../.agents/skills/unslop/SKILL.md), [Claude Writing](../../.claude/skills/writing/SKILL.md), [Codex Writing](../../.agents/skills/writing/SKILL.md).

### 3. Repair native-skill propagation

`sync-starter` says only its listed paths are sync candidates. Its Direction A diff includes Claude skills and the Codex compatibility file, but omits `.agents/skills/` and `.agents/skill-modes.json`. Regenerating adapters does not repair this: the generator deliberately preserves maintained native files.

Extend selective comparison and application to the ownership registry and maintained native bodies and resources. Reconcile registry changes together with their corresponding files, preserve project customizations and deliberate disables, and generate only adapter-owned content. Add an integration case where a native skill and a referenced resource change upstream and are selectively adopted downstream.

Sources: [sync-starter](../../.claude/skills/sync-starter/SKILL.md), [generator](../../.claude/scripts/sync-codex-skills.mjs), [native maintenance contract](../codex-skills.md).

### 4. Replace the oversized authoring workflow without losing authoring

Claude `writing-skills` is 707 lines. Its useful core includes clear discovery descriptions, appropriate structure, baseline observations, pressure/application scenarios, provenance, and evaluating actual behavior. Its universal failure-first rule covers every edit, including documentation updates; its deployment checklist also includes commit and push. These requirements are too broad for metadata fixes and conflict with `refine`'s newer static-validation allowance.

Replace it with a concise Claude authoring workflow and optional evaluation references. Keep static validation for nonbehavioral changes and baseline/candidate scenarios for material routing or decision changes. Preserve negative and neighboring cases, evaluator integrity, and observable evidence. Avoid treating one successful scenario as proof of general reliability.

Do not simply delete it. `addskill`, `automate-me`, and `refine` depend on it. Update those references and the catalog in the same migration. Codex already routes authoring to its built-in `skill-creator`; that does not establish an equivalent authoring capability in every Claude installation. A replacement can keep the existing name initially to reduce migration risk.

Sources: [writing-skills](../../.claude/skills/writing-skills/SKILL.md), [Claude addskill](../../.claude/skills/addskill/SKILL.md), [automate-me](../../.claude/skills/automate-me/SKILL.md), [Claude refine](../../.claude/skills/refine/SKILL.md).

### 5. Bring verification and refinement decisions into alignment

Claude `verify-this` always requires old-state baseline and changed-state treatment. Its verdict rules make a missing baseline inconclusive even for a current-state claim such as an image's exact dimensions. Codex now distinguishes current-state, change, and causal claims. Port that distinction and the corresponding verdict rules to Claude. Remove or replace its reference to the absent `run` skill.

Claude `refine` also says every skill misfire is a description bug. That can produce unnecessary trigger edits when the actual cause is an ignored instruction, a missing tool, or a conflicting rule. Codex already separates these diagnoses. Reconcile the Claude trigger, diagnosis, testing, and commit rules with the narrower evidence-based approach. Preserve the shared material-change evaluation record.

Sources: [Claude verification](../../.claude/skills/verify-this/SKILL.md), [Codex verification](../../.agents/skills/verify-this/SKILL.md), [Claude refinement](../../.claude/skills/refine/SKILL.md), [Codex refinement](../../.agents/skills/refine/SKILL.md).

### 6. Make independence and evidence identity consistent

Claude `why` and `advocate` permit the author to provide its own critique if agent dispatch fails, without requiring disclosure that the independent check was lost. Their Codex counterparts or adapter boundary reject that substitution. Require the same distinction in both runtimes: useful personal reasoning can continue, but independent review remains unavailable.

The transfer can also run from Claude to Codex. Claude `long-horizon` explicitly freezes the auditor brief before the executor starts and dispatches it unchanged. Native Codex excludes executor reports but is less prescriptive about when that brief is written. Adopt a shared contamination-control requirement while allowing different snapshot mechanisms.

Standardize task-local run identity across review skills. `claude-review` uses unique directories; `codex-review` and `astra-review` examples reuse fixed report/log filenames. Different prefixes separate review types but do not separate two invocations of the same type. Bind reports to the actual run, source state, process outcome, and requested scope. Keep model-specific commands as thin configurations over one reviewed execution contract.

Sources: [why](../../.claude/skills/why/SKILL.md), [advocate](../../.claude/skills/advocate/SKILL.md), [Claude long-horizon](../../.claude/skills/long-horizon/SKILL.md), [Codex long-horizon](../../.agents/skills/long-horizon/SKILL.md), [Codex review](../../.claude/skills/codex-review/SKILL.md), [Astra review](../../.claude/skills/astra-review/SKILL.md), [Claude review](../../.claude/skills/claude-review/SKILL.md).

### 7. Unify installation, planning, and shipping boundaries

Claude `addskill` assumes every new skill is Claude-canonical with a generated adapter. That no longer describes the ownership system. It also automatically routes installation through a merge workflow whose Claude definition enables a persistent session mode. Installation, one-shot shipping, and persistent shipping should be separate outcomes, with existing user authorization carried forward.

Its blanket claim that skills are invisible until merged into `main` should become runtime-specific discovery guidance with an observed reload check. This review does not establish every current client's discovery behavior.

Claude `writing-plans` requires complete implementation code in every code step and asks the user to choose an execution mechanism after saving. Native Codex plans scale detail to uncertainty and continue already-authorized implementation. Bring those semantics into alignment. Retain exact interfaces, dependencies and acceptance checks where useful; avoid implementing an entire solution twice, first in prose and then in files.

`merge` intentionally differs in its trigger: Claude is persistent-mode-only; Codex supports one-shot and persistent requests. Unify the user-facing trigger distinction and exact-head verification requirement while allowing a documented branch strategy. Review-only `babysit-ci` requests should likewise remain distinguishable from authorization to fix and push.

Sources: [Claude addskill](../../.claude/skills/addskill/SKILL.md), [Codex addskill](../../.agents/skills/addskill/SKILL.md), [Claude plans](../../.claude/skills/writing-plans/SKILL.md), [Codex plans](../../.agents/skills/writing-plans/SKILL.md), [Claude merge](../../.claude/skills/merge/SKILL.md), [Codex merge](../../.agents/skills/merge/SKILL.md), [CI workflow](../../.claude/skills/babysit-ci/SKILL.md).

## Complete catalog disposition

`Both/native` means a maintained Codex body plus a Claude body. `Both/adapter` means Codex delegates to the Claude source with its runtime boundary. Recommendations are source-review opportunities, not observed behavioral failure rates. A keep recommendation does not certify every execution path.

| Skill | Current coverage | Recommended disposition |
|---|---|---|
| addskill | Both/native | Reconcile installation with native ownership, explicit runtime selection, and shipping scope |
| adopt-repo | Both/adapter | Keep; clarify preservation checks around intentional `.gitignore` merges and verify collisions before publication |
| advocate | Both/adapter | Keep explicit trigger; disclose missing independent review rather than treating fallback as equivalent |
| arena | Both/adapter | Keep distinct exploration role; preserve blind judgment while withholding angle-revealing rationale from judges; agreement is not correctness evidence |
| astra-review | Both/adapter | Keep thin model-specific entrypoint; unique run identity and truthful model fallback attribution |
| automate-me | Both/adapter | Keep project-scoped preference mining; replace authoring dependency and distinguish explicit preferences from inferred repetition |
| babysit-ci | Both/adapter | Keep all-checks inspection; distinguish watch-only from fix/push requests and bind final status to current head |
| brainstorming | Both/native | Keep calibrated discovery; common scenarios should verify no approval detour after an already-settled design |
| bro | Both/native | Keep lightweight simplification, including preservation of caveats and technical meaning |
| caveman | Both/native | Own automatic Unslop in both; align style boundaries and remove unsupported savings claim |
| claude-review | Both/adapter | Keep subscription-aware leaf review; retain runtime/auth preflight without treating pinned product facts as permanent |
| codex-review | Both/adapter | Keep independent finding verification; unique reports and shared lifecycle checks |
| dare | Both/adapter | Keep first-principles chain; carry immutable goal/constraints alongside isolated artifacts so useful isolation does not erase acceptance conditions |
| enhance-prompt | Both/native | Keep prompt-only role; align handling of already-authorized work and proportional verification |
| fable-mode | Both/native | Keep lightweight evidence discipline; reduce mandatory plan/checklist duplication in Claude |
| forge-repo-ui-skill | Both/adapter | Keep research/build/replace boundaries and provenance; select authoring runtime explicitly |
| handoff-audit | Both/native | Keep prompt-only output, exact source identity, raw evidence, and no automatic audit execution |
| impartial-review | Both/native | Keep coverage/precision split; common independence contract and capacity-aware staffing |
| init-project | Both/native | Preserve explicit setup scope; assess whether Claude's useful optional profiles/pruning should be offered in Codex, without automatic deletion |
| lab | Both/adapter | Keep human tuning and exact parameter transfer; make file/server/browser interaction capability-driven rather than assuming one preview host |
| long-horizon | Both/native | Keep durable rounds; align frozen audit brief, baseline identity, and explicit budget semantics |
| merge | Both/native | Unify one-shot versus persistent intent and exact-head checks; document branch-strategy differences |
| optimize-context | Both/adapter | Add Codex-native measurement/discovery path; qualify relocation as preserving content, not automatically preserving retrieval behavior |
| perf-loop | Codex/native only | Add equivalent Claude workflow and domain resources |
| recall | Both/native | Keep durable fact curation; align capture authority and commit policy without automatic cross-project propagation |
| refine | Both/native | Align diagnosis, proportional evaluation, and evidence-backed scope |
| session-hub | Both/adapter | Keep cooperative ownership ledger; support an authorized workspace location when Desktop is inaccessible |
| showpiece | Both/native | Keep creative direction; use wow-loop only when iterative independent visual verification is needed |
| sync-starter | Both/adapter | Include native bodies/resources and ownership map in selective propagation |
| unslop | Codex/native only | Fold discovery into intended Caveman/Writing roles; preserve explicit cleanup capability before retirement |
| verify-this | Both/native | Port current-state/change/causal distinction to Claude |
| why | Both/native | Keep one-recommendation scope; explicit independence gap and configured runtime model handling |
| wow-loop | Both/native | Keep strong visual acceptance machinery; align shared evidence and budget definitions without erasing runtime details |
| writing | Both/native | Align user voice precedence and chat/deliverable boundaries; preserve useful optional pattern resources |
| writing-plans | Both/native | Scale plan detail and continue authorized execution without a forced mechanism-choice gate |
| writing-skills | Claude only; Codex disabled | Replace large mandatory workflow with lean authoring plus optional behavioral evaluation references |

## Preventing the next divergence

Add a small capability manifest alongside the existing ownership map. For each skill, record intended runtime coverage, owner, supported entrypoints or aliases, deliberate exceptions, required tools, and behavior that must remain equivalent. Generate the human catalog from it. Existing ownership metadata answers who maintains a file; it does not answer whether a capability was accidentally omitted.

Use shared references for portable protocols where that reduces duplication, with runtime-specific bodies for dispatch, authentication, paths, and client behavior. Do not replace all maintained native skills with generic adapters merely to obtain matching files. Shared semantics still need observable checks.

A focused parity suite should cover:

- Automatic Unslop in chat, ordinary-prose deliverables, and an explicit cleanup request.
- A current-state fact versus an improvement or causal claim.
- A metadata correction versus a material skill-routing change.
- Failed reviewer dispatch, stale report files, and dirty/untracked evidence identity.
- A one-shot merge versus persistent shipping mode and installation without publication.
- A native upstream skill/resource update selectively adopted downstream.
- An already-approved design and an implementation request that includes planning.
- Performance noise, quality loss, missing measurement capability, and final combined-state verification.

Freeze expected outcomes before candidate trials, include neighboring cases, and keep evaluator changes separate. Passing these cases would establish their scoped behavior, not general model superiority.

## Installed-copy findings

The existing copy checker compared three registered native copies in each known personal root. `caveman`, `showpiece`, and `long-horizon` became equal after normalizing line endings and trailing whitespace; their byte differences do not establish behavioral drift.

Personal `writing` and `refine` still differ after normalization. The personal Writing copy has extra pattern/provenance resources that may be intentional. The personal Refine copy lacks the repository's `references/evaluation.md`. A linked Unslop copy was reported unverified, not defective. Reconcile intended behavior with backups and explicit installation scope; do not overwrite every different file. Verify actual discovery after reload.

## Verification and suggested order

Fresh checks passed: synchronization reported 21 native Codex bodies and 14 adapters; the contract check reported 35 Codex skills and 6,345 catalog characters. Inventory remains 34 Claude entrypoints and 36 names across both runtimes. These checks do not enforce semantic parity.

A fresh read-only validator independently confirmed five findings: native propagation omission, unconditional Claude verification baselines, contradictory refinement rules, undisclosed self-review fallback permitted by Claude review skills, and authoring dependencies that must be preserved during retirement. Other entries are the primary reviewer's source-based recommendations; no independent review is claimed for every catalog row. No candidate behavior trials or external model CLI reviews were run.

Recommended first implementation round: add Claude performance coverage; resolve Unslop's extra entrypoint; repair native propagation; port claim-specific verification. Second round: simplify Claude authoring and reconcile refine/addskill/planning dependencies. Third round: align audit contracts, improve run identity, add the capability manifest and focused behavioral cases, then reconcile approved personal installations. Each round should leave both catalogs usable and retain the existing paper's historical source identity.
