#!/usr/bin/env node
// Removal record: skills a project deleted on purpose.
//
// .agents/removed-skills.json lists optional skills whose folders were deleted from both
// runtimes. Every check that expects a skill folder skips the names listed here. A missing
// folder that is not listed still fails. Which skills may be removed, and which skills need
// others, is declared once in the "removal" block of .agents/skill-capabilities.json.
//
// Usage: node .claude/scripts/removed-skills.mjs   (prints the record and any problems)

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

// Checks the record against the manifest's removal policy and the working tree.
export function validateRemovals(root, manifest, removed = readRemovedSkills(root)) {
  const errors = [];
  const skills = manifest.skills ?? {};
  const policy = manifest.removal;
  // Manifests from before the removal record have no policy; they are valid until something is removed.
  if (!policy && !removed.length) return errors;
  if (!policy ||!Array.isArray(policy.required) || !policy.dependencies || typeof policy.dependencies !== "object" || Array.isArray(policy.dependencies)) {
    return [".agents/skill-capabilities.json: removal block needs required and dependencies"];
  }
  for (const name of policy.required) if (!skills[name]) errors.push(`removal policy: required skill ${name} is not registered`);
  for (const [name, needs] of Object.entries(policy.dependencies)) {
    if (!skills[name]) errors.push(`removal policy: dependency owner ${name} is not registered`);
    if (!Array.isArray(needs) || !needs.length) { errors.push(`removal policy: ${name} needs a nonempty dependency list`); continue; }
    for (const need of needs) if (!skills[need]) errors.push(`removal policy: ${name} depends on unregistered ${need}`);
  }

  const sorted = [...new Set(removed)].sort();
  if (removed.length !== sorted.length || removed.some((name, index) => name !== sorted[index])) {
    errors.push(`${RECORD_PATH}: list names once, sorted: ${JSON.stringify(sorted)}`);
  }
  const gone = new Set(removed);
  for (const name of gone) {
    if (manifest.retired?.[name]) { errors.push(`${name}: retired skills are not removals; delete it from ${RECORD_PATH}`); continue; }
    if (!skills[name]) { errors.push(`${name}: recorded as removed but not a registered skill`); continue; }
    if (policy.required.includes(name)) errors.push(`${name}: required skill cannot be removed`);
    for (const directory of RUNTIME_ROOTS) {
      if (fs.existsSync(path.join(root, directory, name))) errors.push(`${name}: recorded as removed but ${directory}/${name}/ still exists`);
    }
  }
  for (const [name, needs] of Object.entries(policy.dependencies)) {
    if (gone.has(name) || !Array.isArray(needs)) continue;
    for (const need of needs) {
      if (gone.has(need)) errors.push(`${name} depends on ${need}, which is recorded as removed; restore ${need} or remove ${name} too`);
    }
  }
  return errors;
}

const ownPath = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === ownPath) {
  try {
    const root = path.resolve(path.dirname(ownPath), "../..");
    const manifest = JSON.parse(fs.readFileSync(path.join(root, ".agents/skill-capabilities.json"), "utf8"));
    const removed = readRemovedSkills(root);
    const errors = validateRemovals(root, manifest, removed);
    if (errors.length) { errors.forEach((error) => console.error(`FAIL: ${error}`)); process.exitCode = 1; }
    else console.log(removed.length ? `Removed skills: ${removed.join(", ")}` : "No skills recorded as removed.");
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
