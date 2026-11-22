#!/usr/bin/env bash
# This repository is public and every file in it is copied into each project it creates, so a pushed path or key
# spreads. CI runs this over the commits a push or pull request adds:
#
#   scripts/public-guard.sh range A..B
#
# For each commit in A..B it checks the commit message and the lines the commit adds (for a merge, what it
# changed beyond the automatic merge) for:
#   - a real home folder: C:\Users\<name>\, C:/Users/<name>/, /c/Users/<name>/, /Users/<name>/, /home/<name>/
#   - a Claude Code transcript folder with a real name: .claude/projects/<munged path>/
#   - agent scratch paths: AppData\Local\Temp\claude\, /tmp/claude-<n>, Claude-3p\ app data,  (public-guard: allow)
#     and app session worktree names (.claude/worktrees/<word>-<word>-<6 hex>)
# Then gitleaks scans the added lines and the commit messages for secrets.
#
# Placeholders pass: <name>, %USERNAME%, $USER, {user}, * and the fixture names in ALLOW_NAMES. A line that must
# keep a real-looking path (a test fixture) can carry the marker "public-guard: allow". Exit 1 lists every hit,
# by commit, file and line; when CI is set the matched text is left out of the output.
set -euo pipefail

range=${2:-}
if [[ ${1:-} != range || -z $range ]]; then
  sed -n '2,17p' "$0" | sed 's/^# \{0,1\}//' >&2
  exit 2
fi

# Sep = one or more slashes or backslashes (JSON and string escapes double the backslash). A home folder counts
# when a concrete name follows Users or home (placeholders start with < % $ { or *), with or without a separator.
sep='[/\\]+'
labels=(
  "Windows home folder" "Git Bash home folder" "macOS home folder" "Linux home folder"
  "Claude Code transcript folder" "Claude temp folder" "Claude temp folder" "Claude desktop app data"
  "app session worktree name"
)
patterns=(
  "[A-Za-z]:${sep}Users${sep}[A-Za-z0-9._-]"
  "(^|[^A-Za-z0-9_.-])/[a-z]/Users/[A-Za-z0-9._-]"
  "(^|[^A-Za-z0-9_.:-])/Users/[A-Za-z0-9._-]+/"
  "(^|[^A-Za-z0-9_.-])/home/[a-z][a-z0-9_-]*/"
  "\\.claude${sep}projects${sep}[A-Za-z0-9]"
  "AppData${sep}Local${sep}Temp${sep}claude([/\\]|$)"
  "/(private/)?tmp/claude-[0-9]+"
  "Claude-3p${sep}"
  "\\.claude${sep}worktrees${sep}[a-z]+-[a-z]+-[0-9a-f]{6}"
)
pattern=$(printf '%s\n' "${patterns[@]}" | paste -sd '|' -)

# Fixture names already used in tests and comments. Matching home folders are rewritten before a line is checked,
# so a real path on the same line still fails.
ALLOW_NAMES='alice|bob|x|you|me|name|user|username|runner|example'
strip_allowed="s#(Users|home)${sep}(${ALLOW_NAMES})([^A-Za-z0-9._-]|\$)#\\1_allowed\\3#Ig"

hits=0
merge_text=$(mktemp)
trap 'rm -f "$merge_text"' EXIT

# Input: "location<TAB>text" lines. Output: one line per hit with the location and kind. Outside CI the text is
# printed too; in CI it is not, so the Actions log keeps no second public copy of the path or a key next to it.
scan() {
  local prefix=$1 line loc text i
  sed -E "$strip_allowed" | grep -v -F 'public-guard: allow' | grep -i -E -- "$pattern" | while IFS= read -r line; do
    loc=${line%%$'\t'*}
    text=${line#*$'\t'}
    for i in "${!patterns[@]}"; do
      grep -q -i -E -- "${patterns[$i]}" <<<"$text" || continue
      if [[ -n ${CI:-} ]]; then
        echo "$prefix $loc: ${labels[$i]}"
      else
        echo "$prefix $loc: ${labels[$i]}: $text"
      fi
    done
  done || true
}

# Lines a commit adds, as "path:line<TAB>text". A merge commit shows only what its author changed beyond the
# automatic merge (conflict resolutions and edits made during the merge), via --remerge-diff.
added_lines() {
  local diff_opt=$2
  git show --format= --no-color --no-ext-diff --unified=0 $diff_opt "$1" | awk '
    /^\+\+\+ / { f = substr($0, 5); sub(/^b\//, "", f); next }
    /^@@/ { match($0, /\+[0-9]+/); n = substr($0, RSTART + 1, RLENGTH - 1) + 0; next }
    /^\+/ { print f ":" n "\t" substr($0, 2); n++ }
  '
}

report() {
  [[ -z $1 ]] && return 0
  printf '%s\n' "$1" >&2
  hits=1
}

commits=$(git rev-list "$range")
count=$(printf '%s\n' "$commits" | grep -c . || true)
echo "public-guard: checking $count commit(s) in $range"

for c in $commits; do
  short=$(git rev-parse --short "$c")
  report "$(git log -1 --format=%B "$c" | awk '{ print "message:" NR "\t" $0 }' | scan "$short")"
  if [[ $(git rev-list --parents -n 1 "$c" | wc -w) -gt 2 ]]; then
    added=$(added_lines "$c" --remerge-diff)
    printf '%s\n' "$added" | cut -f2- >>"$merge_text"
  else
    added=$(added_lines "$c" "")
  fi
  report "$(printf '%s\n' "$added" | scan "$short")"
done

if ! command -v gitleaks >/dev/null; then
  echo "public-guard: gitleaks is not installed, so secrets were not checked." >&2
  exit 1
fi
if [[ $count -gt 0 ]]; then
  gitleaks git --no-banner --redact --verbose --log-opts="$range" . >&2 \
    || { echo "public-guard: gitleaks found a secret in the added lines of $range" >&2; hits=1; }
  # gitleaks git reads patches only: commit messages and merge resolutions go through stdin.
  { git log --format=%B "$range"; cat "$merge_text"; } | gitleaks stdin --no-banner --redact --verbose >&2 \
    || { echo "public-guard: gitleaks found a secret in a commit message or merge resolution in $range" >&2; hits=1; }
fi

if [[ $hits -ne 0 ]]; then
  echo "public-guard: remove the paths or secrets above (rewrite the commit; a revert keeps them in history)." >&2
  echo "Use a placeholder such as <name> or ~ for home folders." >&2
fi
exit $hits
