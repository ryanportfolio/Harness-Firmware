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

export function expectedCodexNames(canonicalNames, modes = {}, overrides = {}) {
  const enabled = name => modes[name] !== "disabled" && overrides[name] !== "off";
  const names = new Set(canonicalNames.filter(enabled));
  for (const [name, mode] of Object.entries(modes)) if (mode === "native" && enabled(name)) names.add(name);
  return [...names].sort();
}

export function collectFacts() {
  const inventory = readJson("scripts/readme/items.json");
  const groupIds = inventory.groups.map((group) => group.id);
  sameMembers([...groupIds].sort(), ["core", "discipline", "specialist"], "skill groups");

  const canonicalNames = directories(".claude/skills");
  const codexNames = directories(".agents/skills");
  const inventoryNames = inventory.skills.map((skill) => skill.name).sort();
  sameMembers(inventoryNames, canonicalNames, "README skill inventory");
  const modes = fs.existsSync(absolute(".agents/skill-modes.json")) ? readJson(".agents/skill-modes.json").skills : {};
  const overrides = readJson(".claude/settings.json").skillOverrides ?? {};
  sameMembers(codexNames, expectedCodexNames(canonicalNames, modes, overrides), "Codex skill inventory");

  const tierCounts = Object.fromEntries(groupIds.map((group) => [group, 0]));
  const skills = inventory.skills.map((item) => {
    if (!groupIds.includes(item.group)) throw new Error(`${item.name}: unknown group ${item.group}`);
    tierCounts[item.group] += 1;
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

  const requiredCounts = { core: 9, discipline: 11, specialist: 13 };
  for (const [group, expected] of Object.entries(requiredCounts)) {
    if (tierCounts[group] !== expected) throw new Error(`${group}: expected ${expected}, found ${tierCounts[group]}`);
  }

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
    runtimeNames,
    runtimeCount: runtimeNames.length,
    referenceFileCount,
    tierCounts,
    canonicalNames,
    inventoryNames,
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
