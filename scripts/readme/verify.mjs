import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { collectFacts, readmeRemovedSkills } from "./facts.mjs";
import { absolute, read } from "./lib.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const names = ["boot", "feedback", "runtime", "skills"];
const variants = ["light", "dark", "narrow-light", "narrow-dark"];
const generated = ["README.md", ...names.flatMap((name) => variants.map((variant) => `assets/readme/${name}-${variant}.svg`))];

// A project that deleted skills (.agents/removed-skills.json) starts with the template's README,
// built for the full inventory. Accept it only while it still lists exactly that inventory; once
// build.mjs runs, the README names the removals and the byte-for-byte check below applies.
const facts = collectFacts();
if (facts.removed.length && fs.existsSync(absolute("README.md")) && !readmeRemovedSkills(read("README.md")).length) {
  const expected = facts.templateNames.join(", ");
  const problems = [];
  const list = read("README.md").match(/<!-- skill-list:start -->([\s\S]+)<!-- skill-list:end -->/)?.[1] ?? "";
  const listed = [...list.matchAll(/^- \[`([a-z0-9-]+)`\]/gm)].map((match) => match[1]).sort().join(", ");
  if (listed !== expected) problems.push("README.md: skill list is not the template inventory");
  for (const variant of variants) {
    const relativePath = `assets/readme/skills-${variant}.svg`;
    const drawn = fs.existsSync(absolute(relativePath))
      ? [...read(relativePath).matchAll(/data-skill="([a-z0-9-]+)"/g)].map((match) => match[1]).sort().join(", ")
      : "";
    if (drawn !== expected) problems.push(`${relativePath}: skill cells are not the template inventory`);
  }
  if (problems.length) {
    for (const problem of problems) process.stderr.write(`STALE: ${problem}\n`);
    process.exit(1);
  }
  process.stdout.write(`README artifacts describe the full template; ${facts.removed.length} removed skill(s) are recorded in .agents/removed-skills.json. Run node scripts/readme/build.mjs to rebuild them for this project.\n`);
  process.exit(0);
}

const before = new Map(generated.map((relativePath) => [relativePath, fs.existsSync(absolute(relativePath)) ? fs.readFileSync(absolute(relativePath)) : null]));

execFileSync(process.execPath, [path.join(here, "build.mjs")], { stdio: "ignore" });

const changed = generated.filter((relativePath) => {
  const prior = before.get(relativePath);
  const current = fs.readFileSync(absolute(relativePath));
  return prior === null || !prior.equals(current);
});

if (changed.length) {
  for (const relativePath of changed) process.stderr.write(`STALE: ${relativePath}\n`);
  process.exit(1);
}

process.stdout.write("README artifacts are current.\n");
