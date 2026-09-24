import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { absolute, frontmatter, read, readJson } from "./lib.mjs";

function directories(relativeRoot) {
  return fs.readdirSync(absolute(relativeRoot), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((name) => fs.existsSync(absolute(`${relativeRoot}/${name}/SKILL.md`)))
    .sort();
}

function sameMembers(actual, expected, label) {
  if (actual.length !== expected.length || actual.some((name, index) => name !== expected[index])) {
    throw new Error(`${label} drift\nactual: ${actual.join(", ")}\nexpected: ${expected.join(", ")}`);
  }
}

function normalizedBytes(text) {
  return Buffer.byteLength(text.replaceAll("\r\n", "\n"));
}

// Skills deleted on purpose, from .agents/removed-skills.json. The full validation of that
// record lives in .claude/scripts/removed-skills.mjs; here it only narrows the inventory.
export function removedSkills() {
  if (!fs.existsSync(absolute(".agents/removed-skills.json"))) return [];
  const record = readJson(".agents/removed-skills.json");
  if (record?.version !== 1 || !Array.isArray(record.removed) || record.removed.some((name) => typeof name !== "string")) {
    throw new Error('.agents/removed-skills.json: expected {"version": 1, "removed": [...]}');
  }
  return [...record.removed].sort();
}

// A README built after removals names them on its second line. A README without that line
// was built for the full template.
export function removedLine(names) {
  return `<!-- removed skills: ${names.join(", ")} -->`;
}

export function readmeRemovedSkills(text) {
  const match = text.match(/^<!-- removed skills: ([a-z0-9, -]+) -->$/m);
  return match ? match[1].split(", ") : [];
}

function countByGroup(groupIds, items) {
  const counts = Object.fromEntries(groupIds.map((group) => [group, 0]));
  for (const item of items) {
    if (!groupIds.includes(item.group)) throw new Error(`${item.name}: unknown group ${item.group}`);
    counts[item.group] += 1;
  }
  return counts;
}

export function expectedCodexNames(canonicalNames, modes = {}, overrides = {}, removed = []) {
  const enabled = name => modes[name] !== "disabled" && overrides[name] !== "off" && !removed.includes(name);
  const names = new Set(canonicalNames.filter(enabled));
  for (const [name, mode] of Object.entries(modes)) if (mode === "native" && enabled(name)) names.add(name);
  return [...names].sort();
}

export function collectFacts() {
  const inventory = readJson("scripts/readme/items.json");
  const groupIds = inventory.groups.map((group) => group.id);
  sameMembers([...groupIds].sort(), ["core", "discipline", "specialist"], "skill groups");

  const removed = removedSkills();
  const templateNames = inventory.skills.map((skill) => skill.name).sort();
  const present = inventory.skills.filter((skill) => !removed.includes(skill.name));
  const canonicalNames = directories(".claude/skills");
  const codexNames = directories(".agents/skills");
  const inventoryNames = present.map((skill) => skill.name).sort();
  sameMembers(inventoryNames, canonicalNames, "README skill inventory");
  const modes = fs.existsSync(absolute(".agents/skill-modes.json")) ? readJson(".agents/skill-modes.json").skills : {};
  let overrides = {};
  try {
    overrides = readJson(".claude/settings.json").skillOverrides ?? {};
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  sameMembers(codexNames, expectedCodexNames(canonicalNames, modes, overrides, removed), "Codex skill inventory");

  const templateTierCounts = countByGroup(groupIds, inventory.skills);
  const tierCounts = countByGroup(groupIds, present);
  const skills = present.map((item) => {
    const relativePath = `.claude/skills/${item.name}/SKILL.md`;
    const text = read(relativePath);
    const metadata = frontmatter(text, relativePath);
    if (metadata.name && metadata.name !== item.name) throw new Error(`${relativePath}: name ${metadata.name} does not match directory`);
    return {
      ...item,
      description: metadata.description,
      bytes: normalizedBytes(text),
    };
  });

  const referenceFileCount = fs.readdirSync(absolute(".claude/reference"), { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
    .length;
  const kernelBytes = normalizedBytes(read("CLAUDE.md"));
  const catalogBytes = skills.reduce(
    (total, skill) => total + Buffer.byteLength(skill.name) + Buffer.byteLength(skill.description),
    0,
  );
  const catalogChars = skills.reduce((total, skill) => total + skill.name.length + skill.description.length, 0);
  const onDemandBytes = skills.reduce((total, skill) => total + skill.bytes, 0);
  const residentBytes = kernelBytes + catalogBytes;

  const runtimeNames = ["Claude Code", "Codex"];

  return {
    skillCount: canonicalNames.length,
    codexSkillCount: codexNames.length,
    codexNativeCount: codexNames.filter(name => modes[name] === "native").length,
    codexAdapterCount: codexNames.filter(name => modes[name] !== "native").length,
    runtimeNames,
    runtimeCount: runtimeNames.length,
    referenceFileCount,
    tierCounts,
    templateTierCounts,
    canonicalNames,
    inventoryNames,
    templateNames,
    removed,
    groups: inventory.groups,
    skills,
    kernelBytes,
    catalogBytes,
    catalogChars,
    onDemandBytes,
    residentBytes,
    lazyRatio: onDemandBytes / residentBytes,
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.stdout.write(`${JSON.stringify(collectFacts(), null, 2)}\n`);
}
