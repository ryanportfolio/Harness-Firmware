import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { collectFacts, expectedCodexNames } from "./facts.mjs";
import { absolute, listPhrase, plural, read } from "./lib.mjs";

// These tests check the generator, not the committed files: README drift is only a warning
// (see verify.mjs). Every artifact below comes from a fresh build in a scratch directory.
const facts = collectFacts();
const panelNames = ["boot", "feedback", "runtime", "skills"];
const variants = ["light", "dark", "narrow-light", "narrow-dark"];
const out = fs.mkdtempSync(path.join(os.tmpdir(), "readme-test-"));
process.on("exit", () => fs.rmSync(out, { recursive: true, force: true }));
const build = spawnSync(process.execPath, [absolute("scripts/readme/build.mjs")], { env: { ...process.env, README_OUT_DIR: out }, encoding: "utf8" });
const built = (relativePath) => fs.readFileSync(path.join(out, relativePath), "utf8");
const groupCounts = facts.groups.filter((group) => facts.tierCounts[group.id] > 0).map((group) => `${facts.tierCounts[group.id]} ${group.id}`);
const requiredLinks = ["GUIDE.md", "CONTRIBUTING.md", "CHANGELOG.md", "LICENSE", "actions/workflows/validate-template.yml"];

test("the generator builds every README artifact", () => {
  assert.equal(build.status, 0, build.stderr);
});

test("README facts match the installed skills", () => {
  assert.equal(facts.skillCount, facts.skills.length);
  assert.deepEqual(facts.inventoryNames, facts.skills.map((skill) => skill.name).sort());
  assert.deepEqual(facts.removed, facts.templateNames.filter((name) => !fs.existsSync(absolute(`.claude/skills/${name}/SKILL.md`))));
  for (const [group, count] of Object.entries(facts.tierCounts)) {
    assert.equal(count, facts.skills.filter((skill) => skill.group === group).length, group);
  }
  assert.equal(facts.codexNativeCount + facts.codexAdapterCount, facts.codexSkillCount);
  assert.ok(Number.isInteger(facts.referenceFileCount) && facts.referenceFileCount >= 0);
  assert.deepEqual(facts.runtimeNames, ["Claude Code", "Codex"]);
  assert.equal(facts.runtimeCount, facts.runtimeNames.length);
  assert.ok(Array.isArray(facts.warnings));
});

test("all panels ship four accessible local-only variants", () => {
  for (const name of panelNames) {
    for (const variant of variants) {
      const relativePath = `assets/readme/${name}-${variant}.svg`;
      assert.ok(fs.existsSync(path.join(out, relativePath)), `${relativePath} should exist`);
      const source = built(relativePath);
      assert.match(source, /role="img"/);
      assert.match(source, /aria-label="[^"]+"/);
      assert.match(source, /<title>[^<]+<\/title>/);
      assert.match(source, /prefers-reduced-motion:reduce/);
      assert.doesNotMatch(source, /<script\b/i);
      assert.doesNotMatch(source, /\b(?:href|src)=["']https?:/i);
    }
  }
});

test("narrow SVG typography stays above 12 rendered pixels at 390 CSS pixels", () => {
  for (const name of panelNames) {
    const source = built(`assets/readme/${name}-narrow-light.svg`);
    for (const className of ["eyebrow", "label", "copy", "small"]) {
      assert.match(source, new RegExp(`\\.${className}\\{font-size:(?:1[4-9]|[2-9][0-9])px`), `${name}: ${className}`);
    }
  }
});

test("feedback circuit separates local learning from human-gated propagation", () => {
  for (const variant of variants) {
    const source = built(`assets/readme/feedback-${variant}.svg`);
    for (const label of ["RECALL", "WORK", "VERIFY", "REFINE", "REVIEWED CHANGE", "NEXT TASK", "HUMAN REVIEW", "FUTURE REPOS"]) {
      assert.equal((source.match(new RegExp(`>${label}<`, "g")) ?? []).length, 1, `${variant}: ${label}`);
    }
    assert.match(source, />EVIDENCE</);
    assert.match(source, /KEEP LOCAL/);
    assert.ok((source.match(/marker-end="url\(#arrow\)"/g) ?? []).length >= 8, `${variant}: directional arrows`);
    assert.ok((source.match(/class="wire dash" marker-end="url\(#arrow\)"/g) ?? []).length >= 2, `${variant}: optional arrows`);
    assert.doesNotMatch(source, /wire active dash|arrow-active/);
    assert.match(source, /\.feedback-pulse,.scan-bar,.boot-cursor,.runtime-packet\{display:none!important\}/);
  }
});

test("skill scan bar uses no rounded corner", () => {
  for (const variant of variants) {
    const source = built(`assets/readme/skills-${variant}.svg`);
    const scan = source.match(/<g class="scan-bar"[\s\S]*?<\/g>/)?.[0] ?? "";
    assert.ok(scan);
    assert.doesNotMatch(scan, /\brx=/);
  }
});

test("boot trace contains every row and one sequenced cursor", () => {
  for (const variant of variants) {
    const source = built(`assets/readme/boot-${variant}.svg`);
    for (const label of ["RULE KERNEL", "SKILL INDEX", "PROJECT MEMORY", "RUNTIME BOUNDARY", "VALIDATION"]) {
      assert.equal((source.match(new RegExp(`>${label}<`, "g")) ?? []).length, 1, `${variant}: ${label}`);
    }
    assert.equal((source.match(/class="signal boot-cursor"/g) ?? []).length, 1);
    assert.match(source, /animation:bootCursor 12s/);
    assert.match(source, /\.boot-ready\{opacity:1!important\}/);
  }
});

test("skill memory map draws every skill within its narrow canvas", () => {
  for (const variant of variants) {
    const source = built(`assets/readme/skills-${variant}.svg`);
    assert.equal((source.match(/data-skill="/g) ?? []).length, facts.skillCount);
    for (const skill of facts.inventoryNames) {
      assert.equal((source.match(new RegExp(`data-skill="${skill}"`, "g")) ?? []).length, 1, `${variant}: ${skill}`);
    }
    const drawn = [...source.matchAll(/data-group-count="(\d+)"/g)].map((match) => Number(match[1]));
    assert.deepEqual(drawn, Object.values(facts.tierCounts).filter((count) => count > 0));
    const label = `A memory map of ${plural(facts.skillCount, "on-demand workflow")} grouped into ${listPhrase(groupCounts)} ${facts.skillCount === 1 ? "skill" : "skills"}.`;
    assert.ok(source.includes(`aria-label="${label}"`), `${variant}: memory map label`);
    if (variant.startsWith("narrow")) {
      const height = Number(source.match(/viewBox="0 0 390 (\d+)"/)?.[1]);
      const bottoms = [...source.matchAll(/data-bottom="(\d+)"/g)].map((match) => Number(match[1]));
      const footer = Number(source.match(/y="(\d+)">COUNTS VERIFIED/)?.[1]);
      assert.ok(Math.max(...bottoms) < footer - 12, `${variant}: cells clear footer`);
      assert.ok(footer + 32 < height, `${variant}: footer stays inside canvas`);
    }
  }
});

test("boot and runtime panels use measured counts", () => {
  for (const variant of variants) {
    const boot = built(`assets/readme/boot-${variant}.svg`);
    const runtime = built(`assets/readme/runtime-${variant}.svg`);
    assert.ok(boot.includes(`${plural(facts.skillCount, "workflow")} ready`));
    assert.ok(boot.includes(`${plural(facts.referenceFileCount, "file")} mounted`));
    assert.ok(boot.includes(`${plural(facts.runtimeCount, "target")} declared`));
    assert.ok(runtime.includes(plural(facts.skillCount, "canonical workflow")));
    assert.ok(runtime.includes(plural(facts.codexSkillCount, "skill")));
  }
});

test("generated README keeps installation early and maps exact picture variants", () => {
  const readme = built("README.md");
  assert.ok(readme.startsWith("<!-- generated by scripts/readme/build.mjs. do not edit by hand. -->"));
  assert.equal(readme.includes("<!-- removed skills: "), facts.removed.length > 0);
  assert.ok(readme.indexOf("/plugin marketplace add") < readme.indexOf("GUIDE.md"));
  assert.ok(readme.indexOf("/plugin marketplace add") < readme.indexOf("## the repository feedback loop"));
  assert.ok(readme.includes(plural(facts.codexNativeCount, "native Codex workflow")));
  assert.equal((readme.match(/<picture>/g) ?? []).length, panelNames.length);
  assert.ok(readme.includes(`## ${plural(facts.skillCount, "workflow")}, loaded when called`));
  assert.ok(readme.includes(`**${groupCounts.join(" · ")}**`));
  assert.match(readme, /recall → work → verify → refine → reviewed repository change → next task/);
  assert.match(readme, /Success means the doctor reports no failures/);
  assert.ok(readme.indexOf("[Install the skills or start a repository](#quickstart)") < readme.indexOf("## the repository feedback loop"));
  assert.match(readme, /<summary><strong>Click to open the generated skill memory map<\/strong><\/summary>/);
  assert.ok(readme.includes(`<summary><strong>Click to browse ${facts.skillCount === 1 ? "the only skill" : `all ${facts.skillCount} skills`}</strong></summary>`));
  for (const link of requiredLinks) assert.ok(readme.includes(link), `README links ${link}`);

  for (const name of panelNames) {
    const expected = `<picture>\n<source media="(max-width: 500px) and (prefers-color-scheme: dark)" srcset="assets/readme/${name}-narrow-dark.svg">\n<source media="(max-width: 500px)" srcset="assets/readme/${name}-narrow-light.svg">\n<source media="(prefers-color-scheme: dark)" srcset="assets/readme/${name}-dark.svg">\n<img`;
    assert.ok(readme.includes(expected), `${name}: exact source order`);
    assert.match(readme, new RegExp(`src="assets/readme/${name}-light\\.svg"`));
  }

  for (const match of readme.matchAll(/(?:src|srcset)="(assets\/readme\/[^"]+)"/g)) {
    assert.ok(fs.existsSync(path.join(out, match[1])), `${match[1]} should exist`);
  }

  const list = readme.match(/<!-- skill-list:start -->([\s\S]+)<!-- skill-list:end -->/)?.[1] ?? "";
  assert.ok(list);
  assert.equal((list.match(/^- \[`/gm) ?? []).length, facts.skillCount);
  for (const skill of facts.inventoryNames) {
    assert.equal((list.match(new RegExp(`\\[\\\`${skill}\\\`\\]`, "g")) ?? []).length, 1, skill);
  }
});

test("generated README follows the writing contract", (t) => {
  const source = built("README.md");
  // Skill descriptions are project content; an em dash there is reported, not failed.
  if (/—/u.test(source)) t.diagnostic("warning: the generated README contains an em dash, usually from a skill description");
  if (/^#{1,6} .+\.$/mu.test(source)) t.diagnostic("warning: the generated README has a heading with a trailing period");
  assert.doesNotMatch(source, /repo-resident operating layer|The repository learns|hot path/i);
});

test("GUIDE.md style problems are reported, not failed", (t) => {
  if (!fs.existsSync(absolute("GUIDE.md"))) return;
  const source = read("GUIDE.md");
  if (/—/u.test(source)) t.diagnostic("warning: GUIDE.md contains an em dash");
  if (/^#{1,6} .+\.$/mu.test(source)) t.diagnostic("warning: GUIDE.md has a heading with a trailing period");
});

test("counts read naturally at one and omit empty groups", () => {
  assert.equal(plural(1, "workflow"), "1 workflow");
  assert.equal(plural(2, "workflow"), "2 workflows");
  assert.equal(plural(1, "runtime boundary", "runtime boundaries"), "1 runtime boundary");
  assert.equal(listPhrase(["1 core"]), "1 core");
  assert.equal(listPhrase(["1 core", "2 specialist"]), "1 core and 2 specialist");
  assert.equal(listPhrase(["7 core", "13 discipline", "14 specialist"]), "7 core, 13 discipline, and 14 specialist");
});

test("Codex inventory honors native additions and both disabled sources", () => {
  const names = ['adapter', 'native', 'disabled', 'legacy'];
  assert.deepEqual(expectedCodexNames(names, {native: 'native', extra: 'native', disabled: 'disabled', legacy: 'native'}, {legacy: 'off'}), ['adapter', 'extra', 'native']);
  assert.deepEqual(expectedCodexNames(['old', 'ordinary']), ['old', 'ordinary']);
});

test("facts CLI accepts absent optional settings but rejects malformed settings", (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "readme-facts-optional-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  for (const relative of ["scripts/readme/facts.mjs", "scripts/readme/lib.mjs", "scripts/readme/items.json", "CLAUDE.md"]) {
    const target = path.join(root, relative);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(absolute(relative), target);
  }
  fs.mkdirSync(path.join(root, ".claude/reference"), { recursive: true });
  // Only skill metadata is needed; no hooks or personal files enter the fixture.
  for (const name of facts.inventoryNames) {
    for (const runtime of [".claude", ".agents"]) {
      const target = path.join(root, runtime, "skills", name, "SKILL.md");
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.copyFileSync(absolute(`.claude/skills/${name}/SKILL.md`), target);
    }
  }
  fs.writeFileSync(path.join(root, ".agents/skill-modes.json"), JSON.stringify({ skills: {} }));
  const run = () => spawnSync(process.execPath, [path.join(root, "scripts/readme/facts.mjs")], { encoding: "utf8" });
  const absent = run();
  assert.equal(absent.status, 0, absent.stderr);
  const collected = JSON.parse(absent.stdout);
  assert.equal(collected.skillCount, facts.skillCount);
  assert.equal(collected.codexSkillCount, facts.skillCount);
  assert.deepEqual(collected.inventoryNames, facts.inventoryNames);
  assert.deepEqual(collected.warnings, []);
  assert.equal(fs.existsSync(path.join(root, ".claude/settings.json")), false);
  fs.writeFileSync(path.join(root, ".claude/settings.json"), "{malformed");
  const malformed = run();
  assert.equal(malformed.status, 1, malformed.stderr);
  assert.match(malformed.stderr, /SyntaxError/);
  assert.equal(malformed.stdout, "");
});

test("a project with one skill, a hand-edited README, and an unlisted skill builds and verifies with warnings", (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "readme-one-skill-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const repo = absolute(".");
  fs.cpSync(repo, root, { recursive: true, filter: (source) => !/^(?:\.git|\.tmp|node_modules)(?:[\\/]|$)/.test(path.relative(repo, source)) });
  const keep = facts.inventoryNames.includes("recall") ? "recall" : facts.inventoryNames[0];
  for (const runtime of [".claude/skills", ".agents/skills"]) {
    for (const entry of fs.readdirSync(path.join(root, runtime))) if (entry !== keep) fs.rmSync(path.join(root, runtime, entry), { recursive: true, force: true });
  }
  fs.mkdirSync(path.join(root, ".claude/skills/local-helper"), { recursive: true });
  fs.writeFileSync(path.join(root, ".claude/skills/local-helper/SKILL.md"), "---\nname: local-helper\ndescription: A project skill not yet listed in items.json.\n---\n");
  fs.appendFileSync(path.join(root, "README.md"), "\nHand-written note.\n");
  const verify = spawnSync(process.execPath, ["scripts/readme/verify.mjs"], { cwd: root, encoding: "utf8" });
  assert.equal(verify.status, 0, verify.stderr);
  assert.match(verify.stdout, /README artifacts are stale \([^)]*README\.md[^)]*\); run node scripts\/readme\/build\.mjs/);
  assert.match(verify.stdout, /local-helper: not listed in scripts\/readme\/items\.json/);
  const rebuild = spawnSync(process.execPath, ["scripts/readme/build.mjs"], { cwd: root, encoding: "utf8" });
  assert.equal(rebuild.status, 0, rebuild.stderr);
  const readme = fs.readFileSync(path.join(root, "README.md"), "utf8");
  assert.match(readme, /^## 1 workflow, loaded when called$/m);
  assert.match(readme, /^\*\*1 (?:core|discipline|specialist)\*\*$/m);
  assert.match(readme, /Click to browse the only skill/);
  assert.match(readme, /^<!-- removed skills: /m);
  assert.doesNotMatch(readme, / 0 (?:core|discipline|specialist)/);
  // Outside the header line, the README names no template skill that is not installed.
  const body = readme.split("\n").filter((line) => !line.startsWith("<!-- removed skills: ")).join("\n");
  for (const name of facts.templateNames.filter((name) => name !== keep)) {
    assert.ok(!body.includes(`\`${name}\``) && !body.includes(`/${name}`) && !body.includes(`claude-starter:${name}`), `README still names ${name}`);
  }
  const after = spawnSync(process.execPath, ["scripts/readme/verify.mjs"], { cwd: root, encoding: "utf8" });
  assert.equal(after.status, 0, after.stderr);
  assert.match(after.stdout, /README artifacts are current/);
});
