---
name: "automate-me"
description: "Use for \"automate me\", \"$automate-me\", \"create/update my -mode skill\", or \"turn my preferences / working style into a skill\". Mines this project's Codex sessions plus direct questions, then drafts a personal <handle>-mode skill."
---

# Automate me

A guided flow for turning the user's working conventions into a skill agents will follow.
The output is one `-mode` skill tailored to them (e.g. `ryan-mode`).

This skill sequences others: an inline mining pass (step 1), `$addskill` for
create/update/install (it authors through the built-in skill-creator in Codex), and
`$writing` for outward-facing prose. It does not replace them.

## Where the skill lives

A personal Codex skill lives in the user's personal discovery root:
`~/.agents/skills/<handle>-mode/SKILL.md`. Older Codex installs also discover
`~/.codex/skills/`, and both roots can hold personal skills on the same machine. Inspect both
for an existing copy. Update an existing copy where it is; create a new one only in the root
the user requested, defaulting to `~/.agents/skills/`. Never create copies in both roots.
Write to the repository's `.agents/skills/` only when the user asks for a project-shared mode
skill; `$addskill` then covers native registration. Follow `docs/codex-skills.md` for backups
before replacing a personal file.

## Flow

### 0. Check for an existing skill

Look for the user's matching mode skill in `.agents/skills/` and both personal roots above.
A personal entry may be a symlink into another checkout; resolve it and report the real path
before editing. If one exists, confirm intent (unless they already said "update my skill" or
similar):

- Update the existing skill (default for repeat runs).
- Start fresh (rare; ask why before doing it).

Update mode changes the rest of the flow:

- Step 1 mines only history since the skill was last edited (`git log -1 --format=%cI <path>`
  when it is tracked, otherwise the file's modification time).
- Step 2 asks what has changed or is missing, not what to capture from zero.
- Step 4 edits the existing file in place. Preserve sections the user has not contradicted;
  revise ones with new evidence; add new sections only for genuinely new rules.

### 1. Mine their history

Mine Codex history from `~/.codex/sessions/` (or `$CODEX_HOME/sessions/` when set), not
`~/.claude/projects/`. Use only the current project's scope. Do not read other projects'
conversations: that crosses workspace boundaries and exposes private chats from unrelated work.
In a sandbox with no access to the sessions directory, say so and skip to step 2; questions
plus `AGENTS.md`, the `CLAUDE.md` sections `AGENTS.md` names, and `.claude/reference/` carry
the draft.

Layout:

- Active threads: `sessions/YYYY/MM/DD/rollout-<YYYY-MM-DDTHH-MM-SS>-<thread-id>.jsonl`.
  Archived threads: `archived_sessions/rollout-*.jsonl` (flat, same naming). The filename
  date selects a time window without opening the file.
- One JSON record per line: `{timestamp, type, payload}`. The first line is always
  `type: "session_meta"`; its payload carries `cwd`, `git` (`repository_url`, `branch`,
  `commit_hash`), `originator`, and `source`. `turn_context` records repeat `cwd` per turn.
- User turns are `type: "response_item"` with `payload.type: "message"` and
  `payload.role: "user"`; text is in `payload.content[].text`. Injected context arrives with
  the same role (AGENTS.md instructions, `<environment_context>` and other tag-wrapped
  blocks); skip it. `role: "developer"` is system-injected, not the user. Tool calls are
  `function_call` / `custom_tool_call` with matching `*_output` records.
- `~/.codex/session_index.jsonl` maps thread ids to thread names and update times.

Scoping:

1. Resolve the project: repository root (`git rev-parse --show-toplevel`), its worktrees
   (`git worktree list`), and origin (`git remote get-url origin`).
2. Select a thread by reading only its first line. Keep it when `git.repository_url` matches
   the origin (ignore a trailing `.git` and case), or when `cwd` is inside the repository
   root or one of its worktrees. Codex worktree threads run under `~/.codex/worktrees/<id>/`,
   so a path match alone misses them. Do not read further into threads that fail both tests.
3. Classify by `source`. `vscode` and `cli` are interactive user threads. `exec` threads are
   `codex exec` runs, often launched by another agent (for example a Claude review). A
   `source` object with a `subagent` key is a spawned, guardian, or review thread. User-role
   text in `exec` and subagent threads was written by an agent: use it only as evidence of
   delegation habits, never as a user preference.

Survey recent in-scope threads for recurring patterns. When multi-agent tools are exposed in
the current session, spawn parallel read-only miners with `fork_turns: "none"` across slices
of history (e.g. the last 2-4 weeks split into 3 slices so each has enough material). Give
each miner a self-contained brief: its exact list of in-scope thread files, the record shape
above, the signals below, the atom format, and a ban on reading other files. Each returns
a short structured list of patterns with evidence pointers. If agents are not exposed, mine
serially and state that limit; this pass does not require independent context. Default
signals:

- Response preferences (length, tone, format, "dumb it down" corrections)
- Delegation habits (subagents, models, specialized workflows, parallelism)
- Verification posture (what "done" means; unit tests vs live repro; reviewers)
- Code and prose discipline (style, principles cited, lint/format tools)
- Process conventions (worktrees, commits, PRs, review/merge tooling)
- Meta preferences (fixing skills mid-task, proposing new ones)

Have each miner return **preference atoms**, not summaries: trigger, decision rule, quality
bar, stop condition, evidence pointer (thread file and record timestamp), confidence. Rate
confidence per atom:

- **strong**: explicit standing user preference or direct request to encode behavior.
- **medium**: accepted workflow or repeated tool/validation preference.
- **weak**: agent-chosen behavior with no user feedback, or a likely task-specific correction.
- **contradicted**: evidence points in incompatible directions. Ask the user before writing
  anything based on it.

Cross-check across slices before elevating a signal. Repeated agent-chosen behavior remains
inference, not user authorization. One explicit standing preference can be strong evidence
without repetition; task-specific instructions remain scoped. Contradicted atoms never get
codified silently.

### 2. Ask the user directly

Mining misses intent that has not come up yet. Ask structured multiple-choice questions rather
than asking the user to type from scratch: lower cognitive load, higher hit rate.

Use the current input tool when one is exposed and follow its question and option limits;
otherwise ask directly in chat with numbered options. Shape: one or two focused questions.
Start broad ("Which areas matter most?"), then follow up on selected areas with specific
options. After the structured rounds, one free-form question catches anything the options
missed.

Do not dump 20 questions. Two structured rounds plus one open question is usually enough.

### 3. Cluster findings

Group the combined signals into sections. Common ones (use only what applies):

- **Response style**: length, tone, format.
- **Autonomy**: how much to do without asking; tool use.
- **Understand first**: which skills to reach for when scoping or investigating.
- **Subagents**: default, parallelism, model-to-task, specialized workflows.
- **Prose / code discipline**: principles, lint tools, style guides.
- **Review and verify**: repro posture, verification skills, live-testing tools.
- **Process**: git worktrees, commits, PRs, review/merge tooling.
- **Skills**: skill-authoring habits, fix-the-skill-first, proposing new skills.

The `fable-mode` skill shows the output shape and granularity. Do not copy its content; the
user's rules are not fable-mode's.

### 4. Draft the skill

Use `$addskill` for create/update/install. It authors through the built-in skill-creator,
preserves ownership, and validates resources.

- Path: the target chosen under "Where the skill lives". Do not add copies to other roots
  without authorization.
- Handle: the user's first name or chosen identifier.
- Frontmatter `description`: trigger on their name plus `$<handle>-mode` plus "work in their
  style", not generic keywords like "write code" or "review PR". Avoid loose description
  matching. Preserve the requested invocation policy; explicit-only metadata
  (`agents/openai.yaml` disabling implicit invocation) requires the user to request it.

### 5. Iterate on prose

Apply the selected authoring guidance to every line. Show the draft to the user and take
feedback; expect multiple iterations. Cut ruthlessly: a mode skill is not a manual.

### 6. Validate and install within scope

Validate frontmatter, the name/directory match, resources, and the exact destination. Do not
claim the running session has loaded the new skill; discovery needs a reload in the target
client. Writing to a personal root is installation: do it when the user asked for a personal
skill or confirmed the root. Commit, push, PR, copying into additional roots, and persistent
shipping require existing or explicit authorization; creating a mode skill alone authorizes
none of them.

## Guardrails

- **Do not overfit to one conversation.** A preference stated once and contradicted another
  time is noise. Preserve an explicit standing preference even if stated once; ask about
  contradictory evidence.
- **Do not be clever.** Restating other skills' contents, inventing metaphors, or writing
  "poetic" prose for an agent reader is cost without benefit. Keep it operational.
- **Reference, do not inline.** Other skills the user relies on appear as path references,
  not pasted excerpts.
- **Keep sections minimal.** Only add a section if the user has a specific, non-default rule
  there. "Communicate clearly" is not a section. "Short paragraphs. Tables when comparing
  options." is.
- **Name conventions generic.** Use "the user" in imperatives, not the author's first name.
  Others may read or adopt the skill.
- **Do not force symmetry.** No process rules worth writing down means no Process section.
  Sparse is fine; bloated is not.

## Evaluation

Ask whether the draft captures the user's preferences when material uncertainty remains.
Validate subjective voice against their examples. For material routing, authorization, or
decision rules, use addskill's bounded evaluation record and neighboring scenarios. Do not
treat user approval of voice as proof that operational rules work.

## When not to use

- User wants a task-specific skill (not working conventions): `$addskill` alone, no mining.
- User wants one narrow workflow captured ("how I write commit messages"): a regular skill,
  not a mode skill.

---
Adapted from the `automate-me` skill in [cursor/plugins pstack](https://github.com/cursor/plugins/tree/main/pstack) (MIT, by poteto); preference atoms and confidence scale from cursor-team-kit's `workflow-from-chats` (MIT).
