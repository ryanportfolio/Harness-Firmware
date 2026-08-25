#!/usr/bin/env node

// memory-audit.mjs: read-side accounting for the harness's durable knowledge.
//
// A reference entry, memory file, or skill earns its keep when sessions read
// or invoke it. This script scans the local Claude Code session transcripts
// (~/.claude/projects/<munged-cwd>/*.jsonl) and reports, per target, how often
// it was written versus read, plus pruning candidates: never-read files,
// dated reference entries older than six months, and never-invoked skills.
//
// Counts are FLOOR estimates: transcripts rotate and compact, reads made
// through the Bash tool (cat/grep) are not attributed, and everything is
// per-machine. Advisory only — a low count is a prompt to check, not a
// verdict. The /refine skill runs this in its tooling lens.
//
// Usage: node .claude/scripts/memory-audit.mjs [--json] [--project-dir <path>]
//   --project-dir  scan this transcript directory instead of deriving it from
//                  the working directory (testing, or auditing another repo's
//                  history from here).
//
// Exit 0 always (2 on bad usage). Requires Node >= 18, no dependencies.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";

const argv = process.argv.slice(2);
let jsonMode = false;
let projectDirOverride = null;
for (let i = 0; i < argv.length; i += 1) {
  if (argv[i] === "--json") jsonMode = true;
  else if (argv[i] === "--project-dir" && argv[i + 1]) {
    projectDirOverride = argv[i + 1];
    i += 1;
  } else {
    console.error("Usage: node .claude/scripts/memory-audit.mjs [--json] [--project-dir <path>]");
    process.exit(2);
  }
}

const root = process.cwd();
const projectsRoot = path.join(os.homedir(), ".claude", "projects");
const munge = (p) => path.resolve(p).replace(/[^A-Za-z0-9]/g, "-");

// The exact dir for this checkout, plus prefixed siblings: worktrees under the
// repo munge to "<repo>--claude-worktrees-<name>" and hold their own history.
function transcriptDirs() {
  if (projectDirOverride) return fs.existsSync(projectDirOverride) ? [projectDirOverride] : [];
  if (!fs.existsSync(projectsRoot)) return [];
  const prefix = munge(root);
  return fs
    .readdirSync(projectsRoot)
    .filter((name) => name === prefix || name.startsWith(`${prefix}-`))
    .map((name) => path.join(projectsRoot, name));
}

const normalize = (p) => String(p).replaceAll("\\", "/").toLowerCase();

const referenceDir = path.join(root, ".claude", "reference");
const referenceFiles = fs.existsSync(referenceDir)
  ? fs.readdirSync(referenceDir).filter((f) => f.endsWith(".md"))
  : [];

const skillsDir = path.join(root, ".claude", "skills");
const skillNames = fs.existsSync(skillsDir)
  ? fs.readdirSync(skillsDir).filter((d) => fs.existsSync(path.join(skillsDir, d, "SKILL.md")))
  : [];

const stats = {
  reference: Object.fromEntries(
    referenceFiles.map((f) => [f, { writes: 0, reads: 0, lastRead: null }]),
  ),
  referenceDirScans: 0,
  memory: {}, // basename -> {writes, reads}
  skills: Object.fromEntries(skillNames.map((s) => [s, 0])),
  sessionsWrote: 0,
  sessionsRead: 0,
  transcriptFiles: 0,
  dirs: [],
};

const READ_TOOLS = new Set(["Read", "Grep", "Glob"]);
const WRITE_TOOLS = new Set(["Edit", "Write", "NotebookEdit"]);

function classify(name, input, session, timestamp) {
  const target = input?.file_path ?? input?.path ?? input?.notebook_path ?? "";
  const norm = normalize(target);

  if (name === "Skill" && input?.skill) {
    const skill = String(input.skill).split(":").pop();
    if (skill in stats.skills) stats.skills[skill] += 1;
    return;
  }

  const isRead = READ_TOOLS.has(name);
  const isWrite = WRITE_TOOLS.has(name);
  if (!isRead && !isWrite) return;

  if (norm.includes("/.claude/reference/")) {
    const base = norm.slice(norm.lastIndexOf("/") + 1);
    const key = referenceFiles.find((f) => f.toLowerCase() === base);
    if (key) {
      if (isWrite) {
        stats.reference[key].writes += 1;
        session.wrote = true;
      } else {
        stats.reference[key].reads += 1;
        session.read = true;
        if (timestamp) stats.reference[key].lastRead = timestamp.slice(0, 10);
      }
    } else if (isRead) {
      // Grep/Glob over the whole directory: a read, but not attributable.
      stats.referenceDirScans += 1;
      session.read = true;
    }
    return;
  }

  // Legacy per-machine auto-memory store: ~/.claude/projects/<dir>/memory/.
  if (norm.includes("/.claude/projects/") && (norm.includes("/memory/") || norm.endsWith("/memory.md"))) {
    const base = norm.slice(norm.lastIndexOf("/") + 1);
    const entry = (stats.memory[base] ??= { writes: 0, reads: 0 });
    if (isWrite) {
      entry.writes += 1;
      session.wrote = true;
    } else {
      entry.reads += 1;
      session.read = true;
    }
  }
}

for (const dir of transcriptDirs()) {
  stats.dirs.push(dir);
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".jsonl"));
  for (const file of files) {
    stats.transcriptFiles += 1;
    const session = { wrote: false, read: false };
    for (const line of fs.readFileSync(path.join(dir, file), "utf8").split("\n")) {
      if (!line.includes('"tool_use"')) continue;
      let obj;
      try {
        obj = JSON.parse(line);
      } catch {
        continue;
      }
      const content = obj?.message?.content;
      if (!Array.isArray(content)) continue;
      for (const block of content) {
        if (block?.type === "tool_use" && block.name) {
          classify(block.name, block.input, session, obj.timestamp ?? null);
        }
      }
    }
    if (session.wrote) stats.sessionsWrote += 1;
    if (session.read) stats.sessionsRead += 1;
  }
}

// Stale dated entries: recall appends "### YYYY-MM-DD: <title>" headers.
const SIX_MONTHS_MS = 183 * 24 * 60 * 60 * 1000;
const staleEntries = [];
for (const file of referenceFiles) {
  const text = fs.readFileSync(path.join(referenceDir, file), "utf8");
  for (const match of text.matchAll(/^###\s+(\d{4}-\d{2}-\d{2}):?\s*(.*)$/gm)) {
    const age = Date.now() - Date.parse(match[1]);
    if (Number.isFinite(age) && age > SIX_MONTHS_MS) {
      staleEntries.push({ file, date: match[1], title: match[2].trim() });
    }
  }
}

const hasHistory = stats.transcriptFiles > 0;
const neverRead = hasHistory
  ? referenceFiles.filter((f) => stats.reference[f].reads === 0)
  : [];
const neverInvoked = hasHistory ? skillNames.filter((s) => stats.skills[s] === 0) : [];
const memoryFiles = Object.keys(stats.memory);
const memoryNeverRead = memoryFiles.filter((f) => stats.memory[f].reads === 0);

if (jsonMode) {
  console.log(JSON.stringify({ ...stats, staleEntries, neverRead, neverInvoked }, null, 2));
  process.exit(0);
}

console.log(
  `memory-audit: ${stats.transcriptFiles} transcript file(s) in ${stats.dirs.length} project dir(s)`,
);
console.log(
  "counts are floor estimates: rotated history and Bash-tool reads (cat/grep) are not attributed\n",
);

if (!hasHistory) {
  console.log("no transcripts found for this checkout — nothing to audit on this machine.");
  process.exit(0);
}

const pad = (s, n) => String(s).padEnd(n);
console.log(pad("reference file", 36) + pad("writes", 8) + pad("reads", 7) + "last read");
for (const f of referenceFiles) {
  const r = stats.reference[f];
  console.log(pad(f, 36) + pad(r.writes, 8) + pad(r.reads, 7) + (r.lastRead ?? "-"));
}
if (stats.referenceDirScans > 0) {
  console.log(`(+${stats.referenceDirScans} directory-level scans, not attributed per file)`);
}
console.log(
  `sessions touching reference or memory: wrote ${stats.sessionsWrote}, read ${stats.sessionsRead}`,
);

if (neverRead.length > 0) {
  console.log(`\nnever read: ${neverRead.join(", ")} — pruning candidates; check before cutting.`);
}
if (staleEntries.length > 0) {
  console.log("\ndated entries older than 6 months (moment or standing truth?):");
  for (const e of staleEntries) console.log(`  ${e.file}  ${e.date}  ${e.title}`);
}
if (memoryFiles.length > 0) {
  console.log(
    `\nlegacy auto-memory store: ${memoryFiles.length} file(s) touched, ${memoryNeverRead.length} never read.`,
  );
  console.log("archive candidates: migrate keepers to .claude/reference/, delete the rest.");
}
if (neverInvoked.length > 0) {
  console.log(`\nskills never invoked on this machine: ${neverInvoked.join(", ")}`);
  console.log("(description-matched auto-invocations count too, so zero means zero here)");
}
