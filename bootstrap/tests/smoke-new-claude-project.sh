#!/usr/bin/env bash
# smoke-new-claude-project.sh - run new-claude-project.sh end to end without GitHub.
#
# Builds a local template repository from this checkout's HEAD commit, puts a
# stub gh first on PATH that always fails (so the script takes its clone path
# and never creates a GitHub repo), points HARNESS_TEMPLATE_URL at the local
# template, and creates a project. Then checks the project against
# .agents/template-manifest.json: no template-only path, every required file,
# the README stub, and a clean first commit.
#
# Commit your changes first: the template is built from HEAD, not the working tree.
#
# Usage: bash bootstrap/tests/smoke-new-claude-project.sh

set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
scratch="$(mktemp -d)"
trap 'rm -rf "$scratch"' EXIT

fail() {
    echo "FAIL: $*" >&2
    exit 1
}

# A gh that is always signed out, and no token for a real gh to pick up.
mkdir -p "$scratch/bin"
printf '#!/bin/sh\nexit 1\n' > "$scratch/bin/gh"
chmod +x "$scratch/bin/gh"
export PATH="$scratch/bin:$PATH"
unset GH_TOKEN GITHUB_TOKEN

export GIT_AUTHOR_NAME='Creator Smoke Test'
export GIT_AUTHOR_EMAIL='creator-smoke@example.invalid'
export GIT_COMMITTER_NAME="$GIT_AUTHOR_NAME"
export GIT_COMMITTER_EMAIL="$GIT_AUTHOR_EMAIL"

# The local template: HEAD's tracked files, committed fresh.
source_dir="$scratch/template"
mkdir -p "$source_dir"
git -C "$root" archive --format=tar HEAD | tar -x -C "$source_dir"
git -C "$source_dir" init -q
git -C "$source_dir" add -A
git -C "$source_dir" commit -qm 'Template snapshot for the creator smoke test'

name='creator-smoke'
dest="$scratch/projects"
HARNESS_TEMPLATE_URL="$source_dir" bash "$root/bootstrap/new-claude-project.sh" --name "$name" --dest "$dest" > "$scratch/creator.log" 2>&1 \
    || { cat "$scratch/creator.log" >&2; fail 'new-claude-project.sh exited non-zero.'; }
grep -q 'DONE (local only)' "$scratch/creator.log" \
    || { cat "$scratch/creator.log" >&2; fail 'the creator did not take the local clone path.'; }

target="$dest/$name"
manifest="$source_dir/.agents/template-manifest.json"
# shellcheck disable=SC2016
list_js='
const manifest = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8"));
const mode = process.argv[2];
if (mode === "readme") process.stdout.write(manifest.readmeStub.split("{name}").join(process.argv[3]));
else for (const entry of manifest[mode]) process.stdout.write(entry + "\n");
'

# README.md is template-only but rewritten from the stub; it is checked below.
while IFS= read -r path; do
    if [ -n "$path" ] && [ "$path" != 'README.md' ] && [ -e "$target/$path" ]; then fail "project still has template-only path $path"; fi
done <<< "$(node -e "$list_js" "$manifest" templateOnly)"

while IFS= read -r path; do
    if [ -n "$path" ] && [ ! -f "$target/$path" ]; then fail "project is missing required file $path"; fi
done <<< "$(node -e "$list_js" "$manifest" requiredFiles)"

node -e "$list_js" "$manifest" readme "$name" > "$scratch/readme-expected"
cmp -s "$scratch/readme-expected" "$target/README.md" || fail 'README.md is not the manifest readmeStub for this project.'

empty="$(find "$target" -path "$target/.git" -prune -o -type d -empty -print)"
[ -z "$empty" ] || fail "stripping left empty folders: $empty"

for path in "$target"/.tmp*; do
    if [ -e "$path" ]; then fail "project still has scratch folder $(basename "$path")"; fi
done

[ -d "$target/.git" ] || fail 'project has no Git repository of its own.'
[ -z "$(git -C "$target" status --porcelain)" ] || fail 'project is not clean after its first commit.'
[ "$(git -C "$target" rev-list --count HEAD)" = '1' ] || fail 'project history is not a single fresh commit.'

echo 'Creator smoke test passed.'
