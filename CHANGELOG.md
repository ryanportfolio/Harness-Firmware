# changelog

All notable changes to this project are documented here.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and
this project aims at [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Version boundaries before 1.2.0 are reconstructed from git history rather than
release tags, so the grouping is approximate. Anything older than 1.0.0 is
condensed.

## [Unreleased]

### Added

- `SubagentStart` hook (`.claude/hooks/subagent-start.sh`): every Claude Code
  subagent, including Explore and Plan, now gets terse writing rules for all its prose, reasoning and notes included: result
  first, shortest text that keeps every fact, paths, code and errors kept exact,
  uncertainty marked. The caveman output style never reached subagents.
- `deep-plan` skill: turns a loose idea on any subject into decisions the user
  makes, asked in rounds of at most 4 questions through the question popup (a
  chat format stands in when no popup tool is exposed). When a working directory
  exists, it keeps a decision ledger at `.tmp/deep-plan/<slug>/ledger.md` so a
  later session can resume. It stops at a recap with a reversal check on the
  weightiest decisions and builds nothing until the user picks Go, then offers
  `writing-plans` as the handoff. It runs only when the user invokes it, as
  `/deep-plan` in Claude Code and `$deep-plan` in Codex; the Codex version is
  classified Adapted.

### Changed

- `merge-ready` and the personal `/merge` skill are now one `merge` skill, shipped
  in the template and installed as the same file at `~/.claude/skills/merge`.
  Typing `/merge` commits, pushes and opens or reuses the PR, then runs the review
  loop: one `codex-fullreview` on the full PR diff, fixes for confirmed 🔴 and 🟡
  findings, then `codex-review` on the full diff at each new head until a round
  confirms none, with at most 3 reruns before it stops and asks. After the loop and
  CI pass at the same head, it squash-merges. `/merge` also turns on merge mode for
  the rest of the session: open PRs the session already made go through the loop
  right away, and every later PR goes through it and merges without another prompt. Round one no longer runs `codex-review` alongside
  `codex-fullreview`. User-invoke only; Claude Code only.
- `codex-fullreview` falls back to the global Codex skill at
  `~/.agents/skills/impartial-review/SKILL.md` when the reviewed repository has no
  `.agents/skills/impartial-review/SKILL.md`, so it runs outside template repos.
- `sync-codex-skills.mjs --check` and `--write` now warn and exit 0 on a Claude
  skill changed since its Codex port was reviewed, a skill with no
  `.agents/skill-modes.json` entry, mode `adapter`, a missing or stale
  `.agents/skill-sources.json` entry, and a leftover generated adapter. They exit 1
  only on broken input: unreadable or malformed JSON, a skill without frontmatter or
  a description, an invalid skill name or mode, or a deletion that would leave the
  repository.

### Fixed

- The Claude source hash in `sync-codex-skills.mjs` covers only the files git would
  commit (tracked, plus untracked files no `.gitignore` rule excludes), so an ignored
  `Thumbs.db` or `.DS_Store` in a skill folder no longer reads as drift. Without git
  it walks the folder as before. Hashes of committed folders are unchanged.
- `sync-codex-skills.mjs` warns about a hand-written Codex-only skill in
  `.agents/skills/` with no `.agents/skill-modes.json` entry; it passed silently.
- `removed-skills.mjs` warns when a skill the template manifest marks required is
  installed in neither runtime, even after its registration was deleted too; it
  warned only when the skill was still registered.

- `write-ci-workflow.mjs` no longer emits `tsc -b --noEmit` for TypeScript
  project references that form a chain. `--noEmit` reaches every project, and
  TypeScript rejects a project with source files that references one that does
  not emit (TS6310, reproduced with TypeScript 5.9.3). The pair is kept only for
  a root `tsconfig.json` with no inputs of its own (`files: []` or `include: []`,
  including values inherited through `extends`) whose referenced projects
  reference nothing further, the layout Vite generates; anything else, or a base
  config that cannot be read, gets plain `tsc -b`.
- `write-ci-workflow.mjs` reads a tsconfig that starts with a byte order mark,
  and asks the project's own TypeScript (`tsc --showConfig`, from
  `node_modules/typescript`) for the root's inputs when `extends` names a
  package. Both cases used to read as unknown and get plain `tsc -b`, which fails
  with TS5096 when a referenced project uses `allowImportingTsExtensions` without
  `noEmit`. Without TypeScript installed, a package base still reads as unknown.
- `write-ci-workflow.mjs` no longer counts a Python dependency with an
  environment marker, such as `pytest; sys_platform == "win32"`, as installed.
  pip and uv skip it on the ubuntu runner, so the workflow now installs the tool
  (`pip install pytest`, or `uv run --with pytest`). This includes a marker on a
  backslash-continued requirements line and a `;` written as a TOML escape.
- `write-ci-workflow.mjs` quotes requirements filenames for the shell, so
  `requirements dev.txt` reaches `pip install -r` as one argument.
- `.agents/template-manifest.json` lists `impartial-review` as a dependency of
  `opus-fullreview`. Its Manager reads `.claude/skills/impartial-review/SKILL.md`
  and stops without it, so a project that kept `opus-fullreview` but dropped
  `impartial-review` got a review skill that could not run.

## [1.7.0] - 2026-10-01

### Added

- Project CI from `/init-project`. New projects had no CI: the template's
  `validate-template.yml` is removed at creation. `.claude/scripts/write-ci-workflow.mjs`
  detects Node, Python, Rust and Go at the repo root and builds a
  `.github/workflows/ci.yml` with one job per stack, running only the typecheck, test
  and build commands the project has, plus a `firmware` job for the Codex skill sync
  check. With nothing detected, the workflow posts a notice instead of a test that
  checks nothing. Without a typecheck script, a TypeScript project gets `tsc --noEmit`,
  or `tsc -b` when the root `tsconfig.json` lists project references (with `--noEmit`
  when the declared TypeScript is 5.6 or later). Python runs pytest only when
  `test_*.py` or `*_test.py` files exist, and installs pytest, mypy or pyright itself
  unless a dependency list the install step installs already names it (extras and
  dependency groups it skips do not count). It prints by default; `--write` writes the file and refuses to replace an existing one
  without `--force`. `init-project` (Claude and Codex) shows the result and writes it
  after approval. Subfolder projects are not detected.
- `.agents/template-manifest.json`: one list, shipped into every new project, of
  which paths a new project gets (`projectPaths`), which stay in the template
  (`templateOnly`), the files a new project must have (`requiredFiles`), the README
  stub, and the skill groups, required skills, dependencies and the `minimal`
  preset. It replaces the copies of the template-only list that lived in
  `new-claude-project.sh`, `NewProjectCore.psm1`, the generator test and the
  `init-project` prose. The template-only list grows from 6 paths, plus the
  README the creators already replaced with a stub, to 16: `GUIDE.md`, `LICENSE`,
  the README and diagram assets and scripts, and `docs/research`, `docs/specs` and
  `docs/superpowers` no longer ship into new projects.
- `bootstrap/tests/check-template-manifest.mjs` and its tests, run in CI: every
  file in the template sits under exactly one `projectPaths` or `templateOnly`
  entry, every entry matches a file, required files exist and ship, every skill
  folder is in exactly one group, and every skill named in the rules exists. It
  lives in `bootstrap/`, so new projects neither get it nor fail on it.
- `bootstrap/tests/smoke-new-claude-project.sh`, run in CI on Linux: creates a
  project with `new-claude-project.sh` from a local copy of the commit with `gh`
  blocked, then checks it against the manifest. `HARNESS_TEMPLATE_URL` sets the
  clone source of the script's fallback, for mirrors and tests.
- `merge-ready` skill: the review loop that gets an open PR ready to merge. Round
  one runs `codex-fullreview` and `codex-review` in parallel on the PR's branch diff;
  confirmed 🔴 and 🟡 findings are fixed, committed and pushed, then `codex-review`
  reruns on the full diff at the new head until a round confirms none, with at most
  3 reruns before it stops and asks. It never merges and grants no merge authority,
  so a personal `/merge` skill can call it as its review gate without bringing
  auto-merge back into the template. User-invoke only: it runs when the user types
  `/merge-ready`, or when `/merge` reads the skill file; the model never starts it
  on its own. Claude Code only.
- `opus-fullreview` skill, the Claude counterpart of `codex-fullreview`. From a
  Codex session, Claude CLI runs the repository's Claude `impartial-review` as
  Manager with fresh Opus sub-reviewers, then Codex verifies every finding, so the
  review is cross-vendor. It stops unless Claude CLI shows a claude.ai login on a
  Max plan with no API key or provider variables set, and points to `claude-review`
  when the repository has no Claude `impartial-review`. Claude runs in read-only
  plan mode with skills turned off, and the skill confirms the skill read, the
  sub-reviewers, their models and which one received the author brief from
  Claude's saved transcripts. It never retries on its own. Registered `native` in
  `.agents/skill-modes.json`. Codex only.
- `long-horizon` ships `scripts/manifest.mjs`, a Node helper with no dependencies
  that builds the round Baseline, which each run used to script for itself. It
  hashes every dirty tracked file, every untracked file and every file under the
  extra paths given, records deleted paths, HEAD and a `git stash create` snapshot
  pinned with `git update-ref`, and `--diff` lists what was added, modified or
  deleted since. It handles cases an earlier hand-written script got wrong: a dirty
  file the executor reverts or commits unchanged, executor commits, and staged
  renames. Links and junctions are recorded by target, never followed.
  `long-horizon`, `long-horizon-workflows` and the Codex `long-horizon` port point to
  it, and the Codex port carries its own copy. Its tests,
  `.claude/scripts/test-long-horizon-manifest.mjs`, run in CI.

### Changed

- Project creators read the template manifest from the tree they are about to
  strip and have no built-in list to fall back on. `new-claude-project.sh` now
  needs `node` and stops with a clear message without it. Both creators also
  remove parent folders the strip leaves empty, such as `assets/`, and the
  Windows creator's offline copy skips template-only paths by full path rather
  than by name, so a nested file that shares a name with one, such as a future
  skill's own `README.md`, would still be copied.
- `removed-skills.mjs` reads the required skills and dependencies from the
  manifest; its `REQUIRED` and `DEPENDENCIES` exports still work. In a project
  older than the manifest it applies no required or dependency rule.
- `test-codex-contract.mjs` passes in a new project: it checks the `bootstrap/`
  creators only where `bootstrap/` exists, and the template-only path checks moved
  to the manifest check.
- `init-project` and `adopt-repo` read the template-only paths and the `minimal`
  preset from the manifest, and `sync-starter` never pulls a `templateOnly` path
  into a project. Links from shipped files into template-only files
  (`PROVENANCE.md`, `docs/codex-skills.md`) now point at the template on GitHub,
  and `GUIDE.md` says the README build scripts apply to the template only.
- `long-horizon` and `long-horizon-workflows` take over the useful parts of the
  retired `long-horizon-swarm`. A round whose execution or done-check costs hours
  gets one fresh read-only draft review of its step and done-check, preferably
  from another model family, before they freeze; the reviewer answers whether the
  check can pass on wrong work, fail on right work, or not run as written. A round
  that builds a verification tool later rounds rely on gets one cross-vendor code
  review of that tool first. Each phase ends with `codex-fullreview` (or
  `codex-review` for a small diff), with surviving findings fixed in an audited
  round before merge. Before resuming a run another session may still manage, the
  Manager asks the user whether to take over. The Codex `long-horizon` port uses
  `claude-review` and `opus-fullreview` for the same reviews.
- `long-horizon`, `long-horizon-workflows` and the Codex `long-horizon` port cover
  cases the first real `long-horizon-swarm` workload ran into. The round records the
  workspace it writes and any it only reads, and a new Method notes section holds
  rules later rounds must follow, unconfirmed until a later done-check covers them.
  The state file and briefs are written with the file-edit tool, since shell and
  script strings drop backslashes and backticks, and each brief is re-read before
  dispatch. Workers log long-lived processes to `processes.log`, and a resumed run
  stops those whose worker is gone. Executors of hours-long jobs check between
  batches that their workspaces are whole and stop on a mismatch. Evidence taken on
  another revision names that revision, and executors find cited code by anchor
  text, not line number. Integrate copies cited result files from outside the task
  directory into `evidence/round-<N>/`. With one PR per phase, the state records
  `Waiting: merge of <PR>` and the next phase starts in a fresh workspace from the
  merged default branch. In `long-horizon` and its Codex port, an auditor brief
  dispatched by path counts as unchanged when the agent checks it against the
  sha256 recorded at Plan.
- The README skill list comes from the skill folders. `scripts/readme/items.json`
  only adds labels, groups and order: a folder without an entry now joins the
  specialist group under its folder name instead of being left out, and an entry
  without a folder is still left out.
- Codex has two accepted routes: a ChatGPT login, or a `model_provider` gateway set in
  `config.toml` in `$CODEX_HOME` (default `~/.codex`), for example a CLIProxyAPI gateway
  over subscription accounts. `codex-review` and `codex-fullreview` accept either without
  a caveat, record which one ran, and stop only when neither holds. The agent never adds,
  changes or switches a provider or key itself. When a gateway is set it carries the
  requests, whatever `codex login status` says. `arena`, `long-horizon-swarm`,
  `long-horizon` and `long-horizon-workflows` use the same two routes to decide whether
  Codex joins.
- `perf-loop` starts with a triage pass when the request names no target. It measures
  every applicable dimension (loading, delivery size, rendering, input response, memory,
  service latency, CPU and disk), compares each with a budget or labeled reference,
  names the top contributor, and presents a ranked table. The skill then stops until the
  user picks the focus. A request that names a target skips triage. Triage numbers never
  serve as the acceptance baseline. The method lives in `references/triage.md`. The
  skill body and its triage, rendering, loading and services references are rewritten
  in compressed Caveman style, about 15% smaller, with every rule kept.
  `evidence-report.md` is unchanged because it must match the `wow-loop` copy.
- The kernel asks for independent work to run in parallel (`CLAUDE.md` under
  Subagents, `AGENTS.md` under Capabilities): when parts neither depend on each
  other's results nor edit the same files, start their subagents in one message.
  Dependent or overlapping work stays sequential, and parallel writers get separate
  files or worktrees.
- The kernel tells agents not to write unit tests or type tests unless the user
  asks (`CLAUDE.md` under Core principles, `AGENTS.md` under Defaults).
- Eleven skills run only when the user calls them, through
  `disable-model-invocation: true`: `why`, `lab`, `dare`, `adopt-repo`,
  `claude-review`, `astra-review`, `astra-fullreview`, `long-horizon-workflows`,
  `compact-review`, `forge-repo-ui-skill` and `optimize-context`. Each one bills a
  subscription run, acts outside the repository, or already said it runs only on
  request, and no other skill needs the model to start it. The eight with Codex
  ports get `allow_implicit_invocation: false` in `agents/openai.yaml`.
  `codex-fullreview`, which has no Codex port, got `disable-model-invocation: true`
  too and then lost it, so the model can still start a full Codex review.
- Several skills name an established term beside the prose that explains it
  (pre-registration, bottom line up front, atomic write, walking skeleton, issue
  tree, last known-good state, coordinated omission, elegant variation, hypophora),
  in both runtimes where the passage exists. The explanations stay. A 19-line table
  and closing section that repeated earlier content are removed from the retired
  `writing-skills/testing-skills-with-subagents.md`.
- Codex reviews pin `gpt-6.1-sol` in place of `gpt-6-sol`, which OpenAI no longer
  lists: `codex-review` in both runtimes, `codex-fullreview` and its sub-reviewers,
  and the example command in `impartial-review`.
- `codex-fullreview`, `astra-fullreview` and `opus-fullreview` no longer tell the
  agent to announce, before launch, that a full review uses more than the
  single-reviewer version.
- `wow-loop` accepts a target score ("get it to 8/10") and sets of like items, and
  still never produces a score of its own. A named score is settled once with the
  user: the items it covers, that it applies to each item rather than the average,
  and the benchmark. At 90% of the top of the user's scale or higher it means
  standard acceptance; lower makes checks the user confirms advisory, through a
  contract amendment with a neutral ID. Critics and judges never see the target.
  Items mode applies one shared rubric of three to six checks to each item and
  reviews each item on its own, while the files one writer owns stay the unit of
  work. Target, before/after and items runs start with a review-only baseline pass.
  Critic briefs carry fixed severity anchors, and a disputed judged verdict gets one
  second blind critic whose stricter verdict stands unless a measurement refutes it.
  At acceptance the skill offers to move the `check.sh` checks into the project's
  tests and to commit a scorecard. Reports give checks passed and findings by
  severity per item, before and after. The Codex port matches. Adapted from MengTo's
  workflow-score-to-target skill, without its 0-10 scoring.

### Removed

- The skill capability manifest `.agents/skill-capabilities.json`, its checker
  `check-skill-capabilities.mjs`, its tests, its CI step and the generated catalog
  in `docs/codex-skills.md`. Copies of the template kept failing when the manifest
  drifted from the skill folders. `.agents/skill-modes.json` is now the only record
  of which Codex copies are native or disabled. The removal policy (required skills
  and dependencies) moved into `removed-skills.mjs`, and the list of retired skills
  moved into `sync-codex-skills.mjs`, which still warns when one reappears.
- The `long-horizon-swarm` skill is retired, with its `done-check` lens and
  `references/codex-peer.md`. On an 11-round study-engine run its draft reviews
  caught dozens of flawed done-checks before costly rounds ran, but it cost 21
  Codex runs and about 12 extra Opus passes, and its rule of continuing while any
  pass found something produced review chains that mostly polished wording. A
  review of the finished branch then found 3 real defects in a verification tool
  that eleven rounds of peer review had never looked at. The parts that paid off
  moved into `long-horizon` and `long-horizon-workflows` (see Changed).
  `sync-codex-skills.mjs` warns if a copy reappears from an old sync.

### Fixed

- `removed-skills.mjs` warns when a present skill needs one that
  `.claude/settings.json` turns `"off"` in `skillOverrides`. The check looked only
  for skill files, so a project that turned off `impartial-review` got no warning
  while the Codex sync shipped no copy of it and `/codex-fullreview` stopped at
  preflight. A skill that is itself turned off is not checked.

## [1.6.6] - 2026-09-27

### Changed

- `impartial-review` adds an open-lens reviewer to every review except a tiny
  diff. It gets the diff and the names of the lenses already assigned, never their
  findings or the author brief, picks the one or two lenses most likely to find a
  real problem nobody else covers (such as frame budget, reduced motion or
  cross-platform shell behavior), and ties each choice to specific lines. Every
  report lists each standard review area that had no reviewer, with a one-line
  reason, and the lenses the open-lens reviewer chose. `codex-fullreview` carries
  both into its attribution. The Codex copy of `impartial-review` gets the same
  reviewer and report lines.

## [1.6.5] - 2026-09-27

### Changed

- `impartial-review` takes an optional author brief of facts: the goal, the files
  or behaviors most likely to break, related work in flight and the checks already
  run. Only a new intent reviewer sees it; it checks whether the change achieves
  its goal on every path, which required cases are unhandled, and whether the
  risky areas are actually safe. The five existing reviewers never see the brief,
  so every review keeps a layer free of the author's framing, and without a brief
  the review runs as before. The Manager tags each finding blind, intent or both.
  The Claude and Codex copies both change. `codex-fullreview` and
  `astra-fullreview` write a brief by default unless the user asks for a fully
  blind review, and `codex-fullreview` checks the Codex session files to confirm
  exactly one sub-reviewer received it.

## [1.6.4] - 2026-09-27

### Changed

- `.claude/reference/pitfalls.md` ships empty, like the other reference files. Its
  entries were the template's own accumulated gotchas: its tooling and README panels, its
  maintainer's machine, and general lessons such as escaping JSON inside `<script>`, stale
  preview servers and background server ports. Each one was copied into every repository
  created from the template. The kernel's browser rule no longer points at it for detail.

## [1.6.1] - 2026-09-26

### Added

- `long-horizon-swarm` skill: the `long-horizon` contract with Opus, Sol and Astra
  as peers who contribute ideas, critique and code throughout a run. It attaches to
  an existing run's state file, logs contributions and Codex spend in `swarm.md`, and
  reports disagreements to the user instead of blocking on them. The per-round
  auditor stays fresh and never sees swarm output. Each peer works through a lens,
  either a swarm lens in `lenses/` (starting with `done-check`) or an existing skill's
  criteria. Authors reply to critique before the host acts, any peer can execute a
  round, and `references/codex-peer.md` holds the tested Windows copy and launch
  recipe. Revised from a live dogfood run of the skill on itself. Claude Code only.
- A removal record, `.agents/removed-skills.json`, for skills a project deletes on
  purpose. A missing skill listed there produces no warning. The new `removal` block
  in `.agents/skill-capabilities.json` names the skills the template expects every
  project to keep (`init-project`, `external-review`) and which skills need others.
- `external-review`, a Codex-only leaf review: one reviewer, one fresh context, one
  exact diff scope, no agents or edits. `codex-review` and `astra-review` in both
  runtimes now launch it through a custom prompt when the reviewed repository has it,
  and fall back to the `--base`/`--commit`/`--uncommitted` selector with Codex's
  built-in rubric when it does not. New Claude skills `codex-fullreview` (Sol, high)
  and `astra-fullreview` (Astra, medium) run a full multi-agent review instead: plain
  `codex exec` runs `impartial-review` as Manager with fresh-context sub-reviewers,
  and the launcher counts the spawns from the Codex session file and reports a
  zero-spawn run as "no sub-reviewers ran". They use more Codex usage than the
  single-context launchers.
- `long-horizon-workflows` skill: the `long-horizon` contract with each round's
  baseline, executor, inspector and judges run as one Workflow script, so audit
  agents cannot inherit Manager context, verdicts are schema enums, and the run
  journal records every agent's input and output. Judge count is chosen per round.
  Claude Code only; Codex keeps `long-horizon`.

### Changed

- A skill folder that `scripts/readme/items.json` does not list no longer produces a
  README warning. The README still leaves it out until it is listed.
- Adding or removing a skill no longer fails a check. Codex sync, the capability and
  contract checks, the doctor, and the README verify step and tests now warn and exit 0
  for a missing or unregistered skill, a missing dependency, a retired skill that
  reappears (the warning names its replacement), adapter drift, a stale capability
  catalog, and a README that differs from a fresh build, including hand edits. CI shows
  the warnings as annotations. A check still fails when a file cannot be read: invalid
  JSON in a manifest, the removal record, or settings, or a `SKILL.md` without
  frontmatter or a description. `verify.mjs` builds into a scratch directory and no
  longer rewrites the committed README. README tests check a fresh build instead of the
  committed files and no longer pin the template's skill counts.
- README counts read naturally at one ("1 workflow", "browse the only skill") and leave
  out empty groups; group counts and the narrow memory map follow the skills installed.
  After a rebuild, the quickstart, the "what the firmware adds" table, and the feedback
  loop text name only installed skills. The template's own README is unchanged.
- Check failures caused by unreadable JSON print one line naming the file instead of a
  stack trace. Codex sync generates no adapter for a retired skill, and each warning
  appears once in CI.
- General Writing now checks evidence and reader understanding before style, scopes
  clarity and style verdicts, and allows explanations to follow reader needs. Claude
  and Codex each ship a complete standalone package with local references and licenses.
- Every Codex skill is now a maintained native skill. The 14 that were generated
  adapters (`adopt-repo`, `advocate`, `arena`, `astra-review`, `automate-me`,
  `babysit-ci`, `claude-review`, `codex-review`, `dare`, `forge-repo-ui-skill`, `lab`,
  `optimize-context`, `session-hub`, `sync-starter`) no longer tell Codex to read the
  Claude workflow. Each is written for Codex: exposed agents with fresh context that
  fail closed, `update_plan` and direct questions instead of Claude-only tools,
  `~/.codex/sessions/` for `automate-me`, and the same-vendor disclosure when
  `codex-review` or `astra-review` runs from Codex. Supporting files for
  `forge-repo-ui-skill` and `session-hub` now sit beside their Codex skill. The Claude
  skills are unchanged, and a new skill without a native version still gets a generated
  adapter.

### Removed

- The `merge` skill leaves the template. Session-wide auto-merge is a personal
  authorization policy, not a repository one, so it now lives as a global skill in
  `~/.claude/skills/merge`. The kernel's squash-by-default and one-PR-per-unit rules
  are unchanged.

## [1.6.0] - 2026-09-19

### Changed

- `refine` gates edits on three checks before changing anything: the failure is
  attributable to an instruction, tool, or configuration; the causal link is stated from
  evidence; and the rule being changed was active in the failure. It also checks what the
  agent saw and remembered before blaming instructions. Informed by ModularRSI's
  failure-mode checklist, in original wording.
- Evidence workflows package compact reports and comparable before/after presentation.
  Design, planning and review workflows add selective shared-code refactoring guidance
  for Claude and Codex, with standalone resources and existing authorization preserved.

## [1.5.0] - 2026-09-14

### Changed

- Skill authoring now starts with `addskill`; `writing-skills` discovery is retired
  with authoring resources and licenses preserved. Caveman includes Unslop, with
  explicit prose and code cleanup retained after standalone Unslop retirement.
- Claude and Codex workflows align evidence, independent review, authorization,
  runtime discovery and selective native propagation. Claude gains `perf-loop`.
- Capability coverage, resources, ownership and retirement now have a manifest
  and regression checks. Older disabled retirement entries remain compatible;
  startup and contributor guidance follow the consolidated routes.
- Existing projects receive explicit retirement migration steps, a native Codex
  drift reminder, and optional-settings compatibility in copy and README tooling.

## [1.4.0] - 2026-09-07

### Changed

- `writing` skill: pattern 31 carries the Latinate-dress-up trap table
  from Corewise.Academy `plain-words` (prohibition → ban, verbatim →
  word-for-word, and so on) plus the what-never-changes list; the
  plain-words rule in SKILL.md names the swaps. Pattern 5 labels its
  After text as citing a source the writer already had, so the example
  no longer reads as permission to invent one.
- Codex planning, review, authorization, and recovery workflows have clearer scope and
  verification rules. `addskill` and `fable-mode` now have native bodies registered in
  `.agents/skill-modes.json`. Claude workflows and existing disabled choices are preserved.
- A read-only copy checker detects drift in explicitly selected personal skill roots;
  maintenance documentation covers backup, reconciliation, and discovery checks.

## [1.3.0] - 2026-09-04

### Added

- `writing` skill: one skill for text that leaves the session (docs,
  READMEs, site and UI copy, emails) and for editing or auditing a draft
  for AI tells. Adds the rhetoric patterns from petergyang/no-ai-slop
  (throat-clearing openers, faux-insight setups, colon reveals, kickers)
  and its edit-mode restraint (minimum effective edit, keep real hedges).

### Changed

- `CLAUDE.md`, `caveman`, `session-start.sh`: the always-on core-tells
  digest now points at `writing/patterns.md` instead of the removed
  `unslop` skill.

### Removed

- `humanizer`, `purposeful-writing`, `unslop` skills and the
  `bootstrap/machine/home-claude/skills/writing` copy, folded into
  `writing`. The always-on digest in `CLAUDE.md` and `caveman` is
  unchanged.

## [1.2.1] - 2026-08-29

### Added

- `scripts/lib/launch-chrome.mjs`: headed Chrome launcher that puts the
  window on a display the operator is not using and hands the keyboard
  back, so the real-GPU browser rule stops interrupting them.
- `refine` skill: post-task pass that mines the session for friction and
  commits the smallest edit that prevents a repeat (concept port of
  prime-agent's Continual Harness).
- `long-horizon` skill: Manager/Executor/Auditor rounds with audit-gated
  durable state for tasks bigger than one context window (concept port of
  AMAP-ML's LongHorizon-Harness).

### Changed

- `README.md`: the safety model section became "what's different here", the
  template's differentiators; the safety rules moved to `CONTRIBUTING.md`
  beside the PR checklist that enforces them.

## [1.2.0] - 2026-07-25

### Changed

- Renamed the project to **Harness Firmware**. The name describes what the
  layer configures: the agent harness (Claude Code, Codex), not a model. The
  repository URL is unchanged. Machine identifiers (plugin `name`, skill
  namespaces) are unchanged so existing installs keep working.
- Restructured `README.md` around what the layer is, how to install it, and
  what it costs to keep loaded.
- `/init-project` now asks which prose mode a project wants instead of assuming
  silently. `caveman ultra` remains the inherited default; `lite`, `full`, and
  `normal` are one answer away, and `README.md` documents changing it later.
  The skill also offers a minimal skill preset for projects that want a small
  always-loaded surface.

### Added

- POSIX bootstrap script, so setup works from a plain shell without PowerShell.
- `doctor.mjs`, a preflight check for a checkout: the SessionStart hook is
  wired, skill frontmatter parses, generated Codex adapters are in sync, the
  reference library is complete, plugin manifests parse, no `FILL IN` markers
  survived, and the always-loaded context weight is reported.
- Community files: `CHANGELOG.md`, `CONTRIBUTING.md`, and GitHub issue
  templates for bug reports and skill proposals.

### Fixed

- Frontmatter parsers in `sync-codex-skills.mjs` and `test-codex-contract.mjs`
  did not recognize `>-` block scalars, which made the `perf` skill
  undiscoverable in Codex and hid its description-length violation from CI.
  Both parsers are fixed and the `perf` description now fits the 240-char
  contract limit.

## [1.1.3]

### Fixed

- `/sync-starter` guards the spawn-critical surface (`bootstrap/`,
  `.claude/hooks/`, `settings.json`) from direct-to-main commits and ships the
  post-squash branch re-sync fix to plugin installs.

## [1.1.2]

### Added

- `perf` skill: a measurement rig for web performance work, so changes to
  bundling, preload hints, and lazy loading get measured instead of assumed.
- Steering levers adopted from `mattpocock/skills` across the core skills.
- PASS/FAIL verdict step in the `writing` skill.
- The global `writing` skill is now tracked by the home-claude bootstrap.

### Fixed

- The `merge` skill re-syncs the session branch after each squash merge, so a
  commit pushed after a merge is no longer stranded off `main`.
- The bootstrap `writing` skill is ASCII-only, which unbreaks validation on
  `main`.
- Restored the squash-merge default and the one-open-PR reuse rule in the
  `merge` skill.

### Changed

- `CLAUDE.md` allows plan-mode popups (`ExitPlanMode`, `AskUserQuestion`).

## [1.1.0]

### Added

- Unified project generator for spawning a configured repo.
- Visual project creator UI (`new-claude-project-ui`).
- Codex hardening for spawned projects: `AGENTS.md` owns Codex runtime safety
  and tool translation, and generated adapters live in `.agents/skills/`.
- Pitfall entry: verify local preview servers before trusting them.

### Changed

- Trimmed the `CLAUDE.md` kernel down to cross-cutting rules; topical detail
  moved to `.claude/reference/`.
- Pointed template references at the renamed repository.

## [1.0.0]

### Added

- `fable-mode` skill for layered work with dependent steps and
  verification-sensitive handoff.
- `purposeful-writing` skill, folding in the best of `humanizer`.

### Fixed

- `addskill` lands a new skill on `main` via the merge flow instead of leaving
  it on a branch.

## [0.x]

Earlier history condensed: the initial kernel, the on-demand skill system,
committed project memory under `.claude/reference/`, session hooks, the Codex
skill sync scripts, and the first pass at context-weight accounting.
