#!/usr/bin/env node
// Baseline manifest for long-horizon rounds. Node only, no dependencies.
//
//   node manifest.mjs <workspace root> <out.json> [--ref <ref>] [path ...]
//     sha256 of every tracked file with uncommitted changes, every untracked file, and every
//     file under each extra path (Write scope, ignored generated artifacts, paths outside the
//     root). Records deleted paths, HEAD and a `git stash create` snapshot; --ref pins the
//     snapshot with `git update-ref` so gc cannot prune it.
//
//   node manifest.mjs --diff <baseline.json> [<current.json>]
//     Rebuilds the manifest now over the baseline's coverage plus every path changed since its
//     snapshot (commits included), optionally saves it, and prints added, modified, deleted.
//
// Links and junctions are recorded by target and never followed. Nested node_modules and .git
// folders are skipped unless passed as an extra path themselves.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const DELETED = "DELETED";
const slash = (p) => p.replaceAll("\\", "/");

function git(root, args) {
  try {
    return execFileSync("git", ["-C", root, ...args], { encoding: "utf8", maxBuffer: 1 << 28, stdio: ["ignore", "pipe", "ignore"] });
  } catch {
    return null;
  }
}

const keyOf = (root, abs) => {
  const rel = path.relative(root, abs);
  return rel.startsWith("..") || path.isAbsolute(rel) ? slash(abs) : slash(rel);
};
const absOf = (root, key) => (path.isAbsolute(key) ? key : path.resolve(root, key));

function walk(root, abs, files) {
  let st;
  try {
    st = fs.lstatSync(abs);
  } catch {
    files[keyOf(root, abs)] = DELETED;
    return;
  }
  if (st.isSymbolicLink()) files[keyOf(root, abs)] = `link:${slash(fs.readlinkSync(abs))}`;
  else if (st.isFile()) files[keyOf(root, abs)] = createHash("sha256").update(fs.readFileSync(abs)).digest("hex");
  else if (st.isDirectory()) {
    for (const e of fs.readdirSync(abs)) {
      if (e === ".git" || e === "node_modules") continue;
      walk(root, path.join(abs, e), files);
    }
  }
}

// Paths `git status` reports; a rename or copy contributes both its new and its old path.
function statusPaths(root) {
  const out = git(root, ["status", "--porcelain=v1", "-z", "--untracked-files=all"]);
  if (out === null) return null;
  const tokens = out.split("\0").filter(Boolean);
  const paths = [];
  for (let i = 0; i < tokens.length; i++) {
    paths.push(tokens[i].slice(3));
    if (/[RC]/.test(tokens[i].slice(0, 2))) paths.push(tokens[++i]);
  }
  return paths;
}

function build(rootArg, out, { ref = null, extras = [], cover = [] } = {}) {
  const root = path.resolve(rootArg);
  const files = {};
  const uncovered = [];
  const status = statusPaths(root);
  if (status === null) {
    uncovered.push("not a git workspace: whole root walked, no snapshot");
    walk(root, root, files);
  } else {
    for (const p of status) walk(root, path.resolve(root, p), files);
  }
  for (const x of extras) walk(root, path.resolve(root, x), files);
  for (const k of cover) walk(root, absOf(root, k), files);
  if (out) delete files[keyOf(root, path.resolve(out))];
  const head = status === null ? null : (git(root, ["rev-parse", "--verify", "--quiet", "HEAD"]) ?? "").trim() || null;
  let snapshot = head;
  if (status !== null) {
    const stash = (git(root, ["-c", "user.name=long-horizon", "-c", "user.email=long-horizon@localhost", "stash", "create"]) ?? "").trim();
    snapshot = stash || head;
    if (ref && snapshot && git(root, ["update-ref", ref, snapshot]) === null) throw new Error(`git update-ref ${ref} failed`);
    if (!snapshot) uncovered.push("no commit yet: no snapshot");
  }
  const manifest = { root: slash(root), head, snapshot, ref, taken: new Date().toISOString(), extras, uncovered, files };
  if (out) fs.writeFileSync(out, JSON.stringify(manifest, null, 1));
  return manifest;
}

function diff(baselineFile, out) {
  const base = JSON.parse(fs.readFileSync(baselineFile, "utf8"));
  const root = base.root;
  const since = base.snapshot ? (git(root, ["diff", "--name-only", "-z", base.snapshot]) ?? "").split("\0").filter(Boolean) : [];
  const cur = build(root, out, { extras: base.extras, cover: [...Object.keys(base.files), ...since] });
  const result = { added: [], modified: [], deleted: [] };
  for (const k of new Set([...Object.keys(base.files), ...Object.keys(cur.files)])) {
    const now = cur.files[k] ?? DELETED;
    let was = base.files[k];
    if (was === undefined) {
      // Not covered at baseline: the path was either clean in the snapshot or absent.
      const blob = base.snapshot && !path.isAbsolute(k) ? (git(root, ["rev-parse", "--verify", "--quiet", `${base.snapshot}:${k}`]) ?? "").trim() : "";
      if (!blob) was = DELETED;
      else if (now === DELETED || now.startsWith("link:")) was = "tracked";
      else was = (git(root, ["hash-object", "--", k]) ?? "").trim() === blob ? now : "tracked";
    }
    if (was === now) continue;
    if (was === DELETED) result.added.push(k);
    else if (now === DELETED) result.deleted.push(k);
    else result.modified.push(k);
  }
  for (const list of Object.values(result)) list.sort();
  return { baseline: slash(path.resolve(baselineFile)), root, headAtBaseline: base.head, headNow: cur.head, uncovered: cur.uncovered, ...result };
}

const argv = process.argv.slice(2);
const usage = "usage: node manifest.mjs <root> <out.json> [--ref <ref>] [path ...]\n       node manifest.mjs --diff <baseline.json> [<current.json>]";
if (argv[0] === "--diff" && argv[1]) {
  console.log(JSON.stringify(diff(argv[1], argv[2] ?? null), null, 1));
} else if (argv.length >= 2 && !argv[0].startsWith("--")) {
  const [root, out, ...rest] = argv;
  const i = rest.indexOf("--ref");
  const ref = i >= 0 ? rest[i + 1] : null;
  if (i >= 0 && !ref) {
    console.error(usage);
    process.exit(2);
  }
  const extras = i >= 0 ? rest.filter((_, j) => j !== i && j !== i + 1) : rest;
  const m = build(root, out, { ref, extras });
  console.log(`files ${Object.keys(m.files).length}, snapshot ${m.snapshot ?? "none"}${m.uncovered.length ? `, uncovered: ${m.uncovered.join("; ")}` : ""}`);
} else {
  console.error(usage);
  process.exit(2);
}
