import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { compareCopies } from "./check-codex-skill-copies.mjs";

test("copy check detects resource drift and preserves personal content", (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "skill-copies-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const source = path.join(root, "source");
  const target = path.join(root, "target");
  for (const base of [source, target]) {
    fs.mkdirSync(path.join(base, "writing/references"), { recursive: true });
    fs.writeFileSync(path.join(base, "writing/SKILL.md"), "same");
    fs.writeFileSync(path.join(base, "writing/references/style.md"), "same");
  }
  assert.deepEqual(compareCopies(source, target, ["writing"])[0].differences, []);
  fs.writeFileSync(path.join(target, "writing/SKILL.md"), "custom");
  fs.unlinkSync(path.join(target, "writing/references/style.md"));
  fs.writeFileSync(path.join(target, "writing/personal.md"), "preserve");
  assert.deepEqual(compareCopies(source, target, ["writing"])[0].differences.sort(), ["changed: SKILL.md", "missing: references/style.md", "personal-only: personal.md"]);
  assert.equal(fs.readFileSync(path.join(target, "writing/personal.md"), "utf8"), "preserve");
  assert.deepEqual(compareCopies(source, target, ["not-installed"]), []);
  assert.throws(() => compareCopies(source, target, ["../escape"]), /Invalid skill name/);
});
