# Pitfalls

> Accumulated project-specific gotchas. Dated entries, newest at the bottom. If this file exceeds ~200 lines, split by area (`pitfalls-<area>.md`) and update the CLAUDE.md index.

## Starter safety

This starter must not ship maintainer-only checkout paths, private workflow
rules, secrets, or local-machine assumptions. Put those in untracked personal
instructions or in a private fork-specific memory file instead.

Worktree changes are isolated. Before claiming a template change is available
somewhere else, verify the exact branch or checkout the user asked about. Do not
merge, pull into another checkout, or touch paths outside the current workspace
unless the user explicitly asks in the current session.

## Local preview servers: stale or wrong site (2026-07-18)

Symptom: opening a local dev/preview server shows an outdated version of the
site, or a completely different project.

Root causes:

1. **Server reuse on a busy port.** Preview tooling (and manual servers) reuse
   whatever is already bound to the port. A server left over from a prior
   session serves old code; a different project on a shared default port
   (3000/5173/8080) serves the wrong site entirely.
2. **Worktree mismatch.** Server launched from the main checkout while edits
   live in a git worktree (or the reverse) — edits never appear no matter how
   often the page reloads.
3. **Stale build output.** Serving `dist/`/`build/` without rebuilding after
   source edits.
4. **Browser cache / service worker.** Old assets persist even after the
   server itself is current.

Prevention protocol (run every time before trusting a preview):

1. Before starting: check the port (`netstat -ano | findstr :<port>` on
   Windows, `lsof -i :<port>` on Unix). Port busy → inspect the owning PID's
   command line and cwd; if they don't match the current checkout, kill it or
   start on a fresh unique port. Never assume a reused server is the right one.
2. After loading: **sentinel check** — verify the page contains a string unique
   to the change just made (via page-text extraction, not a screenshot glance).
   No sentinel visible → server is stale or wrong; stop and diagnose before
   claiming anything works.
3. Static builds: rebuild before serving; confirm output mtime is newer than
   the edited sources.
4. Staleness persists after 1–2 → hard reload, unregister service workers, or
   use a fresh browser profile.

## Cross-cutting engineering gotchas (2026-08-18, from cursor-team-kit review)

1. **History rewrites: tree-hash check.** Before any agreed rebase/squash of a
   pushed branch, capture `ORIGINAL_TREE=$(git rev-parse origin/<branch>^{tree})`;
   after rewriting, compare with `git rev-parse HEAD^{tree}`. Do not push if the
   tree changed unintentionally — the rewrite was supposed to reshape history,
   not content.
2. **JSON embedded in `<script>` tags.** `JSON.stringify`/`json.dumps` output is
   not HTML-safe: a `</script>` inside a string terminates the tag early. Escape
   `<`, `>`, `&` as `\u003c`, `\u003e`, `\u0026` before embedding.
3. **Backgrounded dev servers: fixed port.** Background shells have no TTY, so
   server startup messages can sit buffered and unread — with port 0
   (auto-assign) you can never learn which port was chosen. Always pass an
   explicit port to servers started in the background.

## Merging before CI has registered (2026-08-19)

Right after a push, `gh pr checks <n>` can answer:

```
no checks reported on the '<branch>' branch
```

That is the workflows not having registered yet, not the repo lacking CI. Read
as a green light, it merges a pull request with nothing run against it.

`--auto` is not the fix on its own. Auto-merge waits only for checks that branch
protection marks required, so on an unprotected default branch it merges
immediately, jobs still in progress.

Fix: poll until no check is pending, then merge.

```bash
for i in $(seq 1 20); do
  out=$(gh pr checks <n> --json name,state --jq '.[] | .name+": "+.state')
  echo "$out" | grep -qE "IN_PROGRESS|PENDING|QUEUED" || { echo "$out"; break; }
  sleep 15
done
```

A zero-check answer within a minute of a push is not an answer yet; wait for at
least one check to appear before trusting it. Protecting the default branch with
the jobs required makes `--auto` sufficient and removes the polling, but that
changes repository settings, so it needs the owner's decision.

## Reusing a branch after its squash merge conflicts on every file (2026-08-19)

Squash-merging collapses a branch into one new commit on the default branch. The
branch's own commits stay behind and are not ancestors of that commit. Push a
follow-up to the same branch and every file the squash introduced looks added on
both sides from the shared base:

```
CONFLICT (add/add): Merge conflict in <path>
```

`gh pr view` then reports `"mergeable":"CONFLICTING"` and
`"mergeStateStatus":"DIRTY"` for a follow-up that changed two lines.

Fix: after a squash merge, cut follow-up work from a freshly fetched default
branch.

```bash
git fetch origin main && git checkout -b <new-branch> origin/main
```

If a reused branch is already conflicted, merge `origin/main` into it and keep
the branch copy, since the branch content is main's content plus the new edit.
Confirm with `git diff origin/main` that the net change is only the intended
lines before merging.

## gh mergeability answers lag a push (2026-08-19)

`gh pr view --json mergeable` right after a push returns the previous answer. It
reported `CONFLICTING` on a branch whose conflict was already resolved and
pushed, then `MERGEABLE UNSTABLE` on the next query seconds later. Re-query
before acting on a mergeability verdict, and read `UNSTABLE` as checks still
running rather than as a failure.
