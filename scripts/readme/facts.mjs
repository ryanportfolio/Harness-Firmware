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

// Differences between two name lists, for warnings. Empty when they match.
function difference(label, actual, expected) {
  const missing = expected.filter((name) => !actual.includes(name));
  const extra = actual.filter((name) => !expected.includes(name));
  const parts = [];
  if (missing.length) parts.push(`missing ${missing.join(", ")}`);
  if (extra.length) parts.push(`unlisted ${extra.join(", ")}`);
  return parts.length ? [`${label}: ${parts.join("; ")}`] : [];
}

function normalizedBytes(text) {
  return Buffer.byteLength(text.replaceAll("\r\n", "\n"));
}

// A README built while template skills are missing names them on its second line.
export function removedLine(names) {
  return `<!-- removed skills: ${names.join(", ")} -->`;
}

function countByGroup(groupIds, items) {
  const counts = Object.fromEntries(groupIds.map((group) => [group, 0]));
  for (const item of items) {
    if (!groupIds.includes(item.group)) throw new Error(`${item.name}: unknown group ${item.group}`);
    counts[item.group] += 1;
  }
  return counts;
}

export function expectedCodexNames(canonicalNames, modes = {}, overrides = {}) {
  const enabled = name => modes[name] !== "disabled" && overrides[name] !== "off";
  const names = new Set(canonicalNames.filter(enabled));
  for (const [name, mode] of Object.entries(modes)) if (mode === "native" && enabled(name)) names.add(name);
  return [...names].sort();
}

// Skills that items.json does not place, or places in an unknown group, land here.
const DEFAULT_GROUP = "specialist";

export function collectFacts() {
  const inventory = readJson("scripts/readme/items.json");
  const groupIds = inventory.groups.map((group) => group.id);
  if ([...groupIds].sort().join() !== "core,discipline,specialist") throw new Error("scripts/readme/items.json: skill groups must be core, discipline, specialist");

  // The skill folders decide which skills the README lists; items.json only adds a label,
  // a group and an order. A folder that items.json does not list joins the default group
  // under its folder name, after the listed skills. An items.json entry without a folder is
  // left out. Neither warns or fails.
  const canonicalNames = directories(".claude/skills");
  const codexNames = directories(".agents/skills");
  const templateNames = inventory.skills.map((skill) => skill.name).sort();
  const placed = (item) => ({ ...item, label: item.label || item.name, group: groupIds.includes(item.group) ? item.group : DEFAULT_GROUP });
  const present = [
    ...inventory.skills.filter((skill) => canonicalNames.includes(skill.name)).map(placed),
    ...canonicalNames.filter((name) => !templateNames.includes(name)).map((name) => placed({ name })),
  ];
  const removed = templateNames.filter((name) => !canonicalNames.includes(name));
  const inventoryNames = present.map((skill) => skill.name).sort();
  const warnings = [];
  const modes = fs.existsSync(absolute(".agents/skill-modes.json")) ? readJson(".agents/skill-modes.json").skills : {};
  let overrides = {};
  try {
    overrides = readJson(".claude/settings.json").skillOverrides ?? {};
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  const codexExpected = expectedCodexNames(canonicalNames, modes, overrides).filter((name) => canonicalNames.includes(name) || codexNames.includes(name));
  warnings.push(...difference("Codex skill inventory", codexNames, codexExpected));

  const templateTierCounts = countByGroup(groupIds, inventory.skills.map(placed));
  const tierCounts = countByGroup(groupIds, present);
  const skills = present.map((item) => {
    const relativePath = `.claude/skills/${item.name}/SKILL.md`;
    const text = read(relativePath);
    const metadata = frontmatter(text, relativePath);
    if (metadata.name && metadata.name !== item.name) warnings.push(`${relativePath}: name ${metadata.name} does not match directory`);
    return {
      ...item,
      description: metadata.description,
      bytes: normalizedBytes(text),
    };
  });

  const referenceFileCount = !fs.existsSync(absolute(".claude/reference")) ? 0 : fs.readdirSync(absolute(".claude/reference"), { withFileTypes: true })
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
    skillCount: present.length,
    codexSkillCount: codexNames.length,
    codexNativeCount: codexNames.filter(name => modes[name] === "native").length,
    runtimeNames,
    runtimeCount: runtimeNames.length,
    referenceFileCount,
    tierCounts,
    templateTierCounts,
    canonicalNames,
    inventoryNames,
    templateNames,
    removed,
    warnings,
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
