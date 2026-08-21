import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { collectFacts } from "./facts.mjs";
import { absolute, read } from "./lib.mjs";

const facts = collectFacts();
const panelNames = ["boot", "feedback", "runtime", "skills"];
const variants = ["light", "dark", "narrow-light", "narrow-dark"];
const requiredLinks = ["GUIDE.md", "CONTRIBUTING.md", "CHANGELOG.md", "LICENSE", "actions/workflows/validate-template.yml"];

test("README facts match the canonical repository inventory", () => {
  assert.equal(facts.skillCount, 30);
  assert.equal(facts.adapterCount, 30);
  assert.equal(facts.referenceFileCount, 6);
  assert.deepEqual(facts.runtimeNames, ["Claude Code", "Codex"]);
  assert.equal(facts.runtimeCount, facts.runtimeNames.length);
  assert.deepEqual(facts.tierCounts, { core: 8, discipline: 8, specialist: 14 });
  assert.deepEqual(facts.inventoryNames, facts.canonicalNames);
  assert.ok(facts.onDemandBytes > facts.residentBytes);
});

test("all panels ship four accessible local-only variants", () => {
  for (const name of panelNames) {
    for (const variant of variants) {
      const relativePath = `assets/readme/${name}-${variant}.svg`;
      assert.ok(fs.existsSync(absolute(relativePath)), `${relativePath} should exist`);
      const source = read(relativePath);
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
    const source = read(`assets/readme/${name}-narrow-light.svg`);
    for (const className of ["eyebrow", "label", "copy", "small"]) {
      assert.match(source, new RegExp(`\\.${className}\\{font-size:(?:1[4-9]|[2-9][0-9])px`), `${name}: ${className}`);
    }
  }
});

test("feedback circuit separates local learning from human-gated propagation", () => {
  for (const variant of variants) {
    const source = read(`assets/readme/feedback-${variant}.svg`);
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
    const source = read(`assets/readme/skills-${variant}.svg`);
    const scan = source.match(/<g class="scan-bar"[\s\S]*?<\/g>/)?.[0] ?? "";
    assert.ok(scan);
    assert.doesNotMatch(scan, /\brx=/);
  }
});

test("boot trace contains every row and one sequenced cursor", () => {
  for (const variant of variants) {
    const source = read(`assets/readme/boot-${variant}.svg`);
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
    const source = read(`assets/readme/skills-${variant}.svg`);
    assert.equal((source.match(/data-skill="/g) ?? []).length, facts.skillCount);
    for (const skill of facts.canonicalNames) {
      assert.equal((source.match(new RegExp(`data-skill="${skill}"`, "g")) ?? []).length, 1, `${variant}: ${skill}`);
    }
    assert.match(source, /data-group-count="8"/);
    assert.match(source, /data-group-count="14"/);
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
    const boot = read(`assets/readme/boot-${variant}.svg`);
    const runtime = read(`assets/readme/runtime-${variant}.svg`);
    assert.match(boot, new RegExp(`${facts.skillCount} workflows ready`));
    assert.match(boot, new RegExp(`${facts.referenceFileCount} files mounted`));
    assert.match(boot, new RegExp(`${facts.runtimeCount} targets declared`));
    assert.match(runtime, new RegExp(`${facts.skillCount} canonical workflows`));
    assert.match(runtime, new RegExp(`${facts.adapterCount} (?:ADAPTERS VERIFIED|adapters)`, "i"));
  }
});

test("generated README keeps installation early and maps exact picture variants", () => {
  const readme = read("README.md");
  assert.ok(readme.startsWith("<!-- generated by scripts/readme/build.mjs. do not edit by hand. -->"));
  assert.ok(readme.indexOf("/plugin marketplace add") < readme.indexOf("GUIDE.md"));
  assert.equal((readme.match(/<picture>/g) ?? []).length, panelNames.length);
  assert.match(readme, new RegExp(`## ${facts.skillCount} workflows, loaded when called`));
  assert.match(readme, new RegExp(`${facts.tierCounts.core} core · ${facts.tierCounts.discipline} discipline · ${facts.tierCounts.specialist} specialist`));
  assert.match(readme, /recall → work → verify → refine → reviewed repository change → next task/);
  assert.match(readme, /Success means the doctor reports no failures/);
  assert.ok(readme.indexOf("[Install the skills or start a repository](#quickstart)") < readme.indexOf("## the repository feedback loop"));
  assert.match(readme, /<summary><strong>Click to open the generated skill memory map<\/strong><\/summary>/);
  assert.match(readme, new RegExp(`<summary><strong>Click to browse all ${facts.skillCount} skills<\\/strong><\\/summary>`));
  for (const link of requiredLinks) assert.ok(readme.includes(link), `README links ${link}`);

  for (const name of panelNames) {
    const expected = `<picture>\n<source media="(max-width: 500px) and (prefers-color-scheme: dark)" srcset="assets/readme/${name}-narrow-dark.svg">\n<source media="(max-width: 500px)" srcset="assets/readme/${name}-narrow-light.svg">\n<source media="(prefers-color-scheme: dark)" srcset="assets/readme/${name}-dark.svg">\n<img`;
    assert.ok(readme.includes(expected), `${name}: exact source order`);
    assert.match(readme, new RegExp(`src="assets/readme/${name}-light\\.svg"`));
  }

  for (const match of readme.matchAll(/(?:src|srcset)="(assets\/readme\/[^"]+)"/g)) {
    assert.ok(fs.existsSync(absolute(match[1])), `${match[1]} should exist`);
  }

  const list = readme.match(/<!-- skill-list:start -->([\s\S]+)<!-- skill-list:end -->/)?.[1] ?? "";
  assert.ok(list);
  for (const skill of facts.canonicalNames) {
    assert.equal((list.match(new RegExp(`\\[\\\`${skill}\\\`\\]`, "g")) ?? []).length, 1, skill);
  }
});

test("human-facing README files follow the writing contract", () => {
  for (const relativePath of ["README.md", "GUIDE.md"]) {
    const source = read(relativePath);
    assert.doesNotMatch(source, /—/u, `${relativePath} contains an em dash`);
    assert.doesNotMatch(source, /^#{1,6} .+\.$/mu, `${relativePath} has a heading with a trailing period`);
  }
  assert.doesNotMatch(read("README.md"), /repo-resident operating layer|The repository learns|hot path/i);
});
