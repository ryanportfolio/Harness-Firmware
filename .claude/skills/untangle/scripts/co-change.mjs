#!/usr/bin/env node
// List pairs of files that change in the same commits, as evidence for hidden links: two files
// that keep changing together are coupled, whether or not either one imports the other.
// Commits that touch more than --max-files files (formatting sweeps, renames, vendoring) are
// skipped because every pair inside them would look coupled. Merge commits are skipped. Lockfiles
// and paths matching --exclude are ignored. Read-only; zero dependencies.
//
// Usage: node co-change.mjs --repo <path> [--ref <rev>] [--max-commits <n>] [--max-files <n>]
//          [--min-together <n>] [--top <n>] [--exclude <regex>] [--out <file.json>]
//
// Output: a summary table on stdout; with --out, the full result as JSON. For each pair:
// `together` (commits touching both), each file's own change count, `share` (together divided
// by the smaller change count, so 1.0 means one file never changed without the other), and
// `crossDir` (true when the files sit under different top-level directories). The JSON also
// holds `fileChanges`: every file's change count in the commits used, for comparing how often
// an importer and the module it imports change.

import fs from "node:fs";
import { spawnSync } from "node:child_process";

const LOCKFILE = /(^|\/)(package-lock\.json|npm-shrinkwrap\.json|yarn\.lock|pnpm-lock\.yaml|bun\.lockb?|Cargo\.lock|poetry\.lock|uv\.lock|Pipfile\.lock|composer\.lock|Gemfile\.lock|go\.sum)$/;

function parseArgs(argv) {
  const o = { ref: "HEAD", maxCommits: 3000, maxFiles: 25, minTogether: 3, top: 60 };
  const num = (name, value) => {
    const n = Number(value);
    if (!Number.isInteger(n) || n < 1) throw new Error(`${name} must be a positive integer`);
    return n;
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--repo") o.repo = argv[++i];
    else if (a === "--ref") o.ref = argv[++i];
    else if (a === "--max-commits") o.maxCommits = num(a, argv[++i]);
    else if (a === "--max-files") o.maxFiles = num(a, argv[++i]);
    else if (a === "--min-together") o.minTogether = num(a, argv[++i]);
    else if (a === "--top") o.top = num(a, argv[++i]);
    else if (a === "--exclude") o.exclude = new RegExp(argv[++i]);
    else if (a === "--out") o.out = argv[++i];
    else throw new Error(`unknown argument ${a}`);
  }
  if (!o.repo) throw new Error("--repo is required");
  if (!o.ref || o.ref.startsWith("-")) throw new Error("--ref must be a revision");
  return o;
}

function readCommits(o) {
  const r = spawnSync(
    "git",
    ["-c", "core.quotepath=off", "-C", o.repo, "log", "--no-merges", "--no-renames", "--name-only",
      "--format=%x00%H", `--max-count=${o.maxCommits}`, o.ref, "--"],
    { encoding: "utf8", maxBuffer: 1024 * 1024 * 1024 },
  );
  if (r.error) throw r.error;
  if (r.status !== 0) throw new Error(`git log failed: ${r.stderr.trim()}`);
  const commits = [];
  for (const block of r.stdout.split("\0").slice(1)) {
    const lines = block.split("\n").map((l) => l.trim()).filter(Boolean);
    const sha = lines.shift();
    const files = [...new Set(lines)].filter((f) => !LOCKFILE.test(f) && !(o.exclude && o.exclude.test(f)));
    commits.push({ sha, files });
  }
  return commits;
}

const topDir = (f) => (f.includes("/") ? f.slice(0, f.indexOf("/")) : ".");

function main() {
  const o = parseArgs(process.argv.slice(2));
  const commits = readCommits(o);
  const changes = new Map();
  const pairs = new Map();
  let used = 0;
  let skippedLarge = 0;
  for (const { files } of commits) {
    if (files.length > o.maxFiles) { skippedLarge++; continue; }
    if (files.length === 0) continue;
    used++;
    for (const f of files) changes.set(f, (changes.get(f) || 0) + 1);
    const sorted = [...files].sort();
    for (let i = 0; i < sorted.length; i++) {
      for (let j = i + 1; j < sorted.length; j++) {
        const key = `${sorted[i]}\0${sorted[j]}`;
        pairs.set(key, (pairs.get(key) || 0) + 1);
      }
    }
  }
  const rows = [];
  for (const [key, together] of pairs) {
    if (together < o.minTogether) continue;
    const [a, b] = key.split("\0");
    const ca = changes.get(a);
    const cb = changes.get(b);
    rows.push({ a, b, together, changesA: ca, changesB: cb, share: Number((together / Math.min(ca, cb)).toFixed(2)), crossDir: topDir(a) !== topDir(b) });
  }
  rows.sort((x, y) => y.together - x.together || y.share - x.share || (x.a + x.b).localeCompare(y.a + y.b));
  const result = {
    repo: o.repo, ref: o.ref, commitsRead: commits.length, commitsUsed: used, commitsSkippedLarge: skippedLarge,
    maxFiles: o.maxFiles, minTogether: o.minTogether, pairCount: rows.length, pairs: rows,
    fileChanges: Object.fromEntries([...changes].sort((x, y) => y[1] - x[1] || x[0].localeCompare(y[0]))),
  };
  if (o.out) fs.writeFileSync(o.out, `${JSON.stringify(result, null, 2)}\n`);
  console.log(`commits read ${commits.length}, used ${used}, skipped as too large ${skippedLarge}; pairs with >= ${o.minTogether} shared commits: ${rows.length}`);
  console.log("together\tshare\tcrossDir\ta\tb");
  for (const r of rows.slice(0, o.top)) console.log(`${r.together}\t${r.share}\t${r.crossDir}\t${r.a}\t${r.b}`);
  if (rows.length > o.top) console.log(`... ${rows.length - o.top} more${o.out ? ` in ${o.out}` : "; pass --out for all"}`);
}

try { main(); } catch (e) { console.error(`co-change: ${e.message}`); process.exitCode = 1; }
