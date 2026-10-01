#!/usr/bin/env node
// Checks .agents/template-manifest.json against the template repository it describes.
//
// The manifest says which paths ship into a new project (projectPaths), which stay in the
// template (templateOnly), which files a new project must have (requiredFiles), and how the
// skills are grouped and depend on each other. Every project creator reads it, so a wrong
// entry ships template files into projects or deletes files projects need. This check fails on:
// - a repository file that no entry matches, or that more than one entry matches;
// - an entry that matches no file, a nested or repeated entry, or a malformed path;
// - a required file that is missing, or that sits under a templateOnly entry;
// - a skill folder that is in no group or in two, or a group naming a folder that does not exist;
// - a name in skills.required, skills.dependencies or skills.presets that is not a skill folder.
//
// Repository files are the tracked files plus untracked files Git does not ignore, limited to
// files still on disk, so an added or deleted file counts before it is committed. Outside a Git
// checkout the check walks the folder instead, skipping .git, node_modules and scratch folders.
//
// Usage: node bootstrap/tests/check-template-manifest.mjs   (from any directory)

import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { MANIFEST_PATH, readTemplateManifest } from "../../.claude/scripts/removed-skills.mjs";

const SKILL_ROOTS = [".claude/skills", ".agents/skills"];
const NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const ENTRY = /^[^/\\*?[\]{}]+(?:\/[^/\\*?[\]{}]+)*$/;
const GROUP_KEYS = ["id", "label", "description", "skills"];
const SKILLS_KEYS = ["groups", "required", "dependencies", "presets"];

// True when the repository file is covered by the entry.
export const matches = (entry, file) => file === entry || file.startsWith(`${entry}/`);

const isStringArray = (value) => Array.isArray(value) && value.every((item) => typeof item === "string");
const isObject = (value) => Boolean(value) && typeof value === "object" && !Array.isArray(value);

// Lists repository files as repo-relative paths with forward slashes.
export function listRepoFiles(root) {
  const top = spawnSync("git", ["-C", root, "rev-parse", "--show-cdup"], { encoding: "utf8" });
  if (top.status === 0 && top.stdout.trim() === "") {
    const git = spawnSync("git", ["-C", root, "ls-files", "-z", "--cached", "--others", "--exclude-standard"], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
    if (git.status !== 0) throw new Error(`git ls-files failed: ${git.stderr.trim()}`);
    const files = new Set(git.stdout.split("\0").filter(Boolean).map((file) => file.replace(/\/$/, "")));
    return [...files].filter((file) => fs.existsSync(path.join(root, file))).sort();
  }
  const files = [];
  const walk = (relative) => {
    for (const entry of fs.readdirSync(path.join(root, relative), { withFileTypes: true })) {
      const child = relative ? `${relative}/${entry.name}` : entry.name;
      if (entry.name === ".git" || entry.name === "node_modules") continue;
      if (!relative && (/^\.tmp/.test(entry.name) || entry.name === "dist" || entry.name === "build")) continue;
      if (child === ".claude/worktrees" || child === ".claude/settings.local.json") continue;
      if (entry.isDirectory()) walk(child);
      else files.push(child);
    }
  };
  walk("");
  return files.sort();
}

// Lists the folder names that hold a SKILL.md in either runtime.
export function listSkillFolders(root) {
  const names = new Set();
  for (const skillRoot of SKILL_ROOTS) {
    const directory = path.join(root, skillRoot);
    if (!fs.existsSync(directory)) continue;
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      if (entry.isDirectory() && fs.existsSync(path.join(directory, entry.name, "SKILL.md"))) names.add(entry.name);
    }
  }
  return [...names].sort();
}

// Returns every rule the manifest breaks. files: repository files; skills: skill folder names;
// isFile(relative): whether that path is a file on disk.
export function checkManifest(manifest, { files, skills, isFile }) {
  const errors = [];
  const skillSet = new Set(skills);

  if (typeof manifest.template !== "string" || !/^[^/\s]+\/[^/\s]+$/.test(manifest.template)) {
    errors.push(`template: expected "owner/repo", got ${JSON.stringify(manifest.template)}`);
  }
  if (typeof manifest.readmeStub !== "string" || !manifest.readmeStub.includes("{name}")) {
    errors.push("readmeStub: expected a string containing {name}");
  }

  const lists = {};
  for (const key of ["requiredFiles", "projectPaths", "templateOnly"]) {
    if (!isStringArray(manifest[key])) {
      errors.push(`${key}: expected an array of path strings`);
      lists[key] = [];
      continue;
    }
    lists[key] = manifest[key];
    for (const entry of manifest[key]) {
      if (!ENTRY.test(entry) || entry.split("/").some((part) => part === "." || part === "..")) {
        errors.push(`${key}: ${JSON.stringify(entry)} is not a repo-relative path with forward slashes, no trailing slash and no glob`);
      }
    }
  }

  // Partition: the entries must not repeat or nest, and every file matches exactly one entry.
  const entries = [
    ...lists.projectPaths.map((entry) => ({ entry, list: "projectPaths" })),
    ...lists.templateOnly.map((entry) => ({ entry, list: "templateOnly" })),
  ];
  for (let i = 0; i < entries.length; i += 1) {
    for (let j = i + 1; j < entries.length; j += 1) {
      const [a, b] = [entries[i], entries[j]];
      if (a.entry === b.entry) errors.push(`${a.list} and ${b.list}: ${a.entry} is listed twice`);
      else if (matches(a.entry, b.entry) || matches(b.entry, a.entry)) {
        errors.push(`${a.list} ${a.entry} and ${b.list} ${b.entry} overlap; entries must not nest`);
      }
    }
  }
  const hits = new Map(entries.map(({ entry }) => [entry, 0]));
  for (const file of files) {
    const owners = entries.filter(({ entry }) => matches(entry, file));
    for (const { entry } of owners) hits.set(entry, hits.get(entry) + 1);
    if (owners.length === 0) errors.push(`${file}: not covered by projectPaths or templateOnly; add it to one of them`);
    else if (owners.length > 1) errors.push(`${file}: covered by more than one entry (${owners.map(({ entry }) => entry).join(", ")})`);
  }
  for (const { entry, list } of entries) {
    if (hits.get(entry) === 0) errors.push(`${list}: ${entry} matches no file in the repository`);
  }

  // Required files: present, and shipped rather than stripped.
  if (!lists.requiredFiles.includes(MANIFEST_PATH)) errors.push(`requiredFiles: must include ${MANIFEST_PATH}`);
  for (const file of lists.requiredFiles) {
    if (!isFile(file)) errors.push(`requiredFiles: ${file} does not exist`);
    if (lists.templateOnly.some((entry) => matches(entry, file))) errors.push(`requiredFiles: ${file} is under templateOnly, so new projects would lose it`);
    else if (!lists.projectPaths.some((entry) => matches(entry, file))) errors.push(`requiredFiles: ${file} is not under any projectPaths entry`);
  }

  // Skills.
  const rules = manifest.skills;
  if (!isObject(rules)) {
    errors.push("skills: expected an object");
    return errors;
  }
  for (const key of Object.keys(rules)) if (!SKILLS_KEYS.includes(key)) errors.push(`skills: unknown key ${key}`);
  const known = (where, name) => {
    if (typeof name !== "string" || !skillSet.has(name)) errors.push(`${where}: ${JSON.stringify(name)} is not a skill folder under ${SKILL_ROOTS.join(" or ")}`);
  };

  const grouped = new Map();
  const groupIds = new Set();
  if (!Array.isArray(rules.groups) || rules.groups.length === 0) errors.push("skills.groups: expected a non-empty array");
  for (const [index, group] of (Array.isArray(rules.groups) ? rules.groups : []).entries()) {
    const where = `skills.groups[${index}]`;
    if (!isObject(group)) {
      errors.push(`${where}: expected an object`);
      continue;
    }
    for (const key of Object.keys(group)) if (!GROUP_KEYS.includes(key)) errors.push(`${where}: unknown key ${key}`);
    if (typeof group.id !== "string" || !NAME.test(group.id)) errors.push(`${where}.id: expected a lowercase id`);
    else if (groupIds.has(group.id)) errors.push(`${where}.id: ${group.id} is used twice`);
    else groupIds.add(group.id);
    for (const key of ["label", "description"]) if (typeof group[key] !== "string" || !group[key].trim()) errors.push(`${where}.${key}: expected text`);
    if (!isStringArray(group.skills)) {
      errors.push(`${where}.skills: expected an array of skill names`);
      continue;
    }
    for (const name of group.skills) {
      known(`${where}.skills`, name);
      grouped.set(name, [...(grouped.get(name) ?? []), group.id]);
    }
  }
  for (const name of skills) {
    const groups = grouped.get(name) ?? [];
    if (groups.length === 0) errors.push(`skills.groups: skill folder ${name} is in no group`);
    else if (groups.length > 1) errors.push(`skills.groups: ${name} is in more than one group (${groups.join(", ")})`);
  }

  if (!isStringArray(rules.required)) errors.push("skills.required: expected an array of skill names");
  else for (const name of rules.required) known("skills.required", name);

  if (!isObject(rules.dependencies)) errors.push("skills.dependencies: expected an object");
  else {
    for (const [name, needs] of Object.entries(rules.dependencies)) {
      known("skills.dependencies", name);
      if (!isStringArray(needs)) errors.push(`skills.dependencies.${name}: expected an array of skill names`);
      else for (const need of needs) known(`skills.dependencies.${name}`, need);
    }
  }

  if (!isObject(rules.presets)) errors.push("skills.presets: expected an object");
  else {
    for (const [preset, value] of Object.entries(rules.presets)) {
      if (!isObject(value) || !isStringArray(value.omit) || Object.keys(value).some((key) => key !== "omit")) {
        errors.push(`skills.presets.${preset}: expected {"omit": [skill names]}`);
        continue;
      }
      for (const name of value.omit) {
        known(`skills.presets.${preset}.omit`, name);
        if (isStringArray(rules.required) && rules.required.includes(name)) errors.push(`skills.presets.${preset}.omit: ${name} is a required skill`);
      }
    }
  }

  return errors;
}

// Reads the manifest and the repository under root and returns the broken rules.
export function checkRepository(root) {
  const manifest = readTemplateManifest(root);
  if (!manifest) return [`${MANIFEST_PATH} is missing`];
  return checkManifest(manifest, {
    files: listRepoFiles(root),
    skills: listSkillFolders(root),
    isFile: (relative) => fs.existsSync(path.join(root, relative)) && fs.statSync(path.join(root, relative)).isFile(),
  });
}

const ownPath = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === ownPath) {
  try {
    const root = path.resolve(path.dirname(ownPath), "../..");
    const errors = checkRepository(root);
    const prefix = process.env.GITHUB_ACTIONS === "true" ? "::error::" : "FAIL: ";
    for (const error of errors) console.error(`${prefix}${error}`);
    if (errors.length) process.exitCode = 1;
    else console.log(`${MANIFEST_PATH} matches the repository.`);
  } catch (error) {
    console.error(`FAIL: ${error.message}`);
    process.exitCode = 1;
  }
}
