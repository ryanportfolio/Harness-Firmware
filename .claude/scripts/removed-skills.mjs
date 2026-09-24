#!/usr/bin/env node
// Skill presence: which registered skills are on disk, and the removal record.
//
// A registered skill that is missing from a runtime never fails a check. Projects add and
// remove skills, and the registry may catch up later. The checks warn instead:
// - a missing skill listed in .agents/removed-skills.json is intentional and stays silent;
// - a missing skill that is not listed gets a warning suggesting to record or restore it;
// - a present skill that needs a missing one (the "removal" block of
//   .agents/skill-capabilities.json) gets a warning naming both.
// What still fails: a record or manifest that cannot be parsed.
//
// Usage: node .claude/scripts/removed-skills.mjs   (prints the record and any warnings)

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const RECORD_PATH = ".agents/removed-skills.json";
const NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const RUNTIME_ROOTS = [".claude/skills", ".agents/skills"];

// Returns the recorded names in file order. An absent record means nothing was removed.
// A malformed record throws: a check must never guess which skills were meant.
export function readRemovedSkills(root) {
  const file = path.join(root, RECORD_PATH);
  if (!fs.existsSync(file)) return [];
  const record = JSON.parse(fs.readFileSync(file, "utf8"));
  if (!record || typeof record !== "object" || Array.isArray(record) || record.version !== 1 || !Array.isArray(record.removed)) {
    throw new Error(`${RECORD_PATH}: expected {"version": 1, "removed": [...]}`);
  }
  const extra = Object.keys(record).filter((key) => key !== "version" && key !== "removed");
  if (extra.length) throw new Error(`${RECORD_PATH}: unknown field ${extra.join(", ")}`);
  for (const name of record.removed) {
    if (typeof name !== "string" || !NAME.test(name)) throw new Error(`${RECORD_PATH}: invalid skill name ${JSON.stringify(name)}`);
  }
  return [...record.removed];
}

// True when the skill has an entrypoint in at least one runtime.
export function skillPresent(root, name) {
  return RUNTIME_ROOTS.some((directory) => fs.existsSync(path.join(root, directory, name, "SKILL.md")));
}

// Reviews the record and the dependency declarations against the working tree.
// errors: the removal block itself is malformed. warnings: everything about presence.
export function reviewRemovals(root, manifest, removed = readRemovedSkills(root)) {
  const errors = [];
  const warnings = [];
  const skills = manifest.skills ?? {};
  const policy = manifest.removal;
  // Manifests from before the removal record have no policy; there is nothing to review.
  if (!policy) return { errors, warnings };
  if (!Array.isArray(policy.required) || !policy.dependencies || typeof policy.dependencies !== "object" || Array.isArray(policy.dependencies)) {
    return { errors: [".agents/skill-capabilities.json: removal block needs required and dependencies"], warnings };
  }
  for (const [name, needs] of Object.entries(policy.dependencies)) {
    if (!Array.isArray(needs) || !needs.length || needs.some((need) => typeof need !== "string")) {
      errors.push(`removal policy: ${name} needs a nonempty list of skill names`);
    }
  }
  if (errors.length) return { errors, warnings };

  const sorted = [...new Set(removed)].sort();
  if (removed.length !== sorted.length || removed.some((name, index) => name !== sorted[index])) {
    warnings.push(`${RECORD_PATH}: list names once, sorted: ${JSON.stringify(sorted)}`);
  }
  for (const name of new Set(removed)) {
    if (manifest.retired?.[name]) warnings.push(`${name}: retired skills are not removals; delete it from ${RECORD_PATH}`);
    else if (!skills[name]) warnings.push(`${name}: recorded as removed but not a registered skill`);
    else if (skillPresent(root, name)) warnings.push(`${name}: recorded as removed but still present; delete it from ${RECORD_PATH}`);
    else if (policy.required.includes(name)) warnings.push(`${name}: recorded as removed, but the template treats it as required`);
  }
  for (const [name, needs] of Object.entries(policy.dependencies)) {
    if (!skills[name] || !skillPresent(root, name)) continue;
    for (const need of needs) {
      if (!skillPresent(root, need)) warnings.push(`${name} needs ${need}, which is not installed; restore ${need} or remove ${name} too`);
    }
  }
  return { errors, warnings };
}

// Prints warnings so they show up locally and as GitHub Actions annotations.
export function printWarnings(warnings, stream = process.stdout) {
  const prefix = process.env.GITHUB_ACTIONS === "true" ? "::warning::" : "WARN: ";
  for (const warning of warnings) stream.write(`${prefix}${warning}\n`);
}

const ownPath = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === ownPath) {
  try {
    const root = path.resolve(path.dirname(ownPath), "../..");
    const manifest = JSON.parse(fs.readFileSync(path.join(root, ".agents/skill-capabilities.json"), "utf8"));
    const removed = readRemovedSkills(root);
    const { errors, warnings } = reviewRemovals(root, manifest, removed);
    printWarnings(warnings);
    if (errors.length) { errors.forEach((error) => console.error(`FAIL: ${error}`)); process.exitCode = 1; }
    else console.log(removed.length ? `Removed skills: ${removed.join(", ")}` : "No skills recorded as removed.");
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
