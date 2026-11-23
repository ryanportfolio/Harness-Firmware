#!/usr/bin/env node
// codex-run: the one way our skills launch OpenAI Codex CLI (`codex exec` / `codex exec review`).
// Modeled on HarnessC's CodexTextGeneration.ts: prompt on stdin, explicit sandbox, user hooks,
// plugins, apps and MCP servers off by default, a hard timeout, and model/effort/sandbox checked
// against the session's own rollout file (not scraped from log headers).
//
// Usage: node codex-run.mjs --out <new dir> (--role <name> | --model <id>) [options] [< prompt]
//        node codex-run.mjs --preflight
// Docs: README.md next to this file.

import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CODEX_HOME = process.env.CODEX_HOME || path.join(os.homedir(), ".codex");
const SANDBOXES = ["read-only", "workspace-write", "danger-full-access"];
const MODEL_REJECTED = /model_not_found|unknown provider for model|\bmodel\b.*?\b(is not|isn't) (supported|available)|does not exist or you do not have access/i;

// How to start Codex without a shell. On Windows Node cannot spawn a .cmd/.bat shim without one,
// and a global npm install exposes Codex only as `codex.cmd`. So walk `where.exe codex` in PATH
// order: a real .exe/.com (0-byte WindowsApps aliases skipped) runs directly; an npm shim runs as
// `node <shim dir>/node_modules/@openai/codex/bin/codex.js`.
function resolveCodex() {
  if (process.platform !== "win32") return { cmd: "codex", pre: [] };
  const w = spawnSync("where.exe", ["codex"], { encoding: "utf8", windowsHide: true });
  for (const hit of (w.stdout || "").split(/\r?\n/).map((s) => s.trim()).filter(Boolean)) {
    try {
      if (/\.(exe|com)$/i.test(hit) && fs.statSync(hit).size > 0) return { cmd: hit, pre: [] };
      if (/\.(cmd|bat)$/i.test(hit)) {
        const js = path.join(path.dirname(hit), "node_modules", "@openai", "codex", "bin", "codex.js");
        if (fs.existsSync(js)) return { cmd: process.execPath, pre: [js] };
      }
    } catch {}
  }
  return { cmd: "codex", pre: [] };
}
const CODEX = resolveCodex();
const runCodex = (args, opts) => spawnSync(CODEX.cmd, [...CODEX.pre, ...args], opts);

const fail = (msg) => {
  console.error(`[codex-run] ${msg}`);
  process.exitCode = 2;
};

function parseArgs(argv) {
  const o = { image: [], addDir: [], config: [], timeoutMin: 30, sandbox: "read-only" };
  const multi = { "--image": "image", "--add-dir": "addDir", "--config": "config" };
  const single = {
    "--out": "out", "--role": "role", "--model": "model", "--effort": "effort", "--sandbox": "sandbox",
    "--cd": "cd", "--schema": "schema", "--prompt-file": "promptFile", "--timeout-min": "timeoutMin",
    "--base": "base", "--commit": "commit", "--expect-diff": "expectDiff", "--expect-read": "expectRead",
    "--label": "label",
  };
  const flags = {
    "--review": "review", "--uncommitted": "uncommitted", "--ephemeral": "ephemeral",
    "--skip-git-repo-check": "skipGit", "--keep-hooks": "keepHooks", "--keep-mcp": "keepMcp",
    "--keep-plugins": "keepPlugins", "--preflight": "preflight", "--no-prompt": "noPrompt",
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (multi[a]) o[multi[a]].push(argv[++i]);
    else if (single[a]) o[single[a]] = argv[++i];
    else if (flags[a]) o[flags[a]] = true;
    else throw new Error(`unknown argument: ${a}`);
  }
  o.timeoutMin = Number(o.timeoutMin);
  return o;
}

function loadRoles() {
  return JSON.parse(fs.readFileSync(path.join(HERE, "models.json"), "utf8")).roles;
}

// The provider Codex uses without --profile: top-level `model_provider`, overridden by the
// `[profiles.<name>]` table of a top-level `profile = "<name>"`. Other tables don't apply.
// Keys may be bare, quoted or dotted (`"model_provider"`, `profiles.gw.model_provider`); every
// assignment is flattened to its full dotted path. Inline tables are not read.
const KEY = `(?:"[^"]*"|'[^']*'|[A-Za-z0-9_-]+)`;
const normalizeKey = (k) => (k.match(new RegExp(KEY, "g")) || []).map((s) => s.replace(/^["']|["']$/g, "")).join(".");
function activeProvider(toml) {
  const flat = {};
  let table = null;
  for (const raw of toml.split(/\r?\n/)) {
    const line = raw.replace(/\s+#.*$/, "").trim();
    const head = line.match(/^\[\s*([^\[\]]+?)\s*\]$/);
    if (head) { table = normalizeKey(head[1]); continue; }
    const kv = line.match(new RegExp(`^(${KEY}(?:\\s*\\.\\s*${KEY})*)\\s*=\\s*(?:"([^"]*)"|'([^']*)')`));
    if (!kv) continue;
    flat[(table === null ? "" : `${table}.`) + normalizeKey(kv[1])] = kv[2] ?? kv[3];
  }
  const profile = flat.profile;
  return (profile ? flat[`profiles.${profile}.model_provider`] : undefined) ?? flat.model_provider ?? null;
}

function preflight() {
  const run = (args) => runCodex(args, { encoding: "utf8", windowsHide: true });
  const v = run(["--version"]);
  const login = run(["login", "status"]);
  let provider = null;
  try {
    provider = activeProvider(fs.readFileSync(path.join(CODEX_HOME, "config.toml"), "utf8"));
  } catch {}
  const loginLine = `${login.stdout || ""}${login.stderr || ""}`.split(/\r?\n/).find((l) => /logged|not/i.test(l)) || "";
  const report = {
    cli: (v.stdout || v.stderr || "").trim() || `codex not runnable (${v.error?.code || v.status})`,
    login: loginLine.trim(),
    chatgptLogin: /Logged in using ChatGPT/i.test(loginLine),
    gatewayProvider: provider,
    ready: /Logged in using ChatGPT/i.test(loginLine) || Boolean(provider && provider !== "openai"),
    roles: loadRoles(),
  };
  console.log(JSON.stringify(report, null, 2));
  process.exitCode = report.ready ? 0 : 1;
}

function enabledMcpServers(cwd) {
  const r = runCodex(["-c", "features.plugins=false", "-c", "features.apps=false", "mcp", "list", "--json"], {
    cwd, encoding: "utf8", timeout: 15000, windowsHide: true,
  });
  if (r.status !== 0) return { error: `codex mcp list failed (${r.error?.code || `exit ${r.status}`})` };
  try {
    return { names: JSON.parse(r.stdout).filter((s) => s.enabled).map((s) => s.name) };
  } catch {
    return { error: "codex mcp list output unreadable" };
  }
}

function buildArgs(o, model, effort, mcp) {
  const args = ["exec"];
  if (o.review) args.push("review");
  const dotted = mcp.filter((n) => n.includes(".") || n.includes("="));
  if (dotted.length) args.push("-c", `mcp_servers={${dotted.map((n) => `${JSON.stringify(n)}={enabled=false}`).join(",")}}`);
  for (const c of o.config) args.push("-c", c);
  // Hardening goes after the caller's -c flags so they cannot switch it back on by accident.
  if (!o.keepHooks) args.push("-c", "features.hooks=false");
  if (!o.keepPlugins) args.push("-c", "features.plugins=false", "-c", "features.apps=false");
  for (const n of mcp) if (!n.includes(".") && !n.includes("=")) args.push("-c", `mcp_servers.${n}.enabled=false`);
  args.push("-m", model, "-c", `model_reasoning_effort=${effort}`);
  // Review mode has no -s flag; the config key sets the same policy.
  if (o.review) args.push("-c", `sandbox_mode="${o.sandbox}"`);
  else args.push("-s", o.sandbox);
  // Absolute: the child already starts in the resolved --cd, so a relative -C would resolve twice.
  if (o.cd && !o.review) args.push("-C", path.resolve(o.cd));
  for (const d of o.addDir) args.push("--add-dir", d);
  if (o.skipGit) args.push("--skip-git-repo-check");
  if (o.ephemeral) args.push("--ephemeral");
  if (o.schema) args.push("--output-schema", path.resolve(o.schema));
  if (o.base) args.push("--base", o.base);
  if (o.commit) args.push("--commit", o.commit);
  if (o.uncommitted) args.push("--uncommitted");
  args.push("--json", "-o", path.join(o.out, "last.md"));
  // -i takes several values and would swallow a trailing prompt, so images go before "-".
  for (const img of o.image) args.push("-i", path.resolve(img));
  if (!o.noPrompt) args.push("-");
  return args;
}

function killTree(child) {
  if (process.platform === "win32") spawnSync("taskkill", ["/pid", String(child.pid), "/T", "/F"], { windowsHide: true });
  else child.kill("SIGKILL");
}

const readJsonl = (f) =>
  fs.readFileSync(f, "utf8").split(/\r?\n/).flatMap((l) => {
    try { return l ? [JSON.parse(l)] : []; } catch { return []; }
  });

const firstLine = (f) => {
  const fd = fs.openSync(f, "r");
  try {
    const b = Buffer.alloc(65536);
    const n = fs.readSync(fd, b, 0, b.length, 0);
    const i = b.subarray(0, n).indexOf(10);
    return b.subarray(0, i < 0 ? n : i).toString("utf8");
  } finally { fs.closeSync(fd); }
};

function rolloutFiles(since) {
  const out = [];
  const days = new Set();
  for (let t = since.getTime() - 864e5; t <= Date.now() + 864e5; t += 864e5) {
    const d = new Date(t);
    days.add(path.join(CODEX_HOME, "sessions", String(d.getFullYear()), String(d.getMonth() + 1).padStart(2, "0"), String(d.getDate()).padStart(2, "0")));
  }
  for (const dir of days) {
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir)) if (/^rollout-.*\.jsonl$/.test(f)) out.push(path.join(dir, f));
  }
  return out;
}

function evidence(o, threadId, started) {
  const files = rolloutFiles(started);
  const own = files.find((f) => f.endsWith(`-${threadId}.jsonl`));
  if (!own) return { rollout: null, note: "rollout file not found; model, effort and sandbox unverified" };
  const ownRecs = readJsonl(own);
  const ev = { rollout: own };
  let recs = ownRecs;
  if (o.review) {
    const sibs = files.filter((f) => f !== own && (() => {
      const m = firstLine(f);
      return m.includes(`"parent_thread_id":"${threadId}"`) && m.includes(`"subagent":"review"`);
    })());
    ev.reviewSiblings = sibs.length;
    if (sibs.length === 1) { ev.reviewRollout = sibs[0]; recs = readJsonl(sibs[0]); }
    const exited = ownRecs.filter((j) => j.payload?.item?.type === "ExitedReviewMode").map((j) => j.payload.item.review_output);
    ev.exitedReviewMode = exited.length;
    if (exited.length) fs.writeFileSync(path.join(o.out, "review-output.json"), JSON.stringify(exited.at(-1), null, 2));
  }
  // Review mode: only the single review sibling's settings describe the reviewer; the parent's
  // turn holds the launcher's settings, so they are never reported as the reviewer's.
  const turnSource = o.review ? (ev.reviewRollout ? recs : []) : ownRecs;
  const turn = turnSource.find((j) => j.type === "turn_context")?.payload ?? {};
  ev.model = turn.model ?? null;
  ev.effort = turn.effort ?? turn.reasoning_effort ?? null;
  ev.sandbox = turn.sandbox_policy?.type ?? null;
  const toolText = (j) =>
    j.payload?.type === "custom_tool_call" && j.payload.name === "exec" ? String(j.payload.input ?? "")
      : j.payload?.type === "function_call" ? String(j.payload.arguments ?? "") : "";
  const texts = recs.map(toolText).filter(Boolean);
  ev.toolCalls = texts.length;
  ev.spawnCalls = recs.filter((j) => j.payload?.type === "function_call" && j.payload.name === "spawn_agent").length;
  if (o.expectDiff) {
    const [base, head] = o.expectDiff.split(/[ ,]+/);
    const wanted = head ? [`git diff ${base} ${head}`, `git diff ${base}..${head}`] : [`git diff ${base}`];
    // `git show <head>` prints the requested patch only for a single-commit scope (base = head's
    // parent), and never as `git show <head>:<path>`, which prints a file, not a diff.
    const parent = head ? spawnSync("git", ["rev-parse", `${head}^`], { cwd: o.cd || process.cwd(), encoding: "utf8", windowsHide: true }).stdout?.trim() : "";
    // Only the plain form `git show <head>` (no options, nothing after) on a non-merge commit:
    // options like --no-patch or --stat, or a merge's combined diff, can omit the patch.
    const merge = head ? spawnSync("git", ["rev-parse", "--verify", "-q", `${head}^2`], { cwd: o.cd || process.cwd(), windowsHide: true }).status === 0 : true;
    const showRe = parent && parent === base && !merge ? new RegExp(`git show\\s+${head}(?=\\s*(?:$|["'\`|;&)]))`, "m") : null;
    ev.diffReads = texts.filter((t) => wanted.some((w) => t.includes(w)) || (showRe && showRe.test(t))).length;
    ev.untrackedListed = texts.some((t) => t.includes("--untracked-files=all"));
  }
  if (o.expectRead) {
    // Match the path's last 4 segments so absolute and repo-relative reads both count.
    const re = new RegExp(o.expectRead.split(/[\\/]+/).filter(Boolean).slice(-4).map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("[\\\\/]+"));
    const reads = texts.filter((t) => re.test(t) && !/^\s*(rg|grep|find|ls)\b/.test(t));
    ev.expectedReads = reads.length;
    ev.expectedReadSamples = reads.slice(0, 3).map((t) => t.slice(0, 200));
  }
  return ev;
}

async function main() {
  let o;
  try { o = parseArgs(process.argv.slice(2)); } catch (e) { return fail(e.message); }
  if (o.preflight) return preflight();
  if (!o.out) return fail("--out <new dir> is required");
  if (!SANDBOXES.includes(o.sandbox)) return fail(`--sandbox must be one of ${SANDBOXES.join(", ")}`);
  const roles = loadRoles();
  if (o.role && !roles[o.role]) return fail(`unknown role ${o.role}; known: ${Object.keys(roles).join(", ")}`);
  const model = o.model || roles[o.role]?.model;
  const effort = o.effort || roles[o.role]?.effort || "high";
  if (!model) return fail("pass --role or --model (never run on the config.toml default)");
  const selector = o.base || o.commit || o.uncommitted;
  if (selector && !o.review) return fail("--base/--commit/--uncommitted need --review");
  if (o.review && selector) o.noPrompt = true; // the CLI rejects a selector plus a custom prompt
  if (!(o.timeoutMin > 0)) return fail("--timeout-min must be a positive number");

  o.out = path.resolve(o.out);
  if (fs.existsSync(o.out) && fs.readdirSync(o.out).length) return fail(`${o.out} is not empty; use a new run directory`);
  fs.mkdirSync(o.out, { recursive: true });

  let prompt = null;
  if (!o.noPrompt) {
    prompt = o.promptFile ? fs.readFileSync(o.promptFile, "utf8") : fs.readFileSync(0, "utf8");
    if (!prompt.trim()) return fail("empty prompt (pass --prompt-file or pipe it on stdin)");
    fs.writeFileSync(path.join(o.out, "prompt.md"), prompt);
  }

  const cwd = path.resolve(o.cd || process.cwd());
  const mcp = o.keepMcp ? { names: [] } : enabledMcpServers(cwd);
  if (mcp.error) {
    // Fail closed: without the server list the run would keep the user's MCP tools the caller turned off.
    const failed = { ok: false, reason: "mcp_isolation_failed", exitCode: null, timedOut: false, durationSec: 0, threadId: null,
      requested: { model, effort, sandbox: o.sandbox, role: o.role ?? null }, observed: null, usage: null,
      errors: [`${mcp.error}; Codex not started. Pass --keep-mcp to run with the user's MCP servers on.`], notices: [],
      reportPath: null, reportBytes: 0, outputJson: null, evidence: null };
    fs.writeFileSync(path.join(o.out, "result.json"), JSON.stringify(failed, null, 2));
    fs.writeFileSync(path.join(o.out, "status.json"), JSON.stringify({ state: "failed", reason: failed.reason }));
    console.log(`[codex-run] FAILED: mcp_isolation_failed (${mcp.error}) -> ${path.join(o.out, "result.json")}`);
    process.exitCode = 1;
    return;
  }
  const args = buildArgs(o, model, effort, mcp.names);
  const started = new Date();
  const meta = {
    label: o.label ?? null, startedAt: started.toISOString(), cwd, requested: { model, effort, sandbox: o.sandbox, role: o.role ?? null },
    review: Boolean(o.review), selector: o.base ? `--base ${o.base}` : o.commit ? `--commit ${o.commit}` : o.uncommitted ? "--uncommitted" : null,
    mcpDisabled: mcp.names, command: [CODEX.cmd, ...CODEX.pre, ...args],
  };
  fs.writeFileSync(path.join(o.out, "run.json"), JSON.stringify(meta, null, 2));

  const events = fs.createWriteStream(path.join(o.out, "events.jsonl"));
  const errLog = fs.createWriteStream(path.join(o.out, "stderr.log"));
  const child = spawn(CODEX.cmd, [...CODEX.pre, ...args], { cwd, stdio: [prompt === null ? "ignore" : "pipe", "pipe", "pipe"], windowsHide: true });
  fs.writeFileSync(path.join(o.out, "pid"), String(child.pid ?? ""));
  // Codex can exit before reading the whole prompt; an unhandled stdin error would kill the
  // runner before it writes result.json, so record it and let the exit path report the failure.
  const stdinErrors = [];
  if (prompt !== null) {
    child.stdin.on("error", (e) => stdinErrors.push(`prompt write failed: ${e.code || e.message}`));
    child.stdin.end(prompt);
  }

  let threadId = null, count = 0, lastType = "", usage = null, buf = "";
  const errors = [], notices = [];
  child.stdout.on("data", (d) => {
    events.write(d);
    buf += d.toString("utf8");
    let i;
    while ((i = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, i).trim();
      buf = buf.slice(i + 1);
      if (!line) continue;
      let e;
      try { e = JSON.parse(line); } catch { continue; }
      count++;
      lastType = e.item?.type || e.type;
      if (e.type === "thread.started") threadId = e.thread_id;
      if (e.type === "turn.completed") usage = e.usage ?? null;
      if (e.type === "turn.failed" || e.type === "error") errors.push(e.error?.message || e.message || JSON.stringify(e));
      if (e.item?.type === "error") notices.push(e.item.message);
    }
  });
  child.stderr.on("data", (d) => errLog.write(d));

  let timedOut = false;
  const tick = setInterval(() => {
    const s = Math.round((Date.now() - started) / 1000);
    const line = `[codex-run] ${Math.floor(s / 60)}m${String(s % 60).padStart(2, "0")}s events=${count} last=${lastType || "-"}`;
    console.log(line);
    fs.writeFileSync(path.join(o.out, "status.json"), JSON.stringify({ state: "running", elapsedSec: s, events: count, last: lastType, pid: child.pid }));
  }, 30000);
  const killer = setTimeout(() => { timedOut = true; killTree(child); }, o.timeoutMin * 60000);

  const exitCode = await new Promise((res) => {
    child.on("error", (e) => { errors.push(`spawn failed: ${e.message}`); res(-1); });
    child.on("close", (c) => res(c ?? -1));
  });
  clearInterval(tick);
  clearTimeout(killer);
  await Promise.all([new Promise((r) => events.end(r)), new Promise((r) => errLog.end(r))]);

  const lastPath = path.join(o.out, "last.md");
  const last = fs.existsSync(lastPath) ? fs.readFileSync(lastPath, "utf8") : "";
  const stderr = fs.readFileSync(path.join(o.out, "stderr.log"), "utf8");
  const result = {
    ok: false, reason: null, exitCode, timedOut, durationSec: Math.round((Date.now() - started) / 1000),
    threadId, requested: meta.requested, observed: null, usage, errors: [...stdinErrors, ...errors], notices: notices.slice(0, 10),
    reportPath: lastPath, reportBytes: Buffer.byteLength(last), outputJson: null, evidence: null,
  };

  if (threadId && !o.ephemeral) {
    result.evidence = evidence(o, threadId, started);
    const { model: m, effort: e, sandbox: s } = result.evidence;
    // null, not an object of nulls, so callers take their "unverified" path.
    result.observed = m || e || s ? { model: m ?? null, effort: e ?? null, sandbox: s ?? null } : null;
  }
  if (o.schema && last.trim()) {
    try {
      fs.writeFileSync(path.join(o.out, "output.json"), JSON.stringify(JSON.parse(last), null, 2));
      result.outputJson = path.join(o.out, "output.json");
    } catch { result.reason = "schema_output_not_json"; }
  }

  const obs = result.observed;
  if (timedOut) result.reason = "timeout";
  else if (stdinErrors.length) result.reason = "prompt_not_delivered";
  else if (MODEL_REJECTED.test(`${stderr}\n${errors.join("\n")}`)) result.reason = "model_rejected";
  else if (exitCode !== 0) result.reason = "nonzero_exit";
  else if (!last.trim()) result.reason = "empty_report";
  else if (result.reason) {} // schema failure set above
  else if (o.review && !result.evidence?.exitedReviewMode) result.reason = "review_not_finished";
  else if (obs?.model && obs.model !== model) result.reason = "model_mismatch";
  else if (obs?.sandbox && obs.sandbox !== o.sandbox) result.reason = "sandbox_mismatch";
  else if (obs?.effort && obs.effort !== effort) result.reason = "effort_mismatch";
  else result.ok = true;
  if (result.ok && !obs?.model) result.warnings = ["model, effort and sandbox unverified (ephemeral run or no rollout found)"];

  fs.writeFileSync(path.join(o.out, "result.json"), JSON.stringify(result, null, 2));
  fs.writeFileSync(path.join(o.out, "status.json"), JSON.stringify({ state: result.ok ? "done" : "failed", reason: result.reason }));
  const m = obs?.model ? `${obs.model}/${obs.effort}/${obs.sandbox}` : `${model}/${effort} (unverified)`;
  console.log(`[codex-run] ${result.ok ? "OK" : `FAILED: ${result.reason}`} ${m} ${result.durationSec}s exit=${exitCode} -> ${path.join(o.out, "result.json")}`);
  process.exitCode = result.ok ? 0 : 1;
}

main();
