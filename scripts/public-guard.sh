#!/usr/bin/env bash
# This repository is public and every file in it is copied into each project it creates, so a pushed path or key
# spreads. CI runs this over the commits a push or pull request adds:
#
#   scripts/public-guard.sh range A..B
#
# For each commit in A..B it checks the commit message, the paths of files it adds or renames, and the lines it
# adds (for a merge, what it changed beyond the automatic merge) for:
#   - a real home folder: C:\Users\<name>\, C:/Users/<name>/, /c/Users/<name>/, /Users/<name>/, /home/<name>/
#   - a Claude Code transcript folder with a real name: .claude/projects/<munged path>/
#   - agent scratch paths: AppData\Local\Temp\claude\, /tmp/claude-<n>, Claude-3p\ app data,  (public-guard: allow)
#     and app session worktree names (.claude/worktrees/<word>-<word>-<6 hex>)
# Then gitleaks scans the added lines, the commit messages and merge resolutions for secrets. A merge of more
# than two parents fails: git cannot show what it changed beyond the automatic merge.
#
# Placeholders pass: <name>, %USERNAME%, $USER, {user}, * and the fixture names in ALLOW_NAMES. A line that must
# keep a real-looking path (a test fixture) can carry the marker "public-guard: allow". Exit 1 lists every hit,
# by commit, file and line; when CI is set the matched text is left out of the output.
set -euo pipefail

range=${2:-}
if [[ ${1:-} != range || -z $range ]]; then
  sed -n '2,18p' "$0" | sed 's/^# \{0,1\}//' >&2
  exit 2
fi

# Sep = one or more slashes or backslashes (JSON and string escapes double the backslash). A home folder counts
# when a name starting with a letter, digit, _ or - follows Users or home (placeholders start with < % $ { * or
# ...), with or without a separator after it.
sep='[/\\]+'
labels=(
  "Windows home folder" "Git Bash home folder" "macOS home folder" "Linux home folder"
  "Claude Code transcript folder" "Claude temp folder" "Claude temp folder" "Claude desktop app data"
  "app session worktree name"
)
patterns=(
  "[A-Za-z]:${sep}Users${sep}[A-Za-z0-9_-]"
  "(^|[^A-Za-z0-9_.-])/[a-z]/Users/[A-Za-z0-9_-]"
  "(^|[^A-Za-z0-9_.:-])/Users/[A-Za-z0-9._-]+/"
  "(^|[^A-Za-z0-9_.-])/home/[a-z][a-z0-9_-]*/"
  "\\.claude${sep}projects${sep}[A-Za-z0-9]"
  "AppData${sep}Local${sep}Temp${sep}claude([/\\]|$)"
  "/(private/)?tmp/claude-[0-9]+"
  "Claude-3p${sep}"
  "\\.claude${sep}worktrees${sep}[a-z]+-[a-z]+-[0-9a-f]{6}"
)
pattern=$(printf '%s\n' "${patterns[@]}" | paste -sd '|' -)

# Fixture names already used in tests and comments. A home folder whose whole name is one of them (ended by a
# separator, a quote or the end of the line) is rewritten before a line is checked, so a real path on the same
# line still fails and "C:\Users\User Name\" is not mistaken for the fixture "user".
ALLOW_NAMES='alice|bob|x|you|me|name|user|username|runner|example'
allow_end='([/\\"'"'"'`]|$)'
strip_allowed="s#(Users|home)${sep}(${ALLOW_NAMES})${allow_end}#\\1_allowed\\3#Ig"

hits=0
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT

is_private() { sed -E "$strip_allowed" <<<"$1" | grep -q -i -E -- "$pattern"; }

# A location to print. In CI a file path that is itself private is not printed.
where() {
  local path=$1 rest=${2:-}
  if [[ -n ${CI:-} ]] && is_private "$path"; then path="(private path)"; fi
  printf '%s%s' "$path" "$rest"
}

# Input: "path<TAB>line<TAB>text" lines. Output: one line per hit with the location and kind. Outside CI the text
# is printed too; in CI it is not, so the Actions log keeps no second public copy of the path or a key next to it.
scan() {
  local prefix=$1 line path num text i
  sed -E "$strip_allowed" | grep -v -F 'public-guard: allow' | grep -i -E -- "$pattern" | while IFS= read -r line; do
    path=${line%%$'\t'*}
    line=${line#*$'\t'}
    num=${line%%$'\t'*}
    text=${line#*$'\t'}
    for i in "${!patterns[@]}"; do
      grep -q -i -E -- "${patterns[$i]}" <<<"$text" || continue
      if [[ -n ${CI:-} ]]; then
        echo "$prefix $(where "$path" ":$num"): ${labels[$i]}"
      else
        echo "$prefix $path:$num: ${labels[$i]}: $text"
      fi
    done
  done || true
}

# Lines a commit adds, as "path<TAB>line<TAB>text". File headers are read only between a "diff" line and the
# first hunk, so an added line that starts with "++ " is still content. A merge commit shows only what its
# author changed beyond the automatic merge (conflict resolutions and edits made during the merge).
added_lines() {
  local diff_opt=$2
  git show --format= --no-color --no-ext-diff --unified=0 $diff_opt "$1" | awk '
    /^diff / { h = 1; next }
    h && /^\+\+\+ / { f = substr($0, 5); sub(/^b\//, "", f); next }
    h && !/^@@/ { next }
    /^@@/ { h = 0; match($0, /\+[0-9]+/); n = substr($0, RSTART + 1, RLENGTH - 1) + 0; next }
    /^\+/ { print f "\t" n "\t" substr($0, 2); n++ }
  '
}

# Paths a commit adds or renames (compared with its first parent), so a private folder name is caught even when
# the file's contents are harmless or a rename adds no lines.
new_paths() {
  if git rev-parse -q --verify "$1^1" >/dev/null; then
    git diff --name-only -M --diff-filter=AR "$1^1" "$1"
  else
    git diff-tree -r --root --no-commit-id --name-only --diff-filter=AR "$1"
  fi
}

# gitleaks with its findings. In CI only the rule, file, line and commit are kept: --redact masks the secret but
# --verbose prints the rest of the matched line.
leaks() {
  if [[ -z ${CI:-} ]]; then
    "$@" --verbose >&2
    return
  fi
  local out status=0
  out=$("$@" --verbose 2>&1) || status=$?
  printf '%s\n' "$out" | grep -E '^(RuleID|File|Line|Commit):' | while IFS= read -r line; do
    if [[ $line == File:* ]] && is_private "$line"; then line="File:        (private path)"; fi
    printf '%s\n' "$line"
  done >&2 || true
  return $status
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
  parents=$(($(git rev-list --parents -n 1 "$c" | wc -w) - 1))
  report "$(git log -1 --format=%B "$c" | awk '{ print "message\t" NR "\t" $0 }' | scan "$short")"
  report "$(new_paths "$c" | awk '{ print $0 "\tpath\t" $0 }' | scan "$short")"
  if [[ $parents -gt 2 ]]; then
    report "$short: a merge of $parents parents cannot be checked (git shows no remerge diff for it); merge one branch at a time."
    continue
  elif [[ $parents -eq 2 ]]; then
    added=$(added_lines "$c" --remerge-diff)
    # gitleaks git reads no merge patches: the resolution goes to gitleaks dir under its own file paths, so rules
    # that depend on the file name still apply.
    while IFS=$'\t' read -r path _ text; do
      [[ -z $path ]] && continue
      mkdir -p "$work/merges/$short/$(dirname "$path")"
      printf '%s\n' "$text" >>"$work/merges/$short/$path"
    done <<<"$added"
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
  leaks gitleaks git --no-banner --redact --log-opts="$range" . \
    || { echo "public-guard: gitleaks found a secret in the added lines of $range" >&2; hits=1; }
  # gitleaks git reads patches only: commit messages go through stdin.
  git log --format=%B "$range" | leaks gitleaks stdin --no-banner --redact \
    || { echo "public-guard: gitleaks found a secret in a commit message in $range" >&2; hits=1; }
  if [[ -d $work/merges ]]; then
    (cd "$work/merges" && leaks gitleaks dir --no-banner --redact .) \
      || { echo "public-guard: gitleaks found a secret in a merge resolution in $range" >&2; hits=1; }
  fi
fi


if [[ $hits -ne 0 ]]; then
  echo "public-guard: remove the paths or secrets above (rewrite the commit; a revert keeps them in history)." >&2
  echo "Use a placeholder such as <name> or ~ for home folders." >&2
fi
exit $hits
