---
name: automate-me
description: "Use for \"automate me\", \"/automate-me\", \"create/update my -mode skill\", or \"turn my preferences / working style into a skill\". Mines the current project's transcripts plus direct questions, then drafts a personal <handle>-mode skill."
---

# Automate me

A guided flow for turning the user's working conventions into a skill agents will follow. The output is one `-mode` skill tailored to them (e.g. `ryan-mode`).

This skill orchestrates others: an inline mining pass (step 1), addskill (create/update/install, with runtime-specific authoring), and Writing for outward-facing prose. It sequences them; it doesn't replace them.

## Flow

### 0. Check for an existing skill

Look for the user's matching mode skill in the requested runtime's repository and configured personal discovery root. If one exists, confirm intent (unless they already said "update my skill" or similar):

- Update the existing skill (default for repeat runs)
- Start fresh (rare; ask why before doing it)

Update mode changes the rest of the flow:
- Step 1 mines only history since the skill was last edited (`git log -1 --format=%cI <path>`).
- Step 2 asks what's changed or missing, not what to capture from zero.
- Step 4 edits the existing file in place. Preserve sections the user hasn't contradicted; revise ones with new evidence; add new sections only for genuinely new rules.

### 1. Mine their history

Locate the current project's transcripts before fanning out. For Claude locally that is `~/.claude/projects/<munged-project-path>/` (the directory whose name encodes the project's absolute path); the project's auto-memory `MEMORY.md` under the same root is also evidence. For Codex, inspect the available task/history tools or configured project-scoped transcript source; do not assume the Claude path contains Codex history. Use only the current project's scope. Don't glob across other projects' directories: that crosses workspace boundaries and reads private chats from unrelated work. In a sandbox with no transcript access, say so and skip to step 2; questions plus CLAUDE.md and memory carry the draft.

Survey recent conversations for recurring patterns. When exposed and authorized, run parallel subagents across slices of history (e.g. last 2-4 weeks split into 3 slices so each has enough material). If agents are unavailable, mine serially and describe that limit. Each slice miner reads transcripts from the scoped path the parent provides, hunts the signals below, and returns a short structured list of patterns with evidence pointers. Default signals:

- Response preferences (length, tone, format, "dumb it down" corrections)
- Delegation habits (subagents, models, specialized workflows, parallelism)
- Verification posture (what "done" means; unit tests vs live repro; reviewers)
- Code and prose discipline (style, principles cited, lint/format tools)
- Process conventions (worktrees, commits, PRs, review/merge tooling)
- Meta preferences (fixing skills mid-task, proposing new ones)

Have each miner return **preference atoms**, not summaries: trigger, decision rule, quality bar, stop condition, evidence pointer, confidence. Rate confidence per atom: **strong** (explicit standing user preference or direct request to encode behavior), **medium** (accepted workflow or repeated tool/validation preference), **weak** (agent-chosen behavior with no user feedback, or a likely task-specific correction), **contradicted** (evidence points in incompatible directions — ask the user before writing anything based on it).

Cross-check across slices before elevating a signal. Repeated agent-chosen behavior remains inference, not user authorization. One explicit standing preference can be strong evidence without repetition; task-specific instructions remain scoped. Contradicted atoms never get codified silently.

### 2. Ask the user directly

Mining misses intent that hasn't come up yet. Ask structured multi-choice questions rather than asking the user to type from scratch: lower cognitive load, higher hit rate.

Use the input capabilities exposed by the current runtime; follow their question and option limits. Shape: one or two focused questions. Start broad ("Which areas matter most?"), then follow up on selected areas with specific options. After the structured rounds, one free-form question catches anything the options missed.

Don't dump 20 questions. Two structured rounds plus one open question is usually enough.

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

The fable-mode skill shows the output shape and granularity. Don't copy its content; the user's rules are not fable-mode's.

### 4. Draft the skill

Use addskill for create/update/install. It selects Claude authoring guidance or Codex built-in skill-creator, preserves ownership, and validates resources.

- Path: the requested runtime and scope; inspect `.claude/skills/`, `.agents/skills/`, and only the relevant configured personal root. Do not add global copies without authorization.
- Handle: the user's first name or chosen identifier.
- Frontmatter `description`: trigger on their name plus `/<handle>-mode` plus "work in their style" — not generic keywords like "write code" or "review PR". Avoid loose description matching. Preserve the requested invocation policy; in Codex, explicit-only metadata requires the user to request it.

### 5. Iterate on prose

Apply the selected authoring guidance to every line. Show the draft to the user and take feedback; expect multiple iterations. Cut ruthlessly: a mode skill is not a manual.

### 6. Validate and install within scope

Validate the draft and installed resources. Commit, push, PR, global copying and persistent shipping require existing or explicit authorization; creating a mode skill alone authorizes none of them.

## Guardrails

- **Don't overfit to one conversation.** A preference stated once and contradicted another time is noise. Preserve an explicit standing preference even if stated once; ask about contradictory evidence.
- **Don't be clever.** Restating other skills' contents, inventing metaphors, or writing "poetic" prose for an agent reader is cost without benefit. Keep it operational.
- **Reference, don't inline.** Other skills the user relies on appear as path references, not pasted excerpts.
- **Keep sections minimal.** Only add a section if the user has a specific, non-default rule there. "Communicate clearly" is not a section. "Short paragraphs. Tables when comparing options." is.
- **Name conventions generic.** Use "the user" in imperatives, not the author's first name. Others may read or adopt the skill.
- **Don't force symmetry.** No process rules worth writing down means no Process section. Sparse is fine; bloated is not.

## Evaluation

Ask whether the draft captures the user's preferences when material uncertainty remains. Validate subjective voice against their examples. For material routing, authorization, or decision rules, use addskill's bounded evaluation record and neighboring scenarios. Do not treat user approval of voice as proof that operational rules work.

## When not to use

- User wants a task-specific skill (not working conventions): addskill alone, no mining.
- User wants one narrow workflow captured ("how I write commit messages"): a regular skill, not a mode skill.

---
Adapted from the `automate-me` skill in [cursor/plugins pstack](https://github.com/cursor/plugins/tree/main/pstack) (MIT, by poteto); preference atoms and confidence scale from cursor-team-kit's `workflow-from-chats` (MIT).
