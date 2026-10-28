#!/usr/bin/env node

// Fails when any SKILL.md in .claude/skills/ or .agents/skills/ is 20,000 bytes
// or more. After compaction, Claude Code re-attaches an invoked skill cut at
// about 20,000 characters ("[... skill content truncated for compaction ...]"),
// so anything past that point silently drops out of a long session. Move rarely
// needed sections into the skill's references/ folder instead.

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const CAP = 20000;
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const over = [];

for (const dir of [".claude/skills", ".agents/skills"]) {
  const abs = path.join(root, dir);
  if (!fs.existsSync(abs)) continue;
  for (const entry of fs.readdirSync(abs, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const file = path.join(abs, entry.name, "SKILL.md");
    if (!fs.existsSync(file)) continue;
    const bytes = fs.statSync(file).size;
    if (bytes >= CAP) over.push(`${dir}/${entry.name}/SKILL.md: ${bytes} bytes`);
  }
}

if (over.length) {
  for (const line of over) console.error(`${line} (must be under ${CAP}; move rarely needed sections to references/)`);
  process.exitCode = 1;
} else {
  console.log(`All SKILL.md files are under ${CAP} bytes.`);
}
