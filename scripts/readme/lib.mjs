import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
export const MONO = "ui-monospace,'SFMono-Regular','Cascadia Mono',Menlo,Consolas,'Liberation Mono',monospace";
export const SANS = "-apple-system,BlinkMacSystemFont,'Segoe UI','Noto Sans',Helvetica,Arial,sans-serif";

export const THEMES = Object.freeze({
  light: { ink: "#1f2328", mute: "#59636e", rule: "#d1d9e0", accent: "#1a7f37", soft: "#dafbe1" },
  dark: { ink: "#f0f6fc", mute: "#9198a1", rule: "#3d444d", accent: "#3fb950", soft: "#12261e" },
});

export function absolute(relativePath) {
  return path.join(ROOT, relativePath);
}

export function read(relativePath) {
  return fs.readFileSync(absolute(relativePath), "utf8");
}

export function readJson(relativePath) {
  return JSON.parse(read(relativePath));
}

export function writeText(relativePath, value) {
  const target = absolute(relativePath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, value.replaceAll("\r\n", "\n"), "utf8");
}

export function esc(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function scalar(value) {
  const trimmed = value.trim();
  if (trimmed.startsWith('"')) return JSON.parse(trimmed);
  if (trimmed.startsWith("'") && trimmed.endsWith("'")) {
    return trimmed.slice(1, -1).replaceAll("''", "'");
  }
  return trimmed;
}

function block(lines, style) {
  const normalized = lines.map((line) => line.replace(/^\s+/, ""));
  if (style === "|") return normalized.join("\n").trim();
  const paragraphs = [];
  let current = [];
  for (const line of normalized) {
    if (!line.trim()) {
      if (current.length) paragraphs.push(current.join(" "));
      current = [];
    } else {
      current.push(line.trim());
    }
  }
  if (current.length) paragraphs.push(current.join(" "));
  return paragraphs.join("\n\n").trim();
}

export function frontmatter(text, source = "SKILL.md") {
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!match) throw new Error(`${source}: missing YAML frontmatter`);
  const lines = match[1].split(/\r?\n/);
  const metadata = { name: "", description: "" };
  for (let index = 0; index < lines.length; index += 1) {
    const nameMatch = lines[index].match(/^name:\s*(.+)$/);
    if (nameMatch) metadata.name = scalar(nameMatch[1]);
    const descriptionMatch = lines[index].match(/^description:\s*(.*)$/);
    if (!descriptionMatch) continue;
    const value = descriptionMatch[1].trim();
    if (/^[>|][-+]?$/.test(value)) {
      const content = [];
      for (index += 1; index < lines.length; index += 1) {
        if (/^\S/.test(lines[index])) {
          index -= 1;
          break;
        }
        content.push(lines[index]);
      }
      metadata.description = block(content, value[0]);
    } else {
      metadata.description = scalar(value);
    }
  }
  if (!metadata.description) throw new Error(`${source}: incomplete frontmatter`);
  return metadata;
}
