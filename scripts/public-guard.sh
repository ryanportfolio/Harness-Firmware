#!/usr/bin/env bash
# This repository is public and every file in it is copied into each project it creates, so a pushed path or key
# spreads. CI runs this over the commits a push or pull request adds:
#
#   scripts/public-guard.sh range A..B
#
# For each non-merge commit in A..B it checks the commit message and the lines the commit adds for:
#   - a real home folder: C:\Users\<name>\, C:/Users/<name>/, /c/Users/<name>/, /Users/<name>/, /home/<name>/
#   - a Claude Code transcript folder with a real name: .claude/projects/<munged path>/
#   - agent scratch paths: AppData\Local\Temp\claude\, /tmp/claude-<n>, Claude-3p\ app data,  (public-guard: allow)
#     and app session worktree names (.claude/worktrees/<word>-<word>-<6 hex>)
# Then gitleaks scans the added lines and the commit messages for secrets.
#
# Placeholders pass: <name>, %USERNAME%, $USER, {user}, * and the fixture names in ALLOW_NAMES. A line that must
# keep a real-looking path (a test fixture) can carry the marker "public-guard: allow". Exit 1 lists every hit.
set -euo pipefail

range=${2:-}
if [[ ${1:-} != range || -z $range ]]; then
  sed -n '2,15p' "$0" | sed 's/^# \{0,1\}//' >&2
  exit 2
fi

# Sep = one or more slashes or backslashes (JSON and string escapes double the backslash).
sep='[/\\]+'
name='[^/\\<>%$*{}"'"'"'` ]+'
patterns=(
  "[A-Za-z]:${sep}Users${sep}${name}[/\\]"
  "(^|[^A-Za-z0-9_.-])/[a-z]/Users/${name}/"
  "(^|[^A-Za-z0-9_.:-])/Users/${name}/"
  "(^|[^A-Za-z0-9_.-])/home/[a-z][a-z0-9_-]*/"
  "\\.claude${sep}projects${sep}[A-Za-z0-9]"
  "AppData${sep}Local${sep}Temp${sep}claude([/\\]|$)"
  "/(private/)?tmp/claude-[0-9]+"
  "Claude-3p${sep}"
  "\\.claude${sep}worktrees${sep}[a-z]+-[a-z]+-[0-9a-f]{6}"
)
pattern=$(printf '%s\n' "${patterns[@]}" | paste -sd '|' -)

# Fixture names already used in tests and comments. Matching home folders are removed from a line before it is
# checked, so a real path on the same line still fails.
ALLOW_NAMES='alice|bob|x|you|me|name|user|username|runner|example'
strip_allowed="s#(Users|home)${sep}(${ALLOW_NAMES})([/\\\\])#\\1_allowed\\3#Ig"

hits=0

# scan LABEL < text: print LABEL:line: text for each hit
scan() {
  local label=$1
  grep -v 'public-guard: allow' \
    | sed -E "$strip_allowed" \
    | grep -n -i -E -- "$pattern" \
    | sed "s|^|$label:|" || true
}

report() {
  [[ -z $1 ]] && return 0
  printf '%s\n' "$1" >&2
  hits=1
}

commits=$(git rev-list --no-merges "$range")
count=$(printf '%s\n' "$commits" | grep -c . || true)
echo "public-guard: checking $count commit(s) in $range"

for c in $commits; do
  short=$(git rev-parse --short "$c")
  report "$(git log -1 --format=%B "$c" | scan "$short message")"
  report "$(git show --format= --no-color --no-ext-diff --unified=0 "$c" \
    | grep -E '^\+' | grep -v -E '^\+\+\+ (b/|/dev/null)' | cut -c2- | scan "$short adds")"
done

if ! command -v gitleaks >/dev/null; then
  echo "public-guard: gitleaks is not installed, so secrets were not checked." >&2
  exit 1
fi
if [[ $count -gt 0 ]]; then
  gitleaks git --no-banner --redact --verbose --log-opts="$range" . >&2 \
    || { echo "public-guard: gitleaks found a secret in the added lines of $range" >&2; hits=1; }
  git log --no-merges --format=%B "$range" | gitleaks stdin --no-banner --redact --verbose >&2 \
    || { echo "public-guard: gitleaks found a secret in a commit message in $range" >&2; hits=1; }
fi

if [[ $hits -ne 0 ]]; then
  echo "public-guard: remove the paths or secrets above (rewrite the commit; a revert keeps them in history)." >&2
  echo "Use a placeholder such as <name> or ~ for home folders." >&2
fi
exit $hits
