#!/usr/bin/env bash
# new-claude-project.sh - spawn a project from the Harness Firmware template.
#
# The macOS / Linux counterpart to new-claude-project.ps1. Same flow: prefer
# the gh CLI, fall back to a plain clone, strip the template-only files, hand
# back a repo whose first commit is yours.
#
# Usage:
#   bash bootstrap/new-claude-project.sh --name my-app
#   bash bootstrap/new-claude-project.sh --name my-app --dest ~/code
#
# Needs git and node. The template-only paths and the required files are listed
# in .agents/template-manifest.json inside the template; node reads that file.
#
# HARNESS_TEMPLATE_URL overrides the clone source of the fallback, for mirrors
# and tests. It takes anything git clone accepts, a local path included. The gh
# path always creates the repo from the GitHub template.
#
# gh installed and signed in -> a PRIVATE GitHub repo is created from the
# template and cloned. Otherwise -> a shallow clone with its history dropped,
# a fresh initial commit, and the manual GitHub steps printed at the end.
#
# Two intentional differences from new-claude-project.ps1:
#   --dest defaults to the current directory here, and to $HOME\code there.
#   The fallback clones the template over the network; it has no offline
#   equivalent of the PowerShell -LocalOnly switch, which copies the snapshot
#   bundled in the Windows release ZIP.

set -euo pipefail

TEMPLATE='ryanportfolio/Harness-Firmware'
TEMPLATE_URL="${HARNESS_TEMPLATE_URL:-https://github.com/ryanportfolio/Harness-Firmware.git}"
MANIFEST='.agents/template-manifest.json'

# Filled by load_manifest from the manifest of the tree about to be stripped.
# Template-only paths maintain or distribute the template itself; a new project
# must not inherit them as its own history, process, or support links.
TEMPLATE_ONLY_PATHS=()
REQUIRED_PROJECT_FILES=()

# Reads the manifest. Usage: node -e "$MANIFEST_JS" <file> <mode> [name]
#   templateOnly or requiredFiles: print the list, one path per line.
#   readme <name>: print readmeStub with {name} replaced by <name>.
# Fails with one line on a missing file, invalid JSON, a version other than 1,
# or an unknown top-level key.
# shellcheck disable=SC2016
MANIFEST_JS='
const fs = require("fs");
const [file, mode, name] = process.argv.slice(1);
const fail = (message) => { process.stderr.write(file + ": " + message + "\n"); process.exit(1); };
let manifest;
try { manifest = JSON.parse(fs.readFileSync(file, "utf8")); } catch (error) { fail(error.message); }
if (!manifest || typeof manifest !== "object" || Array.isArray(manifest)) fail("expected a JSON object");
if (manifest.version !== 1) fail("version " + JSON.stringify(manifest.version) + " is not supported; expected 1");
const keys = ["version", "template", "requiredFiles", "projectPaths", "templateOnly", "readmeStub", "skills"];
const unknown = Object.keys(manifest).filter((key) => !keys.includes(key));
if (unknown.length) fail("unknown top-level key " + unknown.join(", "));
if (mode === "readme") {
  if (typeof manifest.readmeStub !== "string") fail("readmeStub must be a string");
  process.stdout.write(manifest.readmeStub.split("{name}").join(name));
} else {
  const list = manifest[mode];
  const valid = (entry) => typeof entry === "string" && entry !== "" && !entry.startsWith("/") && !entry.endsWith("/")
    && !/[\\*?]/.test(entry) && !entry.split("/").some((part) => part === "" || part === "." || part === "..");
  if (!Array.isArray(list) || !list.every(valid)) fail(mode + " must be an array of repo-relative paths");
  for (const entry of list) process.stdout.write(entry + "\n");
}
'

usage() {
    cat <<'EOF'
new-claude-project.sh - spawn a project from the Harness Firmware template.

usage:
  bash bootstrap/new-claude-project.sh --name <project> [--dest <dir>]

options:
  --name <project>  project name; becomes the folder and the repo name.
                    letters, digits, dot, dash, underscore.
  --dest <dir>      parent folder for the new project. default: current dir.
  -h, --help        show this help.

with gh installed and signed in, a private repo is created from the template
and cloned. otherwise the template is cloned without its history and
committed fresh on your machine. both paths need network access: this script
has no bundled offline snapshot (the windows release ZIP does).
EOF
}

die() {
    echo "$*" >&2
    exit 1
}

is_valid_name() {
    local candidate="$1"
    if [ -z "$candidate" ]; then return 1; fi
    if [[ ! "$candidate" =~ ^[A-Za-z0-9._-]+$ ]]; then return 1; fi
    if [[ "$candidate" =~ ^\.+$ ]]; then return 1; fi
    return 0
}

# Fills TEMPLATE_ONLY_PATHS and REQUIRED_PROJECT_FILES from the manifest in the
# given tree. There is no built-in fallback list: a tree without a readable
# manifest stops the run.
load_manifest() {
    local target="$1"
    local file="$target/$MANIFEST"
    local line listing
    if [ ! -f "$file" ]; then
        die "The template has no $MANIFEST, so its template-only files cannot be stripped. Use a template version that ships it."
    fi
    TEMPLATE_ONLY_PATHS=()
    REQUIRED_PROJECT_FILES=()
    listing="$(node -e "$MANIFEST_JS" "$file" templateOnly)" || die "Cannot read $MANIFEST."
    while IFS= read -r line; do
        if [ -n "$line" ]; then TEMPLATE_ONLY_PATHS+=("$line"); fi
    done <<< "$listing"
    listing="$(node -e "$MANIFEST_JS" "$file" requiredFiles)" || die "Cannot read $MANIFEST."
    while IFS= read -r line; do
        if [ -n "$line" ]; then REQUIRED_PROJECT_FILES+=("$line"); fi
    done <<< "$listing"
    # Both lists are never empty in a valid manifest, and an empty array under
    # set -u fails on bash older than 4.4.
    if [ "${#TEMPLATE_ONLY_PATHS[@]}" -eq 0 ] || [ "${#REQUIRED_PROJECT_FILES[@]}" -eq 0 ]; then
        die "$MANIFEST must list templateOnly paths and requiredFiles."
    fi
}

# Mirrors Remove-NewProjectLocalTemplateFiles: the template-only paths (the
# template README among them) and any scratch directory the checkout picked up.
strip_template_only_files() {
    local target="$1"
    local path
    for path in "${TEMPLATE_ONLY_PATHS[@]}"; do
        rm -rf "${target:?}/$path"
    done
    for path in "${target:?}"/.tmp*; do
        if [ -e "$path" ]; then rm -rf "$path"; fi
    done
    # Removing template-only paths can leave their parent folders empty, such
    # as .github/ or assets/. rmdir only succeeds on an empty directory, so a
    # project that keeps its own files there keeps the folder.
    for path in "${TEMPLATE_ONLY_PATHS[@]}"; do
        path="$(dirname "$path")"
        while [ "$path" != '.' ]; do
            rmdir "${target:?}/$path" 2>/dev/null || break
            path="$(dirname "$path")"
        done
    done
}

# Mirrors Assert-NewProjectContract: a generated project must carry the required
# files and must not carry anything template-only.
assert_project_contract() {
    local target="$1"
    local path
    for path in "${REQUIRED_PROJECT_FILES[@]}"; do
        if [ ! -f "$target/$path" ]; then
            die "Generated project is missing required file: $path"
        fi
    done
    for path in "${TEMPLATE_ONLY_PATHS[@]}"; do
        # README.md is template-only and rewritten from the stub, so it is the
        # one template-only path a project keeps.
        if [ "$path" = 'README.md' ]; then continue; fi
        if [ -e "$target/$path" ]; then
            die "Generated project still contains template-only asset: $path"
        fi
    done
    for path in "$target"/.tmp*; do
        if [ -e "$path" ]; then
            die "Generated project still contains template scratch directory: $(basename "$path")"
        fi
    done
}

write_readme_stub() {
    local target="$1"
    local project="$2"
    node -e "$MANIFEST_JS" "$target/$MANIFEST" readme "$project" > "$target/README.md" \
        || die "Cannot write README.md from $MANIFEST."
}

name=''
dest=''

while [ $# -gt 0 ]; do
    case "$1" in
        --name)
            if [ $# -lt 2 ]; then die '--name needs a value.'; fi
            name="$2"
            shift 2
            ;;
        --name=*)
            name="${1#*=}"
            shift
            ;;
        --dest)
            if [ $# -lt 2 ]; then die '--dest needs a value.'; fi
            dest="$2"
            shift 2
            ;;
        --dest=*)
            dest="${1#*=}"
            shift
            ;;
        -h|--help)
            usage
            exit 0
            ;;
        *)
            usage >&2
            die "Unknown argument: $1"
            ;;
    esac
done

if [ -z "$name" ]; then
    usage >&2
    die '--name is required.'
fi
if ! is_valid_name "$name"; then
    die "Invalid name '$name' - use letters, digits, dot, dash, or underscore; all-dot names are not allowed."
fi
if ! command -v git >/dev/null 2>&1; then
    die 'git was not found on PATH. Install git, then run this again.'
fi
if ! command -v node >/dev/null 2>&1; then
    die 'node was not found on PATH. It reads the template manifest. Install Node.js, then run this again.'
fi

if [ -z "$dest" ]; then dest="$PWD"; fi
mkdir -p "$dest"
dest="$(cd "$dest" && pwd)"
target="$dest/$name"
if [ -e "$target" ]; then
    die "Folder already exists: $target"
fi

mode='clone'
if command -v gh >/dev/null 2>&1; then
    if gh auth status >/dev/null 2>&1; then
        mode='gh'
        echo 'gh CLI detected and authenticated. A private GitHub repo is created from the template.'
    else
        echo 'gh CLI found but not signed in. The template is cloned locally and manual GitHub steps are shown.'
    fi
else
    echo 'gh CLI not found. The template is cloned locally and manual GitHub steps are shown.'
fi
echo ''

remote_url=''

if [ "$mode" = 'gh' ]; then
    echo "Creating private repo '$name' from template $TEMPLATE ..."
    if ( cd "$dest" && gh repo create "$name" --template "$TEMPLATE" --private --clone ); then
        if [ ! -d "$target" ]; then
            die "GitHub creation reported success, but the clone was not found at $target"
        fi

        echo 'Stripping template-only files and replacing README.md ...'
        load_manifest "$target"
        git -C "$target" rm -rq --ignore-unmatch -- "${TEMPLATE_ONLY_PATHS[@]}"
        strip_template_only_files "$target"
        write_readme_stub "$target" "$name"
        git -C "$target" add README.md
        assert_project_contract "$target"

        if [ -n "$(git -C "$target" status --porcelain)" ]; then
            echo 'Committing and pushing template cleanup ...'
            git -C "$target" commit -qm 'Strip template files, add README stub'
            git -C "$target" push -q
        fi

        login="$(gh api user --jq .login 2>/dev/null || true)"
        if [ -n "$login" ]; then
            remote_url="https://github.com/$login/$name"
        fi
    else
        echo 'GitHub project creation failed; switching to local clone mode.' >&2
        if [ -e "$target" ]; then
            die "GitHub creation left a partial folder at $target. Remove or inspect it before retrying."
        fi
        mode='clone'
    fi
fi

if [ "$mode" = 'clone' ]; then
    echo "Cloning template from $TEMPLATE_URL ..."
    git clone --depth 1 --single-branch "$TEMPLATE_URL" "$target"

    # Drop the template's history so the first commit in the new repo is yours.
    rm -rf "${target:?}/.git"

    echo 'Stripping template-only files and replacing README.md ...'
    load_manifest "$target"
    strip_template_only_files "$target"
    write_readme_stub "$target" "$name"
    assert_project_contract "$target"

    if ! git -C "$target" init -q -b main 2>/dev/null; then
        # git older than 2.28 has no 'init -b'.
        git -C "$target" init -q
        git -C "$target" checkout -q -b main
    fi
    git -C "$target" add -A
    git -C "$target" commit -qm 'Initialize from Harness Firmware template'
fi

echo ''
if [ "$mode" = 'gh' ]; then
    echo 'DONE. Private repo created and cloned:'
    echo "  Local:  $target"
    if [ -n "$remote_url" ]; then
        echo "  Remote: $remote_url"
    fi
else
    echo "DONE (local only). Folder ready: $target"
    echo ''
    echo 'To put it on GitHub manually:'
    echo "  1. Create a PRIVATE repo named '$name' at https://github.com/new"
    echo '  2. Then run:'
    echo "       cd \"$target\""
    echo "       git remote add origin https://github.com/<your-username>/$name.git"
    echo '       git push -u origin main'
fi

echo ''
echo 'Next steps:'
echo "  1. cd \"$target\""
echo '  2. open the folder in Claude Code'
echo '  3. run /init-project   (Codex: select the init-project skill instead)'
