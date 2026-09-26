import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

const script = fileURLToPath(new URL("./memory-audit.mjs", import.meta.url));
const munge = (p) => path.resolve(p).replace(/[^A-Za-z0-9]/g, "-");
const JSON_KEYS = [
  "reference", "referenceDirScans", "memory", "skills", "sessionsWrote", "sessionsRead",
  "transcriptFiles", "dirs", "staleEntries", "staleRetired", "neverRead", "neverInvoked",
];

function tempDir(t, prefix) {
  const dir = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), prefix)));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
}

function write(file, content) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}

// One assistant line per tool call, in the transcript's JSONL shape.
const toolLine = (name, input, timestamp = "2026-09-01T00:00:00.000Z") =>
  JSON.stringify({ timestamp, message: { content: [{ type: "tool_use", name, input }] } });

// Strip inherited GIT_* so a hook or outer repo cannot steer the child's git.
function childEnv(home, ceiling) {
  const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith("GIT_")));
  return { ...env, HOME: home, USERPROFILE: home, GIT_CEILING_DIRECTORIES: ceiling, GIT_CONFIG_NOSYSTEM: "1" };
}

function audit(cwd, args, env = process.env) {
  const run = spawnSync(process.execPath, [script, "--json", ...args], { cwd, env, encoding: "utf8" });
  assert.equal(run.status, 0, run.stderr);
  return JSON.parse(run.stdout);
}

test("reads recorded only in subagent files are counted; top-level counts unchanged", (t) => {
  const root = tempDir(t, "memory-audit-root-");
  const projectDir = tempDir(t, "memory-audit-project-");
  const ref = (name) => path.join(root, ".claude", "reference", name);
  write(ref("alpha.md"), "# alpha\n");
  write(ref("beta.md"), "# beta\n");
  write(path.join(root, ".claude", "skills", "demo", "SKILL.md"), "---\nname: demo\n---\n");

  write(path.join(projectDir, "sess-1.jsonl"), [
    toolLine("Read", { file_path: ref("alpha.md") }),
    toolLine("Grep", { path: ref("alpha.md"), pattern: "x" }),
    "not json {",
  ].join("\n"));
  const before = audit(root, ["--project-dir", projectDir]);
  assert.deepEqual(Object.keys(before), JSON_KEYS);
  assert.equal(before.reference["alpha.md"].reads, 2);
  assert.equal(before.reference["beta.md"].reads, 0);
  assert.equal(before.skills.demo, 0);
  assert.equal(before.transcriptFiles, 1);
  assert.equal(before.sessionsRead, 1);

  const subagents = path.join(projectDir, "sess-1", "subagents");
  write(path.join(subagents, "agent-a1.jsonl"), [
    toolLine("Read", { file_path: ref("beta.md") }, "2026-09-02T00:00:00.000Z"),
    toolLine("Skill", { skill: "demo" }),
  ].join("\n"));
  write(path.join(subagents, "agent-a1.meta.json"), toolLine("Read", { file_path: ref("beta.md") }));
  write(path.join(subagents, "workflows", "wf_1", "agent-a2.jsonl"), toolLine("Read", { file_path: ref("beta.md") }));
  // A session whose top-level file has rotated away still counts on its own.
  write(path.join(projectDir, "sess-2", "subagents", "agent-a3.jsonl"), toolLine("Write", { file_path: ref("beta.md") }));
  const after = audit(root, ["--project-dir", projectDir]);
  assert.deepEqual(Object.keys(after), JSON_KEYS);
  assert.deepEqual(after.reference["alpha.md"], before.reference["alpha.md"]);
  assert.deepEqual(after.reference["beta.md"], { writes: 1, reads: 2, lastRead: "2026-09-02T00:00:00.000Z" });
  assert.equal(after.skills.demo, 1);
  assert.equal(after.transcriptFiles, 4);
  assert.equal(after.sessionsRead, 1, "a subagent read marks its parent session, not a new one");
  assert.equal(after.sessionsWrote, 1);
  assert.deepEqual(after.neverRead, []);
});

test("dirs come from the main checkout, so a worktree run sees every worktree", (t) => {
  if (spawnSync("git", ["--version"]).status !== 0) return t.skip("git not available");
  const base = tempDir(t, "memory-audit-git-");
  const home = path.join(base, "home");
  const main = path.join(base, "repo");
  const worktree = path.join(main, ".claude", "worktrees", "w1");
  const env = childEnv(home, base);
  const git = (cwd, ...args) => {
    const run = spawnSync("git", ["-c", "user.name=t", "-c", "user.email=t@t", "-c", "commit.gpgsign=false", ...args], { cwd, env, encoding: "utf8" });
    assert.equal(run.status, 0, run.stderr);
  };
  fs.mkdirSync(main, { recursive: true });
  git(main, "init", "-q");
  git(main, "commit", "-q", "--allow-empty", "--no-verify", "-m", "init");
  git(main, "worktree", "add", "-q", worktree);

  const projects = path.join(home, ".claude", "projects");
  const expected = [munge(main), `${munge(main)}--claude-worktrees-w1`, `${munge(main)}--claude-worktrees-other`];
  for (const name of [...expected, `${munge(main)}-api`]) fs.mkdirSync(path.join(projects, name), { recursive: true });
  const names = (out) => out.dirs.map((d) => path.basename(d)).sort();

  assert.deepEqual(names(audit(worktree, [], env)), [...expected].sort());
  assert.deepEqual(names(audit(main, [], env)), [...expected].sort());

  // Outside any repo the cwd is the key, as before.
  const plain = path.join(base, "plain");
  fs.mkdirSync(plain);
  fs.mkdirSync(path.join(projects, munge(plain)));
  assert.deepEqual(names(audit(plain, [], env)), [munge(plain)]);
});
