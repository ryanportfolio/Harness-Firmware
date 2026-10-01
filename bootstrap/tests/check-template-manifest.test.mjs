// Tests for check-template-manifest.mjs: a valid manifest passes, and each broken rule fails.
// Run: node --test bootstrap/tests/check-template-manifest.test.mjs

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { checkManifest, checkRepository } from "./check-template-manifest.mjs";

const SKILLS = ["alpha", "beta", "gamma"];
const FILES = [
  ".agents/template-manifest.json",
  ".agents/skills/alpha/SKILL.md",
  ".claude/skills/beta/SKILL.md",
  ".claude/skills/gamma/SKILL.md",
  "AGENTS.md",
  "README.md",
  "bootstrap/new.sh",
  "docs/notes.md",
];

function manifest() {
  return {
    version: 1,
    template: "owner/template",
    requiredFiles: [".agents/template-manifest.json", "AGENTS.md"],
    projectPaths: [".agents", ".claude", "AGENTS.md"],
    templateOnly: ["README.md", "bootstrap", "docs"],
    readmeStub: "# {name}\n",
    skills: {
      groups: [
        { id: "core", label: "Core", description: "Core skills", skills: ["alpha", "beta"] },
        { id: "extra", label: "Extra", description: "Extra skills", skills: ["gamma"] },
      ],
      required: ["alpha"],
      dependencies: { beta: ["alpha"] },
      presets: { minimal: { omit: ["gamma"] } },
    },
  };
}

function check(edit = () => {}, files = FILES) {
  const value = manifest();
  edit(value);
  return checkManifest(value, { files, skills: SKILLS, isFile: (file) => files.includes(file) });
}

test("a manifest that matches the repository passes", () => {
  assert.deepEqual(check(), []);
});

test("an unlisted repository file fails", () => {
  const errors = check(undefined, [...FILES, "scripts/tool.mjs"]);
  assert.ok(errors.some((error) => /scripts\/tool\.mjs: not covered/.test(error)), errors.join("\n"));
});

test("a listed path that does not exist fails", () => {
  const errors = check((value) => value.templateOnly.push("CHANGELOG.md"));
  assert.ok(errors.some((error) => /templateOnly: CHANGELOG\.md matches no file/.test(error)), errors.join("\n"));
  const removed = check(undefined, FILES.filter((file) => !file.startsWith("bootstrap/")));
  assert.ok(removed.some((error) => /templateOnly: bootstrap matches no file/.test(error)), removed.join("\n"));
});

test("overlapping or repeated entries fail", () => {
  const nested = check((value) => value.templateOnly.push(".agents/skills"));
  assert.ok(nested.some((error) => /\.agents and templateOnly \.agents\/skills overlap/.test(error)), nested.join("\n"));
  const repeated = check((value) => value.projectPaths.push("README.md"));
  assert.ok(repeated.some((error) => /README\.md is listed twice/.test(error)), repeated.join("\n"));
});

test("a skill folder missing from every group fails", () => {
  const errors = check((value) => { value.skills.groups[1].skills = []; });
  assert.ok(errors.some((error) => /skill folder gamma is in no group/.test(error)), errors.join("\n"));
  const twice = check((value) => value.skills.groups[1].skills.push("alpha"));
  assert.ok(twice.some((error) => /alpha is in more than one group/.test(error)), twice.join("\n"));
});

test("a group naming a folder that does not exist fails", () => {
  const errors = check((value) => value.skills.groups[0].skills.push("ghost"));
  assert.ok(errors.some((error) => /skills\.groups\[0\]\.skills: "ghost" is not a skill folder/.test(error)), errors.join("\n"));
});

test("an unknown skill name in required, dependencies or presets fails", () => {
  const required = check((value) => value.skills.required.push("ghost"));
  assert.ok(required.some((error) => /skills\.required: "ghost"/.test(error)), required.join("\n"));
  const dependent = check((value) => { value.skills.dependencies.ghost = ["alpha"]; });
  assert.ok(dependent.some((error) => /skills\.dependencies: "ghost"/.test(error)), dependent.join("\n"));
  const needed = check((value) => { value.skills.dependencies.beta = ["ghost"]; });
  assert.ok(needed.some((error) => /skills\.dependencies\.beta: "ghost"/.test(error)), needed.join("\n"));
  const preset = check((value) => value.skills.presets.minimal.omit.push("ghost"));
  assert.ok(preset.some((error) => /skills\.presets\.minimal\.omit: "ghost"/.test(error)), preset.join("\n"));
});

test("a required file that is missing or template-only fails", () => {
  const missing = check((value) => value.requiredFiles.push(".claude/scripts/gone.mjs"));
  assert.ok(missing.some((error) => /requiredFiles: \.claude\/scripts\/gone\.mjs does not exist/.test(error)), missing.join("\n"));
  const stripped = check((value) => value.requiredFiles.push("README.md"));
  assert.ok(stripped.some((error) => /requiredFiles: README\.md is under templateOnly/.test(error)), stripped.join("\n"));
});

test("malformed path entries fail", () => {
  for (const entry of ["docs/", "/docs", "docs/*.md", "docs\\notes.md", "./docs"]) {
    const errors = check((value) => { value.templateOnly[2] = entry; });
    assert.ok(errors.some((error) => error.includes("is not a repo-relative path")), `${entry}: ${errors.join("\n")}`);
  }
});

test("the repository check sees added and deleted files before they are committed", (t) => {
  const git = spawnSync("git", ["--version"]);
  if (git.status !== 0) return t.skip("git is not available");
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "template-manifest-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const write = (relative, content = "x\n") => {
    fs.mkdirSync(path.dirname(path.join(root, relative)), { recursive: true });
    fs.writeFileSync(path.join(root, relative), content);
  };
  for (const file of FILES) write(file);
  write(".agents/template-manifest.json", JSON.stringify(manifest()));
  const run = (...args) => assert.equal(spawnSync("git", ["-C", root, ...args]).status, 0, args.join(" "));
  run("init", "-q");
  run("add", "-A");
  assert.deepEqual(checkRepository(root), []);

  write("unlisted.txt");
  assert.ok(checkRepository(root).some((error) => /unlisted\.txt: not covered/.test(error)));
  fs.rmSync(path.join(root, "unlisted.txt"));

  fs.rmSync(path.join(root, "bootstrap"), { recursive: true });
  assert.ok(checkRepository(root).some((error) => /templateOnly: bootstrap matches no file/.test(error)));
});
