# codex-fullreview: launch command and per-scope prompts

Mandatory read from `../SKILL.md` Step 3 before launch. Launch only through `.claude/scripts/codex-run/codex-run.mjs` from the repository root; never a hand-built `codex exec` line, never the prompt as a CLI argument.

For example, a branch diff in a POSIX shell:
```bash
mkdir -p .tmp
RUN=$(mktemp -d "$PWD/.tmp/codex-fullreview-XXXXXXXX")
git fetch origin main
BASE=$(git merge-base origin/main HEAD); HEAD_SHA=$(git rev-parse HEAD)
MODEL=$(node -p "require('./.claude/scripts/codex-run/models.json').roles.sol.model")
# write $RUN/brief.md first (SKILL.md Step 3), unless fully blind
cat > "$RUN/prompt.md" <<EOF
Read .agents/skills/impartial-review/SKILL.md completely and act as its Manager on the branch diff: base $BASE, head $HEAD_SHA. Read the diff with git diff $BASE $HEAD_SHA. Spawn fresh-context sub-reviewers with spawn_agent, fork_turns "none", model $MODEL, reasoning_effort high, as the skill directs; each is a leaf reviewer. Start no codex exec or other reviewer CLI process; if agent tools are missing, say so in the report. Author brief: $RUN/brief.md; give it only to the intent reviewer, as the skill directs; every other sub-reviewer gets the diff without it. No file edits, no Git writes, no publication. Verify the sub-reviewers' findings and write the final verified report. First line: Scope: base $BASE, head $HEAD_SHA. Second line: Sub-reviewers: <number spawned>.
EOF
# Bash tool: run_in_background true; then poll $RUN/codex/status.json, read $RUN/codex/result.json
node .claude/scripts/codex-run/codex-run.mjs --out "$RUN/codex" --role sol --sandbox read-only \
  --prompt-file "$RUN/prompt.md" --timeout-min 60 \
  --expect-read .agents/skills/impartial-review/SKILL.md --expect-diff "$BASE $HEAD_SHA" \
  --label codex-fullreview > "$RUN/runner.log" 2>&1
```

- The heredoc is unquoted on purpose: `$BASE`, `$HEAD_SHA`, `$RUN` and `$MODEL` expand when the file is written. The prompt reaches Codex on stdin, so nothing expands after that. Check `prompt.md` before launch.
- Explicit user model or effort: replace `--role sol` with `--model <id> --effort <e>`, and put the same values in the prompt's `model` and `reasoning_effort`. The `--effort medium` planning option changes both.
- Fallback Manager skill copy (SKILL.md Step 1): replace `.agents/skills/impartial-review/SKILL.md` in the prompt and in `--expect-read` with its absolute path.
- Report: `$RUN/codex/last.md`. Evidence: `$RUN/codex/result.json` (`threadId`, `evidence.rollout`, `spawnCalls`, `expectedReads`, `diffReads`).
- `--expect-diff` counts only the Manager's own `git diff BASE HEAD` reads (`diffReads`). Uncommitted scope: `--expect-diff "$HEAD_SHA"` (also sets `untrackedListed`). Commit scope: `"<base-sha> <head-sha>"`.

Each scope has its own complete prompt. Substitute the resolved SHAs and `$MODEL`; append only a focus the user requests:

- Branch diff: the prompt in the example above (drop its author-brief sentence for a fully blind review).
- Single commit, where base is the parent or, for a root commit, the empty tree: `Read .agents/skills/impartial-review/SKILL.md completely and act as its Manager on commit <head-sha>: base <base-sha>, head <head-sha>. Read the diff with git diff <base-sha> <head-sha>. Spawn fresh-context sub-reviewers with spawn_agent, fork_turns "none", model <MODEL>, reasoning_effort high, as the skill directs; each is a leaf reviewer. Start no codex exec or other reviewer CLI process; if agent tools are missing, say so in the report. No file edits, no Git writes, no publication. Verify the sub-reviewers' findings and write the final verified report. First line: Scope: base <base-sha>, head <head-sha>. Second line: Sub-reviewers: <number spawned>.`
- Uncommitted work: `Read .agents/skills/impartial-review/SKILL.md completely and act as its Manager on the uncommitted working tree (staged, unstaged, untracked) against head <head-sha>. Read tracked changes with git diff <head-sha>, list files with git status --porcelain --untracked-files=all, and read each untracked file's contents. Spawn fresh-context sub-reviewers with spawn_agent, fork_turns "none", model <MODEL>, reasoning_effort high, as the skill directs; each is a leaf reviewer. Start no codex exec or other reviewer CLI process; if agent tools are missing, say so in the report. No file edits, no Git writes, no publication. Verify the sub-reviewers' findings and write the final verified report. First line: Scope: uncommitted, head <head-sha>, paths <every dirty path, comma-separated>. Second line: Sub-reviewers: <number spawned>.`

When a brief is supplied for a single commit or uncommitted work, insert the author-brief sentence after the scope, as in the branch prompt.
