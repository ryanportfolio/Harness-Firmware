# Launch example

Mandatory read from Step 3 of [../SKILL.md](../SKILL.md) before launching. Path choice, run metadata, and the rules for a requested focus stay in SKILL.md Step 3. Runner docs: `.claude/scripts/codex-run/README.md`.

For example, a branch diff in a POSIX shell, run from the repository root:

```bash
RUNNER=.claude/scripts/codex-run/codex-run.mjs
mkdir -p .tmp
RUN=$(mktemp -d .tmp/codex-review-XXXXXXXX)
git fetch origin main
BASE=$(git merge-base origin/main HEAD); HEAD_SHA=$(git rev-parse HEAD)
# write "$RUN/manifest.md" now (SKILL.md Step 3)

# External-review path (.agents/skills/external-review/SKILL.md exists):
cat > "$RUN/prompt.md" <<EOF
Read .agents/skills/external-review/SKILL.md completely and follow it for this review of the branch diff: base $BASE, head $HEAD_SHA. Read the diff with git diff $BASE $HEAD_SHA. Leaf review: no agents, no nested reviews, no edits.
EOF
node $RUNNER --review --role sol --prompt-file "$RUN/prompt.md" \
  --expect-diff "$BASE $HEAD_SHA" --expect-read .agents/skills/external-review/SKILL.md \
  --out "$RUN/codex" --label "codex-review branch $BASE..$HEAD_SHA" > "$RUN/runner.log" 2>&1

# Selector path (no external-review skill):
node $RUNNER --review --role sol --base origin/main \
  --expect-diff "$BASE $HEAD_SHA" --out "$RUN/codex" > "$RUN/runner.log" 2>&1
```

- Single commit: selector `--commit "$HEAD_SHA"`, `--expect-diff "$BASE $HEAD_SHA"` with `BASE` = parent or the empty tree for a root commit. Smoke-tested 2026-11-22 on codex-cli 0.171.0: `ok`, 1 review sibling, `exitedReviewMode` 1, `diffReads` 0 (the selector reviewer read the change with `git show <sha>`, so scope identity stays unverified on this path).
- Uncommitted work: selector `--uncommitted`, `--expect-diff "$HEAD_SHA"` (one SHA means `git diff <head>`); the runner also sets `untrackedListed`.
- Explicit user model or effort: replace `--role sol` with `--model <id>` and/or add `--effort <e>`.
- Run the whole `node $RUNNER ...` line through Bash `run_in_background`; a foreground call dies at the 10-minute ceiling. Poll `cat "$RUN/codex/status.json"`; after exit read `$RUN/codex/result.json`, `$RUN/codex/review-output.json`, and `$RUN/codex/last.md`. `runner.log` holds only the 30 s progress lines and the final `OK` or `FAILED: <reason>` line. Redirect complete output to a file, never through `head` or `tail`.
- PowerShell: no `<` redirection and no heredoc. Write the prompt with the Write tool and pass `--prompt-file`. The runner sends the prompt to codex on stdin, so `$` and backticks in it are safe; only the shell that writes the file can expand `$`.

External-review prompts per scope (substitute the resolved SHAs; append only a focus the user requests):

- Branch diff: `Read .agents/skills/external-review/SKILL.md completely and follow it for this review of the branch diff: base <base-sha>, head <head-sha>. Read the diff with git diff <base-sha> <head-sha>. Leaf review: no agents, no nested reviews, no edits.`
- Single commit, where base is the parent or, for a root commit, the empty tree from Step 2: `Read .agents/skills/external-review/SKILL.md completely and follow it for this review of commit <head-sha>: base <base-sha>, head <head-sha>. Read the diff with git diff <base-sha> <head-sha>. Leaf review: no agents, no nested reviews, no edits.`
- Uncommitted work: `Read .agents/skills/external-review/SKILL.md completely and follow it for this review of the uncommitted working tree (staged, unstaged, untracked) against head <head-sha>. Read tracked changes with git diff <head-sha>, list files with git status --porcelain --untracked-files=all, and read each untracked file's contents. Leaf review: no agents, no nested reviews, no edits.`
