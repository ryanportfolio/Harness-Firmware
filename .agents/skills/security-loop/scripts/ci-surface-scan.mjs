#!/usr/bin/env node
// Collect setup signals for references/local-classes.md from the tracked files of one commit:
// GitHub Actions workflows, package manifests and lockfiles, registry configuration, Docker
// files, Claude Code settings, MCP servers, skills, TLS-off settings, source maps, public
// bundler variables, and existing fuzz targets. Every hit is a lead for a coverage unit, never
// a finding.
//
// Files are read from git objects (ls-tree + cat-file), never from the working tree, so the
// scan cannot follow a symlink or junction, enter a submodule, or run target code. Symlinks
// and submodules are counted and skipped. Snippets are truncated and long token-shaped
// strings are redacted; secret-looking variables are reported by name only. Read-only; zero
// dependencies.
//
// Usage: node ci-surface-scan.mjs --tree <path> [--ref <rev>] [--out <file>]

import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const MAX_TEXT_BYTES = 2 * 1024 * 1024;
const MAX_LOCK_BYTES = 64 * 1024 * 1024;
const BATCH_BYTES = 48 * 1024 * 1024;
const MAX_LIST = 200;

const PRIVILEGED_TRIGGERS = new Set(["pull_request_target", "workflow_run", "issue_comment"]);
const OUTSIDE_TEXT_TRIGGERS = new Set([...PRIVILEGED_TRIGGERS, "issues", "discussion", "discussion_comment", "pull_request_review", "pull_request_review_comment"]);
const SAFE_EVENT_FIELD = /\.(number|id|node_id|sha|head_sha|base_sha|before|after|created_at|updated_at|closed_at|merged_at|run_id|run_number|run_attempt|draft|merged|state|action|author_association|private|fork|size|forced|deleted|created)$/;
const AGENT_ACTION = /(^|\/)(claude-code-action|claude-code-base-action|codex-action|gemini-cli-action)(@|$)/i;
const AGENT_CLI = /\b(claude\s+(-p|--print)\b|codex\s+exec\b|gemini\s+(-p|--prompt)\b|aider\b.*--message)/;
const INSTALL_CMD = /\b(npm\s+(ci|install|i)\b|pnpm\s+(install|i)\b|yarn(\s+install)?\s*($|&&|;|\s--)|bun\s+install\b|pip3?\s+install\b)/;
const SECRET_NAME = /(secret|token|passw|pwd|api[_-]?key|private[_-]?key|access[_-]?key|credential|auth|signing|service[_-]?role)/i;
const PUBLIC_SECRET_VAR = /\b(?:NEXT_PUBLIC|VITE|REACT_APP|EXPO_PUBLIC|NUXT_PUBLIC|GATSBY|PUBLIC)_[A-Z0-9_]*(?:SECRET|PRIVATE|SERVICE_ROLE|PASSWORD|PASSWD|TOKEN|SERVICE_KEY|ADMIN_KEY|SIGNING)[A-Z0-9_]*\b/g;
const TLS_OFF = [
  ["node_tls_reject_unauthorized_0", /NODE_TLS_REJECT_UNAUTHORIZED["']?\s*[:=]\s*["']?0/],
  ["reject_unauthorized_false", /rejectUnauthorized["']?\s*[:=]\s*false/],
  ["strict_ssl_false", /strict[-_]?ssl["']?\s*[:=]\s*false/i],
  ["python_verify_false", /\bverify\s*=\s*False\b/],
  ["go_insecure_skip_verify", /InsecureSkipVerify\s*:\s*true/],
  ["curl_insecure", /\bcurl\b[^\n|;&]*\s(-k|--insecure)\b/],
  ["wget_no_check_certificate", /--no-check-certificate\b/],
  ["git_ssl_verify_off", /http\.sslVerify\s*(=|\s)\s*false|GIT_SSL_NO_VERIFY\s*[:=]\s*["']?(1|true)/i],
  ["pip_trusted_host", /--trusted-host\b|^\s*trusted-host\s*=/m],
  ["requests_urllib3_warnings_off", /urllib3\.disable_warnings\(/],
];
const SOURCE_MAP_SETTINGS = [
  ["next_production_browser_source_maps", /productionBrowserSourceMaps\s*:\s*true/],
  ["vite_build_sourcemap", /\bsourcemap\s*:\s*(true|["'](inline|hidden)["'])/],
  ["webpack_devtool_source_map", /\bdevtool\s*:\s*["'][^"']*source-map/],
  ["cra_generate_sourcemap", /GENERATE_SOURCEMAP\s*=\s*true/],
];
const TEXT_SKIP = /\.(png|jpe?g|gif|webp|avif|ico|bmp|tiff?|psd|mp[34]|m4a|wav|ogg|webm|mov|avi|mkv|woff2?|ttf|otf|eot|zip|gz|tgz|bz2|xz|7z|rar|jar|war|exe|dll|so|dylib|bin|wasm|pdf|glb|gltf|fbx|obj|hdr|exr|ktx2?|basis|psd|blend)$/i;
const LOCKFILE = /(^|\/)(package-lock\.json|npm-shrinkwrap\.json|yarn\.lock|pnpm-lock\.yaml)$/;

function parseArgs(argv) {
  const options = { ref: "HEAD" };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--tree") options.tree = argv[++i];
    else if (argv[i] === "--ref") options.ref = argv[++i];
    else if (argv[i] === "--out") options.out = argv[++i];
    else throw new Error(`unknown argument ${argv[i]}`);
  }
  if (!options.tree) throw new Error("--tree is required");
  return options;
}

// core.fsmonitor off: a repository-configured monitor is a program, and this scan runs none.
const git = (tree, args, extra = {}) => spawnSync("git", ["-c", "core.fsmonitor=false", "-C", tree, ...args], { maxBuffer: 512 * 1024 * 1024, ...extra });

// Values of secret-named assignments and flags (API_KEY=x, --token=x, --key x), URL userinfo
// (https://token@host, https://user:pass@host; the plain git@ user is kept), and long
// token-shaped runs (letters and digits mixed, 24+ chars) are replaced. Environment
// references such as ${NPM_TOKEN} or $NPM_TOKEN are kept.
const SECRET_WORD = "(?:token|secret|passw(?:or)?d|pwd|key|credential|auth)";
// A secret value: a whole quoted string (spaces included), or an unquoted run. Values that
// start with "$" are environment references and are kept.
const SECRET_VALUE = `("(?!\\$)[^"\\n]*"|'(?!\\$)[^'\\n]*'|(?![-"'$])[^\\s"',;&|)}]+)`;
const SECRET_ASSIGNMENT = new RegExp(`((?:\\b|-)[\\w.-]*${SECRET_WORD}[\\w.-]*["']?\\s*[=:]\\s*)${SECRET_VALUE}`, "gi");
const SECRET_FLAG_SPLIT = new RegExp(`(\\s--?[\\w-]*${SECRET_WORD}[\\w-]*\\s+)${SECRET_VALUE}`, "gi");
const AUTHORIZATION = /(\bauthorization["']?\s*[:=]\s*)("(?!\$)[^"\n]*"|'(?!\$)[^'\n]*'|(?:(?:bearer|basic|token|digest)\s+)?(?![-"'$])[^\s"',;&|)}]+)/gi;
// A long run of letters and digits, not a 40-hex commit SHA. Paths also contain "/", so a run
// with "/" counts only when one of its segments looks like base64: 16+ characters mixing
// upper case, lower case, and digits.
function tokenLike(run) {
  if (!/[A-Za-z]/.test(run) || !/[0-9]/.test(run) || /^[a-f0-9]{40}$/.test(run)) return false;
  if (!run.includes("/")) return true;
  return run.split("/").some((part) => part.length >= 16 && /[A-Z]/.test(part) && /[a-z]/.test(part) && /[0-9]/.test(part));
}
const maskValue = (match, prefix, value) => `${prefix}${value[0] === '"' || value[0] === "'" ? `${value[0]}<redacted>${value[0]}` : "<redacted>"}`;
function redact(text, max = 240) {
  // Only the first `max` characters are ever returned, so the masking regexes (which can
  // backtrack quadratically on long hyphen runs) see a bounded prefix.
  let out = String(text).slice(0, Math.max(max * 4, 1024))
    .replace(/(:\/\/)(?!git@)[^/\s@]+@/g, "$1<redacted>@")
    .replace(AUTHORIZATION, maskValue)
    .replace(/\b(bearer|basic)\s+(?!\$|<redacted)[A-Za-z0-9._~+/=-]{8,}/gi, "$1 <redacted>")
    .replace(SECRET_ASSIGNMENT, maskValue)
    .replace(SECRET_FLAG_SPLIT, maskValue)
    .replace(/[A-Za-z0-9_+/=-]{24,}/g, (run) => (tokenLike(run) ? `<redacted ${run.length} chars>` : run))
    .replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, "?");
  if (out.length > max) out = `${out.slice(0, max)}...`;
  return out;
}

function listTree(tree, ref) {
  const result = git(tree, ["ls-tree", "-r", "-z", "-l", "--full-tree", ref]);
  if (result.status !== 0) throw new Error(`git ls-tree failed: ${result.stderr.toString().trim().slice(0, 300)}`);
  const entries = [];
  for (const record of result.stdout.toString("utf8").split("\0")) {
    if (!record) continue;
    const tab = record.indexOf("\t");
    const [mode, type, sha, size] = record.slice(0, tab).split(/\s+/);
    entries.push({ mode, type, sha, size: size === "-" ? 0 : Number(size), path: record.slice(tab + 1) });
  }
  return entries;
}

function readBlobs(tree, entries) {
  const contents = new Map();
  let batch = [];
  let bytes = 0;
  const flush = () => {
    if (!batch.length) return;
    const result = git(tree, ["cat-file", "--batch"], { input: batch.map((entry) => entry.sha).join("\n") + "\n" });
    if (result.status !== 0) throw new Error(`git cat-file failed: ${result.stderr.toString().trim().slice(0, 300)}`);
    const buffer = result.stdout;
    let offset = 0;
    for (const entry of batch) {
      const newline = buffer.indexOf(10, offset);
      const header = buffer.slice(offset, newline).toString();
      const size = Number(header.split(" ")[2]);
      const body = buffer.slice(newline + 1, newline + 1 + size);
      offset = newline + 1 + size + 1;
      if (body.subarray(0, 8000).includes(0)) continue;
      contents.set(entry.path, body.toString("utf8"));
    }
    batch = [];
    bytes = 0;
  };
  for (const entry of entries) {
    if (bytes + entry.size > BATCH_BYTES) flush();
    batch.push(entry);
    bytes += entry.size;
  }
  flush();
  return contents;
}

const lineOf = (text, index) => text.slice(0, index).split("\n").length;
const lines = (text) => text.split(/\r?\n/);
const capped = (list) => (list.length > MAX_LIST ? { items: list.slice(0, MAX_LIST), total: list.length } : list);

// YAML ends a plain scalar at " #": drop that comment unless the "#" sits inside quotes.
function stripComment(value) {
  let quote = null;
  for (let i = 0; i < value.length; i++) {
    const ch = value[i];
    if (quote) { if (ch === quote) quote = null; continue; }
    if (ch === '"' || ch === "'") quote = ch;
    else if (ch === "#" && (i === 0 || /\s/.test(value[i - 1]))) return value.slice(0, i).trim();
  }
  return value.trim();
}

// Parses JSON that must be an object; null, arrays, and scalars are reported like bad JSON.
function parseObject(text) {
  try {
    const data = JSON.parse(text);
    return data && typeof data === "object" && !Array.isArray(data) ? data : null;
  } catch { return null; }
}

// Line-based YAML walker: gives each line its key path, and the owning key for block-scalar
// lines. List items appear in the path as "-@<line>" so steps can be grouped. Not a full YAML
// parser: anchors, flow mappings, and multi-document files are read as plain lines.
function walkYaml(text) {
  const out = [];
  const stack = [];
  let block = null;
  const all = lines(text);
  for (let i = 0; i < all.length; i++) {
    const raw = all[i].replace(/\t/g, "  ");
    const n = i + 1;
    if (block) {
      const indent = raw.match(/^ */)[0].length;
      if (raw.trim() === "") continue;
      if (indent > block.indent) {
        out.push({ n, path: block.path, key: block.key, value: raw.trim(), block: true });
        continue;
      }
      block = null;
    }
    if (/^\s*(#.*)?$/.test(raw) || /^(---|\.\.\.)\s*$/.test(raw)) continue;
    let indent = raw.match(/^ */)[0].length;
    let rest = raw.slice(indent);
    while (rest === "-" || rest.startsWith("- ")) {
      // An indentless sequence ("steps:" then "- run:" at the same column) belongs to the
      // key above it, so a same-column key that opened a nested block stays on the stack.
      while (stack.length) {
        const top = stack[stack.length - 1];
        if (top.indent > indent || (top.indent === indent && !top.open)) stack.pop();
        else break;
      }
      stack.push({ indent, key: `-@${n}` });
      const step = rest === "-" ? 1 : 1 + rest.slice(1).match(/^ */)[0].length;
      indent += step;
      rest = rest.slice(step);
      if (!rest) break;
    }
    if (!rest) continue;
    while (stack.length && stack[stack.length - 1].indent >= indent) stack.pop();
    const parent = stack.map((entry) => entry.key);
    const match = rest.match(/^(?:"([^"]+)"|'([^']+)'|([^\s#'"{[][^:#]*?))\s*:(?:\s+(.*)|$)/);
    if (!match) {
      out.push({ n, path: parent, key: null, value: stripComment(rest) });
      continue;
    }
    const key = (match[1] ?? match[2] ?? match[3]).trim();
    const value = stripComment(match[4] ?? "");
    out.push({ n, path: parent, key, value });
    stack.push({ indent, key, open: value === "" });
    if (/^[|>][-+0-9]*\s*(#.*)?$/.test(value)) block = { indent, path: parent, key };
  }
  return out;
}

const untrustedEventPath = (expression) => {
  const hits = [];
  if (/\bgithub\.head_ref\b/.test(expression)) hits.push("github.head_ref");
  for (const m of expression.matchAll(/\b(?:github\.event\.)?inputs\.[\w-]+/g)) hits.push(m[0]);
  for (const m of expression.matchAll(/\bgithub\.event\.[\w.-]+(?:\[[^\]]*\][\w.-]*)*/g)) {
    if (/^github\.event\.inputs\./.test(m[0])) continue;
    if (!SAFE_EVENT_FIELD.test(m[0])) hits.push(m[0]);
  }
  return hits;
};
const derivedPath = (expression) => [...expression.matchAll(/\b(?:steps|needs)\.[\w-]+\.outputs\.[\w-]+/g)].map((m) => m[0]);

function scanWorkflow(file, text, isAction) {
  const nodes = walkYaml(text);
  const triggers = new Set();
  const report = { path: file, kind: isAction ? "composite_action" : "workflow" };
  for (const node of nodes) {
    const top = node.path[0];
    if (node.path.length === 0 && node.key === "on" && node.value) {
      for (const t of node.value.replace(/[[\]]/g, "").split(",")) if (t.trim()) triggers.add(t.trim().replace(/["']/g, ""));
    }
    if (top === "on" && node.path.length === 1) {
      if (node.key) triggers.add(node.key);
      else if (node.value) triggers.add(node.value.replace(/["']/g, ""));
    }
    // Block sequence: "on:" followed by "- pull_request_target" items.
    if (top === "on" && node.path.length === 2 && node.path[1].startsWith("-@")) triggers.add((node.key ?? node.value).replace(/["']/g, ""));
  }
  const triggerList = [...triggers].sort();
  const privileged = triggerList.filter((t) => PRIVILEGED_TRIGGERS.has(t));
  const outsideText = triggerList.filter((t) => OUTSIDE_TEXT_TRIGGERS.has(t));
  if (!isAction) {
    report.triggers = triggerList;
    report.privileged_triggers = privileged;
    report.top_level_permissions = nodes.some((node) => node.path.length === 0 && node.key === "permissions");
  }

  const findings = {
    write_all: [], id_token_write: [], unpinned_uses: [], untrusted_expressions: [], derived_expressions: [],
    env_file_writes: [], pr_head_checkouts: [], artifact_downloads: [], workflow_or_job_env_secrets: [],
    secrets_to_third_party_actions: [], persisted_token_uploaded: [], agent_steps: [], install_commands: [],
  };
  const jobs = new Map();
  // Workflow-level env reaches every job, so its secrets count as in scope for each one.
  const workflowEnvSecrets = !isAction && nodes.some((node) => node.path[0] === "env" && /\bsecrets\./.test(node.value));
  const stepOf = (node) => {
    const index = node.path.findIndex((part, i) => part === "steps" && i >= 2 && node.path[i + 1]?.startsWith("-@"));
    const job = node.path[0] === "jobs" ? node.path[1] : isAction ? "(action)" : null;
    if (isAction) {
      const actionIndex = node.path.indexOf("steps");
      if (actionIndex >= 0 && node.path[actionIndex + 1]?.startsWith("-@")) return { job, step: node.path[actionIndex + 1], rel: node.path.slice(actionIndex + 2) };
      return { job, step: null, rel: [] };
    }
    if (index < 0) return { job, step: null, rel: [] };
    return { job, step: node.path[index + 1], rel: node.path.slice(index + 2) };
  };

  for (const node of nodes) {
    const { job, step, rel } = stepOf(node);
    if (job && !jobs.has(job)) jobs.set(job, { secrets: workflowEnvSecrets, steps: new Map() });
    const jobState = job ? jobs.get(job) : null;
    // "secrets: inherit" on a reusable-workflow call passes every secret to it.
    if (jobState && (/\bsecrets\./.test(node.value) || (node.key === "secrets" && node.value === "inherit"))) jobState.secrets = true;
    let stepState = null;
    if (jobState && step) {
      if (!jobState.steps.has(step)) jobState.steps.set(step, { line: Number(step.slice(2)), uses: null, with: [], run: [], script: [] });
      stepState = jobState.steps.get(step);
      const owner = rel.length ? rel[0] : node.key;
      if (rel.length === 0 && node.key === "uses") stepState.uses = { value: node.value.replace(/["']/g, "").split(/\s/)[0], n: node.n };
      if (owner === "with") stepState.with.push(node);
      if (owner === "run" || (rel.length === 0 && node.key === "run")) stepState.run.push(node);
      if (owner === "with" && (node.key === "script" || rel[1] === "script")) stepState.script.push(node);
    }
    if (node.key === "permissions" && /write-all/.test(node.value)) findings.write_all.push({ line: node.n, job });
    if (node.key === "id-token" && /write/.test(node.value)) findings.id_token_write.push({ line: node.n, job, triggers: triggerList });
    if (node.key === "uses" && node.value) {
      const ref = node.value.replace(/["']/g, "").split(/\s/)[0];
      const local = ref.startsWith("./") || ref.startsWith("../");
      const pinned = /@[0-9a-f]{40}$/.test(ref) || /^docker:\/\/.*@sha256:[0-9a-f]{64}$/.test(ref);
      if (!local && !pinned) findings.unpinned_uses.push({ line: node.n, ref: redact(ref), first_party: /^(actions|github)\//.test(ref) });
    }
    if (!isAction && (node.path[0] === "env" || (node.path[0] === "jobs" && node.path[2] === "env")) && node.key && /\bsecrets\./.test(node.value)) {
      findings.workflow_or_job_env_secrets.push({ line: node.n, level: node.path[0] === "env" ? "workflow" : `job ${node.path[1]}`, name: node.key });
    }
  }

  const runLike = [];
  for (const [job, state] of jobs) {
    let checkoutPersists = null;
    let uploadsWorkspace = null;
    for (const stepState of state.steps.values()) {
      const uses = stepState.uses?.value ?? "";
      for (const node of stepState.run) runLike.push({ node, job, context: "run" });
      for (const node of stepState.script) runLike.push({ node, job, context: "github-script" });
      if (/^actions\/checkout@/.test(uses)) {
        const refLine = stepState.with.find((node) => node.key === "ref");
        if (refLine && (privileged.length || isAction) && /pull_request\.head\.(sha|ref)|github\.head_ref|refs\/pull\/|workflow_run\.head_(sha|branch)|pull\/\$\{\{/.test(refLine.value)) {
          findings.pr_head_checkouts.push({ line: refLine.n, job, ref: redact(refLine.value), triggers: privileged });
        }
        const persist = stepState.with.find((node) => node.key === "persist-credentials");
        if (!persist || !/false/.test(persist.value)) checkoutPersists ??= stepState.line;
      }
      if (/^actions\/upload-artifact@/.test(uses)) {
        const pathNodes = stepState.with.filter((node) => node.key === "path" || (node.block && node.key === "path"));
        if (pathNodes.some((node) => /^(\.\/?|\$\{\{\s*github\.workspace\s*\}\}\/?)$|(^|\/)\.git(\/|$)/.test(node.value.replace(/["']/g, "").trim()))) uploadsWorkspace ??= stepState.line;
      }
      if (privileged.length && (/(^|\/)(download-artifact|action-download-artifact)@/.test(uses))) findings.artifact_downloads.push({ line: stepState.line, job, uses: redact(uses), triggers: privileged });
      if (uses && !/^(\.{1,2}\/|actions\/|github\/)/.test(uses)) {
        for (const node of stepState.with) if (/\bsecrets\./.test(node.value)) findings.secrets_to_third_party_actions.push({ line: node.n, job, action: redact(uses), input: node.key, github_token_only: !/secrets\.(?!GITHUB_TOKEN\b)/.test(node.value) });
      }
      if (AGENT_ACTION.test(uses)) findings.agent_steps.push({ line: stepState.line, job, via: redact(uses), outside_text_triggers: outsideText, job_has_secrets: state.secrets });
    }
    if (checkoutPersists && uploadsWorkspace) findings.persisted_token_uploaded.push({ job, checkout_line: checkoutPersists, upload_line: uploadsWorkspace });
    for (const { node, context } of runLike.filter((entry) => entry.job === job)) {
      const value = node.value;
      for (const m of value.matchAll(/\$\{\{([^}]*)\}\}/g)) {
        const untrusted = untrustedEventPath(m[1]);
        if (untrusted.length) findings.untrusted_expressions.push({ line: node.n, job, context, expression: redact(m[0], 160), sources: untrusted, triggers: triggerList });
        else {
          const derived = derivedPath(m[1]);
          if (derived.length) findings.derived_expressions.push({ line: node.n, job, context, expression: redact(m[0], 160) });
        }
      }
      if (context === "run") {
        const target = value.match(/\b(GITHUB_ENV|GITHUB_PATH|GITHUB_OUTPUT)\b/);
        if (target && /(>>|>|\btee\b|Out-File|Add-Content|Set-Content)/.test(value)) findings.env_file_writes.push({ line: node.n, job, file: target[1], interpolates_expression: /\$\{\{/.test(value) });
        if ((privileged.length || isAction) && /gh\s+pr\s+checkout|git\s+(fetch|checkout|pull)\b.*(pull\/|refs\/pull|head_ref|head\.sha|head\.ref)/.test(value)) findings.pr_head_checkouts.push({ line: node.n, job, ref: redact(value, 160), triggers: privileged });
        if (privileged.length && /\bgh\s+run\s+download\b/.test(value)) findings.artifact_downloads.push({ line: node.n, job, uses: "gh run download", triggers: privileged });
        if (AGENT_CLI.test(value)) findings.agent_steps.push({ line: node.n, job, via: redact(value, 160), outside_text_triggers: outsideText, job_has_secrets: state.secrets });
        const install = value.match(INSTALL_CMD);
        if (install) findings.install_commands.push({ line: node.n, job, command: redact(install[0].trim(), 60), ignore_scripts: /--ignore-scripts\b/.test(value), lockfile_strict: /\bnpm\s+ci\b|--frozen-lockfile|--immutable|--locked/.test(value), job_has_secrets: state.secrets });
      }
    }
  }
  for (const [key, list] of Object.entries(findings)) if (list.length) report[key] = capped(list);
  return report;
}

const isExactVersion = (spec) => /^\d+\.\d+\.\d+([-+][\w.-]+)?$/.test(spec);
function packageSpecPinned(arg) {
  const at = arg.lastIndexOf("@");
  if (at <= 0) return false;
  return isExactVersion(arg.slice(at + 1));
}

// Every package a runner fetches must be exact. npm: each --package/-p value, else the first
// positional argument (name@1.2.3). uv and pipx: each --from/--spec value, else the first
// positional argument, plus each --with value (name==1.2.3). Values of other flags that take
// one are skipped when looking for the positional argument.
const NPM_SELECT = new Set(["--package", "-p"]);
const NPM_VALUE_FLAGS = new Set([...NPM_SELECT, "--registry", "--cache", "-c", "--call", "--userconfig"]);
const PY_SELECT = new Set(["--from", "--spec"]);
const PY_EXTRA = new Set(["--with"]);
const PY_VALUE_FLAGS = new Set([...PY_SELECT, ...PY_EXTRA, "--with-requirements", "--with-editable", "--python", "-p", "--index", "--index-url", "--default-index", "--extra-index-url", "--pip-args"]);
function runnerPackagePinned(args, python) {
  const select = python ? PY_SELECT : NPM_SELECT;
  const valueFlags = python ? PY_VALUE_FLAGS : NPM_VALUE_FLAGS;
  const selected = [];
  const extras = [];
  let positional = null;
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const eq = arg.indexOf("=");
    const flag = arg.startsWith("-") && eq > 0 ? arg.slice(0, eq) : arg;
    const inlineValue = arg.startsWith("-") && eq > 0 ? arg.slice(eq + 1) : null;
    const value = inlineValue ?? (valueFlags.has(flag) ? args[i + 1] : null);
    if (select.has(flag) && value) selected.push(value);
    else if (python && PY_EXTRA.has(flag) && value) extras.push(value);
    if (inlineValue === null && valueFlags.has(flag)) { i += 1; continue; }
    if (!arg.startsWith("-") && arg !== "dlx" && arg !== "run" && positional === null) positional = arg;
  }
  const specs = [...(selected.length ? selected : positional ? [positional] : []), ...extras];
  if (!specs.length) return false;
  const pinned = (spec) => (python ? /^[A-Za-z0-9][\w.-]*(\[[^\]]*\])?==[\w.!+-]+$/.test(spec) : packageSpecPinned(spec));
  return specs.every(pinned);
}

function scanPackageJson(file, text, scopesUsed) {
  const data = parseObject(text);
  if (!data) return { path: file, error: "unparseable JSON or not an object" };
  const report = { path: file };
  const lifecycle = [];
  for (const name of ["preinstall", "install", "postinstall", "prepare", "prepublish", "prepack"]) {
    const script = data?.scripts?.[name];
    if (typeof script !== "string") continue;
    lifecycle.push({
      script: name,
      command: redact(script, 200),
      fetches_remote: /\b(curl|wget|fetch|Invoke-WebRequest|iwr)\b|https?:\/\//.test(script),
      evaluates_code: /\bnode\s+-e\b|\beval\b|\|\s*(sh|bash|node)\b/.test(script),
      reads_env: /process\.env|\$\{?[A-Z_][A-Z0-9_]*\}?|%[A-Z_]+%|\$env:/.test(script),
    });
  }
  if (lifecycle.length) report.lifecycle_scripts = lifecycle;
  const nonRegistry = [];
  for (const group of ["dependencies", "devDependencies", "optionalDependencies", "peerDependencies"]) {
    for (const [name, spec] of Object.entries(data?.[group] ?? {})) {
      if (name.startsWith("@")) scopesUsed.add(name.split("/")[0]);
      if (typeof spec === "string" && /^(git\+|git:|github:|gitlab:|bitbucket:|https?:|file:|link:)|^[\w.-]+\/[\w.-]+(#.*)?$/.test(spec)) nonRegistry.push({ name, group, spec: redact(spec, 160) });
    }
  }
  if (nonRegistry.length) report.non_registry_dependencies = capped(nonRegistry);
  const deps = { ...(data?.dependencies ?? {}), ...(data?.devDependencies ?? {}) };
  report.property_test_libraries = Object.keys(deps).filter((name) => /^(fast-check|@fast-check\/.+|jsverify|testcheck)$/.test(name));
  if (!report.property_test_libraries.length) delete report.property_test_libraries;
  return Object.keys(report).length > 1 ? report : null;
}

function scanNpmrc(file, text) {
  const scopes = [];
  const settings = [];
  lines(text).forEach((line, i) => {
    const scope = line.match(/^\s*(@[\w.-]+):registry\s*=\s*(\S+)/);
    if (scope) scopes.push({ scope: scope[1], registry: redact(scope[2], 160), line: i + 1 });
    const setting = line.match(/^\s*(registry|always-auth|strict-ssl|ignore-scripts|[^=\s]*_authToken|[^=\s]*_auth|[^=\s]*_password)\s*=\s*(.*)$/);
    if (setting) {
      const sensitive = /_auth|_password/.test(setting[1]);
      settings.push({ line: i + 1, key: sensitive ? setting[1].replace(/^\/\/[^:]*:/, "//<host>:") : setting[1], value: sensitive ? (/^\$\{[A-Z0-9_]+\}$/.test(setting[2].trim()) ? "env reference" : "literal value present") : redact(setting[2], 160) });
    }
  });
  return { path: file, scopes, settings };
}

function scanLockfile(file, text) {
  const hosts = new Map();
  const nonRegistry = [];
  let entries = 0;
  let missingIntegrity = 0;
  const note = (name, url) => {
    let host = "(unparsed)";
    if (/^(git\+|git:|github:|ssh:)/.test(url)) host = "git";
    else if (/^file:|^link:|^\.\.?\//.test(url)) host = "local path";
    else { try { host = new URL(url).host; } catch { /* keep */ } }
    hosts.set(host, (hosts.get(host) ?? 0) + 1);
    if (!/^(registry\.npmjs\.org|registry\.yarnpkg\.com)$/.test(host)) nonRegistry.push({ name, source: redact(url, 160) });
  };
  if (/package-lock\.json$|npm-shrinkwrap\.json$/.test(file)) {
    const data = parseObject(text);
    if (!data) return { path: file, error: "unparseable JSON or not an object" };
    const check = (name, entry) => {
      if (!entry || typeof entry !== "object" || entry.link || entry.inBundle || entry.bundled) return;
      entries += 1;
      if (typeof entry.resolved === "string") note(name, entry.resolved);
      // Version 1 records a git or path source in `version` and has no `resolved`.
      else if (typeof entry.version === "string" && /^(git\+|git:|github:|file:|https?:)/.test(entry.version)) note(name, entry.version);
      if (!entry.integrity) missingIntegrity += 1;
    };
    if (data.packages && typeof data.packages === "object") {
      for (const [key, entry] of Object.entries(data.packages)) if (key !== "") check(key.replace(/^.*node_modules\//, ""), entry);
    } else {
      // lockfileVersion 1: nested `dependencies` trees, no `packages` map.
      const walk = (deps) => {
        for (const [name, entry] of Object.entries(deps ?? {})) {
          check(name, entry);
          if (entry && typeof entry === "object") walk(entry.dependencies);
        }
      };
      walk(data.dependencies);
    }
  } else if (/yarn\.lock$/.test(file)) {
    const berry = /__metadata:/.test(text);
    for (const blockText of text.split(/\r?\n\r?\n/)) {
      const head = blockText.split(/\r?\n/).find((line) => line && !line.startsWith("#") && !line.startsWith(" "));
      if (!head || head.startsWith("__metadata")) continue;
      entries += 1;
      const name = head.replace(/["':]/g, "").split(",")[0].trim();
      const resolved = blockText.match(berry ? /^\s+resolution:\s*"?([^"\n]+)"?/m : /^\s+resolved\s+"?([^"\s]+)"?/m);
      if (resolved && !berry) note(name, resolved[1]);
      if (resolved && berry && /@(git|https?|file|link|portal|patch):/.test(resolved[1])) nonRegistry.push({ name, source: redact(resolved[1], 160) });
      if (!(berry ? /^\s+checksum:/m : /^\s+integrity\s/m).test(blockText) && !/@(workspace|link|portal):/.test(resolved?.[1] ?? "")) missingIntegrity += 1;
    }
  } else {
    for (const m of text.matchAll(/^\s+resolution:\s*\{([^}]*)\}/gm)) {
      entries += 1;
      if (!/integrity:/.test(m[1])) missingIntegrity += 1;
      const tarball = m[1].match(/tarball:\s*([^,\s}]+)/);
      const repo = m[1].match(/repo:\s*([^,\s}]+)/);
      if (tarball) note("(pnpm entry)", tarball[1]);
      if (repo) nonRegistry.push({ name: "(pnpm git entry)", source: redact(repo[1], 160) });
    }
  }
  return { path: file, entries, resolved_hosts: Object.fromEntries([...hosts].sort((a, b) => b[1] - a[1])), non_registry_sources: capped(nonRegistry), missing_integrity: missingIntegrity };
}

function scanDockerfile(file, text) {
  const stages = new Set();
  const report = { path: file, images: [], secret_named_args_env: [], add_from_url: [], piped_remote_scripts: [], sets_user: false };
  lines(text).forEach((line, i) => {
    const n = i + 1;
    const from = line.match(/^\s*FROM\s+(?:--platform=\S+\s+)?(\S+)(?:\s+AS\s+(\S+))?/i);
    if (from) {
      const image = from[1];
      if (from[2]) stages.add(from[2].toLowerCase());
      if (image !== "scratch" && !stages.has(image.toLowerCase()) && !image.includes("$")) {
        const first = image.split("/")[0];
        report.images.push({ line: n, image: redact(image, 160), registry_host_named: image.includes("/") && (first.includes(".") || first.includes(":") || first === "localhost"), digest_pinned: /@sha256:[0-9a-f]{64}$/.test(image) });
      }
    }
    const argEnv = line.match(/^\s*(ARG|ENV)\s+([A-Za-z_][A-Za-z0-9_]*)/i);
    if (argEnv && SECRET_NAME.test(argEnv[2])) report.secret_named_args_env.push({ line: n, instruction: argEnv[1].toUpperCase(), name: argEnv[2] });
    if (/^\s*ADD\s+(--\S+\s+)*https?:\/\//i.test(line)) report.add_from_url.push({ line: n });
    if (/\b(curl|wget)\b[^\n]*\|\s*(sudo\s+)?(sh|bash|zsh|python3?|node)\b/.test(line)) report.piped_remote_scripts.push({ line: n });
    if (/^\s*USER\s+(?!root\b|0\b)\S+/i.test(line)) report.sets_user = true;
  });
  return report;
}

function scanCompose(file, text) {
  const images = [];
  lines(text).forEach((line, i) => {
    const m = line.match(/^\s*image:\s*["']?([^"'\s#]+)/);
    if (!m || m[1].includes("$")) return;
    const first = m[1].split("/")[0];
    images.push({ line: i + 1, image: redact(m[1], 160), registry_host_named: m[1].includes("/") && (first.includes(".") || first.includes(":") || first === "localhost"), digest_pinned: /@sha256:[0-9a-f]{64}$/.test(m[1]) });
  });
  return images.length ? { path: file, images } : null;
}

const BROAD_BASH = /^Bash(\(\s*\*?\s*\))?$|^Bash\(\s*\*\s*[: ]?\*?\s*\)$/;
const INTERPRETER_PREFIX = /^Bash\(\s*(node|python3?|py|sh|bash|zsh|pwsh|powershell|cmd|curl|wget|npx|npm\s+(run|exec)|pnpm\s+(dlx|exec)|bunx|uvx|deno|ruby|perl|php|eval|xargs|env|sudo|iex|Invoke-Expression)\b[^)]*\)$/i;

function scanClaudeSettings(file, text) {
  const data = parseObject(text);
  if (!data) return { path: file, error: "unparseable JSON or not an object" };
  const report = { path: file };
  const hooks = [];
  for (const [event, groups] of Object.entries(data.hooks ?? {})) {
    for (const group of Array.isArray(groups) ? groups : []) {
      for (const hook of Array.isArray(group?.hooks) ? group.hooks : []) {
        if (typeof hook?.command !== "string") continue;
        hooks.push({
          event,
          matcher: group.matcher ?? null,
          command: redact(hook.command, 300),
          uses_eval_or_shell_string: /\beval\b|\bsh\s+-c\b|\bbash\s+-c\b|Invoke-Expression|\biex\b|\$\(/.test(hook.command),
          reads_tool_input: /\bjq\b|stdin|tool_input|\bxargs\b|\bread\s/i.test(hook.command),
          scripts: [...redact(hook.command, 2000).matchAll(/[^\s"']+\.(?:sh|bash|ps1|mjs|cjs|js|ts|py)\b/g)].map((m) => m[0]).slice(0, 5),
        });
      }
    }
  }
  if (hooks.length) report.hooks = hooks;
  const allow = Array.isArray(data.permissions?.allow) ? data.permissions.allow : [];
  const broad = allow.filter((entry) => typeof entry === "string" && (BROAD_BASH.test(entry.trim()) || INTERPRETER_PREFIX.test(entry.trim())));
  if (broad.length) report.broad_allows = broad.map((entry) => redact(entry, 120));
  if (data.permissions?.defaultMode) report.default_mode = data.permissions.defaultMode;
  if (data.enableAllProjectMcpServers === true) report.enable_all_project_mcp_servers = true;
  if (Array.isArray(data.enabledMcpjsonServers) && data.enabledMcpjsonServers.length) report.enabled_mcpjson_servers = data.enabledMcpjsonServers.map((s) => redact(s, 80));
  return Object.keys(report).length > 1 ? report : null;
}

const SECRET_ARG_FLAG = /^--?[\w-]*(token|key|secret|passw(or)?d|pwd|credential|auth)[\w-]*(=|$)/i;

function scanMcpJson(file, text) {
  const data = parseObject(text);
  if (!data) return [{ path: file, error: "unparseable JSON or not an object" }];
  const servers = [];
  for (const [name, server] of Object.entries(data.mcpServers ?? data.servers ?? {})) {
    const entry = { path: file, server: name };
    if (typeof server?.url === "string") {
      entry.remote_url_host = (() => { try { return new URL(server.url).host; } catch { return "(unparsed)"; } })();
    }
    if (typeof server?.command === "string") {
      const args = Array.isArray(server.args) ? server.args.filter((a) => typeof a === "string") : [];
      // Mask whole secret argument values before joining: a value with spaces would
      // otherwise lose its boundaries and be only partly masked.
      const masked = args.map((arg, i) => {
        if (SECRET_ARG_FLAG.test(arg) && arg.includes("=")) return arg.replace(/=.*$/s, (v) => (/^=\$/.test(v) ? v : "=<redacted>"));
        if (i > 0 && SECRET_ARG_FLAG.test(args[i - 1]) && !args[i - 1].includes("=") && !arg.startsWith("-") && !arg.startsWith("$")) return "<redacted>";
        return arg;
      });
      entry.command = redact([server.command, ...masked].join(" "), 200);
      const python = /(^|[\\/])(uvx|pipx)(\.cmd|\.exe)?$/i.test(server.command);
      const runner = python || /(^|[\\/])(npx|bunx)(\.cmd|\.exe)?$/i.test(server.command) || (/(^|[\\/])pnpm(\.cmd)?$/i.test(server.command) && args[0] === "dlx");
      if (runner) {
        entry.package_runner = true;
        entry.package_version_exact = runnerPackagePinned(args, python);
      }
      const secretArgs = args.filter((a) => SECRET_ARG_FLAG.test(a)).map((a) => a.split("=")[0]);
      if (secretArgs.length) entry.secret_named_args = secretArgs;
    }
    const env = server?.env && typeof server.env === "object" ? server.env : {};
    const secretEnv = Object.entries(env).filter(([key]) => SECRET_NAME.test(key)).map(([key, value]) => ({ name: key, value: typeof value === "string" && /^\$\{[^}]+\}$/.test(value.trim()) ? "env reference" : "literal value present" }));
    if (secretEnv.length) entry.secret_named_env = secretEnv;
    servers.push(entry);
  }
  return servers;
}

function scanSkill(file, text) {
  const front = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!front) return null;
  const tools = front[1].match(/^allowed-tools:\s*(.*(?:\r?\n\s+-.*)*)/m);
  if (!tools) return null;
  const list = tools[1].replace(/\r?\n\s+-\s*/g, ",").replace(/[[\]"']/g, "").split(/[,\s]+(?![^(]*\))/).map((t) => t.trim()).filter(Boolean);
  const broad = list.filter((t) => /^(Bash|Bash\(\s*\*\s*\)|Write|Edit|MultiEdit|NotebookEdit)$/.test(t));
  if (!broad.length) return null;
  const outside = [...new Set([...text.matchAll(/\bgh\s+(issue|pr|api)\b|issue (body|bodies|comment)|pull request (body|text|comment|description)|review comment|WebFetch|WebSearch|web page|\bcurl\b|\bfetch\(|download/gi)].map((m) => m[0].toLowerCase()))];
  return { path: file, broad_tools: broad, outside_text_mentions: outside };
}

function scanFuzz(file, text, fuzz) {
  if (/_test\.go$/.test(file)) {
    for (const m of text.matchAll(/^func\s+(Fuzz\w+)\s*\(\s*\w+\s+\*testing\.F\s*\)/gm)) {
      const dir = path.posix.dirname(file);
      fuzz.push({ path: file, line: lineOf(text, m.index), kind: "go-native-fuzz", target: m[1], command: `go test -run=^$ -fuzz=^${m[1]}$ -fuzztime=60s -parallel=1 ${dir === "." ? "." : `./${dir}`}`, needs_tool: null });
    }
  }
  if (/(^|\/)fuzz\/Cargo\.toml$/.test(file) && /libfuzzer-sys|cargo-fuzz/.test(text)) {
    fuzz.push({ path: file, kind: "cargo-fuzz", target: "see fuzz/fuzz_targets/", command: "cargo fuzz run <target> -- -max_total_time=60 -workers=1", needs_tool: "cargo-fuzz (use only if already installed)" });
  }
  if (/\.py$/.test(file) && /^\s*(from hypothesis import|import hypothesis)/m.test(text)) fuzz.push({ path: file, kind: "hypothesis-property-test", command: "the project's pytest command scoped to this file", needs_tool: null });
  if (/\.py$/.test(file) && /^\s*import atheris/m.test(text)) fuzz.push({ path: file, kind: "atheris", command: `python ${file} -max_total_time=60`, needs_tool: "atheris (use only if already installed)" });
  if (/\.(java|kt)$/.test(file) && /@FuzzTest|com\.code_intelligence\.jazzer/.test(text)) fuzz.push({ path: file, kind: "jazzer", command: "the project's test command for this class", needs_tool: null });
  if (/\.(c|cc|cpp|cxx)$/.test(file) && /\bLLVMFuzzerTestOneInput\s*\(/.test(text)) fuzz.push({ path: file, kind: "libfuzzer-harness", command: "the project's own fuzz build script, if one exists", needs_tool: "clang with -fsanitize=fuzzer (use only if already installed)" });
  if (/\.(js|mjs|cjs|ts|tsx)$/.test(file) && /from\s+["']fast-check["']|require\(["']fast-check["']\)|from\s+["']@fast-check\//.test(text)) fuzz.push({ path: file, kind: "fast-check-property-test", command: "the project's test command scoped to this file", needs_tool: null });
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const tree = path.resolve(options.tree);
  const commit = git(tree, ["rev-parse", "--verify", `${options.ref}^{commit}`]);
  if (commit.status !== 0) throw new Error(`cannot resolve ${options.ref} in ${tree}`);
  const sha = commit.stdout.toString().trim();

  const entries = listTree(tree, sha);
  const skipped = { symlinks: 0, submodules: 0, too_large: [], binary_by_extension: 0 };
  const wanted = [];
  const trackedMaps = [];
  for (const entry of entries) {
    if (entry.mode === "120000") { skipped.symlinks += 1; continue; }
    if (entry.mode === "160000" || entry.type === "commit") { skipped.submodules += 1; continue; }
    if (entry.type !== "blob") continue;
    if (/\.map$/.test(entry.path)) { trackedMaps.push(entry.path); continue; }
    if (TEXT_SKIP.test(entry.path)) { skipped.binary_by_extension += 1; continue; }
    const limit = LOCKFILE.test(entry.path) ? MAX_LOCK_BYTES : MAX_TEXT_BYTES;
    if (entry.size > limit) { skipped.too_large.push(entry.path); continue; }
    wanted.push(entry);
  }
  const files = readBlobs(tree, wanted);

  const report = {
    tool: "ci-surface-scan",
    tree,
    commit: sha,
    note: "Leads for coverage units, never findings. Line-based reading, not a YAML parser; untracked build output is not scanned.",
    files_read: files.size,
    skipped: { ...skipped, too_large: capped(skipped.too_large) },
    workflows: [],
    packages: [],
    npmrc: [],
    npm_scopes_without_registry_mapping: [],
    pip_extra_indexes: [],
    lockfiles: [],
    docker: [],
    claude_settings: [],
    mcp_servers: [],
    skills_with_broad_tools: [],
    tls_verification_off: [],
    source_maps: { settings: [], tracked_map_files: capped(trackedMaps) },
    public_bundler_secret_names: [],
    fuzz_targets: [],
  };
  const scopesUsed = new Set();
  const publicNames = new Map();

  // A copy of this script in the target holds every pattern above as text; skip it.
  const ownSource = fs.readFileSync(new URL(import.meta.url), "utf8").replace(/\r\n/g, "\n");
  for (const [file, text] of [...files].sort((a, b) => a[0].localeCompare(b[0]))) {
    if (text.replace(/\r\n/g, "\n") === ownSource) continue;
    const base = path.posix.basename(file);
    // requirements*.txt and constraints*.txt are configuration, not docs.
    const isDoc = /\.(md|mdx|markdown|rst|adoc)$/i.test(file) || (/\.txt$/i.test(file) && !/(^|\/)(requirements|constraints)[^/]*\.txt$/i.test(file));
    if (/^\.github\/workflows\/[^/]+\.ya?ml$/.test(file)) report.workflows.push(scanWorkflow(file, text, false));
    else if (/(^|\/)action\.ya?ml$/.test(file) && /\bruns:/.test(text)) {
      const action = scanWorkflow(file, text, true);
      if (Object.keys(action).length > 2) report.workflows.push(action);
    }
    if (base === "package.json" && !file.includes("node_modules/")) {
      const pkg = scanPackageJson(file, text, scopesUsed);
      if (pkg) report.packages.push(pkg);
    }
    if (base === ".npmrc" || base === ".yarnrc.yml" || base === ".yarnrc") {
      const npmrc = scanNpmrc(file, text);
      if (base === ".yarnrc.yml") for (const m of text.matchAll(/^\s*["']?([\w.-]+)["']?:\s*\n\s+npmRegistryServer:\s*["']?(\S+?)["']?\s*$/gm)) npmrc.scopes.push({ scope: `@${m[1]}`, registry: redact(m[2], 160), line: lineOf(text, m.index) });
      if (npmrc.scopes.length || npmrc.settings.length) report.npmrc.push(npmrc);
    }
    if (LOCKFILE.test(file)) report.lockfiles.push(scanLockfile(file, text));
    if (/(^|\/)(Dockerfile[^/]*|[^/]+\.dockerfile|Containerfile)$/i.test(file)) report.docker.push(scanDockerfile(file, text));
    if (/(^|\/)(docker-)?compose[^/]*\.ya?ml$/i.test(file)) { const compose = scanCompose(file, text); if (compose) report.docker.push(compose); }
    if (/(^|\/)\.claude\/settings[^/]*\.json$/.test(file)) { const settings = scanClaudeSettings(file, text); if (settings) report.claude_settings.push(settings); }
    if (/(^|\/)\.?mcp\.json$/.test(file)) report.mcp_servers.push(...scanMcpJson(file, text));
    if (/(^|\/)\.(claude|agents)\/skills\/[^/]+\/SKILL\.md$/.test(file)) { const skill = scanSkill(file, text); if (skill) report.skills_with_broad_tools.push(skill); }
    if (!LOCKFILE.test(file)) {
      lines(text).forEach((line, i) => {
        if (/extra-index-url/.test(line) && !isDoc) report.pip_extra_indexes.push({ path: file, line: i + 1 });
        for (const [name, regex] of TLS_OFF) if (regex.test(line)) report.tls_verification_off.push({ path: file, line: i + 1, pattern: name, in_docs: isDoc });
        if (!isDoc) for (const [name, regex] of SOURCE_MAP_SETTINGS) if (regex.test(line)) report.source_maps.settings.push({ path: file, line: i + 1, pattern: name });
        for (const m of line.matchAll(PUBLIC_SECRET_VAR)) {
          const key = `${m[0]}`;
          if (!publicNames.has(key)) publicNames.set(key, []);
          publicNames.get(key).push(`${file}:${i + 1}`);
        }
      });
    }
    scanFuzz(file, text, report.fuzz_targets);
  }

  const mapped = new Set(report.npmrc.flatMap((entry) => entry.scopes.map((s) => s.scope)));
  // With no mapping at all, every scope resolves from the default registry; public scopes
  // such as @types appear too, and the hunter decides which ones are internal.
  report.npm_scopes_without_registry_mapping = [...scopesUsed].filter((scope) => !mapped.has(scope)).sort();
  report.public_bundler_secret_names = [...publicNames].map(([name, where]) => ({ name, locations: where.slice(0, 10), count: where.length }));
  for (const key of ["pip_extra_indexes", "tls_verification_off", "fuzz_targets"]) report[key] = capped(report[key]);

  const count = (list, key) => list.reduce((sum, item) => sum + (Array.isArray(item[key]) ? item[key].length : item[key]?.total ?? 0), 0);
  report.summary = {
    workflows: report.workflows.length,
    privileged_trigger_workflows: report.workflows.filter((w) => w.privileged_triggers?.length).length,
    workflows_without_top_level_permissions: report.workflows.filter((w) => w.kind === "workflow" && !w.top_level_permissions).length,
    unpinned_uses: count(report.workflows, "unpinned_uses"),
    untrusted_expressions: count(report.workflows, "untrusted_expressions"),
    env_file_writes: count(report.workflows, "env_file_writes"),
    pr_head_checkouts: count(report.workflows, "pr_head_checkouts"),
    agent_steps: count(report.workflows, "agent_steps"),
    lifecycle_scripts: report.packages.reduce((sum, p) => sum + (p.lifecycle_scripts?.length ?? 0), 0),
    lockfile_entries_missing_integrity: report.lockfiles.reduce((sum, l) => sum + (l.missing_integrity ?? 0), 0),
    claude_hooks: report.claude_settings.reduce((sum, s) => sum + (s.hooks?.length ?? 0), 0),
    claude_broad_allows: report.claude_settings.reduce((sum, s) => sum + (s.broad_allows?.length ?? 0), 0),
    mcp_servers_unpinned_or_remote: report.mcp_servers.filter((s) => (s.package_runner && !s.package_version_exact) || s.remote_url_host).length,
    tls_off_outside_docs: (Array.isArray(report.tls_verification_off) ? report.tls_verification_off : report.tls_verification_off.items).filter((t) => !t.in_docs).length,
    source_map_settings: report.source_maps.settings.length,
    tracked_map_files: trackedMaps.length,
    fuzz_targets: Array.isArray(report.fuzz_targets) ? report.fuzz_targets.length : report.fuzz_targets.total,
  };

  const text = `${JSON.stringify(report, null, 2)}\n`;
  if (options.out) fs.writeFileSync(options.out, text, { flag: "wx" });
  else process.stdout.write(text);
}

try {
  main();
} catch (error) {
  console.error(`ci-surface-scan: ${error.message}`);
  process.exitCode = 2;
}
